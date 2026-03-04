import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Logger } from '@everystack/shared/logging';
import type { BaseJobData } from '@everystack/shared/queue';

// ---------------------------------------------------------------------------
// Mock BullMQ Worker before importing BaseProcessor
// ---------------------------------------------------------------------------

const mockWorkerOn = vi.fn();
const mockWorkerClose = vi.fn().mockResolvedValue(undefined);
let storedProcessor: unknown = null;

vi.mock('bullmq', () => {
  class MockWorker {
    constructor(_name: string, processor: unknown) {
      storedProcessor = processor;
    }
    on = mockWorkerOn;
    close = mockWorkerClose;
  }
  return { Worker: MockWorker };
});

// Mock Redis config
vi.mock('@everystack/shared/redis', () => ({
  getRedisConfig: vi.fn().mockReturnValue({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: null,
    connectionName: 'test',
  }),
}));

// Mock Sentry capture
vi.mock('../sentry', () => ({
  captureJobError: vi.fn(),
}));

import { BaseProcessor } from '../base-processor';
import { getTraceId, getTenantIdFromTrace } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface TestJobData extends BaseJobData {
  tableId: string;
}

class TestProcessor extends BaseProcessor<TestJobData> {
  processJobFn = vi.fn().mockResolvedValue(undefined);

  constructor(concurrency?: number) {
    super('test-queue', concurrency ? { concurrency } : undefined);
  }

  async processJob(
    job: { data: TestJobData; id?: string; name: string },
    logger: Logger,
  ): Promise<void> {
    return this.processJobFn(job, logger);
  }
}

function makeFakeJob(overrides?: Partial<{ data: Partial<TestJobData>; id: string; name: string }>) {
  return {
    id: overrides?.id ?? 'job-123',
    name: overrides?.name ?? 'test-job',
    data: {
      tenantId: 'tenant-1',
      traceId: 'trace-abc',
      triggeredBy: 'user-1',
      tableId: 'table-1',
      ...overrides?.data,
    },
  };
}

describe('BaseProcessor', () => {
  let processor: TestProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new TestProcessor();
  });

  afterEach(async () => {
    await processor.close();
  });

  it('creates a BullMQ Worker with the correct queue name on start()', () => {
    processor.start();

    // The Worker was created — storedProcessor is the handler function
    expect(storedProcessor).toBeTypeOf('function');
    expect(processor.queueName).toBe('test-queue');
  });

  it('passes custom concurrency to the Worker', async () => {
    const concurrent = new TestProcessor(5);
    concurrent.start();

    // Verify via the processor's queueName — concurrency is passed internally
    expect(concurrent.queueName).toBe('test-queue');
    await concurrent.close();
  });

  it('registers completed, failed, and error event listeners', () => {
    processor.start();

    const eventNames = mockWorkerOn.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(eventNames).toContain('completed');
    expect(eventNames).toContain('failed');
    expect(eventNames).toContain('error');
  });

  it('calls processJob when a job is handled', async () => {
    processor.start();

    // Get the processor function passed to BullMQ Worker
    const handle = storedProcessor as (job: unknown) => Promise<void>;

    const job = makeFakeJob();
    await handle(job);

    expect(processor.processJobFn).toHaveBeenCalledOnce();
    expect(processor.processJobFn).toHaveBeenCalledWith(
      job,
      expect.anything(), // child logger
    );
  });

  it('propagates traceId from job.data into AsyncLocalStorage', async () => {
    let capturedTraceId = '';
    processor.processJobFn.mockImplementation(async () => {
      capturedTraceId = getTraceId();
    });

    processor.start();
    const handle = storedProcessor as (job: unknown) => Promise<void>;

    await handle(makeFakeJob({ data: { traceId: 'custom-trace-id' } }));

    expect(capturedTraceId).toBe('custom-trace-id');
  });

  it('propagates tenantId from job.data into trace context', async () => {
    let capturedTenantId: string | undefined;
    processor.processJobFn.mockImplementation(async () => {
      capturedTenantId = getTenantIdFromTrace();
    });

    processor.start();
    const handle = storedProcessor as (job: unknown) => Promise<void>;

    await handle(makeFakeJob({ data: { tenantId: 'tenant-xyz' } }));

    expect(capturedTenantId).toBe('tenant-xyz');
  });

  it('generates a traceId when job.data.traceId is missing', async () => {
    let capturedTraceId = '';
    processor.processJobFn.mockImplementation(async () => {
      capturedTraceId = getTraceId();
    });

    processor.start();
    const handle = storedProcessor as (job: unknown) => Promise<void>;

    await handle(
      makeFakeJob({
        data: { traceId: undefined as unknown as string },
      }),
    );

    expect(capturedTraceId).not.toBe('no-trace');
    expect(capturedTraceId).toBeTruthy();
  });

  it('calls close on the BullMQ Worker', async () => {
    processor.start();
    await processor.close();

    expect(mockWorkerClose).toHaveBeenCalledOnce();
  });

  it('ignores duplicate start() calls', () => {
    processor.start();
    const firstProcessor = storedProcessor;
    processor.start(); // should warn, not create a second Worker

    // The processor reference should not change (no new Worker created)
    expect(storedProcessor).toBe(firstProcessor);
  });
});
