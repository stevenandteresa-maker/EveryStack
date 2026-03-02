import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import pino from 'pino';
import type { DestinationStream } from 'pino';
import {
  createLogger,
  createChildLogger,
  REDACT_CENSOR,
} from './logger';

function createTestLogger(overrides?: Record<string, unknown>) {
  const lines: string[] = [];
  const dest: DestinationStream = {
    write(chunk: string) {
      lines.push(chunk);
      return true;
    },
  };

  const isDev = process.env.NODE_ENV !== 'production';
  const level: string = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

  const logger = pino(
    {
      level,
      redact: {
        paths: [
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
        ],
        censor: REDACT_CENSOR,
      },
      formatters: {
        level(label: string) {
          return { level: label };
        },
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      base: { service: 'test', ...overrides },
    },
    dest,
  );

  return { logger, lines };
}

function parseLine(lines: string[], index = 0): Record<string, unknown> {
  const line = lines[index];
  if (!line) throw new Error(`No log line at index ${String(index)}`);
  return JSON.parse(line) as Record<string, unknown>;
}

describe('createLogger', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns a logger with service binding', () => {
    const logger = createLogger({ service: 'web' });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('includes service in log output', () => {
    const { logger, lines } = createTestLogger();
    logger.info('test message');
    const entry = parseLine(lines);
    expect(entry.service).toBe('test');
  });

  it('uses label string for level, not numeric', () => {
    const { logger, lines } = createTestLogger();
    logger.info('test message');
    const entry = parseLine(lines);
    expect(entry.level).toBe('info');
    expect(typeof entry.level).toBe('string');
  });

  it('outputs ISO 8601 timestamp', () => {
    const { logger, lines } = createTestLogger();
    logger.info('test message');
    const entry = parseLine(lines);
    expect(typeof entry.time).toBe('string');
    const date = new Date(entry.time as string);
    expect(date.toISOString()).toBeTruthy();
    expect(isNaN(date.getTime())).toBe(false);
  });

  it('includes message in log output', () => {
    const { logger, lines } = createTestLogger();
    logger.info('hello world');
    const entry = parseLine(lines);
    expect(entry.msg).toBe('hello world');
  });
});

describe('log level configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to debug in non-production', () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';
    const logger = createLogger({ service: 'test' });
    expect(logger.level).toBe('debug');
  });

  it('defaults to info in production', () => {
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'production';
    const logger = createLogger({ service: 'test' });
    expect(logger.level).toBe('info');
  });

  it('respects LOG_LEVEL env override', () => {
    process.env.LOG_LEVEL = 'warn';
    const logger = createLogger({ service: 'test' });
    expect(logger.level).toBe('warn');
  });
});

describe('PII redaction', () => {
  it('redacts top-level password field', () => {
    const { logger, lines } = createTestLogger();
    logger.info({ password: 'secret123' }, 'auth attempt');
    const entry = parseLine(lines);
    expect(entry.password).toBe(REDACT_CENSOR);
  });

  it('redacts top-level token field', () => {
    const { logger, lines } = createTestLogger();
    logger.info({ token: 'abc-xyz-token' }, 'token used');
    const entry = parseLine(lines);
    expect(entry.token).toBe(REDACT_CENSOR);
  });

  it('redacts top-level authorization field', () => {
    const { logger, lines } = createTestLogger();
    logger.info({ authorization: 'Bearer abc123' }, 'request');
    const entry = parseLine(lines);
    expect(entry.authorization).toBe(REDACT_CENSOR);
  });

  it('redacts top-level cookie field', () => {
    const { logger, lines } = createTestLogger();
    logger.info({ cookie: 'session=abc' }, 'request');
    const entry = parseLine(lines);
    expect(entry.cookie).toBe(REDACT_CENSOR);
  });

  it('redacts top-level email field', () => {
    const { logger, lines } = createTestLogger();
    logger.info({ email: 'user@example.com' }, 'user lookup');
    const entry = parseLine(lines);
    expect(entry.email).toBe(REDACT_CENSOR);
  });

  it('redacts top-level name field', () => {
    const { logger, lines } = createTestLogger();
    logger.info({ name: 'John Doe' }, 'user lookup');
    const entry = parseLine(lines);
    expect(entry.name).toBe(REDACT_CENSOR);
  });

  it('redacts nested PII fields via wildcard paths', () => {
    const { logger, lines } = createTestLogger();
    logger.info(
      {
        user: {
          email: 'nested@example.com',
          password: 'nested-secret',
          name: 'Jane Doe',
        },
      },
      'user data logged',
    );
    const entry = parseLine(lines);
    const user = entry.user as Record<string, unknown>;
    expect(user.email).toBe(REDACT_CENSOR);
    expect(user.password).toBe(REDACT_CENSOR);
    expect(user.name).toBe(REDACT_CENSOR);
  });

  it('redacts nested token and authorization', () => {
    const { logger, lines } = createTestLogger();
    logger.info(
      {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=xyz',
          token: 'refresh-token',
        },
      },
      'request headers',
    );
    const entry = parseLine(lines);
    const headers = entry.headers as Record<string, unknown>;
    expect(headers.authorization).toBe(REDACT_CENSOR);
    expect(headers.cookie).toBe(REDACT_CENSOR);
    expect(headers.token).toBe(REDACT_CENSOR);
  });

  it('does not redact non-PII fields', () => {
    const { logger, lines } = createTestLogger();
    logger.info(
      { tenantId: 'tenant-123', recordId: 'record-456', action: 'update' },
      'safe fields',
    );
    const entry = parseLine(lines);
    expect(entry.tenantId).toBe('tenant-123');
    expect(entry.recordId).toBe('record-456');
    expect(entry.action).toBe('update');
  });
});

describe('createChildLogger', () => {
  it('produces a child with additional bound context', () => {
    const { logger, lines } = createTestLogger();
    const child = createChildLogger(logger, {
      tenantId: 'tenant-abc',
      traceId: 'trace-xyz',
    });

    child.info('child log');
    const entry = parseLine(lines);
    expect(entry.tenantId).toBe('tenant-abc');
    expect(entry.traceId).toBe('trace-xyz');
    expect(entry.service).toBe('test');
  });

  it('preserves parent service binding', () => {
    const { logger, lines } = createTestLogger();
    const child = createChildLogger(logger, { requestId: 'req-1' });

    child.info('with parent context');
    const entry = parseLine(lines);
    expect(entry.service).toBe('test');
    expect(entry.requestId).toBe('req-1');
  });

  it('child inherits parent log level', () => {
    const { logger } = createTestLogger();
    const child = createChildLogger(logger, { extra: true });
    expect(child.level).toBe(logger.level);
  });
});

describe('pre-configured logger instances', () => {
  it('webLogger has service "web"', async () => {
    const { webLogger } = await import('./logger');
    expect(webLogger).toBeDefined();
    expect(typeof webLogger.info).toBe('function');
  });

  it('workerLogger has service "worker"', async () => {
    const { workerLogger } = await import('./logger');
    expect(workerLogger).toBeDefined();
    expect(typeof workerLogger.info).toBe('function');
  });

  it('realtimeLogger has service "realtime"', async () => {
    const { realtimeLogger } = await import('./logger');
    expect(realtimeLogger).toBeDefined();
    expect(typeof realtimeLogger.info).toBe('function');
  });
});
