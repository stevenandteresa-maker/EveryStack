import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockUpdate,
  mockTransaction,
  mockDb,
  mockGetAuthContext,
  mockRequireRole,
  mockWriteAuditLog,
} = vi.hoisted(() => {
  // Chainable select mock
  const _mockLimit = vi.fn().mockResolvedValue([]);
  const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
  const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: _mockFrom });

  // Chainable update mock
  const _mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const _mockUpdateSet = vi.fn().mockReturnValue({ where: _mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockUpdateSet });

  // Transaction mock — executes the callback with the tx
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb({ select: mockSelect, update: mockUpdate });
  });

  return {
    mockSelect,
    mockUpdate,
    mockTransaction,
    mockDb: { select: mockSelect, update: mockUpdate, transaction: mockTransaction },
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      clerkUserId: 'clerk-1',
      agencyTenantId: null,
    }),
    mockRequireRole: vi.fn().mockResolvedValue(undefined),
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
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
    conflictResolution: 'conflict_resolution',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

import { toggleManualConflictResolution } from '../sync-settings';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_CONN_ID = 'a1234567-89ab-4def-8123-456789abcde0';
const TABLE_ID = 'b1234567-89ab-4def-8123-456789abcde1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupConnectionExists() {
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ id: BASE_CONN_ID }]),
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
// Tests
// ---------------------------------------------------------------------------

describe('toggleManualConflictResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe('input validation', () => {
    it('rejects invalid baseConnectionId', async () => {
      await expect(
        toggleManualConflictResolution({
          baseConnectionId: 'not-a-uuid',
          tableId: TABLE_ID,
          enabled: true,
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid tableId', async () => {
      await expect(
        toggleManualConflictResolution({
          baseConnectionId: BASE_CONN_ID,
          tableId: 'bad',
          enabled: true,
        }),
      ).rejects.toThrow();
    });

    it('rejects missing enabled field', async () => {
      await expect(
        toggleManualConflictResolution({
          baseConnectionId: BASE_CONN_ID,
          tableId: TABLE_ID,
        } as never),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Permission check
  // -------------------------------------------------------------------------

  describe('permission check', () => {
    it('requires manager role with connection:update permission', async () => {
      setupConnectionExists();

      await toggleManualConflictResolution({
        baseConnectionId: BASE_CONN_ID,
        tableId: TABLE_ID,
        enabled: true,
      });

      expect(mockRequireRole).toHaveBeenCalledWith(
        'user-1',
        'tenant-1',
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
        toggleManualConflictResolution({
          baseConnectionId: BASE_CONN_ID,
          tableId: TABLE_ID,
          enabled: true,
        }),
      ).rejects.toThrow('Permission denied');
    });
  });

  // -------------------------------------------------------------------------
  // Toggle behavior
  // -------------------------------------------------------------------------

  describe('toggle behavior', () => {
    it('enables manual mode (enabled: true)', async () => {
      setupConnectionExists();

      const result = await toggleManualConflictResolution({
        baseConnectionId: BASE_CONN_ID,
        tableId: TABLE_ID,
        enabled: true,
      });

      expect(result).toEqual({
        baseConnectionId: BASE_CONN_ID,
        enabled: true,
      });

      // Verify update was called
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('disables manual mode (enabled: false)', async () => {
      setupConnectionExists();

      const result = await toggleManualConflictResolution({
        baseConnectionId: BASE_CONN_ID,
        tableId: TABLE_ID,
        enabled: false,
      });

      expect(result).toEqual({
        baseConnectionId: BASE_CONN_ID,
        enabled: false,
      });
    });

    it('writes audit log with conflict resolution details', async () => {
      setupConnectionExists();

      await toggleManualConflictResolution({
        baseConnectionId: BASE_CONN_ID,
        tableId: TABLE_ID,
        enabled: true,
      });

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorType: 'user',
          actorId: 'user-1',
          action: 'connection.conflict_resolution_updated',
          entityType: 'connection',
          entityId: BASE_CONN_ID,
          details: { conflictResolution: 'manual', tableId: TABLE_ID },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Not found
  // -------------------------------------------------------------------------

  describe('not found', () => {
    it('throws NotFoundError when connection does not exist', async () => {
      setupConnectionNotFound();

      await expect(
        toggleManualConflictResolution({
          baseConnectionId: BASE_CONN_ID,
          tableId: TABLE_ID,
          enabled: true,
        }),
      ).rejects.toThrow('Connection not found');
    });
  });
});
