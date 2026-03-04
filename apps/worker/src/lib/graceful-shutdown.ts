import type { Logger } from '@everystack/shared/logging';

/** Maximum time (ms) to wait for cleanup before forcing exit. */
const FORCED_EXIT_TIMEOUT_MS = 30_000;

type ShutdownHandler = () => Promise<void>;

const handlers: ShutdownHandler[] = [];
let isShuttingDown = false;

/**
 * Registers a cleanup function to be called during graceful shutdown.
 * Handlers are called in registration order (FIFO).
 */
export function registerShutdownHandler(fn: ShutdownHandler): void {
  handlers.push(fn);
}

/**
 * Sets up SIGTERM and SIGINT handlers for graceful worker shutdown.
 *
 * Behavior:
 * 1. First signal → runs all registered handlers sequentially
 * 2. Duplicate signals ignored (isShuttingDown guard)
 * 3. 30-second forced exit timeout for stuck jobs
 */
export function setupGracefulShutdown(logger: Logger): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Shutdown already in progress, ignoring signal');
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, 'Graceful shutdown initiated');

    // Force exit after timeout
    const forceTimer = setTimeout(() => {
      logger.error('Forced exit — shutdown handlers did not complete in time');
      process.exit(1);
    }, FORCED_EXIT_TIMEOUT_MS);
    // Don't let the timer prevent natural exit
    forceTimer.unref();

    for (const handler of handlers) {
      try {
        await handler();
      } catch (err) {
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Shutdown handler failed',
        );
      }
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

/**
 * Resets shutdown state. Exported for testing only.
 * @internal
 */
export function _resetShutdownState(): void {
  handlers.length = 0;
  isShuttingDown = false;
}

/**
 * Returns current shutdown status. Exported for testing only.
 * @internal
 */
export function _isShuttingDown(): boolean {
  return isShuttingDown;
}
