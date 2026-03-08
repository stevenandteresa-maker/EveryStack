/**
 * Tests for sync-dashboard-actions server actions.
 *
 * Covers:
 * - syncNowAction: enqueue P0 sync for active connection
 * - pauseSyncAction: set syncStatus to paused
 * - resumeSyncAction: resume and enqueue P1 catch-up sync
 * - disconnectSyncAction: pause + clear tokens, requires admin
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks (IDs generated inside hoisted to avoid TDZ)
// ---------------------------------------------------------------------------

const {
  TENANT_ID,
  USER_ID,
  CONNECTION_ID,
  mockSelect,
  mockUpdate,
  mockTransaction,
  mockDb,
  mockGetAuthContext,
  mockRequireRole,
  mockWriteAuditLog,
  mockQueueAdd,
  mockGetQueue,
} = vi.hoisted(() => {
  const _TENANT_ID = crypto.randomUUID();
  const _USER_ID = crypto.randomUUID();
  const _CONNECTION_ID = crypto.randomUUID();

  // Chainable select mock
  const _mockLimit = vi.fn().mockResolvedValue([]);
  const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
  const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: _mockFrom });

  // Chainable update mock
  const _mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const _mockUpdateSet = vi.fn().mockReturnValue({ where: _mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockUpdateSet });

  // Transaction mock
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb({ select: mockSelect, update: mockUpdate });
  });

  // Queue mock
  const mockQueueAdd = vi.fn().mockResolvedValue(undefined);
  const mockGetQueue = vi.fn(() => ({ add: mockQueueAdd }));

  return {
    TENANT_ID: _TENANT_ID,
    USER_ID: _USER_ID,
    CONNECTION_ID: _CONNECTION_ID,
    mockSelect,
    mockUpdate,
    mockTransaction,
    mockDb: { select: mockSelect, update: mockUpdate, transaction: mockTransaction },
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: _USER_ID,
      tenantId: _TENANT_ID,
      clerkUserId: 'clerk-user-id',
      agencyTenantId: null,
    }),
    mockRequireRole: vi.fn().mockResolvedValue(undefined),
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
    mockQueueAdd,
    mockGetQueue,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/auth', () => ({
  requireRole: mockRequireRole,
}));

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('@/lib/errors', () => {
  class NotFoundError extends Error {
    code = 'NOT_FOUND';
    statusCode = 404;
    details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'NotFoundError';
      this.details = details;
    }
  }
  return {
    NotFoundError,
    wrapUnknownError: vi.fn((e: unknown) => e),
  };
});

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  baseConnections: {
    id: 'id',
    tenantId: 'tenant_id',
    syncStatus: 'sync_status',
    oauthTokens: 'oauth_tokens',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

vi.mock('@/lib/queue', () => ({
  getQueue: mockGetQueue,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  syncNowAction,
  pauseSyncAction,
  resumeSyncAction,
  disconnectSyncAction,
} from '../sync-dashboard-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupConnectionExists(overrides: Record<string, unknown> = {}) {
  const connection = { id: CONNECTION_ID, syncStatus: 'active', ...overrides };
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([connection]),
      }),
    }),
  }));
}

function setupConnectionNotFound() {
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }));
}

// ---------------------------------------------------------------------------
// syncNowAction
// ---------------------------------------------------------------------------

describe('syncNowAction', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues P0 sync job for active connection', async () => {
    setupConnectionExists({ syncStatus: 'active' });

    const result = await syncNowAction({ baseConnectionId: CONNECTION_ID });

    expect(result).toEqual({ success: true });
    expect(mockGetQueue).toHaveBeenCalledWith('sync');
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'sync.incremental',
      expect.objectContaining({
        tenantId: TENANT_ID,
        connectionId: CONNECTION_ID,
        triggeredBy: USER_ID,
      }),
      { priority: 0 },
    );
  });

  it('throws error when connection is paused', async () => {
    setupConnectionExists({ syncStatus: 'paused' });

    await expect(
      syncNowAction({ baseConnectionId: CONNECTION_ID }),
    ).rejects.toThrow('Cannot trigger sync on a paused connection');
  });

  it('throws NotFoundError when connection not found', async () => {
    setupConnectionNotFound();

    await expect(
      syncNowAction({ baseConnectionId: CONNECTION_ID }),
    ).rejects.toThrow('Connection not found');
  });

  it('requires manager role', async () => {
    setupConnectionExists();

    await syncNowAction({ baseConnectionId: CONNECTION_ID });

    expect(mockRequireRole).toHaveBeenCalledWith(
      USER_ID,
      TENANT_ID,
      undefined,
      'manager',
      'connection',
      'update',
    );
  });

  it('throws when user lacks permission', async () => {
    const permError = new Error('Permission denied');
    mockRequireRole.mockRejectedValueOnce(permError);

    await expect(
      syncNowAction({ baseConnectionId: CONNECTION_ID }),
    ).rejects.toThrow('Permission denied');
  });

  it('writes audit log after enqueuing sync', async () => {
    setupConnectionExists();

    await syncNowAction({ baseConnectionId: CONNECTION_ID });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_ID,
        actorType: 'user',
        actorId: USER_ID,
        action: 'connection.sync_now',
        entityType: 'connection',
        entityId: CONNECTION_ID,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// pauseSyncAction
// ---------------------------------------------------------------------------

describe('pauseSyncAction', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets syncStatus to paused and returns result', async () => {
    setupConnectionExists();

    const result = await pauseSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(result).toEqual({ success: true, syncStatus: 'paused' });
  });

  it('writes audit log', async () => {
    setupConnectionExists();

    await pauseSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_ID,
        actorType: 'user',
        actorId: USER_ID,
        action: 'connection.paused',
        entityType: 'connection',
        entityId: CONNECTION_ID,
      }),
    );
  });

  it('throws NotFoundError when connection not found', async () => {
    setupConnectionNotFound();

    await expect(
      pauseSyncAction({ baseConnectionId: CONNECTION_ID }),
    ).rejects.toThrow('Connection not found');
  });

  it('uses transaction for update and audit log', async () => {
    setupConnectionExists();

    await pauseSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockTransaction).toHaveBeenCalled();
  });

  it('requires manager role', async () => {
    setupConnectionExists();

    await pauseSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockRequireRole).toHaveBeenCalledWith(
      USER_ID,
      TENANT_ID,
      undefined,
      'manager',
      'connection',
      'update',
    );
  });
});

// ---------------------------------------------------------------------------
// resumeSyncAction
// ---------------------------------------------------------------------------

describe('resumeSyncAction', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets syncStatus to active and returns result', async () => {
    setupConnectionExists({ syncStatus: 'paused' });

    const result = await resumeSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(result).toEqual({ success: true, syncStatus: 'active' });
  });

  it('enqueues P1 catch-up sync job', async () => {
    setupConnectionExists({ syncStatus: 'paused' });

    await resumeSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockGetQueue).toHaveBeenCalledWith('sync');
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'sync.incremental',
      expect.objectContaining({
        tenantId: TENANT_ID,
        connectionId: CONNECTION_ID,
        triggeredBy: USER_ID,
      }),
      { priority: 1 },
    );
  });

  it('writes audit log', async () => {
    setupConnectionExists({ syncStatus: 'paused' });

    await resumeSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_ID,
        actorType: 'user',
        actorId: USER_ID,
        action: 'connection.resumed',
        entityType: 'connection',
        entityId: CONNECTION_ID,
      }),
    );
  });

  it('throws NotFoundError when connection not found', async () => {
    setupConnectionNotFound();

    await expect(
      resumeSyncAction({ baseConnectionId: CONNECTION_ID }),
    ).rejects.toThrow('Connection not found');
  });

  it('requires manager role', async () => {
    setupConnectionExists({ syncStatus: 'paused' });

    await resumeSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockRequireRole).toHaveBeenCalledWith(
      USER_ID,
      TENANT_ID,
      undefined,
      'manager',
      'connection',
      'update',
    );
  });
});

// ---------------------------------------------------------------------------
// disconnectSyncAction
// ---------------------------------------------------------------------------

describe('disconnectSyncAction', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets syncStatus to paused and clears oauthTokens', async () => {
    setupConnectionExists();

    const result = await disconnectSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('requires admin role (not manager)', async () => {
    setupConnectionExists();

    await disconnectSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockRequireRole).toHaveBeenCalledWith(
      USER_ID,
      TENANT_ID,
      undefined,
      'admin',
      'connection',
      'delete',
    );
  });

  it('writes audit log', async () => {
    setupConnectionExists();

    await disconnectSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_ID,
        actorType: 'user',
        actorId: USER_ID,
        action: 'connection.disconnected',
        entityType: 'connection',
        entityId: CONNECTION_ID,
      }),
    );
  });

  it('throws NotFoundError when connection not found', async () => {
    setupConnectionNotFound();

    await expect(
      disconnectSyncAction({ baseConnectionId: CONNECTION_ID }),
    ).rejects.toThrow('Connection not found');
  });

  it('does NOT delete data — only pauses and clears tokens', async () => {
    setupConnectionExists();

    await disconnectSyncAction({ baseConnectionId: CONNECTION_ID });

    // Verify transaction was used (update + audit within single tx)
    expect(mockTransaction).toHaveBeenCalled();

    // Verify no queue job was enqueued (disconnect does not trigger sync)
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('uses transaction for update and audit log', async () => {
    setupConnectionExists();

    await disconnectSyncAction({ baseConnectionId: CONNECTION_ID });

    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});
