import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be before imports
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: vi.fn().mockResolvedValue({
    userId: 'user-001',
    tenantId: 'tenant-001',
    clerkUserId: 'clerk_001',
    agencyTenantId: null,
  }),
}));

const mockAdd = vi.fn().mockResolvedValue({ id: 'job-001' });
const mockGetJob = vi.fn();

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({
    add: mockAdd,
    getJob: mockGetJob,
  })),
}));

vi.mock('@/data/document-templates', () => ({
  getDocumentTemplate: vi.fn().mockResolvedValue({
    id: 'template-001',
    tenantId: 'tenant-001',
    tableId: 'table-001',
    name: 'Invoice',
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    settings: {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 20, bottom: 20, left: 20 },
    },
    version: 1,
    environment: 'live',
    createdBy: 'user-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    creatorName: 'Test User',
  }),
}));

vi.mock('@/lib/editor/merge-resolver', () => ({
  resolveMergeTags: vi.fn().mockResolvedValue({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Resolved' }] }],
  }),
}));

vi.mock('@/lib/editor/pdf-renderer', () => ({
  renderToHTML: vi.fn().mockReturnValue('<html><body>Rendered</body></html>'),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-001'),
  generateTraceId: vi.fn(() => 'generated-trace-001'),
}));

vi.mock('@/lib/errors', () => ({
  NotFoundError: class NotFoundError extends Error {
    code = 'NOT_FOUND';
    constructor(msg: string) {
      super(msg);
    }
  },
  wrapUnknownError: vi.fn((err: unknown) => err),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  generateDocument,
  getDocumentGenerationStatus,
} from '../document-generation';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdd.mockResolvedValue({ id: 'job-001' });
  });

  it('validates input with Zod', async () => {
    await expect(
      generateDocument({ templateId: 'not-a-uuid', recordId: 'also-not-uuid' }),
    ).rejects.toThrow();
  });

  it('verifies template exists before enqueuing', async () => {
    const { getDocumentTemplate } = await import('@/data/document-templates');
    (getDocumentTemplate as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    await expect(
      generateDocument({
        templateId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        recordId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      }),
    ).rejects.toThrow('Document template not found');
  });

  it('resolves merge tags and renders HTML before enqueueing', async () => {
    await generateDocument({
      templateId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      recordId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    });

    const { resolveMergeTags } = await import('@/lib/editor/merge-resolver');
    expect(resolveMergeTags).toHaveBeenCalledWith(
      { type: 'doc', content: [{ type: 'paragraph' }] },
      'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      'tenant-001',
    );

    const { renderToHTML } = await import('@/lib/editor/pdf-renderer');
    expect(renderToHTML).toHaveBeenCalledWith(
      { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Resolved' }] }] },
      {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
      },
    );
  });

  it('enqueues a job with HTML, retry config, and landscape flag', async () => {
    const result = await generateDocument({
      templateId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      recordId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    });

    expect(result).toEqual({ jobId: 'job-001' });

    expect(mockAdd).toHaveBeenCalledWith(
      'document.generate',
      expect.objectContaining({
        tenantId: 'tenant-001',
        templateId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
        recordId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        traceId: 'trace-001',
        triggeredBy: 'user-001',
        html: '<html><body>Rendered</body></html>',
        landscape: false,
      }),
      expect.objectContaining({
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      }),
    );
  });

  it('sets landscape: true for landscape templates', async () => {
    const { getDocumentTemplate } = await import('@/data/document-templates');
    (getDocumentTemplate as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'template-001',
      tenantId: 'tenant-001',
      tableId: 'table-001',
      name: 'Landscape Doc',
      content: { type: 'doc', content: [] },
      settings: {
        pageSize: 'A4',
        orientation: 'landscape',
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
      },
      version: 1,
      environment: 'live',
      createdBy: 'user-001',
      createdAt: new Date(),
      updatedAt: new Date(),
      creatorName: 'Test User',
    });

    await generateDocument({
      templateId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      recordId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    });

    expect(mockAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ landscape: true }),
      expect.any(Object),
    );
  });

  it('returns the job ID from BullMQ', async () => {
    mockAdd.mockResolvedValueOnce({ id: 'custom-job-id' });

    const result = await generateDocument({
      templateId: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      recordId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    });

    expect(result.jobId).toBe('custom-job-id');
  });
});

describe('getDocumentGenerationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "unknown" when job is not found', async () => {
    mockGetJob.mockResolvedValueOnce(undefined);

    const result = await getDocumentGenerationStatus({ jobId: 'nonexistent' });
    expect(result).toEqual({ status: 'unknown' });
  });

  it('returns "unknown" for jobs belonging to a different tenant', async () => {
    mockGetJob.mockResolvedValueOnce({
      data: { tenantId: 'other-tenant' },
      getState: vi.fn().mockResolvedValue('completed'),
    });

    const result = await getDocumentGenerationStatus({ jobId: 'job-001' });
    expect(result).toEqual({ status: 'unknown' });
  });

  it('returns "completed" with result for completed jobs', async () => {
    mockGetJob.mockResolvedValueOnce({
      data: { tenantId: 'tenant-001' },
      getState: vi.fn().mockResolvedValue('completed'),
      returnvalue: { docId: 'doc-001' },
    });

    const result = await getDocumentGenerationStatus({ jobId: 'job-001' });
    expect(result).toEqual({
      status: 'completed',
      result: { docId: 'doc-001' },
    });
  });

  it('returns "failed" with error message for failed jobs', async () => {
    mockGetJob.mockResolvedValueOnce({
      data: { tenantId: 'tenant-001' },
      getState: vi.fn().mockResolvedValue('failed'),
      failedReason: 'Gotenberg timeout',
    });

    const result = await getDocumentGenerationStatus({ jobId: 'job-001' });
    expect(result).toEqual({
      status: 'failed',
      error: 'Gotenberg timeout',
    });
  });

  it('returns "active" for in-progress jobs', async () => {
    mockGetJob.mockResolvedValueOnce({
      data: { tenantId: 'tenant-001' },
      getState: vi.fn().mockResolvedValue('active'),
    });

    const result = await getDocumentGenerationStatus({ jobId: 'job-001' });
    expect(result).toEqual({ status: 'active' });
  });

  it('returns "waiting" for delayed jobs', async () => {
    mockGetJob.mockResolvedValueOnce({
      data: { tenantId: 'tenant-001' },
      getState: vi.fn().mockResolvedValue('delayed'),
    });

    const result = await getDocumentGenerationStatus({ jobId: 'job-001' });
    expect(result).toEqual({ status: 'waiting' });
  });

  it('returns "waiting" for queued (waiting) jobs', async () => {
    mockGetJob.mockResolvedValueOnce({
      data: { tenantId: 'tenant-001' },
      getState: vi.fn().mockResolvedValue('waiting'),
    });

    const result = await getDocumentGenerationStatus({ jobId: 'job-001' });
    expect(result).toEqual({ status: 'waiting' });
  });
});
