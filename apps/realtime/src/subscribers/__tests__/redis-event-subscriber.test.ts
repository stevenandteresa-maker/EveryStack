import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@everystack/shared/logging', () => ({
  realtimeLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { realtimeLogger } from '@everystack/shared/logging';
import { startRedisEventSubscriber } from '../redis-event-subscriber';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockRedis() {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    psubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    _triggerMessage(pattern: string, channel: string, message: string) {
      const handler = handlers.get('pmessage');
      if (handler) handler(pattern, channel, message);
    },
  };
}

function createMockIo() {
  const emitFn = vi.fn();
  const exceptFn = vi.fn().mockReturnValue({ emit: emitFn });
  const toFn = vi.fn().mockReturnValue({ emit: emitFn, except: exceptFn });

  return {
    to: toFn,
    _emit: emitFn,
    _except: exceptFn,
    _to: toFn,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('startRedisEventSubscriber', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockIo: ReturnType<typeof createMockIo>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    mockIo = createMockIo();
  });

  it('subscribes to the realtime:t:* pattern', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    expect(mockRedis.psubscribe).toHaveBeenCalledWith('realtime:t:*');
  });

  it('forwards events to correct Socket.io room', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    const message = JSON.stringify({
      event: 'record.updated',
      payload: { recordId: 'rec-1' },
      timestamp: Date.now(),
    });

    mockRedis._triggerMessage(
      'realtime:t:*',
      'realtime:t:tenant-1:table:table-abc',
      message,
    );

    expect(mockIo._to).toHaveBeenCalledWith('t:tenant-1:table:table-abc');
    expect(mockIo._emit).toHaveBeenCalledWith('record.updated', {
      recordId: 'rec-1',
    });
  });

  it('excludes user when excludeUserId is set', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    const message = JSON.stringify({
      event: 'record.created',
      payload: { recordId: 'rec-2' },
      excludeUserId: 'user-who-created',
      timestamp: Date.now(),
    });

    mockRedis._triggerMessage(
      'realtime:t:*',
      'realtime:t:tenant-1:table:table-xyz',
      message,
    );

    expect(mockIo._to).toHaveBeenCalledWith('t:tenant-1:table:table-xyz');
    expect(mockIo._except).toHaveBeenCalledWith(
      't:tenant-1:user:user-who-created',
    );
    expect(mockIo._emit).toHaveBeenCalledWith('record.created', {
      recordId: 'rec-2',
    });
  });

  it('logs error and skips malformed JSON messages', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    mockRedis._triggerMessage(
      'realtime:t:*',
      'realtime:t:tenant-1:table:t-1',
      'not-valid-json{{{',
    );

    expect(vi.mocked(realtimeLogger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ rawMessage: 'not-valid-json{{{' }),
      expect.stringContaining('Malformed message'),
    );
    expect(mockIo._to).not.toHaveBeenCalled();
  });

  it('logs error and skips messages without event name', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    const message = JSON.stringify({
      payload: { data: 'test' },
      timestamp: Date.now(),
    });

    mockRedis._triggerMessage(
      'realtime:t:*',
      'realtime:t:tenant-1:table:t-1',
      message,
    );

    expect(vi.mocked(realtimeLogger.error)).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'realtime:t:tenant-1:table:t-1' }),
      expect.stringContaining('Missing event name'),
    );
    expect(mockIo._to).not.toHaveBeenCalled();
  });

  it('handles workspace room events', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    const message = JSON.stringify({
      event: 'sync.completed',
      payload: { syncId: 'sync-1' },
      timestamp: Date.now(),
    });

    mockRedis._triggerMessage(
      'realtime:t:*',
      'realtime:t:tenant-2:workspace:ws-abc',
      message,
    );

    expect(mockIo._to).toHaveBeenCalledWith('t:tenant-2:workspace:ws-abc');
    expect(mockIo._emit).toHaveBeenCalledWith('sync.completed', {
      syncId: 'sync-1',
    });
  });

  it('handles user notification events', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await startRedisEventSubscriber(mockRedis as any, mockIo as any);

    const message = JSON.stringify({
      event: 'notification.created',
      payload: { notificationId: 'n-1' },
      timestamp: Date.now(),
    });

    mockRedis._triggerMessage(
      'realtime:t:*',
      'realtime:t:tenant-1:user:user-abc',
      message,
    );

    expect(mockIo._to).toHaveBeenCalledWith('t:tenant-1:user:user-abc');
    expect(mockIo._emit).toHaveBeenCalledWith('notification.created', {
      notificationId: 'n-1',
    });
  });
});
