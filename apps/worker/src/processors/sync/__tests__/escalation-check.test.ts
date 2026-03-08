/**
 * Tests for escalation-check.ts
 *
 * Covers:
 * - 1-hour downtime notification (email to Owner)
 * - 6-hour escalation notification (email to Owner + Admins)
 * - Paused connections are skipped
 * - Deduplication prevents repeat notifications
 * - Healthy connections are not notified
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processEscalationCheck } from '../escalation-check';
import type { Job } from 'bullmq';
import type { EscalationCheckJobData } from '../escalation-check';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSendNotification = vi.fn().mockResolvedValue(undefined);
const mockIsDuplicate = vi.fn().mockResolvedValue(false);
const mockMarkSent = vi.fn().mockResolvedValue(undefined);

vi.mock('@everystack/shared/sync', () => ({
  ConnectionHealthSchema: {
    safeParse: vi.fn((data: unknown) => {
      if (data && typeof data === 'object' && 'last_success_at' in (data as Record<string, unknown>)) {
        return { success: true, data };
      }
      return { success: false };
    }),
  },
  sendSyncNotification: (...args: unknown[]) => mockSendNotification(...args),
  isDuplicateNotification: (...args: unknown[]) => mockIsDuplicate(...args),
  markNotificationSent: (...args: unknown[]) => mockMarkSent(...args),
}));

const mockTenants = [{ id: 'tenant-1' }];
const mockConnections: Array<Record<string, unknown>> = [];

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    select: () => ({
      from: (table: unknown) => {
        // Determine if querying tenants or base_connections
        if (table === 'tenants') {
          return Promise.resolve(mockTenants);
        }
        return {
          where: () => Promise.resolve(mockConnections),
        };
      },
    }),
  })),
  baseConnections: 'base_connections',
  tenants: 'tenants',
  eq: vi.fn(),
}));

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createJob(data: Partial<EscalationCheckJobData> = {}): Job<EscalationCheckJobData> {
  return {
    data: {
      tenantId: 'system',
      traceId: 'trace-1',
      triggeredBy: 'system:scheduler',
      jobType: 'escalation_check',
      ...data,
    },
  } as Job<EscalationCheckJobData>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processEscalationCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnections.length = 0;
    mockIsDuplicate.mockResolvedValue(false);
  });

  it('sends sync_down_1h notification when downtime exceeds 1 hour', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockConnections.push({
      id: 'conn-1',
      health: {
        last_success_at: twoHoursAgo,
        last_error: null,
        consecutive_failures: 0,
        next_retry_at: null,
        records_synced: 100,
        records_failed: 0,
      },
      syncStatus: 'error',
      platform: 'airtable',
    });

    await processEscalationCheck(createJob());

    expect(mockSendNotification).toHaveBeenCalledWith(
      'tenant-1',
      'sync_down_1h',
      expect.objectContaining({ connectionId: 'conn-1', platform: 'airtable' }),
      'trace-1',
    );
    expect(mockMarkSent).toHaveBeenCalledWith('tenant-1', 'sync_down_1h', 'conn-1');
  });

  it('sends sync_down_6h notification when downtime exceeds 6 hours', async () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    mockConnections.push({
      id: 'conn-2',
      health: {
        last_success_at: sevenHoursAgo,
        last_error: null,
        consecutive_failures: 0,
        next_retry_at: null,
        records_synced: 50,
        records_failed: 0,
      },
      syncStatus: 'error',
      platform: 'notion',
    });

    await processEscalationCheck(createJob());

    expect(mockSendNotification).toHaveBeenCalledWith(
      'tenant-1',
      'sync_down_6h',
      expect.objectContaining({ connectionId: 'conn-2', platform: 'notion' }),
      'trace-1',
    );
  });

  it('skips paused connections', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockConnections.push({
      id: 'conn-3',
      health: {
        last_success_at: twoHoursAgo,
        last_error: null,
        consecutive_failures: 0,
        next_retry_at: null,
        records_synced: 0,
        records_failed: 0,
      },
      syncStatus: 'paused',
      platform: 'airtable',
    });

    await processEscalationCheck(createJob());

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('skips duplicate notifications', async () => {
    mockIsDuplicate.mockResolvedValue(true);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockConnections.push({
      id: 'conn-4',
      health: {
        last_success_at: twoHoursAgo,
        last_error: null,
        consecutive_failures: 0,
        next_retry_at: null,
        records_synced: 0,
        records_failed: 0,
      },
      syncStatus: 'error',
      platform: 'airtable',
    });

    await processEscalationCheck(createJob());

    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it('does not notify for healthy connections', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    mockConnections.push({
      id: 'conn-5',
      health: {
        last_success_at: fiveMinutesAgo,
        last_error: null,
        consecutive_failures: 0,
        next_retry_at: null,
        records_synced: 100,
        records_failed: 0,
      },
      syncStatus: 'active',
      platform: 'airtable',
    });

    await processEscalationCheck(createJob());

    expect(mockSendNotification).not.toHaveBeenCalled();
  });
});
