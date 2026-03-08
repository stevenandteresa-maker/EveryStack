/**
 * Tests for sync-error-handler.ts
 *
 * Covers:
 * - Error classification into 8 SyncErrorCode categories
 * - Backoff delay calculation
 * - handleSyncError integration (health transitions, sync_status, retry scheduling)
 * - retryNow and pauseSync actions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyError,
  getBackoffDelay,
  BACKOFF_SCHEDULE,
  handleSyncError,
  retryNow,
  pauseSync,
} from '../sync-error-handler';
import type { SyncJobContext } from '../sync-error-handler';
import type { ConnectionHealth } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockQueueAdd = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                limit: (...lArgs: unknown[]) => {
                  mockLimit(...lArgs);
                  return mockLimit.mock.results.length > 0
                    ? Promise.resolve(mockLimit())
                    : Promise.resolve([]);
                },
              };
            },
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSet(...sArgs);
          return {
            where: vi.fn().mockResolvedValue(undefined),
          };
        },
      };
    },
  })),
  baseConnections: { id: 'id', tenantId: 'tenant_id', health: 'health', syncStatus: 'sync_status' },
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
}));

vi.mock('../../../queues', () => ({
  getQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as SyncJobContext['logger'];

// ---------------------------------------------------------------------------
// classifyError tests
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  it('classifies HTTP 401 as auth_expired', () => {
    const result = classifyError({ status: 401, message: 'Unauthorized' });
    expect(result.code).toBe('auth_expired');
    expect(result.retryable).toBe(false);
  });

  it('classifies HTTP 403 as permission_denied', () => {
    const result = classifyError({ status: 403, message: 'Forbidden' });
    expect(result.code).toBe('permission_denied');
    expect(result.retryable).toBe(false);
  });

  it('classifies HTTP 429 as rate_limited', () => {
    const result = classifyError({ status: 429, message: 'Rate limited' });
    expect(result.code).toBe('rate_limited');
    expect(result.retryable).toBe(true);
  });

  it('classifies HTTP 500 as platform_unavailable', () => {
    const result = classifyError({ status: 500, message: 'Internal Server Error' });
    expect(result.code).toBe('platform_unavailable');
    expect(result.retryable).toBe(true);
  });

  it('classifies HTTP 502 as platform_unavailable', () => {
    const result = classifyError({ status: 502, message: 'Bad Gateway' });
    expect(result.code).toBe('platform_unavailable');
    expect(result.retryable).toBe(true);
  });

  it('classifies HTTP 503 as platform_unavailable', () => {
    const result = classifyError({ status: 503, message: 'Service Unavailable' });
    expect(result.code).toBe('platform_unavailable');
    expect(result.retryable).toBe(true);
  });

  it('classifies nested response.status 401 as auth_expired', () => {
    const result = classifyError({ response: { status: 401 }, message: 'Auth error' });
    expect(result.code).toBe('auth_expired');
  });

  it('classifies nested response.status 500 as platform_unavailable', () => {
    const result = classifyError({ response: { status: 500 }, message: 'Server error' });
    expect(result.code).toBe('platform_unavailable');
  });

  it('classifies timeout errors as platform_unavailable', () => {
    const result = classifyError(new Error('Request timed out'));
    expect(result.code).toBe('platform_unavailable');
    expect(result.retryable).toBe(true);
  });

  it('classifies ETIMEDOUT error code as platform_unavailable', () => {
    const err = new Error('Connection timed out');
    (err as unknown as Record<string, unknown>).code = 'ETIMEDOUT';
    const result = classifyError(err);
    expect(result.code).toBe('platform_unavailable');
  });

  it('classifies ECONNABORTED error code as platform_unavailable', () => {
    const result = classifyError({ code: 'ECONNABORTED', message: 'Aborted' });
    expect(result.code).toBe('platform_unavailable');
  });

  it('classifies validation errors as partial_failure', () => {
    const result = classifyError(new Error('Validation failed for field Budget'));
    expect(result.code).toBe('partial_failure');
    expect(result.retryable).toBe(false);
  });

  it('classifies schema errors as schema_mismatch', () => {
    const result = classifyError(new Error('Field not found: assignee'));
    expect(result.code).toBe('schema_mismatch');
    expect(result.retryable).toBe(false);
  });

  it('classifies quota errors as quota_exceeded', () => {
    const result = classifyError(new Error('Record limit exceeded'));
    expect(result.code).toBe('quota_exceeded');
    expect(result.retryable).toBe(false);
  });

  it('classifies unknown errors with unknown code', () => {
    const result = classifyError(new Error('Something unexpected happened'));
    expect(result.code).toBe('unknown');
    expect(result.retryable).toBe(false);
  });

  it('handles null error gracefully', () => {
    const result = classifyError(null);
    expect(result.code).toBe('unknown');
  });

  it('handles undefined error gracefully', () => {
    const result = classifyError(undefined);
    expect(result.code).toBe('unknown');
  });

  it('handles string errors', () => {
    const result = classifyError('Schema changed: table not found');
    expect(result.code).toBe('schema_mismatch');
  });

  it('extracts message from error.message property', () => {
    const result = classifyError({ message: 'Plan limit reached' });
    expect(result.code).toBe('quota_exceeded');
    expect(result.message).toBe('Plan limit reached');
  });
});

// ---------------------------------------------------------------------------
// getBackoffDelay tests
// ---------------------------------------------------------------------------

describe('getBackoffDelay', () => {
  it('returns 1 minute for first failure (index 0)', () => {
    expect(getBackoffDelay(0)).toBe(60_000);
  });

  it('returns 5 minutes for second failure (index 1)', () => {
    expect(getBackoffDelay(1)).toBe(300_000);
  });

  it('returns 15 minutes for third failure (index 2)', () => {
    expect(getBackoffDelay(2)).toBe(900_000);
  });

  it('returns 1 hour for fourth failure (index 3)', () => {
    expect(getBackoffDelay(3)).toBe(3_600_000);
  });

  it('returns 3 hours for fifth failure (index 4)', () => {
    expect(getBackoffDelay(4)).toBe(10_800_000);
  });

  it('returns 6 hours for sixth failure (index 5)', () => {
    expect(getBackoffDelay(5)).toBe(21_600_000);
  });

  it('returns null when max retries exceeded (index 6)', () => {
    expect(getBackoffDelay(6)).toBeNull();
  });

  it('returns null for any index beyond schedule length', () => {
    expect(getBackoffDelay(10)).toBeNull();
    expect(getBackoffDelay(100)).toBeNull();
  });

  it('has correct schedule values matching spec', () => {
    expect(BACKOFF_SCHEDULE).toEqual([
      60_000,     // 1 minute
      300_000,    // 5 minutes
      900_000,    // 15 minutes
      3_600_000,  // 1 hour
      10_800_000, // 3 hours
      21_600_000, // 6 hours
    ]);
  });
});

// ---------------------------------------------------------------------------
// handleSyncError integration tests
// ---------------------------------------------------------------------------

describe('handleSyncError', () => {
  const baseContext: SyncJobContext = {
    tenantId: 'tenant-1',
    connectionId: 'conn-1',
    traceId: 'trace-1',
    logger: mockLogger,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
  });

  it('sets sync_status to auth_required on 401 error', async () => {
    const healthData: ConnectionHealth = {
      last_success_at: '2026-01-01T00:00:00Z',
      last_error: null,
      consecutive_failures: 0,
      next_retry_at: null,
      records_synced: 100,
      records_failed: 0,
    };

    mockLimit.mockReturnValue([{ health: healthData, syncStatus: 'active' }]);

    await handleSyncError('conn-1', { status: 401, message: 'Unauthorized' }, baseContext);

    // Verify update was called
    expect(mockSet).toHaveBeenCalled();
    const setArgs = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.syncStatus).toBe('auth_required');

    // No retry should be scheduled for auth errors
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('sets sync_status to auth_required on 403 error', async () => {
    mockLimit.mockReturnValue([{
      health: { consecutive_failures: 0, last_error: null, next_retry_at: null, records_synced: 50, records_failed: 0, last_success_at: null },
      syncStatus: 'active',
    }]);

    await handleSyncError('conn-1', { status: 403, message: 'Forbidden' }, baseContext);

    const setArgs = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.syncStatus).toBe('auth_required');
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('schedules retry with backoff on platform_unavailable error', async () => {
    mockLimit.mockReturnValue([{
      health: { consecutive_failures: 0, last_error: null, next_retry_at: null, records_synced: 50, records_failed: 0, last_success_at: null },
      syncStatus: 'active',
    }]);

    await handleSyncError('conn-1', { status: 500, message: 'Server Error' }, baseContext);

    // Should schedule a retry
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const addArgs = mockQueueAdd.mock.calls[0]!;
    expect(addArgs[0]).toBe('retry-sync');
    expect(addArgs[2].delay).toBeGreaterThan(0);
  });

  it('marks as error after max retries exceeded', async () => {
    // After 6 consecutive failures, the 7th attempt exceeds the schedule
    mockLimit.mockReturnValue([{
      health: { consecutive_failures: 6, last_error: null, next_retry_at: null, records_synced: 50, records_failed: 0, last_success_at: null },
      syncStatus: 'active',
    }]);

    await handleSyncError('conn-1', { status: 503, message: 'Service Unavailable' }, baseContext);

    const setArgs = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.syncStatus).toBe('error');
    // No retry scheduled — max exceeded
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('handles connection not found gracefully', async () => {
    mockLimit.mockReturnValue([]);

    await handleSyncError('conn-missing', { status: 500, message: 'Error' }, baseContext);

    // Should log warning but not throw
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('handles rate_limited with backoff', async () => {
    mockLimit.mockReturnValue([{
      health: { consecutive_failures: 1, last_error: null, next_retry_at: null, records_synced: 50, records_failed: 0, last_success_at: null },
      syncStatus: 'active',
    }]);

    await handleSyncError('conn-1', { status: 429, message: 'Rate limited' }, baseContext);

    // Should schedule retry
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it('keeps current sync_status for partial_failure', async () => {
    mockLimit.mockReturnValue([{
      health: { consecutive_failures: 0, last_error: null, next_retry_at: null, records_synced: 50, records_failed: 0, last_success_at: null },
      syncStatus: 'active',
    }]);

    await handleSyncError('conn-1', new Error('Validation failed for record'), baseContext);

    const setArgs = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.syncStatus).toBe('active');
  });

  it('sets sync_status to error for schema_mismatch', async () => {
    mockLimit.mockReturnValue([{
      health: { consecutive_failures: 0, last_error: null, next_retry_at: null, records_synced: 50, records_failed: 0, last_success_at: null },
      syncStatus: 'active',
    }]);

    await handleSyncError('conn-1', new Error('Field not found: assignee'), baseContext);

    const setArgs = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.syncStatus).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// retryNow tests
// ---------------------------------------------------------------------------

describe('retryNow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd.mockResolvedValue(undefined);
  });

  it('resets consecutive_failures and enqueues P0 sync', async () => {
    mockLimit.mockReturnValue([{
      health: {
        consecutive_failures: 3,
        last_error: { code: 'platform_unavailable', message: 'Error', timestamp: '2026-01-01T00:00:00Z', retryable: true, details: {} },
        next_retry_at: '2026-01-01T01:00:00Z',
        records_synced: 50,
        records_failed: 5,
        last_success_at: '2026-01-01T00:00:00Z',
      },
    }]);

    await retryNow('conn-1', 'tenant-1', 'trace-1');

    // Verify health was reset
    const setArgs = mockSet.mock.calls[0]![0] as Record<string, unknown>;
    expect(setArgs.syncStatus).toBe('active');

    const healthArg = setArgs.health as unknown as ConnectionHealth;
    expect(healthArg.consecutive_failures).toBe(0);
    expect(healthArg.next_retry_at).toBeNull();

    // Verify P0 sync enqueued
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    const addArgs = mockQueueAdd.mock.calls[0]!;
    expect(addArgs[2].priority).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// pauseSync tests
// ---------------------------------------------------------------------------

describe('pauseSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets sync_status to paused', async () => {
    await pauseSync('conn-1', 'tenant-1');

    expect(mockSet).toHaveBeenCalledWith({ syncStatus: 'paused' });
  });
});
