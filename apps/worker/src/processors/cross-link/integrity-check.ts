/**
 * Cross-link index integrity check.
 *
 * Samples index entries and compares them against canonical_data to detect
 * drift. If >1% of sampled entries are inconsistent, enqueues a full
 * index rebuild and logs an alert.
 *
 * Sampling tiers by table size:
 * - <1,000 records: sample 100 entries
 * - <10,000 records: sample 500 entries
 * - ≥10,000 records: sample 1,000 entries
 *
 * Event-driven: failed/timed-out cascade jobs trigger immediate check.
 *
 * @see docs/reference/cross-linking.md § Index Consistency & Rebuild
 */

import type { Logger } from '@everystack/shared/logging';
import { workerLogger } from '@everystack/shared/logging';
import {
  getDbForTenant,
  crossLinkIndex,
  crossLinks,
  records,
  eq,
  and,
  sql,
  count,
} from '@everystack/shared/db';
import { extractCrossLinkField } from '@everystack/shared/sync';
import type { CrossLinkIndexRebuildJobData } from '@everystack/shared/queue';

/** Drift threshold: if >1% of sampled entries are inconsistent, trigger rebuild. */
const DRIFT_THRESHOLD = 0.01;

/** Sampling tiers based on index entry count. */
function getSampleSize(entryCount: number): number {
  if (entryCount < 1_000) return Math.min(100, entryCount);
  if (entryCount < 10_000) return 500;
  return 1_000;
}

export interface IntegrityCheckResult {
  crossLinkId: string;
  totalEntries: number;
  sampledEntries: number;
  driftCount: number;
  driftPercent: number;
  rebuildTriggered: boolean;
}

/**
 * Schedule and run an integrity check for a cross-link definition.
 *
 * Samples index entries and verifies they match canonical_data.
 * If >1% drift is detected, enqueues a full index rebuild.
 *
 * @param tenantId - Tenant to check
 * @param crossLinkId - Cross-link definition to check
 * @param enqueueRebuild - Optional callback to enqueue rebuild job (for DI/testing)
 * @param logger - Optional logger instance
 */
export async function scheduleIntegrityCheck(
  tenantId: string,
  crossLinkId: string,
  enqueueRebuild?: (data: CrossLinkIndexRebuildJobData) => Promise<void>,
  logger?: Logger,
): Promise<IntegrityCheckResult> {
  const log = logger ?? workerLogger;
  const db = getDbForTenant(tenantId, 'read');

  // Get the cross-link definition for source field info
  const [definition] = await db
    .select({
      id: crossLinks.id,
      sourceFieldId: crossLinks.sourceFieldId,
    })
    .from(crossLinks)
    .where(
      and(eq(crossLinks.id, crossLinkId), eq(crossLinks.tenantId, tenantId)),
    );

  if (!definition) {
    log.warn({ crossLinkId }, 'Cross-link definition not found for integrity check');
    return {
      crossLinkId,
      totalEntries: 0,
      sampledEntries: 0,
      driftCount: 0,
      driftPercent: 0,
      rebuildTriggered: false,
    };
  }

  // Count total index entries
  const [countResult] = await db
    .select({ total: count() })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLinkId),
      ),
    );

  const totalEntries = countResult?.total ?? 0;

  if (totalEntries === 0) {
    log.info({ crossLinkId }, 'No index entries to check');
    return {
      crossLinkId,
      totalEntries: 0,
      sampledEntries: 0,
      driftCount: 0,
      driftPercent: 0,
      rebuildTriggered: false,
    };
  }

  const sampleSize = getSampleSize(totalEntries);

  // Sample random index entries using TABLESAMPLE-like random ordering
  const sampledEntries = await db
    .select({
      sourceRecordId: crossLinkIndex.sourceRecordId,
      targetRecordId: crossLinkIndex.targetRecordId,
    })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.crossLinkId, crossLinkId),
      ),
    )
    .orderBy(sql`random()`)
    .limit(sampleSize);

  // Verify each sampled entry against canonical_data
  let driftCount = 0;

  for (const entry of sampledEntries) {
    const [sourceRecord] = await db
      .select({ canonicalData: records.canonicalData })
      .from(records)
      .where(
        and(
          eq(records.id, entry.sourceRecordId),
          eq(records.tenantId, tenantId),
        ),
      );

    if (!sourceRecord) {
      // Source record deleted but index entry remains — drift
      driftCount++;
      continue;
    }

    const canonical = sourceRecord.canonicalData as Record<string, unknown>;
    const field = extractCrossLinkField(canonical, definition.sourceFieldId);

    if (!field) {
      // No cross-link field in canonical data but index entry exists — drift
      driftCount++;
      continue;
    }

    const hasTarget = field.value.linked_records.some(
      (lr) => lr.record_id === entry.targetRecordId,
    );

    if (!hasTarget) {
      // Index entry references a target not in canonical data — drift
      driftCount++;
    }
  }

  const driftPercent = sampledEntries.length > 0
    ? driftCount / sampledEntries.length
    : 0;

  const rebuildTriggered = driftPercent > DRIFT_THRESHOLD;

  if (rebuildTriggered) {
    log.error(
      {
        crossLinkId,
        totalEntries,
        sampledEntries: sampledEntries.length,
        driftCount,
        driftPercent: `${(driftPercent * 100).toFixed(1)}%`,
      },
      'Index integrity check FAILED — drift exceeds threshold, triggering rebuild',
    );

    if (enqueueRebuild) {
      await enqueueRebuild({
        tenantId,
        crossLinkId,
        traceId: '',
        triggeredBy: 'integrity-check',
      });
    }
  } else {
    log.info(
      {
        crossLinkId,
        totalEntries,
        sampledEntries: sampledEntries.length,
        driftCount,
        driftPercent: `${(driftPercent * 100).toFixed(1)}%`,
      },
      'Index integrity check passed',
    );
  }

  return {
    crossLinkId,
    totalEntries,
    sampledEntries: sampledEntries.length,
    driftCount,
    driftPercent,
    rebuildTriggered,
  };
}
