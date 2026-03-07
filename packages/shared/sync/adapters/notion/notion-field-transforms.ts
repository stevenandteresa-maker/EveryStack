// ---------------------------------------------------------------------------
// Notion Field Type Transforms — bidirectional (toCanonical + fromCanonical)
//
// Maps all ~20 Notion property types to EveryStack canonical JSONB shapes
// and back. Writable types implement fromCanonical() for outbound sync;
// read-only types (formula, rollup, created_time, etc.) return undefined.
//
// Notion's rich text model: title and rich_text properties return arrays
// of rich text objects. Plain text is extracted for the canonical value;
// fromCanonical() reconstructs plain-text rich text arrays for the API.
// ---------------------------------------------------------------------------

import type {
  FieldTransform,
  PlatformFieldConfig,
  CanonicalValue,
  LinkedRecordEntry,
  FileObject,
  TextValue,
  TextAreaValue,
  NumberValue,
  SingleSelectValue,
  MultipleSelectValue,
  StatusValue,
  DateValue,
  DateRangeValue,
  PeopleValue,
  EmailValue,
  PhoneValue,
  UrlValue,
  CheckboxValue,
  LinkedRecordValue,
  FilesValue,
} from '../../types';
import type {
  NotionRichText,
  NotionSelectOption,
  NotionUser,
  NotionFile,
  NotionFormulaResult,
  NotionRollupResult,
  NotionDate,
  NotionUniqueId,
} from './notion-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract plain text from a Notion rich text array.
 * Concatenates all `plain_text` segments.
 */
export function extractPlainText(richText: NotionRichText[] | null | undefined): string {
  if (!richText || richText.length === 0) return '';
  return richText.map((rt) => rt.plain_text).join('');
}

/**
 * Generate a deterministic placeholder option ID for Notion options
 * whose ID is not found in the field config.
 */
function generatePlaceholderOptionId(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `es_opt_unsynced_${hex}`;
}

/**
 * Map a Notion select option to a canonical select value with source_refs.
 */
function mapNotionSelectOption(
  option: NotionSelectOption,
  config: PlatformFieldConfig,
): { id: string; label: string; source_refs: { notion: Record<string, unknown> } } {
  const options = (config.options?.options ?? config.fieldConfig?.options) as
    | Array<{ id: string; label: string; source_refs?: { notion?: Record<string, unknown> } }>
    | undefined;

  // Try to find existing ES option by Notion option ID
  const match = options?.find(
    (opt) =>
      (opt.source_refs?.notion as Record<string, unknown> | undefined)?.option_id === option.id ||
      opt.label === option.name,
  );

  return {
    id: match?.id ?? generatePlaceholderOptionId(option.name),
    label: option.name,
    source_refs: {
      notion: {
        option_id: option.id,
        color: option.color,
      },
    },
  };
}

/**
 * Extract the URL from a Notion file object (external or internal).
 */
function extractNotionFileUrl(file: NotionFile): string {
  if (file.type === 'external') return file.external.url;
  return file.file.url;
}

/**
 * Extract the computed value from a Notion formula result as a string.
 */
function extractFormulaValue(formula: NotionFormulaResult): string | null {
  if (formula.type === 'string') return formula.string ?? null;
  if (formula.type === 'number') return formula.number != null ? String(formula.number) : null;
  if (formula.type === 'boolean') return formula.boolean != null ? String(formula.boolean) : null;
  if (formula.type === 'date') return formula.date?.start ?? null;
  return null;
}

/**
 * Extract the computed value from a Notion rollup result as a string.
 */
function extractRollupValue(rollup: NotionRollupResult): string | null {
  if (rollup.type === 'number') return rollup.number != null ? String(rollup.number) : null;
  if (rollup.type === 'date') return rollup.date?.start ?? null;
  if (rollup.type === 'array' && rollup.array) {
    return rollup.array.map((item) => String(item.title ?? item.rich_text ?? '')).join(', ');
  }
  return null;
}

/**
 * Map a Notion status group name to a canonical StatusCategory.
 */
function resolveStatusCategory(
  option: NotionSelectOption,
  config: PlatformFieldConfig,
): 'not_started' | 'in_progress' | 'done' | 'closed' {
  // Check if the field config provides group mappings
  const groups = (config.options?.groups ?? config.fieldConfig?.groups) as
    | Array<{ id: string; name: string; option_ids: string[] }>
    | undefined;

  if (groups) {
    for (const group of groups) {
      if (group.option_ids.includes(option.id)) {
        const groupName = group.name.toLowerCase();
        if (groupName === 'to-do' || groupName === 'not started') return 'not_started';
        if (groupName === 'in progress') return 'in_progress';
        if (groupName === 'done' || groupName === 'complete') return 'done';
      }
    }
  }

  // Fallback: check config-level categories
  const categories = (config.options?.categories ?? config.fieldConfig?.categories) as
    | Record<string, 'not_started' | 'in_progress' | 'done' | 'closed'>
    | undefined;

  return categories?.[option.id] ?? 'not_started';
}

// ---------------------------------------------------------------------------
// Transform definitions — Category 1: Text
// ---------------------------------------------------------------------------

/** title → text (lossless with source_refs preserving rich text) */
export const notionTitleTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const richText = value as NotionRichText[] | null | undefined;
    if (!richText || richText.length === 0) return { type: 'text', value: null };
    return { type: 'text', value: extractPlainText(richText) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as TextValue;
    if (val.value == null) return { title: [] };
    return { title: [{ type: 'text', text: { content: val.value } }] };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** rich_text → text_area (lossless with source_refs preserving rich text) */
export const notionRichTextTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const richText = value as NotionRichText[] | null | undefined;
    if (!richText || richText.length === 0) return { type: 'text_area', value: null };
    return { type: 'text_area', value: extractPlainText(richText) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as TextAreaValue;
    if (val.value == null) return { rich_text: [] };
    return { rich_text: [{ type: 'text', text: { content: val.value } }] };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Category 2: Number
// ---------------------------------------------------------------------------

/** number → number (lossless) */
export const notionNumberTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'number', value: null };
    const n = Number(value);
    return { type: 'number', value: Number.isNaN(n) ? null : n };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as NumberValue;
    return { number: val.value };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Category 3: Selection
// ---------------------------------------------------------------------------

/** select → single_select (lossless with source_refs) */
export const notionSelectTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    const option = value as NotionSelectOption | null;
    if (!option) return { type: 'single_select', value: null };

    const mapped = mapNotionSelectOption(option, config);
    return { type: 'single_select', value: mapped };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as SingleSelectValue;
    if (val.value == null) return { select: null };
    const notionRef = val.value.source_refs?.notion as Record<string, unknown> | undefined;
    if (notionRef?.option_id) return { select: { id: notionRef.option_id as string } };
    return { select: { name: val.value.label } };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** multi_select → multiple_select (lossless with source_refs) */
export const notionMultiSelectTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    const options = value as NotionSelectOption[] | null | undefined;
    if (!options || options.length === 0) return { type: 'multiple_select', value: [] };

    const items = options.map((option) => mapNotionSelectOption(option, config));
    return { type: 'multiple_select', value: items };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as MultipleSelectValue;
    const items = val.value.map((opt) => {
      const notionRef = opt.source_refs?.notion as Record<string, unknown> | undefined;
      if (notionRef?.option_id) return { id: notionRef.option_id as string };
      return { name: opt.label };
    });
    return { multi_select: items };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** status → status (lossless with source_refs preserving group info) */
export const notionStatusTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    const option = value as NotionSelectOption | null;
    if (!option) return { type: 'status', value: null };

    const mapped = mapNotionSelectOption(option, config);
    const category = resolveStatusCategory(option, config);

    return {
      type: 'status',
      value: {
        id: mapped.id,
        label: mapped.label,
        category,
        source_refs: mapped.source_refs,
      },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as StatusValue;
    if (val.value == null) return { status: null };
    const notionRef = val.value.source_refs?.notion as Record<string, unknown> | undefined;
    if (notionRef?.option_id) return { status: { id: notionRef.option_id as string } };
    return { status: { name: val.value.label } };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Category 4: Date & Time
// ---------------------------------------------------------------------------

/** date → date or date_range (lossless) */
export const notionDateTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const dateObj = value as NotionDate | null;
    if (!dateObj) return { type: 'date', value: null };

    // If the date has an end, map to date_range
    if (dateObj.end) {
      return {
        type: 'date_range',
        value: {
          start: dateObj.start,
          end: dateObj.end,
        },
      };
    }

    return { type: 'date', value: dateObj.start };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type === 'date_range') {
      const val = canonical as DateRangeValue;
      if (val.value == null) return { date: null };
      return { date: { start: val.value.start, end: val.value.end } };
    }
    const val = canonical as DateValue;
    if (val.value == null) return { date: null };
    return { date: { start: val.value } };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** created_time → created_at (read-only) */
export const notionCreatedTimeTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'created_at', value: null };
    return { type: 'created_at', value: String(value) };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

/** last_edited_time → updated_at (read-only) */
export const notionLastEditedTimeTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'updated_at', value: null };
    return { type: 'updated_at', value: String(value) };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

// ---------------------------------------------------------------------------
// Category 5: People & Contact
// ---------------------------------------------------------------------------

/** people → people (partial lossless — stores Notion user IDs) */
export const notionPeopleTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const users = value as NotionUser[] | null | undefined;
    if (!users || users.length === 0) return { type: 'people', value: [] };
    return { type: 'people', value: users.map((u) => u.id) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as PeopleValue;
    return { people: val.value.map((id) => ({ object: 'user', id })) };
  },
  isLossless: false,
  supportedOperations: ['read', 'write'],
};

/** created_by → created_by (read-only) */
export const notionCreatedByTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'created_by', value: null };
    const user = value as NotionUser;
    return { type: 'created_by', value: user.id };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

/** last_edited_by → updated_by (read-only) */
export const notionLastEditedByTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'updated_by', value: null };
    const user = value as NotionUser;
    return { type: 'updated_by', value: user.id };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

/** email → email (lossless) */
export const notionEmailTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'email', value: null };
    return { type: 'email', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as EmailValue;
    return { email: val.value };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** phone_number → phone (lossless) */
export const notionPhoneNumberTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'phone', value: null };
    return {
      type: 'phone',
      value: { number: String(value), type: 'main' },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as PhoneValue;
    if (val.value == null) return { phone_number: null };
    if (Array.isArray(val.value)) return { phone_number: val.value[0]?.number ?? null };
    return { phone_number: val.value.number };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** url → url (lossless) */
export const notionUrlTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'url', value: null };
    return { type: 'url', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as UrlValue;
    return { url: val.value };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Category 6: Boolean & Interactive
// ---------------------------------------------------------------------------

/** checkbox → checkbox (lossless) */
export const notionCheckboxTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    return { type: 'checkbox', value: value === true };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as CheckboxValue;
    return { checkbox: val.value };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Category 7: Relational
// ---------------------------------------------------------------------------

/** relation → linked_record (lossless with source_refs) */
export const notionRelationTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    const relations = value as Array<{ id: string }> | null | undefined;
    if (!relations || relations.length === 0) return { type: 'linked_record', value: [] };

    const recordIdMap = (config.options?.recordIdMap ?? {}) as Record<string, string | null>;

    const entries: LinkedRecordEntry[] = relations.map((rel) => {
      const esRecordId = recordIdMap[rel.id];

      if (esRecordId != null) {
        return { record_id: esRecordId };
      }

      // Notion page exists but is not synced into EveryStack
      return {
        record_id: null,
        platform_record_id: rel.id,
        filtered_out: true,
      };
    });

    return { type: 'linked_record', value: entries };
  },
  fromCanonical: (canonical: CanonicalValue, config: PlatformFieldConfig): unknown => {
    const val = canonical as LinkedRecordValue;
    const reverseMap = (config.options?.reverseRecordIdMap ?? {}) as Record<string, string>;
    const relations = val.value
      .map((entry) => {
        // Use platform_record_id if available (round-trip from toCanonical)
        if (entry.platform_record_id) return { id: entry.platform_record_id };
        // Otherwise look up via reverse map (ES record ID -> Notion page ID)
        if (entry.record_id) {
          const platformId = reverseMap[entry.record_id];
          if (platformId) return { id: platformId };
        }
        return null;
      })
      .filter((r): r is { id: string } => r != null);
    return { relation: relations };
  },
  isLossless: true,
  supportedOperations: ['read', 'write'],
};

// ---------------------------------------------------------------------------
// Category 8: Files
// ---------------------------------------------------------------------------

/** files → files (partial lossless) */
export const notionFilesTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const files = value as NotionFile[] | null | undefined;
    if (!files || files.length === 0) return { type: 'files', value: [] };

    const fileObjects: FileObject[] = files.map((file) => {
      const url = extractNotionFileUrl(file);
      return {
        url,
        filename: file.name ?? '',
        file_type: '',
        size: 0,
        thumbnail_url: null,
        source_refs: { notion: { type: file.type } },
      };
    });

    return { type: 'files', value: fileObjects };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    const val = canonical as FilesValue;
    const files = val.value.map((file) => ({
      type: 'external' as const,
      name: file.filename,
      external: { url: file.url },
    }));
    return { files };
  },
  isLossless: false,
  supportedOperations: ['read', 'write'],
};

// ---------------------------------------------------------------------------
// Lossy / Computed fields (read-only)
// ---------------------------------------------------------------------------

/** formula → text (read-only, lossy) */
export const notionFormulaTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'text', value: null };
    const formula = value as NotionFormulaResult;
    return { type: 'text', value: extractFormulaValue(formula) };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

/** rollup → text (read-only, lossy) */
export const notionRollupTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'text', value: null };
    const rollup = value as NotionRollupResult;
    return { type: 'text', value: extractRollupValue(rollup) };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

/** unique_id → auto_number (read-only) */
export const notionUniqueIdTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'auto_number', value: null };
    const uniqueId = value as NotionUniqueId;
    return { type: 'auto_number', value: uniqueId.number };
  },
  fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    return undefined;
  },
  isLossless: false,
  supportedOperations: ['read'],
};

// ---------------------------------------------------------------------------
// Registration arrays — used by registerNotionTransforms()
// ---------------------------------------------------------------------------

export const NOTION_TRANSFORMS: Array<{
  notionType: string;
  transform: FieldTransform;
}> = [
  // Category 1: Text
  { notionType: 'title', transform: notionTitleTransform },
  { notionType: 'rich_text', transform: notionRichTextTransform },
  // Category 2: Number
  { notionType: 'number', transform: notionNumberTransform },
  // Category 3: Selection
  { notionType: 'select', transform: notionSelectTransform },
  { notionType: 'multi_select', transform: notionMultiSelectTransform },
  { notionType: 'status', transform: notionStatusTransform },
  // Category 4: Date & Time
  { notionType: 'date', transform: notionDateTransform },
  { notionType: 'created_time', transform: notionCreatedTimeTransform },
  { notionType: 'last_edited_time', transform: notionLastEditedTimeTransform },
  // Category 5: People & Contact
  { notionType: 'people', transform: notionPeopleTransform },
  { notionType: 'created_by', transform: notionCreatedByTransform },
  { notionType: 'last_edited_by', transform: notionLastEditedByTransform },
  { notionType: 'email', transform: notionEmailTransform },
  { notionType: 'phone_number', transform: notionPhoneNumberTransform },
  { notionType: 'url', transform: notionUrlTransform },
  // Category 6: Boolean & Interactive
  { notionType: 'checkbox', transform: notionCheckboxTransform },
  // Category 7: Relational
  { notionType: 'relation', transform: notionRelationTransform },
  // Category 8: Files
  { notionType: 'files', transform: notionFilesTransform },
  // Lossy / Computed
  { notionType: 'formula', transform: notionFormulaTransform },
  { notionType: 'rollup', transform: notionRollupTransform },
  { notionType: 'unique_id', transform: notionUniqueIdTransform },
];
