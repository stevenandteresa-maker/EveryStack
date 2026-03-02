// ---------------------------------------------------------------------------
// Encryption verification — runtime checks that database and Redis
// connections use TLS in production.
//
// In production, these should run at startup and fail fast if TLS is
// misconfigured. In development, they warn but don't block.
//
// See: docs/reference/compliance.md § Encryption
// ---------------------------------------------------------------------------

import { createLogger } from '../logging';

const logger = createLogger({ service: 'compliance' });

/**
 * Checks whether a PostgreSQL connection string requires TLS.
 *
 * Returns `true` if the connection string includes `sslmode=require` or
 * `sslmode=verify-full` (the two modes that guarantee encrypted transit).
 */
export function verifyDatabaseTls(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  return lower.includes('sslmode=require') || lower.includes('sslmode=verify-full');
}

/**
 * Checks whether a Redis URL uses TLS.
 *
 * Returns `true` if the URL uses the `rediss://` protocol (note the
 * double-s), which is the standard for TLS-encrypted Redis connections.
 */
export function verifyRedisTls(redisUrl: string): boolean {
  return redisUrl.toLowerCase().startsWith('rediss://');
}

/**
 * Runs all encryption checks against the current environment.
 *
 * - **Production**: throws if any check fails (fail-fast).
 * - **Development/test**: logs a warning but does not throw.
 *
 * Call this once at application startup.
 */
export function verifyEncryptionConfig(env: {
  databaseUrl?: string;
  redisUrl?: string;
  nodeEnv?: string;
}): { databaseTls: boolean; redisTls: boolean } {
  const isProduction = env.nodeEnv === 'production';

  const databaseTls = env.databaseUrl ? verifyDatabaseTls(env.databaseUrl) : false;
  const redisTls = env.redisUrl ? verifyRedisTls(env.redisUrl) : false;

  if (!databaseTls) {
    const msg = 'Database connection does not use TLS (sslmode=require or sslmode=verify-full)';
    if (isProduction) {
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  if (!redisTls) {
    const msg = 'Redis connection does not use TLS (rediss:// protocol required)';
    if (isProduction) {
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  return { databaseTls, redisTls };
}
