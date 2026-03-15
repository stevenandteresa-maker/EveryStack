/**
 * Tests for PresenceService.
 *
 * Covers: TTL expiry, heartbeat refresh, DND state detection,
 * room presence listing, and tenant isolation on presence keys.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresenceService, buildPresenceKey } from '../presence-service';
import { CHAT_PRESENCE_STATES } from '../../types/chat';

// ---------------------------------------------------------------------------
// Mock Redis
// ---------------------------------------------------------------------------

function createMockRedis() {
  const store = new Map<string, { value: string; ttl: number }>();

  const redis = {
    setex: vi.fn(async (key: string, ttl: number, value: string) => {
      store.set(key, { value, ttl });
      return 'OK';
    }),
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      return entry ? entry.value : null;
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      const entry = store.get(key);
      if (entry) {
        entry.ttl = ttl;
        return 1;
      }
      return 0;
    }),
    scan: vi.fn(async (_cursor: string, ..._args: unknown[]) => {
      // Default: return empty. Tests override per-scenario.
      return ['0', [] as string[]];
    }),
    pipeline: vi.fn(() => {
      const commands: Array<{ cmd: string; args: unknown[] }> = [];
      const pipe = {
        get: (key: string) => {
          commands.push({ cmd: 'get', args: [key] });
          return pipe;
        },
        expire: (key: string, ttl: number) => {
          commands.push({ cmd: 'expire', args: [key, ttl] });
          return pipe;
        },
        exec: vi.fn(async () => {
          return commands.map((c) => {
            if (c.cmd === 'get') {
              const entry = store.get(c.args[0] as string);
              return [null, entry ? entry.value : null];
            }
            if (c.cmd === 'expire') {
              const entry = store.get(c.args[0] as string);
              if (entry) {
                entry.ttl = c.args[1] as number;
                return [null, 1];
              }
              return [null, 0];
            }
            return [null, null];
          });
        }),
      };
      return pipe;
    }),
    __store: store,
  };

  return redis;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildPresenceKey', () => {
  it('builds correct key format', () => {
    expect(buildPresenceKey('t1', 'thread:abc', 'u1')).toBe(
      'presence:t:t1:thread:abc:u1',
    );
  });
});

describe('PresenceService', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;
  let service: PresenceService;

  beforeEach(() => {
    mockRedis = createMockRedis();
    service = new PresenceService(
      mockRedis as unknown as ConstructorParameters<typeof PresenceService>[0],
    );
  });

  // -------------------------------------------------------------------------
  // setPresence
  // -------------------------------------------------------------------------

  describe('setPresence', () => {
    it('stores presence state in Redis with 60s TTL', async () => {
      await service.setPresence('tenant-1', 'thread:t1', 'user-1', 'online');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'presence:t:tenant-1:thread:t1:user-1',
        60,
        expect.any(String),
      );

      const stored = mockRedis.__store.get('presence:t:tenant-1:thread:t1:user-1');
      expect(stored).toBeDefined();
      expect(stored!.ttl).toBe(60);

      const value = JSON.parse(stored!.value);
      expect(value.state).toBe('online');
      expect(value.lastActiveAt).toBeGreaterThan(0);
    });

    it('stores DND state correctly', async () => {
      await service.setPresence('tenant-1', 'thread:t1', 'user-1', 'dnd');

      const stored = mockRedis.__store.get('presence:t:tenant-1:thread:t1:user-1');
      const value = JSON.parse(stored!.value);
      expect(value.state).toBe('dnd');
    });

    it('stores away state correctly', async () => {
      await service.setPresence('tenant-1', 'thread:t1', 'user-1', 'away');

      const stored = mockRedis.__store.get('presence:t:tenant-1:thread:t1:user-1');
      const value = JSON.parse(stored!.value);
      expect(value.state).toBe('away');
    });
  });

  // -------------------------------------------------------------------------
  // getPresence
  // -------------------------------------------------------------------------

  describe('getPresence', () => {
    it('returns all presence entries for a room', async () => {
      // Pre-populate store
      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      const key2 = 'presence:t:tenant-1:thread:t1:user-2';
      mockRedis.__store.set(key1, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 60,
      });
      mockRedis.__store.set(key2, {
        value: JSON.stringify({ state: 'dnd', lastActiveAt: 2000 }),
        ttl: 60,
      });

      // Mock scan to return these keys
      mockRedis.scan.mockResolvedValueOnce(['0', [key1, key2]]);

      const entries = await service.getPresence('tenant-1', 'thread:t1');

      expect(entries).toHaveLength(2);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', state: 'online' }),
          expect.objectContaining({ userId: 'user-2', state: 'dnd' }),
        ]),
      );
    });

    it('returns empty array when no users present', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const entries = await service.getPresence('tenant-1', 'thread:t1');
      expect(entries).toEqual([]);
    });

    it('skips malformed values', async () => {
      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      mockRedis.__store.set(key1, { value: 'not-json', ttl: 60 });
      mockRedis.scan.mockResolvedValueOnce(['0', [key1]]);

      const entries = await service.getPresence('tenant-1', 'thread:t1');
      expect(entries).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // heartbeat
  // -------------------------------------------------------------------------

  describe('heartbeat', () => {
    it('refreshes TTL on all user presence keys', async () => {
      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      const key2 = 'presence:t:tenant-1:thread:t2:user-1';
      mockRedis.__store.set(key1, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 30, // Simulating partially expired
      });
      mockRedis.__store.set(key2, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 25,
      });

      // Mock scan to return both keys
      mockRedis.scan.mockResolvedValueOnce(['0', [key1, key2]]);

      await service.heartbeat('tenant-1', 'user-1');

      // TTLs should be refreshed to 60
      expect(mockRedis.__store.get(key1)!.ttl).toBe(60);
      expect(mockRedis.__store.get(key2)!.ttl).toBe(60);
    });

    it('does nothing when no keys found', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await service.heartbeat('tenant-1', 'user-1');

      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getUserStatus
  // -------------------------------------------------------------------------

  describe('getUserStatus', () => {
    it('returns current state from any room key', async () => {
      const key = 'presence:t:tenant-1:thread:t1:user-1';
      mockRedis.__store.set(key, {
        value: JSON.stringify({ state: 'dnd', lastActiveAt: 1000 }),
        ttl: 60,
      });
      mockRedis.scan.mockResolvedValueOnce(['0', [key]]);

      const status = await service.getUserStatus('tenant-1', 'user-1');
      expect(status).toBe('dnd');
    });

    it('returns offline when no keys found', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const status = await service.getUserStatus('tenant-1', 'user-1');
      expect(status).toBe('offline');
    });

    it('returns offline when value is malformed', async () => {
      const key = 'presence:t:tenant-1:thread:t1:user-1';
      mockRedis.__store.set(key, { value: '{invalid', ttl: 60 });
      mockRedis.scan.mockResolvedValueOnce(['0', [key]]);

      const status = await service.getUserStatus('tenant-1', 'user-1');
      expect(status).toBe('offline');
    });

    it('detects DND state', async () => {
      const key = 'presence:t:tenant-1:thread:t1:user-1';
      mockRedis.__store.set(key, {
        value: JSON.stringify({ state: 'dnd', lastActiveAt: Date.now() }),
        ttl: 60,
      });
      mockRedis.scan.mockResolvedValueOnce(['0', [key]]);

      const status = await service.getUserStatus('tenant-1', 'user-1');
      expect(status).toBe(CHAT_PRESENCE_STATES.DND);
    });
  });

  // -------------------------------------------------------------------------
  // removePresence
  // -------------------------------------------------------------------------

  describe('removePresence', () => {
    it('deletes key immediately on disconnect', async () => {
      const key = 'presence:t:tenant-1:thread:t1:user-1';
      mockRedis.__store.set(key, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 60,
      });

      await service.removePresence('tenant-1', 'thread:t1', 'user-1');

      expect(mockRedis.del).toHaveBeenCalledWith(key);
      expect(mockRedis.__store.has(key)).toBe(false);
    });

    it('handles non-existent key gracefully', async () => {
      await service.removePresence('tenant-1', 'thread:t1', 'user-99');

      expect(mockRedis.del).toHaveBeenCalledWith(
        'presence:t:tenant-1:thread:t1:user-99',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('presence keys are scoped by tenantId', async () => {
      await service.setPresence('tenant-1', 'thread:t1', 'user-1', 'online');
      await service.setPresence('tenant-2', 'thread:t1', 'user-1', 'away');

      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      const key2 = 'presence:t:tenant-2:thread:t1:user-1';

      expect(mockRedis.__store.has(key1)).toBe(true);
      expect(mockRedis.__store.has(key2)).toBe(true);

      // Each tenant's presence is independent
      const val1 = JSON.parse(mockRedis.__store.get(key1)!.value);
      const val2 = JSON.parse(mockRedis.__store.get(key2)!.value);
      expect(val1.state).toBe('online');
      expect(val2.state).toBe('away');
    });

    it('getPresence only returns entries for the specified tenant+room', async () => {
      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      const key2 = 'presence:t:tenant-2:thread:t1:user-1';
      mockRedis.__store.set(key1, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 60,
      });
      mockRedis.__store.set(key2, {
        value: JSON.stringify({ state: 'away', lastActiveAt: 2000 }),
        ttl: 60,
      });

      // SCAN for tenant-1 only returns tenant-1 keys
      mockRedis.scan.mockResolvedValueOnce(['0', [key1]]);

      const entries = await service.getPresence('tenant-1', 'thread:t1');
      expect(entries).toHaveLength(1);
      expect(entries[0]!.userId).toBe('user-1');
      expect(entries[0]!.state).toBe('online');
    });

    it('heartbeat only refreshes keys for the specified tenant', async () => {
      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      const key2 = 'presence:t:tenant-2:thread:t1:user-1';
      mockRedis.__store.set(key1, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 20,
      });
      mockRedis.__store.set(key2, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 20,
      });

      // SCAN only returns tenant-1 keys
      mockRedis.scan.mockResolvedValueOnce(['0', [key1]]);

      await service.heartbeat('tenant-1', 'user-1');

      // Only tenant-1 key gets refreshed
      expect(mockRedis.__store.get(key1)!.ttl).toBe(60);
      expect(mockRedis.__store.get(key2)!.ttl).toBe(20); // Unchanged
    });
  });

  // -------------------------------------------------------------------------
  // TTL expiry behavior
  // -------------------------------------------------------------------------

  describe('TTL expiry', () => {
    it('presence keys are set with 60s TTL', async () => {
      await service.setPresence('tenant-1', 'thread:t1', 'user-1', 'online');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.any(String),
        60,
        expect.any(String),
      );
    });

    it('user appears offline when keys have expired (no keys found)', async () => {
      // No keys in store (simulating TTL expiry)
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      const status = await service.getUserStatus('tenant-1', 'user-1');
      expect(status).toBe('offline');
    });
  });

  // -------------------------------------------------------------------------
  // Multi-cursor SCAN
  // -------------------------------------------------------------------------

  describe('SCAN pagination', () => {
    it('handles multi-cursor SCAN results', async () => {
      const key1 = 'presence:t:tenant-1:thread:t1:user-1';
      const key2 = 'presence:t:tenant-1:thread:t1:user-2';
      mockRedis.__store.set(key1, {
        value: JSON.stringify({ state: 'online', lastActiveAt: 1000 }),
        ttl: 60,
      });
      mockRedis.__store.set(key2, {
        value: JSON.stringify({ state: 'away', lastActiveAt: 2000 }),
        ttl: 60,
      });

      // Simulate multi-page SCAN: first page returns cursor '5' and key1,
      // second page returns cursor '0' (done) and key2
      mockRedis.scan
        .mockResolvedValueOnce(['5', [key1]])
        .mockResolvedValueOnce(['0', [key2]]);

      const entries = await service.getPresence('tenant-1', 'thread:t1');
      expect(entries).toHaveLength(2);
      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
    });
  });
});
