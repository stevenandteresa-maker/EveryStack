// ---------------------------------------------------------------------------
// Sync package — canonical transform layer, field registry, platform adapters
// ---------------------------------------------------------------------------

// Types
export type {
  // Supporting types
  SourceRefs,
  SyncPlatform,
  // Category 1: Text
  TextValue,
  TextAreaValue,
  SmartDocValue,
  // Category 2: Number
  NumberValue,
  CurrencyValue,
  PercentValue,
  RatingValue,
  DurationValue,
  ProgressValue,
  AutoNumberValue,
  // Category 3: Selection
  SelectOption,
  SingleSelectValue,
  MultipleSelectValue,
  StatusCategory,
  StatusValue,
  TagValue,
  // Category 4: Date & Time
  DateValue,
  DateRangeValue,
  DueDateValue,
  TimeValue,
  CreatedAtValue,
  UpdatedAtValue,
  // Category 5: People & Contact
  PeopleValue,
  CreatedByValue,
  UpdatedByValue,
  EmailValue,
  PhoneEntry,
  PhoneValue,
  UrlValue,
  AddressData,
  AddressValue,
  FullNameData,
  FullNameValue,
  SocialValue,
  // Category 6: Boolean & Interactive
  CheckboxValue,
  ButtonValue,
  ChecklistItem,
  ChecklistValue,
  SignatureData,
  SignatureValue,
  // Category 7: Relational
  LinkedRecordEntry,
  LinkedRecordValue,
  // Category 8: Files
  FileObject,
  FilesValue,
  // Category 9: Identification
  BarcodeValue,
  // Union and utility types
  CanonicalValue,
  CanonicalFieldType,
  CanonicalData,
  // Sync metadata
  SyncedFieldValue,
  SyncMetadata,
  RecordSyncMetadata,
  // Transform types
  PlatformFieldConfig,
  FieldTransform,
  // Outbound sync
  OutboundSyncJob,
  OutboundSyncResult,
  // Conflict detection
  ConflictStatus,
  DetectedConflict,
  CleanChange,
  ConflictDetectionResult,
  // Filter grammar
  FilterOperator,
  FilterRule,
  SyncTableConfig,
  SyncConfig,
} from './types';

// Filter & sync config schemas
export {
  FilterOperatorSchema,
  FilterRuleSchema,
  SyncTableConfigSchema,
  SyncConfigSchema,
  SyncedFieldValueSchema,
  SyncMetadataSchema,
} from './types';

// Sync metadata utilities
export {
  createInitialSyncMetadata,
  updateLastSyncedValues,
  getLastSyncedValue,
} from './sync-metadata';

// Outbound sync pipeline
export { executeOutboundSync, COMPUTED_FIELD_TYPES, isComputedFieldType } from './outbound';

// Conflict detection
export { detectConflicts, writeConflictRecords, valuesAreEqual } from './conflict-detection';
export type { WrittenConflict } from './conflict-detection';

// Conflict resolution
export { applyLastWriteWins } from './conflict-resolution';
export type { ConflictResolutionStrategy, LastWriteWinsResult } from './conflict-resolution';

// Registry
export { FieldTypeRegistry, fieldTypeRegistry } from './field-registry';

// Adapter types
export type {
  PlatformAdapter,
  FieldMapping,
  PlatformRateLimits,
  RateLimit,
  RetryStrategy,
} from './adapters/types';

// Rate limiter
export {
  RateLimiter,
  rateLimiter,
  AIRTABLE_RATE_LIMITS,
} from './rate-limiter';
export type { RateLimitResult } from './rate-limiter';

// Record quota enforcement
export {
  PLAN_QUOTAS,
  checkRecordQuota,
  canSyncRecords,
  enforceQuotaOnBatch,
  canCreateRecord,
  countTenantRecords,
  getTenantPlanQuota,
  incrementQuotaCache,
  decrementQuotaCache,
  invalidateQuotaCache,
  setQuotaRedisClient,
} from './quota';
export type {
  QuotaResult,
  SyncQuotaCheck,
  BatchQuotaResult,
} from './quota';

// Platform adapters
export {
  AirtableAdapter,
  registerAirtableTransforms,
  translateFilterToFormula,
  applyLocalFilters,
  getLocalOnlyFilters,
  canPushDown,
  AirtableApiClient,
  AIRTABLE_API_BASE_URL,
} from './adapters/airtable';
export type {
  AirtableApiRecord,
  AirtableListRecordsResponse,
  ListRecordsOptions,
} from './adapters/airtable';

// Airtable OAuth
export {
  generateCodeVerifier,
  generateCodeChallenge,
  getAirtableAuthUrl,
  exchangeCodeForTokens,
  refreshAirtableToken,
  listAirtableBases,
  listAirtableTables,
  estimateAirtableRecordCount,
} from './adapters/airtable/oauth';
export type {
  AirtableTokens,
  AirtableBase,
  AirtableTableMeta,
  AirtableFieldMeta,
} from './adapters/airtable/oauth';
