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
  sql,
  records,
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

      // Update the single field using jsonb_set
      const serializedValue = JSON.stringify(validated.value);
      const [updated] = await tx
        .update(records)
        .set({
          canonicalData: sql`jsonb_set(
            COALESCE(${records.canonicalData}, '{}'::jsonb),
            ${sql.raw(`'{${validated.fieldId}}'`)},
            ${sql.raw(`'${serializedValue}'::jsonb`)}
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
