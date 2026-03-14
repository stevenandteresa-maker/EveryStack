/**
 * Cross-link display value cascade processor.
 *
 * When a target record's display field changes, this processor updates
 * all source records that link to it with the new display value.
 *
 * Optimizations:
 * - Content hash: skips cascade if display value unchanged (~70% skip rate)
 * - Batched updates: chunks of 500 with 10ms inter-chunk yield
 * - Single-hop rule: cascades do NOT trigger further cascades
 * - Per-tenant concurrency: limited to 2 via BullMQ group concurrency
 *
 * @see docs/reference/cross-linking.md § Display Value Maintenance
 * @see docs/reference/cross-linking.md § Scalability
 */

import { createHash } from 'node:crypto';
import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { CrossLinkCascadeJobData } from '@everystack/shared/queue';
import {
  getDbForTenant,
  crossLinkIndex,
  crossLinks,
  records,
  eq,
  and,
  sql,
} from '@everystack/shared/db';
import type { EventPublisher } from '@everystack/shared/realtime';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import {
  extractCrossLinkField,
  setCrossLinkField,
} from '@everystack/shared/sync';
import type {
  CrossLinkFieldValue,
  CrossLinkLinkedRecordEntry,
} from '@everystack/shared/sync';
import { BaseProcessor } from '../../lib/base-processor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple SHA-256 content hash of a display value string. */
export function hashDisplayValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Split an array into chunks of the given size. */
function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

const CASCADE_BATCH_SIZE = 500;
const INTER_CHUNK_DELAY_MS = 10;

// ---------------------------------------------------------------------------
// Cascade processor
// ---------------------------------------------------------------------------

/**
 * Process a cross-link display value cascade job.
 *
 * 1. Single-hop guard: if reason is 'display_value_refresh', return immediately
 * 2. Read target record's current display value from canonical_data
 * 3. Compute content hash; skip if unchanged
 * 4. Query cross_link_index for affected source records
 * 5. Batch update source records' canonical_data in chunks of 500
 * 6. Publish one records.batch_updated event per affected source table
 */
export async function processCrossLinkCascade(
  job: Job<CrossLinkCascadeJobData>,
  eventPublisher: EventPublisher,
  logger: Logger,
): Promise<void> {
  const { tenantId, targetRecordId, reason } = job.data;

  // Single-hop rule: display_value_refresh events do NOT trigger cascades
  if (reason === 'display_value_refresh') {
    logger.info(
      { targetRecordId, reason },
      'Single-hop rule: skipping cascade for display_value_refresh',
    );
    return;
  }

  const db = getDbForTenant(tenantId, 'write');

  // Find all cross-link index entries pointing at this target record
  const affectedLinks = await db
    .select({
      crossLinkId: crossLinkIndex.crossLinkId,
      sourceRecordId: crossLinkIndex.sourceRecordId,
      sourceTableId: crossLinkIndex.sourceTableId,
    })
    .from(crossLinkIndex)
    .where(
      and(
        eq(crossLinkIndex.tenantId, tenantId),
        eq(crossLinkIndex.targetRecordId, targetRecordId),
      ),
    );

  if (affectedLinks.length === 0) {
    logger.info({ targetRecordId }, 'No affected links found, skipping cascade');
    return;
  }

  // Get unique cross-link definitions to find display field IDs
  const crossLinkIds = [...new Set(affectedLinks.map((l) => l.crossLinkId))];
  const definitions = await db
    .select({
      id: crossLinks.id,
      sourceFieldId: crossLinks.sourceFieldId,
      targetDisplayFieldId: crossLinks.targetDisplayFieldId,
    })
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        sql`${crossLinks.id} IN (${sql.join(
          crossLinkIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    );

  // Read the target record's canonical data
  const [targetRecord] = await db
    .select({ canonicalData: records.canonicalData })
    .from(records)
    .where(
      and(eq(records.id, targetRecordId), eq(records.tenantId, tenantId)),
    );

  if (!targetRecord) {
    logger.warn({ targetRecordId }, 'Target record not found, skipping cascade');
    return;
  }

  // Build display value per cross-link definition
  const displayValueByDefinition = new Map<string, string>();
  for (const def of definitions) {
    const canonical = targetRecord.canonicalData as Record<string, unknown>;
    const rawValue = canonical[def.targetDisplayFieldId];
    const displayValue =
      rawValue !== null && rawValue !== undefined ? String(rawValue) : '';
    displayValueByDefinition.set(def.id, displayValue);
  }

  // Content hash check: compute hash of new display values and compare
  // For simplicity, we hash the combined display values for this target record
  const combinedDisplayValue = [...displayValueByDefinition.values()].join('|');
  const newHash = hashDisplayValue(combinedDisplayValue);

  // Content hash comparison: compare against source records' existing display
  // values to determine if cascade is needed
  const [firstAffected] = affectedLinks;
  if (firstAffected) {
    const defForCheck = definitions.find((d) => d.id === firstAffected.crossLinkId);
    if (defForCheck) {
      const [sourceRec] = await db
        .select({ canonicalData: records.canonicalData })
        .from(records)
        .where(
          and(
            eq(records.id, firstAffected.sourceRecordId),
            eq(records.tenantId, tenantId),
          ),
        );

      if (sourceRec) {
        const existingField = extractCrossLinkField(
          sourceRec.canonicalData as Record<string, unknown>,
          defForCheck.sourceFieldId,
        );
        if (existingField) {
          const existingEntry = existingField.value.linked_records.find(
            (lr) => lr.record_id === targetRecordId,
          );
          if (existingEntry) {
            const existingDisplayHash = hashDisplayValue(
              displayValueByDefinition.get(firstAffected.crossLinkId) ?? '',
            );
            const currentDisplayHash = hashDisplayValue(existingEntry.display_value);
            if (existingDisplayHash === currentDisplayHash) {
              logger.info(
                { targetRecordId, hash: newHash },
                'Content hash unchanged, skipping cascade',
              );
              return;
            }
          }
        }
      }
    }
  }

  const now = new Date().toISOString();

  // Build source field map for quick lookup
  const sourceFieldByDefinition = new Map<string, string>();
  for (const def of definitions) {
    sourceFieldByDefinition.set(def.id, def.sourceFieldId);
  }

  // Track affected source tables for batched event publishing
  const affectedTableIds = new Set<string>();

  // Process in batches of 500
  const batches = chunks(affectedLinks, CASCADE_BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;

    await db.transaction(async (tx) => {
      for (const link of batch) {
        const sourceFieldId = sourceFieldByDefinition.get(link.crossLinkId);
        if (!sourceFieldId) continue;

        const newDisplayValue =
          displayValueByDefinition.get(link.crossLinkId) ?? '';

        // Read current source record
        const [sourceRecord] = await tx
          .select({ canonicalData: records.canonicalData })
          .from(records)
          .where(
            and(
              eq(records.id, link.sourceRecordId),
              eq(records.tenantId, tenantId),
            ),
          );

        if (!sourceRecord) continue;

        const canonical = sourceRecord.canonicalData as Record<string, unknown>;
        const existingField = extractCrossLinkField(canonical, sourceFieldId);
        if (!existingField) continue;

        // Find the linked record entry for this target
        const updatedLinkedRecords = existingField.value.linked_records.map(
          (lr: CrossLinkLinkedRecordEntry): CrossLinkLinkedRecordEntry => {
            if (lr.record_id !== targetRecordId) return lr;

            // _display_updated_at ordering guard: only update if newer
            if (lr._display_updated_at && lr._display_updated_at >= now) {
              return lr; // Stale update — skip
            }

            return {
              ...lr,
              display_value: newDisplayValue,
              _display_updated_at: now,
            };
          },
        );

        const updatedFieldValue: CrossLinkFieldValue = {
          type: 'cross_link',
          value: {
            ...existingField.value,
            linked_records: updatedLinkedRecords,
          },
        };

        const updatedCanonical = setCrossLinkField(
          canonical,
          sourceFieldId,
          updatedFieldValue,
        );

        await tx
          .update(records)
          .set({
            canonicalData: updatedCanonical,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(records.id, link.sourceRecordId),
              eq(records.tenantId, tenantId),
            ),
          );

        affectedTableIds.add(link.sourceTableId);
      }
    });

    // Inter-chunk yield (skip after last chunk)
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, INTER_CHUNK_DELAY_MS));
    }
  }

  // Publish ONE records.batch_updated event per affected source table
  for (const tableId of affectedTableIds) {
    const countForTable = affectedLinks.filter(
      (l) => l.sourceTableId === tableId,
    ).length;

    await eventPublisher.publish({
      tenantId,
      channel: `table:${tableId}`,
      event: REALTIME_EVENTS.RECORD_UPDATED_BATCH,
      payload: {
        type: REALTIME_EVENTS.RECORD_UPDATED_BATCH,
        reason: 'display_value_refresh',
        count: countForTable,
        targetRecordId,
      },
    });
  }

  logger.info(
    {
      targetRecordId,
      affectedRecords: affectedLinks.length,
      affectedTables: affectedTableIds.size,
      batchCount: batches.length,
    },
    'Cascade complete',
  );
}

// ---------------------------------------------------------------------------
// Processor class
// ---------------------------------------------------------------------------

export class CrossLinkCascadeProcessor extends BaseProcessor<CrossLinkCascadeJobData> {
  private readonly eventPublisher: EventPublisher;

  constructor(eventPublisher: EventPublisher) {
    super('cross-link', { concurrency: 2 });
    this.eventPublisher = eventPublisher;
  }

  async processJob(
    job: Job<CrossLinkCascadeJobData>,
    logger: Logger,
  ): Promise<void> {
    await processCrossLinkCascade(job, this.eventPublisher, logger);
  }
}
