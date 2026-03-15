/**
 * InvitationEmail — "You've been invited to join {workspaceName} on EveryStack."
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

export interface InvitationEmailProps {
  workspaceName: string;
  inviterName: string;
  inviteUrl: string;
}

export function InvitationEmail({
  workspaceName,
  inviterName,
  inviteUrl,
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {inviterName} invited you to join {workspaceName} on EveryStack
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>EveryStack</Text>
          <Heading style={heading}>
            You&apos;ve been invited to join {workspaceName}
          </Heading>
          <Text style={paragraph}>
            {inviterName} has invited you to collaborate on{' '}
            <strong>{workspaceName}</strong> in EveryStack.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
          </Section>
          <Text style={footer}>
            If you weren&apos;t expecting this invitation, you can safely ignore
            this email.
          </Text>
          <Text style={footerBrand}>EveryStack</Text>
        </Container>
      </Body>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Styles (inline for email client compatibility)
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

const heading: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: 700,
  lineHeight: '32px',
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

export default InvitationEmail;
