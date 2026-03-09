import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestBase,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getConflictResolutionMode } from '../../data/sync-settings';
import { getDbForTenant, baseConnections, eq, and } from '@everystack/shared/db';
import { NotFoundError } from '../../lib/errors';

// ---------------------------------------------------------------------------
// getConflictResolutionMode
// ---------------------------------------------------------------------------

describe('getConflictResolutionMode', () => {
  it('returns last_write_wins by default', async () => {
    const user = await createTestUser();
    const tenant = await createTestTenant();
    const base = await createTestBase({ tenantId: tenant.id, createdBy: user.id });

    const mode = await getConflictResolutionMode(tenant.id, base.id);
    expect(mode).toBe('last_write_wins');
  }, 30_000);

  it('returns manual when connection is set to manual', async () => {
    const user = await createTestUser();
    const tenant = await createTestTenant();
    const base = await createTestBase({ tenantId: tenant.id, createdBy: user.id });

    // Update the connection to manual mode
    const db = getDbForTenant(tenant.id, 'write');
    await db
      .update(baseConnections)
      .set({ conflictResolution: 'manual' })
      .where(
        and(
          eq(baseConnections.id, base.id),
          eq(baseConnections.tenantId, tenant.id),
        ),
      );

    const mode = await getConflictResolutionMode(tenant.id, base.id);
    expect(mode).toBe('manual');
  }, 30_000);

  it('throws NotFoundError when connection does not exist', async () => {
    const tenant = await createTestTenant();
    const fakeConnectionId = '00000000-0000-4000-8000-000000000000';

    await expect(
      getConflictResolutionMode(tenant.id, fakeConnectionId),
    ).rejects.toThrow(NotFoundError);
  }, 30_000);

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();

      await testTenantIsolation({
        setup: async (tenantId) => {
          await createTestBase({ tenantId, createdBy: user.id });
        },
        query: async (tenantId) => {
          // Get all connections for this tenant by reading from DB
          const db = getDbForTenant(tenantId, 'read');
          const connections = await db
            .select({ id: baseConnections.id })
            .from(baseConnections)
            .where(eq(baseConnections.tenantId, tenantId));

          // Query each connection's conflict resolution mode
          const results = [];
          for (const conn of connections) {
            const mode = await getConflictResolutionMode(tenantId, conn.id);
            results.push({ connectionId: conn.id, mode });
          }
          return results;
        },
      });
    }, 30_000);
  });
});
