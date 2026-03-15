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

import { registerPresenceHandlers } from '../presence-handler';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockSocket(userId: string, tenantId: string) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const toEmitFn = vi.fn();
  return {
    id: 'socket-presence-123',
    data: { userId, tenantId } as Record<string, unknown>,
    rooms: new Set<string>([
      'socket-presence-123',
      `t:${tenantId}:workspace:ws-1`,
      `t:${tenantId}:thread:thread-1`,
    ]),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    to: vi.fn().mockReturnValue({ emit: toEmitFn }),
    emit: vi.fn(),
    _trigger(event: string, ...args: unknown[]) {
      const handler = handlers.get(event);
      if (handler) handler(...args);
    },
    _toEmitFn: toEmitFn,
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

function createMockIo() {
  return {
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registerPresenceHandlers', () => {
  const userId = 'user-uuid-1';
  const tenantId = 'tenant-uuid-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers presence:heartbeat, presence:update, presence:status, disconnect handlers', () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    expect(socket.on).toHaveBeenCalledWith('presence:heartbeat', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('presence:update', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('presence:status', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('presence:heartbeat calls PresenceService.heartbeat()', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    socket._trigger('presence:heartbeat');

    await vi.waitFor(() => {
      expect(presence.heartbeat).toHaveBeenCalledWith(tenantId, userId);
    });
  });

  it('presence:update sets presence and broadcasts to workspace room', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    socket._trigger('presence:update', {
      state: 'dnd',
      workspaceId: 'ws-1',
      customStatus: { emoji: '🏖', text: 'On vacation' },
    });

    await vi.waitFor(() => {
      expect(presence.setPresence).toHaveBeenCalled();
    });

    expect(presence.setPresence).toHaveBeenCalledWith(
      tenantId,
      'workspace:ws-1',
      userId,
      'dnd',
    );
    expect(socket.to).toHaveBeenCalledWith(`t:${tenantId}:workspace:ws-1`);
    expect(socket._toEmitFn).toHaveBeenCalledWith(REALTIME_EVENTS.PRESENCE_UPDATE, {
      userId,
      state: 'dnd',
      customStatus: { emoji: '🏖', text: 'On vacation' },
    });
  });

  it('presence:update without workspaceId sets presence on user room, no broadcast', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    socket._trigger('presence:update', { state: 'away' });

    await vi.waitFor(() => {
      expect(presence.setPresence).toHaveBeenCalled();
    });

    expect(presence.setPresence).toHaveBeenCalledWith(
      tenantId,
      `user:${userId}`,
      userId,
      'away',
    );
    // No workspace broadcast
    expect(socket.to).not.toHaveBeenCalled();
  });

  it('presence:status returns current state via callback', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();
    presence.getUserStatus.mockResolvedValue('dnd');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    const callback = vi.fn();
    socket._trigger('presence:status', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(presence.getUserStatus).toHaveBeenCalledWith(tenantId, userId);
    expect(callback).toHaveBeenCalledWith({ state: 'dnd' });
  });

  it('disconnect removes presence from all rooms', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    socket._trigger('disconnect');

    await vi.waitFor(() => {
      expect(presence.removePresence).toHaveBeenCalled();
    });

    // Should remove presence for workspace:ws-1 and thread:thread-1 (not socket.id room)
    expect(presence.removePresence).toHaveBeenCalledWith(tenantId, 'workspace:ws-1', userId);
    expect(presence.removePresence).toHaveBeenCalledWith(tenantId, 'thread:thread-1', userId);
    expect(presence.removePresence).toHaveBeenCalledTimes(2);
  });

  it('handles heartbeat failure gracefully', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();
    presence.heartbeat.mockRejectedValue(new Error('Redis down'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerPresenceHandlers(socket as any, io as any, presence as any);

    // Should not throw
    socket._trigger('presence:heartbeat');

    await vi.waitFor(() => {
      expect(presence.heartbeat).toHaveBeenCalled();
    });
  });
});
