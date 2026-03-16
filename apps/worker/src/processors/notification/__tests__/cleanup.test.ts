import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { NotificationCleanupJobData } from '@everystack/shared/queue';
import { NotificationCleanupProcessor } from '../cleanup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(),
  lt: vi.fn((...args: unknown[]) => ({ op: 'lt', args })),
  notifications: {
    id: 'id',
    tenantId: 'tenant_id',
    createdAt: 'created_at',
  },
  sql: vi.fn(),
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

vi.mock('../../../lib/sentry', () => ({
  captureJobError: vi.fn(),
}));

const { getDbForTenant } = await import('@everystack/shared/db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockJob(
  overrides?: Partial<NotificationCleanupJobData>,
): Job<NotificationCleanupJobData> {
  return {
    id: 'job-cleanup-1',
    name: 'notification.cleanup',
    data: {
      tenantId: 'tenant-001',
      traceId: 'trace-001',
      triggeredBy: 'cron-scheduler',
      olderThanDays: 90,
      ...overrides,
    },
  } as unknown as Job<NotificationCleanupJobData>;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<NotificationCleanupProcessor['processJob']>[1];

function mockDeleteChain(deletedRows: { id: string }[] = []) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.returning = vi.fn().mockResolvedValue(deletedRows);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationCleanupProcessor', () => {
  let processor: NotificationCleanupProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDbForTenant).mockReset();
    processor = new NotificationCleanupProcessor();
  });

  it('has correct job name', () => {
    expect(NotificationCleanupProcessor.JOB_NAME).toBe('notification.cleanup');
  });

  it('deletes notifications older than 90 days', async () => {
    const dbMock = mockDeleteChain([
      { id: 'notif-old-1' },
      { id: 'notif-old-2' },
    ]);
    vi.mocked(getDbForTenant).mockReturnValue(dbMock as never);

    await processor.processJob(createMockJob(), mockLogger);

    expect(getDbForTenant).toHaveBeenCalledWith('tenant-001', 'write');
    expect(dbMock.delete).toHaveBeenCalled();
    expect(dbMock.returning).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ deletedCount: 2 }),
      'Notification cleanup completed',
    );
  });

  it('uses custom olderThanDays when specified', async () => {
    const dbMock = mockDeleteChain([]);
    vi.mocked(getDbForTenant).mockReturnValue(dbMock as never);

    await processor.processJob(
      createMockJob({ olderThanDays: 30 }),
      mockLogger,
    );

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ olderThanDays: 30 }),
      'Starting notification cleanup',
    );
  });

  it('handles zero deleted rows gracefully', async () => {
    const dbMock = mockDeleteChain([]);
    vi.mocked(getDbForTenant).mockReturnValue(dbMock as never);

    await processor.processJob(createMockJob(), mockLogger);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ deletedCount: 0 }),
      'Notification cleanup completed',
    );
  });

  it('calculates correct cutoff date', async () => {
    const now = new Date('2026-03-15T12:00:00Z');
    vi.useFakeTimers({ now });

    const dbMock = mockDeleteChain([]);
    vi.mocked(getDbForTenant).mockReturnValue(dbMock as never);

    await processor.processJob(createMockJob({ olderThanDays: 90 }), mockLogger);

    // The cutoff should be 90 days before now
    const expectedCutoff = new Date('2025-12-15T12:00:00Z');
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        cutoffDate: expectedCutoff.toISOString(),
      }),
      'Notification cleanup completed',
    );

    vi.useRealTimers();
  });
});
