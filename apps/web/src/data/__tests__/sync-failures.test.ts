/**
 * Tests for sync-failures data functions (apps/web/src/data/sync-failures.ts).
 *
 * Covers:
 * - getSyncFailures returns failures with record display names
 * - countPendingSyncFailures counts only actionable failures
 * - Tenant isolation via getDbForTenant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_FAILURES = [
  {
    id: 'fail-001',
    baseConnectionId: 'conn-1',
    recordId: 'rec-1',
    direction: 'inbound',
    errorCode: 'validation',
    errorMessage: 'Invalid value',
    platformRecordId: 'plat-rec-1',
    payload: { fields: {} },
    retryCount: 0,
    status: 'pending',
    createdAt: new Date('2026-03-07'),
    resolvedAt: null,
    resolvedBy: null,
    recordDisplayName: 'Test Record',
  },
];

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const mockOrderBy = vi.fn(() => MOCK_FAILURES);

const mockLeftJoin = vi.fn(() => ({
  where: vi.fn(() => ({
    orderBy: mockOrderBy,
  })),
}));

const mockFrom = vi.fn(() => ({
  leftJoin: mockLeftJoin,
  where: vi.fn(() => [{ count: 1 }]),
}));

const mockSelect = vi.fn(() => ({
  from: mockFrom,
}));

const mockDb = {
  select: mockSelect,
};

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  syncFailures: {
    id: 'id',
    tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id',
    recordId: 'record_id',
    direction: 'direction',
    errorCode: 'error_code',
    errorMessage: 'error_message',
    platformRecordId: 'platform_record_id',
    payload: 'payload',
    retryCount: 'retry_count',
    status: 'status',
    createdAt: 'created_at',
    resolvedAt: 'resolved_at',
    resolvedBy: 'resolved_by',
  },
  records: {
    id: 'id',
    tenantId: 'tenant_id',
    canonicalData: 'canonical_data',
    tableId: 'table_id',
  },
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings: Array.from(strings),
      values,
      as: vi.fn(() => 'aliased'),
    })),
    {
      as: vi.fn(),
    },
  ),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getSyncFailures, countPendingSyncFailures } from '../sync-failures';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sync-failures data functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSyncFailures', () => {
    it('returns failures with record display names', async () => {
      const result = await getSyncFailures('tenant-1', 'conn-1');

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      const first = result[0]!;
      expect(first.recordDisplayName).toBe('Test Record');
      expect(first.errorCode).toBe('validation');
    });

    it('uses tenant-scoped read access', async () => {
      const { getDbForTenant } = await import('@everystack/shared/db');
      await getSyncFailures('tenant-1', 'conn-1');

      expect(getDbForTenant).toHaveBeenCalledWith('tenant-1', 'read');
    });
  });

  describe('countPendingSyncFailures', () => {
    it('returns count of pending failures', async () => {
      const count = await countPendingSyncFailures('tenant-1', 'conn-1');

      expect(count).toBe(1);
    });
  });
});
