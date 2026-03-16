/**
 * NotificationCleanupProcessor — deletes notifications older than 90 days.
 *
 * Job name: `notification.cleanup`
 * Schedule: daily cron (configured at queue registration).
 *
 * @see docs/reference/communications.md § Error Handling
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { NotificationCleanupJobData } from '@everystack/shared/queue';
import {
  getDbForTenant,
  lt,
  notifications,
} from '@everystack/shared/db';

import { BaseProcessor } from '../../lib/base-processor';

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class NotificationCleanupProcessor extends BaseProcessor<NotificationCleanupJobData> {
  static readonly JOB_NAME = 'notification.cleanup' as const;

  constructor() {
    super('notification');
  }

  async processJob(
    job: Job<NotificationCleanupJobData>,
    logger: Logger,
  ): Promise<void> {
    const { tenantId, olderThanDays } = job.data;
    const days = olderThanDays ?? 90;

    logger.info({ tenantId, olderThanDays: days }, 'Starting notification cleanup');

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const db = getDbForTenant(tenantId, 'write');

    const result = await db
      .delete(notifications)
      .where(
        lt(notifications.createdAt, cutoff),
      )
      .returning({ id: notifications.id });

    const deletedCount = result.length;

    logger.info(
      { tenantId, deletedCount, cutoffDate: cutoff.toISOString() },
      'Notification cleanup completed',
    );
  }
}
