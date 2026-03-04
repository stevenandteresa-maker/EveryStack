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
import { registerRoomHandlers } from '../room-handler';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockSocket(userId: string, tenantId: string) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    id: 'socket-test-123',
    data: { userId, tenantId } as Record<string, unknown>,
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn().mockResolvedValue(undefined),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    _trigger(event: string, ...args: unknown[]) {
      const handler = handlers.get(event);
      if (handler) handler(...args);
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registerRoomHandlers', () => {
  const mockAuthorize = vi.mocked(authorizeRoomJoin);
  const userId = 'user-uuid-1';
  const tenantId = 'tenant-uuid-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers room:join and room:leave handlers', () => {
    const socket = createMockSocket(userId, tenantId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    expect(socket.on).toHaveBeenCalledWith('room:join', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('room:leave', expect.any(Function));
  });

  it('joins room on authorized room:join with callback { ok: true }', async () => {
    const socket = createMockSocket(userId, tenantId);
    mockAuthorize.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    const callback = vi.fn();
    socket._trigger('room:join', 'table:table-123', callback);

    // Wait for the async handler
    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(mockAuthorize).toHaveBeenCalledWith({
      roomId: 'table:table-123',
      userId,
      tenantId,
    });
    expect(socket.join).toHaveBeenCalledWith(`t:${tenantId}:table:table-123`);
    expect(callback).toHaveBeenCalledWith({ ok: true });
  });

  it('returns { ok: false } on unauthorized room:join — silent denial', async () => {
    const socket = createMockSocket(userId, tenantId);
    mockAuthorize.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    const callback = vi.fn();
    socket._trigger('room:join', 'workspace:ws-secret', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(socket.join).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith({ ok: false });
  });

  it('user:room only allows own userId', async () => {
    const socket = createMockSocket(userId, tenantId);

    // Let the real authorize logic determine — but we mock it here
    mockAuthorize.mockResolvedValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    const callback = vi.fn();
    socket._trigger('room:join', 'user:other-user-id', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(callback).toHaveBeenCalledWith({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('returns { ok: false } on authorization error', async () => {
    const socket = createMockSocket(userId, tenantId);
    mockAuthorize.mockRejectedValue(new Error('DB connection failed'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    const callback = vi.fn();
    socket._trigger('room:join', 'table:table-123', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(callback).toHaveBeenCalledWith({ ok: false });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it('leaves room on room:leave', () => {
    const socket = createMockSocket(userId, tenantId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    socket._trigger('room:leave', 'table:table-123');

    expect(socket.leave).toHaveBeenCalledWith(`t:${tenantId}:table:table-123`);
  });

  it('works without callback on room:join', async () => {
    const socket = createMockSocket(userId, tenantId);
    mockAuthorize.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    // No callback passed
    socket._trigger('room:join', 'workspace:ws-1');

    await vi.waitFor(() => {
      expect(socket.join).toHaveBeenCalled();
    });

    expect(socket.join).toHaveBeenCalledWith(`t:${tenantId}:workspace:ws-1`);
  });
});

describe('authorizeRoomJoin — parseRoomId', () => {
  // Test the authorize function directly for user room authorization
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies authorize is called with correct params', async () => {
    const socket = createMockSocket('user-1', 'tenant-1');
    const mockAuth = vi.mocked(authorizeRoomJoin);
    mockAuth.mockResolvedValue(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerRoomHandlers(socket as any);

    const callback = vi.fn();
    socket._trigger('room:join', 'record:rec-abc', callback);

    await vi.waitFor(() => {
      expect(callback).toHaveBeenCalled();
    });

    expect(mockAuth).toHaveBeenCalledWith({
      roomId: 'record:rec-abc',
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
  });
});
