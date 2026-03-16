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

vi.mock('../authorize-room-join', () => ({
  authorizeRoomJoin: vi.fn(),
}));

import { authorizeRoomJoin } from '../authorize-room-join';
import { registerChatHandlers, broadcastMessageToThread } from '../chat-handler';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockSocket(userId: string, tenantId: string) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const toEmitFn = vi.fn();
  return {
    id: 'socket-chat-123',
    data: { userId, tenantId } as Record<string, unknown>,
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    rooms: new Set<string>(['socket-chat-123']),
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
  const exceptEmitFn = vi.fn();
  const emitFn = vi.fn();
  return {
    to: vi.fn().mockReturnValue({
      emit: emitFn,
      except: vi.fn().mockReturnValue({ emit: exceptEmitFn }),
    }),
    _emitFn: emitFn,
    _exceptEmitFn: exceptEmitFn,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registerChatHandlers', () => {
  const mockAuthorize = vi.mocked(authorizeRoomJoin);
  const userId = 'user-uuid-1';
  const tenantId = 'tenant-uuid-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers thread:join, thread:leave, typing:start, typing:stop handlers', () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    expect(socket.on).toHaveBeenCalledWith('thread:join', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('thread:leave', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('typing:start', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('typing:stop', expect.any(Function));
  });

  it('thread:join authorizes, joins room, and sets presence', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();
    mockAuthorize.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    const callback = vi.fn();
    socket._trigger('thread:join', 'thread-abc', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(mockAuthorize).toHaveBeenCalledWith({
      roomId: 'thread:thread-abc',
      userId,
      tenantId,
    });
    expect(socket.join).toHaveBeenCalledWith(`t:${tenantId}:thread:thread-abc`);
    expect(presence.setPresence).toHaveBeenCalledWith(
      tenantId,
      'thread:thread-abc',
      userId,
      'online',
    );
    expect(callback).toHaveBeenCalledWith({ ok: true });
  });

  it('thread:join returns { ok: false } on unauthorized', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();
    mockAuthorize.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    const callback = vi.fn();
    socket._trigger('thread:join', 'thread-secret', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(socket.join).not.toHaveBeenCalled();
    expect(presence.setPresence).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ ok: false });
  });

  it('thread:leave leaves room and removes presence', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    socket._trigger('thread:leave', 'thread-abc');

    await vi.waitFor(() => {
      expect(presence.removePresence).toHaveBeenCalled();
    });

    expect(socket.leave).toHaveBeenCalledWith(`t:${tenantId}:thread:thread-abc`);
    expect(presence.removePresence).toHaveBeenCalledWith(
      tenantId,
      'thread:thread-abc',
      userId,
    );
  });

  it('typing:start broadcasts to room excluding sender', () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    socket._trigger('typing:start', { threadId: 'thread-abc', displayName: 'Alice' });

    const fullRoom = `t:${tenantId}:thread:thread-abc`;
    expect(socket.to).toHaveBeenCalledWith(fullRoom);
    expect(socket._toEmitFn).toHaveBeenCalledWith(
      REALTIME_EVENTS.TYPING_START,
      { threadId: 'thread-abc', userId, displayName: 'Alice' },
    );
  });

  it('typing:stop broadcasts to room excluding sender', () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    socket._trigger('typing:stop', { threadId: 'thread-abc' });

    const fullRoom = `t:${tenantId}:thread:thread-abc`;
    expect(socket.to).toHaveBeenCalledWith(fullRoom);
    expect(socket._toEmitFn).toHaveBeenCalledWith(
      REALTIME_EVENTS.TYPING_STOP,
      { threadId: 'thread-abc', userId, displayName: '' },
    );
  });

  it('thread:join handles authorization error gracefully', async () => {
    const socket = createMockSocket(userId, tenantId);
    const io = createMockIo();
    const presence = createMockPresenceService();
    mockAuthorize.mockRejectedValue(new Error('DB down'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerChatHandlers(socket as any, io as any, presence as any);

    const callback = vi.fn();
    socket._trigger('thread:join', 'thread-abc', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(callback).toHaveBeenCalledWith({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe('broadcastMessageToThread', () => {
  it('broadcasts message:new to thread room excluding sender', () => {
    const io = createMockIo();
    const tenantId = 'tenant-1';
    const threadId = 'thread-1';

    broadcastMessageToThread(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      io as any,
      tenantId,
      threadId,
      { type: 'message:new', threadId, payload: { id: 'msg-1', body: 'Hello' } },
      'sender-user-id',
    );

    expect(io.to).toHaveBeenCalledWith(`t:${tenantId}:thread:${threadId}`);
    expect(io._exceptEmitFn).toHaveBeenCalledWith('message:new', { id: 'msg-1', body: 'Hello' });
  });

  it('broadcasts message:edit to thread room without exclusion', () => {
    const io = createMockIo();

    broadcastMessageToThread(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      io as any,
      'tenant-1',
      'thread-1',
      { type: 'message:edit', threadId: 'thread-1', payload: { id: 'msg-1', body: 'Updated' } },
    );

    expect(io.to).toHaveBeenCalledWith('t:tenant-1:thread:thread-1');
    expect(io._emitFn).toHaveBeenCalledWith('message:edit', { id: 'msg-1', body: 'Updated' });
  });

  it('broadcasts message:delete to thread room', () => {
    const io = createMockIo();

    broadcastMessageToThread(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      io as any,
      'tenant-1',
      'thread-1',
      { type: 'message:delete', threadId: 'thread-1', payload: { id: 'msg-1' } },
    );

    expect(io._emitFn).toHaveBeenCalledWith('message:delete', { id: 'msg-1' });
  });
});
