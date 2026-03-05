import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mocks — hoisted by vitest before imports
// ---------------------------------------------------------------------------

const mockGetApiKeyByHash = vi.fn();

vi.mock('@/data/api-keys', () => ({
  getApiKeyByHash: (...args: unknown[]) => mockGetApiKeyByHash(...args),
}));

const mockHashApiKey = vi.fn((key: string) => `sha256_${key}`);
const mockDbUpdateWhere = vi.fn((_clause: unknown) =>
  Promise.resolve(undefined),
);
const mockDbUpdateSet = vi.fn((_values: unknown) => ({
  where: mockDbUpdateWhere,
}));
const mockDbUpdate = vi.fn((_table: unknown) => ({
  set: mockDbUpdateSet,
}));

vi.mock('@everystack/shared/db', () => ({
  hashApiKey: (key: string) => mockHashApiKey(key),
  API_KEY_PREFIXES: { live: 'esk_live_', test: 'esk_test_' },
  db: { update: (table: unknown) => mockDbUpdate(table) },
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  apiKeys: { id: 'id_col', lastUsedAt: 'last_used_at_col' },
}));

const mockLoggerWarn = vi.fn();

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

const mockNextResponseJson = vi.fn(
  (body: unknown, init?: { status?: number }) => ({
    status: init?.status ?? 200,
    json: async () => body,
  }),
);

vi.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) =>
      mockNextResponseJson(...(args as [unknown, { status?: number }?])),
  },
}));

import {
  authenticateApiKey,
  requireScope,
  withApiAuth,
  type ApiRequestContext,
} from './auth-middleware';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockRequest(
  headers: Record<string, string> = {},
): NextRequest {
  const normalizedHeaders = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    headers: {
      get: (key: string) =>
        normalizedHeaders.get(key.toLowerCase()) ?? null,
    },
  } as unknown as NextRequest;
}

function createActiveKeyRecord(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'key-uuid-001',
    tenantId: 'tenant-uuid-001',
    name: 'Test Key',
    keyHash: 'sha256_esk_test_abc123',
    keyPrefix: 'esk_test_abc1234',
    scopes: ['data:read', 'data:write'],
    rateLimitTier: 'standard',
    lastUsedAt: null,
    expiresAt: null,
    status: 'active',
    createdBy: 'user-uuid-001',
    revokedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// authenticateApiKey
// ---------------------------------------------------------------------------

describe('authenticateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKeyByHash.mockResolvedValue(createActiveKeyRecord());
  });

  it('returns ApiRequestContext for a valid key', async () => {
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    const ctx = await authenticateApiKey(request);

    expect(ctx.tenantId).toBe('tenant-uuid-001');
    expect(ctx.apiKeyId).toBe('key-uuid-001');
    expect(ctx.apiKeyScopes).toEqual(['data:read', 'data:write']);
    expect(ctx.rateLimitTier).toBe('standard');
    expect(ctx.actorLabel).toBeNull();
    expect(ctx.requestId).toMatch(/^req_[0-9a-f]{8}$/);
  }, 10_000);

  it('throws UNAUTHORIZED when Authorization header is missing', async () => {
    const request = createMockRequest({});

    await expect(authenticateApiKey(request)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }, 10_000);

  it('throws UNAUTHORIZED when Authorization has wrong scheme', async () => {
    const request = createMockRequest({
      authorization: 'Basic dXNlcjpwYXNz',
    });

    await expect(authenticateApiKey(request)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }, 10_000);

  it('throws UNAUTHORIZED for invalid key prefix', async () => {
    const request = createMockRequest({
      authorization: 'Bearer sk_invalid_abc123def456',
    });

    await expect(authenticateApiKey(request)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }, 10_000);

  it('throws UNAUTHORIZED when key is not found', async () => {
    mockGetApiKeyByHash.mockResolvedValue(null);

    const request = createMockRequest({
      authorization: 'Bearer esk_live_notfound123abc456def789ghi012jkl345mno678pqr901',
    });

    await expect(authenticateApiKey(request)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  }, 10_000);

  it('throws KEY_REVOKED for revoked key', async () => {
    mockGetApiKeyByHash.mockResolvedValue(
      createActiveKeyRecord({ status: 'revoked' }),
    );

    const request = createMockRequest({
      authorization: 'Bearer esk_test_revoked123abc456def789ghi012jkl345mno678pqr901',
    });

    await expect(authenticateApiKey(request)).rejects.toMatchObject({
      code: 'KEY_REVOKED',
      statusCode: 401,
    });
  }, 10_000);

  it('throws KEY_EXPIRED for expired key', async () => {
    mockGetApiKeyByHash.mockResolvedValue(
      createActiveKeyRecord({ expiresAt: new Date('2025-01-01') }),
    );

    const request = createMockRequest({
      authorization: 'Bearer esk_test_expired123abc456def789ghi012jkl345mno678pqr901',
    });

    await expect(authenticateApiKey(request)).rejects.toMatchObject({
      code: 'KEY_EXPIRED',
      statusCode: 401,
    });
  }, 10_000);

  it('extracts X-Actor-Label header', async () => {
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
      'x-actor-label': 'JobStack: plumber@acme.com',
    });

    const ctx = await authenticateApiKey(request);

    expect(ctx.actorLabel).toBe('JobStack: plumber@acme.com');
  }, 10_000);

  it('truncates X-Actor-Label to 255 chars', async () => {
    const longLabel = 'A'.repeat(300);

    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
      'x-actor-label': longLabel,
    });

    const ctx = await authenticateApiKey(request);

    expect(ctx.actorLabel).toHaveLength(255);
    expect(ctx.actorLabel).toBe('A'.repeat(255));
  }, 10_000);

  it('does not fail when last_used_at update errors', async () => {
    mockDbUpdateWhere.mockRejectedValueOnce(new Error('DB connection lost'));

    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    const ctx = await authenticateApiKey(request);
    expect(ctx.tenantId).toBe('tenant-uuid-001');

    // Give the fire-and-forget promise time to settle
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: 'key-uuid-001' }),
      'Failed to update last_used_at',
    );
  }, 10_000);

  it('generates unique requestId per call', async () => {
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    const ctx1 = await authenticateApiKey(request);
    const ctx2 = await authenticateApiKey(request);

    expect(ctx1.requestId).toMatch(/^req_[0-9a-f]{8}$/);
    expect(ctx2.requestId).toMatch(/^req_[0-9a-f]{8}$/);
    expect(ctx1.requestId).not.toBe(ctx2.requestId);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// requireScope
// ---------------------------------------------------------------------------

describe('requireScope', () => {
  const baseContext: ApiRequestContext = {
    tenantId: 'tenant-uuid-001',
    apiKeyId: 'key-uuid-001',
    apiKeyScopes: ['data:read', 'data:write'],
    rateLimitTier: 'standard',
    actorLabel: null,
    requestId: 'req_deadbeef',
  };

  it('passes when key has the required scope', () => {
    expect(() => requireScope(baseContext, 'data:read')).not.toThrow();
  });

  it('passes when key has any of multiple required scopes', () => {
    expect(() =>
      requireScope(baseContext, 'schema:read', 'data:write'),
    ).not.toThrow();
  });

  it('throws INSUFFICIENT_SCOPE when scope is missing', () => {
    expect(() => requireScope(baseContext, 'schema:write')).toThrow(
      expect.objectContaining({
        code: 'INSUFFICIENT_SCOPE',
        statusCode: 403,
      }),
    );
  });

  it('includes required and available scopes in error details', () => {
    try {
      requireScope(baseContext, 'schema:write', 'automation:write');
      expect.fail('Should have thrown');
    } catch (err: unknown) {
      const appErr = err as { details: Record<string, unknown> };
      expect(appErr.details).toEqual({
        required: ['schema:write', 'automation:write'],
        available: ['data:read', 'data:write'],
      });
    }
  });

  it('passes with admin scope regardless of required scope', () => {
    const adminContext: ApiRequestContext = {
      ...baseContext,
      apiKeyScopes: ['admin'],
    };

    expect(() => requireScope(adminContext, 'data:write')).not.toThrow();
    expect(() => requireScope(adminContext, 'schema:write')).not.toThrow();
    expect(() =>
      requireScope(adminContext, 'automation:trigger'),
    ).not.toThrow();
  });

  it('fails when key has only data:read but data:write is required', () => {
    const readOnlyContext: ApiRequestContext = {
      ...baseContext,
      apiKeyScopes: ['data:read'],
    };

    expect(() => requireScope(readOnlyContext, 'data:write')).toThrow(
      expect.objectContaining({
        code: 'INSUFFICIENT_SCOPE',
        statusCode: 403,
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// withApiAuth
// ---------------------------------------------------------------------------

describe('withApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetApiKeyByHash.mockResolvedValue(createActiveKeyRecord());
    mockNextResponseJson.mockImplementation(
      (body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        json: async () => body,
      }),
    );
  });

  it('calls handler with ApiRequestContext on success', async () => {
    const mockResponse = { status: 200, json: async () => ({ data: 'ok' }) };
    const handler = vi.fn().mockResolvedValue(mockResponse);

    const wrapped = withApiAuth(handler, 'data:read');
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    const result = await wrapped(request);

    expect(handler).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        tenantId: 'tenant-uuid-001',
        apiKeyId: 'key-uuid-001',
        apiKeyScopes: ['data:read', 'data:write'],
      }),
    );
    expect(result).toBe(mockResponse);
  }, 10_000);

  it('skips scope check when no required scopes specified', async () => {
    const mockResponse = { status: 200, json: async () => ({ data: 'ok' }) };
    const handler = vi.fn().mockResolvedValue(mockResponse);

    const wrapped = withApiAuth(handler);
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    await wrapped(request);

    expect(handler).toHaveBeenCalled();
  }, 10_000);

  it('returns 401 JSON response for auth failures', async () => {
    const handler = vi.fn();
    const wrapped = withApiAuth(handler);
    const request = createMockRequest({});

    await wrapped(request);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
      expect.objectContaining({ status: 401 }),
    );
    expect(handler).not.toHaveBeenCalled();
  }, 10_000);

  it('returns 403 JSON response for insufficient scope', async () => {
    const handler = vi.fn();
    const wrapped = withApiAuth(handler, 'schema:write');
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    await wrapped(request);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INSUFFICIENT_SCOPE' }),
      }),
      expect.objectContaining({ status: 403 }),
    );
    expect(handler).not.toHaveBeenCalled();
  }, 10_000);

  it('returns 500 JSON response for unexpected errors', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('unexpected'));
    const wrapped = withApiAuth(handler);
    const request = createMockRequest({
      authorization: 'Bearer esk_test_abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    });

    await wrapped(request);

    expect(mockNextResponseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
      }),
      expect.objectContaining({ status: 500 }),
    );
  }, 10_000);
});
