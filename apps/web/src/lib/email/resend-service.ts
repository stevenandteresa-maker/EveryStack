/**
 * ResendEmailService — wraps the Resend API for transactional email delivery.
 *
 * MVP scope: system emails only (invitations, alerts).
 * From address defaults to `notifications@everystack.com` (Tier 1 sender).
 *
 * @see docs/reference/email.md § Email Provider Stack
 * @see docs/reference/email.md § Sender Identity — Tier 1
 */

import { Resend } from 'resend';
import { webLogger } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  /** Defaults to notifications@everystack.com */
  from?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULT_FROM = 'EveryStack <notifications@everystack.com>';

export class ResendEmailService {
  private readonly client: Resend;
  private readonly logger = webLogger.child({ service: 'ResendEmailService' });

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['RESEND_API_KEY'];
    if (!key) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    this.client = new Resend(key);
  }

  /**
   * Send a transactional email via the Resend API.
   * Logs errors but does not throw — email delivery is best-effort.
   */
  async send(params: SendEmailParams): Promise<{ success: boolean; id?: string }> {
    const { to, subject, html, from } = params;
    const fromAddress = from ?? DEFAULT_FROM;

    try {
      const result = await this.client.emails.send({
        from: fromAddress,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      });

      if (result.error) {
        this.logger.error(
          { err: result.error.message, to, subject },
          'Resend API returned error',
        );
        return { success: false };
      }

      this.logger.info({ emailId: result.data?.id, to, subject }, 'Email sent');
      return { success: true, id: result.data?.id };
    } catch (error) {
      this.logger.error(
        { err: error instanceof Error ? error.message : String(error), to, subject },
        'Failed to send email via Resend',
      );
      return { success: false };
    }
  }
}
