import { workerLogger } from '@everystack/shared/logging';
import { initWorkerTelemetry, shutdownWorkerTelemetry } from './lib/otel-init';
import { initializeQueues, closeAllQueues } from './queues';
import {
  registerShutdownHandler,
  setupGracefulShutdown,
} from './lib/graceful-shutdown';

// Initialize OpenTelemetry before any processors are registered
initWorkerTelemetry();

// Create all 6 BullMQ queues
initializeQueues();

// Register shutdown handlers (order matters — processors first, then queues, then telemetry)
registerShutdownHandler(closeAllQueues);
registerShutdownHandler(shutdownWorkerTelemetry);

// Set up SIGTERM/SIGINT handling
setupGracefulShutdown(workerLogger);

// TODO [Phase 1G]: Import and start job processors here
workerLogger.info('worker ready — listening for jobs');
