import type { Logger } from '@everystack/shared/logging';
import {
  workerLogger,
  createChildLogger,
  generateTraceId,
  runWithTraceContext,
} from '@everystack/shared/logging';

/**
 * Minimal BullMQ Job shape required by the wrapper.
 * Using a local interface avoids pulling in BullMQ as a dependency
 * until actual queue setup is built (Phase 1G).
 */
export interface JobLike<T = unknown> {
  id?: string;
  name: string;
  data: T;
}

/**
 * Base shape for job data that supports trace propagation.
 * All job producers should include traceId + tenantId when enqueueing
 * so the worker can continue the same trace.
 */
export interface TracedJobData {
  traceId?: string;
  tenantId?: string;
}

/**
 * The processor function that runs the actual job logic.
 * Receives the job and a child logger bound with trace context.
 */
type JobProcessor<T> = (job: JobLike<T>, logger: Logger) => Promise<void>;

/**
 * Creates a wrapped job processor that:
 *
 * 1. Extracts `traceId` from job.data (generates a new one if absent)
 * 2. Extracts `tenantId` from job.data (optional)
 * 3. Runs the processor inside `runWithTraceContext()` so `getTraceId()`
 *    works anywhere in the call stack
 * 4. Creates a child logger with `{ traceId, tenantId, jobName, jobId }` bound
 * 5. Logs info at job start and completion, error on failure
 *
 * @param name - Human-readable job processor name (for logs)
 * @param processor - The function that performs the actual job work
 * @returns A wrapped processor function compatible with BullMQ Worker
 *
 * @example
 * ```ts
 * const processSyncJob = createJobProcessor<SyncJobData>(
 *   'sync',
 *   async (job, logger) => {
 *     logger.info({ tableId: job.data.tableId }, 'Syncing table');
 *     await syncTable(job.data.tableId);
 *   },
 * );
 *
 * // Later, when BullMQ worker is set up:
 * new Worker('sync-queue', processSyncJob);
 * ```
 */
export function createJobProcessor<T extends TracedJobData>(
  name: string,
  processor: JobProcessor<T>,
): (job: JobLike<T>) => Promise<void> {
  return async (job: JobLike<T>): Promise<void> => {
    const traceId = job.data.traceId ?? generateTraceId();
    const tenantId = job.data.tenantId;
    const jobId = job.id ?? 'unknown';

    return runWithTraceContext({ traceId, tenantId }, async () => {
      const bindings: Record<string, string> = {
        traceId,
        jobName: name,
        jobId,
      };
      if (tenantId) {
        bindings.tenantId = tenantId;
      }
      const logger = createChildLogger(workerLogger, bindings);

      logger.info(
        { jobData: sanitizeJobData(job.data as Record<string, unknown>) },
        'Job started',
      );

      try {
        await processor(job, logger);
        logger.info('Job completed');
      } catch (error) {
        logger.error(
          { err: error instanceof Error ? error.message : String(error) },
          'Job failed',
        );
        throw error;
      }
    });
  };
}

/**
 * Strips trace/tenant fields from job data for logging purposes.
 * Prevents double-logging of fields already bound to the child logger.
 */
function sanitizeJobData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const { traceId: _t, tenantId: _n, ...rest } = data;
  return rest;
}
