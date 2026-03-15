import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so they're available in vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockPublish,
  mockCreateEventPublisher,
  mockCreateRedisClient,
} = vi.hoisted(() => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  return {
    mockPublish,
    mockCreateEventPublisher: vi.fn(() => ({ publish: mockPublish })),
    mockCreateRedisClient: vi.fn(() => 'mock-redis-client'),
  };
});

vi.mock('@everystack/shared/realtime', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createEventPublisher: mockCreateEventPublisher,
  };
});

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: mockCreateRedisClient,
}));

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    child: vi.fn(() => ({
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    })),
  },
}));

// Import AFTER mocks are set up
const { publishChatEvent, setRedisClient } = await import('../chat-events');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishChatEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRedisClient(null);
  });

  afterEach(() => {
    setRedisClient(null);
  });

  it('publishes message:new event with correct payload', async () => {
    const messagePayload = { id: 'msg-1', content: 'Hello' };

    await publishChatEvent('tenant-1', 'thread-1', {
      type: 'message:new',
      threadId: 'thread-1',
      payload: messagePayload,
    }, 'user-sender');

    expect(mockPublish).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      channel: 'thread:thread-1',
      event: REALTIME_EVENTS.MESSAGE_NEW,
      payload: messagePayload,
      excludeUserId: 'user-sender',
    });
  });

  it('publishes message:edit event with correct event name', async () => {
    await publishChatEvent('tenant-1', 'thread-1', {
      type: 'message:edit',
      threadId: 'thread-1',
      payload: { id: 'msg-1', content: 'Updated' },
    });

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REALTIME_EVENTS.MESSAGE_EDIT,
      }),
    );
  });

  it('publishes message:delete event with correct event name', async () => {
    await publishChatEvent('tenant-1', 'thread-1', {
      type: 'message:delete',
      threadId: 'thread-1',
      payload: { messageId: 'msg-1' },
    });

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        event: REALTIME_EVENTS.MESSAGE_DELETE,
      }),
    );
  });

  it('does not include excludeUserId when not provided', async () => {
    await publishChatEvent('tenant-1', 'thread-1', {
      type: 'message:new',
      threadId: 'thread-1',
      payload: {},
    });

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        excludeUserId: undefined,
      }),
    );
  });

  it('creates Redis client lazily on first call', async () => {
    await publishChatEvent('tenant-1', 'thread-1', {
      type: 'message:new',
      threadId: 'thread-1',
      payload: {},
    });

    expect(mockCreateRedisClient).toHaveBeenCalledWith('web:chat-events');
    expect(mockCreateEventPublisher).toHaveBeenCalledWith('mock-redis-client');
  });

  it('reuses Redis client on subsequent calls', async () => {
    await publishChatEvent('tenant-1', 'thread-1', {
      type: 'message:new',
      threadId: 'thread-1',
      payload: {},
    });
    await publishChatEvent('tenant-2', 'thread-2', {
      type: 'message:edit',
      threadId: 'thread-2',
      payload: {},
    });

    expect(mockCreateRedisClient).toHaveBeenCalledTimes(1);
  });

  it('does not throw on unknown event type', async () => {
    await expect(
      publishChatEvent('tenant-1', 'thread-1', {
        type: 'message:unknown',
        threadId: 'thread-1',
        payload: {},
      }),
    ).resolves.toBeUndefined();

    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('does not throw when publisher.publish fails (fire-and-forget)', async () => {
    mockPublish.mockRejectedValueOnce(new Error('Redis connection lost'));

    await expect(
      publishChatEvent('tenant-1', 'thread-1', {
        type: 'message:new',
        threadId: 'thread-1',
        payload: {},
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when Redis client creation fails', async () => {
    mockCreateEventPublisher.mockImplementationOnce(() => {
      throw new Error('Redis unavailable');
    });

    await expect(
      publishChatEvent('tenant-1', 'thread-1', {
        type: 'message:new',
        threadId: 'thread-1',
        payload: {},
      }),
    ).resolves.toBeUndefined();
  });
});
