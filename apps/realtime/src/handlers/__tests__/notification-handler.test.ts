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

import { registerNotificationHandlers, buildNotificationChannel } from '../notification-handler';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockSocket(userId: string, tenantId: string) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    id: 'socket-notif-123',
    data: { userId, tenantId } as Record<string, unknown>,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    emit: vi.fn(),
    _trigger(event: string, ...args: unknown[]) {
      const handler = handlers.get(event);
      if (handler) handler(...args);
    },
  };
}

function createMockRedis() {
  const messageHandlers: Array<(channel: string, message: string) => void> = [];
  return {
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((_event: string, handler: (channel: string, message: string) => void) => {
      messageHandlers.push(handler);
    }),
    removeListener: vi.fn((_event: string, handler: (channel: string, message: string) => void) => {
      const idx = messageHandlers.indexOf(handler);
      if (idx >= 0) messageHandlers.splice(idx, 1);
    }),
    _simulateMessage(channel: string, message: string) {
      for (const handler of messageHandlers) {
        handler(channel, message);
      }
    },
    _messageHandlers: messageHandlers,
  };
}

function createMockPresenceService() {
  return {
    setPresence: vi.fn().mockResolvedValue(undefined),
    getPresence: vi.fn().mockResolvedValue([]),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    getUserStatus: vi.fn().mockResolvedValue('online'),
    removePresence: vi.fn().mockResolvedValue(undefined),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('buildNotificationChannel', () => {
  it('builds correct channel name', () => {
    expect(buildNotificationChannel('user-123')).toBe('user:user-123:notifications');
  });
});

describe('registerNotificationHandlers', () => {
  const userId = 'user-uuid-1';
  const tenantId = 'tenant-uuid-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('subscribes to user notification channel on registration', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.subscribe).toHaveBeenCalledWith(`user:${userId}:notifications`);
    });
  });

  it('pushes notification to client via Socket.IO when not DND', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();
    presence.getUserStatus.mockResolvedValue('online');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    const notification = {
      id: 'notif-1',
      type: 'thread_reply',
      title: 'New reply',
      body: 'Alice replied to your thread',
    };

    redis._simulateMessage(
      `user:${userId}:notifications`,
      JSON.stringify(notification),
    );

    await vi.waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith(
        REALTIME_EVENTS.NOTIFICATION_NEW,
        notification,
      );
    });
  });

  it('suppresses non-priority notifications when DND', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();
    presence.getUserStatus.mockResolvedValue('dnd');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    const notification = {
      id: 'notif-1',
      type: 'thread_reply',
      title: 'New reply',
    };

    redis._simulateMessage(
      `user:${userId}:notifications`,
      JSON.stringify(notification),
    );

    // Give time for async handling
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('allows mention notifications through DND', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();
    presence.getUserStatus.mockResolvedValue('dnd');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    const notification = {
      id: 'notif-2',
      type: 'mention',
      title: 'You were mentioned',
    };

    redis._simulateMessage(
      `user:${userId}:notifications`,
      JSON.stringify(notification),
    );

    await vi.waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith(
        REALTIME_EVENTS.NOTIFICATION_NEW,
        notification,
      );
    });
  });

  it('allows DM from Owner through DND', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();
    presence.getUserStatus.mockResolvedValue('dnd');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    const notification = {
      id: 'notif-3',
      type: 'dm',
      title: 'New DM from Owner',
      senderRole: 'owner',
    };

    redis._simulateMessage(
      `user:${userId}:notifications`,
      JSON.stringify(notification),
    );

    await vi.waitFor(() => {
      expect(socket.emit).toHaveBeenCalledWith(
        REALTIME_EVENTS.NOTIFICATION_NEW,
        notification,
      );
    });
  });

  it('suppresses DM from non-Owner during DND', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();
    presence.getUserStatus.mockResolvedValue('dnd');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    const notification = {
      id: 'notif-4',
      type: 'dm',
      title: 'New DM',
      senderRole: 'member',
    };

    redis._simulateMessage(
      `user:${userId}:notifications`,
      JSON.stringify(notification),
    );

    // Give time for async handling
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('unsubscribes from Redis on disconnect', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.subscribe).toHaveBeenCalled();
    });

    socket._trigger('disconnect');

    await vi.waitFor(() => {
      expect(redis.unsubscribe).toHaveBeenCalledWith(`user:${userId}:notifications`);
    });

    expect(redis.removeListener).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('ignores messages from other channels', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    redis._simulateMessage(
      'user:other-user:notifications',
      JSON.stringify({ id: 'notif-x', type: 'mention', title: 'Not for you' }),
    );

    // Give time for async handling
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('handles malformed message gracefully', async () => {
    const socket = createMockSocket(userId, tenantId);
    const redis = createMockRedis();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerNotificationHandlers(socket as any, redis as any, presence as any);

    await vi.waitFor(() => {
      expect(redis.on).toHaveBeenCalled();
    });

    // Should not throw
    redis._simulateMessage(
      `user:${userId}:notifications`,
      'not-valid-json',
    );

    // Give time for async handling
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(socket.emit).not.toHaveBeenCalled();
  });
});
