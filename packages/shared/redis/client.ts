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
 * | Env var        | Default     |
 * |--------------- |------------ |
 * | REDIS_HOST     | localhost   |
 * | REDIS_PORT     | 6379        |
 * | REDIS_PASSWORD | (undefined) |
 *
 * @param name - Connection name for monitoring (e.g. 'bullmq', 'realtime-pub')
 */
export function getRedisConfig(name = 'default'): RedisConfig {
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
