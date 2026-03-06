/**
 * OutboundSyncProcessor — BullMQ processor for pushing EveryStack edits
 * to the source platform.
 *
 * Queue: sync:outbound
 * Retry: 3 attempts with exponential backoff (1min, 5min, 15min)
 * On final failure: logged via Pino + captured by Sentry
 *
 * @see docs/reference/sync-engine.md § Outbound Sync
 * @see docs/reference/data-model.md lines 649–660
 */

import { Queue } from 'bullmq';
import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import { createLogger } from '@everystack/shared/logging';
import type { OutboundSyncJobData } from '@everystack/shared/queue';
import { QUEUE_NAMES } from '@everystack/shared/queue';
import {
  getDbForTenant,
  syncedFieldMappings,
  baseConnections,
  eq,
  and,
} from '@everystack/shared/db';
import { getRedisConfig } from '@everystack/shared/redis';
import {
  executeOutboundSync,
  registerAirtableTransforms,
} from '@everystack/shared/sync';
import type { OutboundSyncJob, SyncConfig } from '@everystack/shared/sync';
import { BaseProcessor } from '../../lib/base-processor';

// Ensure transforms are registered
registerAirtableTransforms();

const logger = createLogger({ service: 'sync-outbound' });

// ---------------------------------------------------------------------------
// Queue singleton — used by enqueueOutboundSync
// ---------------------------------------------------------------------------

let _queue: Queue<OutboundSyncJobData> | null = null;

function getOutboundQueue(): Queue<OutboundSyncJobData> {
  if (!_queue) {
    _queue = new Queue<OutboundSyncJobData>(QUEUE_NAMES['sync:outbound'], {
      connection: getRedisConfig('sync-outbound-queue'),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'custom',
        },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return _queue;
}

/**
 * Custom backoff strategy: 1min, 5min, 15min.
 */
const BACKOFF_DELAYS_MS = [60_000, 300_000, 900_000];

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class OutboundSyncProcessor extends BaseProcessor<OutboundSyncJobData> {
  constructor() {
    super(QUEUE_NAMES['sync:outbound'], { concurrency: 5 });
  }

  async processJob(job: Job<OutboundSyncJobData>, jobLogger: Logger): Promise<void> {
    const { tenantId, recordId, tableId, baseConnectionId, changedFieldIds, editedBy, priority, traceId } = job.data;

    jobLogger.info(
      { recordId, tableId, baseConnectionId, changedFieldCount: changedFieldIds.length },
      'Processing outbound sync',
    );

    const outboundJob: OutboundSyncJob = {
      tenantId,
      recordId,
      tableId,
      baseConnectionId,
      changedFieldIds,
      editedBy,
      priority,
      traceId,
    };

    const result = await executeOutboundSync(outboundJob);

    if (!result.success) {
      jobLogger.error(
        { recordId, error: result.error, statusCode: result.statusCode },
        'Outbound sync failed',
      );
      throw new Error(result.error ?? 'Outbound sync failed');
    }

    jobLogger.info(
      { recordId, syncedFieldCount: result.syncedFieldIds.length, skippedFieldCount: result.skippedFieldIds.length },
      'Outbound sync succeeded',
    );
  }
}

// ---------------------------------------------------------------------------
// Enqueue function
// ---------------------------------------------------------------------------

/** Default job priority (lower = higher priority). */
const DEFAULT_PRIORITY = 10;

/**
 * Enqueue an outbound sync job for a record edit.
 *
 * - No-op if the table is not synced (no base_connection)
 * - No-op if the connection is inbound_only
 * - Deduplicates: merges changedFieldIds if a job for the same recordId is already queued
 */
export async function enqueueOutboundSync(
  tenantId: string,
  recordId: string,
  tableId: string,
  changedFieldIds: string[],
  editedBy: string,
  priority: number = DEFAULT_PRIORITY,
): Promise<{ enqueued: boolean; jobId?: string }> {
  // 1. Check if this table is synced — look up base_connection via synced_field_mappings
  const db = getDbForTenant(tenantId, 'read');

  const [mapping] = await db
    .select({
      baseConnectionId: syncedFieldMappings.baseConnectionId,
    })
    .from(syncedFieldMappings)
    .where(
      and(
        eq(syncedFieldMappings.tenantId, tenantId),
        eq(syncedFieldMappings.tableId, tableId),
        eq(syncedFieldMappings.status, 'active'),
      ),
    )
    .limit(1);

  if (!mapping) {
    // Not a synced table — no-op
    return { enqueued: false };
  }

  const baseConnectionId = mapping.baseConnectionId;

  // 2. Verify connection allows outbound sync
  const [connection] = await db
    .select({
      syncDirection: baseConnections.syncDirection,
      syncStatus: baseConnections.syncStatus,
      syncConfig: baseConnections.syncConfig,
    })
    .from(baseConnections)
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!connection) {
    return { enqueued: false };
  }

  // Skip if connection is inbound-only or not active
  if (connection.syncDirection === 'inbound_only') {
    return { enqueued: false };
  }

  if (connection.syncStatus !== 'active') {
    return { enqueued: false };
  }

  // Verify this table is enabled in sync config
  const syncConfig = connection.syncConfig as unknown as SyncConfig;
  if (syncConfig?.tables) {
    const tableEnabled = syncConfig.tables.some(
      (t) => t.enabled && t.es_table_id === tableId,
    );
    // Fallback: if no es_table_id set yet, allow if there are active mappings
    if (!tableEnabled) {
      const hasEsTableIds = syncConfig.tables.some((t) => t.es_table_id);
      if (hasEsTableIds) {
        return { enqueued: false };
      }
      // Old sync config without es_table_id — proceed (we have active mappings)
    }
  }

  // 3. Deduplicate — check for existing queued job for this record
  const queue = getOutboundQueue();
  const jobId = `outbound:${tenantId}:${recordId}`;

  const existingJob = await queue.getJob(jobId);
  if (existingJob) {
    const state = await existingJob.getState();
    if (state === 'waiting' || state === 'delayed') {
      // Merge changedFieldIds into the existing job
      const existingData = existingJob.data;
      const mergedFieldIds = [
        ...new Set([...existingData.changedFieldIds, ...changedFieldIds]),
      ];
      await existingJob.updateData({
        ...existingData,
        changedFieldIds: mergedFieldIds,
        editedBy,
      });

      logger.info(
        { recordId, mergedFieldCount: mergedFieldIds.length, jobId },
        'Merged changedFieldIds into existing outbound sync job',
      );

      return { enqueued: true, jobId };
    }
  }

  // 4. Add new job
  const job = await queue.add('outbound-sync', {
    tenantId,
    recordId,
    tableId,
    baseConnectionId,
    changedFieldIds,
    editedBy,
    priority,
    traceId: `outbound:${recordId}:${Date.now()}`,
    triggeredBy: editedBy,
  }, {
    jobId,
    priority,
    backoff: {
      type: 'custom',
    },
  });

  logger.info(
    { recordId, tableId, baseConnectionId, jobId: job.id },
    'Enqueued outbound sync job',
  );

  return { enqueued: true, jobId: job.id };
}

/**
 * Custom backoff calculator for BullMQ.
 * Returns delay in ms based on attempt number.
 */
export function calculateBackoff(attemptsMade: number): number {
  const index = Math.min(attemptsMade - 1, BACKOFF_DELAYS_MS.length - 1);
  return BACKOFF_DELAYS_MS[index] ?? BACKOFF_DELAYS_MS[BACKOFF_DELAYS_MS.length - 1]!;
}

/**
 * Replace the queue instance (for testing).
 */
export function setOutboundQueue(queue: Queue<OutboundSyncJobData> | null): void {
  _queue = queue;
}
