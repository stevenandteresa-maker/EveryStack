/**
 * Email template rendering for the notification email processor.
 *
 * Uses React Email components rendered server-side via `render()`.
 * Templates mirror the React Email components in apps/web/src/lib/email/templates/.
 *
 * @see docs/reference/email.md § MVP: System Emails
 */

import { render } from '@react-email/components';
import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Text,
  Heading,
  Section,
  Button,
} from '@react-email/components';

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const bodyStyle: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '40px auto',
  maxWidth: '600px',
  padding: '40px 32px',
};

const logoStyle: React.CSSProperties = {
  color: '#0D9488',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 24px 0',
};

const headingStyle: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 700,
  lineHeight: '32px',
  margin: '0 0 16px 0',
};

const paragraphStyle: React.CSSProperties = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px 0',
};

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#0D9488',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: '100%',
  padding: '12px 24px',
  textDecoration: 'none',
};

const buttonContainerStyle: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
};

const footerStyle: React.CSSProperties = {
  color: '#999999',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '0 0 8px 0',
};

const footerBrandStyle: React.CSSProperties = {
  borderTop: '1px solid #e5e5e5',
  color: '#999999',
  fontSize: '12px',
  marginTop: '24px',
  paddingTop: '16px',
};

// ---------------------------------------------------------------------------
// createElement helpers (worker doesn't use JSX transform)
// ---------------------------------------------------------------------------

const h = React.createElement;

// ---------------------------------------------------------------------------
// InvitationEmail
// ---------------------------------------------------------------------------

export interface InvitationEmailProps {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
}

export async function renderInvitationEmail(props: InvitationEmailProps): Promise<string> {
  const element = h(Html, null,
    h(Head, null),
    h(Preview, null, `${props.inviterName} invited you to join ${props.workspaceName} on EveryStack`),
    h(Body, { style: bodyStyle },
      h(Container, { style: containerStyle },
        h(Text, { style: logoStyle }, 'EveryStack'),
        h(Heading, { style: headingStyle }, `You've been invited to join ${props.workspaceName}`),
        h(Text, { style: paragraphStyle },
          `${props.inviterName} has invited you to collaborate on ${props.workspaceName} in EveryStack.`,
        ),
        h(Section, { style: buttonContainerStyle },
          h(Button, { style: buttonStyle, href: props.inviteUrl }, 'Accept Invitation'),
        ),
        h(Text, { style: footerStyle }, "If you weren't expecting this invitation, you can safely ignore this email."),
        h(Text, { style: footerBrandStyle }, 'EveryStack'),
      ),
    ),
  );

  return render(element);
}

// ---------------------------------------------------------------------------
// SystemAlertEmail
// ---------------------------------------------------------------------------

const ALERT_TYPE_LABELS: Record<string, string> = {
  sync_failure: 'Sync Failure',
  automation_error: 'Automation Error',
  storage_quota: 'Storage Quota Warning',
};

export interface SystemAlertEmailProps {
  alertType: string;
  alertTitle: string;
  alertBody: string;
  workspaceName: string;
  dashboardUrl: string;
}

const alertBadgeStyle: React.CSSProperties = {
  backgroundColor: '#FEF2F2',
  border: '1px solid #FECACA',
  borderRadius: '4px',
  color: '#DC2626',
  display: 'inline-block',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: '16px',
  margin: '0 0 12px 0',
  padding: '4px 8px',
};

const workspaceLabelStyle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '0 0 16px 0',
};

export async function renderSystemAlertEmail(props: SystemAlertEmailProps): Promise<string> {
  const typeLabel = ALERT_TYPE_LABELS[props.alertType] ?? 'System Alert';

  const element = h(Html, null,
    h(Head, null),
    h(Preview, null, `[${typeLabel}] ${props.alertTitle} — ${props.workspaceName}`),
    h(Body, { style: bodyStyle },
      h(Container, { style: containerStyle },
        h(Text, { style: logoStyle }, 'EveryStack'),
        h(Text, { style: alertBadgeStyle }, typeLabel),
        h(Heading, { style: { ...headingStyle, fontSize: '20px', lineHeight: '28px' } }, props.alertTitle),
        h(Text, { style: workspaceLabelStyle }, `Workspace: ${props.workspaceName}`),
        h(Text, { style: paragraphStyle }, props.alertBody),
        h(Section, { style: buttonContainerStyle },
          h(Button, { style: buttonStyle, href: props.dashboardUrl }, 'View Dashboard'),
        ),
        h(Text, { style: footerStyle }, `You received this alert because you are an admin of ${props.workspaceName}.`),
        h(Text, { style: footerBrandStyle }, 'EveryStack'),
      ),
    ),
  );

  return render(element);
}

// ---------------------------------------------------------------------------
// ClientThreadReplyEmail
// ---------------------------------------------------------------------------

export interface ClientThreadReplyEmailProps {
  senderName: string;
  recordTitle: string;
  messagePreview: string;
  portalUrl: string;
}

const previewBoxStyle: React.CSSProperties = {
  backgroundColor: '#f8f9fa',
  borderLeft: '3px solid #0D9488',
  borderRadius: '0 4px 4px 0',
  margin: '0 0 24px 0',
  padding: '12px 16px',
};

const previewTextStyle: React.CSSProperties = {
  color: '#374151',
  fontSize: '14px',
  fontStyle: 'italic' as const,
  lineHeight: '20px',
  margin: '0',
};

export async function renderClientThreadReplyEmail(props: ClientThreadReplyEmailProps): Promise<string> {
  const element = h(Html, null,
    h(Head, null),
    h(Preview, null, `${props.senderName} replied on ${props.recordTitle}`),
    h(Body, { style: bodyStyle },
      h(Container, { style: containerStyle },
        h(Text, { style: logoStyle }, 'EveryStack'),
        h(Heading, { style: { ...headingStyle, fontSize: '20px', lineHeight: '28px' } },
          `New reply on "${props.recordTitle}"`,
        ),
        h(Text, { style: paragraphStyle }, `${props.senderName} posted a message:`),
        h(Section, { style: previewBoxStyle },
          h(Text, { style: previewTextStyle }, props.messagePreview),
        ),
        h(Section, { style: buttonContainerStyle },
          h(Button, { style: buttonStyle, href: props.portalUrl }, 'View in Portal'),
        ),
        h(Text, { style: footerStyle }, 'You received this email because you are a participant in this conversation.'),
        h(Text, { style: footerBrandStyle }, 'EveryStack'),
      ),
    ),
  );

  return render(element);
}

// ---------------------------------------------------------------------------
// Generic fallback
// ---------------------------------------------------------------------------

export async function renderGenericNotificationEmail(params: {
  title: string;
  body?: string;
}): Promise<string> {
  const element = h(Html, null,
    h(Head, null),
    h(Preview, null, params.title),
    h(Body, { style: bodyStyle },
      h(Container, { style: containerStyle },
        h(Text, { style: logoStyle }, 'EveryStack'),
        h(Heading, { style: headingStyle }, params.title),
        params.body ? h(Text, { style: paragraphStyle }, params.body) : null,
        h(Text, { style: footerStyle }, 'You received this email from EveryStack.'),
        h(Text, { style: footerBrandStyle }, 'EveryStack'),
      ),
    ),
  );

  return render(element);
}
