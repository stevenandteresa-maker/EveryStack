export { db, dbRead, getDbForTenant } from './client';
export { createUserWithTenant, updateUserFromClerk } from './operations/user-operations';
export type { CreateUserWithTenantResult } from './operations/user-operations';
export type { DbIntent, DrizzleClient } from './client';
export { generateUUIDv7, isValidUUID } from './uuid';
export { setTenantContext, TENANT_SCOPED_TABLES, RLS_EXCLUDED_COLUMNS } from './rls';
export type { TenantScopedTable } from './rls';
export { eq, and, or, sql, inArray, isNull, isNotNull, desc, asc } from 'drizzle-orm';
export {
  users,
  tenants,
  tenantMemberships,
  tenantMembershipsRelations,
  boards,
  boardsRelations,
  boardMemberships,
  boardMembershipsRelations,
  workspaces,
  workspacesRelations,
  workspaceMemberships,
  workspaceMembershipsRelations,
  baseConnections,
  baseConnectionsRelations,
  tables,
  tablesRelations,
  fields,
  fieldsRelations,
  records,
  recordsRelations,
  crossLinks,
  crossLinksRelations,
  crossLinkIndex,
  crossLinkIndexRelations,
  threads,
  threadsRelations,
} from './schema';
export type {
  User, NewUser,
  Tenant, NewTenant,
  TenantMembership, NewTenantMembership,
  Board, NewBoard,
  BoardMembership, NewBoardMembership,
  Workspace, NewWorkspace,
  WorkspaceMembership, NewWorkspaceMembership,
  BaseConnection, NewBaseConnection,
  Table, NewTable,
  Field, NewField,
  DbRecord, NewDbRecord,
  CrossLink, NewCrossLink,
  CrossLinkIndex, NewCrossLinkIndex,
  Thread, NewThread,
} from './schema';
