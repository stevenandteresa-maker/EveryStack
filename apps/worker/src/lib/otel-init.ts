import {
  initTelemetry,
  type TelemetryHandle,
} from '@everystack/shared/telemetry';
import { workerLogger } from '@everystack/shared/logging';

let telemetryHandle: TelemetryHandle | undefined;

/**
 * Initializes OpenTelemetry for the worker service.
 * Must be called at startup before BullMQ processors are registered.
 */
export function initWorkerTelemetry(): void {
  telemetryHandle = initTelemetry({ serviceName: 'everystack-worker' });
  workerLogger.info('OpenTelemetry initialized for worker');
}

/**
 * Gracefully shuts down the OTel SDK, flushing pending spans.
 * Called on SIGTERM/SIGINT for clean process exit.
 */
export async function shutdownWorkerTelemetry(): Promise<void> {
  if (telemetryHandle) {
    await telemetryHandle.shutdown();
    workerLogger.info('OpenTelemetry shut down for worker');
  }
}
