import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAuthCtx,
  mockSelectWhere,
  mockDeleteWhere,
  mockUpdateSet,
  mockUpdateWhere,
  mockHeadObject,
  mockGetStream,
  mockStorageDelete,
  mockQueueAdd,
} = vi.hoisted(() => {
  return {
    mockAuthCtx: {
      userId: '00000000-0000-7000-8000-000000000001',
      tenantId: '00000000-0000-7000-8000-000000000002',
      clerkUserId: 'user_test123',
    },
    mockSelectWhere: vi.fn(),
    mockDeleteWhere: vi.fn().mockResolvedValue(undefined),
    mockUpdateSet: vi.fn(),
    mockUpdateWhere: vi.fn().mockResolvedValue(undefined),
    mockHeadObject: vi.fn(),
    mockGetStream: vi.fn(),
    mockStorageDelete: vi.fn().mockResolvedValue(undefined),
    mockQueueAdd: vi.fn().mockResolvedValue(undefined),
  };
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
      delete: vi.fn().mockReturnValue({
        where: mockDeleteWhere,
      }),
      update: vi.fn().mockReturnValue({
        set: mockUpdateSet.mockReturnValue({
          where: mockUpdateWhere,
        }),
      }),
    })),
  };
});

vi.mock('@everystack/shared/storage', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  class MockR2StorageClient {
    headObject = mockHeadObject;
    getStream = mockGetStream;
    delete = mockStorageDelete;
    presignPut = vi.fn().mockResolvedValue({
      url: 'https://storage.example.com/reupload',
      headers: { 'Content-Type': 'image/svg+xml' },
    });
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

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({
    add: mockQueueAdd,
  })),
}));

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

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response()));

const FILE_ID = '00000000-0000-7000-8000-000000000099';

const mockFileRow = {
  id: FILE_ID,
  tenantId: mockAuthCtx.tenantId,
  uploadedBy: mockAuthCtx.userId,
  storageKey: `t/${mockAuthCtx.tenantId}/files/${FILE_ID}/original/test.png`,
  originalFilename: 'test.png',
  mimeType: 'image/png',
  sizeBytes: 1024,
  checksumSha256: null,
  scanStatus: 'pending',
  contextType: 'record_attachment',
  contextId: null,
  thumbnailKey: null,
  metadata: {},
  createdAt: new Date('2026-01-01'),
  archivedAt: null,
};

function streamFromBytes(data: Uint8Array): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...new Array(100).fill(0)]);
const JPEG_BYTES = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, ...new Array(100).fill(0)]);

function makeRequest(): Request {
  return new Request(`http://localhost/api/upload/complete/${FILE_ID}`, {
    method: 'POST',
  });
}

function makeParams(): { params: Promise<{ fileId: string }> } {
  return { params: Promise.resolve({ fileId: FILE_ID }) };
}

const importRoute = () => import('../complete/[fileId]/route');

describe('POST /api/upload/complete/[fileId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectWhere.mockResolvedValue([mockFileRow]);
    mockHeadObject.mockResolvedValue({ size: 1024, contentType: 'image/png' });
    mockGetStream.mockResolvedValue(streamFromBytes(PNG_BYTES));
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  });

  it('completes upload, updates row, and enqueues jobs', async () => {
    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe(FILE_ID);
    expect(data.filename).toBe('test.png');
    expect(data.mimeType).toBe('image/png');
    expect(data.scanStatus).toBe('pending');

    // Should enqueue both scan and thumbnail (PNG is thumbnailable)
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
    expect(mockQueueAdd).toHaveBeenCalledWith('file.scan', expect.objectContaining({
      fileId: FILE_ID,
      storageKey: mockFileRow.storageKey,
    }));
    expect(mockQueueAdd).toHaveBeenCalledWith('file.thumbnail', expect.objectContaining({
      fileId: FILE_ID,
      mimeType: 'image/png',
    }));
  });

  it('returns 401 when unauthenticated', async () => {
    const { getAuthContext } = await import('@/lib/auth-context');
    vi.mocked(getAuthContext).mockRejectedValueOnce(new Error('No session'));

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when file not found', async () => {
    mockSelectWhere.mockResolvedValue([]);

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 when file belongs to different tenant (query returns empty)', async () => {
    mockSelectWhere.mockResolvedValue([]);

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(404);
  });

  it('returns 404 when file not in storage', async () => {
    mockHeadObject.mockResolvedValue(null);

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error.message).toContain('storage');
  });

  it('returns 422 on magic byte mismatch and deletes file', async () => {
    mockGetStream.mockResolvedValue(streamFromBytes(JPEG_BYTES));

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.code).toBe('VALIDATION_FAILED');
    expect(data.error.message).toContain('does not match');

    // Should delete storage object and DB row
    expect(mockStorageDelete).toHaveBeenCalled();
    expect(mockDeleteWhere).toHaveBeenCalled();

    // Should NOT enqueue any jobs
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('does not enqueue thumbnail for non-image types', async () => {
    const pdfRow = {
      ...mockFileRow,
      mimeType: 'application/pdf',
      originalFilename: 'doc.pdf',
    };
    mockSelectWhere.mockResolvedValue([pdfRow]);
    mockGetStream.mockResolvedValue(
      streamFromBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(100).fill(0)])),
    );

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    expect(response.status).toBe(200);

    // Only scan job, no thumbnail
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledWith('file.scan', expect.anything());
  });

  it('returns 422 on size mismatch', async () => {
    mockHeadObject.mockResolvedValue({ size: 2048, contentType: 'image/png' });

    const { POST } = await importRoute();
    const response = await POST(makeRequest(), makeParams());
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error.message).toContain('size');
  });
});
