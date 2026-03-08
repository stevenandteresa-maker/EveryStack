'use server';

/**
 * Server Actions — Schema change resolution operations.
 *
 * - acceptSchemaChangeAction: Accept a field type change, rename, or new field
 * - rejectSchemaChangeAction: Reject a change (keep local state)
 * - archiveFieldAction: Soft-archive a deleted field (data preserved, hidden)
 * - deleteFieldSchemaChangeAction: Delete field and clear data
 * - addFieldFromPlatformAction: Create field + mapping from new platform field
 *
 * @see docs/reference/sync-engine.md § Schema Mismatch
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import { writeAuditLog } from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import {
  getDbForTenant,
  fields,
  syncedFieldMappings,
  records,
  generateUUIDv7,
  eq,
  and,
} from '@everystack/shared/db';
import {
  acceptSchemaChange,
  rejectSchemaChange,
  updateFieldTypeFromSchemaChange,
  disconnectFieldMapping,
  archiveField,
  renameField,
} from '@everystack/shared/sync';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const resolveChangeSchema = z.object({
  changeId: z.string().uuid(),
  changeType: z.enum(['field_type_changed', 'field_deleted', 'field_added', 'field_renamed']),
  fieldId: z.string().uuid().nullable(),
  platformFieldId: z.string(),
  baseConnectionId: z.string().uuid(),
});

const acceptTypeChangeSchema = resolveChangeSchema.extend({
  newFieldType: z.string(),
  newPlatformFieldType: z.string(),
});

const addFieldSchema = resolveChangeSchema.extend({
  tableId: z.string().uuid(),
  fieldName: z.string().min(1).max(255),
  fieldType: z.string(),
  platformFieldType: z.string(),
});

const renameSchema = resolveChangeSchema.extend({
  newName: z.string().min(1).max(255),
});

// ---------------------------------------------------------------------------
// acceptTypeChangedAction
// ---------------------------------------------------------------------------

/**
 * Accept a field type change — update field type and resume syncing.
 */
export async function acceptTypeChangedAction(
  input: z.input<typeof acceptTypeChangeSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = acceptTypeChangeSchema.parse(input);

  try {
    if (parsed.fieldId) {
      await updateFieldTypeFromSchemaChange(
        tenantId,
        parsed.fieldId,
        parsed.newFieldType,
        parsed.newPlatformFieldType,
      );
    }

    await acceptSchemaChange(tenantId, parsed.changeId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.accept_type_changed',
        entityType: 'field',
        entityId: parsed.fieldId ?? parsed.changeId,
        details: {
          changeId: parsed.changeId,
          newFieldType: parsed.newFieldType,
          newPlatformFieldType: parsed.newPlatformFieldType,
        },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// rejectTypeChangedAction
// ---------------------------------------------------------------------------

/**
 * Reject a field type change — keep local type, disconnect sync for this field.
 */
export async function rejectTypeChangedAction(
  input: z.input<typeof resolveChangeSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = resolveChangeSchema.parse(input);

  try {
    if (parsed.fieldId) {
      await disconnectFieldMapping(tenantId, parsed.fieldId);
    }

    await rejectSchemaChange(tenantId, parsed.changeId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.reject_type_changed',
        entityType: 'field',
        entityId: parsed.fieldId ?? parsed.changeId,
        details: { changeId: parsed.changeId },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// archiveFieldAction
// ---------------------------------------------------------------------------

/**
 * Archive a deleted field — data preserved, hidden from grid, sync disconnected.
 */
export async function archiveFieldAction(
  input: z.input<typeof resolveChangeSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = resolveChangeSchema.parse(input);

  try {
    if (parsed.fieldId) {
      await archiveField(tenantId, parsed.fieldId);
    }

    await acceptSchemaChange(tenantId, parsed.changeId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.archive_field',
        entityType: 'field',
        entityId: parsed.fieldId ?? parsed.changeId,
        details: { changeId: parsed.changeId },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteFieldSchemaChangeAction
// ---------------------------------------------------------------------------

/**
 * Delete a field definition and clear canonical data for this field.
 */
export async function deleteFieldSchemaChangeAction(
  input: z.input<typeof resolveChangeSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = resolveChangeSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    if (parsed.fieldId) {
      // Get table ID for clearing canonical data
      const [fieldRow] = await db
        .select({ tableId: fields.tableId })
        .from(fields)
        .where(
          and(
            eq(fields.id, parsed.fieldId),
            eq(fields.tenantId, tenantId),
          ),
        );

      if (fieldRow) {
        // Remove this field's key from all records' canonical_data in the table
        const { sql } = await import('drizzle-orm');
        await db
          .update(records)
          .set({
            canonicalData: sql`${records.canonicalData} - ${parsed.fieldId}`,
          })
          .where(
            and(
              eq(records.tableId, fieldRow.tableId),
              eq(records.tenantId, tenantId),
            ),
          );

        // Delete synced_field_mapping
        await db
          .delete(syncedFieldMappings)
          .where(
            and(
              eq(syncedFieldMappings.fieldId, parsed.fieldId),
              eq(syncedFieldMappings.tenantId, tenantId),
            ),
          );

        // Delete the field itself
        await db
          .delete(fields)
          .where(
            and(
              eq(fields.id, parsed.fieldId),
              eq(fields.tenantId, tenantId),
            ),
          );
      }
    }

    await acceptSchemaChange(tenantId, parsed.changeId, userId);

    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.delete_field',
        entityType: 'field',
        entityId: parsed.fieldId ?? parsed.changeId,
        details: { changeId: parsed.changeId },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// addFieldFromPlatformAction
// ---------------------------------------------------------------------------

/**
 * Create a new field + synced_field_mapping from a platform field that
 * was detected as "added" during schema sync.
 */
export async function addFieldFromPlatformAction(
  input: z.input<typeof addFieldSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = addFieldSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');
    const newFieldId = generateUUIDv7();

    // Create the ES field
    await db.insert(fields).values({
      id: newFieldId,
      tableId: parsed.tableId,
      tenantId,
      name: parsed.fieldName,
      fieldType: parsed.fieldType,
      externalFieldId: parsed.platformFieldId,
    });

    // Create the synced_field_mapping
    await db.insert(syncedFieldMappings).values({
      tenantId,
      baseConnectionId: parsed.baseConnectionId,
      tableId: parsed.tableId,
      fieldId: newFieldId,
      externalFieldId: parsed.platformFieldId,
      externalFieldType: parsed.platformFieldType,
    });

    await acceptSchemaChange(tenantId, parsed.changeId, userId);

    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.add_field',
        entityType: 'field',
        entityId: newFieldId,
        details: {
          changeId: parsed.changeId,
          fieldName: parsed.fieldName,
          platformFieldId: parsed.platformFieldId,
        },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// ignoreSchemaChangeAction
// ---------------------------------------------------------------------------

/**
 * Ignore a new platform field — reject the schema change without creating a field.
 */
export async function ignoreSchemaChangeAction(
  input: z.input<typeof resolveChangeSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = resolveChangeSchema.parse(input);

  try {
    await rejectSchemaChange(tenantId, parsed.changeId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.ignore',
        entityType: 'sync_schema_change',
        entityId: parsed.changeId,
        details: { platformFieldId: parsed.platformFieldId },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// acceptRenameAction
// ---------------------------------------------------------------------------

/**
 * Accept a field rename — update local field name to match platform.
 */
export async function acceptRenameAction(
  input: z.input<typeof renameSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = renameSchema.parse(input);

  try {
    if (parsed.fieldId) {
      await renameField(tenantId, parsed.fieldId, parsed.newName);
    }

    await acceptSchemaChange(tenantId, parsed.changeId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.accept_rename',
        entityType: 'field',
        entityId: parsed.fieldId ?? parsed.changeId,
        details: { changeId: parsed.changeId, newName: parsed.newName },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// rejectRenameAction
// ---------------------------------------------------------------------------

/**
 * Reject a field rename — keep local name.
 */
export async function rejectRenameAction(
  input: z.input<typeof resolveChangeSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const parsed = resolveChangeSchema.parse(input);

  try {
    await rejectSchemaChange(tenantId, parsed.changeId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'schema_change.reject_rename',
        entityType: 'field',
        entityId: parsed.fieldId ?? parsed.changeId,
        details: { changeId: parsed.changeId },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
