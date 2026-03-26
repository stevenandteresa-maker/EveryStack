---
name: dual-authorization-model
category: auth-pattern
derivedFrom:
  - doc: docs/reference/permissions.md
    section: Workspace Roles
    sourceHash: placeholder
  - doc: docs/reference/permissions.md
    section: Field-Level Permissions
    sourceHash: placeholder
  - doc: docs/reference/permissions.md
    section: Permission Resolution at Runtime
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: Permission Model
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Dual Authorization Model

EveryStack implements a two-layer authorization system with tenant-level roles (Owner, Admin, Member) and workspace-level roles (Manager, Team Member, Viewer). The Table View serves as the access boundary for Team Members and Viewers.

## Convention Rules

- Every user MUST have a tenant-level role stored on tenant_memberships table
- Member-tier users MAY have workspace-level roles stored on workspace_memberships table
- Owner and Admin roles MUST bypass workspace scoping and see all data
- Team Members and Viewers MUST only access data through granted Table Views
- Permission resolution MUST check tenant_memberships first, then fall through to workspace_memberships
- All permission checks MUST use the effective_memberships database view
- Field permissions MUST resolve to exactly three states: read-write, read-only, or hidden
- Table Views MUST be the access boundary — no direct table access for Team Members/Viewers

## Pattern Templates

Covers Permission Resolution Pattern, Role Hierarchy Check, Table View Access Control.

### Permission Resolution Pattern
```typescript
// Always use effective_memberships view for auth resolution
const membership = await db
  .select()
  .from(effectiveMemberships)
  .where(
    and(
      eq(effectiveMemberships.userId, userId),
      eq(effectiveMemberships.tenantId, tenantId)
    )
  )
  .limit(1);

if (!membership) {
  throw new AppError('Access denied', 403);
}

// Check tenant-level role first
if (membership.tenantRole === 'owner' || membership.tenantRole === 'admin') {
  // Full access to all workspaces
  return 'full-access';
}

// Fall through to workspace-level role
if (membership.workspaceRole) {
  return resolveWorkspacePermissions(membership.workspaceRole, resourceId);
}

throw new AppError('No workspace access', 403);
```

### Role Hierarchy Check
```typescript
type TenantRole = 'owner' | 'admin' | 'member';
type WorkspaceRole = 'manager' | 'team_member' | 'viewer';

function canManageWorkspace(tenantRole: TenantRole, workspaceRole?: WorkspaceRole): boolean {
  // Tenant-level roles bypass workspace restrictions
  if (tenantRole === 'owner' || tenantRole === 'admin') {
    return true;
  }
  
  // Workspace-level check for Members
  return workspaceRole === 'manager';
}

function canEditRecord(tenantRole: TenantRole, workspaceRole?: WorkspaceRole, fieldPermissions: FieldPermissions): boolean {
  if (tenantRole === 'owner' || tenantRole === 'admin') {
    return true; // Always full access
  }
  
  if (workspaceRole === 'viewer') {
    return false; // Viewers are read-only by default
  }
  
  // Check field-level permissions for Team Members and Managers
  return fieldPermissions.state === 'read-write';
}
```

### Table View Access Control
```typescript
// Team Members/Viewers only see granted Table Views
function getAccessibleViews(userId: string, tenantId: string) {
  return db
    .select()
    .from(views)
    .innerJoin(viewMemberships, eq(views.id, viewMemberships.viewId))
    .where(
      and(
        eq(views.tenantId, tenantId),
        eq(viewMemberships.userId, userId),
        eq(views.type, 'shared') // Only Shared Views, not My Views
      )
    );
}

// Owners/Admins see all workspaces, Managers see permitted tables + granted views
function getSidebarNavigation(membership: EffectiveMembership) {
  if (membership.tenantRole === 'owner' || membership.tenantRole === 'admin') {
    return getAllWorkspacesAndTables(membership.tenantId);
  }
  
  if (membership.workspaceRole === 'manager') {
    return getManagerPermittedTables(membership.userId, membership.tenantId);
  }
  
  // Team Members and Viewers only see Table Views
  return getAccessibleViews(membership.userId, membership.tenantId);
}
```

## Validation Criteria

- All auth middleware queries effective_memberships view, never underlying tables directly
- Permission resolution checks tenant_memberships first, then workspace_memberships
- Owner and Admin roles have unrestricted access to all tenant data
- Team Members and Viewers cannot access raw table structure
- All field permission states resolve to read-write, read-only, or hidden
- Table View membership is explicitly granted, never automatic
- Sidebar navigation reflects role-appropriate data access
- Permission denial returns consistent error shapes across all surfaces