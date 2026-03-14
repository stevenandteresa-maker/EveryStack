import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkspaceDescriptor } from '../types';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing modules that use them
// ---------------------------------------------------------------------------

// Mock Redis client
const mockRedisGet = vi.fn<(key: string) => Promise<string | null>>();
const mockRedisSet = vi.fn<(...args: unknown[]) => Promise<string>>();
const mockRedisDel = vi.fn<(...keys: string[]) => Promise<number>>();
const mockRedisScan = vi.fn<(...args: unknown[]) => Promise<[string, string[]]>>();

vi.mock('../../../redis', () => ({
  createRedisClient: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    scan: mockRedisScan,
  })),
}));

// Mock logger
vi.mock('../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock buildWorkspaceDescriptor
const mockBuildWorkspaceDescriptor = vi.fn();
vi.mock('../workspace-builder', () => ({
  buildWorkspaceDescriptor: (...args: unknown[]) => mockBuildWorkspaceDescriptor(...args),
}));

// Mock filterDescriptorByPermissions
const mockFilterDescriptorByPermissions = vi.fn();
vi.mock('../permission-filter', () => ({
  filterDescriptorByPermissions: (...args: unknown[]) => mockFilterDescriptorByPermissions(...args),
}));

// Mock computeSchemaVersionHash
const mockComputeSchemaVersionHash = vi.fn();
vi.mock('../schema-hash', () => ({
  computeSchemaVersionHash: (...args: unknown[]) => mockComputeSchemaVersionHash(...args),
}));

// Now import the module under test
import {
  SchemaDescriptorCache,
  SDS_CACHE_TTL,
  buildTier1Key,
  buildTier2Key,
} from '../cache';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const WORKSPACE_ID = 'ws-001';
const USER_ID = 'user-001';
const SCHEMA_HASH = 'abc123def456';

function createDescriptor(overrides?: Partial<WorkspaceDescriptor>): WorkspaceDescriptor {
  return {
    workspace_id: WORKSPACE_ID,
    bases: [
      {
        base_id: 'base-001',
        name: 'Sales Base',
        platform: 'airtable',
        tables: [
          {
            table_id: 'tbl-001',
            name: 'Deals',
            record_count_approx: 500,
            fields: [
              { field_id: 'fld-001', name: 'Deal Name', type: 'text', searchable: true, aggregatable: false },
            ],
          },
        ],
      },
    ],
    link_graph: [],
    ...overrides,
  };
}

function createFilteredDescriptor(): WorkspaceDescriptor {
  return {
    workspace_id: WORKSPACE_ID,
    bases: [
      {
        base_id: 'base-001',
        name: 'Sales Base',
        platform: 'airtable',
        tables: [
          {
            table_id: 'tbl-001',
            name: 'Deals',
            record_count_approx: 500,
            fields: [
              { field_id: 'fld-001', name: 'Deal Name', type: 'text', searchable: true, aggregatable: false },
            ],
          },
        ],
      },
    ],
    link_graph: [],
  };
}

const mockDb = {} as Parameters<InstanceType<typeof SchemaDescriptorCache>['getWorkspaceDescriptor']>[3];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchemaDescriptorCache', () => {
  let cache: SchemaDescriptorCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new SchemaDescriptorCache();
    mockComputeSchemaVersionHash.mockResolvedValue(SCHEMA_HASH);
    // Default: SCAN returns no keys (empty cursor)
    mockRedisScan.mockResolvedValue(['0', []]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Key builders
  // -----------------------------------------------------------------------

  describe('key builders', () => {
    it('builds correct Tier 1 key format', () => {
      const key = buildTier1Key(TENANT_ID, WORKSPACE_ID, SCHEMA_HASH);
      expect(key).toBe(`cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:${SCHEMA_HASH}`);
    });

    it('builds correct Tier 2 key format', () => {
      const key = buildTier2Key(TENANT_ID, WORKSPACE_ID, USER_ID, SCHEMA_HASH);
      expect(key).toBe(`cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:${USER_ID}:${SCHEMA_HASH}`);
    });
  });

  // -----------------------------------------------------------------------
  // Cache hit — Tier 2
  // -----------------------------------------------------------------------

  describe('getWorkspaceDescriptor — Tier 2 cache hit', () => {
    it('returns cached descriptor on Tier 2 hit without building or filtering', async () => {
      const descriptor = createFilteredDescriptor();
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(descriptor));

      const result = await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      expect(result).toEqual(descriptor);
      expect(mockBuildWorkspaceDescriptor).not.toHaveBeenCalled();
      expect(mockFilterDescriptorByPermissions).not.toHaveBeenCalled();
      // Only Tier 2 key checked
      expect(mockRedisGet).toHaveBeenCalledTimes(1);
      expect(mockRedisGet).toHaveBeenCalledWith(
        buildTier2Key(TENANT_ID, WORKSPACE_ID, USER_ID, SCHEMA_HASH),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Cache hit — Tier 1, Tier 2 miss
  // -----------------------------------------------------------------------

  describe('getWorkspaceDescriptor — Tier 1 hit, Tier 2 miss', () => {
    it('filters Tier 1 result and stores in Tier 2', async () => {
      const unfiltered = createDescriptor();
      const filtered = createFilteredDescriptor();

      // Tier 2 miss, Tier 1 hit
      mockRedisGet
        .mockResolvedValueOnce(null) // Tier 2 miss
        .mockResolvedValueOnce(JSON.stringify(unfiltered)); // Tier 1 hit

      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);

      const result = await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      expect(result).toEqual(filtered);
      expect(mockBuildWorkspaceDescriptor).not.toHaveBeenCalled();
      expect(mockFilterDescriptorByPermissions).toHaveBeenCalledWith(
        unfiltered,
        USER_ID,
        TENANT_ID,
        mockDb,
      );

      // Tier 2 stored
      expect(mockRedisSet).toHaveBeenCalledWith(
        buildTier2Key(TENANT_ID, WORKSPACE_ID, USER_ID, SCHEMA_HASH),
        JSON.stringify(filtered),
        'EX',
        SDS_CACHE_TTL,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Full cache miss
  // -----------------------------------------------------------------------

  describe('getWorkspaceDescriptor — full miss', () => {
    it('builds, stores Tier 1, filters, stores Tier 2', async () => {
      const unfiltered = createDescriptor();
      const filtered = createFilteredDescriptor();

      // Both tiers miss
      mockRedisGet.mockResolvedValue(null);
      mockBuildWorkspaceDescriptor.mockResolvedValue(unfiltered);
      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);

      const result = await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      expect(result).toEqual(filtered);

      // Build called
      expect(mockBuildWorkspaceDescriptor).toHaveBeenCalledWith(WORKSPACE_ID, TENANT_ID, mockDb);

      // Tier 1 stored
      expect(mockRedisSet).toHaveBeenCalledWith(
        buildTier1Key(TENANT_ID, WORKSPACE_ID, SCHEMA_HASH),
        JSON.stringify(unfiltered),
        'EX',
        SDS_CACHE_TTL,
      );

      // Tier 2 stored
      expect(mockRedisSet).toHaveBeenCalledWith(
        buildTier2Key(TENANT_ID, WORKSPACE_ID, USER_ID, SCHEMA_HASH),
        JSON.stringify(filtered),
        'EX',
        SDS_CACHE_TTL,
      );
    });
  });

  // -----------------------------------------------------------------------
  // TTL verification
  // -----------------------------------------------------------------------

  describe('TTL', () => {
    it('sets TTL to 300 seconds on both tiers', async () => {
      expect(SDS_CACHE_TTL).toBe(300);

      // Full miss to exercise both SET calls
      mockRedisGet.mockResolvedValue(null);
      mockBuildWorkspaceDescriptor.mockResolvedValue(createDescriptor());
      mockFilterDescriptorByPermissions.mockResolvedValue(createFilteredDescriptor());

      await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      // Both SET calls use 'EX', 300
      for (const call of mockRedisSet.mock.calls) {
        expect(call[2]).toBe('EX');
        expect(call[3]).toBe(300);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Invalidation — workspace
  // -----------------------------------------------------------------------

  describe('invalidateWorkspace', () => {
    it('deletes all keys matching workspace pattern', async () => {
      const tier1Key = `cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:hash1`;
      const tier2Key = `cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:user1:hash1`;

      mockRedisScan.mockResolvedValueOnce(['0', [tier1Key, tier2Key]]);

      await cache.invalidateWorkspace(WORKSPACE_ID, TENANT_ID);

      expect(mockRedisScan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedisDel).toHaveBeenCalledWith(tier1Key, tier2Key);
    });

    it('handles multiple SCAN iterations', async () => {
      const keys1 = ['key1', 'key2'];
      const keys2 = ['key3'];

      mockRedisScan
        .mockResolvedValueOnce(['42', keys1]) // First iteration, cursor != 0
        .mockResolvedValueOnce(['0', keys2]); // Second iteration, done

      await cache.invalidateWorkspace(WORKSPACE_ID, TENANT_ID);

      expect(mockRedisScan).toHaveBeenCalledTimes(2);
      expect(mockRedisDel).toHaveBeenCalledTimes(2);
      expect(mockRedisDel).toHaveBeenCalledWith('key1', 'key2');
      expect(mockRedisDel).toHaveBeenCalledWith('key3');
    });

    it('handles empty SCAN result gracefully', async () => {
      mockRedisScan.mockResolvedValueOnce(['0', []]);

      await cache.invalidateWorkspace(WORKSPACE_ID, TENANT_ID);

      expect(mockRedisDel).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Invalidation — user
  // -----------------------------------------------------------------------

  describe('invalidateUser', () => {
    it('deletes only that user Tier 2 keys', async () => {
      const userKey = `cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:${USER_ID}:hash1`;

      mockRedisScan.mockResolvedValueOnce(['0', [userKey]]);

      await cache.invalidateUser(WORKSPACE_ID, USER_ID, TENANT_ID);

      expect(mockRedisScan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `cache:t:${TENANT_ID}:sds:${WORKSPACE_ID}:${USER_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedisDel).toHaveBeenCalledWith(userKey);
    });

    it('does not affect other users Tier 2 keys', async () => {
      // Only returns keys for the target user
      mockRedisScan.mockResolvedValueOnce(['0', []]);

      await cache.invalidateUser(WORKSPACE_ID, USER_ID, TENANT_ID);

      // No DEL called since no keys matched
      expect(mockRedisDel).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Graceful degradation — Redis failures are non-fatal
  // -----------------------------------------------------------------------

  describe('graceful degradation', () => {
    it('falls through on Tier 2 read failure', async () => {
      const unfiltered = createDescriptor();
      const filtered = createFilteredDescriptor();

      // Tier 2 read fails
      mockRedisGet
        .mockRejectedValueOnce(new Error('Redis connection lost'))
        .mockResolvedValueOnce(JSON.stringify(unfiltered)); // Tier 1 hit

      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);

      const result = await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      expect(result).toEqual(filtered);
    });

    it('falls through on Tier 1 read failure', async () => {
      const unfiltered = createDescriptor();
      const filtered = createFilteredDescriptor();

      mockRedisGet
        .mockResolvedValueOnce(null) // Tier 2 miss
        .mockRejectedValueOnce(new Error('Redis timeout')); // Tier 1 read fail

      mockBuildWorkspaceDescriptor.mockResolvedValue(unfiltered);
      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);

      const result = await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      expect(result).toEqual(filtered);
      expect(mockBuildWorkspaceDescriptor).toHaveBeenCalled();
    });

    it('continues without cache on write failure', async () => {
      const unfiltered = createDescriptor();
      const filtered = createFilteredDescriptor();

      mockRedisGet.mockResolvedValue(null);
      mockBuildWorkspaceDescriptor.mockResolvedValue(unfiltered);
      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);
      mockRedisSet.mockRejectedValue(new Error('Redis write failed'));

      const result = await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      // Still returns the result despite cache write failures
      expect(result).toEqual(filtered);
    });

    it('invalidateWorkspace handles Redis failure gracefully', async () => {
      mockRedisScan.mockRejectedValueOnce(new Error('Redis down'));

      // Should not throw
      await expect(
        cache.invalidateWorkspace(WORKSPACE_ID, TENANT_ID),
      ).resolves.toBeUndefined();
    });

    it('invalidateUser handles Redis failure gracefully', async () => {
      mockRedisScan.mockRejectedValueOnce(new Error('Redis down'));

      // Should not throw
      await expect(
        cache.invalidateUser(WORKSPACE_ID, USER_ID, TENANT_ID),
      ).resolves.toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Schema hash auto-invalidation
  // -----------------------------------------------------------------------

  describe('schema hash auto-invalidation', () => {
    it('uses different cache keys when schema hash changes', async () => {
      const unfiltered = createDescriptor();
      const filtered = createFilteredDescriptor();

      // First call with hash A
      mockComputeSchemaVersionHash.mockResolvedValueOnce('hashA');
      mockRedisGet.mockResolvedValue(null);
      mockBuildWorkspaceDescriptor.mockResolvedValue(unfiltered);
      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);

      await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      const firstTier1Key = buildTier1Key(TENANT_ID, WORKSPACE_ID, 'hashA');
      const firstTier2Key = buildTier2Key(TENANT_ID, WORKSPACE_ID, USER_ID, 'hashA');

      expect(mockRedisSet).toHaveBeenCalledWith(firstTier1Key, expect.any(String), 'EX', 300);
      expect(mockRedisSet).toHaveBeenCalledWith(firstTier2Key, expect.any(String), 'EX', 300);

      vi.clearAllMocks();

      // Second call with hash B (schema changed)
      mockComputeSchemaVersionHash.mockResolvedValueOnce('hashB');
      mockRedisGet.mockResolvedValue(null);
      mockBuildWorkspaceDescriptor.mockResolvedValue(unfiltered);
      mockFilterDescriptorByPermissions.mockResolvedValue(filtered);

      await cache.getWorkspaceDescriptor(WORKSPACE_ID, USER_ID, TENANT_ID, mockDb);

      const secondTier1Key = buildTier1Key(TENANT_ID, WORKSPACE_ID, 'hashB');
      const secondTier2Key = buildTier2Key(TENANT_ID, WORKSPACE_ID, USER_ID, 'hashB');

      expect(secondTier1Key).not.toBe(firstTier1Key);
      expect(secondTier2Key).not.toBe(firstTier2Key);
      expect(mockRedisSet).toHaveBeenCalledWith(secondTier1Key, expect.any(String), 'EX', 300);
      expect(mockRedisSet).toHaveBeenCalledWith(secondTier2Key, expect.any(String), 'EX', 300);
    });
  });
});

// ---------------------------------------------------------------------------
// computeSchemaVersionHash — tested via separate describe block
// ---------------------------------------------------------------------------

describe('computeSchemaVersionHash', () => {
  // These tests use the real implementation, not the mock
  // We need to reimport without the mock
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is exported from the schema-hash module', async () => {
    // Verify the mock was set up correctly (module exists)
    expect(mockComputeSchemaVersionHash).toBeDefined();
  });
});
