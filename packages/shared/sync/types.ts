// ---------------------------------------------------------------------------
// Canonical Value Types — the JSONB shapes stored in records.canonical_data
//
// Each field type has a discriminated union variant keyed by `type`.
// Values are stored in canonical_data keyed by the field's UUID (fields.id).
// Platform adapters transform to/from these shapes via FieldTypeRegistry.
//
// Covers all 9 MVP categories from data-model.md § Field Type Taxonomy.
// ---------------------------------------------------------------------------

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
 * Per-record sync metadata tracking the relationship between
 * the canonical record and its source platform record.
 */
export interface RecordSyncMetadata {
  /** The record's ID on the source platform. */
  platform_record_id: string;
  /** ISO 8601 timestamp of last successful sync. */
  last_synced_at: string;
  /** Snapshot of field values at last sync for conflict detection. */
  last_synced_value: Record<string, unknown>;
  /** Whether this record is actively synced or orphaned by filter changes. */
  sync_status: 'active' | 'orphaned';
  /** ISO 8601 timestamp when the record was orphaned, or null. */
  orphaned_at: string | null;
  /** Reason the record was orphaned, or null. */
  orphaned_reason: 'filter_changed' | null;
}

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
