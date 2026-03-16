/**
 * NotificationRouter — dispatches notification queue jobs by name.
 *
 * A single Worker handles the notification queue. Job names determine
 * which processor handles the work:
 *   - notification.email.send → NotificationEmailSendProcessor
 *   - notification.cleanup    → NotificationCleanupProcessor
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type {
  NotificationEmailSendJobData,
  NotificationCleanupJobData,
} from '@everystack/shared/queue';
import { BaseProcessor } from '../../lib/base-processor';
import type { NotificationEmailSendProcessor } from './email-send';
import type { NotificationCleanupProcessor } from './cleanup';

type NotificationJobData = NotificationEmailSendJobData | NotificationCleanupJobData;

export class NotificationRouter extends BaseProcessor<NotificationJobData> {
  constructor(
    private readonly emailSend: NotificationEmailSendProcessor,
    private readonly cleanup: NotificationCleanupProcessor,
  ) {
    super('notification');
  }

  async processJob(job: Job<NotificationJobData>, logger: Logger): Promise<void> {
    switch (job.name) {
      case 'notification.email.send':
        await this.emailSend.processJob(
          job as Job<NotificationEmailSendJobData>,
          logger,
        );
        break;
      case 'notification.cleanup':
        await this.cleanup.processJob(
          job as Job<NotificationCleanupJobData>,
          logger,
        );
        break;
      default:
        logger.warn({ jobName: job.name }, 'Unknown notification job type');
    }
  }
}
