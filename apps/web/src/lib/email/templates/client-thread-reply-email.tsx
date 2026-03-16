/**
 * ClientThreadReplyEmail — fires when workspace user posts in client thread.
 *
 * Includes message preview (first 120 chars) + link to portal.
 * Server-side rendered via React Email. From: notifications@everystack.com.
 *
 * @see docs/phases/phase-division-phase3-part1.md lines 184–213
 * @see docs/reference/communications.md § Notification Aggregation & Delivery
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

export interface ClientThreadReplyEmailProps {
  senderName: string;
  recordTitle: string;
  messagePreview: string;
  portalUrl: string;
}

export function ClientThreadReplyEmail({
  senderName,
  recordTitle,
  messagePreview,
  portalUrl,
}: ClientThreadReplyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {senderName} replied on {recordTitle}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={logo}>EveryStack</Text>
          <Heading style={heading}>
            New reply on &ldquo;{recordTitle}&rdquo;
          </Heading>
          <Text style={paragraph}>
            <strong>{senderName}</strong> posted a message:
          </Text>
          <Section style={previewBox}>
            <Text style={previewText}>{messagePreview}</Text>
          </Section>
          <Section style={buttonContainer}>
            <Button style={button} href={portalUrl}>
              View in Portal
            </Button>
          </Section>
          <Text style={footer}>
            You received this email because you are a participant in this
            conversation.
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

const heading: React.CSSProperties = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: 700,
  lineHeight: '28px',
  margin: '0 0 16px 0',
};

const paragraph: React.CSSProperties = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px 0',
};

const previewBox: React.CSSProperties = {
  backgroundColor: '#f8f9fa',
  borderLeft: '3px solid #0D9488',
  borderRadius: '0 4px 4px 0',
  margin: '0 0 24px 0',
  padding: '12px 16px',
};

const previewText: React.CSSProperties = {
  color: '#374151',
  fontSize: '14px',
  fontStyle: 'italic' as const,
  lineHeight: '20px',
  margin: 0,
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

export default ClientThreadReplyEmail;
