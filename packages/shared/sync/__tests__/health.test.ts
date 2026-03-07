import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deriveSyncHealthState,
  updateConnectionHealth,
  DEFAULT_CONNECTION_HEALTH,
} from '../health';
import { ConnectionHealthSchema, SyncErrorSchema } from '../types';
import type { ConnectionHealth, SyncError } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHealth(overrides?: Partial<ConnectionHealth>): ConnectionHealth {
  return { ...DEFAULT_CONNECTION_HEALTH, ...overrides };
}

function makeError(overrides?: Partial<SyncError>): SyncError {
  return {
    code: 'unknown',
    message: 'Something went wrong',
    timestamp: '2026-01-15T10:00:00.000Z',
    retryable: false,
    details: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

describe('ConnectionHealthSchema', () => {
  it('validates a valid ConnectionHealth object', () => {
    const health = makeHealth({
      last_success_at: '2026-01-15T10:00:00.000Z',
      consecutive_failures: 0,
      records_synced: 100,
    });
    const result = ConnectionHealthSchema.safeParse(health);
    expect(result.success).toBe(true);
  });

  it('validates with null fields', () => {
    const result = ConnectionHealthSchema.safeParse(DEFAULT_CONNECTION_HEALTH);
    expect(result.success).toBe(true);
  });

  it('rejects negative consecutive_failures', () => {
    const result = ConnectionHealthSchema.safeParse({
      ...DEFAULT_CONNECTION_HEALTH,
      consecutive_failures: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer consecutive_failures', () => {
    const result = ConnectionHealthSchema.safeParse({
      ...DEFAULT_CONNECTION_HEALTH,
      consecutive_failures: 1.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('SyncErrorSchema', () => {
  it('validates a valid SyncError', () => {
    const result = SyncErrorSchema.safeParse(makeError());
    expect(result.success).toBe(true);
  });

  it('validates all error codes', () => {
    const codes = [
      'auth_expired', 'rate_limited', 'platform_unavailable',
      'schema_mismatch', 'permission_denied', 'partial_failure',
      'quota_exceeded', 'unknown',
    ];
    for (const code of codes) {
      const result = SyncErrorSchema.safeParse(makeError({ code: code as SyncError['code'] }));
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid error code', () => {
    const result = SyncErrorSchema.safeParse(makeError({ code: 'invalid' as SyncError['code'] }));
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deriveSyncHealthState
// ---------------------------------------------------------------------------

describe('deriveSyncHealthState', () => {
  const DEFAULT_POLLING = 300; // 5 minutes
  const now = new Date('2026-01-15T10:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "paused" when syncStatus is paused (highest priority)', () => {
    const result = deriveSyncHealthState(
      'paused',
      makeHealth({ last_error: makeError() }),
      new Date('2026-01-15T09:50:00.000Z'),
      DEFAULT_POLLING,
      5, // pending conflicts
      true, // syncing
    );
    expect(result).toBe('paused');
  });

  it('returns "auth_required" when syncStatus is auth_required', () => {
    const result = deriveSyncHealthState(
      'auth_required',
      null,
      null,
      DEFAULT_POLLING,
      0,
      true,
    );
    expect(result).toBe('auth_required');
  });

  it('returns "syncing" when isSyncing is true', () => {
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:55:00.000Z'),
      DEFAULT_POLLING,
      0,
      true,
    );
    expect(result).toBe('syncing');
  });

  it('returns "error" for non-retryable error in health', () => {
    const health = makeHealth({
      last_error: makeError({ retryable: false }),
      consecutive_failures: 3,
    });
    const result = deriveSyncHealthState(
      'active',
      health,
      new Date('2026-01-15T09:55:00.000Z'),
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('error');
  });

  it('returns "retrying" for retryable error with next_retry_at', () => {
    const health = makeHealth({
      last_error: makeError({ retryable: true }),
      consecutive_failures: 2,
      next_retry_at: '2026-01-15T10:05:00.000Z',
    });
    const result = deriveSyncHealthState(
      'active',
      health,
      new Date('2026-01-15T09:55:00.000Z'),
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('retrying');
  });

  it('returns "error" when syncStatus column is "error" (even without health details)', () => {
    const result = deriveSyncHealthState(
      'error',
      null,
      new Date('2026-01-15T09:55:00.000Z'),
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('error');
  });

  it('returns "conflicts" when pendingConflictCount > 0', () => {
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:58:00.000Z'),
      DEFAULT_POLLING,
      3,
      false,
    );
    expect(result).toBe('conflicts');
  });

  it('returns "stale" when lastSyncAt is older than 2x polling interval', () => {
    // 2x 300s = 600s = 10 minutes. Last sync was 15 minutes ago.
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:45:00.000Z'), // 15 min ago
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('stale');
  });

  it('returns "healthy" when recently synced and no issues', () => {
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:58:00.000Z'), // 2 min ago
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('healthy');
  });

  it('returns "healthy" when exactly at staleness boundary', () => {
    // Exactly 10 minutes ago (2x 300s). Not > threshold, so healthy.
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:50:00.000Z'),
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('healthy');
  });

  it('returns "stale" when 1ms past staleness boundary', () => {
    // 10 minutes + 1ms ago
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:49:59.999Z'),
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('stale');
  });

  it('returns "healthy" when lastSyncAt is null and no errors', () => {
    const result = deriveSyncHealthState(
      'active',
      null,
      null,
      DEFAULT_POLLING,
      0,
      false,
    );
    expect(result).toBe('healthy');
  });

  it('errors take priority over conflicts', () => {
    const health = makeHealth({
      last_error: makeError({ retryable: false }),
    });
    const result = deriveSyncHealthState(
      'active',
      health,
      new Date('2026-01-15T09:58:00.000Z'),
      DEFAULT_POLLING,
      5,
      false,
    );
    expect(result).toBe('error');
  });

  it('conflicts take priority over staleness', () => {
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:45:00.000Z'),
      DEFAULT_POLLING,
      3,
      false,
    );
    expect(result).toBe('conflicts');
  });

  it('uses custom polling interval for staleness calculation', () => {
    // 30s interval → 60s threshold. Last sync 90s ago → stale
    const result = deriveSyncHealthState(
      'active',
      null,
      new Date('2026-01-15T09:58:30.000Z'), // 90s ago
      30,
      0,
      false,
    );
    expect(result).toBe('stale');
  });
});

// ---------------------------------------------------------------------------
// updateConnectionHealth
// ---------------------------------------------------------------------------

describe('updateConnectionHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('sync_success', () => {
    it('resets consecutive_failures and clears last_error', () => {
      const existing = makeHealth({
        consecutive_failures: 3,
        last_error: makeError(),
        next_retry_at: '2026-01-15T10:05:00.000Z',
      });

      const result = updateConnectionHealth(existing, 'sync_success', {
        records_synced: 150,
      });

      expect(result.consecutive_failures).toBe(0);
      expect(result.last_error).toBeNull();
      expect(result.next_retry_at).toBeNull();
      expect(result.records_synced).toBe(150);
      expect(result.records_failed).toBe(0);
      expect(result.last_success_at).toBe('2026-01-15T10:00:00.000Z');
    });

    it('handles null existing health', () => {
      const result = updateConnectionHealth(null, 'sync_success', {
        records_synced: 50,
      });

      expect(result.consecutive_failures).toBe(0);
      expect(result.last_error).toBeNull();
      expect(result.records_synced).toBe(50);
    });

    it('preserves existing records_synced when not provided', () => {
      const existing = makeHealth({ records_synced: 200 });
      const result = updateConnectionHealth(existing, 'sync_success');
      expect(result.records_synced).toBe(200);
    });
  });

  describe('sync_error', () => {
    it('increments consecutive_failures and sets last_error', () => {
      const existing = makeHealth({ consecutive_failures: 2 });

      const result = updateConnectionHealth(existing, 'sync_error', {
        code: 'rate_limited',
        message: 'Too many requests',
        retryable: true,
      });

      expect(result.consecutive_failures).toBe(3);
      expect(result.last_error).not.toBeNull();
      expect(result.last_error!.code).toBe('rate_limited');
      expect(result.last_error!.message).toBe('Too many requests');
      expect(result.last_error!.retryable).toBe(true);
    });

    it('handles null existing health on error', () => {
      const result = updateConnectionHealth(null, 'sync_error', {
        code: 'auth_expired',
        message: 'Token expired',
        retryable: false,
      });

      expect(result.consecutive_failures).toBe(1);
      expect(result.last_error!.code).toBe('auth_expired');
    });

    it('defaults to "unknown" error code when not provided', () => {
      const result = updateConnectionHealth(null, 'sync_error');
      expect(result.last_error!.code).toBe('unknown');
      expect(result.last_error!.retryable).toBe(false);
    });

    it('preserves last_success_at on error', () => {
      const existing = makeHealth({
        last_success_at: '2026-01-15T09:00:00.000Z',
      });

      const result = updateConnectionHealth(existing, 'sync_error', {
        code: 'platform_unavailable',
        retryable: true,
      });

      expect(result.last_success_at).toBe('2026-01-15T09:00:00.000Z');
    });

    it('tracks records_failed count', () => {
      const result = updateConnectionHealth(null, 'sync_error', {
        code: 'partial_failure',
        retryable: true,
        records_failed: 12,
      });

      expect(result.records_failed).toBe(12);
    });
  });
});
