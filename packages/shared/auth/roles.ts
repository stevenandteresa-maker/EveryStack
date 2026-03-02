// ---------------------------------------------------------------------------
// Role constants, types, and hierarchy for the five-role permission model.
// Two layers: Tenant-level (owner | admin | member) and
// Workspace-level (manager | team_member | viewer).
// ---------------------------------------------------------------------------

/** Tenant-level roles. */
export const TENANT_ROLES = ['owner', 'admin', 'member'] as const;
export type TenantRole = (typeof TENANT_ROLES)[number];

/** Workspace-level roles (applicable when tenant role is 'member'). */
export const WORKSPACE_ROLES = ['manager', 'team_member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/**
 * Combined five-role hierarchy resolved from tenant + workspace membership.
 * Owner and Admin are tenant-wide; Manager, Team Member, and Viewer are
 * workspace-scoped.
 */
export type EffectiveRole = 'owner' | 'admin' | 'manager' | 'team_member' | 'viewer';

/**
 * Numeric ranking for the five-role hierarchy.
 * Higher number = more privilege.
 */
export const ROLE_HIERARCHY: Record<EffectiveRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  team_member: 20,
  viewer: 10,
} as const;

/**
 * Returns true if `userRole` is equal to or higher than `requiredRole`
 * in the five-role hierarchy.
 */
export function roleAtLeast(
  userRole: EffectiveRole,
  requiredRole: EffectiveRole,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
