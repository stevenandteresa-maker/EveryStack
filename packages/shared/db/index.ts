export { db, dbRead, getDbForTenant } from './client';
export {
  writeAuditLog,
  writeAuditLogBatch,
  auditEntrySchema,
  AUDIT_ACTOR_TYPES,
  AUDIT_RETENTION_DAYS,
} from './audit';
export type {
  AuditActorType,
  AuditEntry,
  AuditBatchDetails,
  AuditBatchEntry,
  DrizzleTransaction,
} from './audit';
export { createUserWithTenant, updateUserFromClerk } from './operations/user-operations';
export type { CreateUserWithTenantResult } from './operations/user-operations';
export type { DbIntent, DrizzleClient } from './client';
export { generateUUIDv7, isValidUUID } from './uuid';
export { setTenantContext, TENANT_SCOPED_TABLES, RLS_EXCLUDED_COLUMNS } from './rls';
export type { TenantScopedTable } from './rls';
export {
  API_KEY_PREFIXES,
  API_KEY_SCOPES,
  RATE_LIMIT_TIERS,
  generateApiKey,
  hashApiKey,
  verifyApiKeyHash,
  apiKeyCreateSchema,
} from './api-key-utils';
export type {
  ApiKeyEnvironment,
  ApiKeyScope,
  RateLimitTier,
  GeneratedApiKey,
  ApiKeyCreateInput,
} from './api-key-utils';
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
  files,
  filesRelations,
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
  FileRecord, NewFileRecord,
} from './schema';
