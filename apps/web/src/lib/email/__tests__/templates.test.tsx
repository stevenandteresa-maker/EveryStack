/**
 * Tests for React Email templates — rendering + snapshot verification.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@react-email/components';
import React from 'react';

import { InvitationEmail } from '../templates/invitation-email';
import { SystemAlertEmail } from '../templates/system-alert-email';
import { ClientThreadReplyEmail } from '../templates/client-thread-reply-email';

// ---------------------------------------------------------------------------
// InvitationEmail
// ---------------------------------------------------------------------------

describe('InvitationEmail', () => {
  it('renders with all props', async () => {
    const html = await render(
      <InvitationEmail
        workspaceName="Acme Corp"
        inviterName="Jane Smith"
        inviteUrl="https://app.everystack.com/invite/abc123"
      />,
    );

    expect(html).toContain('Acme Corp');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('Accept Invitation');
    expect(html).toContain('https://app.everystack.com/invite/abc123');
    expect(html).toContain('EveryStack');
  });

  it('renders preview text', async () => {
    const html = await render(
      <InvitationEmail
        workspaceName="Test WS"
        inviterName="Bob"
        inviteUrl="https://example.com"
      />,
    );

    expect(html).toContain('Bob invited you to join Test WS on EveryStack');
  });

  it('renders valid HTML', async () => {
    const html = await render(
      <InvitationEmail
        workspaceName="Test"
        inviterName="Bob"
        inviteUrl="https://example.com"
      />,
    );

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('</html>');
  });
});

// ---------------------------------------------------------------------------
// SystemAlertEmail
// ---------------------------------------------------------------------------

describe('SystemAlertEmail', () => {
  it('renders sync failure alert', async () => {
    const html = await render(
      <SystemAlertEmail
        alertType="sync_failure"
        alertTitle="Airtable sync failed"
        alertBody="Connection timed out"
        workspaceName="Acme Corp"
        dashboardUrl="https://app.everystack.com/settings/sync"
      />,
    );

    expect(html).toContain('Sync Failure');
    expect(html).toContain('Airtable sync failed');
    expect(html).toContain('Connection timed out');
    expect(html).toContain('View Dashboard');
    expect(html).toContain('https://app.everystack.com/settings/sync');
  });

  it('renders automation error alert', async () => {
    const html = await render(
      <SystemAlertEmail
        alertType="automation_error"
        alertTitle="Automation failed"
        alertBody="Step error"
        workspaceName="Test"
        dashboardUrl="https://example.com"
      />,
    );

    expect(html).toContain('Automation Error');
  });

  it('renders storage quota alert with fallback label', async () => {
    const html = await render(
      <SystemAlertEmail
        alertType="storage_quota"
        alertTitle="Storage quota 90%"
        alertBody="Running low on storage"
        workspaceName="Test"
        dashboardUrl="https://example.com"
      />,
    );

    expect(html).toContain('Storage Quota Warning');
  });

  it('falls back to System Alert for unknown type', async () => {
    const html = await render(
      <SystemAlertEmail
        alertType="unknown"
        alertTitle="Unknown"
        alertBody="Details"
        workspaceName="Test"
        dashboardUrl="https://example.com"
      />,
    );

    expect(html).toContain('System Alert');
  });
});

// ---------------------------------------------------------------------------
// ClientThreadReplyEmail
// ---------------------------------------------------------------------------

describe('ClientThreadReplyEmail', () => {
  it('renders with message preview and portal link', async () => {
    const html = await render(
      <ClientThreadReplyEmail
        senderName="Alice Johnson"
        recordTitle="Invoice #42"
        messagePreview="I have attached the updated invoice for review."
        portalUrl="https://portal.acme.everystack.com/records/42"
      />,
    );

    expect(html).toContain('Alice Johnson');
    expect(html).toContain('Invoice #42');
    expect(html).toContain('I have attached the updated invoice');
    expect(html).toContain('View in Portal');
    expect(html).toContain('https://portal.acme.everystack.com/records/42');
  });

  it('renders preview text with sender and record', async () => {
    const html = await render(
      <ClientThreadReplyEmail
        senderName="Bob"
        recordTitle="Task #1"
        messagePreview="Done"
        portalUrl="https://portal.example.com"
      />,
    );

    expect(html).toContain('Bob replied on Task #1');
  });

  it('renders EveryStack branding', async () => {
    const html = await render(
      <ClientThreadReplyEmail
        senderName="Test"
        recordTitle="Record"
        messagePreview="Hello"
        portalUrl="https://portal.example.com"
      />,
    );

    expect(html).toContain('EveryStack');
  });
});
