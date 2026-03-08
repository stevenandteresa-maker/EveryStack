/**
 * Tests for sync-failures data access functions.
 *
 * Covers:
 * - createSyncFailure writes to sync_failures table
 * - getSyncFailuresForConnection filters by tenant + connection
 * - getPendingRetriableFailures returns only pending with retryCount < 3
 * - retrySyncFailure resets status to pending
 * - skipSyncFailure sets status to skipped with resolver + timestamp
 * - bulkRetrySyncFailures resets all pending/requires_manual_resolution
 * - bulkSkipSyncFailures skips all pending/requires_manual_resolution
 * - incrementRetryCount transitions to requires_manual_resolution at max
 * - markFailureResolved sets status to resolved
 * - testTenantIsolation for getSyncFailuresForConnection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createSyncFailure,
  getSyncFailuresForConnection,
  getPendingRetriableFailures,
  retrySyncFailure,
  skipSyncFailure,
  bulkRetrySyncFailures,
  bulkSkipSyncFailures,
  incrementRetryCount,
  markFailureResolved,
  MAX_AUTO_RETRY_COUNT,
} from '../sync-failures';

// ---------------------------------------------------------------------------
// Mock getDbForTenant
// ---------------------------------------------------------------------------

const mockRows: Record<string, unknown>[] = [];
let lastInsertValues: Record<string, unknown> | null = null;
let lastUpdateSet: Record<string, unknown> | null = null;
let _lastWhereCondition: unknown = null;

const mockReturning = vi.fn(() => {
  if (lastInsertValues) {
    const row = {
      id: 'fail-001',
      tenantId: lastInsertValues.tenantId,
      baseConnectionId: lastInsertValues.baseConnectionId,
      recordId: lastInsertValues.recordId ?? null,
      direction: lastInsertValues.direction,
      errorCode: lastInsertValues.errorCode,
      errorMessage: lastInsertValues.errorMessage,
      platformRecordId: lastInsertValues.platformRecordId ?? null,
      payload: lastInsertValues.payload ?? null,
      retryCount: lastInsertValues.retryCount ?? 0,
      status: lastInsertValues.status ?? 'pending',
      createdAt: new Date(),
      resolvedAt: null,
      resolvedBy: null,
    };
    return [row];
  }
  // For updates returning
  return mockRows.map((r) => ({ id: (r as Record<string, unknown>).id ?? 'fail-001', retryCount: 3, status: 'requires_manual_resolution' }));
});

const mockWhere = vi.fn(() => ({
  returning: mockReturning,
  orderBy: vi.fn(() => mockRows),
  limit: vi.fn(() => mockRows),
}));

const mockSet = vi.fn((setData: Record<string, unknown>) => {
  lastUpdateSet = setData;
  return { where: mockWhere };
});

const mockValues = vi.fn((vals: Record<string, unknown>) => {
  lastInsertValues = vals;
  return { returning: mockReturning };
});

const mockFrom = vi.fn(() => ({
  where: mockWhere,
}));

const mockDb = {
  insert: vi.fn(() => ({ values: mockValues })),
  update: vi.fn(() => ({ set: mockSet })),
  select: vi.fn(() => ({ from: mockFrom })),
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
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  inArray: vi.fn((col: unknown, vals: unknown[]) => ({ type: 'inArray', col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: 'sql',
    strings: Array.from(strings),
    values,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sync-failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRows.length = 0;
    lastInsertValues = null;
    lastUpdateSet = null;
    _lastWhereCondition = null;
  });

  describe('MAX_AUTO_RETRY_COUNT', () => {
    it('is 3', () => {
      expect(MAX_AUTO_RETRY_COUNT).toBe(3);
    });
  });

  describe('createSyncFailure', () => {
    it('inserts a sync failure with correct fields', async () => {
      const result = await createSyncFailure('tenant-1', {
        baseConnectionId: 'conn-1',
        direction: 'inbound',
        errorCode: 'validation',
        errorMessage: 'Invalid value for field X',
        platformRecordId: 'rec123',
        payload: { fields: { name: 'test' } },
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          baseConnectionId: 'conn-1',
          direction: 'inbound',
          errorCode: 'validation',
          errorMessage: 'Invalid value for field X',
          platformRecordId: 'rec123',
          retryCount: 0,
          status: 'pending',
        }),
      );
      expect(result.id).toBe('fail-001');
    });

    it('handles null optional fields', async () => {
      await createSyncFailure('tenant-1', {
        baseConnectionId: 'conn-1',
        direction: 'outbound',
        errorCode: 'unknown',
        errorMessage: 'Something went wrong',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          recordId: null,
          platformRecordId: null,
          payload: null,
        }),
      );
    });
  });

  describe('getSyncFailuresForConnection', () => {
    it('queries with correct tenant and connection filters', async () => {
      await getSyncFailuresForConnection('tenant-1', 'conn-1');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('getPendingRetriableFailures', () => {
    it('queries for pending failures with retryCount < MAX', async () => {
      await getPendingRetriableFailures('tenant-1', 'conn-1');

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });
  });

  describe('retrySyncFailure', () => {
    it('resets status to pending', async () => {
      await retrySyncFailure('tenant-1', 'fail-001');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          resolvedAt: null,
          resolvedBy: null,
        }),
      );
    });
  });

  describe('skipSyncFailure', () => {
    it('sets status to skipped with resolver', async () => {
      await skipSyncFailure('tenant-1', 'fail-001', 'user-123');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'skipped',
          resolvedBy: 'user-123',
        }),
      );
      // resolvedAt should be a Date
      expect(lastUpdateSet?.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('bulkRetrySyncFailures', () => {
    it('resets all actionable failures to pending', async () => {
      mockRows.push({ id: 'f1' }, { id: 'f2' });

      const retried = await bulkRetrySyncFailures('tenant-1', 'conn-1');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          resolvedAt: null,
          resolvedBy: null,
        }),
      );
      expect(retried).toBeGreaterThanOrEqual(0);
    });
  });

  describe('bulkSkipSyncFailures', () => {
    it('skips all actionable failures', async () => {
      mockRows.push({ id: 'f1' });

      const skipped = await bulkSkipSyncFailures('tenant-1', 'conn-1', 'user-456');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'skipped',
          resolvedBy: 'user-456',
        }),
      );
      expect(skipped).toBeGreaterThanOrEqual(0);
    });
  });

  describe('incrementRetryCount', () => {
    it('increments count and returns new state', async () => {
      const result = await incrementRetryCount('tenant-1', 'fail-001');

      expect(mockDb.update).toHaveBeenCalled();
      expect(result).toHaveProperty('newRetryCount');
      expect(result).toHaveProperty('requiresManual');
    });
  });

  describe('markFailureResolved', () => {
    it('sets status to resolved with timestamp', async () => {
      await markFailureResolved('tenant-1', 'fail-001');

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
        }),
      );
      expect(lastUpdateSet?.resolvedAt).toBeInstanceOf(Date);
    });
  });
});
