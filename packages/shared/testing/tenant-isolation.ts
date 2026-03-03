/**
 * Tenant Isolation Test Helper
 *
 * CLAUDE.md non-negotiable rule: "Every /data function gets a tenant isolation test.
 * Use testTenantIsolation(). No exceptions."
 *
 * This helper verifies that a query function cannot return data belonging to
 * a different tenant. It creates two tenants, populates one, then asserts
 * the other cannot see its data.
 */

import { expect } from 'vitest';
import { createTestTenant } from './factories';

export interface TenantIsolationOptions {
  /** Insert test data for the given tenant. */
  setup: (tenantId: string) => Promise<void>;
  /** Query data as the given tenant. Must return an array of results. */
  query: (tenantId: string) => Promise<unknown[]>;
}

/**
 * Tests that a query function properly isolates data between tenants.
 *
 * 1. Creates two test tenants (A and B)
 * 2. Calls `setup(tenantA.id)` to create data for tenant A
 * 3. Calls `query(tenantB.id)` — asserts empty (B cannot see A's data)
 * 4. Calls `query(tenantA.id)` — asserts non-empty (A can see its own data)
 *
 * @example
 * ```ts
 * await testTenantIsolation({
 *   setup: async (tenantId) => {
 *     await createTestRecord({ tenantId });
 *   },
 *   query: async (tenantId) => {
 *     return getRecordsForTenant(tenantId);
 *   },
 * });
 * ```
 */
export async function testTenantIsolation(
  options: TenantIsolationOptions,
): Promise<void> {
  const { setup, query } = options;

  // Create two isolated tenants
  const tenantA = await createTestTenant({ name: 'Isolation Test Tenant A' });
  const tenantB = await createTestTenant({ name: 'Isolation Test Tenant B' });

  // Populate tenant A with test data
  await setup(tenantA.id);

  // Tenant B should NOT see tenant A's data
  const crossTenantResults = await query(tenantB.id);
  expect(crossTenantResults).toEqual([]);

  // Tenant A should see its own data
  const ownTenantResults = await query(tenantA.id);
  expect(ownTenantResults.length).toBeGreaterThan(0);
}
