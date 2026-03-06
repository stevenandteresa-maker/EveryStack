import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  getTestDb,
  createTestTenant,
  createTestUser,
  createTestTenantMembership,
  createTestTenantRelationship,
} from '../../../testing/factories';
import {
  getEffectiveMemberships,
  getEffectiveMembershipForTenant,
} from '../effective-memberships';

/**
 * Integration tests for the effective_memberships view.
 *
 * These tests require a running Postgres database with migration 0023 applied.
 * They use real DB factories and query the actual view.
 */
describe('effective_memberships view', { timeout: 30_000 }, () => {
  const db = getTestDb();

  beforeAll(async () => {
    // Verify the view exists — will throw if migration 0023 not applied
    await db.execute(sql`SELECT 1 FROM "effective_memberships" LIMIT 0`);
  });

  it('returns direct membership with source=direct and null agency_tenant_id', async () => {
    const tenant = await createTestTenant();
    const user = await createTestUser();
    await createTestTenantMembership({
      tenantId: tenant.id,
      userId: user.id,
      role: 'admin',
      status: 'active',
    });

    const results = await getEffectiveMemberships(user.id, db);

    const match = results.find((r) => r.tenantId === tenant.id);
    expect(match).toBeDefined();
    expect(match!.source).toBe('direct');
    expect(match!.role).toBe('admin');
    expect(match!.agencyTenantId).toBeNull();
  });

  it('returns agency access with source=agency and correct agency_tenant_id', async () => {
    const agencyTenant = await createTestTenant({ name: 'Integration Agency' });
    const clientTenant = await createTestTenant({ name: 'Integration Client' });
    const agencyUser = await createTestUser();

    // Agency user is a member of the agency tenant
    await createTestTenantMembership({
      tenantId: agencyTenant.id,
      userId: agencyUser.id,
      role: 'member',
      status: 'active',
    });

    // Agency-client relationship
    await createTestTenantRelationship({
      agencyTenantId: agencyTenant.id,
      clientTenantId: clientTenant.id,
      accessLevel: 'builder',
      status: 'active',
    });

    const results = await getEffectiveMemberships(agencyUser.id, db);

    const agencyAccess = results.find(
      (r) => r.tenantId === clientTenant.id && r.source === 'agency',
    );
    expect(agencyAccess).toBeDefined();
    expect(agencyAccess!.role).toBe('builder');
    expect(agencyAccess!.agencyTenantId).toBe(agencyTenant.id);
  });

  it('excludes suspended tenant relationships', async () => {
    const agencyTenant = await createTestTenant({ name: 'Suspended Agency' });
    const clientTenant = await createTestTenant({ name: 'Suspended Client' });
    const user = await createTestUser();

    await createTestTenantMembership({
      tenantId: agencyTenant.id,
      userId: user.id,
      role: 'member',
      status: 'active',
    });

    await createTestTenantRelationship({
      agencyTenantId: agencyTenant.id,
      clientTenantId: clientTenant.id,
      accessLevel: 'admin',
      status: 'suspended',
    });

    const results = await getEffectiveMemberships(user.id, db);

    const suspended = results.find(
      (r) => r.tenantId === clientTenant.id && r.source === 'agency',
    );
    expect(suspended).toBeUndefined();
  });

  it('excludes suspended memberships', async () => {
    const tenant = await createTestTenant();
    const user = await createTestUser();

    await createTestTenantMembership({
      tenantId: tenant.id,
      userId: user.id,
      role: 'member',
      status: 'suspended',
    });

    const results = await getEffectiveMemberships(user.id, db);

    const match = results.find((r) => r.tenantId === tenant.id);
    expect(match).toBeUndefined();
  });

  it('returns both direct and agency rows when user has both access paths', async () => {
    const agencyTenant = await createTestTenant({ name: 'Dual Agency' });
    const clientTenant = await createTestTenant({ name: 'Dual Client' });
    const user = await createTestUser();

    // Direct membership in client tenant
    await createTestTenantMembership({
      tenantId: clientTenant.id,
      userId: user.id,
      role: 'member',
      status: 'active',
    });

    // Also an agency member with access to same client tenant
    await createTestTenantMembership({
      tenantId: agencyTenant.id,
      userId: user.id,
      role: 'admin',
      status: 'active',
    });

    await createTestTenantRelationship({
      agencyTenantId: agencyTenant.id,
      clientTenantId: clientTenant.id,
      accessLevel: 'builder',
      status: 'active',
    });

    const results = await getEffectiveMemberships(user.id, db);

    const clientAccess = results.filter((r) => r.tenantId === clientTenant.id);
    expect(clientAccess).toHaveLength(2);

    const directRow = clientAccess.find((r) => r.source === 'direct');
    const agencyRow = clientAccess.find((r) => r.source === 'agency');
    expect(directRow).toBeDefined();
    expect(directRow!.role).toBe('member');
    expect(agencyRow).toBeDefined();
    expect(agencyRow!.role).toBe('builder');
    expect(agencyRow!.agencyTenantId).toBe(agencyTenant.id);
  });

  it('returns empty array for user with no memberships', async () => {
    const user = await createTestUser();

    const results = await getEffectiveMemberships(user.id, db);
    expect(results).toEqual([]);
  });

  it('getEffectiveMembershipForTenant returns null for no membership', async () => {
    const user = await createTestUser();
    const tenant = await createTestTenant();

    const result = await getEffectiveMembershipForTenant(user.id, tenant.id, db);
    expect(result).toBeNull();
  });

  it('getEffectiveMembershipForTenant returns direct membership', async () => {
    const tenant = await createTestTenant();
    const user = await createTestUser();
    await createTestTenantMembership({
      tenantId: tenant.id,
      userId: user.id,
      role: 'owner',
      status: 'active',
    });

    const result = await getEffectiveMembershipForTenant(user.id, tenant.id, db);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('owner');
    expect(result!.source).toBe('direct');
  });
});
