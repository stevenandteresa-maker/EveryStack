import * as Sentry from '@sentry/node';

import type { JobLike, TracedJobData } from './job-wrapper';

/**
 * Initializes Sentry for the worker process.
 * No-op when SENTRY_DSN is not set (development without Sentry).
 */
export function initWorkerSentry(): void {
  if (!process.env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

/**
 * Captures a job processing error to Sentry with relevant job metadata tags.
 * No-op when Sentry is not initialized (SENTRY_DSN not set).
 *
 * @param error - The error that occurred during job processing
 * @param job - The BullMQ-like job that failed
 */
export function captureJobError<T extends TracedJobData>(
  error: unknown,
  job: JobLike<T>,
): void {
  const client = Sentry.getClient();
  if (!client) {
    return;
  }

  const tags: Record<string, string> = {
    job_name: job.name,
  };

  if (job.id) {
    tags.job_id = job.id;
  }

  if (job.data.traceId) {
    tags.trace_id = job.data.traceId;
  }

  if (job.data.tenantId) {
    tags.tenant_id = job.data.tenantId;
  }

  Sentry.captureException(error, { tags });
}
