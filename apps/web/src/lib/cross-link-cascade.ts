/**
 * Cross-link display value cascade — enqueue helper.
 *
 * When a target record's display field changes, enqueues a BullMQ job
 * to update all source records that reference it.
 *
 * Job deduplication: uses jobId `crosslink:cascade:{tenantId}:{targetRecordId}`
 * so concurrent edits to the same target collapse into one cascade.
 *
 * @see docs/reference/cross-linking.md § Display Value Cascade
 */

import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';
import type { CrossLinkCascadeJobData } from '@everystack/shared/queue';

/** Priority mapping: high → 1 (immediate), low → 10 (background). */
const PRIORITY_MAP: Record<'high' | 'low', number> = {
  high: 1,
  low: 10,
} as const;

export async function enqueueCascadeJob(
  tenantId: string,
  targetRecordId: string,
  priority: 'high' | 'low',
  reason: CrossLinkCascadeJobData['reason'] = 'user_edit',
): Promise<void> {
  const queue = getQueue('cross-link');

  await queue.add(
    'cross-link.cascade',
    {
      tenantId,
      targetRecordId,
      priority,
      reason,
      traceId: getTraceId() ?? '',
      triggeredBy: 'cascade-enqueue',
    } satisfies CrossLinkCascadeJobData,
    {
      jobId: `crosslink:cascade:${tenantId}:${targetRecordId}`,
      priority: PRIORITY_MAP[priority],
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );
}
