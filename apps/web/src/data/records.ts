/**
 * Record data access functions.
 *
 * @see docs/reference/data-model.md § Records
 */

import { getQueue } from '@/lib/queue';

// ---------------------------------------------------------------------------
// Outbound sync status types
// ---------------------------------------------------------------------------

export type OutboundSyncStatus = 'synced' | 'pending' | 'failed';

// ---------------------------------------------------------------------------
// getOutboundSyncStatus
// ---------------------------------------------------------------------------

/**
 * Check the outbound sync status for a record edit.
 *
 * Looks up the BullMQ job state for the outbound sync job keyed by
 * `outbound:{tenantId}:{recordId}`. Returns:
 * - 'synced'  — no pending job found (already completed or never enqueued)
 * - 'pending' — job is waiting, delayed, or active
 * - 'failed'  — job has failed all retry attempts
 */
export async function getOutboundSyncStatus(
  tenantId: string,
  recordId: string,
  _fieldId: string,
): Promise<OutboundSyncStatus> {
  const queue = getQueue('sync:outbound');
  const jobId = `outbound:${tenantId}:${recordId}`;

  const job = await queue.getJob(jobId);

  if (!job) {
    return 'synced';
  }

  const state = await job.getState();

  switch (state) {
    case 'waiting':
    case 'delayed':
    case 'active':
    case 'waiting-children':
      return 'pending';
    case 'failed':
      return 'failed';
    case 'completed':
    default:
      return 'synced';
  }
}
