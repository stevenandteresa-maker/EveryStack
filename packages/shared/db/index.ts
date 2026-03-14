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
export { eq, and, or, sql, inArray, isNull, isNotNull, desc, asc, count } from 'drizzle-orm';
export type { SQL } from 'drizzle-orm';
export { buildSearchVector, extractSearchableText } from './search';
export type { SearchFieldDefinition } from './search';
export {
  generateIndexName,
  createFieldExpressionIndex,
  dropFieldExpressionIndex,
  INDEXABLE_FIELD_TYPES,
} from './index-utils';
export type { IndexableFieldType } from './index-utils';
export {
  canonicalFieldExpression,
  canonicalFieldExists,
  canonicalFieldOrderBy,
  QUERYABLE_FIELD_TYPES,
} from './query-helpers';
export type { QueryableFieldType, SortDirection } from './query-helpers';
export { effectiveMemberships } from './schema';
export type { EffectiveMembership } from './schema';
export {
  getEffectiveMemberships,
  getEffectiveMembershipForTenant,
} from './operations/effective-memberships';
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
  apiKeys,
  apiKeysRelations,
  auditLog,
  auditLogRelations,
  apiRequestLog,
  apiRequestLogRelations,
  portals,
  portalsRelations,
  portalAccess,
  portalAccessRelations,
  syncedFieldMappings,
  syncedFieldMappingsRelations,
  views,
  viewsRelations,
  userViewPreferences,
  userViewPreferencesRelations,
  syncConflicts,
  syncConflictsRelations,
  syncFailures,
  syncFailuresRelations,
  syncSchemaChanges,
  syncSchemaChangesRelations,
  automations,
  automationsRelations,
  fieldExpressionIndexes,
  recordViewConfigs,
  recordViewConfigsRelations,
  forms,
  formsRelations,
  sections,
  sectionsRelations,
  userRecentItems,
  userRecentItemsRelations,
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
  ApiKey, NewApiKey,
  AuditLog, NewAuditLog,
  ApiRequestLog, NewApiRequestLog,
  Portal, NewPortal,
  PortalAccess, NewPortalAccess,
  SyncedFieldMapping, NewSyncedFieldMapping,
  View, NewView,
  UserViewPreference, NewUserViewPreference,
  SyncConflict, NewSyncConflict,
  SyncFailure, NewSyncFailure,
  SyncSchemaChange, NewSyncSchemaChange,
  Automation, NewAutomation,
  FieldExpressionIndex, NewFieldExpressionIndex,
  RecordViewConfig, NewRecordViewConfig,
  Form, NewForm,
  Section, NewSection,
  UserRecentItem, NewUserRecentItem,
} from './schema';
