/**
 * Tests for field-level lock handler.
 *
 * @see docs/reference/tables-and-views.md § Field-Level Presence & Locking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildLockKey, registerLockHandlers, type FieldLockData } from '../lock-handler';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/logging', () => ({
  realtimeLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

function createMockSocket(userId = 'user-1', tenantId = 'tenant-1') {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const rooms = new Set<string>();
  rooms.add(`t:${tenantId}:table:table-1`);
  rooms.add(`socket-id-123`);

  return {
    id: 'socket-id-123',
    data: { userId, tenantId },
    rooms,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler);
    }),
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
    __listeners: listeners,
    __trigger(event: string, ...args: unknown[]) {
      const handler = listeners.get(event);
      handler?.(...args);
    },
  };
}

function createMockIo() {
  return {
    to: vi.fn(() => ({
      emit: vi.fn(),
    })),
    sockets: {
      adapter: {
        rooms: new Map([
          ['t:tenant-1:table:table-1', new Set(['socket-1'])],
        ]),
      },
    },
  };
}

function createMockRedis() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      // Handle NX flag
      if (args.includes('NX') && store.has(key)) {
        return null;
      }
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
      return 1;
    }),
    expire: vi.fn(async () => 1),
    sadd: vi.fn(async (key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return 1;
    }),
    srem: vi.fn(async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return 1;
    }),
    smembers: vi.fn(async (key: string) => Array.from(sets.get(key) ?? [])),
    __store: store,
    __sets: sets,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildLockKey', () => {
  it('should build correct key format', () => {
    expect(buildLockKey('t1', 'r1', 'f1')).toBe('lock:t1:r1:f1');
  });
});

describe('registerLockHandlers', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;
  let mockIo: ReturnType<typeof createMockIo>;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    mockSocket = createMockSocket();
    mockIo = createMockIo();
    mockRedis = createMockRedis();
  });

  it('should register field:lock, field:unlock, field:lock_renewed, and disconnect handlers', () => {
    registerLockHandlers(
      mockSocket as unknown as Parameters<typeof registerLockHandlers>[0],
      mockIo as unknown as Parameters<typeof registerLockHandlers>[1],
      mockRedis as unknown as Parameters<typeof registerLockHandlers>[2],
    );

    expect(mockSocket.on).toHaveBeenCalledWith('field:lock', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('field:unlock', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('field:lock_renewed', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  describe('field:lock', () => {
    beforeEach(() => {
      registerLockHandlers(
        mockSocket as unknown as Parameters<typeof registerLockHandlers>[0],
        mockIo as unknown as Parameters<typeof registerLockHandlers>[1],
        mockRedis as unknown as Parameters<typeof registerLockHandlers>[2],
      );
    });

    it('should acquire a lock when no existing lock', async () => {
      const callback = vi.fn();

      await new Promise<void>((resolve) => {
        callback.mockImplementation(() => resolve());
        mockSocket.__trigger('field:lock', {
          tenantId: 'tenant-1',
          recordId: 'rec-1',
          fieldId: 'fld-1',
          userName: 'Alice',
          avatarUrl: 'https://example.com/alice.jpg',
        }, callback);
      });

      expect(callback).toHaveBeenCalledWith({ ok: true });
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lock:tenant-1:rec-1:fld-1',
        expect.any(String),
        'EX',
        60,
        'NX',
      );
    });

    it('should reject lock when held by another user', async () => {
      // Pre-populate the lock
      const existingLock: FieldLockData = {
        userId: 'user-2',
        userName: 'Bob',
        avatarUrl: '',
        timestamp: Date.now(),
        socketId: 'other-socket',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(existingLock));

      const callback = vi.fn();

      await new Promise<void>((resolve) => {
        callback.mockImplementation(() => resolve());
        mockSocket.__trigger('field:lock', {
          tenantId: 'tenant-1',
          recordId: 'rec-1',
          fieldId: 'fld-1',
          userName: 'Alice',
          avatarUrl: '',
        }, callback);
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ ok: false }),
      );
    });

    it('should re-acquire lock if same user (idempotent)', async () => {
      // Pre-populate with same user's lock
      const existingLock: FieldLockData = {
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: '',
        timestamp: Date.now() - 10_000,
        socketId: 'old-socket',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(existingLock));

      const callback = vi.fn();

      await new Promise<void>((resolve) => {
        callback.mockImplementation(() => resolve());
        mockSocket.__trigger('field:lock', {
          tenantId: 'tenant-1',
          recordId: 'rec-1',
          fieldId: 'fld-1',
          userName: 'Alice',
          avatarUrl: '',
        }, callback);
      });

      expect(callback).toHaveBeenCalledWith({ ok: true });
    });

    it('should track lock in socket locks set', async () => {
      const callback = vi.fn();

      await new Promise<void>((resolve) => {
        callback.mockImplementation(() => resolve());
        mockSocket.__trigger('field:lock', {
          tenantId: 'tenant-1',
          recordId: 'rec-1',
          fieldId: 'fld-1',
          userName: 'Alice',
          avatarUrl: '',
        }, callback);
      });

      expect(mockRedis.sadd).toHaveBeenCalledWith(
        'socket_locks:socket-id-123',
        'lock:tenant-1:rec-1:fld-1',
      );
    });

    it('should broadcast FIELD_LOCKED to table room', async () => {
      const emitFn = vi.fn();
      mockSocket.to.mockReturnValue({ emit: emitFn });

      const callback = vi.fn();

      await new Promise<void>((resolve) => {
        callback.mockImplementation(() => resolve());
        mockSocket.__trigger('field:lock', {
          tenantId: 'tenant-1',
          recordId: 'rec-1',
          fieldId: 'fld-1',
          userName: 'Alice',
          avatarUrl: '',
        }, callback);
      });

      expect(mockSocket.to).toHaveBeenCalled();
      expect(emitFn).toHaveBeenCalledWith(
        REALTIME_EVENTS.FIELD_LOCKED,
        expect.objectContaining({
          recordId: 'rec-1',
          fieldId: 'fld-1',
        }),
      );
    });
  });

  describe('field:unlock', () => {
    beforeEach(() => {
      registerLockHandlers(
        mockSocket as unknown as Parameters<typeof registerLockHandlers>[0],
        mockIo as unknown as Parameters<typeof registerLockHandlers>[1],
        mockRedis as unknown as Parameters<typeof registerLockHandlers>[2],
      );
    });

    it('should release lock held by current user', async () => {
      // Pre-populate
      const lockData: FieldLockData = {
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: '',
        timestamp: Date.now(),
        socketId: 'socket-id-123',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(lockData));

      mockSocket.__trigger('field:unlock', {
        tenantId: 'tenant-1',
        recordId: 'rec-1',
        fieldId: 'fld-1',
      });

      // Wait for async operations
      await vi.waitFor(() => {
        expect(mockRedis.del).toHaveBeenCalledWith('lock:tenant-1:rec-1:fld-1');
      });
    });

    it('should not release lock held by another user', async () => {
      const lockData: FieldLockData = {
        userId: 'user-2',
        userName: 'Bob',
        avatarUrl: '',
        timestamp: Date.now(),
        socketId: 'other-socket',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(lockData));

      mockSocket.__trigger('field:unlock', {
        tenantId: 'tenant-1',
        recordId: 'rec-1',
        fieldId: 'fld-1',
      });

      // Give async a chance to run
      await new Promise((r) => setTimeout(r, 10));

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should broadcast FIELD_UNLOCKED to table rooms', async () => {
      const emitFn = vi.fn();
      mockSocket.to.mockReturnValue({ emit: emitFn });

      const lockData: FieldLockData = {
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: '',
        timestamp: Date.now(),
        socketId: 'socket-id-123',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(lockData));

      mockSocket.__trigger('field:unlock', {
        tenantId: 'tenant-1',
        recordId: 'rec-1',
        fieldId: 'fld-1',
      });

      await vi.waitFor(() => {
        expect(emitFn).toHaveBeenCalledWith(
          REALTIME_EVENTS.FIELD_UNLOCKED,
          expect.objectContaining({
            recordId: 'rec-1',
            fieldId: 'fld-1',
            userId: 'user-1',
          }),
        );
      });
    });
  });

  describe('field:lock_renewed', () => {
    beforeEach(() => {
      registerLockHandlers(
        mockSocket as unknown as Parameters<typeof registerLockHandlers>[0],
        mockIo as unknown as Parameters<typeof registerLockHandlers>[1],
        mockRedis as unknown as Parameters<typeof registerLockHandlers>[2],
      );
    });

    it('should renew TTL for lock held by current user', async () => {
      const lockData: FieldLockData = {
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: '',
        timestamp: Date.now() - 30_000,
        socketId: 'socket-id-123',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(lockData));

      mockSocket.__trigger('field:lock_renewed', {
        tenantId: 'tenant-1',
        recordId: 'rec-1',
        fieldId: 'fld-1',
      });

      await vi.waitFor(() => {
        // Should have called set with EX to renew TTL
        const setCalls = mockRedis.set.mock.calls;
        const renewCall = setCalls.find(
          (call: unknown[]) => call[0] === 'lock:tenant-1:rec-1:fld-1' && call[2] === 'EX',
        );
        expect(renewCall).toBeDefined();
      });
    });

    it('should not renew lock held by another user', async () => {
      const lockData: FieldLockData = {
        userId: 'user-2',
        userName: 'Bob',
        avatarUrl: '',
        timestamp: Date.now(),
        socketId: 'other-socket',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(lockData));

      mockSocket.__trigger('field:lock_renewed', {
        tenantId: 'tenant-1',
        recordId: 'rec-1',
        fieldId: 'fld-1',
      });

      await new Promise((r) => setTimeout(r, 10));

      // set should not have been called (only the initial pre-population)
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('disconnect cleanup', () => {
    it('should clean up all locks held by disconnecting socket', async () => {
      registerLockHandlers(
        mockSocket as unknown as Parameters<typeof registerLockHandlers>[0],
        mockIo as unknown as Parameters<typeof registerLockHandlers>[1],
        mockRedis as unknown as Parameters<typeof registerLockHandlers>[2],
      );

      // Pre-populate socket locks
      const lockData: FieldLockData = {
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: '',
        timestamp: Date.now(),
        socketId: 'socket-id-123',
      };
      mockRedis.__store.set('lock:tenant-1:rec-1:fld-1', JSON.stringify(lockData));
      mockRedis.__store.set('lock:tenant-1:rec-2:fld-2', JSON.stringify(lockData));
      mockRedis.__sets.set('socket_locks:socket-id-123', new Set([
        'lock:tenant-1:rec-1:fld-1',
        'lock:tenant-1:rec-2:fld-2',
      ]));

      mockSocket.__trigger('disconnect');

      await vi.waitFor(() => {
        expect(mockRedis.del).toHaveBeenCalledWith('lock:tenant-1:rec-1:fld-1');
        expect(mockRedis.del).toHaveBeenCalledWith('lock:tenant-1:rec-2:fld-2');
        // Also deletes the tracking set
        expect(mockRedis.del).toHaveBeenCalledWith('socket_locks:socket-id-123');
      });
    });
  });
});
