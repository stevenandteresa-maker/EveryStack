'use server';

/**
 * Server Actions — Record mutations for the grid data layer.
 *
 * These are the write operations that inline cell editing and the
 * "add row" button will call.
 *
 * @see docs/reference/data-model.md § Records
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  isNull,
  isNotNull,
  sql,
  records,
  tables,
  generateUUIDv7,
  writeAuditLog,
} from '@everystack/shared/db';
import type { DrizzleTransaction, DbRecord } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createRecordSchema = z.object({
  tableId: z.string().uuid(),
  canonicalData: z.record(z.string().uuid(), z.unknown()),
});

const updateRecordFieldSchema = z.object({
  recordId: z.string().uuid(),
  fieldId: z.string().uuid(),
  value: z.unknown(),
});

const deleteRecordSchema = z.object({
  recordId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// createRecord
// ---------------------------------------------------------------------------

/**
 * Create a new record with canonical_data JSONB keyed by field.id.
 *
 * Returns the created record with its UUIDv7 id.
 */
export async function createRecord(
  input: z.input<typeof createRecordSchema>,
): Promise<DbRecord> {
  const { userId, tenantId } = await getAuthContext();
  const validated = createRecordSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');
  const id = generateUUIDv7();

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(records)
        .values({
          id,
          tenantId,
          tableId: validated.tableId,
          canonicalData: validated.canonicalData,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record.created',
        entityType: 'record',
        entityId: id,
        details: {
          tableId: validated.tableId,
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to create record');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// updateRecordField
// ---------------------------------------------------------------------------

/**
 * Update a single field value in canonical_data JSONB.
 *
 * Uses jsonb_set to update only the specified field key without
 * overwriting other fields. This is the action inline cell editing calls.
 */
export async function updateRecordField(
  input: z.input<typeof updateRecordFieldSchema>,
): Promise<DbRecord> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateRecordFieldSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      // Verify record exists and is not soft-deleted
      const [existing] = await tx
        .select({ id: records.id })
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
            isNull(records.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record not found');
      }

      // Update the single field using jsonb_set with parameterized values
      const serializedValue = JSON.stringify(validated.value);
      const jsonPath = `{${validated.fieldId}}`;
      const [updated] = await tx
        .update(records)
        .set({
          canonicalData: sql`jsonb_set(
            COALESCE(${records.canonicalData}, '{}'::jsonb),
            ${jsonPath}::text[],
            ${serializedValue}::jsonb
          )`,
          updatedBy: userId,
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
          ),
        )
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record.field_updated',
        entityType: 'record',
        entityId: validated.recordId,
        details: {
          fieldId: validated.fieldId,
        },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to update record field');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteRecord
// ---------------------------------------------------------------------------

/**
 * Soft-delete a record by setting archived_at.
 *
 * Does not permanently remove the record — it will be excluded from
 * queries that filter by archived_at IS NULL.
 */
export async function deleteRecord(
  input: z.input<typeof deleteRecordSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = deleteRecordSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: records.id })
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
            isNull(records.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record not found');
      }

      await tx
        .update(records)
        .set({
          archivedAt: new Date(),
          updatedBy: userId,
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record.deleted',
        entityType: 'record',
        entityId: validated.recordId,
        details: {},
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// Zod schemas — additional actions
// ---------------------------------------------------------------------------

const duplicateRecordSchema = z.object({
  recordId: z.string().uuid(),
});

const restoreRecordSchema = z.object({
  recordId: z.string().uuid(),
});

const insertRecordSchema = z.object({
  tableId: z.string().uuid(),
  position: z.number().int().nonnegative().optional(),
});

// ---------------------------------------------------------------------------
// duplicateRecord
// ---------------------------------------------------------------------------

/**
 * Duplicate an existing record by creating a copy with a new UUIDv7 id
 * and the same canonical_data.
 *
 * The source record must exist and not be soft-deleted.
 */
export async function duplicateRecord(
  input: z.input<typeof duplicateRecordSchema>,
): Promise<DbRecord> {
  const { userId, tenantId } = await getAuthContext();
  const validated = duplicateRecordSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');
  const newId = generateUUIDv7();

  try {
    const result = await db.transaction(async (tx) => {
      // Look up the existing record
      const [existing] = await tx
        .select()
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
            isNull(records.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record not found');
      }

      // Create a copy with a new id and same canonical_data
      const [row] = await tx
        .insert(records)
        .values({
          id: newId,
          tenantId,
          tableId: existing.tableId,
          canonicalData: existing.canonicalData,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record.duplicated',
        entityType: 'record',
        entityId: newId,
        details: {
          sourceRecordId: validated.recordId,
          tableId: existing.tableId,
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to duplicate record');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// restoreRecord
// ---------------------------------------------------------------------------

/**
 * Restore a soft-deleted record by clearing its archived_at timestamp.
 *
 * The record must exist and must currently be soft-deleted (archivedAt IS NOT NULL).
 */
export async function restoreRecord(
  input: z.input<typeof restoreRecordSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = restoreRecordSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      // Verify the record exists and is currently archived
      const [existing] = await tx
        .select({ id: records.id })
        .from(records)
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
            isNotNull(records.archivedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Record not found or not archived');
      }

      await tx
        .update(records)
        .set({
          archivedAt: null,
          updatedBy: userId,
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, validated.recordId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record.restored',
        entityType: 'record',
        entityId: validated.recordId,
        details: {},
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// insertRecord
// ---------------------------------------------------------------------------

/**
 * Insert a new empty record into a table.
 *
 * The position parameter is accepted for client-side ordering but does not
 * affect database storage (no position column exists on the records table).
 */
export async function insertRecord(
  input: z.input<typeof insertRecordSchema>,
): Promise<DbRecord> {
  const { userId, tenantId } = await getAuthContext();
  const validated = insertRecordSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');
  const id = generateUUIDv7();

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(records)
        .values({
          id,
          tenantId,
          tableId: validated.tableId,
          canonicalData: {},
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'record.created',
        entityType: 'record',
        entityId: id,
        details: {
          tableId: validated.tableId,
          ...(validated.position !== undefined && { position: validated.position }),
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to insert record');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// Zod schemas — tab color
// ---------------------------------------------------------------------------

const updateTabColorSchema = z.object({
  tableId: z.string().uuid(),
  tabColor: z.string().max(20).nullable(),
});

// ---------------------------------------------------------------------------
// updateTabColor
// ---------------------------------------------------------------------------

/**
 * Update the tab_color on a table.
 *
 * Pass null to reset to table type default.
 */
export async function updateTabColor(
  input: z.input<typeof updateTabColorSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateTabColorSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: tables.id })
        .from(tables)
        .where(
          and(
            eq(tables.tenantId, tenantId),
            eq(tables.id, validated.tableId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Table not found');
      }

      await tx
        .update(tables)
        .set({
          tabColor: validated.tabColor,
        })
        .where(
          and(
            eq(tables.tenantId, tenantId),
            eq(tables.id, validated.tableId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'table.tab_color_updated',
        entityType: 'table',
        entityId: validated.tableId,
        details: {
          tabColor: validated.tabColor,
        },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
