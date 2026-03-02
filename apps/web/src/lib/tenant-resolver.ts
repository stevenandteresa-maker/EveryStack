import {
  and,
  eq,
  dbRead,
  users,
  tenants,
  tenantMemberships,
} from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

/**
 * Resolve a Clerk user ID to the internal EveryStack user UUID
 * and all tenant IDs the user has active memberships for.
 *
 * Uses the admin/system database connection (not tenant-scoped)
 * because users can belong to multiple tenants.
 */
export async function resolveUser(
  clerkUserId: string,
): Promise<{ id: string; tenantIds: string[] }> {
  const [user] = await dbRead
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const memberships = await dbRead
    .select({ tenantId: tenantMemberships.tenantId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, user.id),
        eq(tenantMemberships.status, 'active'),
      ),
    );

  return {
    id: user.id,
    tenantIds: memberships.map((m) => m.tenantId),
  };
}

/**
 * Resolve the active tenant ID for a given internal user.
 *
 * - If `clerkOrgId` is provided, looks up the tenant mapped to that Clerk
 *   organization and verifies the user has an active membership.
 * - If `clerkOrgId` is null, falls back to the user's first active tenant
 *   membership (single-tenant users).
 *
 * Cross-tenant access attempts return 404 (not 403) to prevent
 * tenant enumeration — per permissions.md § Tenant Isolation.
 */
export async function resolveTenant(
  userId: string,
  clerkOrgId: string | null,
): Promise<string> {
  if (clerkOrgId) {
    const [tenant] = await dbRead
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Verify the user has an active membership in this tenant
    const [membership] = await dbRead
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.userId, userId),
          eq(tenantMemberships.tenantId, tenant.id),
          eq(tenantMemberships.status, 'active'),
        ),
      )
      .limit(1);

    if (!membership) {
      // 404 — not 403: user cannot determine whether tenant exists
      throw new NotFoundError('Tenant not found');
    }

    return tenant.id;
  }

  // No Clerk org — use first active tenant membership
  const [membership] = await dbRead
    .select({ tenantId: tenantMemberships.tenantId })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new NotFoundError('No active tenant found for user');
  }

  return membership.tenantId;
}
