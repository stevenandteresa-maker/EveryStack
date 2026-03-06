import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Redis from 'ioredis';
import { createRedisClient } from '@everystack/shared/redis';
import {
  checkRecordQuota,
  canSyncRecords,
  enforceQuotaOnBatch,
  canCreateRecord,
  countTenantRecords,
  getTenantPlanQuota,
  incrementQuotaCache,
  decrementQuotaCache,
  invalidateQuotaCache,
  setQuotaRedisClient,
  PLAN_QUOTAS,
} from '../quota';
import { testTenantIsolation } from '../../testing/tenant-isolation';
import {
  createTestTenant,
  createTestRecord,
  createTestTable,
} from '../../testing/factories';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/logging', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------

interface MockRedis {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  exists: ReturnType<typeof vi.fn>;
  incrby: ReturnType<typeof vi.fn>;
  decrby: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
}

function createMockRedis(): MockRedis {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    exists: vi.fn().mockResolvedValue(0),
    incrby: vi.fn().mockResolvedValue(0),
    decrby: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  };
}

let mockRedis: MockRedis;

beforeEach(() => {
  mockRedis = createMockRedis();
  setQuotaRedisClient(mockRedis as unknown as Redis);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// PLAN_QUOTAS
// ---------------------------------------------------------------------------

describe('PLAN_QUOTAS', () => {
  it('defines quotas for all plan tiers', () => {
    expect(PLAN_QUOTAS['freelancer']).toBe(10_000);
    expect(PLAN_QUOTAS['starter']).toBe(50_000);
    expect(PLAN_QUOTAS['professional']).toBe(250_000);
    expect(PLAN_QUOTAS['business']).toBe(1_000_000);
    expect(PLAN_QUOTAS['enterprise']).toBe(Infinity);
  });
});

// ---------------------------------------------------------------------------
// Helper: create a record with a valid table FK
// ---------------------------------------------------------------------------

async function createRecordForTenant(tenantId: string, overrides?: { archivedAt?: Date }) {
  const table = await createTestTable({ tenantId });
  return createTestRecord({ tenantId, tableId: table.id, ...overrides });
}

// ---------------------------------------------------------------------------
// countTenantRecords
// ---------------------------------------------------------------------------

describe('countTenantRecords', () => {
  it('counts non-archived records for a tenant', async () => {
    const tenant = await createTestTenant({ plan: 'professional' });

    // Create 3 active records
    await createRecordForTenant(tenant.id);
    await createRecordForTenant(tenant.id);
    await createRecordForTenant(tenant.id);

    // Create 1 archived record (should not count)
    await createRecordForTenant(tenant.id, { archivedAt: new Date() });

    const result = await countTenantRecords(tenant.id);
    expect(result).toBe(3);
  }, 10_000);

  it('returns 0 for a tenant with no records', async () => {
    const tenant = await createTestTenant();
    const result = await countTenantRecords(tenant.id);
    expect(result).toBe(0);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// getTenantPlanQuota
// ---------------------------------------------------------------------------

describe('getTenantPlanQuota', () => {
  it('returns quota for the tenant plan', async () => {
    const tenant = await createTestTenant({ plan: 'starter' });
    const quota = await getTenantPlanQuota(tenant.id);
    expect(quota).toBe(50_000);
  }, 10_000);

  it('returns freelancer quota for unknown plan', async () => {
    const tenant = await createTestTenant({ plan: 'nonexistent' });
    const quota = await getTenantPlanQuota(tenant.id);
    expect(quota).toBe(10_000);
  }, 10_000);

  it('returns Infinity for enterprise plan', async () => {
    const tenant = await createTestTenant({ plan: 'enterprise' });
    const quota = await getTenantPlanQuota(tenant.id);
    expect(quota).toBe(Infinity);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// checkRecordQuota — cache hit path
// ---------------------------------------------------------------------------

describe('checkRecordQuota', () => {
  it('returns cached count without DB query on cache hit', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });

    // Simulate cache hit: 5000 records cached
    mockRedis.get.mockResolvedValue('5000');

    const result = await checkRecordQuota(tenant.id);

    expect(result.currentCount).toBe(5000);
    expect(result.planQuota).toBe(10_000);
    expect(result.remaining).toBe(5_000);
    expect(result.exceeded).toBe(false);

    // Verify Redis was checked
    expect(mockRedis.get).toHaveBeenCalledWith(`quota:records:${tenant.id}`);
  }, 10_000);

  it('falls through to DB on cache miss and caches result', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    await createRecordForTenant(tenant.id);
    await createRecordForTenant(tenant.id);

    // Cache miss
    mockRedis.get.mockResolvedValue(null);

    const result = await checkRecordQuota(tenant.id);

    expect(result.currentCount).toBe(2);
    expect(result.planQuota).toBe(10_000);
    expect(result.remaining).toBe(9_998);
    expect(result.exceeded).toBe(false);

    // Verify cache was set
    expect(mockRedis.set).toHaveBeenCalledWith(
      `quota:records:${tenant.id}`,
      2,
      'EX',
      60,
    );
  }, 10_000);

  it('reports exceeded when at quota limit', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });

    // Simulate cache hit at exactly the limit
    mockRedis.get.mockResolvedValue('10000');

    const result = await checkRecordQuota(tenant.id);

    expect(result.exceeded).toBe(true);
    expect(result.remaining).toBe(0);
  }, 10_000);

  it('reports exceeded when over quota', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });

    // Simulate cache hit over the limit (possible via race conditions)
    mockRedis.get.mockResolvedValue('12000');

    const result = await checkRecordQuota(tenant.id);

    expect(result.exceeded).toBe(true);
    expect(result.remaining).toBe(0);
  }, 10_000);

  it('handles Redis read failure gracefully', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    await createRecordForTenant(tenant.id);

    // Redis fails on get
    mockRedis.get.mockRejectedValue(new Error('Connection refused'));

    const result = await checkRecordQuota(tenant.id);

    // Should fall through to DB
    expect(result.currentCount).toBe(1);
    expect(result.exceeded).toBe(false);
  }, 10_000);

  it('handles Redis write failure gracefully when caching DB result', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    await createRecordForTenant(tenant.id);

    // Cache miss followed by write failure
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockRejectedValue(new Error('Connection refused'));

    // Should not throw — the result should still come from DB
    const result = await checkRecordQuota(tenant.id);

    expect(result.currentCount).toBe(1);
    expect(result.exceeded).toBe(false);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// canSyncRecords — Enforcement Point 1
// ---------------------------------------------------------------------------

describe('canSyncRecords', () => {
  it('allows sync when estimated count fits within remaining quota', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('5000');

    const result = await canSyncRecords(tenant.id, 3000);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5_000);
    expect(result.overageCount).toBe(0);
  }, 10_000);

  it('allows sync when estimated count exactly equals remaining quota', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('5000');

    const result = await canSyncRecords(tenant.id, 5000);

    expect(result.allowed).toBe(true);
    expect(result.overageCount).toBe(0);
  }, 10_000);

  it('blocks sync when estimated count exceeds remaining quota', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('8000');

    const result = await canSyncRecords(tenant.id, 5000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(2_000);
    expect(result.overageCount).toBe(3_000);
  }, 10_000);

  it('blocks sync when tenant already at quota limit', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('10000');

    const result = await canSyncRecords(tenant.id, 1);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.overageCount).toBe(1);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// enforceQuotaOnBatch — Enforcement Point 2
// ---------------------------------------------------------------------------

describe('enforceQuotaOnBatch', () => {
  it('accepts full batch when quota has room', async () => {
    const tenant = await createTestTenant({ plan: 'professional' });
    mockRedis.get.mockResolvedValue('100');

    const result = await enforceQuotaOnBatch(tenant.id, 50);

    expect(result.acceptedCount).toBe(50);
    expect(result.quotaExceeded).toBe(false);
  }, 10_000);

  it('returns partial acceptance when batch would exceed quota', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('9990');

    const result = await enforceQuotaOnBatch(tenant.id, 50);

    expect(result.acceptedCount).toBe(10);
    expect(result.quotaExceeded).toBe(true);
  }, 10_000);

  it('returns zero accepted when quota is fully exhausted', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('10000');

    const result = await enforceQuotaOnBatch(tenant.id, 100);

    expect(result.acceptedCount).toBe(0);
    expect(result.quotaExceeded).toBe(true);
  }, 10_000);

  it('handles enterprise plan with unlimited quota', async () => {
    const tenant = await createTestTenant({ plan: 'enterprise' });
    mockRedis.get.mockResolvedValue('999999');

    const result = await enforceQuotaOnBatch(tenant.id, 10_000);

    expect(result.acceptedCount).toBe(10_000);
    expect(result.quotaExceeded).toBe(false);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// canCreateRecord — Enforcement Point 3
// ---------------------------------------------------------------------------

describe('canCreateRecord', () => {
  it('returns true when tenant is below quota', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('9999');

    const result = await canCreateRecord(tenant.id);

    expect(result).toBe(true);
  }, 10_000);

  it('returns false when tenant is at quota limit', async () => {
    const tenant = await createTestTenant({ plan: 'freelancer' });
    mockRedis.get.mockResolvedValue('10000');

    const result = await canCreateRecord(tenant.id);

    expect(result).toBe(false);
  }, 10_000);

  it('returns true for enterprise plan regardless of count', async () => {
    const tenant = await createTestTenant({ plan: 'enterprise' });
    mockRedis.get.mockResolvedValue('5000000');

    const result = await canCreateRecord(tenant.id);

    expect(result).toBe(true);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Quota Cache Maintenance
// ---------------------------------------------------------------------------

describe('incrementQuotaCache', () => {
  it('increments cached count when key exists', async () => {
    mockRedis.exists.mockResolvedValue(1);

    await incrementQuotaCache('tenant-1', 5);

    expect(mockRedis.exists).toHaveBeenCalledWith('quota:records:tenant-1');
    expect(mockRedis.incrby).toHaveBeenCalledWith('quota:records:tenant-1', 5);
  });

  it('skips increment when key does not exist', async () => {
    mockRedis.exists.mockResolvedValue(0);

    await incrementQuotaCache('tenant-1', 5);

    expect(mockRedis.incrby).not.toHaveBeenCalled();
  });

  it('handles Redis failure gracefully', async () => {
    mockRedis.exists.mockRejectedValue(new Error('Connection refused'));

    // Should not throw
    await expect(incrementQuotaCache('tenant-1', 5)).resolves.toBeUndefined();
  });
});

describe('decrementQuotaCache', () => {
  it('decrements cached count when key exists', async () => {
    mockRedis.exists.mockResolvedValue(1);

    await decrementQuotaCache('tenant-1', 3);

    expect(mockRedis.exists).toHaveBeenCalledWith('quota:records:tenant-1');
    expect(mockRedis.decrby).toHaveBeenCalledWith('quota:records:tenant-1', 3);
  });

  it('skips decrement when key does not exist', async () => {
    mockRedis.exists.mockResolvedValue(0);

    await decrementQuotaCache('tenant-1', 3);

    expect(mockRedis.decrby).not.toHaveBeenCalled();
  });

  it('handles Redis failure gracefully', async () => {
    mockRedis.exists.mockRejectedValue(new Error('Connection refused'));

    await expect(decrementQuotaCache('tenant-1', 3)).resolves.toBeUndefined();
  });
});

describe('invalidateQuotaCache', () => {
  it('deletes the cache key', async () => {
    await invalidateQuotaCache('tenant-1');

    expect(mockRedis.del).toHaveBeenCalledWith('quota:records:tenant-1');
  });

  it('handles Redis failure gracefully', async () => {
    mockRedis.del.mockRejectedValue(new Error('Connection refused'));

    await expect(invalidateQuotaCache('tenant-1')).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tenant Isolation — non-negotiable
// ---------------------------------------------------------------------------

describe('countTenantRecords tenant isolation', () => {
  it('enforces tenant isolation', async () => {
    await testTenantIsolation({
      setup: async (tenantId) => {
        await createRecordForTenant(tenantId);
        await createRecordForTenant(tenantId);
      },
      query: async (tenantId) => {
        const recordCount = await countTenantRecords(tenantId);
        // testTenantIsolation expects an array — return an array of length = count
        return recordCount > 0 ? Array.from({ length: recordCount }, (_, i) => i) : [];
      },
    });
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Lazy Redis initialization
// ---------------------------------------------------------------------------

describe('lazy Redis initialization', () => {
  it('calls createRedisClient when no client is pre-set', async () => {
    const mockCreate = vi.mocked(createRedisClient);
    mockCreate.mockReturnValue(mockRedis as unknown as Redis);

    // Reset to null to trigger lazy init path
    setQuotaRedisClient(null as unknown as Redis);

    // incrementQuotaCache calls getRedis() internally
    await incrementQuotaCache('tenant-lazy', 1);

    expect(mockCreate).toHaveBeenCalledWith('sync-quota');

    // Restore the mock Redis for subsequent tests
    setQuotaRedisClient(mockRedis as unknown as Redis);
    mockCreate.mockReset();
  });
});
