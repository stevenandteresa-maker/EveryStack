import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const {
  mockRedisPublish,
  mockCreateRedisClient,
} = vi.hoisted(() => {
  const mockRedisPublish = vi.fn().mockResolvedValue(undefined);
  return {
    mockRedisPublish,
    mockCreateRedisClient: vi.fn(() => ({
      publish: mockRedisPublish,
    })),
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
const { publishNotificationEvent, setRedisClient } = await import('../notification-events');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishNotificationEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRedisClient(null);
  });

  afterEach(() => {
    setRedisClient(null);
  });

  it('publishes notification to correct Redis channel', async () => {
    const notification = { id: 'notif-1', type: 'mention', title: 'You were mentioned' };

    await publishNotificationEvent('user-1', notification);

    expect(mockRedisPublish).toHaveBeenCalledWith(
      'user:user-1:notifications',
      JSON.stringify(notification),
    );
  });

  it('serializes notification payload as JSON', async () => {
    const notification = { id: 'notif-2', type: 'dm', title: 'New DM', metadata: { threadId: 't-1' } };

    await publishNotificationEvent('user-2', notification);

    const publishedJson = mockRedisPublish.mock.calls[0]![1] as string;
    expect(JSON.parse(publishedJson)).toEqual(notification);
  });

  it('creates Redis client lazily on first call', async () => {
    await publishNotificationEvent('user-1', { id: 'n-1' });

    expect(mockCreateRedisClient).toHaveBeenCalledWith('web:notification-events');
  });

  it('reuses Redis client on subsequent calls', async () => {
    await publishNotificationEvent('user-1', { id: 'n-1' });
    await publishNotificationEvent('user-2', { id: 'n-2' });

    expect(mockCreateRedisClient).toHaveBeenCalledTimes(1);
  });

  it('does not throw when Redis publish fails (fire-and-forget)', async () => {
    mockRedisPublish.mockRejectedValueOnce(new Error('Redis connection lost'));

    await expect(
      publishNotificationEvent('user-1', { id: 'n-1' }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when Redis client creation fails', async () => {
    mockCreateRedisClient.mockImplementationOnce(() => {
      throw new Error('Redis unavailable');
    });
    setRedisClient(null);

    await expect(
      publishNotificationEvent('user-1', { id: 'n-1' }),
    ).resolves.toBeUndefined();
  });
});
