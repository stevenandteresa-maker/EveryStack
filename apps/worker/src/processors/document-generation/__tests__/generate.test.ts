import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import type { DocumentGenJobData } from '@everystack/shared/queue';
import { DocumentGenerationProcessor } from '../generate';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockValues = vi.fn().mockResolvedValue(undefined);

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    insert: (table: unknown) => {
      mockInsert(table);
      return { values: mockValues };
    },
  })),
  generatedDocuments: {},
  generateUUIDv7: vi.fn(() => 'gen-doc-id-001'),
}));

const mockConvertHTMLToPDF = vi.fn();

vi.mock('@everystack/shared/pdf', () => {
  return {
    GotenbergClient: class {
      convertHTMLToPDF = mockConvertHTMLToPDF;
    },
  };
});

vi.mock('@everystack/shared/storage', () => ({
  docGenOutputKey: vi.fn(
    (tenantId: string, docId: string, ext: string) =>
      `t/${tenantId}/doc-gen/${docId}/output.${ext}`,
  ),
}));

// Storage mock
const mockPut = vi.fn().mockResolvedValue(undefined);
const mockPresignGet = vi.fn().mockResolvedValue('https://storage.example.com/signed-url');
const mockStorage = {
  put: mockPut,
  presignGet: mockPresignGet,
  presignPut: vi.fn(),
  delete: vi.fn(),
  deleteMany: vi.fn(),
  headObject: vi.fn(),
  getStream: vi.fn(),
};

// Logger mock
const mockLogger: Logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn().mockReturnThis(),
  level: 'info',
  silent: vi.fn(),
} as unknown as Logger;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockJob(overrides?: Partial<DocumentGenJobData>): Job<DocumentGenJobData> {
  return {
    id: 'job-001',
    name: 'document.generate',
    data: {
      tenantId: 'tenant-001',
      templateId: 'template-001',
      recordId: 'record-001',
      traceId: 'trace-001',
      triggeredBy: 'user-001',
      html: '<html><body>Resolved HTML</body></html>',
      landscape: false,
      ...overrides,
    },
    attemptsMade: 0,
    progress: vi.fn(),
    updateProgress: vi.fn(),
    log: vi.fn(),
  } as unknown as Job<DocumentGenJobData>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentGenerationProcessor', () => {
  let processor: DocumentGenerationProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertHTMLToPDF.mockResolvedValue(Buffer.from('%PDF-1.4 test'));
    processor = new DocumentGenerationProcessor(mockStorage);
  });

  it('has correct static properties', () => {
    expect(DocumentGenerationProcessor.JOB_NAME).toBe('document.generate');
    expect(DocumentGenerationProcessor.RETRY_ATTEMPTS).toBe(3);
    expect(DocumentGenerationProcessor.BACKOFF_BASE_MS).toBe(5_000);
  });

  describe('processJob', () => {
    it('executes the full pipeline: convert → upload → insert', async () => {
      const job = createMockJob();

      await processor.processJob(job, mockLogger);

      // 1. Gotenberg conversion
      expect(mockConvertHTMLToPDF).toHaveBeenCalledWith(
        '<html><body>Resolved HTML</body></html>',
        { printBackground: true, landscape: false },
      );

      // 2. Storage upload
      expect(mockPut).toHaveBeenCalledWith(
        't/tenant-001/doc-gen/gen-doc-id-001/output.pdf',
        expect.any(Buffer),
        'application/pdf',
      );

      // Presigned URL with 7-day expiry
      expect(mockPresignGet).toHaveBeenCalledWith(
        't/tenant-001/doc-gen/gen-doc-id-001/output.pdf',
        7 * 24 * 60 * 60,
      );

      // 3. DB insert
      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'gen-doc-id-001',
          tenantId: 'tenant-001',
          templateId: 'template-001',
          sourceRecordId: 'record-001',
          fileUrl: 'https://storage.example.com/signed-url',
          fileType: 'pdf',
          generatedBy: 'user-001',
        }),
      );
    });

    it('passes landscape: true when job data has landscape flag', async () => {
      const job = createMockJob({ landscape: true });

      await processor.processJob(job, mockLogger);

      expect(mockConvertHTMLToPDF).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ landscape: true }),
      );
    });

    it('sets generatedBy to null when triggeredBy is "automation"', async () => {
      const job = createMockJob({ triggeredBy: 'automation' });

      await processor.processJob(job, mockLogger);

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ generatedBy: null }),
      );
    });

    it('uploads the exact PDF buffer from Gotenberg', async () => {
      const pdfContent = Buffer.from('custom PDF content');
      mockConvertHTMLToPDF.mockResolvedValueOnce(pdfContent);

      const job = createMockJob();
      await processor.processJob(job, mockLogger);

      expect(mockPut).toHaveBeenCalledWith(
        expect.any(String),
        pdfContent,
        'application/pdf',
      );
    });

    it('logs at each pipeline stage', async () => {
      const job = createMockJob();
      await processor.processJob(job, mockLogger);

      const infoCalls = (mockLogger.info as ReturnType<typeof vi.fn>).mock.calls;
      const messages = infoCalls.map((call: unknown[]) => call[1] ?? call[0]);

      expect(messages).toContain('Converting HTML to PDF via Gotenberg');
      expect(messages).toContain('Uploading PDF to storage');
      expect(messages).toContain('Document generated successfully');
    });

    it('propagates Gotenberg errors', async () => {
      mockConvertHTMLToPDF.mockRejectedValueOnce(new Error('Gotenberg timeout'));

      const job = createMockJob();
      await expect(processor.processJob(job, mockLogger)).rejects.toThrow('Gotenberg timeout');

      // No upload or DB insert should happen
      expect(mockPut).not.toHaveBeenCalled();
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('propagates storage upload errors', async () => {
      mockPut.mockRejectedValueOnce(new Error('Storage unavailable'));

      const job = createMockJob();
      await expect(processor.processJob(job, mockLogger)).rejects.toThrow('Storage unavailable');

      // No DB insert should happen
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
