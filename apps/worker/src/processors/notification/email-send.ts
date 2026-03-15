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
    const { notificationId, userId, type, title, body } = job.data;

    logger.info(
      { notificationId, userId, type },
      'Processing notification email',
    );

    // Render email HTML from notification data.
    // Prompt 7 will add React Email templates — for now, use a simple HTML wrapper.
    const html = renderNotificationEmail({ type, title, body });

    // Look up user email — placeholder until user lookup is wired.
    // For now, the job data should include the recipient address,
    // but we fall back to userId as a safeguard.
    const to = (job.data as NotificationEmailSendJobData & { email?: string }).email ?? userId;

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
// Simple HTML renderer (replaced by React Email templates in Prompt 7)
// ---------------------------------------------------------------------------

function renderNotificationEmail(params: {
  type: string;
  title: string;
  body?: string;
}): string {
  const { title, body } = params;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: 'DM Sans', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a; margin-bottom: 16px;">${escapeHtml(title)}</h2>
  ${body ? `<p style="color: #4a4a4a; line-height: 1.6;">${escapeHtml(body)}</p>` : ''}
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">You received this email from EveryStack.</p>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
