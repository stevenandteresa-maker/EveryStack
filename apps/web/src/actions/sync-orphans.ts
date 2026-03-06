'use server';

/**
 * Server Actions — Sync Orphan Resolution
 *
 * Three actions for handling records orphaned by sync filter changes:
 * - deleteOrphanedRecords: soft-deletes orphaned records
 * - keepOrphanedRecordsAsLocal: acknowledges/dismisses the banner
 * - undoFilterChange: reverts the filter and re-syncs
 *
 * @see docs/reference/sync-engine.md § Orphan Detection
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import {
  getDbForTenant,
  records,
  baseConnections,
  eq,
  and,
  sql,
  isNull,
} from '@everystack/shared/db';
import { decrementQuotaCache } from '@everystack/shared/sync';
import type { SyncConfig } from '@everystack/shared/sync';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import { updateSyncConfig } from '@/data/sync-setup';
import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const deleteOrphansSchema = z.object({
  tableId: z.string().uuid(),
});

const keepOrphansSchema = z.object({
  tableId: z.string().uuid(),
});

const undoFilterSchema = z.object({
  tableId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// deleteOrphanedRecords
// ---------------------------------------------------------------------------

/**
 * Soft-delete all orphaned records for a table.
 * Records are moved to the recycle bin (recoverable for 30 days).
 */
export async function deleteOrphanedRecords(
  input: z.input<typeof deleteOrphansSchema>,
): Promise<{ deletedCount: number }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'record', 'delete');

  const { tableId } = deleteOrphansSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    const orphaned = await db
      .select({ id: records.id })
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, tableId),
          sql`${records.syncMetadata}->>'sync_status' = 'orphaned'`,
          isNull(records.archivedAt),
        ),
      );

    if (orphaned.length === 0) {
      return { deletedCount: 0 };
    }

    const orphanIds = orphaned.map((r) => r.id);

    await db
      .update(records)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, tableId),
          sql`${records.syncMetadata}->>'sync_status' = 'orphaned'`,
          isNull(records.archivedAt),
        ),
      );

    await decrementQuotaCache(tenantId, orphanIds.length);

    return { deletedCount: orphanIds.length };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// keepOrphanedRecordsAsLocal
// ---------------------------------------------------------------------------

/**
 * Acknowledge orphaned records — no DB changes, purely dismisses the banner.
 * Records remain with sync_status: 'orphaned' but are visible in the grid.
 */
export async function keepOrphanedRecordsAsLocal(
  input: z.input<typeof keepOrphansSchema>,
): Promise<{ acknowledged: true }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'record', 'update');

  keepOrphansSchema.parse(input);

  return { acknowledged: true };
}

// ---------------------------------------------------------------------------
// undoFilterChange
// ---------------------------------------------------------------------------

/**
 * Revert the sync filter to its previous state, reset orphan markers,
 * and enqueue a re-sync job.
 */
export async function undoFilterChange(
  input: z.input<typeof undoFilterSchema>,
): Promise<{ resyncJobId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { tableId, connectionId } = undoFilterSchema.parse(input);

  try {
    // 1. Load current sync config
    const db = getDbForTenant(tenantId, 'read');
    const [connection] = await db
      .select({
        syncConfig: baseConnections.syncConfig,
      })
      .from(baseConnections)
      .where(
        and(
          eq(baseConnections.id, connectionId),
          eq(baseConnections.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!connection) {
      throw new Error('Connection not found');
    }

    const syncConfig = connection.syncConfig as unknown as SyncConfig;

    // 2. Find the table entry and restore previous filter
    const tableEntry = syncConfig.tables.find(
      (t) => t.external_table_id === tableId,
    );

    if (!tableEntry) {
      throw new Error('Table not found in sync config');
    }

    if (tableEntry.previous_sync_filter === undefined || tableEntry.previous_sync_filter === null) {
      throw new Error('No previous filter available to restore');
    }

    tableEntry.sync_filter = tableEntry.previous_sync_filter;
    tableEntry.previous_sync_filter = null;

    // 3. Reset orphaned records for this table
    const writeDb = getDbForTenant(tenantId, 'write');
    await writeDb
      .update(records)
      .set({
        syncMetadata: sql`jsonb_set(
          jsonb_set(
            jsonb_set(
              ${records.syncMetadata},
              '{sync_status}',
              '"active"'
            ),
            '{orphaned_at}',
            'null'
          ),
          '{orphaned_reason}',
          'null'
        )`,
      })
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, tableId),
          sql`${records.syncMetadata}->>'sync_status' = 'orphaned'`,
          isNull(records.archivedAt),
        ),
      );

    // 4. Save updated sync config
    await updateSyncConfig(tenantId, userId, connectionId, syncConfig);

    // 5. Enqueue re-sync job
    const queue = getQueue('sync');
    const job = await queue.add('sync.initial', {
      tenantId,
      connectionId,
      traceId: getTraceId() ?? '',
      triggeredBy: userId,
    });

    return { resyncJobId: job.id ?? connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
