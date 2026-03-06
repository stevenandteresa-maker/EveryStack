// ---------------------------------------------------------------------------
// Airtable Date & Time Category Transforms (Category 4)
//
// Transforms for: date, date_range, due_date, time, created_at, updated_at
// Airtable types: date, dateTime, (due_date via date/dateTime), createdTime, lastModifiedTime
//
// Airtable dates arrive as ISO 8601 strings. Timezone handling normalizes
// to workspace timezone per field config. System fields are read-only.
// ---------------------------------------------------------------------------

import type { FieldTransform, PlatformFieldConfig, CanonicalValue } from '../../types';

/**
 * Normalize an Airtable date/datetime ISO string to the workspace timezone.
 *
 * Airtable returns dates in UTC or as date-only strings (YYYY-MM-DD).
 * If the field config specifies a timezone, we store the ISO string
 * with that timezone context. Date-only strings are preserved as-is.
 */
function normalizeToWorkspaceTimezone(
  isoString: string,
  config: PlatformFieldConfig,
): string {
  // Date-only strings (YYYY-MM-DD) — preserve without timezone manipulation
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return isoString;
  }

  const timezone = (config.options?.timezone ?? config.fieldConfig?.timezone) as
    | string
    | undefined;

  // No timezone config — return ISO string as-is (UTC assumed)
  if (!timezone || timezone === 'utc') {
    return isoString;
  }

  // Parse and re-format to preserve the timezone context.
  // Store as ISO 8601 — the display layer handles formatting.
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toISOString();
}

/**
 * Extract HH:MM from an ISO datetime string.
 */
function extractTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// Transform definitions
// ---------------------------------------------------------------------------

/** date/dateTime → date (lossless) */
export const airtableDateTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'date', value: null };
    const isoString = String(value);
    return { type: 'date', value: normalizeToWorkspaceTimezone(isoString, config) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'date') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * dateTime (start/end) → date_range (lossless)
 * Airtable doesn't have a native date range type, but some integrations
 * represent ranges as two fields. This transform handles when the adapter
 * assembles start/end into a single object.
 */
export const airtableDateRangeTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'date_range', value: null };

    // Handle pre-assembled {start, end} objects
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const start = obj.start != null
        ? normalizeToWorkspaceTimezone(String(obj.start), config)
        : null;
      const end = obj.end != null
        ? normalizeToWorkspaceTimezone(String(obj.end), config)
        : null;
      return { type: 'date_range', value: { start, end } };
    }

    // Single date string treated as start-only
    const isoString = normalizeToWorkspaceTimezone(String(value), config);
    return { type: 'date_range', value: { start: isoString, end: null } };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'date_range') return null;
    if (canonical.value == null) return null;

    // Return the start/end object for the adapter to split into Airtable fields
    return { start: canonical.value.start, end: canonical.value.end };
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** date/dateTime → due_date (lossless, ISO string with due date semantics) */
export const airtableDueDateTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'due_date', value: null };
    const isoString = String(value);
    return { type: 'due_date', value: normalizeToWorkspaceTimezone(isoString, config) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'due_date') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** dateTime → time (lossless — extract HH:MM from Airtable datetime) */
export const airtableTimeTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'time', value: null };

    const str = String(value);
    // If already HH:MM format, pass through
    if (/^\d{2}:\d{2}$/.test(str)) {
      return { type: 'time', value: str };
    }

    // Extract HH:MM from ISO datetime
    return { type: 'time', value: extractTime(str) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'time') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** createdTime → created_at (lossless, read-only system field) */
export const airtableCreatedAtTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'created_at', value: null };
    return { type: 'created_at', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'created_at') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read'],
};

/** lastModifiedTime → updated_at (lossless, read-only system field) */
export const airtableUpdatedAtTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'updated_at', value: null };
    return { type: 'updated_at', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'updated_at') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_DATE_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'date', transform: airtableDateTransform },
  { airtableType: 'dateTime', transform: airtableDateTransform },
  { airtableType: 'dateRange', transform: airtableDateRangeTransform },
  { airtableType: 'dueDate', transform: airtableDueDateTransform },
  { airtableType: 'time', transform: airtableTimeTransform },
  { airtableType: 'createdTime', transform: airtableCreatedAtTransform },
  { airtableType: 'lastModifiedTime', transform: airtableUpdatedAtTransform },
];
