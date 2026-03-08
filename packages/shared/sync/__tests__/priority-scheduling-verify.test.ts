/**
 * Priority Scheduling Verification
 *
 * Integration checkpoint test: simulate rate limit pressure scenarios and
 * confirm P0 always passes through while P1–P3 are throttled at correct
 * capacity thresholds. Also verifies per-tenant 20% budget enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Mocks
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
// Imports (after mocks)
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
// Tests
// ---------------------------------------------------------------------------

describe('Priority Scheduling Verification', () => {
  describe('Scenario 1: Extreme rate limit pressure (5% capacity remaining)', () => {
    const capacity = 5;

    it('P0 (outbound sync, webhooks) always dispatches', () => {
      const result = evaluatePriority(SyncPriority.P0_CRITICAL, capacity);
      expect(result.dispatch).toBe(true);
    });

    it('P1 (active table polling) is delayed, not skipped', () => {
      const result = evaluatePriority(SyncPriority.P1_ACTIVE, capacity);
      expect(result.dispatch).toBe(false);
      expect(result.delay).toBeGreaterThan(0);
      expect(result.reason).toContain('delayed');
    });

    it('P2 (background polling) is skipped', () => {
      const result = evaluatePriority(SyncPriority.P2_BACKGROUND, capacity);
      expect(result.dispatch).toBe(false);
      expect(result.delay).toBeUndefined();
      expect(result.reason).toContain('skipped');
    });

    it('P3 (inactive polling) is skipped', () => {
      const result = evaluatePriority(SyncPriority.P3_INACTIVE, capacity);
      expect(result.dispatch).toBe(false);
      expect(result.delay).toBeUndefined();
    });
  });

  describe('Scenario 2: Moderate pressure (40% capacity remaining)', () => {
    const capacity = 40;

    it('P0 dispatches', () => {
      expect(evaluatePriority(SyncPriority.P0_CRITICAL, capacity).dispatch).toBe(true);
    });

    it('P1 dispatches (40% > 30% threshold)', () => {
      expect(evaluatePriority(SyncPriority.P1_ACTIVE, capacity).dispatch).toBe(true);
    });

    it('P2 is skipped (40% <= 50% threshold)', () => {
      const result = evaluatePriority(SyncPriority.P2_BACKGROUND, capacity);
      expect(result.dispatch).toBe(false);
    });

    it('P3 is skipped (40% <= 70% threshold)', () => {
      const result = evaluatePriority(SyncPriority.P3_INACTIVE, capacity);
      expect(result.dispatch).toBe(false);
    });
  });

  describe('Scenario 3: Low pressure (60% capacity remaining)', () => {
    const capacity = 60;

    it('P0, P1, P2 all dispatch', () => {
      expect(evaluatePriority(SyncPriority.P0_CRITICAL, capacity).dispatch).toBe(true);
      expect(evaluatePriority(SyncPriority.P1_ACTIVE, capacity).dispatch).toBe(true);
      expect(evaluatePriority(SyncPriority.P2_BACKGROUND, capacity).dispatch).toBe(true);
    });

    it('P3 is still skipped (60% <= 70% threshold)', () => {
      expect(evaluatePriority(SyncPriority.P3_INACTIVE, capacity).dispatch).toBe(false);
    });
  });

  describe('Scenario 4: No pressure (90% capacity remaining)', () => {
    it('all tiers dispatch', () => {
      expect(evaluatePriority(SyncPriority.P0_CRITICAL, 90).dispatch).toBe(true);
      expect(evaluatePriority(SyncPriority.P1_ACTIVE, 90).dispatch).toBe(true);
      expect(evaluatePriority(SyncPriority.P2_BACKGROUND, 90).dispatch).toBe(true);
      expect(evaluatePriority(SyncPriority.P3_INACTIVE, 90).dispatch).toBe(true);
    });
  });

  describe('Scenario 5: Zero capacity', () => {
    it('P0 still dispatches at 0%', () => {
      expect(evaluatePriority(SyncPriority.P0_CRITICAL, 0).dispatch).toBe(true);
    });

    it('P1–P3 all throttled at 0%', () => {
      expect(evaluatePriority(SyncPriority.P1_ACTIVE, 0).dispatch).toBe(false);
      expect(evaluatePriority(SyncPriority.P2_BACKGROUND, 0).dispatch).toBe(false);
      expect(evaluatePriority(SyncPriority.P3_INACTIVE, 0).dispatch).toBe(false);
    });
  });

  describe('Per-tenant 20% capacity budget', () => {
    it('P0 is always exempt from budget', async () => {
      const redis = createMockRedis({ zcard: vi.fn().mockResolvedValue(999) });
      const result = await isTenantWithinBudget(redis, 'airtable', 't1', 5, 1, SyncPriority.P0_CRITICAL);
      expect(result).toBe(true);
      expect(redis.zcard).not.toHaveBeenCalled();
    });

    it('enforces 20% cap: max 1 request when limit is 5', async () => {
      // 5 * 0.20 = 1.0 → floor(1.0) = 1
      const redis = createMockRedis({ zcard: vi.fn().mockResolvedValue(1) });
      const result = await isTenantWithinBudget(redis, 'airtable', 't1', 5, 1, SyncPriority.P1_ACTIVE);
      expect(result).toBe(false);
    });

    it('allows usage below budget', async () => {
      // 50 * 0.20 = 10. Usage = 5 < 10 → allowed
      const redis = createMockRedis({ zcard: vi.fn().mockResolvedValue(5) });
      const result = await isTenantWithinBudget(redis, 'airtable', 't1', 50, 1, SyncPriority.P1_ACTIVE);
      expect(result).toBe(true);
    });

    it('rejects usage at budget', async () => {
      // 50 * 0.20 = 10. Usage = 10 → rejected
      const redis = createMockRedis({ zcard: vi.fn().mockResolvedValue(10) });
      const result = await isTenantWithinBudget(redis, 'airtable', 't1', 50, 1, SyncPriority.P2_BACKGROUND);
      expect(result).toBe(false);
    });

    it('minimum budget is 1 even for very low rate limits', async () => {
      // 2 * 0.20 = 0.4 → floor(0.4) = 0 → clamped to 1
      const redis = createMockRedis({ zcard: vi.fn().mockResolvedValue(0) });
      const result = await isTenantWithinBudget(redis, 'notion', 't1', 2, 1, SyncPriority.P1_ACTIVE);
      expect(result).toBe(true);
    });
  });

  describe('Multi-tenant round-robin fairness', () => {
    it('P0 bypasses round-robin and serves all tenants', async () => {
      const redis = createMockRedis();
      const result = await getNextTenantForPlatform(
        redis, 'notion', SyncPriority.P0_CRITICAL, ['t1', 't2', 't3'],
      );
      expect(result).toBe('t1');
      expect(redis.incr).not.toHaveBeenCalled();
    });

    it('P1–P3 use round-robin to cycle through tenants', async () => {
      const tenants = ['alpha', 'beta', 'gamma'];

      // Call 1: index=1 → alpha
      const redis1 = createMockRedis({ incr: vi.fn().mockResolvedValue(1) });
      expect(await getNextTenantForPlatform(redis1, 'airtable', SyncPriority.P1_ACTIVE, tenants)).toBe('alpha');

      // Call 2: index=2 → beta
      const redis2 = createMockRedis({ incr: vi.fn().mockResolvedValue(2) });
      expect(await getNextTenantForPlatform(redis2, 'airtable', SyncPriority.P1_ACTIVE, tenants)).toBe('beta');

      // Call 3: index=3 → gamma
      const redis3 = createMockRedis({ incr: vi.fn().mockResolvedValue(3) });
      expect(await getNextTenantForPlatform(redis3, 'airtable', SyncPriority.P1_ACTIVE, tenants)).toBe('gamma');

      // Call 4: wraps → alpha
      const redis4 = createMockRedis({ incr: vi.fn().mockResolvedValue(4) });
      expect(await getNextTenantForPlatform(redis4, 'airtable', SyncPriority.P1_ACTIVE, tenants)).toBe('alpha');
    });
  });

  describe('Visibility → Priority mapping', () => {
    it('active → P1_ACTIVE', () => {
      expect(visibilityToPriority('active')).toBe(SyncPriority.P1_ACTIVE);
    });

    it('background → P2_BACKGROUND', () => {
      expect(visibilityToPriority('background')).toBe(SyncPriority.P2_BACKGROUND);
    });

    it('inactive → P3_INACTIVE', () => {
      expect(visibilityToPriority('inactive')).toBe(SyncPriority.P3_INACTIVE);
    });
  });

  describe('Rate limit capacity querying', () => {
    it('reports full capacity when no tokens consumed', async () => {
      const redis = createMockRedis({ eval: vi.fn().mockResolvedValue([0, 10]) });
      expect(await getRateLimitCapacity(redis, 'notion', 'int:x', 10, 1)).toBe(100);
    });

    it('reports 50% when half consumed', async () => {
      const redis = createMockRedis({ eval: vi.fn().mockResolvedValue([5, 10]) });
      expect(await getRateLimitCapacity(redis, 'notion', 'int:x', 10, 1)).toBe(50);
    });

    it('reports 0% when fully consumed', async () => {
      const redis = createMockRedis({ eval: vi.fn().mockResolvedValue([10, 10]) });
      expect(await getRateLimitCapacity(redis, 'notion', 'int:x', 10, 1)).toBe(0);
    });

    it('fails open to 100% on Redis error', async () => {
      const redis = createMockRedis({ eval: vi.fn().mockRejectedValue(new Error('Redis down')) });
      expect(await getRateLimitCapacity(redis, 'notion', 'int:x', 10, 1)).toBe(100);
    });
  });

  describe('Tenant usage recording', () => {
    it('records usage in Redis ZSET with TTL', async () => {
      const redis = createMockRedis();
      await recordTenantUsage(redis, 'notion', 'tenant-1', 60);

      expect(redis.zadd).toHaveBeenCalledWith(
        'sync:tenant_usage:notion:tenant-1',
        expect.any(String),
        expect.any(String),
      );
      expect(redis.expire).toHaveBeenCalledWith(
        'sync:tenant_usage:notion:tenant-1',
        70, // windowSeconds + 10
      );
    });
  });

  describe('Threshold constants', () => {
    it('P0 threshold = 0 (always pass)', () => {
      expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P0_CRITICAL]).toBe(0);
    });

    it('P1 threshold = 30%', () => {
      expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P1_ACTIVE]).toBe(30);
    });

    it('P2 threshold = 50%', () => {
      expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P2_BACKGROUND]).toBe(50);
    });

    it('P3 threshold = 70%', () => {
      expect(PRIORITY_CAPACITY_THRESHOLDS[SyncPriority.P3_INACTIVE]).toBe(70);
    });

    it('per-tenant cap = 20%', () => {
      expect(MAX_TENANT_CAPACITY_PERCENT).toBe(20);
    });
  });
});
