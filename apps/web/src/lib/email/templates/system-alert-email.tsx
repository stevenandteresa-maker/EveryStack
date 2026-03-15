/**
 * SystemAlertEmail — system alerts (sync failures, automation errors, storage quota).
 *
 * Server-side rendered via React Email. From: notifications@everystack.com.
 * Not user-editable — system template maintained by engineering.
 *
 * @see docs/reference/email.md § MVP: System Emails
 */

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

export interface SystemAlertEmailProps {
  /** Known values: 'sync_failure' | 'automation_error' | 'storage_quota' */
  alertType: string;
  alertTitle: string;
  alertBody: string;
  workspaceName: string;
  dashboardUrl: string;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  sync_failure: 'Sync Failure',
  automation_error: 'Automation Error',
  storage_quota: 'Storage Quota Warning',
};

export function SystemAlertEmail({
  alertType,
  alertTitle,
  alertBody,
  workspaceName,
  dashboardUrl,
}: SystemAlertEmailProps) {
  const typeLabel = ALERT_TYPE_LABELS[alertType] ?? 'System Alert';

  return (
    <Html>
      <Head />
      <Preview>
        [{typeLabel}] {alertTitle} — {workspaceName}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>EveryStack</Text>
          <Text style={alertBadge}>{typeLabel}</Text>
          <Heading style={heading}>{alertTitle}</Heading>
          <Text style={workspaceLabel}>Workspace: {workspaceName}</Text>
          <Text style={paragraph}>{alertBody}</Text>
          <Section style={buttonContainer}>
            <Button style={button} href={dashboardUrl}>
              View Dashboard
            </Button>
          </Section>
          <Text style={footer}>
            You received this alert because you are an admin of {workspaceName}.
          </Text>
          <Text style={footerBrand}>EveryStack</Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const body: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  margin: '40px auto',
  maxWidth: '600px',
  padding: '40px 32px',
};

const logo: React.CSSProperties = {
  color: '#0D9488',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 24px 0',
};

const alertBadge: React.CSSProperties = {
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

const heading: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: 700,
  lineHeight: '28px',
  margin: '0 0 8px 0',
};

const workspaceLabel: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '0 0 16px 0',
};

const paragraph: React.CSSProperties = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px 0',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'center' as const,
  margin: '0 0 24px 0',
};

const button: React.CSSProperties = {
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

const footer: React.CSSProperties = {
  color: '#999999',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '0 0 8px 0',
};

const footerBrand: React.CSSProperties = {
  borderTop: '1px solid #e5e5e5',
  color: '#999999',
  fontSize: '12px',
  marginTop: '24px',
  paddingTop: '16px',
};

export default SystemAlertEmail;
