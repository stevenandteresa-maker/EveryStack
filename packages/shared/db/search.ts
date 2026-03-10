/**
 * Search Vector Utilities — buildSearchVector + extractSearchableText
 *
 * Produces tsvector SQL expressions from canonical JSONB data for
 * full-text search. Uses the 'simple' dictionary (language-agnostic)
 * with 4 weights (A–D) based on field importance.
 *
 * @see docs/reference/database-scaling.md § tsvector Indexing Strategy
 */

import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

/**
 * Minimal field definition for search vector building.
 * Callers pass fields from the database with the properties we need.
 */
export interface SearchFieldDefinition {
  id: string;
  fieldType: string;
  isPrimary: boolean;
  config: Record<string, unknown>;
}

/** Non-searchable field types (binary/internal data). */
const NON_SEARCHABLE_TYPES = new Set([
  'files',
  'signature',
  'button',
]);

/**
 * Extract searchable plain text from a canonical field value.
 *
 * Canonical values are stored as `{ type, value }` discriminated unions
 * in `records.canonical_data`. This function handles both the wrapper
 * shape and raw values defensively.
 *
 * @returns Plain text string, or null if the value is not searchable.
 */
// ---------------------------------------------------------------------------
// Per-type text extractors — map-based dispatch (no switch on field types)
// ---------------------------------------------------------------------------

type TextExtractor = (value: unknown) => string | null;

const extractStringDirect: TextExtractor = (value) =>
  typeof value === 'string' ? value : String(value);

const extractStringOnly: TextExtractor = (value) =>
  typeof value === 'string' ? value : null;

const extractNumberAsString: TextExtractor = (value) =>
  typeof value === 'number' ? String(value) : null;

const extractSelectLabel: TextExtractor = (value) => {
  const selectVal = value as Record<string, unknown>;
  return typeof selectVal?.label === 'string' ? selectVal.label : null;
};

const extractMultiLabels: TextExtractor = (value) => {
  if (!Array.isArray(value)) return null;
  return (value as Array<Record<string, unknown>>)
    .map((v) => v?.label)
    .filter((l): l is string => typeof l === 'string')
    .join(' ');
};

const extractPeople: TextExtractor = (value) => {
  if (Array.isArray(value)) {
    return (value as Array<Record<string, unknown>>)
      .map((u) => u?.name ?? u?.displayName)
      .filter((n): n is string => typeof n === 'string')
      .join(' ');
  }
  const person = value as Record<string, unknown>;
  return typeof person?.name === 'string' ? person.name : null;
};

const SEARCH_TEXT_EXTRACTORS: Record<string, TextExtractor> = {
  // Text types → use directly
  text: extractStringDirect,
  text_area: extractStringDirect,
  email: extractStringDirect,
  url: extractStringDirect,
  phone: extractStringDirect,
  barcode: extractStringDirect,

  // Smart doc → extract text content
  smart_doc: (value) => {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      return extractTipTapText(value as Record<string, unknown>);
    }
    return null;
  },

  // Selection → extract label(s)
  single_select: extractSelectLabel,
  status: extractSelectLabel,
  multiple_select: extractMultiLabels,
  tag: extractMultiLabels,

  // Number types → string representation
  number: extractNumberAsString,
  currency: extractNumberAsString,
  percent: extractNumberAsString,
  rating: extractNumberAsString,
  duration: extractNumberAsString,
  progress: extractNumberAsString,
  auto_number: extractNumberAsString,

  // Date types → ISO string
  date: extractStringOnly,
  date_range: extractStringOnly,
  due_date: extractStringOnly,
  time: extractStringOnly,
  created_at: extractStringOnly,
  updated_at: extractStringOnly,

  // People → display names
  people: extractPeople,
  created_by: extractPeople,
  updated_by: extractPeople,

  // Address → concatenated parts
  address: (value) => {
    const addr = value as Record<string, unknown>;
    return [addr?.street, addr?.city, addr?.state, addr?.zip, addr?.country]
      .filter((p): p is string => typeof p === 'string')
      .join(' ');
  },

  // Full name → concatenated
  full_name: (value) => {
    const name = value as Record<string, unknown>;
    return [name?.first, name?.middle, name?.last]
      .filter((p): p is string => typeof p === 'string')
      .join(' ');
  },

  // Checkbox → yes/no
  checkbox: (value) => (value ? 'yes' : 'no'),

  // Linked records → display values
  linked_record: (value) => {
    if (!Array.isArray(value)) return null;
    return (value as Array<Record<string, unknown>>)
      .map((r) => r?.displayValue)
      .filter((d): d is string => typeof d === 'string')
      .join(' ');
  },

  // Checklist → item labels
  checklist: (value) => {
    if (!Array.isArray(value)) return null;
    return (value as Array<Record<string, unknown>>)
      .map((item) => item?.label)
      .filter((l): l is string => typeof l === 'string')
      .join(' ');
  },

  // Social → URL or handle
  social: extractStringOnly,
};

export function extractSearchableText(
  rawValue: unknown,
  fieldType: string,
): string | null {
  if (rawValue == null) return null;

  // Canonical values are { type, value } objects
  const value = typeof rawValue === 'object' && rawValue !== null && 'value' in rawValue
    ? (rawValue as Record<string, unknown>).value
    : rawValue;

  if (value == null) return null;

  const extractor = SEARCH_TEXT_EXTRACTORS[fieldType];
  return extractor ? extractor(value) : (typeof value === 'string' ? value : null);
}

/**
 * Build a Drizzle SQL expression for the tsvector search_vector column.
 *
 * Returns a SQL fragment like:
 *   setweight(to_tsvector('simple', 'title text'), 'A') ||
 *   setweight(to_tsvector('simple', 'other text'), 'C')
 *
 * Returns `''::tsvector` if no searchable text is found.
 */
export function buildSearchVector(
  canonicalData: Record<string, unknown>,
  fields: SearchFieldDefinition[],
): SQL {
  const parts: SQL[] = [];

  for (const field of fields) {
    // Skip non-searchable field types
    if (NON_SEARCHABLE_TYPES.has(field.fieldType)) continue;

    // Check config for explicit searchable: false
    if (field.config?.searchable === false) continue;

    const rawValue = canonicalData[field.id];
    const text = extractSearchableText(rawValue, field.fieldType);
    if (!text || text.trim() === '') continue;

    // Determine weight
    let weight: string;
    if (field.isPrimary) {
      weight = 'A';
    } else if (field.config?.searchPriority === 'high') {
      weight = 'B';
    } else if (field.fieldType === 'linked_record' || field.fieldType === 'formula') {
      weight = 'D';
    } else {
      weight = 'C';
    }

    // Sanitize: remove null bytes, limit length per field
    const sanitized = text.replace(/\0/g, '').slice(0, 5000);

    parts.push(sql`setweight(to_tsvector('simple', ${sanitized}), ${sql.raw(`'${weight}'`)})`);
  }

  if (parts.length === 0) {
    return sql`''::tsvector`;
  }

  // Join parts with ||
  let result = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    result = sql`${result} || ${parts[i]}`;
  }

  return result;
}

/**
 * Simple TipTap JSON → plain text extraction.
 * Recursively collects text content from TipTap document nodes.
 */
function extractTipTapText(node: Record<string, unknown>): string | null {
  const parts: string[] = [];

  if (typeof node.text === 'string') {
    parts.push(node.text);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      if (typeof child === 'object' && child !== null) {
        const childText = extractTipTapText(child as Record<string, unknown>);
        if (childText) parts.push(childText);
      }
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
