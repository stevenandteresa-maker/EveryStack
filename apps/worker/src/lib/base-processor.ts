import { Worker } from 'bullmq';
import type { Job, WorkerOptions } from 'bullmq';
import type { Logger } from '@everystack/shared/logging';
import {
  workerLogger,
  createChildLogger,
  runWithTraceContext,
  generateTraceId,
} from '@everystack/shared/logging';
import type { BaseJobData } from '@everystack/shared/queue';
import { getRedisConfig } from '@everystack/shared/redis';

import { captureJobError } from './sentry';

export interface BaseProcessorOptions {
  /** BullMQ concurrency — number of jobs processed simultaneously. Default: 1 */
  concurrency?: number;
}

/**
 * Abstract base class for BullMQ job processors.
 *
 * Wraps a BullMQ Worker with:
 * - traceId propagation via AsyncLocalStorage
 * - Pino child logger bound with job metadata
 * - Sentry capture on failure
 * - Configurable concurrency
 *
 * Subclasses implement `processJob()` with domain logic.
 *
 * @example
 * ```ts
 * class SyncProcessor extends BaseProcessor<SyncJobData> {
 *   constructor() { super('sync', { concurrency: 5 }); }
 *   async processJob(job: Job<SyncJobData>, logger: Logger) {
 *     // sync logic
 *   }
 * }
 * ```
 */
export abstract class BaseProcessor<TData extends BaseJobData> {
  readonly queueName: string;
  private worker: Worker<TData> | null = null;
  private readonly logger: Logger;
  private readonly concurrency: number;

  constructor(queueName: string, options?: BaseProcessorOptions) {
    this.queueName = queueName;
    this.concurrency = options?.concurrency ?? 1;
    this.logger = createChildLogger(workerLogger, { processor: queueName });
  }

  /**
   * Domain-specific job logic. Subclasses must implement this.
   * Runs inside a trace context — `getTraceId()` / `getTenantIdFromTrace()` work.
   */
  abstract processJob(job: Job<TData>, logger: Logger): Promise<void>;

  /**
   * Starts the BullMQ Worker, connecting to Redis and listening for jobs.
   */
  start(workerOptions?: Partial<WorkerOptions>): void {
    if (this.worker) {
      this.logger.warn('Processor already started');
      return;
    }

    const connection = getRedisConfig(`worker:${this.queueName}`);

    this.worker = new Worker<TData>(
      this.queueName,
      async (job: Job<TData>) => this.handleJob(job),
      {
        connection,
        concurrency: this.concurrency,
        ...workerOptions,
      },
    );

    this.worker.on('completed', (job: Job<TData>) => {
      this.logger.info({ jobId: job.id, jobName: job.name }, 'Job completed');
    });

    this.worker.on('failed', (job: Job<TData> | undefined, err: Error) => {
      this.logger.error(
        { jobId: job?.id, jobName: job?.name, err: err.message },
        'Job failed',
      );
      if (job) {
        captureJobError(err, {
          id: job.id,
          name: job.name,
          data: job.data,
        });
      }
    });

    this.worker.on('error', (err: Error) => {
      this.logger.error({ err: err.message }, 'Worker error');
    });

    this.logger.info({ concurrency: this.concurrency }, 'Processor started');
  }

  /**
   * Gracefully closes the worker, waiting for active jobs to finish.
   */
  async close(): Promise<void> {
    if (!this.worker) return;
    this.logger.info('Closing processor...');
    await this.worker.close();
    this.worker = null;
    this.logger.info('Processor closed');
  }

  /**
   * Internal handler that wraps processJob with trace context and logging.
   */
  private async handleJob(job: Job<TData>): Promise<void> {
    const traceId = job.data.traceId ?? generateTraceId();
    const tenantId = job.data.tenantId;

    return runWithTraceContext({ traceId, tenantId }, async () => {
      const childLogger = createChildLogger(this.logger, {
        traceId,
        tenantId,
        jobId: job.id ?? 'unknown',
        jobName: job.name,
      });

      childLogger.info('Job started');
      await this.processJob(job, childLogger);
    });
  }
}
