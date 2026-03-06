/**
 * Orphan Detection — Identifies records excluded by sync filter changes.
 *
 * Called after an inbound sync cycle when a filter was updated. Compares
 * locally-synced records against the current filter result set from Airtable
 * and marks unmatched records as orphaned.
 *
 * Records that still exist on Airtable but are outside the filter →
 *   sync_status: 'orphaned', orphaned_reason: 'filter_changed'
 *
 * Records deleted on Airtable → soft-deleted (archivedAt set)
 *
 * @see docs/reference/sync-engine.md § Orphan Detection
 */

import type { Logger } from '@everystack/shared/logging';
import type { EventPublisher } from '@everystack/shared/realtime';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { AirtableApiClient } from '@everystack/shared/sync';
import { rateLimiter, decrementQuotaCache } from '@everystack/shared/sync';
import {
  getDbForTenant,
  records,
  eq,
  and,
  sql,
  isNull,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of orphan candidates to verify per batch against the Airtable API. */
const VERIFICATION_BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface OrphanDetectionParams {
  tenantId: string;
  connectionId: string;
  workspaceId: string;
  esTableId: string;
  externalTableId: string;
  apiClient: AirtableApiClient;
  eventPublisher: EventPublisher;
  logger: Logger;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Detect and process orphaned records after a sync filter change.
 *
 * 1. Loads all locally-active synced records for the table
 * 2. Fetches IDs matching the current filter from Airtable (ID-only pages)
 * 3. Diffs to find orphan candidates
 * 4. Verifies each candidate: filter-orphaned vs platform-deleted
 * 5. Emits SYNC_RECORDS_ORPHANED if any records were orphaned
 */
export async function detectAndProcessOrphans(
  params: OrphanDetectionParams,
): Promise<{ orphanedCount: number; deletedCount: number }> {
  const {
    tenantId,
    connectionId,
    workspaceId,
    esTableId,
    externalTableId,
    apiClient,
    eventPublisher,
    logger,
  } = params;

  logger.info(
    { esTableId, externalTableId },
    'Starting orphan detection',
  );

  // Step 1: Get all locally-active synced records for this table
  const db = getDbForTenant(tenantId, 'read');
  const localRecords = await db
    .select({
      id: records.id,
      platformRecordId: sql<string>`${records.syncMetadata}->>'platform_record_id'`,
    })
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        eq(records.tableId, esTableId),
        sql`${records.syncMetadata}->>'sync_status' = 'active'`,
        isNull(records.archivedAt),
      ),
    );

  if (localRecords.length === 0) {
    logger.info({ esTableId }, 'No active synced records — skipping orphan detection');
    return { orphanedCount: 0, deletedCount: 0 };
  }

  const localIdMap = new Map<string, string>();
  for (const record of localRecords) {
    if (record.platformRecordId) {
      localIdMap.set(record.platformRecordId, record.id);
    }
  }

  // Step 2: Fetch all IDs matching current filter from Airtable (ID-only)
  const inboundIds = new Set<string>();
  let offset: string | undefined;

  do {
    await rateLimiter.waitForCapacity('airtable', `base:orphan`);

    const page = await apiClient.listRecords(externalTableId, {
      pageSize: 100,
      offset,
      fields: [], // Empty fields array → returns only record IDs
    });

    for (const record of page.records) {
      inboundIds.add(record.id);
    }

    offset = page.offset;
  } while (offset);

  // Step 3: Diff — local IDs not in inbound set = orphan candidates
  const orphanCandidates: Array<{ esId: string; platformId: string }> = [];
  for (const [platformId, esId] of localIdMap.entries()) {
    if (!inboundIds.has(platformId)) {
      orphanCandidates.push({ esId, platformId });
    }
  }

  if (orphanCandidates.length === 0) {
    logger.info({ esTableId }, 'No orphan candidates found');
    return { orphanedCount: 0, deletedCount: 0 };
  }

  logger.info(
    { esTableId, candidateCount: orphanCandidates.length },
    'Orphan candidates identified — verifying against Airtable',
  );

  // Step 4: Verify each candidate in batches
  let orphanedCount = 0;
  let deletedCount = 0;
  const writeDb = getDbForTenant(tenantId, 'write');
  const now = new Date().toISOString();

  for (let i = 0; i < orphanCandidates.length; i += VERIFICATION_BATCH_SIZE) {
    const batch = orphanCandidates.slice(i, i + VERIFICATION_BATCH_SIZE);

    for (const candidate of batch) {
      await rateLimiter.waitForCapacity('airtable', `base:orphan`);

      try {
        // Record exists on Airtable → filter-orphaned
        await apiClient.getRecord(externalTableId, candidate.platformId);

        await writeDb
          .update(records)
          .set({
            syncMetadata: sql`jsonb_set(
              jsonb_set(
                jsonb_set(
                  ${records.syncMetadata},
                  '{sync_status}',
                  '"orphaned"'
                ),
                '{orphaned_at}',
                ${sql`to_jsonb(${now}::text)`}
              ),
              '{orphaned_reason}',
              '"filter_changed"'
            )`,
          })
          .where(
            and(
              eq(records.tenantId, tenantId),
              eq(records.id, candidate.esId),
            ),
          );

        orphanedCount++;
      } catch (error: unknown) {
        // 404 = platform-deleted → soft-delete locally
        const isNotFound =
          error instanceof Error && error.message.includes('404');

        if (isNotFound) {
          await writeDb
            .update(records)
            .set({ archivedAt: new Date() })
            .where(
              and(
                eq(records.tenantId, tenantId),
                eq(records.id, candidate.esId),
              ),
            );

          deletedCount++;
        } else {
          // Unexpected error — log and skip this candidate
          logger.warn(
            { esId: candidate.esId, platformId: candidate.platformId, error },
            'Failed to verify orphan candidate — skipping',
          );
        }
      }
    }
  }

  // Step 5: Decrement quota for platform-deleted records
  if (deletedCount > 0) {
    await decrementQuotaCache(tenantId, deletedCount);
  }

  // Step 6: Emit event if any records were orphaned
  if (orphanedCount > 0) {
    await eventPublisher.publish({
      tenantId,
      channel: `workspace:${workspaceId}`,
      event: REALTIME_EVENTS.SYNC_RECORDS_ORPHANED,
      payload: {
        tableId: esTableId,
        orphanedCount,
        connectionId,
      },
    });
  }

  logger.info(
    { esTableId, orphanedCount, deletedCount },
    'Orphan detection complete',
  );

  return { orphanedCount, deletedCount };
}
