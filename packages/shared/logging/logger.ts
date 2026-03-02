import pino from 'pino';
import type { Logger } from 'pino';

/**
 * PII field paths redacted from all log output.
 * Both top-level and nested paths are covered via wildcard prefixes.
 */
const REDACT_PATHS = [
  'password',
  'token',
  'authorization',
  'cookie',
  'email',
  'name',
  '*.password',
  '*.token',
  '*.authorization',
  '*.cookie',
  '*.email',
  '*.name',
];

const REDACT_CENSOR = '[Redacted]';

interface CreateLoggerOptions {
  /** Service name bound to every log entry (e.g. 'web', 'worker', 'realtime'). */
  service: string;
}

/**
 * Creates a configured Pino logger instance for a given service.
 *
 * ## Log Levels
 *
 * - **error**: Unhandled failures, data corruption risks
 * - **warn**: Retry-worthy failures, rate limits hit, degraded responses
 * - **info**: Request lifecycle, job start/complete, sync events
 * - **debug**: Query details, payload shapes — dev only
 *
 * @param options.service - Service identifier bound to every log entry
 * @returns Configured Pino logger
 */
function createLogger({ service }: CreateLoggerOptions): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

  return pino({
    level,
    redact: {
      paths: REDACT_PATHS,
      censor: REDACT_CENSOR,
    },
    formatters: {
      level(label: string) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service },
  });
}

/**
 * Creates a child logger with additional bound context.
 * Use for request-level bindings like tenantId and traceId.
 *
 * @param parent - Parent Pino logger instance
 * @param bindings - Key-value pairs to bind to every log entry from the child
 * @returns Child Pino logger with merged bindings
 */
function createChildLogger(
  parent: Logger,
  bindings: Record<string, unknown>,
): Logger {
  return parent.child(bindings);
}

/** Pre-configured logger for the Next.js web app. */
const webLogger = createLogger({ service: 'web' });

/** Pre-configured logger for the BullMQ worker. */
const workerLogger = createLogger({ service: 'worker' });

/** Pre-configured logger for the Socket.io real-time server. */
const realtimeLogger = createLogger({ service: 'realtime' });

export {
  createLogger,
  createChildLogger,
  webLogger,
  workerLogger,
  realtimeLogger,
  REDACT_PATHS,
  REDACT_CENSOR,
};
export type { CreateLoggerOptions, Logger };
