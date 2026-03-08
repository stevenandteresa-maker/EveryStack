import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  evaluatePriority,
  getRateLimitCapacity,
  getNextTenantForPlatform,
  isTenantWithinBudget,
  recordTenantUsage,
  visibilityToPriority,
} from '../priority-scheduler';
import {
  SyncPriority,
  PRIORITY_CAPACITY_THRESHOLDS,
  MAX_TENANT_CAPACITY_PERCENT,
} from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRedis(overrides?: Partial<Redis>): Redis {
  return {
    eval: vi.fn().mockResolvedValue([0, 5]),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zcard: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    ...overrides,
  } as unknown as Redis;
}

// ---------------------------------------------------------------------------
// evaluatePriority
// ---------------------------------------------------------------------------

describe('evaluatePriority', () => {
  describe('P0 (Critical)', () => {
    it('always dispatches at 100% capacity', () => {
      const result = evaluatePriority(SyncPriority.P0_CRITICAL, 100);
      expect(result.dispatch).toBe(true);
    });

    it('always dispatches at 0% capacity', () => {
      const result = evaluatePriority(SyncPriority.P0_CRITICAL, 0);
      expect(result.dispatch).toBe(true);
    });

    it('always dispatches at 10% capacity', () => {
      const result = evaluatePriority(SyncPriority.P0_CRITICAL, 10);
      expect(result.dispatch).toBe(true);
    });
  });

  describe('P1 (Active)', () => {
    it('dispatches when capacity >30%', () => {
      const result = evaluatePriority(SyncPriority.P1_ACTIVE, 31);
      expect(result.dispatch).toBe(true);
    });

    it('dispatches when capacity is 100%', () => {
      const result = evaluatePriority(SyncPriority.P1_ACTIVE, 100);
      expect(result.dispatch).toBe(true);
    });

    it('delays (not skips) when capacity <=30%', () => {
      const result = evaluatePriority(SyncPriority.P1_ACTIVE, 30);
      expect(result.dispatch).toBe(false);
      expect(result.delay).toBeGreaterThan(0);
      expect(result.reason).toContain('delayed');
    });

    it('delays at 0% capacity', () => {
      const result = evaluatePriority(SyncPriority.P1_ACTIVE, 0);
      expect(result.dispatch).toBe(false);
      expect(result.delay).toBeDefined();
    });
  });

  describe('P2 (Background)', () => {
    it('dispatches when capacity >50%', () => {
      const result = evaluatePriority(SyncPriority.P2_BACKGROUND, 51);
      expect(result.dispatch).toBe(true);
    });

    it('skips (no delay) when capacity <=50%', () => {
      const result = evaluatePriority(SyncPriority.P2_BACKGROUND, 50);
      expect(result.dispatch).toBe(false);
      expect(result.delay).toBeUndefined();
      expect(result.reason).toContain('skipped');
    });

    it('skips at 0% capacity', () => {
      const result = evaluatePriority(SyncPriority.P2_BACKGROUND, 0);
      expect(result.dispatch).toBe(false);
    });
  });

  describe('P3 (Inactive)', () => {
    it('dispatches when capacity >70%', () => {
      const result = evaluatePriority(SyncPriority.P3_INACTIVE, 71);
      expect(result.dispatch).toBe(true);
    });

    it('skips when capacity <=70%', () => {
      const result = evaluatePriority(SyncPriority.P3_INACTIVE, 70);
      expect(result.dispatch).toBe(false);
      expect(result.reason).toContain('skipped');
    });

    it('skips at 50% capacity', () => {
      const result = evaluatePriority(SyncPriority.P3_INACTIVE, 50);
      expect(result.dispatch).toBe(false);
    });
  });

  describe('boundary conditions', () => {
    it('P1 at exactly 30% is delayed', () => {
      expect(evaluatePriority(SyncPriority.P1_ACTIVE, 30).dispatch).toBe(false);
    });

    it('P1 at 31% is dispatched', () => {
      expect(evaluatePriority(SyncPriority.P1_ACTIVE, 31).dispatch).toBe(true);
    });

    it('P2 at exactly 50% is skipped', () => {
      expect(evaluatePriority(SyncPriority.P2_BACKGROUND, 50).dispatch).toBe(false);
    });

    it('P2 at 51% is dispatched', () => {
      expect(evaluatePriority(SyncPriority.P2_BACKGROUND, 51).dispatch).toBe(true);
    });

    it('P3 at exactly 70% is skipped', () => {
      expect(evaluatePriority(SyncPriority.P3_INACTIVE, 70).dispatch).toBe(false);
    });

    it('P3 at 71% is dispatched', () => {
      expect(evaluatePriority(SyncPriority.P3_INACTIVE, 71).dispatch).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// PRIORITY_CAPACITY_THRESHOLDS
// ---------------------------------------------------------------------------

describe('PRIORITY_CAPACITY_THRESHOLDS', () => {
  it('P0 has threshold 0 (always dispatched)', () => {
    expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P0_CRITICAL]).toBe(0);
  });

  it('P1 threshold is 30%', () => {
    expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P1_ACTIVE]).toBe(30);
  });

  it('P2 threshold is 50%', () => {
    expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P2_BACKGROUND]).toBe(50);
  });

  it('P3 threshold is 70%', () => {
    expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P3_INACTIVE]).toBe(70);
  });
});

describe('MAX_TENANT_CAPACITY_PERCENT', () => {
  it('is 20%', () => {
    expect(MAX_TENANT_CAPACITY_PERCENT).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// getRateLimitCapacity
// ---------------------------------------------------------------------------

describe('getRateLimitCapacity', () => {
  it('returns 100% when no tokens consumed', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockResolvedValue([0, 5]),
    });

    const capacity = await getRateLimitCapacity(redis, 'airtable', 'base:app123', 5, 1);
    expect(capacity).toBe(100);
  });

  it('returns 60% when 2 of 5 tokens consumed', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockResolvedValue([2, 5]),
    });

    const capacity = await getRateLimitCapacity(redis, 'airtable', 'base:app123', 5, 1);
    expect(capacity).toBe(60);
  });

  it('returns 0% when all tokens consumed', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockResolvedValue([5, 5]),
    });

    const capacity = await getRateLimitCapacity(redis, 'airtable', 'base:app123', 5, 1);
    expect(capacity).toBe(0);
  });

  it('returns 0% when over limit', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockResolvedValue([7, 5]),
    });

    const capacity = await getRateLimitCapacity(redis, 'airtable', 'base:app123', 5, 1);
    expect(capacity).toBe(0);
  });

  it('returns 100% when maxRequests is 0', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockResolvedValue([0, 0]),
    });

    const capacity = await getRateLimitCapacity(redis, 'airtable', 'base:app123', 0, 1);
    expect(capacity).toBe(100);
  });

  it('constructs correct Redis key', async () => {
    const evalFn = vi.fn().mockResolvedValue([0, 3]);
    const redis = createMockRedis({ eval: evalFn });

    await getRateLimitCapacity(redis, 'notion', 'integration:int123', 3, 1);

    expect(evalFn).toHaveBeenCalledWith(
      expect.any(String), // Lua script
      1,
      'ratelimit:notion:integration:int123',
      3,
      1000,
      expect.any(Number), // nowMs
    );
  });

  it('fails open (returns 100%) on Redis error', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockRejectedValue(new Error('Redis down')),
    });

    const capacity = await getRateLimitCapacity(redis, 'airtable', 'base:app123', 5, 1);
    expect(capacity).toBe(100);
  });

  it('rounds capacity to nearest integer', async () => {
    const redis = createMockRedis({
      eval: vi.fn().mockResolvedValue([1, 3]),
    });

    const capacity = await getRateLimitCapacity(redis, 'notion', 'integration:int123', 3, 1);
    expect(capacity).toBe(67); // (2/3) * 100 = 66.67 → 67
  });
});

// ---------------------------------------------------------------------------
// getNextTenantForPlatform (round-robin)
// ---------------------------------------------------------------------------

describe('getNextTenantForPlatform', () => {
  let redis: Redis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('returns null for empty tenant list', async () => {
    const result = await getNextTenantForPlatform(redis, 'airtable', SyncPriority.P1_ACTIVE, []);
    expect(result).toBeNull();
  });

  it('returns first tenant for P0 (bypasses round-robin)', async () => {
    const result = await getNextTenantForPlatform(
      redis,
      'airtable',
      SyncPriority.P0_CRITICAL,
      ['tenant-a', 'tenant-b', 'tenant-c'],
    );
    expect(result).toBe('tenant-a');
    // Should not touch Redis for P0
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('cycles through tenants using round-robin for P1', async () => {
    const tenants = ['tenant-a', 'tenant-b', 'tenant-c'];

    // First call: incr returns 1 → index 0
    (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1);
    const first = await getNextTenantForPlatform(redis, 'airtable', SyncPriority.P1_ACTIVE, tenants);
    expect(first).toBe('tenant-a');

    // Second call: incr returns 2 → index 1
    (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValueOnce(2);
    const second = await getNextTenantForPlatform(redis, 'airtable', SyncPriority.P1_ACTIVE, tenants);
    expect(second).toBe('tenant-b');

    // Third call: incr returns 3 → index 2
    (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValueOnce(3);
    const third = await getNextTenantForPlatform(redis, 'airtable', SyncPriority.P1_ACTIVE, tenants);
    expect(third).toBe('tenant-c');

    // Fourth call: wraps around → index 0
    (redis.incr as ReturnType<typeof vi.fn>).mockResolvedValueOnce(4);
    const fourth = await getNextTenantForPlatform(redis, 'airtable', SyncPriority.P1_ACTIVE, tenants);
    expect(fourth).toBe('tenant-a');
  });

  it('uses platform-specific Redis keys for round-robin', async () => {
    await getNextTenantForPlatform(redis, 'notion', SyncPriority.P2_BACKGROUND, ['t1']);
    expect(redis.incr).toHaveBeenCalledWith('sync:rr:notion:2');
  });

  it('sets TTL on the round-robin key', async () => {
    await getNextTenantForPlatform(redis, 'airtable', SyncPriority.P1_ACTIVE, ['t1']);
    expect(redis.expire).toHaveBeenCalledWith('sync:rr:airtable:1', 3600);
  });
});

// ---------------------------------------------------------------------------
// isTenantWithinBudget
// ---------------------------------------------------------------------------

describe('isTenantWithinBudget', () => {
  let redis: Redis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('always returns true for P0 (exempt from budget)', async () => {
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 5, 1, SyncPriority.P0_CRITICAL);
    expect(result).toBe(true);
    expect(redis.zcard).not.toHaveBeenCalled();
  });

  it('returns true when tenant usage is within budget', async () => {
    // maxRequests=5, 20% budget = 1 request. Current usage = 0.
    (redis.zcard as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 5, 1, SyncPriority.P1_ACTIVE);
    expect(result).toBe(true);
  });

  it('returns false when tenant usage exceeds budget', async () => {
    // maxRequests=5, 20% budget = 1 request. Current usage = 1.
    (redis.zcard as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 5, 1, SyncPriority.P1_ACTIVE);
    expect(result).toBe(false);
  });

  it('cleans up expired entries before checking', async () => {
    await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 5, 1, SyncPriority.P2_BACKGROUND);
    expect(redis.zremrangebyscore).toHaveBeenCalledWith(
      'sync:tenant_usage:airtable:tenant-1',
      '-inf',
      expect.any(String),
    );
  });

  it('allows at least 1 request even for very low maxRequests', async () => {
    // maxRequests=1, 20% budget = 0.2 → floor to 0 → clamped to 1. Current usage = 0.
    (redis.zcard as ReturnType<typeof vi.fn>).mockResolvedValue(0);
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 1, 1, SyncPriority.P1_ACTIVE);
    expect(result).toBe(true);
  });

  it('rejects tenant when at minimum budget of 1', async () => {
    // maxRequests=1, budget clamped to 1. Current usage = 1.
    (redis.zcard as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 1, 1, SyncPriority.P1_ACTIVE);
    expect(result).toBe(false);
  });

  it('allows higher budgets with larger maxRequests', async () => {
    // maxRequests=50, 20% budget = 10. Current usage = 5.
    (redis.zcard as ReturnType<typeof vi.fn>).mockResolvedValue(5);
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 50, 1, SyncPriority.P1_ACTIVE);
    expect(result).toBe(true);
  });

  it('fails open on Redis error', async () => {
    (redis.zremrangebyscore as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Redis error'));
    const result = await isTenantWithinBudget(redis, 'airtable', 'tenant-1', 5, 1, SyncPriority.P1_ACTIVE);
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// recordTenantUsage
// ---------------------------------------------------------------------------

describe('recordTenantUsage', () => {
  it('adds entry to ZSET with correct key', async () => {
    const redis = createMockRedis();
    await recordTenantUsage(redis, 'notion', 'tenant-1', 1);

    expect(redis.zadd).toHaveBeenCalledWith(
      'sync:tenant_usage:notion:tenant-1',
      expect.any(String), // score (timestamp)
      expect.any(String), // member (timestamp:random)
    );
  });

  it('sets TTL on the usage key', async () => {
    const redis = createMockRedis();
    await recordTenantUsage(redis, 'airtable', 'tenant-1', 1);

    expect(redis.expire).toHaveBeenCalledWith(
      'sync:tenant_usage:airtable:tenant-1',
      11, // windowSeconds + 10
    );
  });

  it('does not throw on Redis error', async () => {
    const redis = createMockRedis({
      zadd: vi.fn().mockRejectedValue(new Error('Redis error')),
    });
    // Should not throw
    await expect(recordTenantUsage(redis, 'airtable', 'tenant-1', 1)).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// visibilityToPriority
// ---------------------------------------------------------------------------

describe('visibilityToPriority', () => {
  it('maps active → P1_ACTIVE', () => {
    expect(visibilityToPriority('active')).toBe(SyncPriority.P1_ACTIVE);
  });

  it('maps background → P2_BACKGROUND', () => {
    expect(visibilityToPriority('background')).toBe(SyncPriority.P2_BACKGROUND);
  });

  it('maps inactive → P3_INACTIVE', () => {
    expect(visibilityToPriority('inactive')).toBe(SyncPriority.P3_INACTIVE);
  });
});

// ---------------------------------------------------------------------------
// SyncPriority enum
// ---------------------------------------------------------------------------

describe('SyncPriority enum', () => {
  it('has four tiers', () => {
    expect(SyncPriority.P0_CRITICAL).toBe(0);
    expect(SyncPriority.P1_ACTIVE).toBe(1);
    expect(SyncPriority.P2_BACKGROUND).toBe(2);
    expect(SyncPriority.P3_INACTIVE).toBe(3);
  });

  it('lower number = higher priority', () => {
    expect(SyncPriority.P0_CRITICAL).toBeLessThan(SyncPriority.P1_ACTIVE);
    expect(SyncPriority.P1_ACTIVE).toBeLessThan(SyncPriority.P2_BACKGROUND);
    expect(SyncPriority.P2_BACKGROUND).toBeLessThan(SyncPriority.P3_INACTIVE);
  });
});

// ---------------------------------------------------------------------------
// Integration-style test: priority under capacity pressure
// ---------------------------------------------------------------------------

describe('priority scheduling under capacity pressure', () => {
  it('P0 dispatches while P3 is skipped at low capacity', () => {
    const capacity = 20; // Low capacity

    const p0 = evaluatePriority(SyncPriority.P0_CRITICAL, capacity);
    const p1 = evaluatePriority(SyncPriority.P1_ACTIVE, capacity);
    const p2 = evaluatePriority(SyncPriority.P2_BACKGROUND, capacity);
    const p3 = evaluatePriority(SyncPriority.P3_INACTIVE, capacity);

    expect(p0.dispatch).toBe(true);  // P0 always goes
    expect(p1.dispatch).toBe(false); // P1 delayed at <30%
    expect(p2.dispatch).toBe(false); // P2 skipped at <50%
    expect(p3.dispatch).toBe(false); // P3 skipped at <70%
  });

  it('P0 and P1 dispatch at moderate capacity, P2 and P3 throttled', () => {
    const capacity = 40;

    const p0 = evaluatePriority(SyncPriority.P0_CRITICAL, capacity);
    const p1 = evaluatePriority(SyncPriority.P1_ACTIVE, capacity);
    const p2 = evaluatePriority(SyncPriority.P2_BACKGROUND, capacity);
    const p3 = evaluatePriority(SyncPriority.P3_INACTIVE, capacity);

    expect(p0.dispatch).toBe(true);
    expect(p1.dispatch).toBe(true);
    expect(p2.dispatch).toBe(false);
    expect(p3.dispatch).toBe(false);
  });

  it('all tiers dispatch at high capacity', () => {
    const capacity = 80;

    const p0 = evaluatePriority(SyncPriority.P0_CRITICAL, capacity);
    const p1 = evaluatePriority(SyncPriority.P1_ACTIVE, capacity);
    const p2 = evaluatePriority(SyncPriority.P2_BACKGROUND, capacity);
    const p3 = evaluatePriority(SyncPriority.P3_INACTIVE, capacity);

    expect(p0.dispatch).toBe(true);
    expect(p1.dispatch).toBe(true);
    expect(p2.dispatch).toBe(true);
    expect(p3.dispatch).toBe(true);
  });
});
