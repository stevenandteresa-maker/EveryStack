// ---------------------------------------------------------------------------
// Role resolution and authorization check utilities.
// All queries go through getDbForTenant() — no raw SQL.
// ---------------------------------------------------------------------------

import { eq, and } from 'drizzle-orm';
import { getDbForTenant } from '../db/client';
import { tenantMemberships } from '../db/schema/tenant-memberships';
import { workspaceMemberships } from '../db/schema/workspace-memberships';
import type { EffectiveRole, TenantRole } from './roles';
import { roleAtLeast } from './roles';
import { PermissionDeniedError } from './errors';

/** Maps tenant-level owner/admin directly to EffectiveRole. */
const TENANT_ROLE_TO_EFFECTIVE: Partial<Record<TenantRole, EffectiveRole>> = {
  owner: 'owner',
  admin: 'admin',
};

/**
 * Resolves a user's effective role within a tenant (and optionally a workspace).
 *
 * - Owner / Admin → returned immediately regardless of workspaceId.
 * - Member + workspaceId → returns the workspace-level role.
 * - Member without workspaceId, or no membership found → returns null.
 */
export async function resolveEffectiveRole(
  userId: string,
  tenantId: string,
  workspaceId?: string,
): Promise<EffectiveRole | null> {
  const db = getDbForTenant(tenantId, 'read');

  // 1. Look up tenant membership (must be active)
  const [membership] = await db
    .select({ role: tenantMemberships.role })
    .from(tenantMemberships)
    .where(
      and(
        eq(tenantMemberships.userId, userId),
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) return null;

  const tenantRole = membership.role as TenantRole;

  // 2. Owner and Admin bypass workspace scoping
  const effective = TENANT_ROLE_TO_EFFECTIVE[tenantRole];
  if (effective) return effective;

  // 3. Member requires a workspace context
  if (!workspaceId) return null;

  const [wsMembership] = await db
    .select({ role: workspaceMemberships.role })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!wsMembership) return null;

  return wsMembership.role as EffectiveRole;
}

/**
 * Returns true if the user's effective role meets the required role.
 */
export async function checkRole(
  userId: string,
  tenantId: string,
  workspaceId: string | undefined,
  requiredRole: EffectiveRole,
): Promise<boolean> {
  const effective = await resolveEffectiveRole(userId, tenantId, workspaceId);
  if (!effective) return false;
  return roleAtLeast(effective, requiredRole);
}

/**
 * Throws PermissionDeniedError if the user lacks the required role.
 */
export async function requireRole(
  userId: string,
  tenantId: string,
  workspaceId: string | undefined,
  requiredRole: EffectiveRole,
  resource: string,
  action: string,
): Promise<void> {
  const allowed = await checkRole(userId, tenantId, workspaceId, requiredRole);
  if (!allowed) {
    throw new PermissionDeniedError(
      "You don't have permission to do that.",
      {
        action,
        resource,
        requiredRole,
      },
    );
  }
}
