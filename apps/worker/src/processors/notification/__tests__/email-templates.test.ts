import { describe, it, expect } from 'vitest';
import {
  renderInvitationEmail,
  renderSystemAlertEmail,
  renderClientThreadReplyEmail,
  renderGenericNotificationEmail,
} from '../email-templates';

// ---------------------------------------------------------------------------
// InvitationEmail
// ---------------------------------------------------------------------------

describe('renderInvitationEmail', () => {
  it('renders HTML with workspace name and inviter', async () => {
    const html = await renderInvitationEmail({
      workspaceName: 'Acme Corp',
      inviterName: 'Jane Smith',
      inviteUrl: 'https://app.everystack.com/invite/abc123',
    });

    expect(html).toContain('Acme Corp');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('Accept Invitation');
    expect(html).toContain('https://app.everystack.com/invite/abc123');
    expect(html).toContain('EveryStack');
  });

  it('renders valid HTML document', async () => {
    const html = await renderInvitationEmail({
      workspaceName: 'Test',
      inviterName: 'Bob',
      inviteUrl: 'https://example.com',
    });

    expect(html).toContain('<!DOCTYPE html');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('escapes HTML in props', async () => {
    const html = await renderInvitationEmail({
      workspaceName: '<script>alert("xss")</script>',
      inviterName: 'Bob',
      inviteUrl: 'https://example.com',
    });

    expect(html).not.toContain('<script>alert');
  });
});

// ---------------------------------------------------------------------------
// SystemAlertEmail
// ---------------------------------------------------------------------------

describe('renderSystemAlertEmail', () => {
  it('renders sync failure alert', async () => {
    const html = await renderSystemAlertEmail({
      alertType: 'sync_failure',
      alertTitle: 'Airtable sync failed',
      alertBody: 'Connection timed out after 30s',
      workspaceName: 'Acme Corp',
      dashboardUrl: 'https://app.everystack.com/settings/sync',
    });

    expect(html).toContain('Sync Failure');
    expect(html).toContain('Airtable sync failed');
    expect(html).toContain('Connection timed out after 30s');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('View Dashboard');
    expect(html).toContain('https://app.everystack.com/settings/sync');
  });

  it('renders automation error alert', async () => {
    const html = await renderSystemAlertEmail({
      alertType: 'automation_error',
      alertTitle: 'Automation "Send Welcome" failed',
      alertBody: 'Step 3 threw an error',
      workspaceName: 'Acme Corp',
      dashboardUrl: 'https://app.everystack.com/automations',
    });

    expect(html).toContain('Automation Error');
    expect(html).toContain('Send Welcome');
  });

  it('falls back to System Alert for unknown type', async () => {
    const html = await renderSystemAlertEmail({
      alertType: 'unknown_type',
      alertTitle: 'Something happened',
      alertBody: 'Details here',
      workspaceName: 'Test',
      dashboardUrl: 'https://example.com',
    });

    expect(html).toContain('System Alert');
  });
});

// ---------------------------------------------------------------------------
// ClientThreadReplyEmail
// ---------------------------------------------------------------------------

describe('renderClientThreadReplyEmail', () => {
  it('renders reply with message preview and portal link', async () => {
    const html = await renderClientThreadReplyEmail({
      senderName: 'Alice Johnson',
      recordTitle: 'Invoice #42',
      messagePreview: 'I have attached the updated invoice for your review.',
      portalUrl: 'https://portal.acme.everystack.com/records/42',
    });

    expect(html).toContain('Alice Johnson');
    expect(html).toContain('Invoice #42');
    expect(html).toContain('I have attached the updated invoice');
    expect(html).toContain('View in Portal');
    expect(html).toContain('https://portal.acme.everystack.com/records/42');
  });

  it('handles empty message preview', async () => {
    const html = await renderClientThreadReplyEmail({
      senderName: 'Bob',
      recordTitle: 'Task',
      messagePreview: '',
      portalUrl: 'https://portal.example.com',
    });

    expect(html).toContain('Bob');
    expect(html).toContain('Task');
  });

  it('renders EveryStack branding', async () => {
    const html = await renderClientThreadReplyEmail({
      senderName: 'Test',
      recordTitle: 'Test Record',
      messagePreview: 'Hello',
      portalUrl: 'https://portal.example.com',
    });

    expect(html).toContain('EveryStack');
  });
});

// ---------------------------------------------------------------------------
// Generic fallback
// ---------------------------------------------------------------------------

describe('renderGenericNotificationEmail', () => {
  it('renders title and body', async () => {
    const html = await renderGenericNotificationEmail({
      title: 'New notification',
      body: 'Something happened',
    });

    expect(html).toContain('New notification');
    expect(html).toContain('Something happened');
    expect(html).toContain('EveryStack');
  });

  it('renders without body', async () => {
    const html = await renderGenericNotificationEmail({
      title: 'Just a title',
    });

    expect(html).toContain('Just a title');
  });
});
