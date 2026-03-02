// Schema barrel file — all Drizzle table definitions are re-exported from here.
// Usage: import { users, tenants, workspaces } from '@everystack/shared/db';

export { users } from './users';
export type { User, NewUser } from './users';

export { tenants } from './tenants';
export type { Tenant, NewTenant } from './tenants';

export { tenantMemberships, tenantMembershipsRelations } from './tenant-memberships';
export type { TenantMembership, NewTenantMembership } from './tenant-memberships';

export { boards, boardsRelations } from './boards';
export type { Board, NewBoard } from './boards';

export { boardMemberships, boardMembershipsRelations } from './board-memberships';
export type { BoardMembership, NewBoardMembership } from './board-memberships';

export { workspaces, workspacesRelations } from './workspaces';
export type { Workspace, NewWorkspace } from './workspaces';

export { workspaceMemberships, workspaceMembershipsRelations } from './workspace-memberships';
export type { WorkspaceMembership, NewWorkspaceMembership } from './workspace-memberships';
