import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// ---------------------------------------------------------------------------
// Connection strings — always through PgBouncer (port 6432)
// DATABASE_URL_DIRECT (port 5432) is only for migrations via drizzle-kit.
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// Write primary (via PgBouncer)
const writeClient = postgres(requireEnv('DATABASE_URL'), {
  // PgBouncer transaction mode: disable prepared statements
  prepare: false,
});

// Read replica (via PgBouncer) — MVP: same instance as write
const readClient = postgres(requireEnv('DATABASE_READ_URL'), {
  prepare: false,
});

/** Drizzle client for write operations (primary, via PgBouncer). */
export const db = drizzle(writeClient);

/** Drizzle client for read operations (replica, via PgBouncer). */
export const dbRead = drizzle(readClient);

// ---------------------------------------------------------------------------
// Tenant-aware database access
// ---------------------------------------------------------------------------

export type DbIntent = 'read' | 'write';

/** The Drizzle client type used throughout the application. */
export type DrizzleClient = PostgresJsDatabase;

/**
 * Single entry point for all tenant-scoped database operations.
 *
 * Every data-layer function calls this instead of accessing `db` / `dbRead`
 * directly. This enables read/write splitting from day one and provides the
 * hook for future multi-region routing.
 *
 * @param tenantId - The tenant's UUID (used for future regional routing)
 * @param intent - 'read' routes to the read replica, 'write' to the primary
 */
export function getDbForTenant(
  tenantId: string,
  intent: DbIntent = 'write',
): DrizzleClient {
  // MVP — Foundation: Simple read/write split. Immediate value.
  if (intent === 'read') return dbRead;
  return db;

  // -------------------------------------------------------------------------
  // Post-MVP — Multi-region routing
  // Uncomment when regional routing is enabled:
  //
  // const region = getTenantRegionCached(tenantId);
  // return regionConnections[region][intent];
  // -------------------------------------------------------------------------
}
