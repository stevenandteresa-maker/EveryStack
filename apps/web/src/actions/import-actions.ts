'use server';

/**
 * Server Actions — CSV import into existing tables.
 *
 * Manager+ role required. Blocked for synced tables.
 * Processes rows in batches of 100, using the standard record creation path.
 *
 * @see docs/reference/tables-and-views.md § CSV/Data Import — MVP
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  records,
  generateUUIDv7,
  writeAuditLog,
  syncedFieldMappings,
} from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import { requireRole } from '@everystack/shared/auth';
import {
  checkRecordQuota,
  incrementQuotaCache,
} from '@everystack/shared/sync';
import { getAuthContext } from '@/lib/auth-context';
import { ForbiddenError, ValidationError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const importRowSchema = z.record(z.string().uuid(), z.unknown());

const importRecordsSchema = z.object({
  tableId: z.string().uuid(),
  rows: z.array(importRowSchema).min(1).max(50_000),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportRowError {
  row: number;
  field: string;
  error: string;
}

export interface ImportResult {
  imported: number;
  failed: number;
  errors: ImportRowError[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// importRecords
// ---------------------------------------------------------------------------

/**
 * Import CSV data as new records into a native (non-synced) table.
 *
 * - Manager+ role required
 * - Blocked for synced tables (tables with synced_field_mappings entries)
 * - Plan quota check before processing
 * - Processes in batches of 100 rows
 */
export async function importRecords(
  input: z.input<typeof importRecordsSchema>,
): Promise<ImportResult> {
  const { userId, tenantId } = await getAuthContext();

  // Role check: Manager+ required
  await requireRole(userId, tenantId, undefined, 'manager', 'record', 'import');

  const validated = importRecordsSchema.parse(input);
  const { tableId, rows } = validated;

  const db = getDbForTenant(tenantId, 'write');

  // Check if table is synced (has synced_field_mappings entries)
  const syncMappings = await db
    .select({ id: syncedFieldMappings.id })
    .from(syncedFieldMappings)
    .where(
      and(
        eq(syncedFieldMappings.tenantId, tenantId),
        eq(syncedFieldMappings.tableId, tableId),
      ),
    )
    .limit(1);

  if (syncMappings.length > 0) {
    throw new ForbiddenError(
      'Import is not allowed for synced tables. Synced tables receive data from their connected platform.',
    );
  }

  // Plan quota check
  const quota = await checkRecordQuota(tenantId);
  const totalRows = rows.length;

  if (quota.exceeded) {
    throw new ValidationError(
      `Your plan's record limit has been reached (${quota.currentCount}/${quota.planQuota}). No records can be imported.`,
      { currentCount: quota.currentCount, planQuota: quota.planQuota },
    );
  }

  // Determine how many rows we can actually import
  const allowedCount = Math.min(totalRows, quota.remaining);
  const rowsToProcess = rows.slice(0, allowedCount);

  const allErrors: ImportRowError[] = [];
  let totalImported = 0;

  // Process in batches
  for (let batchStart = 0; batchStart < rowsToProcess.length; batchStart += BATCH_SIZE) {
    const batch = rowsToProcess.slice(batchStart, batchStart + BATCH_SIZE);

    try {
      const batchResult = await db.transaction(async (tx) => {
        const batchErrors: ImportRowError[] = [];
        let batchImported = 0;

        for (let i = 0; i < batch.length; i++) {
          const rowData = batch[i]!;
          const rowIndex = batchStart + i + 1; // 1-based for user display

          try {
            const id = generateUUIDv7();
            await tx
              .insert(records)
              .values({
                id,
                tenantId,
                tableId,
                canonicalData: rowData,
                createdBy: userId,
                updatedBy: userId,
              });

            batchImported++;
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            batchErrors.push({
              row: rowIndex,
              field: '',
              error: message,
            });
          }
        }

        // Single audit log entry for the batch
        if (batchImported > 0) {
          await writeAuditLog(tx as DrizzleTransaction, {
            tenantId,
            actorType: 'user',
            actorId: userId,
            action: 'record.bulk_imported',
            entityType: 'record',
            entityId: tenantId,
            details: {
              tableId,
              batchSize: batchImported,
              batchStart: batchStart + 1,
            },
            traceId: getTraceId(),
          });
        }

        return { imported: batchImported, errors: batchErrors };
      });

      totalImported += batchResult.imported;
      allErrors.push(...batchResult.errors);
    } catch (error) {
      // If the entire batch transaction fails, mark all rows as failed
      for (let i = 0; i < batch.length; i++) {
        allErrors.push({
          row: batchStart + i + 1,
          field: '',
          error: error instanceof Error ? error.message : 'Batch failed',
        });
      }
    }
  }

  // Update quota cache
  if (totalImported > 0) {
    await incrementQuotaCache(tenantId, totalImported);
  }

  // Add errors for rows that were skipped due to quota
  if (allowedCount < totalRows) {
    for (let i = allowedCount; i < totalRows; i++) {
      allErrors.push({
        row: i + 1,
        field: '',
        error: `Skipped: would exceed plan record limit (${quota.currentCount + totalImported}/${quota.planQuota})`,
      });
    }
  }

  return {
    imported: totalImported,
    failed: allErrors.length,
    errors: allErrors,
  };
}
