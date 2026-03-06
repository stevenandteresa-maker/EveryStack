'use server';

/**
 * Server Action — Edit a cell in a synced table.
 *
 * Updates canonical_data in PostgreSQL immediately (optimistic local update),
 * rebuilds the search_vector in the same transaction, and enqueues an
 * outbound sync job to push the change to the source platform.
 *
 * @see docs/reference/sync-engine.md § Outbound Sync (lines 447–453)
 * @see docs/reference/data-model.md § Outbound sync flow (lines 649–660)
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import { isComputedFieldType } from '@everystack/shared/sync';
import {
  getDbForTenant,
  records,
  fields as fieldsTable,
  syncedFieldMappings,
  baseConnections,
  eq,
  and,
  isNull,
  buildSearchVector,
} from '@everystack/shared/db';
import type { SearchFieldDefinition } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { ValidationError, NotFoundError, wrapUnknownError } from '@/lib/errors';
import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const updateSyncedRecordFieldSchema = z.object({
  recordId: z.string().uuid(),
  fieldId: z.string().uuid(),
  tableId: z.string().uuid(),
  newValue: z.unknown(),
});

export type UpdateSyncedRecordFieldInput = z.input<typeof updateSyncedRecordFieldSchema>;

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * Edit a single field value in a synced record.
 *
 * 1. Validates input via Zod
 * 2. Verifies the field is editable (not computed, not read-only)
 * 3. Updates canonical_data in PostgreSQL immediately
 * 4. Updates search_vector in the same transaction
 * 5. Enqueues outbound sync job for the platform write
 * 6. Returns the updated record immediately
 */
export async function updateSyncedRecordField(
  input: z.input<typeof updateSyncedRecordFieldSchema>,
): Promise<{
  recordId: string;
  fieldId: string;
  updatedCanonicalData: Record<string, unknown>;
}> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'team_member', 'record', 'update');

  const { recordId, fieldId, tableId, newValue } = updateSyncedRecordFieldSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    // 1. Load the field definition to verify editability
    const [field] = await db
      .select({
        id: fieldsTable.id,
        fieldType: fieldsTable.fieldType,
        isPrimary: fieldsTable.isPrimary,
        readOnly: fieldsTable.readOnly,
        config: fieldsTable.config,
        name: fieldsTable.name,
      })
      .from(fieldsTable)
      .where(
        and(
          eq(fieldsTable.id, fieldId),
          eq(fieldsTable.tenantId, tenantId),
          eq(fieldsTable.tableId, tableId),
        ),
      )
      .limit(1);

    if (!field) {
      throw new NotFoundError('Field not found', { fieldId, tableId });
    }

    // 2. Reject computed fields — they cannot be edited or synced back
    if (isComputedFieldType(field.fieldType)) {
      throw new ValidationError(
        `This field is computed and cannot be edited.`,
        { fieldId, fieldType: field.fieldType },
      );
    }

    // 3. Reject read-only fields
    if (field.readOnly) {
      throw new ValidationError(
        'This field is read-only and cannot be edited.',
        { fieldId },
      );
    }

    // 4. Load the record and verify it exists + belongs to this table
    const [existingRecord] = await db
      .select({
        tenantId: records.tenantId,
        id: records.id,
        canonicalData: records.canonicalData,
        tableId: records.tableId,
      })
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.id, recordId),
          eq(records.tableId, tableId),
          isNull(records.archivedAt),
        ),
      )
      .limit(1);

    if (!existingRecord) {
      throw new NotFoundError('Record not found', { recordId, tableId });
    }

    // 5. Build updated canonical data
    const updatedCanonicalData = {
      ...existingRecord.canonicalData,
      [fieldId]: newValue,
    };

    // 6. Load all fields for this table to rebuild search_vector
    const tableFields = await db
      .select({
        id: fieldsTable.id,
        fieldType: fieldsTable.fieldType,
        isPrimary: fieldsTable.isPrimary,
        config: fieldsTable.config,
      })
      .from(fieldsTable)
      .where(
        and(
          eq(fieldsTable.tenantId, tenantId),
          eq(fieldsTable.tableId, tableId),
        ),
      );

    const searchFieldDefs: SearchFieldDefinition[] = tableFields.map((f) => ({
      id: f.id,
      fieldType: f.fieldType,
      isPrimary: f.isPrimary,
      config: f.config,
    }));

    // 7. Update canonical_data + search_vector in a single transaction
    const searchVectorExpr = buildSearchVector(updatedCanonicalData, searchFieldDefs);

    await db.transaction(async (tx) => {
      await tx
        .update(records)
        .set({
          canonicalData: updatedCanonicalData,
          // SQL expression for tsvector — Drizzle resolves it server-side
          searchVector: searchVectorExpr as unknown as string,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(records.tenantId, tenantId),
            eq(records.id, recordId),
          ),
        );
    });

    // 8. Enqueue outbound sync (fire-and-forget — does not block the response)
    // Check if this table is synced before enqueuing
    const [mapping] = await db
      .select({ baseConnectionId: syncedFieldMappings.baseConnectionId })
      .from(syncedFieldMappings)
      .where(
        and(
          eq(syncedFieldMappings.tenantId, tenantId),
          eq(syncedFieldMappings.tableId, tableId),
          eq(syncedFieldMappings.status, 'active'),
        ),
      )
      .limit(1);

    if (mapping) {
      // Verify connection allows outbound sync
      const [connection] = await db
        .select({
          syncDirection: baseConnections.syncDirection,
          syncStatus: baseConnections.syncStatus,
        })
        .from(baseConnections)
        .where(
          and(
            eq(baseConnections.id, mapping.baseConnectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (
        connection &&
        connection.syncDirection !== 'inbound_only' &&
        connection.syncStatus === 'active'
      ) {
        const queue = getQueue('sync:outbound');
        const jobId = `outbound:${tenantId}:${recordId}`;

        await queue.add('outbound-sync', {
          tenantId,
          recordId,
          tableId,
          baseConnectionId: mapping.baseConnectionId,
          changedFieldIds: [fieldId],
          editedBy: userId,
          priority: 10,
          traceId: getTraceId() ?? `outbound:${recordId}:${Date.now()}`,
          triggeredBy: userId,
        }, {
          jobId,
          priority: 10,
        });
      }
    }

    return {
      recordId,
      fieldId,
      updatedCanonicalData,
    };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
