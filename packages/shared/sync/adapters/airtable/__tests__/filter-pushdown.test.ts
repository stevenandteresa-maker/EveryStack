import { describe, it, expect } from 'vitest';
import type { FilterRule } from '../../../types';
import {
  FilterRuleSchema,
  SyncConfigSchema,
  SyncTableConfigSchema,
} from '../../../types';
import {
  translateFilterToFormula,
  applyLocalFilters,
  getLocalOnlyFilters,
  canPushDown,
} from '../filter-pushdown';

// ---------------------------------------------------------------------------
// Helper — reusable field map for tests
// ---------------------------------------------------------------------------

const fieldMap = new Map<string, string>([
  ['field-1', 'Status'],
  ['field-2', 'Priority'],
  ['field-3', 'Name'],
  ['field-4', 'Count'],
  ['field-5', 'Due Date'],
  ['field-6', 'Notes'],
]);

function makeRule(
  overrides: Partial<FilterRule> & Pick<FilterRule, 'operator'>,
): FilterRule {
  return {
    fieldId: 'field-1',
    value: 'test',
    conjunction: 'and',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// translateFilterToFormula — operator mapping
// ---------------------------------------------------------------------------

describe('translateFilterToFormula', () => {
  it('returns empty string for empty filter array', () => {
    expect(translateFilterToFormula([], fieldMap)).toBe('');
  });

  it('returns empty string when no fields map', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'unknown-field', operator: 'equals', value: 'x' }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('');
  });

  // --- Single-rule operator tests (no wrapper needed) ---

  it('translates equals operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'Active' }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} = "Active"',
    );
  });

  it('translates not_equals operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'not_equals', value: 'Archived' }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} != "Archived"',
    );
  });

  it('translates contains operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-3', operator: 'contains', value: 'foo' }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'FIND("foo", {Name}) > 0',
    );
  });

  it('translates not_contains operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-3', operator: 'not_contains', value: 'bar' }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'FIND("bar", {Name}) = 0',
    );
  });

  it('translates greater_than operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'greater_than', value: 10 }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('{Count} > 10');
  });

  it('translates less_than operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'less_than', value: 5 }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('{Count} < 5');
  });

  it('translates greater_equal operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'greater_equal', value: 10 }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('{Count} >= 10');
  });

  it('translates less_equal operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'less_equal', value: 5 }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('{Count} <= 5');
  });

  it('translates is_empty operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_empty', value: null }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} = BLANK()',
    );
  });

  it('translates is_not_empty operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_not_empty', value: null }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} != BLANK()',
    );
  });

  it('translates is_any_of operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_any_of', value: ['Active', 'Pending'] }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'OR({Status} = "Active", {Status} = "Pending")',
    );
  });

  it('translates is_any_of with single value (no OR wrapper)', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_any_of', value: ['Active'] }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} = "Active"',
    );
  });

  it('translates is_none_of operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_none_of', value: ['Archived', 'Deleted'] }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'AND({Status} != "Archived", {Status} != "Deleted")',
    );
  });

  it('translates is_none_of with single value (no AND wrapper)', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_none_of', value: ['Archived'] }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} != "Archived"',
    );
  });

  it('translates is_before operator', () => {
    const rules: FilterRule[] = [
      makeRule({
        fieldId: 'field-5',
        operator: 'is_before',
        value: '2024-01-01',
      }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'IS_BEFORE({Due Date}, "2024-01-01")',
    );
  });

  it('translates is_after operator', () => {
    const rules: FilterRule[] = [
      makeRule({
        fieldId: 'field-5',
        operator: 'is_after',
        value: '2024-06-01',
      }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'IS_AFTER({Due Date}, "2024-06-01")',
    );
  });

  // --- Conjunction handling ---

  it('wraps multiple AND rules with AND()', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'Active', conjunction: 'and' }),
      makeRule({
        fieldId: 'field-2',
        operator: 'equals',
        value: 'High',
        conjunction: 'and',
      }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'AND({Status} = "Active", {Priority} = "High")',
    );
  });

  it('wraps multiple OR rules with OR()', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'Active', conjunction: 'or' }),
      makeRule({
        fieldId: 'field-2',
        operator: 'equals',
        value: 'High',
        conjunction: 'or',
      }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      'OR({Status} = "Active", {Priority} = "High")',
    );
  });

  // --- Edge cases ---

  it('escapes double quotes in string values', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'He said "hello"' }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} = "He said \\"hello\\""',
    );
  });

  it('skips is_within operator (local-only)', () => {
    const rules: FilterRule[] = [
      makeRule({
        fieldId: 'field-5',
        operator: 'is_within',
        value: { start: '2024-01-01', end: '2024-12-31' },
      }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('');
  });

  it('skips unmapped fields and translates mapped ones', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'unknown-field', operator: 'equals', value: 'x' }),
      makeRule({ operator: 'equals', value: 'Active' }),
    ];
    // Only the second rule maps, so no AND wrapper needed (single formula)
    expect(translateFilterToFormula(rules, fieldMap)).toBe(
      '{Status} = "Active"',
    );
  });

  it('handles is_any_of with empty array', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_any_of', value: [] }),
    ];
    expect(translateFilterToFormula(rules, fieldMap)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// getLocalOnlyFilters
// ---------------------------------------------------------------------------

describe('getLocalOnlyFilters', () => {
  it('returns only local-only operators', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals' }),
      makeRule({
        fieldId: 'field-5',
        operator: 'is_within',
        value: { start: '2024-01-01', end: '2024-12-31' },
      }),
      makeRule({ operator: 'contains', value: 'x' }),
    ];
    const localOnly = getLocalOnlyFilters(rules);
    expect(localOnly).toHaveLength(1);
    expect(localOnly[0]!.operator).toBe('is_within');
  });

  it('returns empty array when all operators are pushdown-capable', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals' }),
      makeRule({ operator: 'is_empty' }),
    ];
    expect(getLocalOnlyFilters(rules)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// canPushDown
// ---------------------------------------------------------------------------

describe('canPushDown', () => {
  it('returns true for pushdown-capable operators', () => {
    expect(canPushDown('equals')).toBe(true);
    expect(canPushDown('not_equals')).toBe(true);
    expect(canPushDown('contains')).toBe(true);
    expect(canPushDown('is_any_of')).toBe(true);
    expect(canPushDown('is_before')).toBe(true);
    expect(canPushDown('is_after')).toBe(true);
  });

  it('returns false for local-only operators', () => {
    expect(canPushDown('is_within')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyLocalFilters
// ---------------------------------------------------------------------------

describe('applyLocalFilters', () => {
  const records = [
    { 'field-1': 'Active', 'field-4': 15, 'field-5': '2024-06-15' },
    { 'field-1': 'Archived', 'field-4': 3, 'field-5': '2023-06-15' },
    { 'field-1': 'Active', 'field-4': 8, 'field-5': '2024-11-01' },
    { 'field-1': '', 'field-4': 0, 'field-5': null },
  ];

  it('returns all records for empty filter array', () => {
    expect(applyLocalFilters(records, [])).toEqual(records);
  });

  it('filters with equals (AND conjunction)', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'Active' }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r['field-1'] === 'Active')).toBe(true);
  });

  it('filters with is_empty', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_empty' }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(1);
    expect(result[0]!['field-1']).toBe('');
  });

  it('filters with is_not_empty', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_not_empty' }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(3);
  });

  it('filters with greater_than', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'greater_than', value: 5 }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('filters with contains (case insensitive)', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'contains', value: 'active' }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('filters with not_contains', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'not_contains', value: 'active' }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('filters with is_any_of', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_any_of', value: ['Active', 'Pending'] }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('filters with is_none_of', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'is_none_of', value: ['Archived'] }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(3);
  });

  it('filters with is_before', () => {
    const rules: FilterRule[] = [
      makeRule({
        fieldId: 'field-5',
        operator: 'is_before',
        value: '2024-01-01',
      }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(1);
    expect(result[0]!['field-5']).toBe('2023-06-15');
  });

  it('filters with is_after', () => {
    const rules: FilterRule[] = [
      makeRule({
        fieldId: 'field-5',
        operator: 'is_after',
        value: '2024-10-01',
      }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(1);
    expect(result[0]!['field-5']).toBe('2024-11-01');
  });

  it('filters with is_within (local-only operator)', () => {
    const rules: FilterRule[] = [
      makeRule({
        fieldId: 'field-5',
        operator: 'is_within',
        value: { start: '2024-01-01', end: '2024-12-31' },
      }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('applies multiple AND rules', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'Active', conjunction: 'and' }),
      makeRule({
        fieldId: 'field-4',
        operator: 'greater_than',
        value: 10,
        conjunction: 'and',
      }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(1);
    expect(result[0]!['field-4']).toBe(15);
  });

  it('applies multiple OR rules', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'equals', value: 'Active', conjunction: 'or' }),
      makeRule({
        fieldId: 'field-4',
        operator: 'less_than',
        value: 1,
        conjunction: 'or',
      }),
    ];
    const result = applyLocalFilters(records, rules);
    // Records with Active (2) + record with count 0 (1, but overlaps with Active)
    // = 3 total (Active/15, Active/8, empty/0)
    expect(result).toHaveLength(3);
  });

  it('handles less_equal operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'less_equal', value: 3 }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('handles greater_equal operator', () => {
    const rules: FilterRule[] = [
      makeRule({ fieldId: 'field-4', operator: 'greater_equal', value: 8 }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });

  it('handles not_equals operator', () => {
    const rules: FilterRule[] = [
      makeRule({ operator: 'not_equals', value: 'Active' }),
    ];
    const result = applyLocalFilters(records, rules);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Zod Schema validation
// ---------------------------------------------------------------------------

describe('FilterRuleSchema', () => {
  it('validates a correct filter rule', () => {
    const result = FilterRuleSchema.safeParse({
      fieldId: 'field-1',
      operator: 'equals',
      value: 'Active',
      conjunction: 'and',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid operator', () => {
    const result = FilterRuleSchema.safeParse({
      fieldId: 'field-1',
      operator: 'invalid_op',
      value: 'Active',
      conjunction: 'and',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid conjunction', () => {
    const result = FilterRuleSchema.safeParse({
      fieldId: 'field-1',
      operator: 'equals',
      value: 'Active',
      conjunction: 'xor',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty fieldId', () => {
    const result = FilterRuleSchema.safeParse({
      fieldId: '',
      operator: 'equals',
      value: 'Active',
      conjunction: 'and',
    });
    expect(result.success).toBe(false);
  });

  it('allows null value (for is_empty)', () => {
    const result = FilterRuleSchema.safeParse({
      fieldId: 'field-1',
      operator: 'is_empty',
      value: null,
      conjunction: 'and',
    });
    expect(result.success).toBe(true);
  });
});

describe('SyncTableConfigSchema', () => {
  it('validates a correct table config', () => {
    const result = SyncTableConfigSchema.safeParse({
      external_table_id: 'tblAbc123',
      external_table_name: 'Projects',
      enabled: true,
      sync_filter: null,
      estimated_record_count: 1000,
      synced_record_count: 950,
    });
    expect(result.success).toBe(true);
  });

  it('validates table config with filter rules', () => {
    const result = SyncTableConfigSchema.safeParse({
      external_table_id: 'tblAbc123',
      external_table_name: 'Tasks',
      enabled: true,
      sync_filter: [
        {
          fieldId: 'field-1',
          operator: 'equals',
          value: 'Active',
          conjunction: 'and',
        },
      ],
      estimated_record_count: 500,
      synced_record_count: 200,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative record counts', () => {
    const result = SyncTableConfigSchema.safeParse({
      external_table_id: 'tblAbc123',
      external_table_name: 'Projects',
      enabled: true,
      sync_filter: null,
      estimated_record_count: -1,
      synced_record_count: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty external_table_id', () => {
    const result = SyncTableConfigSchema.safeParse({
      external_table_id: '',
      external_table_name: 'Projects',
      enabled: true,
      sync_filter: null,
      estimated_record_count: 0,
      synced_record_count: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('SyncConfigSchema', () => {
  it('validates a correct sync config', () => {
    const result = SyncConfigSchema.safeParse({
      polling_interval_seconds: 300,
      tables: [
        {
          external_table_id: 'tblAbc123',
          external_table_name: 'Projects',
          enabled: true,
          sync_filter: null,
          estimated_record_count: 1000,
          synced_record_count: 950,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('applies default polling interval', () => {
    const result = SyncConfigSchema.safeParse({
      tables: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.polling_interval_seconds).toBe(300);
    }
  });

  it('rejects polling interval less than 1', () => {
    const result = SyncConfigSchema.safeParse({
      polling_interval_seconds: 0,
      tables: [],
    });
    expect(result.success).toBe(false);
  });

  it('validates empty tables array', () => {
    const result = SyncConfigSchema.safeParse({
      polling_interval_seconds: 60,
      tables: [],
    });
    expect(result.success).toBe(true);
  });
});
