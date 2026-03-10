/**
 * Filter type definitions, Zod schemas, and operator sets per field type.
 *
 * @see docs/reference/tables-and-views.md § Filtering
 */

import { z } from 'zod';
import { generateUUIDv7 } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Filter operator constants
// ---------------------------------------------------------------------------

export const FILTER_OPERATORS = {
  // Text operators
  IS: 'is',
  IS_NOT: 'is_not',
  CONTAINS: 'contains',
  DOES_NOT_CONTAIN: 'does_not_contain',
  STARTS_WITH: 'starts_with',
  ENDS_WITH: 'ends_with',

  // Numeric operators
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  BETWEEN: 'between',

  // Date operators
  IS_BEFORE: 'is_before',
  IS_AFTER: 'is_after',
  IS_WITHIN: 'is_within',

  // Multi-value operators
  IS_ANY_OF: 'is_any_of',
  IS_NONE_OF: 'is_none_of',
  CONTAINS_ANY_OF: 'contains_any_of',
  CONTAINS_ALL_OF: 'contains_all_of',

  // Empty operators
  IS_EMPTY: 'is_empty',
  IS_NOT_EMPTY: 'is_not_empty',
} as const;

export type FilterOperator = (typeof FILTER_OPERATORS)[keyof typeof FILTER_OPERATORS];

// ---------------------------------------------------------------------------
// Date presets for is_within operator
// ---------------------------------------------------------------------------

export const DATE_PRESETS = {
  LAST_7_DAYS: 'last_7_days',
  LAST_30_DAYS: 'last_30_days',
  THIS_WEEK: 'this_week',
  THIS_MONTH: 'this_month',
  THIS_YEAR: 'this_year',
} as const;

export type DatePreset = (typeof DATE_PRESETS)[keyof typeof DATE_PRESETS];

// ---------------------------------------------------------------------------
// Operator sets per field type
// ---------------------------------------------------------------------------

const TEXT_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.IS_NOT,
  FILTER_OPERATORS.CONTAINS,
  FILTER_OPERATORS.DOES_NOT_CONTAIN,
  FILTER_OPERATORS.STARTS_WITH,
  FILTER_OPERATORS.ENDS_WITH,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const NUMERIC_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.IS_NOT,
  FILTER_OPERATORS.GT,
  FILTER_OPERATORS.GTE,
  FILTER_OPERATORS.LT,
  FILTER_OPERATORS.LTE,
  FILTER_OPERATORS.BETWEEN,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const DATE_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.IS_BEFORE,
  FILTER_OPERATORS.IS_AFTER,
  FILTER_OPERATORS.IS_WITHIN,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const SINGLE_SELECT_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.IS_NOT,
  FILTER_OPERATORS.IS_ANY_OF,
  FILTER_OPERATORS.IS_NONE_OF,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const MULTI_SELECT_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.CONTAINS,
  FILTER_OPERATORS.DOES_NOT_CONTAIN,
  FILTER_OPERATORS.CONTAINS_ANY_OF,
  FILTER_OPERATORS.CONTAINS_ALL_OF,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const CHECKBOX_OPERATORS: FilterOperator[] = [FILTER_OPERATORS.IS];

const PEOPLE_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.IS_NOT,
  FILTER_OPERATORS.CONTAINS,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const LINKED_RECORD_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.IS_NOT,
  FILTER_OPERATORS.IS_EMPTY,
  FILTER_OPERATORS.IS_NOT_EMPTY,
];

const RATING_OPERATORS: FilterOperator[] = [
  FILTER_OPERATORS.IS,
  FILTER_OPERATORS.GT,
  FILTER_OPERATORS.LT,
  FILTER_OPERATORS.GTE,
  FILTER_OPERATORS.LTE,
];

/** Map of field type to supported operators. */
const FIELD_TYPE_OPERATORS: Record<string, FilterOperator[]> = {
  text: TEXT_OPERATORS,
  textarea: TEXT_OPERATORS,
  url: TEXT_OPERATORS,
  email: TEXT_OPERATORS,
  phone: TEXT_OPERATORS,
  number: NUMERIC_OPERATORS,
  currency: NUMERIC_OPERATORS,
  percent: NUMERIC_OPERATORS,
  duration: NUMERIC_OPERATORS,
  date: DATE_OPERATORS,
  datetime: DATE_OPERATORS,
  single_select: SINGLE_SELECT_OPERATORS,
  status: SINGLE_SELECT_OPERATORS,
  multi_select: MULTI_SELECT_OPERATORS,
  checkbox: CHECKBOX_OPERATORS,
  people: PEOPLE_OPERATORS,
  linked_record: LINKED_RECORD_OPERATORS,
  rating: RATING_OPERATORS,
};

/**
 * Returns the supported filter operators for a given field type.
 * Falls back to text operators for unknown field types.
 */
export function getOperatorsForFieldType(fieldType: string): FilterOperator[] {
  return FIELD_TYPE_OPERATORS[fieldType] ?? TEXT_OPERATORS;
}

/**
 * Returns true if the operator requires no value (unary operators).
 */
export function isUnaryOperator(operator: string): boolean {
  return (
    operator === FILTER_OPERATORS.IS_EMPTY ||
    operator === FILTER_OPERATORS.IS_NOT_EMPTY
  );
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const filterConditionSchema = z.object({
  id: z.string(),
  fieldId: z.string().uuid(),
  operator: z.string(),
  value: z.unknown(),
});

export type FilterCondition = z.infer<typeof filterConditionSchema>;

export const filterGroupSchema = z.object({
  id: z.string(),
  logic: z.enum(['and', 'or']),
  conditions: z.array(filterConditionSchema),
});

export type FilterGroup = z.infer<typeof filterGroupSchema>;

export const filterConfigSchema = z.object({
  logic: z.enum(['and', 'or']),
  conditions: z.array(filterConditionSchema),
  groups: z.array(filterGroupSchema),
});

export type FilterConfig = z.infer<typeof filterConfigSchema>;

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

/** Creates a new empty filter condition for a given field. */
export function createFilterCondition(
  fieldId: string,
  fieldType: string,
): FilterCondition {
  const operators = getOperatorsForFieldType(fieldType);
  return {
    id: generateUUIDv7(),
    fieldId,
    operator: operators[0] ?? FILTER_OPERATORS.IS,
    value: null,
  };
}

/** Creates a new empty filter group. */
export function createFilterGroup(): FilterGroup {
  return {
    id: generateUUIDv7(),
    logic: 'and',
    conditions: [],
  };
}

/** Creates a default empty filter config. */
export function createEmptyFilterConfig(): FilterConfig {
  return {
    logic: 'and',
    conditions: [],
    groups: [],
  };
}

/** Token for "assigned to me" in People filters. */
export const ME_TOKEN = '$me';
