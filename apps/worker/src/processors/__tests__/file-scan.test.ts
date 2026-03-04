import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { FileScanJobData } from '@everystack/shared/queue';
import type { StorageClient } from '@everystack/shared/storage';
import type { EventPublisher } from '@everystack/shared/realtime';
import { FileScanProcessor } from '../file-scan';

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
  quarantineKey: vi.fn(
    (tenantId: string, fileId: string, filename: string) =>
      `t/${tenantId}/quarantine/${fileId}/${filename}`,
  ),
  FILE_AUDIT_ACTIONS: {
    UPLOADED: 'file.uploaded',
    ACCESSED: 'file.accessed',
    DELETED: 'file.deleted',
    QUARANTINED: 'file.quarantined',
  },
  writeFileAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    FILE_SCAN_COMPLETE: 'file.scan_complete',
  },
}));

const mockScanBuffer = vi.fn();
vi.mock('../../lib/clamav-client', () => ({
  scanBuffer: (...args: unknown[]) => mockScanBuffer(...args),
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
  overrides?: Partial<FileScanJobData>,
): Job<FileScanJobData> {
  return {
    id: 'job-1',
    name: 'file.scan',
    data: {
      fileId: 'file-001',
      tenantId: 'tenant-001',
      storageKey: 't/tenant-001/files/file-001/original/document.pdf',
      traceId: 'trace-1',
      triggeredBy: 'upload-pipeline',
      ...overrides,
    },
  } as unknown as Job<FileScanJobData>;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Parameters<FileScanProcessor['processJob']>[1];

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

const FILE_ROW = {
  id: 'file-001',
  tenantId: 'tenant-001',
  storageKey: 't/tenant-001/files/file-001/original/document.pdf',
  scanStatus: 'pending',
  originalFilename: 'document.pdf',
  metadata: {},
};

/**
 * Sets up getDbForTenant mock for standard scan flow.
 * Returns readDb (for file lookup) and writeDb (for scan status update).
 */
function setupFileFound() {
  // Reset any leftover mockReturnValueOnce from previous tests
  vi.mocked(getDbForTenant).mockReset();

  const readDb = mockSelectChain([FILE_ROW]);
  const writeDb = mockUpdateChain();

  vi.mocked(getDbForTenant)
    .mockReturnValueOnce(readDb as never)
    .mockReturnValueOnce(writeDb as never);

  return { readDb, writeDb };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileScanProcessor', () => {
  let storage: StorageClient;
  let publisher: EventPublisher;
  let processor: FileScanProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDbForTenant).mockReset();
    storage = createMockStorage();
    publisher = createMockPublisher();
    processor = new FileScanProcessor(storage, publisher);

    vi.mocked(storage.getStream).mockResolvedValue(
      new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('test file content'));
          controller.close();
        },
      }),
    );
  });

  it('sets scan_status to clean when ClamAV returns OK', async () => {
    const { writeDb } = setupFileFound();
    mockScanBuffer.mockResolvedValue({ isInfected: false });

    await processor.processJob(createMockJob(), mockLogger);

    expect(writeDb.set).toHaveBeenCalledWith({ scanStatus: 'clean' });
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'file.scan_complete',
        payload: expect.objectContaining({ scanStatus: 'clean' }),
      }),
    );
  });

  it('quarantines infected files', async () => {
    // Quarantine flow: read file (1st) → quarantine update (2nd)
    const { writeDb } = setupFileFound();

    mockScanBuffer.mockResolvedValue({
      isInfected: true,
      virusName: 'Eicar-Test-Signature',
    });

    await processor.processJob(createMockJob(), mockLogger);

    // Should upload to quarantine location
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringContaining('quarantine'),
      expect.any(Buffer),
      'application/octet-stream',
    );

    // Should delete original
    expect(storage.delete).toHaveBeenCalledWith(
      't/tenant-001/files/file-001/original/document.pdf',
    );

    // Should update DB with quarantine key and infected status
    expect(writeDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        scanStatus: 'infected',
        storageKey: expect.stringContaining('quarantine'),
      }),
    );

    // Should publish infected event
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ scanStatus: 'infected' }),
      }),
    );
  });

  it('sets scan_status to skipped when ClamAV is unavailable in dev mode', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'development';

    try {
      const { writeDb } = setupFileFound();
      mockScanBuffer.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:3310'),
      );

      await processor.processJob(createMockJob(), mockLogger);

      expect(writeDb.set).toHaveBeenCalledWith({ scanStatus: 'skipped' });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'file-001' }),
        expect.stringContaining('ClamAV unavailable'),
      );
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('sets scan_status to skipped on connection error in production', async () => {
    const originalEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';

    try {
      const { writeDb } = setupFileFound();
      mockScanBuffer.mockRejectedValue(
        new Error('connect ECONNREFUSED 127.0.0.1:3310'),
      );

      await processor.processJob(createMockJob(), mockLogger);

      expect(writeDb.set).toHaveBeenCalledWith({ scanStatus: 'skipped' });
      expect(mockLogger.error).toHaveBeenCalled();
    } finally {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('skips when file not found', async () => {
    vi.mocked(getDbForTenant).mockReset();
    const readDb = mockSelectChain([]);
    vi.mocked(getDbForTenant).mockReturnValueOnce(readDb as never);

    await processor.processJob(createMockJob(), mockLogger);

    expect(storage.getStream).not.toHaveBeenCalled();
    expect(mockScanBuffer).not.toHaveBeenCalled();
  });
});
