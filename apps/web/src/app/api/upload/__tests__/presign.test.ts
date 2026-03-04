import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuthCtx, mockSelectWhere, mockInsertValues, mockPresignPut } = vi.hoisted(() => {
  const mockAuthCtx = {
    userId: '00000000-0000-7000-8000-000000000001',
    tenantId: '00000000-0000-7000-8000-000000000002',
    clerkUserId: 'user_test123',
  };

  const mockSelectWhere = vi.fn();
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockPresignPut = vi.fn().mockResolvedValue({
    url: 'https://storage.example.com/presigned-url',
    headers: { 'Content-Type': 'image/png' },
  });

  return { mockAuthCtx, mockSelectWhere, mockInsertValues, mockPresignPut };
});

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: vi.fn().mockResolvedValue(mockAuthCtx),
}));

vi.mock('@everystack/shared/db', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@everystack/shared/db');
  return {
    ...actual,
    getDbForTenant: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: mockSelectWhere,
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: mockInsertValues,
      }),
    })),
    generateUUIDv7: vi.fn(() => '00000000-0000-7000-8000-000000000099'),
  };
});

vi.mock('@everystack/shared/storage', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  class MockR2StorageClient {
    presignPut = mockPresignPut;
  }
  return {
    ...actual,
    R2StorageClient: MockR2StorageClient,
    getStorageConfig: vi.fn(() => ({
      bucket: 'test-bucket',
      region: 'us-east-1',
      endpoint: 'http://localhost:9000',
      publicUrl: 'http://localhost:9000/test-bucket',
      accessKeyId: 'test',
      secretAccessKey: 'test',
    })),
  };
});

vi.mock('@everystack/shared/logging', () => {
  const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
  return {
    createLogger: vi.fn(() => noopLogger),
    createChildLogger: vi.fn(() => noopLogger),
    webLogger: noopLogger,
    workerLogger: noopLogger,
    realtimeLogger: noopLogger,
    getTraceId: vi.fn(() => 'test-trace-id'),
    getTenantIdFromTrace: vi.fn(),
    runWithTraceContext: vi.fn(),
    generateTraceId: vi.fn(() => 'test-trace-id'),
  };
});

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/upload/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  filename: 'test-image.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  contextType: 'record_attachment',
};

// Dynamic import to avoid module resolution during vi.mock hoisting
const importRoute = () => import('../presign/route');

describe('POST /api/upload/presign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: tenant query returns freelancer plan
    mockSelectWhere.mockResolvedValue([{ plan: 'freelancer' }]);
  });

  it('returns presigned URL for valid request', async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ plan: 'professional' }])
      .mockResolvedValueOnce([{ totalBytes: '0' }]);

    const { POST } = await importRoute();
    const response = await POST(makeRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.fileId).toBe('00000000-0000-7000-8000-000000000099');
    expect(data.presignedUrl).toBe('https://storage.example.com/presigned-url');
    expect(data.headers).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });

  it('returns 401 when unauthenticated', async () => {
    const { getAuthContext } = await import('@/lib/auth-context');
    vi.mocked(getAuthContext).mockRejectedValueOnce(new Error('No session'));

    const { POST } = await importRoute();
    const response = await POST(makeRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 for disallowed MIME type', async () => {
    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ ...validBody, mimeType: 'application/x-executable' }),
    );
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe('VALIDATION_FAILED');
    expect(data.error.message).toContain('not allowed');
  });

  it('returns 422 for mismatched extension', async () => {
    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ ...validBody, mimeType: 'image/png', filename: 'file.jpg' }),
    );
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe('VALIDATION_FAILED');
    expect(data.error.message).toContain('extension');
  });

  it('returns 422 when file exceeds plan limit', async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ plan: 'freelancer' }])
      .mockResolvedValueOnce([{ totalBytes: '0' }]);

    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ ...validBody, sizeBytes: 30 * 1024 * 1024 }),
    );
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.message).toContain('maximum size');
  });

  it('returns 422 when storage quota exceeded', async () => {
    // Reset and set up explicit mock chain for this test
    mockSelectWhere.mockReset();
    mockSelectWhere
      .mockResolvedValueOnce([{ plan: 'professional' }])
      .mockResolvedValueOnce([{ totalBytes: String(200 * 1024 * 1024 * 1024) }]);

    const { POST } = await importRoute();
    const response = await POST(makeRequest(validBody));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.message).toContain('quota');
  });

  it('returns 422 for missing required fields', async () => {
    const { POST } = await importRoute();
    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 422 for invalid contextType', async () => {
    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({ ...validBody, contextType: 'invalid_type' }),
    );
    expect(response.status).toBe(422);
  });

  it('accepts optional contextId as UUID', async () => {
    mockSelectWhere
      .mockResolvedValueOnce([{ plan: 'professional' }])
      .mockResolvedValueOnce([{ totalBytes: '0' }]);

    const { POST } = await importRoute();
    const response = await POST(
      makeRequest({
        ...validBody,
        contextId: '00000000-0000-7000-8000-000000000050',
      }),
    );

    expect(response.status).toBe(200);
  });
});
