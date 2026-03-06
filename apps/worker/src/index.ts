import { workerLogger } from '@everystack/shared/logging';
import { createRedisClient } from '@everystack/shared/redis';
import { createEventPublisher } from '@everystack/shared/realtime';
import { R2StorageClient } from '@everystack/shared/storage';
import { initWorkerTelemetry, shutdownWorkerTelemetry } from './lib/otel-init';
import { initializeQueues, closeAllQueues } from './queues';
import { getQueue } from './queues';
import {
  registerShutdownHandler,
  setupGracefulShutdown,
} from './lib/graceful-shutdown';
import { FileThumbnailProcessor } from './processors/file-thumbnail';
import { FileScanProcessor } from './processors/file-scan';
import { FileOrphanCleanupProcessor } from './processors/file-orphan-cleanup';
import { FileProcessingRouter } from './processors/file-processing-router';
import { InitialSyncProcessor } from './processors/sync/initial-sync';

// Initialize OpenTelemetry before any processors are registered
initWorkerTelemetry();

// Create all 6 BullMQ queues
initializeQueues();

// ---------------------------------------------------------------------------
// Shared resources for processors
// ---------------------------------------------------------------------------

const storage = new R2StorageClient();
const publisherRedis = createRedisClient('worker-event-publisher');
const eventPublisher = createEventPublisher(publisherRedis);

// ---------------------------------------------------------------------------
// Processor instances
// ---------------------------------------------------------------------------

const thumbnailProcessor = new FileThumbnailProcessor(storage, eventPublisher);
const scanProcessor = new FileScanProcessor(storage, eventPublisher);
const orphanProcessor = new FileOrphanCleanupProcessor(storage);

// File-processing queue: routes file.thumbnail and file.scan jobs
const fileRouter = new FileProcessingRouter(thumbnailProcessor, scanProcessor);
fileRouter.start();

// Cleanup queue: handles file.orphan_cleanup jobs
orphanProcessor.start();

// Sync queue: handles initial sync and incremental sync jobs
const initialSyncProcessor = new InitialSyncProcessor(eventPublisher);
initialSyncProcessor.start();

// ---------------------------------------------------------------------------
// Shutdown handlers (order: processors → queues → telemetry → redis)
// ---------------------------------------------------------------------------

registerShutdownHandler(async () => fileRouter.close());
registerShutdownHandler(async () => orphanProcessor.close());
registerShutdownHandler(async () => initialSyncProcessor.close());
registerShutdownHandler(closeAllQueues);
registerShutdownHandler(shutdownWorkerTelemetry);
registerShutdownHandler(async () => {
  await publisherRedis.quit();
});

// Set up SIGTERM/SIGINT handling
setupGracefulShutdown(workerLogger);

// ---------------------------------------------------------------------------
// Recurring job schedules
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function scheduleRecurringJobs(): Promise<void> {
  const cleanupQueue = getQueue('cleanup');
  await cleanupQueue.upsertJobScheduler(
    'daily-orphan-cleanup',
    { pattern: '0 3 * * *' }, // 3 AM daily
    {
      name: 'file.orphan_cleanup',
      data: {
        tenantId: 'system',
        traceId: '',
        triggeredBy: 'scheduler',
        olderThanMs: THIRTY_DAYS_MS,
        batchSize: 100,
      },
    },
  );
  workerLogger.info('Recurring job schedules registered');
}

scheduleRecurringJobs().catch((err) => {
  workerLogger.error(
    { err: err instanceof Error ? err.message : String(err) },
    'Failed to schedule recurring jobs',
  );
});

workerLogger.info('worker ready — listening for jobs');
