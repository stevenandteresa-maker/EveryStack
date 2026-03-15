/**
 * NotificationEmailSendProcessor — sends notification emails via Resend.
 *
 * Job name: `notification.email.send`
 * Retry: 3 attempts with exponential backoff (1min, 5min, 15min).
 * On final failure: log error, mark failed. No further retry.
 *
 * @see docs/reference/communications.md § Delivery Pipeline
 * @see docs/reference/email.md § MVP: System Emails
 */

import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { NotificationEmailSendJobData } from '@everystack/shared/queue';
import { Resend } from 'resend';

import { BaseProcessor } from '../../lib/base-processor';
import {
  renderInvitationEmail,
  renderSystemAlertEmail,
  renderClientThreadReplyEmail,
  renderGenericNotificationEmail,
} from './email-templates';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FROM = 'EveryStack <notifications@everystack.com>';

/** Retry config: 3 attempts, exponential backoff starting at 60s */
export const EMAIL_SEND_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 60_000, // 1min → 5min (factor ~4-5 with jitter, actual: 2min) → ~15min
  },
} as const;

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export class NotificationEmailSendProcessor extends BaseProcessor<NotificationEmailSendJobData> {
  static readonly JOB_NAME = 'notification.email.send' as const;

  private readonly resend: Resend;

  constructor(apiKey?: string) {
    super('notification');
    const key = apiKey ?? process.env['RESEND_API_KEY'];
    if (!key) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.resend = new Resend(key);
  }

  async processJob(
    job: Job<NotificationEmailSendJobData>,
    logger: Logger,
  ): Promise<void> {
    const { notificationId, userId, type, title } = job.data;

    logger.info(
      { notificationId, userId, type },
      'Processing notification email',
    );

    // Render email HTML using React Email templates based on notification type.
    const html = await renderEmailForNotificationType(job.data);

    // Look up user email — placeholder until user lookup is wired.
    // For now, the job data should include the recipient address,
    // but we fall back to userId as a safeguard.
    const to = job.data.email ?? userId;

    try {
      const result = await this.resend.emails.send({
        from: DEFAULT_FROM,
        to: [to],
        subject: title,
        html,
      });

      if (result.error) {
        logger.error(
          { notificationId, err: result.error.message },
          'Resend API returned error',
        );
        throw new Error(`Resend API error: ${result.error.message}`);
      }

      logger.info(
        { notificationId, emailId: result.data?.id },
        'Notification email sent',
      );
    } catch (error) {
      const attempt = job.attemptsMade + 1;
      const isLastAttempt = attempt >= (job.opts.attempts ?? 3);

      if (isLastAttempt) {
        logger.error(
          {
            notificationId,
            attempt,
            err: error instanceof Error ? error.message : String(error),
          },
          'Final email send attempt failed — giving up',
        );
      } else {
        logger.warn(
          {
            notificationId,
            attempt,
            err: error instanceof Error ? error.message : String(error),
          },
          'Email send attempt failed — will retry',
        );
      }

      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Template routing — determines React Email template based on notification type
// ---------------------------------------------------------------------------

async function renderEmailForNotificationType(
  data: NotificationEmailSendJobData,
): Promise<string> {
  const metadata = data.metadata ?? {};

  switch (data.type) {
    case 'invitation':
      return renderInvitationEmail({
        workspaceName: metadata['workspaceName'] ?? 'your workspace',
        inviterName: metadata['inviterName'] ?? 'A team member',
        inviteUrl: metadata['inviteUrl'] ?? '',
      });

    case 'sync_error':
    case 'automation_failed':
      return renderSystemAlertEmail({
        alertType: data.type === 'sync_error' ? 'sync_failure' : 'automation_error',
        alertTitle: data.title,
        alertBody: data.body ?? '',
        workspaceName: metadata['workspaceName'] ?? '',
        dashboardUrl: metadata['dashboardUrl'] ?? '',
      });

    case 'client_thread_reply':
      return renderClientThreadReplyEmail({
        senderName: metadata['senderName'] ?? 'Someone',
        recordTitle: metadata['recordTitle'] ?? 'a record',
        messagePreview: (data.body ?? '').slice(0, 120),
        portalUrl: metadata['portalUrl'] ?? '',
      });

    default:
      return renderGenericNotificationEmail({
        title: data.title,
        body: data.body,
      });
  }
}
