import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTraceId, getTenantIdFromTrace } from '@everystack/shared/logging';
import { createJobProcessor } from './job-wrapper';
import type { JobLike, TracedJobData } from './job-wrapper';

interface TestJobData extends TracedJobData {
  tableId?: string;
}

function makeJob(
  overrides?: Partial<JobLike<TestJobData>>,
): JobLike<TestJobData> {
  return {
    id: 'job-001',
    name: 'test-job',
    data: { tableId: 'table-1' },
    ...overrides,
  };
}

describe('createJobProcessor', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls the processor function with the job', async () => {
    const processor = vi.fn();
    const wrapped = createJobProcessor<TestJobData>('test', processor);
    const job = makeJob();

    await wrapped(job);

    expect(processor).toHaveBeenCalledOnce();
    expect(processor).toHaveBeenCalledWith(job, expect.anything());
  });

  it('extracts traceId from job.data.traceId', async () => {
    let capturedTraceId = '';
    const wrapped = createJobProcessor<TestJobData>(
      'test',
      async () => {
        capturedTraceId = getTraceId();
      },
    );

    await wrapped(makeJob({ data: { traceId: 'existing-trace-id' } }));

    expect(capturedTraceId).toBe('existing-trace-id');
  });

  it('generates new traceId when job.data.traceId is absent', async () => {
    let capturedTraceId = '';
    const wrapped = createJobProcessor<TestJobData>(
      'test',
      async () => {
        capturedTraceId = getTraceId();
      },
    );

    await wrapped(makeJob({ data: { tableId: 'tbl-1' } }));

    expect(capturedTraceId).not.toBe('no-trace');
    expect(capturedTraceId).toBeTruthy();
    // Should be a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(capturedTraceId).toMatch(uuidRegex);
  });

  it('binds tenantId to trace context when present in job data', async () => {
    let capturedTenantId: string | undefined;
    const wrapped = createJobProcessor<TestJobData>(
      'test',
      async () => {
        capturedTenantId = getTenantIdFromTrace();
      },
    );

    await wrapped(
      makeJob({ data: { traceId: 'trace-1', tenantId: 'tenant-abc' } }),
    );

    expect(capturedTenantId).toBe('tenant-abc');
  });

  it('tenantId is undefined when not in job data', async () => {
    let capturedTenantId: string | undefined = 'should-be-cleared';
    const wrapped = createJobProcessor<TestJobData>(
      'test',
      async () => {
        capturedTenantId = getTenantIdFromTrace();
      },
    );

    await wrapped(makeJob({ data: { tableId: 'tbl-1' } }));

    expect(capturedTenantId).toBeUndefined();
  });

  it('re-throws errors from the processor', async () => {
    const wrapped = createJobProcessor<TestJobData>('test', async () => {
      throw new Error('sync failed');
    });

    await expect(wrapped(makeJob())).rejects.toThrow('sync failed');
  });

  it('handles job with no id gracefully', async () => {
    const processor = vi.fn();
    const wrapped = createJobProcessor<TestJobData>('test', processor);

    await wrapped(makeJob({ id: undefined }));

    expect(processor).toHaveBeenCalledOnce();
  });

  it('generates unique traceIds for concurrent jobs', async () => {
    const traceIds: string[] = [];
    const wrapped = createJobProcessor<TestJobData>(
      'test',
      async () => {
        traceIds.push(getTraceId());
      },
    );

    await Promise.all([
      wrapped(makeJob({ id: 'j1', data: {} })),
      wrapped(makeJob({ id: 'j2', data: {} })),
      wrapped(makeJob({ id: 'j3', data: {} })),
    ]);

    expect(new Set(traceIds).size).toBe(3);
  });

  it('trace context does not leak between sequential jobs', async () => {
    const traces: string[] = [];
    const wrapped = createJobProcessor<TestJobData>(
      'test',
      async () => {
        traces.push(getTraceId());
      },
    );

    await wrapped(makeJob({ data: { traceId: 'first-trace' } }));
    await wrapped(makeJob({ data: { traceId: 'second-trace' } }));

    expect(traces[0]).toBe('first-trace');
    expect(traces[1]).toBe('second-trace');

    // Outside context should be clean
    expect(getTraceId()).toBe('no-trace');
  });
});
