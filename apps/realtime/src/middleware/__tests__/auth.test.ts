import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

vi.mock('@everystack/shared/db', () => ({
  dbRead: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
  eq: vi.fn((_col, val) => val),
  and: vi.fn((...args: unknown[]) => args),
  users: { id: 'users.id', clerkId: 'users.clerkId' },
  tenants: { id: 'tenants.id', clerkOrgId: 'tenants.clerkOrgId' },
  tenantMemberships: {
    id: 'tenantMemberships.id',
    userId: 'tenantMemberships.userId',
    tenantId: 'tenantMemberships.tenantId',
    status: 'tenantMemberships.status',
  },
}));

vi.mock('@everystack/shared/logging', () => ({
  realtimeLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import { verifyToken } from '@clerk/backend';
import { dbRead } from '@everystack/shared/db';
import { authenticateSocket } from '../auth';

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockSocket(token?: string) {
  return {
    id: 'socket-abc',
    handshake: {
      auth: token !== undefined ? { token } : {},
    },
    data: {} as Record<string, unknown>,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('authenticateSocket', () => {
  const mockVerifyToken = vi.mocked(verifyToken);
  const mockDbRead = vi.mocked(dbRead);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Helper to chain dbRead mocks for sequential calls. */
  function mockDbChain(results: unknown[][]) {
    let callIndex = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn(() => {
        const result = results[callIndex] ?? [];
        callIndex++;
        return Promise.resolve(result);
      }),
    };
    Object.assign(mockDbRead, chain);
  }

  it('sets userId and tenantId on socket.data for a valid token', async () => {
    const socket = createMockSocket('valid-jwt');
    const next = vi.fn();

    mockVerifyToken.mockResolvedValue({
      sub: 'clerk_user_123',
      org_id: undefined,
    } as ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never);

    // Call 1: resolve user → found
    // Call 2: fallback tenant membership → found
    mockDbChain([
      [{ id: 'internal-user-uuid' }],
      [{ tenantId: 'internal-tenant-uuid' }],
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authenticateSocket(socket as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data['userId']).toBe('internal-user-uuid');
    expect(socket.data['tenantId']).toBe('internal-tenant-uuid');
  });

  it('resolves tenant via clerkOrgId when present', async () => {
    const socket = createMockSocket('valid-jwt');
    const next = vi.fn();

    mockVerifyToken.mockResolvedValue({
      sub: 'clerk_user_123',
      org_id: 'org_abc',
    } as ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never);

    // Call 1: resolve user → found
    // Call 2: resolve tenant by clerkOrgId → found
    // Call 3: verify membership → found
    mockDbChain([
      [{ id: 'internal-user-uuid' }],
      [{ id: 'org-tenant-uuid' }],
      [{ id: 'membership-uuid' }],
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authenticateSocket(socket as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data['tenantId']).toBe('org-tenant-uuid');
  });

  it('rejects with AUTH_FAILED when token is missing', async () => {
    const socket = createMockSocket(undefined);
    const next = vi.fn();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authenticateSocket(socket as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('AUTH_FAILED');
  });

  it('rejects with AUTH_FAILED when token verification fails', async () => {
    const socket = createMockSocket('invalid-jwt');
    const next = vi.fn();

    mockVerifyToken.mockRejectedValue(new Error('Token expired'));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authenticateSocket(socket as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('AUTH_FAILED');
  });

  it('rejects with AUTH_FAILED when user is not found in database', async () => {
    const socket = createMockSocket('valid-jwt');
    const next = vi.fn();

    mockVerifyToken.mockResolvedValue({
      sub: 'clerk_user_unknown',
      org_id: undefined,
    } as ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never);

    // Call 1: resolve user → not found
    mockDbChain([[]]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authenticateSocket(socket as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('AUTH_FAILED');
  });

  it('rejects with AUTH_FAILED when user has no active tenant membership', async () => {
    const socket = createMockSocket('valid-jwt');
    const next = vi.fn();

    mockVerifyToken.mockResolvedValue({
      sub: 'clerk_user_123',
      org_id: undefined,
    } as ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never);

    // Call 1: resolve user → found
    // Call 2: fallback tenant membership → not found
    mockDbChain([[{ id: 'internal-user-uuid' }], []]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await authenticateSocket(socket as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect((next.mock.calls[0]?.[0] as Error).message).toBe('AUTH_FAILED');
  });
});
