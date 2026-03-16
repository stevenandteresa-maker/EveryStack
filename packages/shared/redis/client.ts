import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/**
 * Redis connection configuration.
 * `maxRetriesPerRequest: null` is required for BullMQ compatibility.
 */
export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: number | null;
  connectionName: string;
}

/**
 * Reads Redis connection config from environment variables.
 *
 * Checks `REDIS_URL` first (e.g. `redis://localhost:6380`), then falls
 * back to individual `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` vars.
 *
 * @param name - Connection name for monitoring (e.g. 'bullmq', 'realtime-pub')
 */
export function getRedisConfig(name = 'default'): RedisConfig {
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
      connectionName: name,
    };
  }

  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? '6379'),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
    maxRetriesPerRequest: null,
    connectionName: name,
  };
}

/**
 * Creates a new ioredis client with standard config.
 * Each caller gets its own connection — do not share across unrelated subsystems.
 *
 * @param name - Connection name for monitoring (e.g. 'bullmq', 'realtime-pub')
 * @param overrides - Optional RedisOptions overrides
 */
export function createRedisClient(
  name = 'default',
  overrides?: Partial<RedisOptions>,
): Redis {
  const config = getRedisConfig(name);
  return new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    connectionName: config.connectionName,
    lazyConnect: true,
    ...overrides,
  });
}
