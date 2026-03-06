import {
  eq,
  dbRead,
  users,
  tenants,
} from '@everystack/shared/db';
import { webLogger } from '@everystack/shared/logging';
import { NotFoundError } from '@/lib/errors';
import {
  resolveUserAccess,
  resolveUserTenants,
} from '@/lib/auth/effective-membership';
import type { ResolvedUserAccess } from '@/lib/auth/effective-membership';

const logger = webLogger;

/**
 * Result of resolving a tenant for a user.
 * Includes the tenant ID and optional agency context.
 */
export interface ResolvedTenant {
  tenantId: string;
  /** Non-null when the user accesses this tenant via agency relationship */
  agencyTenantId: string | null;
}

/**
 * Resolve a Clerk user ID to the internal EveryStack user UUID
 * and all tenant IDs the user has effective access to (direct + agency).
 *
 * Uses the effective_memberships view to include both direct memberships
 * and agency access via tenant_relationships.
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

  const tenantIds = await resolveUserTenants(user.id);

  return {
    id: user.id,
    tenantIds,
  };
}

/**
 * Resolve the active tenant ID for a given internal user.
 *
 * - If `clerkOrgId` is provided, looks up the tenant mapped to that Clerk
 *   organization and verifies the user has effective access (direct or agency).
 * - If `clerkOrgId` is null, falls back to the user's first effective tenant.
 *
 * Cross-tenant access attempts return 404 (not 403) to prevent
 * tenant enumeration — per permissions.md § Tenant Isolation.
 */
export async function resolveTenant(
  userId: string,
  clerkOrgId: string | null,
): Promise<ResolvedTenant> {
  if (clerkOrgId) {
    const [tenant] = await dbRead
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Verify the user has effective access (direct or agency)
    const access = await resolveUserAccess(userId, tenant.id);

    if (!access) {
      // 404 — not 403: user cannot determine whether tenant exists
      throw new NotFoundError('Tenant not found');
    }

    logAgencyAccessIfApplicable(userId, tenant.id, access);

    return {
      tenantId: tenant.id,
      agencyTenantId: access.agencyTenantId,
    };
  }

  // No Clerk org — use first effective tenant
  const tenantIds = await resolveUserTenants(userId);
  const firstTenantId = tenantIds[0];

  if (!firstTenantId) {
    throw new NotFoundError('No active tenant found for user');
  }

  // For the fallback path, resolve access to get agency context
  const access = await resolveUserAccess(userId, firstTenantId);

  if (access) {
    logAgencyAccessIfApplicable(userId, firstTenantId, access);
  }

  return {
    tenantId: firstTenantId,
    agencyTenantId: access?.agencyTenantId ?? null,
  };
}

/**
 * Log agency access at info level when a user accesses a client tenant
 * via an agency relationship.
 */
function logAgencyAccessIfApplicable(
  userId: string,
  clientTenantId: string,
  access: ResolvedUserAccess,
): void {
  if (access.source === 'agency' && access.agencyTenantId) {
    logger.info({
      msg: 'agency_access',
      userId,
      agencyTenantId: access.agencyTenantId,
      clientTenantId,
      accessLevel: access.role,
    });
  }
}
