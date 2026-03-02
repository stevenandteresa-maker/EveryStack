import { workerLogger } from '@everystack/shared/logging';
import { initWorkerTelemetry, shutdownWorkerTelemetry } from './lib/otel-init';

// Initialize OpenTelemetry before any processors are registered
initWorkerTelemetry();

// TODO [Phase 1G]: Replace with BullMQ worker setup and Redis connection
workerLogger.info('Starting EveryStack worker...');

async function shutdown(signal: string) {
  workerLogger.info({ signal }, 'Received shutdown signal, shutting down gracefully...');
  await shutdownWorkerTelemetry();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
