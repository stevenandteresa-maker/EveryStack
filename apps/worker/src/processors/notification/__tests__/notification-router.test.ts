import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type {
  NotificationEmailSendJobData,
  NotificationCleanupJobData,
} from '@everystack/shared/queue';
import { NotificationRouter } from '../notification-router';
import type { NotificationEmailSendProcessor } from '../email-send';
import type { NotificationCleanupProcessor } from '../cleanup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

vi.mock('../../../lib/sentry', () => ({
  captureJobError: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<NotificationRouter['processJob']>[1];

function createEmailSendJob(): Job<NotificationEmailSendJobData> {
  return {
    id: 'job-email-1',
    name: 'notification.email.send',
    data: {
      tenantId: 'tenant-001',
      traceId: 'trace-001',
      triggeredBy: 'notification-service',
      notificationId: 'notif-001',
      userId: 'user-001',
      type: 'mention',
      title: 'Test notification',
    },
  } as unknown as Job<NotificationEmailSendJobData>;
}

function createCleanupJob(): Job<NotificationCleanupJobData> {
  return {
    id: 'job-cleanup-1',
    name: 'notification.cleanup',
    data: {
      tenantId: 'tenant-001',
      traceId: 'trace-001',
      triggeredBy: 'cron-scheduler',
      olderThanDays: 90,
    },
  } as unknown as Job<NotificationCleanupJobData>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationRouter', () => {
  let emailSend: NotificationEmailSendProcessor;
  let cleanup: NotificationCleanupProcessor;
  let router: NotificationRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    emailSend = { processJob: vi.fn() } as unknown as NotificationEmailSendProcessor;
    cleanup = { processJob: vi.fn() } as unknown as NotificationCleanupProcessor;
    router = new NotificationRouter(emailSend, cleanup);
  });

  it('routes notification.email.send to email send processor', async () => {
    const job = createEmailSendJob();
    await router.processJob(job, mockLogger);

    expect(emailSend.processJob).toHaveBeenCalledWith(job, mockLogger);
    expect(cleanup.processJob).not.toHaveBeenCalled();
  });

  it('routes notification.cleanup to cleanup processor', async () => {
    const job = createCleanupJob();
    await router.processJob(job, mockLogger);

    expect(cleanup.processJob).toHaveBeenCalledWith(job, mockLogger);
    expect(emailSend.processJob).not.toHaveBeenCalled();
  });

  it('logs warning for unknown job name', async () => {
    const job = {
      id: 'job-unknown',
      name: 'notification.unknown',
      data: { tenantId: 'tenant-001', traceId: 'trace-001', triggeredBy: 'test' },
    } as unknown as Job<NotificationEmailSendJobData>;

    await router.processJob(job, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      { jobName: 'notification.unknown' },
      'Unknown notification job type',
    );
    expect(emailSend.processJob).not.toHaveBeenCalled();
    expect(cleanup.processJob).not.toHaveBeenCalled();
  });
});
