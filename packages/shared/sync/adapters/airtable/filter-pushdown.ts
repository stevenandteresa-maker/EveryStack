// ---------------------------------------------------------------------------
// Airtable Filter Pushdown — translates FilterRule[] to filterByFormula
//
// Converts the shared FilterRule grammar into Airtable's filterByFormula
// string syntax. For operators that can't be pushed down, applyLocalFilters()
// provides post-fetch filtering on canonical records.
//
// @see docs/reference/sync-engine.md § Platform Filter Pushdown
// ---------------------------------------------------------------------------

import type { FilterRule, FilterOperator } from '../../types';

/**
 * Set of operators that Airtable's filterByFormula natively supports.
 * Operators NOT in this set must be handled by applyLocalFilters().
 */
const PUSHDOWN_OPERATORS = new Set<FilterOperator>([
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
]);

/**
 * Operators that cannot be pushed down to Airtable and require local filtering.
 */
const LOCAL_ONLY_OPERATORS = new Set<FilterOperator>([
  'is_within',
]);

/**
 * Escape double quotes in a string value for use in Airtable formulas.
 */
function escapeFormulaValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Translate a single FilterRule into an Airtable formula fragment.
 * Returns null if the operator cannot be pushed down.
 *
 * @param rule - The filter rule to translate
 * @param fieldName - The Airtable field name (resolved from fieldMap)
 */
function translateRule(rule: FilterRule, fieldName: string): string | null {
  if (LOCAL_ONLY_OPERATORS.has(rule.operator)) {
    return null;
  }

  const escapedField = fieldName;

  switch (rule.operator) {
    case 'equals':
      return `{${escapedField}} = "${escapeFormulaValue(String(rule.value))}"`;

    case 'not_equals':
      return `{${escapedField}} != "${escapeFormulaValue(String(rule.value))}"`;

    case 'contains':
      return `FIND("${escapeFormulaValue(String(rule.value))}", {${escapedField}}) > 0`;

    case 'not_contains':
      return `FIND("${escapeFormulaValue(String(rule.value))}", {${escapedField}}) = 0`;

    case 'greater_than':
      return `{${escapedField}} > ${Number(rule.value)}`;

    case 'less_than':
      return `{${escapedField}} < ${Number(rule.value)}`;

    case 'greater_equal':
      return `{${escapedField}} >= ${Number(rule.value)}`;

    case 'less_equal':
      return `{${escapedField}} <= ${Number(rule.value)}`;

    case 'is_empty':
      return `{${escapedField}} = BLANK()`;

    case 'is_not_empty':
      return `{${escapedField}} != BLANK()`;

    case 'is_any_of': {
      const values = rule.value as string[];
      if (!Array.isArray(values) || values.length === 0) return null;
      const clauses = values.map(
        (v) => `{${escapedField}} = "${escapeFormulaValue(String(v))}"`,
      );
      return clauses.length === 1 ? clauses[0]! : `OR(${clauses.join(', ')})`;
    }

    case 'is_none_of': {
      const values = rule.value as string[];
      if (!Array.isArray(values) || values.length === 0) return null;
      const clauses = values.map(
        (v) => `{${escapedField}} != "${escapeFormulaValue(String(v))}"`,
      );
      return clauses.length === 1 ? clauses[0]! : `AND(${clauses.join(', ')})`;
    }

    case 'is_before':
      return `IS_BEFORE({${escapedField}}, "${escapeFormulaValue(String(rule.value))}")`;

    case 'is_after':
      return `IS_AFTER({${escapedField}}, "${escapeFormulaValue(String(rule.value))}")`;

    default:
      return null;
  }
}

/**
 * Translate FilterRule[] into an Airtable filterByFormula string.
 *
 * Rules that cannot be pushed down (e.g. `is_within`) are silently skipped —
 * use `getLocalOnlyFilters()` + `applyLocalFilters()` for those.
 *
 * @param filters - Array of filter rules to translate
 * @param fieldMap - Maps EveryStack field IDs → Airtable field names
 * @returns Airtable filterByFormula string, or empty string if no rules translate
 */
export function translateFilterToFormula(
  filters: FilterRule[],
  fieldMap: Map<string, string>,
): string {
  if (filters.length === 0) return '';

  const formulas: string[] = [];

  for (const rule of filters) {
    const fieldName = fieldMap.get(rule.fieldId);
    if (!fieldName) continue;

    const formula = translateRule(rule, fieldName);
    if (formula) {
      formulas.push(formula);
    }
  }

  if (formulas.length === 0) return '';
  if (formulas.length === 1) return formulas[0]!;

  // Use the conjunction from the first rule to determine the wrapper.
  // All rules in a filter group share the same conjunction per the spec.
  const conjunction = filters[0]!.conjunction;
  return conjunction === 'or'
    ? `OR(${formulas.join(', ')})`
    : `AND(${formulas.join(', ')})`;
}

/**
 * Returns filter rules that cannot be pushed down to Airtable
 * and must be applied locally after fetching records.
 */
export function getLocalOnlyFilters(filters: FilterRule[]): FilterRule[] {
  return filters.filter((rule) => LOCAL_ONLY_OPERATORS.has(rule.operator));
}

/**
 * Check whether a single record value matches a FilterRule.
 *
 * @param value - The record's field value (from canonical_data)
 * @param rule - The filter rule to evaluate
 * @returns true if the record matches the rule
 */
function matchesRule(value: unknown, rule: FilterRule): boolean {
  switch (rule.operator) {
    case 'equals':
      return value === rule.value || String(value) === String(rule.value);

    case 'not_equals':
      return value !== rule.value && String(value) !== String(rule.value);

    case 'contains':
      return (
        typeof value === 'string' &&
        value.toLowerCase().includes(String(rule.value).toLowerCase())
      );

    case 'not_contains':
      return (
        typeof value !== 'string' ||
        !value.toLowerCase().includes(String(rule.value).toLowerCase())
      );

    case 'greater_than':
      return Number(value) > Number(rule.value);

    case 'less_than':
      return Number(value) < Number(rule.value);

    case 'greater_equal':
      return Number(value) >= Number(rule.value);

    case 'less_equal':
      return Number(value) <= Number(rule.value);

    case 'is_empty':
      return value === null || value === undefined || value === '';

    case 'is_not_empty':
      return value !== null && value !== undefined && value !== '';

    case 'is_any_of': {
      const allowed = rule.value as unknown[];
      if (!Array.isArray(allowed)) return false;
      return allowed.some((v) => String(v) === String(value));
    }

    case 'is_none_of': {
      const excluded = rule.value as unknown[];
      if (!Array.isArray(excluded)) return true;
      return excluded.every((v) => String(v) !== String(value));
    }

    case 'is_before': {
      if (!value) return false;
      return new Date(String(value)) < new Date(String(rule.value));
    }

    case 'is_after': {
      if (!value) return false;
      return new Date(String(value)) > new Date(String(rule.value));
    }

    case 'is_within': {
      if (!value) return false;
      const dateValue = new Date(String(value));
      const withinConfig = rule.value as { start: string; end: string };
      if (!withinConfig || !withinConfig.start || !withinConfig.end) return false;
      return (
        dateValue >= new Date(withinConfig.start) &&
        dateValue <= new Date(withinConfig.end)
      );
    }

    default:
      return false;
  }
}

/**
 * Apply filters locally to an array of records. Used as a fallback when
 * the platform API doesn't support the filter operator natively.
 *
 * Records are objects with field values keyed by EveryStack field ID
 * (same as canonical_data structure).
 *
 * @param records - Array of records (each has fields keyed by field ID)
 * @param filters - Filter rules to apply
 * @returns Records that match all filter rules
 */
export function applyLocalFilters<T extends Record<string, unknown>>(
  records: T[],
  filters: FilterRule[],
): T[] {
  if (filters.length === 0) return records;

  return records.filter((record) => {
    const conjunction = filters[0]!.conjunction;

    if (conjunction === 'or') {
      return filters.some((rule) => matchesRule(record[rule.fieldId], rule));
    }

    return filters.every((rule) => matchesRule(record[rule.fieldId], rule));
  });
}

/**
 * Check whether a specific operator can be pushed down to Airtable.
 */
export function canPushDown(operator: FilterOperator): boolean {
  return PUSHDOWN_OPERATORS.has(operator);
}
