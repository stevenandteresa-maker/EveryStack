import {
  getEffectiveMemberships,
  getEffectiveMembershipForTenant,
} from '@everystack/shared/db';
import type { EffectiveMembership } from '@everystack/shared/db';

/**
 * Resolved user access for a specific tenant.
 *
 * - `role`: The effective tenant-level role (owner | admin | member for direct;
 *   mapped from access_level for agency).
 * - `source`: 'direct' (from tenant_memberships) or 'agency' (via tenant_relationships).
 * - `agencyTenantId`: The agency tenant ID when source is 'agency', null otherwise.
 */
export interface ResolvedUserAccess {
  role: string;
  source: 'direct' | 'agency';
  agencyTenantId: string | null;
}

/**
 * Maps agency access_level values to tenant-level role equivalents.
 *
 * - admin   → 'admin'  (Admin-equivalent — full workspace access, no billing/ownership)
 * - builder → 'member' (Manager-equivalent — create/manage tables, views, portals)
 * - read_only → 'viewer' (Viewer-equivalent — read-only workspace access)
 */
const AGENCY_ROLE_MAP: Record<string, string> = {
  admin: 'admin',
  builder: 'member',
  read_only: 'viewer',
};

/**
 * Resolve a user's access to a specific tenant via the effective_memberships view.
 *
 * Returns the resolved role and source, or null if the user has no access.
 * Direct memberships take precedence over agency access (the view returns
 * direct rows before agency rows, and we use LIMIT 1).
 */
export async function resolveUserAccess(
  userId: string,
  tenantId: string,
): Promise<ResolvedUserAccess | null> {
  const membership = await getEffectiveMembershipForTenant(userId, tenantId);

  if (!membership) {
    return null;
  }

  return mapMembershipToAccess(membership);
}

/**
 * Resolve all tenants a user can access via the effective_memberships view.
 *
 * Returns an array of tenant IDs (deduplicated — direct takes precedence).
 */
export async function resolveUserTenants(
  userId: string,
): Promise<string[]> {
  const memberships = await getEffectiveMemberships(userId);

  // Deduplicate: if a user has both direct and agency access to a tenant,
  // the direct membership already takes precedence in the view ordering,
  // but we still deduplicate tenant IDs for the caller.
  const seen = new Set<string>();
  const tenantIds: string[] = [];

  for (const m of memberships) {
    if (!seen.has(m.tenantId)) {
      seen.add(m.tenantId);
      tenantIds.push(m.tenantId);
    }
  }

  return tenantIds;
}

/**
 * Map an EffectiveMembership row to a ResolvedUserAccess.
 * For agency source, translates access_level to tenant role equivalent.
 */
function mapMembershipToAccess(
  membership: EffectiveMembership,
): ResolvedUserAccess {
  if (membership.source === 'agency') {
    const mappedRole = AGENCY_ROLE_MAP[membership.role] ?? 'viewer';
    return {
      role: mappedRole,
      source: 'agency',
      agencyTenantId: membership.agencyTenantId,
    };
  }

  return {
    role: membership.role,
    source: 'direct',
    agencyTenantId: null,
  };
}
