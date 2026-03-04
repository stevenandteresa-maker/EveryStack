import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { FileOrphanCleanupJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import { FileOrphanCleanupProcessor } from '../file-orphan-cleanup';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockDelete = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
  files: {
    id: 'id',
    tenantId: 'tenant_id',
    archivedAt: 'archived_at',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNotNull: vi.fn((col: unknown) => ({ op: 'isNotNull', col })),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: 'sql',
    strings: [...strings],
    values,
  }),
}));

vi.mock('@everystack/shared/storage', () => ({
  fileThumbnailKey: vi.fn(
    (tenantId: string, fileId: string, size: number) =>
      `t/${tenantId}/files/${fileId}/thumb/${size}.webp`,
  ),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockStorage(): StorageClient {
  return {
    presignPut: vi.fn(),
    presignGet: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn().mockResolvedValue(undefined),
    headObject: vi.fn(),
    getStream: vi.fn(),
    put: vi.fn(),
  };
}

function createMockJob(
  overrides?: Partial<FileOrphanCleanupJobData>,
): Job<FileOrphanCleanupJobData> {
  return {
    id: 'job-1',
    name: 'file.orphan_cleanup',
    data: {
      tenantId: 'system',
      traceId: 'trace-1',
      triggeredBy: 'scheduler',
      olderThanMs: 30 * 24 * 60 * 60 * 1000, // 30 days
      batchSize: 100,
      ...overrides,
    },
  } as unknown as Job<FileOrphanCleanupJobData>;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<FileOrphanCleanupProcessor['processJob']>[1];

function mockFileRow(overrides?: Record<string, unknown>) {
  return {
    id: 'file-001',
    tenantId: 'tenant-001',
    storageKey: 't/tenant-001/files/file-001/original/photo.jpg',
    thumbnailKey: 't/tenant-001/files/file-001/thumb',
    sizeBytes: 1024000,
    archivedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileOrphanCleanupProcessor', () => {
  let storage: StorageClient;
  let processor: FileOrphanCleanupProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    storage = createMockStorage();
    processor = new FileOrphanCleanupProcessor(storage);
  });

  it('deletes files archived more than 30 days ago', async () => {
    const expiredFile = mockFileRow();

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([expiredFile]),
    };
    mockSelect.mockReturnValue(selectChain);

    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDelete.mockReturnValue(deleteChain);

    await processor.processJob(createMockJob(), mockLogger);

    // Should delete original + 2 thumbnails from storage
    expect(storage.deleteMany).toHaveBeenCalledWith([
      't/tenant-001/files/file-001/original/photo.jpg',
      't/tenant-001/files/file-001/thumb/200.webp',
      't/tenant-001/files/file-001/thumb/800.webp',
    ]);

    // Should hard-delete DB row
    expect(mockDelete).toHaveBeenCalled();
  });

  it('does not delete files archived less than 30 days ago', async () => {
    // Return empty — no files match the cutoff
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);

    await processor.processJob(createMockJob(), mockLogger);

    expect(storage.deleteMany).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('No orphaned files to clean up');
  });

  it('respects batch size from job data', async () => {
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockSelect.mockReturnValue(selectChain);

    await processor.processJob(createMockJob({ batchSize: 50 }), mockLogger);

    expect(selectChain.limit).toHaveBeenCalledWith(50);
  });

  it('skips thumbnail deletion when no thumbnails exist', async () => {
    const fileWithoutThumbs = mockFileRow({ thumbnailKey: null });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([fileWithoutThumbs]),
    };
    mockSelect.mockReturnValue(selectChain);

    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDelete.mockReturnValue(deleteChain);

    await processor.processJob(createMockJob(), mockLogger);

    // Should only delete original, not thumbnails
    expect(storage.deleteMany).toHaveBeenCalledWith([
      't/tenant-001/files/file-001/original/photo.jpg',
    ]);
  });

  it('continues processing remaining files on individual failure', async () => {
    const file1 = mockFileRow({ id: 'file-001' });
    const file2 = mockFileRow({
      id: 'file-002',
      storageKey: 't/tenant-001/files/file-002/original/doc.pdf',
      thumbnailKey: null,
    });

    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([file1, file2]),
    };
    mockSelect.mockReturnValue(selectChain);

    // First deleteMany fails, second succeeds
    vi.mocked(storage.deleteMany)
      .mockRejectedValueOnce(new Error('Storage error'))
      .mockResolvedValueOnce(undefined);

    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDelete.mockReturnValue(deleteChain);

    await processor.processJob(createMockJob(), mockLogger);

    // Should log error for file1 but continue with file2
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ fileId: 'file-001' }),
      expect.stringContaining('Failed to delete'),
    );

    // Should still attempt file2
    expect(storage.deleteMany).toHaveBeenCalledTimes(2);
  });
});
