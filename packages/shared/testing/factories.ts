/**
 * Test Data Factories — Stub
 *
 * Full implementation ships in Prompt 3 (Test Data Factories).
 * This stub provides the getTestDb() export so vitest.setup.ts compiles.
 */

import type { DrizzleClient } from '../db/client';

let testDbConn: DrizzleClient | undefined;

/**
 * Returns the shared Drizzle client pointed at the test database.
 * Prompt 3 replaces this with `getDbForTenant('test', 'write')`.
 */
export function getTestDb(): DrizzleClient {
  if (!testDbConn) {
    throw new Error(
      'getTestDb() is not yet implemented. Awaiting Prompt 3 (Test Data Factories).',
    );
  }
  return testDbConn;
}
