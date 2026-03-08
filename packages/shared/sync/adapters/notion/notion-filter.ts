// ---------------------------------------------------------------------------
// Notion Filter Pushdown — translates EveryStack FilterRule[] to Notion
// database query filter JSON.
//
// Notion's database query API accepts compound filters using `and`/`or`
// arrays, with property-specific filter conditions keyed by property type.
//
// @see docs/reference/sync-engine.md § Sync Filters
// @see https://developers.notion.com/reference/post-database-query-filter
// ---------------------------------------------------------------------------

import type { FilterRule } from '../../types';
import type { SyncedFieldMapping } from '../../../db/schema/synced-field-mappings';

// ---------------------------------------------------------------------------
// Notion filter types — mirrors the Notion API filter structure
// ---------------------------------------------------------------------------

/** A single Notion property filter condition. */
export interface NotionPropertyFilter {
  property: string;
  [propertyType: string]: unknown;
}

/** A compound Notion filter (and/or). */
export interface NotionCompoundFilter {
  and?: Array<NotionPropertyFilter | NotionCompoundFilter>;
  or?: Array<NotionPropertyFilter | NotionCompoundFilter>;
}

/** Union of all valid Notion filter shapes. */
export type NotionFilter = NotionPropertyFilter | NotionCompoundFilter;

// ---------------------------------------------------------------------------
// Notion property type → filter condition key mapping
// ---------------------------------------------------------------------------

/** Property types that use text-like filter conditions in Notion. */
const TEXT_FILTER_TYPES = new Set([
  'title',
  'rich_text',
  'url',
  'email',
  'phone_number',
]);

/** Property types that use number filter conditions. */
const NUMBER_FILTER_TYPES = new Set(['number']);

/** Property types that use checkbox filter conditions. */
const CHECKBOX_FILTER_TYPES = new Set(['checkbox']);

/** Property types that use select filter conditions. */
const SELECT_FILTER_TYPES = new Set(['select', 'status']);

/** Property types that use multi_select filter conditions. */
const MULTI_SELECT_FILTER_TYPES = new Set(['multi_select']);

/** Property types that use date filter conditions. */
const DATE_FILTER_TYPES = new Set([
  'date',
  'created_time',
  'last_edited_time',
]);

/**
 * Resolve the Notion filter condition key for a given property type.
 * Returns the key used inside the filter object (e.g., 'rich_text', 'number').
 */
function getNotionFilterKey(propertyType: string): string {
  if (TEXT_FILTER_TYPES.has(propertyType)) return 'rich_text';
  if (NUMBER_FILTER_TYPES.has(propertyType)) return 'number';
  if (CHECKBOX_FILTER_TYPES.has(propertyType)) return 'checkbox';
  if (SELECT_FILTER_TYPES.has(propertyType)) return 'select';
  if (MULTI_SELECT_FILTER_TYPES.has(propertyType)) return 'multi_select';
  if (DATE_FILTER_TYPES.has(propertyType)) return 'date';
  return 'rich_text'; // fallback for unknown types
}

// ---------------------------------------------------------------------------
// Operator mapping — EveryStack operators → Notion condition objects
// ---------------------------------------------------------------------------

/**
 * Build the Notion filter condition object for a given operator, filter key,
 * and value.
 *
 * Returns the inner condition object (e.g., `{ equals: "value" }`) or null
 * if the operator is not supported for this filter key.
 */
function buildCondition(
  operator: FilterRule['operator'],
  filterKey: string,
  value: unknown,
): Record<string, unknown> | null {
  switch (filterKey) {
    case 'rich_text':
      return buildTextCondition(operator, value);
    case 'number':
      return buildNumberCondition(operator, value);
    case 'checkbox':
      return buildCheckboxCondition(operator);
    case 'select':
      return buildSelectCondition(operator, value);
    case 'multi_select':
      return buildMultiSelectCondition(operator, value);
    case 'date':
      return buildDateCondition(operator, value);
    default:
      return null;
  }
}

function buildTextCondition(
  operator: FilterRule['operator'],
  value: unknown,
): Record<string, unknown> | null {
  const strValue = value != null ? String(value) : '';
  switch (operator) {
    case 'equals':
      return { equals: strValue };
    case 'not_equals':
      return { does_not_equal: strValue };
    case 'contains':
      return { contains: strValue };
    case 'not_contains':
      return { does_not_contain: strValue };
    case 'is_empty':
      return { is_empty: true };
    case 'is_not_empty':
      return { is_not_empty: true };
    default:
      return null;
  }
}

function buildNumberCondition(
  operator: FilterRule['operator'],
  value: unknown,
): Record<string, unknown> | null {
  const numValue = Number(value);
  switch (operator) {
    case 'equals':
      return { equals: numValue };
    case 'not_equals':
      return { does_not_equal: numValue };
    case 'greater_than':
      return { greater_than: numValue };
    case 'less_than':
      return { less_than: numValue };
    case 'greater_equal':
      return { greater_than_or_equal_to: numValue };
    case 'less_equal':
      return { less_than_or_equal_to: numValue };
    case 'is_empty':
      return { is_empty: true };
    case 'is_not_empty':
      return { is_not_empty: true };
    default:
      return null;
  }
}

function buildCheckboxCondition(
  operator: FilterRule['operator'],
): Record<string, unknown> | null {
  switch (operator) {
    case 'equals':
      return { equals: true };
    case 'not_equals':
      return { does_not_equal: true };
    default:
      return null;
  }
}

function buildSelectCondition(
  operator: FilterRule['operator'],
  value: unknown,
): Record<string, unknown> | null {
  const strValue = value != null ? String(value) : '';
  switch (operator) {
    case 'equals':
      return { equals: strValue };
    case 'not_equals':
      return { does_not_equal: strValue };
    case 'is_empty':
      return { is_empty: true };
    case 'is_not_empty':
      return { is_not_empty: true };
    default:
      return null;
  }
}

function buildMultiSelectCondition(
  operator: FilterRule['operator'],
  value: unknown,
): Record<string, unknown> | null {
  const strValue = value != null ? String(value) : '';
  switch (operator) {
    case 'contains':
      return { contains: strValue };
    case 'not_contains':
      return { does_not_contain: strValue };
    case 'is_empty':
      return { is_empty: true };
    case 'is_not_empty':
      return { is_not_empty: true };
    default:
      return null;
  }
}

function buildDateCondition(
  operator: FilterRule['operator'],
  value: unknown,
): Record<string, unknown> | null {
  const strValue = value != null ? String(value) : '';
  switch (operator) {
    case 'equals':
      return { equals: strValue };
    case 'is_before':
    case 'less_than':
      return { before: strValue };
    case 'is_after':
    case 'greater_than':
      return { after: strValue };
    case 'greater_equal':
      return { on_or_after: strValue };
    case 'less_equal':
      return { on_or_before: strValue };
    case 'is_empty':
      return { is_empty: true };
    case 'is_not_empty':
      return { is_not_empty: true };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Translate EveryStack filter rules to Notion's database query filter format.
 *
 * Uses `synced_field_mappings` to resolve EveryStack field IDs to Notion
 * property names/IDs and determine the property type for each filter.
 *
 * @param rules - EveryStack filter rules (same grammar as view filters)
 * @param fieldMappings - Synced field mappings for this table
 * @returns Notion filter object, or undefined if no translatable rules exist
 */
export function translateToNotionFilter(
  rules: FilterRule[],
  fieldMappings: Pick<SyncedFieldMapping, 'fieldId' | 'externalFieldId' | 'externalFieldType'>[],
): NotionFilter | undefined {
  if (!rules || rules.length === 0) return undefined;

  // Build a lookup map: ES field ID → { Notion property ID, Notion type }
  const fieldMap = new Map<string, { propertyId: string; propertyType: string }>();
  for (const mapping of fieldMappings) {
    fieldMap.set(mapping.fieldId, {
      propertyId: mapping.externalFieldId,
      propertyType: mapping.externalFieldType,
    });
  }

  // Group rules by conjunction to build compound filters.
  // All rules joined by 'and' become an { and: [...] } compound.
  // If any rule uses 'or', we split into groups.
  const translatedFilters: NotionPropertyFilter[] = [];

  for (const rule of rules) {
    const fieldInfo = fieldMap.get(rule.fieldId);
    if (!fieldInfo) continue; // Skip rules for unmapped fields

    const filterKey = getNotionFilterKey(fieldInfo.propertyType);
    const condition = buildCondition(rule.operator, filterKey, rule.value);
    if (!condition) continue; // Skip unsupported operator/type combos

    translatedFilters.push({
      property: fieldInfo.propertyId,
      [filterKey]: condition,
    });
  }

  if (translatedFilters.length === 0) return undefined;
  if (translatedFilters.length === 1) return translatedFilters[0];

  // Check if all rules use 'and' conjunction (default behavior)
  const hasOrConjunction = rules.some((r) => r.conjunction === 'or');

  if (hasOrConjunction) {
    // Build OR compound — Notion uses { or: [...] }
    return { or: translatedFilters };
  }

  // Default: AND compound
  return { and: translatedFilters };
}
