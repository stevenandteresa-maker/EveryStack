// ---------------------------------------------------------------------------
// Canonical Value Types — the JSONB shapes stored in records.canonical_data
//
// Each field type has a discriminated union variant keyed by `type`.
// Values are stored in canonical_data keyed by the field's UUID (fields.id).
// Platform adapters transform to/from these shapes via FieldTypeRegistry.
//
// Covers all 9 MVP categories from data-model.md § Field Type Taxonomy.
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Filter Grammar — shared by sync filters, grid view filters, portal
// data_scope, and App record_filters (post-MVP).
// @see docs/reference/sync-engine.md § Sync Filters
// ---------------------------------------------------------------------------

/**
 * All supported filter comparison operators.
 * Used across sync filters, view filters, and portal data scopes.
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_any_of'
  | 'is_none_of'
  | 'is_before'
  | 'is_after'
  | 'is_within';

/**
 * A single filter condition. Combined into arrays using the
 * `conjunction` property to form AND/OR groups.
 */
export interface FilterRule {
  /** EveryStack field ID (mapped from platform field during sync setup). */
  fieldId: string;
  /** The comparison operator to apply. */
  operator: FilterOperator;
  /** Value to compare against. Type depends on field type and operator. */
  value: unknown;
  /** How this rule combines with the next rule in the array. */
  conjunction: 'and' | 'or';
}

// ---------------------------------------------------------------------------
// Zod schemas for filter types
// ---------------------------------------------------------------------------

export const FilterOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'greater_equal',
  'less_equal',
  'is_empty',
  'is_not_empty',
  'is_any_of',
  'is_none_of',
  'is_before',
  'is_after',
  'is_within',
]);

export const FilterRuleSchema = z.object({
  fieldId: z.string().min(1),
  operator: FilterOperatorSchema,
  value: z.unknown(),
  conjunction: z.enum(['and', 'or']),
});

// ---------------------------------------------------------------------------
// SyncConfig — shape of base_connections.sync_config (JSONB)
// @see docs/reference/sync-engine.md § Table Selection Model
// ---------------------------------------------------------------------------

/**
 * Per-table sync configuration within a base connection.
 */
export interface SyncTableConfig {
  /** Platform's table/database ID. */
  external_table_id: string;
  /** Display name from platform. */
  external_table_name: string;
  /** Whether this table is selected for sync. */
  enabled: boolean;
  /** Inbound filter — same grammar as view filters. Null = no filter (sync all). */
  sync_filter: FilterRule[] | null;
  /** Last known record count from the platform. */
  estimated_record_count: number;
  /** Actual number of records synced locally. */
  synced_record_count: number;
  /** Previous filter saved when a filter is changed — enables undo. Null when no prior filter exists. */
  previous_sync_filter?: FilterRule[] | null;
  /** EveryStack table UUID created for this external table. Set during schema sync. */
  es_table_id?: string;
}

/**
 * Root sync configuration stored in `base_connections.sync_config` JSONB column.
 */
export interface SyncConfig {
  /** Polling interval in seconds. Default: 300 (5 min). */
  polling_interval_seconds: number;
  /** Per-table selection and filter configuration. */
  tables: SyncTableConfig[];
}

export const SyncTableConfigSchema = z.object({
  external_table_id: z.string().min(1),
  external_table_name: z.string().min(1),
  enabled: z.boolean(),
  sync_filter: z.array(FilterRuleSchema).nullable(),
  estimated_record_count: z.number().int().min(0),
  synced_record_count: z.number().int().min(0),
  previous_sync_filter: z.array(FilterRuleSchema).nullable().optional(),
  es_table_id: z.string().uuid().optional(),
});

export const SyncConfigSchema = z.object({
  polling_interval_seconds: z.number().int().min(1).default(300),
  tables: z.array(SyncTableConfigSchema),
});

// ---------------------------------------------------------------------------
// Supporting types
// ---------------------------------------------------------------------------

/**
 * Platform-specific identifiers preserved for lossless round-tripping.
 * Each key is a platform name; the value is whatever the platform uses
 * to identify this particular value (label string, option ID, etc.).
 */
export interface SourceRefs {
  airtable?: string | Record<string, unknown>;
  notion?: string | Record<string, unknown>;
  smartsuite?: string | Record<string, unknown>;
}

/** Supported platform identifiers for sync adapters. */
export type SyncPlatform = 'airtable' | 'notion' | 'smartsuite';

// ---------------------------------------------------------------------------
// Category 1: Text
// ---------------------------------------------------------------------------

export interface TextValue {
  type: 'text';
  value: string | null;
}

export interface TextAreaValue {
  type: 'text_area';
  value: string | null;
}

/** TipTap JSON document or a reference ID to smart_doc_content table. */
export interface SmartDocValue {
  type: 'smart_doc';
  value: Record<string, unknown> | string | null;
}

// ---------------------------------------------------------------------------
// Category 2: Number
// ---------------------------------------------------------------------------

export interface NumberValue {
  type: 'number';
  value: number | null;
}

export interface CurrencyValue {
  type: 'currency';
  value: number | null;
}

/** Stored as decimal: 0.75 = 75%. */
export interface PercentValue {
  type: 'percent';
  value: number | null;
}

export interface RatingValue {
  type: 'rating';
  value: number | null;
}

/** Stored as minutes. */
export interface DurationValue {
  type: 'duration';
  value: number | null;
}

/** 0–100 range. */
export interface ProgressValue {
  type: 'progress';
  value: number | null;
}

/** Read-only system field. Auto-increment integer. */
export interface AutoNumberValue {
  type: 'auto_number';
  value: number | null;
}

// ---------------------------------------------------------------------------
// Category 3: Selection
// ---------------------------------------------------------------------------

export interface SelectOption {
  id: string;
  label: string;
  color?: string;
  level?: number | null;
  source_refs?: SourceRefs;
}

export interface SingleSelectValue {
  type: 'single_select';
  value: {
    id: string;
    label: string;
    source_refs?: SourceRefs;
  } | null;
}

export interface MultipleSelectValue {
  type: 'multiple_select';
  value: Array<{
    id: string;
    label: string;
    source_refs?: SourceRefs;
  }>;
}

export type StatusCategory = 'not_started' | 'in_progress' | 'done' | 'closed';

export interface StatusValue {
  type: 'status';
  value: {
    id: string;
    label: string;
    category: StatusCategory;
    source_refs?: SourceRefs;
  } | null;
}

export interface TagValue {
  type: 'tag';
  value: string[];
}

// ---------------------------------------------------------------------------
// Category 4: Date & Time
// ---------------------------------------------------------------------------

/** ISO 8601 string, optionally with time component. */
export interface DateValue {
  type: 'date';
  value: string | null;
}

export interface DateRangeValue {
  type: 'date_range';
  value: {
    start: string | null;
    end: string | null;
  } | null;
}

/** ISO 8601 string with countdown/overdue semantics. */
export interface DueDateValue {
  type: 'due_date';
  value: string | null;
}

/** HH:MM string (24h storage, display format is config-driven). */
export interface TimeValue {
  type: 'time';
  value: string | null;
}

/** System field. ISO 8601. Read-only. */
export interface CreatedAtValue {
  type: 'created_at';
  value: string | null;
}

/** System field. ISO 8601. Read-only. */
export interface UpdatedAtValue {
  type: 'updated_at';
  value: string | null;
}

// ---------------------------------------------------------------------------
// Category 5: People & Contact
// ---------------------------------------------------------------------------

/** Array of workspace member user IDs. */
export interface PeopleValue {
  type: 'people';
  value: string[];
}

/** System field. Single user ID. Read-only. */
export interface CreatedByValue {
  type: 'created_by';
  value: string | null;
}

/** System field. Single user ID. Read-only. */
export interface UpdatedByValue {
  type: 'updated_by';
  value: string | null;
}

export interface EmailValue {
  type: 'email';
  value: string | null;
}

export interface PhoneEntry {
  number: string;
  type?: string;
  country_code?: string;
}

export interface PhoneValue {
  type: 'phone';
  value: PhoneEntry | PhoneEntry[] | null;
}

export interface UrlValue {
  type: 'url';
  value: string | null;
}

export interface AddressData {
  street?: string | null;
  street2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface AddressValue {
  type: 'address';
  value: AddressData | null;
}

export interface FullNameData {
  prefix?: string | null;
  first?: string | null;
  middle?: string | null;
  last?: string | null;
  suffix?: string | null;
}

export interface FullNameValue {
  type: 'full_name';
  value: FullNameData | null;
}

/** Map of platform key to profile URL. */
export interface SocialValue {
  type: 'social';
  value: Record<string, string> | null;
}

// ---------------------------------------------------------------------------
// Category 6: Boolean & Interactive
// ---------------------------------------------------------------------------

export interface CheckboxValue {
  type: 'checkbox';
  value: boolean;
}

/** Buttons store no value — they trigger actions. */
export interface ButtonValue {
  type: 'button';
  value: null;
}

export interface ChecklistItem {
  id: string;
  title: string;
  assignee_id?: string | null;
  due_date?: string | null;
  completed: boolean;
}

export interface ChecklistValue {
  type: 'checklist';
  value: ChecklistItem[];
}

export interface SignatureData {
  signature_data: string;
  signer_name: string;
  signer_email: string;
  signed_at: string;
  signer_ip?: string;
  user_agent?: string;
  consent_text?: string;
  document_hash?: string;
}

export interface SignatureValue {
  type: 'signature';
  value: SignatureData | null;
}

// ---------------------------------------------------------------------------
// Category 7: Relational
// ---------------------------------------------------------------------------

export interface LinkedRecordEntry {
  /** ES record UUID, or null if the linked record is not synced locally. */
  record_id: string | null;
  /** Original platform record ID, stored when record_id is null (filtered-out). */
  platform_record_id?: string;
  /** Display value cached from the source platform. */
  display?: string;
  /** True when the linked record exists on the platform but was excluded by the sync filter. */
  filtered_out?: boolean;
}

export interface LinkedRecordValue {
  type: 'linked_record';
  value: LinkedRecordEntry[];
}

// ---------------------------------------------------------------------------
// Category 8: Files
// ---------------------------------------------------------------------------

export interface FileObject {
  url: string;
  filename: string;
  file_type: string;
  size: number;
  thumbnail_url?: string | null;
  source_refs?: SourceRefs;
}

export interface FilesValue {
  type: 'files';
  value: FileObject[];
}

// ---------------------------------------------------------------------------
// Category 9: Identification
// ---------------------------------------------------------------------------

export interface BarcodeValue {
  type: 'barcode';
  value: string | null;
}

// ---------------------------------------------------------------------------
// Discriminated union — all canonical field value types
// ---------------------------------------------------------------------------

export type CanonicalValue =
  // Category 1: Text
  | TextValue
  | TextAreaValue
  | SmartDocValue
  // Category 2: Number
  | NumberValue
  | CurrencyValue
  | PercentValue
  | RatingValue
  | DurationValue
  | ProgressValue
  | AutoNumberValue
  // Category 3: Selection
  | SingleSelectValue
  | MultipleSelectValue
  | StatusValue
  | TagValue
  // Category 4: Date & Time
  | DateValue
  | DateRangeValue
  | DueDateValue
  | TimeValue
  | CreatedAtValue
  | UpdatedAtValue
  // Category 5: People & Contact
  | PeopleValue
  | CreatedByValue
  | UpdatedByValue
  | EmailValue
  | PhoneValue
  | UrlValue
  | AddressValue
  | FullNameValue
  | SocialValue
  // Category 6: Boolean & Interactive
  | CheckboxValue
  | ButtonValue
  | ChecklistValue
  | SignatureValue
  // Category 7: Relational
  | LinkedRecordValue
  // Category 8: Files
  | FilesValue
  // Category 9: Identification
  | BarcodeValue;

/**
 * All canonical field type keys. Matches the `type` discriminant
 * on each variant of CanonicalValue.
 */
export type CanonicalFieldType = CanonicalValue['type'];

/**
 * The shape of records.canonical_data — a map of field UUID to its
 * canonical value (the inner value, not the discriminated wrapper).
 * In practice the DB stores `Record<string, unknown>` and adapters
 * produce typed CanonicalValue objects during transform.
 */
export type CanonicalData = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Sync metadata — stored in records.sync_metadata
// ---------------------------------------------------------------------------

/**
 * Per-field snapshot at last sync — used for conflict detection.
 * Each field's canonical value and the timestamp it was last synced.
 */
export interface SyncedFieldValue {
  /** The canonical field value at last sync. */
  value: unknown;
  /** ISO 8601 timestamp when this field was last synced. */
  synced_at: string;
}

export const SyncedFieldValueSchema = z.object({
  value: z.unknown(),
  synced_at: z.string().datetime({ offset: true }),
});

/**
 * Per-record sync metadata tracking the relationship between
 * the canonical record and its source platform record.
 *
 * Stored in `records.sync_metadata` JSONB column.
 */
export interface SyncMetadata {
  /** The record's ID on the source platform. */
  platform_record_id: string;
  /** ISO 8601 timestamp of last successful sync. */
  last_synced_at: string;
  /** Per-field snapshot of values at last sync for conflict detection. */
  last_synced_values: Record<string, SyncedFieldValue>;
  /** Whether this record is actively synced or orphaned by filter changes. */
  sync_status: 'active' | 'orphaned';
  /** Direction of sync for this record. */
  sync_direction: 'inbound' | 'outbound' | 'both';
  /** ISO 8601 timestamp when the record was orphaned, or null. */
  orphaned_at: string | null;
  /** Reason the record was orphaned, or null. */
  orphaned_reason: 'filter_changed' | null;
}

export const SyncMetadataSchema = z.object({
  platform_record_id: z.string().min(1),
  last_synced_at: z.string().datetime({ offset: true }),
  last_synced_values: z.record(z.string(), SyncedFieldValueSchema),
  sync_status: z.enum(['active', 'orphaned']),
  sync_direction: z.enum(['inbound', 'outbound', 'both']),
  orphaned_at: z.string().datetime({ offset: true }).nullable(),
  orphaned_reason: z.enum(['filter_changed']).nullable(),
});

/**
 * @deprecated Use `SyncMetadata` instead. Kept for backward compatibility.
 */
export type RecordSyncMetadata = SyncMetadata;

// ---------------------------------------------------------------------------
// Platform field configuration — passed to transform functions
// ---------------------------------------------------------------------------

/**
 * Platform-specific field metadata passed to FieldTransform functions.
 * Generic enough to carry config from Airtable, Notion, and SmartSuite.
 */
export interface PlatformFieldConfig {
  /** The field's ID on the source platform. */
  externalFieldId: string;
  /** The field's name on the source platform. */
  name: string;
  /** The platform-native field type string (e.g. 'singleLineText', 'title', 'textfield'). */
  platformFieldType: string;
  /** Platform-specific options/config (select choices, currency codes, etc.). */
  options?: Record<string, unknown>;
  /** The EveryStack field config JSONB for additional context. */
  fieldConfig?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Field transform interface — implemented per platform + field type
// ---------------------------------------------------------------------------

/**
 * A bidirectional transform between a platform's native field value
 * and EveryStack's canonical JSONB representation.
 */
export interface FieldTransform {
  /** Convert a platform-native value to canonical form. */
  toCanonical: (value: unknown, fieldConfig: PlatformFieldConfig) => CanonicalValue;
  /** Convert a canonical value back to the platform-native form. */
  fromCanonical: (value: CanonicalValue, fieldConfig: PlatformFieldConfig) => unknown;
  /** Whether the transform preserves all data on round-trip. */
  isLossless: boolean;
  /** Which operations this field type supports. */
  supportedOperations: Array<'read' | 'write' | 'filter' | 'sort'>;
}

// ---------------------------------------------------------------------------
// Outbound Sync — types for pushing EveryStack edits to source platforms
// ---------------------------------------------------------------------------

/**
 * Job data for an outbound sync BullMQ job.
 * Represents a single record update to push to the source platform.
 */
export interface OutboundSyncJob {
  /** The tenant that owns this record. */
  tenantId: string;
  /** The record that was edited locally. */
  recordId: string;
  /** The table containing the record. */
  tableId: string;
  /** The base connection for the synced table. */
  baseConnectionId: string;
  /** ES field UUIDs that were changed. */
  changedFieldIds: string[];
  /** The user who made the edit. */
  editedBy: string;
  /** Job priority — lower number = higher priority. Default: 10. */
  priority: number;
  /** Trace propagation for logging. */
  traceId: string;
}

/**
 * Result of an outbound sync execution.
 * Success or failure — BullMQ handles retries on failure.
 */
export interface OutboundSyncResult {
  /** Whether the update was pushed to the platform. */
  success: boolean;
  /** The platform record ID that was updated. */
  platformRecordId: string | null;
  /** ES field IDs that were actually synced (computed fields excluded). */
  syncedFieldIds: string[];
  /** ES field IDs that were skipped (computed or read-only). */
  skippedFieldIds: string[];
  /** Error message if the sync failed. */
  error?: string;
  /** HTTP status code from the platform API, if applicable. */
  statusCode?: number;
}

// ---------------------------------------------------------------------------
// Conflict Detection — three-way comparison types
// @see docs/reference/sync-engine.md § Conflict Resolution UX
// ---------------------------------------------------------------------------

/** Status values for sync_conflicts rows. */
export type ConflictStatus = 'pending' | 'resolved_local' | 'resolved_remote' | 'resolved_merged';

/**
 * A field where both local (EveryStack) and remote (platform) values
 * changed independently from the base (last-synced) value.
 */
export interface DetectedConflict {
  /** The EveryStack field UUID. */
  fieldId: string;
  /** Current value in canonical_data (local edit). */
  localValue: unknown;
  /** Incoming value from the platform. */
  remoteValue: unknown;
  /** Value at last sync (common ancestor). */
  baseValue: unknown;
}

/**
 * A field with a one-sided change that can be applied without conflict.
 */
export interface CleanChange {
  /** The EveryStack field UUID. */
  fieldId: string;
  /** The new value to apply. */
  value: unknown;
}

/**
 * Result of three-way conflict detection for a single record.
 */
export interface ConflictDetectionResult {
  /** Fields where only the remote side changed — apply to canonical_data. */
  cleanRemoteChanges: CleanChange[];
  /** Fields where only the local side changed — preserve, no action needed. */
  cleanLocalChanges: CleanChange[];
  /** Fields where both sides changed to different values — write sync_conflicts. */
  conflicts: DetectedConflict[];
  /** Fields where no side changed. */
  unchangedFieldIds: string[];
  /** Fields where both sides changed to the same value — no conflict. */
  convergentFieldIds: string[];
}

// ---------------------------------------------------------------------------
// Smart Polling — adaptive intervals based on table visibility state
// @see docs/reference/sync-engine.md § Smart Polling & Real-Time Push
// ---------------------------------------------------------------------------

/**
 * Polling interval tiers in milliseconds.
 * Determined by table visibility state via Socket.io room membership.
 */
export const POLLING_INTERVALS = {
  /** 30 seconds — user has this table open */
  ACTIVE_VIEWING: 30_000,
  /** 5 minutes — workspace open but table not active */
  TAB_OPEN_NOT_VISIBLE: 300_000,
  /** 30 minutes — workspace not accessed recently */
  WORKSPACE_INACTIVE: 1_800_000,
  /** null — Airtable webhooks, event-driven (no polling) */
  EVENT_DRIVEN: null,
} as const;

/**
 * Visibility state of a table, derived from Socket.io room membership.
 * - `active` — at least one connected client has this table's room joined
 * - `background` — at least one connected client in the same workspace, but not viewing this table
 * - `inactive` — no connected clients in the workspace
 */
export type TableVisibility = 'active' | 'background' | 'inactive';

/**
 * Webhook configuration stored in base_connections.sync_config.webhooks.
 * Used for Airtable event-driven sync.
 */
export interface SyncConfigWebhooks {
  airtable_webhook_id?: string;
  airtable_webhook_cursor?: string;
  webhook_registered_at?: string;
}

/**
 * Sync statuses that indicate a table has been converted to native EveryStack.
 * These tables are either skipped entirely or synced to shadow only.
 */
export type ConvertedSyncStatus = 'converted' | 'converted_dual_write' | 'converted_finalized';

/**
 * All possible sync statuses for a base_connection.
 */
export type SyncStatus = 'active' | 'paused' | 'error' | 'auth_required' | ConvertedSyncStatus;

// ---------------------------------------------------------------------------
// Connection Health — shape of base_connections.health (JSONB)
// @see docs/reference/sync-engine.md § Sync Connection Status Model
// ---------------------------------------------------------------------------

/**
 * Error codes for sync failures.
 * Used in SyncError.code and for driving error recovery flows.
 */
export type SyncErrorCode =
  | 'auth_expired'
  | 'rate_limited'
  | 'platform_unavailable'
  | 'schema_mismatch'
  | 'permission_denied'
  | 'partial_failure'
  | 'quota_exceeded'
  | 'unknown';

/**
 * A structured sync error stored in ConnectionHealth.last_error.
 */
export interface SyncError {
  code: SyncErrorCode;
  message: string;
  timestamp: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

/**
 * Shape of the base_connections.health JSONB column.
 * Tracks sync health metrics for a connection.
 */
export interface ConnectionHealth {
  last_success_at: string | null;
  last_error: SyncError | null;
  consecutive_failures: number;
  next_retry_at: string | null;
  records_synced: number;
  records_failed: number;
}

// ---------------------------------------------------------------------------
// Zod schemas for ConnectionHealth and SyncError
// ---------------------------------------------------------------------------

export const SyncErrorCodeSchema = z.enum([
  'auth_expired',
  'rate_limited',
  'platform_unavailable',
  'schema_mismatch',
  'permission_denied',
  'partial_failure',
  'quota_exceeded',
  'unknown',
]);

export const SyncErrorSchema = z.object({
  code: SyncErrorCodeSchema,
  message: z.string(),
  timestamp: z.string(),
  retryable: z.boolean(),
  details: z.record(z.string(), z.unknown()),
});

export const ConnectionHealthSchema = z.object({
  last_success_at: z.string().nullable(),
  last_error: SyncErrorSchema.nullable(),
  consecutive_failures: z.number().int().min(0),
  next_retry_at: z.string().nullable(),
  records_synced: z.number().int().min(0),
  records_failed: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Priority-Based Scheduling — P0–P3 tiers for sync job dispatch
// @see docs/reference/sync-engine.md § Priority-Based Scheduling
// ---------------------------------------------------------------------------

/**
 * Priority tiers for sync job dispatch under rate limit pressure.
 *
 * Lower numeric value = higher priority.
 * P0 always dispatches regardless of capacity.
 * P1–P3 are throttled based on remaining rate limit capacity.
 */
export enum SyncPriority {
  /** Outbound sync (cell edits), webhook-triggered inbound. Always dispatched. */
  P0_CRITICAL = 0,
  /** Inbound polling for actively viewed tables. Dispatched if capacity >30%. */
  P1_ACTIVE = 1,
  /** Inbound polling for non-visible tables. Dispatched if capacity >50%. */
  P2_BACKGROUND = 2,
  /** Inbound polling for inactive workspaces. Dispatched if capacity >70%. */
  P3_INACTIVE = 3,
}

/**
 * Result of evaluating whether a sync job should be dispatched
 * given its priority and the current rate limit capacity.
 */
export interface PriorityDecision {
  /** Whether this job should run now. */
  dispatch: boolean;
  /** If not dispatching, suggested delay in milliseconds before retry. */
  delay?: number;
  /** Human-readable reason for the decision (for logging). */
  reason?: string;
}

/**
 * Capacity thresholds for each priority tier.
 * P0 has no threshold (always dispatched).
 */
export const PRIORITY_CAPACITY_THRESHOLDS: Record<SyncPriority, number> = {
  [SyncPriority.P0_CRITICAL]: 0,
  [SyncPriority.P1_ACTIVE]: 30,
  [SyncPriority.P2_BACKGROUND]: 50,
  [SyncPriority.P3_INACTIVE]: 70,
};

/**
 * Maximum percentage of a platform's rate limit capacity that a single
 * tenant can consume. P0 is exempt from this cap.
 */
export const MAX_TENANT_CAPACITY_PERCENT = 20;
