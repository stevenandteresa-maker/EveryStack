import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocketIORealtimeService } from '../socket-io-realtime-service';

// Mock the logger to capture warnings
vi.mock('@everystack/shared/logging', () => ({
  realtimeLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

/** Create a minimal mock Socket.io Server for testing. */
function createMockIO() {
  const mockSocket = {
    data: { userId: 'user-1', joinedAt: 1000 },
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn(),
    emit: vi.fn(),
  };

  const mockSocket2 = {
    data: { userId: 'user-2', joinedAt: 2000 },
    join: vi.fn().mockResolvedValue(undefined),
    leave: vi.fn(),
    emit: vi.fn(),
  };

  const io = {
    fetchSockets: vi.fn().mockResolvedValue([mockSocket, mockSocket2]),
    to: vi.fn().mockReturnValue({
      emit: vi.fn(),
    }),
    in: vi.fn().mockReturnValue({
      fetchSockets: vi.fn().mockResolvedValue([mockSocket, mockSocket2]),
    }),
    emit: vi.fn(),
  };

  return { io, mockSocket, mockSocket2 };
}

describe('SocketIORealtimeService', () => {
  let service: SocketIORealtimeService;
  let mocks: ReturnType<typeof createMockIO>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks = createMockIO();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new SocketIORealtimeService(mocks.io as any);
  });

  describe('emitToRoom', () => {
    it('emits to the specified room via io.to()', async () => {
      const tenantRoom = 't:tenant-abc:table:123';
      await service.emitToRoom(tenantRoom, 'record.updated', {
        id: 'rec-1',
      });

      expect(mocks.io.to).toHaveBeenCalledWith(tenantRoom);
      expect(mocks.io.to(tenantRoom).emit).toHaveBeenCalledWith(
        'record.updated',
        { id: 'rec-1' },
      );
    });

    it('uses tenant prefix in room names for isolation', async () => {
      const tenantId = 'tenant-xyz';
      const roomId = `t:${tenantId}:record:456`;

      await service.emitToRoom(roomId, 'record.created', { id: 'rec-2' });

      expect(mocks.io.to).toHaveBeenCalledWith(
        expect.stringContaining(`t:${tenantId}:`),
      );
    });
  });

  describe('joinRoom', () => {
    it('joins matching sockets to the room', async () => {
      await service.joinRoom('t:tenant-1:table:abc', 'user-1');

      expect(mocks.mockSocket.join).toHaveBeenCalledWith(
        't:tenant-1:table:abc',
      );
      // user-2 should NOT be joined (different userId)
      expect(mocks.mockSocket2.join).not.toHaveBeenCalled();
    });
  });

  describe('leaveRoom', () => {
    it('removes matching sockets from the room', async () => {
      await service.leaveRoom('t:tenant-1:table:abc', 'user-1');

      expect(mocks.mockSocket.leave).toHaveBeenCalledWith(
        't:tenant-1:table:abc',
      );
      expect(mocks.mockSocket2.leave).not.toHaveBeenCalled();
    });
  });

  describe('getRoomMembers', () => {
    it('returns deduplicated room members', async () => {
      const members = await service.getRoomMembers('t:tenant-1:table:abc');

      expect(members).toHaveLength(2);
      expect(members[0]?.userId).toBe('user-1');
      expect(members[1]?.userId).toBe('user-2');
    });
  });

  describe('emitToUser', () => {
    it('emits to the user personal room', async () => {
      await service.emitToUser('user-1', 'notification.created', {
        text: 'hello',
      });

      expect(mocks.io.to).toHaveBeenCalledWith('user:user-1');
    });
  });

  describe('broadcast', () => {
    it('broadcasts to all connected clients', async () => {
      await service.broadcast('sync.completed', { tableId: 'tbl-1' });

      expect(mocks.io.emit).toHaveBeenCalledWith('sync.completed', {
        tableId: 'tbl-1',
      });
    });

    it('excludes specified user when broadcasting', async () => {
      await service.broadcast(
        'sync.completed',
        { tableId: 'tbl-1' },
        'user-1',
      );

      // user-1 should NOT receive the emit
      expect(mocks.mockSocket.emit).not.toHaveBeenCalled();
      // user-2 should receive the emit
      expect(mocks.mockSocket2.emit).toHaveBeenCalledWith('sync.completed', {
        tableId: 'tbl-1',
      });
    });
  });

  describe('setPresence', () => {
    it('logs a warning that it is a stub', async () => {
      const { realtimeLogger } = await import(
        '@everystack/shared/logging'
      );

      await service.setPresence('room-1', 'user-1', {
        userId: 'user-1',
        status: 'active',
        lastActiveAt: Date.now(),
      });

      expect(realtimeLogger.warn).toHaveBeenCalledWith(
        'setPresence is a stub — not yet implemented',
      );
    });
  });

  describe('getPresence', () => {
    it('returns empty array and logs warning', async () => {
      const { realtimeLogger } = await import(
        '@everystack/shared/logging'
      );

      const result = await service.getPresence('room-1');

      expect(result).toEqual([]);
      expect(realtimeLogger.warn).toHaveBeenCalledWith(
        'getPresence is a stub — not yet implemented',
      );
    });
  });
});
