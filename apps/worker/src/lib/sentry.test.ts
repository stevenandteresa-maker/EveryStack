import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@sentry/node', () => {
  const captureException = vi.fn();
  const getClient = vi.fn();
  const init = vi.fn();
  return { captureException, getClient, init };
});

import * as Sentry from '@sentry/node';
import { initWorkerSentry, captureJobError } from './sentry';
import type { JobLike, TracedJobData } from './job-wrapper';

interface TestJobData extends TracedJobData {
  tableId?: string;
}

function makeJob(
  overrides?: Partial<JobLike<TestJobData>>,
): JobLike<TestJobData> {
  return {
    id: 'job-001',
    name: 'sync-job',
    data: { tableId: 'table-1', traceId: 'trace-abc', tenantId: 'tenant-xyz' },
    ...overrides,
  };
}

describe('initWorkerSentry', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('calls Sentry.init when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

    initWorkerSentry();

    expect(Sentry.init).toHaveBeenCalledOnce();
    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
      }),
    );
  });

  it('does not call Sentry.init when SENTRY_DSN is empty', () => {
    delete process.env.SENTRY_DSN;

    initWorkerSentry();

    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('uses SENTRY_ENVIRONMENT when set', () => {
    process.env.SENTRY_DSN = 'https://example@sentry.io/0';
    process.env.SENTRY_ENVIRONMENT = 'staging';

    initWorkerSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'staging' }),
    );
  });

  it('defaults environment to development', () => {
    process.env.SENTRY_DSN = 'https://example@sentry.io/0';
    delete process.env.SENTRY_ENVIRONMENT;

    initWorkerSentry();

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({ environment: 'development' }),
    );
  });
});

describe('captureJobError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('captures exception with job metadata tags', () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const error = new Error('sync failed');
    const job = makeJob();

    captureJobError(error, job);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: {
        job_name: 'sync-job',
        job_id: 'job-001',
        trace_id: 'trace-abc',
        tenant_id: 'tenant-xyz',
      },
    });
  });

  it('is a no-op when Sentry client is not initialized', () => {
    vi.mocked(Sentry.getClient).mockReturnValue(undefined);
    const error = new Error('fail');

    captureJobError(error, makeJob());

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('omits optional tags when not present in job data', () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const error = new Error('fail');
    const job = makeJob({ id: undefined, data: { tableId: 'tbl-1' } });

    captureJobError(error, job);

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { job_name: 'sync-job' },
    });
  });

  it('handles non-Error values as error argument', () => {
    vi.mocked(Sentry.getClient).mockReturnValue({} as ReturnType<typeof Sentry.getClient>);
    const job = makeJob();

    captureJobError('string error', job);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      'string error',
      expect.objectContaining({
        tags: expect.objectContaining({ job_name: 'sync-job' }),
      }),
    );
  });
});
