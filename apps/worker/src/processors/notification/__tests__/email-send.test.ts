import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { NotificationEmailSendJobData } from '@everystack/shared/queue';
import { NotificationEmailSendProcessor, EMAIL_SEND_JOB_OPTIONS } from '../email-send';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEmailsSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockEmailsSend };
  },
}));

vi.mock('@everystack/shared/logging', () => ({
  workerLogger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
  createChildLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  runWithTraceContext: vi.fn((_ctx, fn) => fn()),
  generateTraceId: vi.fn(() => 'trace-gen'),
}));

vi.mock('@everystack/shared/redis', () => ({
  getRedisConfig: vi.fn(() => ({ host: 'localhost', port: 6379 })),
}));

vi.mock('../../lib/sentry', () => ({
  captureJobError: vi.fn(),
}));

vi.mock('../email-templates', () => ({
  renderInvitationEmail: vi.fn(async () => '<html>invitation</html>'),
  renderSystemAlertEmail: vi.fn(async () => '<html>system-alert</html>'),
  renderClientThreadReplyEmail: vi.fn(async () => '<html>client-reply</html>'),
  renderGenericNotificationEmail: vi.fn(async (params: { title: string }) => `<html>${params.title}</html>`),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockJob(
  overrides?: Partial<NotificationEmailSendJobData>,
  opts?: { attemptsMade?: number; attempts?: number },
): Job<NotificationEmailSendJobData> {
  return {
    id: 'job-1',
    name: 'notification.email.send',
    attemptsMade: opts?.attemptsMade ?? 0,
    opts: { attempts: opts?.attempts ?? 3 },
    data: {
      tenantId: 'tenant-001',
      traceId: 'trace-001',
      triggeredBy: 'notification-service',
      notificationId: 'notif-001',
      userId: 'user-001',
      type: 'mention',
      title: 'Sarah mentioned you in Project Alpha',
      body: 'Check this out!',
      email: 'user@example.com',
      ...overrides,
    },
  } as unknown as Job<NotificationEmailSendJobData>;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<NotificationEmailSendProcessor['processJob']>[1];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationEmailSendProcessor', () => {
  let processor: NotificationEmailSendProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new NotificationEmailSendProcessor('re_test_key');
  });

  it('has correct job name', () => {
    expect(NotificationEmailSendProcessor.JOB_NAME).toBe('notification.email.send');
  });

  it('sends email via Resend on success', async () => {
    mockEmailsSend.mockResolvedValue({
      data: { id: 'email-123' },
      error: null,
    });

    await processor.processJob(createMockJob(), mockLogger);

    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: 'EveryStack <notifications@everystack.com>',
      to: ['user@example.com'],
      subject: 'Sarah mentioned you in Project Alpha',
      html: expect.any(String),
    });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ notificationId: 'notif-001', emailId: 'email-123' }),
      'Notification email sent',
    );
  });

  it('uses invitation template for invitation type', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-inv' }, error: null });

    const { renderInvitationEmail } = await import('../email-templates');

    await processor.processJob(
      createMockJob({
        type: 'invitation',
        metadata: { workspaceName: 'Acme', inviterName: 'Bob', inviteUrl: 'https://example.com/invite' },
      }),
      mockLogger,
    );

    expect(renderInvitationEmail).toHaveBeenCalledWith({
      workspaceName: 'Acme',
      inviterName: 'Bob',
      inviteUrl: 'https://example.com/invite',
    });
  });

  it('uses system alert template for sync_error type', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-alert' }, error: null });

    const { renderSystemAlertEmail } = await import('../email-templates');

    await processor.processJob(
      createMockJob({
        type: 'sync_error',
        title: 'Airtable sync failed',
        body: 'Connection timeout',
        metadata: { workspaceName: 'Acme', dashboardUrl: 'https://example.com/dash' },
      }),
      mockLogger,
    );

    expect(renderSystemAlertEmail).toHaveBeenCalledWith({
      alertType: 'sync_failure',
      alertTitle: 'Airtable sync failed',
      alertBody: 'Connection timeout',
      workspaceName: 'Acme',
      dashboardUrl: 'https://example.com/dash',
    });
  });

  it('uses client thread reply template with message preview', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-reply' }, error: null });

    const { renderClientThreadReplyEmail } = await import('../email-templates');

    const longBody = 'A'.repeat(200);
    await processor.processJob(
      createMockJob({
        type: 'client_thread_reply',
        body: longBody,
        metadata: { senderName: 'Alice', recordTitle: 'Invoice #42', portalUrl: 'https://portal.example.com' },
      }),
      mockLogger,
    );

    expect(renderClientThreadReplyEmail).toHaveBeenCalledWith({
      senderName: 'Alice',
      recordTitle: 'Invoice #42',
      messagePreview: 'A'.repeat(120),
      portalUrl: 'https://portal.example.com',
    });
  });

  it('uses generic template for unknown notification types', async () => {
    mockEmailsSend.mockResolvedValue({ data: { id: 'email-gen' }, error: null });

    const { renderGenericNotificationEmail } = await import('../email-templates');

    await processor.processJob(
      createMockJob({ type: 'some_unknown_type', title: 'Hello', body: 'World' }),
      mockLogger,
    );

    expect(renderGenericNotificationEmail).toHaveBeenCalledWith({
      title: 'Hello',
      body: 'World',
    });
  });

  it('throws on Resend API error (enables retry)', async () => {
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: 'Rate limit exceeded' },
    });

    await expect(processor.processJob(createMockJob(), mockLogger)).rejects.toThrow(
      'Resend API error: Rate limit exceeded',
    );
  });

  it('throws on network error (enables retry)', async () => {
    mockEmailsSend.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(processor.processJob(createMockJob(), mockLogger)).rejects.toThrow(
      'ECONNREFUSED',
    );
  });

  it('logs warning on non-final retry attempt', async () => {
    mockEmailsSend.mockRejectedValue(new Error('Temporary failure'));

    const job = createMockJob({}, { attemptsMade: 0, attempts: 3 });

    await expect(processor.processJob(job, mockLogger)).rejects.toThrow();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1 }),
      'Email send attempt failed — will retry',
    );
  });

  it('logs error on final retry attempt', async () => {
    mockEmailsSend.mockRejectedValue(new Error('Persistent failure'));

    const job = createMockJob({}, { attemptsMade: 2, attempts: 3 });

    await expect(processor.processJob(job, mockLogger)).rejects.toThrow();

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 3 }),
      'Final email send attempt failed — giving up',
    );
  });

  it('uses default from address notifications@everystack.com', async () => {
    mockEmailsSend.mockResolvedValue({
      data: { id: 'email-789' },
      error: null,
    });

    await processor.processJob(createMockJob(), mockLogger);

    expect(mockEmailsSend.mock.calls[0]![0].from).toBe(
      'EveryStack <notifications@everystack.com>',
    );
  });

  it('throws if no API key is provided', () => {
    const original = process.env['RESEND_API_KEY'];
    delete process.env['RESEND_API_KEY'];

    try {
      expect(() => new NotificationEmailSendProcessor()).toThrow(
        'RESEND_API_KEY environment variable is required',
      );
    } finally {
      if (original !== undefined) {
        process.env['RESEND_API_KEY'] = original;
      }
    }
  });
});

describe('EMAIL_SEND_JOB_OPTIONS', () => {
  it('has 3 retry attempts', () => {
    expect(EMAIL_SEND_JOB_OPTIONS.attempts).toBe(3);
  });

  it('uses exponential backoff starting at 60s', () => {
    expect(EMAIL_SEND_JOB_OPTIONS.backoff.type).toBe('exponential');
    expect(EMAIL_SEND_JOB_OPTIONS.backoff.delay).toBe(60_000);
  });
});
