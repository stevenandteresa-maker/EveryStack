/**
 * Cross-link index rebuild processor.
 *
 * Deletes all index entries for a cross-link definition and rebuilds
 * them from canonical_data in batches of 1,000 records.
 *
 * Triggered by integrity check when >1% drift is detected, or manually
 * via admin tooling.
 *
 * @see docs/reference/cross-linking.md § Index Consistency & Rebuild
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { CrossLinkIndexRebuildJobData } from '@everystack/shared/queue';
import {
  getDbForTenant,
  crossLinkIndex,
  crossLinks,
  records,
  eq,
  and,
  sql,
} from '@everystack/shared/db';
import type { SQL } from '@everystack/shared/db';
import type { NewCrossLinkIndex } from '@everystack/shared/db';
import { extractCrossLinkField } from '@everystack/shared/sync';
import { BaseProcessor } from '../../lib/base-processor';

const REBUILD_BATCH_SIZE = 1_000;

/**
 * Process an index rebuild job for a single cross-link definition.
 *
 * 1. Look up the cross-link definition to get source table and field IDs
 * 2. Delete all existing index entries for this definition
 * 3. Scan source records in batches of 1,000
 * 4. Extract linked record IDs from canonical_data and rebuild index entries
 */
export async function processIndexRebuild(
  job: Job<CrossLinkIndexRebuildJobData>,
  logger: Logger,
): Promise<void> {
  const { tenantId, crossLinkId } = job.data;

  const db = getDbForTenant(tenantId, 'write');

  // Look up the cross-link definition
  const [definition] = await db
    .select({
      id: crossLinks.id,
      sourceTableId: crossLinks.sourceTableId,
      sourceFieldId: crossLinks.sourceFieldId,
    })
    .from(crossLinks)
    .where(
      and(eq(crossLinks.id, crossLinkId), eq(crossLinks.tenantId, tenantId)),
    );

  if (!definition) {
    logger.warn({ crossLinkId }, 'Cross-link definition not found, skipping rebuild');
    return;
  }

  // Delete all existing index entries for this definition
  await db
    .delete(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLinkId),
      ),
    );

  logger.info({ crossLinkId }, 'Cleared existing index entries');

  // Scan source records in batches using cursor-based pagination
  let totalRecords = 0;
  let totalEntries = 0;
  let lastId: string | null = null;

  for (;;) {
    const whereCondition: SQL | undefined = lastId
      ? and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, definition.sourceTableId),
          sql`${records.id} > ${lastId}`,
        )
      : and(
          eq(records.tenantId, tenantId),
          eq(records.tableId, definition.sourceTableId),
        );

    const batch = await db
      .select({
        id: records.id,
        canonicalData: records.canonicalData,
      })
      .from(records)
      .where(whereCondition)
      .orderBy(records.id)
      .limit(REBUILD_BATCH_SIZE);

    if (batch.length === 0) break;

    const newEntries: NewCrossLinkIndex[] = [];

    for (const record of batch) {
      const canonical = record.canonicalData as Record<string, unknown>;
      const field = extractCrossLinkField(canonical, definition.sourceFieldId);

      if (!field) continue;

      for (const linkedRecord of field.value.linked_records) {
        newEntries.push({
          tenantId,
          crossLinkId,
          sourceRecordId: record.id,
          sourceTableId: definition.sourceTableId,
          targetRecordId: linkedRecord.record_id,
        });
      }
    }

    if (newEntries.length > 0) {
      await db.insert(crossLinkIndex).values(newEntries);
      totalEntries += newEntries.length;
    }

    totalRecords += batch.length;
    lastId = batch[batch.length - 1]!.id;

    // If batch is smaller than limit, we've reached the end
    if (batch.length < REBUILD_BATCH_SIZE) break;
  }

  logger.info(
    { crossLinkId, totalRecords, totalEntries },
    'Index rebuild complete',
  );
}

// ---------------------------------------------------------------------------
// Processor class
// ---------------------------------------------------------------------------

export class CrossLinkIndexRebuildProcessor extends BaseProcessor<CrossLinkIndexRebuildJobData> {
  constructor() {
    super('cross-link', { concurrency: 1 });
  }

  async processJob(
    job: Job<CrossLinkIndexRebuildJobData>,
    logger: Logger,
  ): Promise<void> {
    await processIndexRebuild(job, logger);
  }
}
