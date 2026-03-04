import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { FileThumbnailJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import type { EventPublisher } from '@everystack/shared/realtime';
import { FileThumbnailProcessor } from '../file-thumbnail';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(),
  files: { id: 'id', tenantId: 'tenant_id', scanStatus: 'scan_status', archivedAt: 'archived_at' },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@everystack/shared/storage', () => ({
  fileThumbnailKey: vi.fn(
    (tenantId: string, fileId: string, size: number) =>
      `t/${tenantId}/files/${fileId}/thumb/${size}.webp`,
  ),
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    FILE_THUMBNAIL_READY: 'file.thumbnail_ready',
  },
}));

// Mock sharp module
const mockSharpInstance = {
  metadata: vi.fn(),
  rotate: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: vi.fn(),
  raw: vi.fn().mockReturnThis(),
  ensureAlpha: vi.fn().mockReturnThis(),
};
vi.mock('sharp', () => ({
  default: vi.fn(() => mockSharpInstance),
}));

// Mock blurhash
vi.mock('blurhash', () => ({
  encode: vi.fn(() => 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.'),
}));

const { getDbForTenant } = await import('@everystack/shared/db');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStorage(): StorageClient {
  return {
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    headObject: vi.fn(),
    getStream: vi.fn(),
    put: vi.fn(),
  };
}

function createMockPublisher(): EventPublisher {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventPublisher;
}

function createMockJob(
  overrides?: Partial<FileThumbnailJobData>,
): Job<FileThumbnailJobData> {
  return {
    id: 'job-1',
    name: 'file.thumbnail',
    data: {
      fileId: 'file-001',
      tenantId: 'tenant-001',
      mimeType: 'image/jpeg',
      traceId: 'trace-1',
      triggeredBy: 'upload-pipeline',
      ...overrides,
    },
  } as unknown as Job<FileThumbnailJobData>;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<FileThumbnailProcessor['processJob']>[1];

// Small 2x2 test PNG as buffer
const TEST_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function mockSelectChain(result: unknown[]) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(result);
  return chain;
}

function mockUpdateChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.update = vi.fn().mockReturnValue(chain);
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileThumbnailProcessor', () => {
  let storage: StorageClient;
  let publisher: EventPublisher;
  let processor: FileThumbnailProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createMockStorage();
    publisher = createMockPublisher();
    processor = new FileThumbnailProcessor(storage, publisher);

    // Default mock: readable stream that returns a buffer
    vi.mocked(storage.getStream).mockResolvedValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(TEST_BUFFER);
          controller.close();
        },
      }),
    );

    // Default sharp mocks
    mockSharpInstance.metadata.mockResolvedValue({
      width: 1920,
      height: 1080,
    });

    const thumbBuffer = Buffer.from('webp-thumb-data');
    mockSharpInstance.toBuffer.mockResolvedValue({
      data: thumbBuffer,
      info: { width: 200, height: 113, channels: 4, format: 'webp', size: 100 },
    });
  });

  it('generates 200px and 800px WebP thumbnails', async () => {
    const readDb = mockSelectChain([
      {
        id: 'file-001',
        tenantId: 'tenant-001',
        storageKey: 't/tenant-001/files/file-001/original/photo.jpg',
        scanStatus: 'pending',
        metadata: {},
        originalFilename: 'photo.jpg',
      },
    ]);
    const writeDb = mockUpdateChain();

    vi.mocked(getDbForTenant)
      .mockReturnValueOnce(readDb as never)
      .mockReturnValueOnce(writeDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    // Should upload 2 thumbnails (200px + 800px)
    expect(storage.put).toHaveBeenCalledTimes(2);
    expect(storage.put).toHaveBeenCalledWith(
      't/tenant-001/files/file-001/thumb/200.webp',
      expect.any(Buffer),
      'image/webp',
    );
    expect(storage.put).toHaveBeenCalledWith(
      't/tenant-001/files/file-001/thumb/800.webp',
      expect.any(Buffer),
      'image/webp',
    );
  });

  it('generates blurhash from 200px thumbnail', async () => {
    const readDb = mockSelectChain([
      {
        id: 'file-001',
        tenantId: 'tenant-001',
        storageKey: 't/tenant-001/files/file-001/original/photo.jpg',
        scanStatus: 'clean',
        metadata: {},
        originalFilename: 'photo.jpg',
      },
    ]);
    const writeDb = mockUpdateChain();

    vi.mocked(getDbForTenant)
      .mockReturnValueOnce(readDb as never)
      .mockReturnValueOnce(writeDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    // writeDb.update should include blurhash in metadata
    expect(writeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailKey: 't/tenant-001/files/file-001/thumb',
        metadata: expect.objectContaining({
          blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.',
        }),
      }),
    );
  });

  it('skips images exceeding 50MP with warning', async () => {
    // 10000 x 6000 = 60MP > 50MP limit
    mockSharpInstance.metadata.mockResolvedValue({
      width: 10000,
      height: 6000,
    });

    const readDb = mockSelectChain([
      {
        id: 'file-001',
        tenantId: 'tenant-001',
        storageKey: 't/tenant-001/files/file-001/original/huge.jpg',
        scanStatus: 'clean',
        metadata: {},
        originalFilename: 'huge.jpg',
      },
    ]);

    vi.mocked(getDbForTenant).mockReturnValueOnce(readDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    // No thumbnails should be uploaded
    expect(storage.put).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ pixels: 60000000, maxPixels: 50000000 }),
      expect.stringContaining('50MP'),
    );
  });

  it('skips infected files', async () => {
    const readDb = mockSelectChain([
      {
        id: 'file-001',
        tenantId: 'tenant-001',
        storageKey: 't/tenant-001/files/file-001/original/bad.jpg',
        scanStatus: 'infected',
        metadata: {},
        originalFilename: 'bad.jpg',
      },
    ]);

    vi.mocked(getDbForTenant).mockReturnValueOnce(readDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    expect(storage.getStream).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-001' }),
      expect.stringContaining('infected'),
    );
  });

  it('skips when file not found', async () => {
    const readDb = mockSelectChain([]);
    vi.mocked(getDbForTenant).mockReturnValueOnce(readDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    expect(storage.getStream).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-001' }),
      expect.stringContaining('not found'),
    );
  });

  it('publishes file.thumbnail_ready event after success', async () => {
    const readDb = mockSelectChain([
      {
        id: 'file-001',
        tenantId: 'tenant-001',
        storageKey: 't/tenant-001/files/file-001/original/photo.jpg',
        scanStatus: 'clean',
        metadata: {},
        originalFilename: 'photo.jpg',
      },
    ]);
    const writeDb = mockUpdateChain();

    vi.mocked(getDbForTenant)
      .mockReturnValueOnce(readDb as never)
      .mockReturnValueOnce(writeDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-001',
        event: 'file.thumbnail_ready',
        payload: expect.objectContaining({ fileId: 'file-001' }),
      }),
    );
  });
});
