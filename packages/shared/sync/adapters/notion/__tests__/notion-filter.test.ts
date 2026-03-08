import { describe, it, expect } from 'vitest';
import { translateToNotionFilter } from '../notion-filter';
import type { FilterRule } from '../../../types';

// Minimal field mapping shape matching what translateToNotionFilter expects
function makeMapping(fieldId: string, externalFieldId: string, externalFieldType: string) {
  return { fieldId, externalFieldId, externalFieldType };
}

describe('translateToNotionFilter', () => {
  const mappings = [
    makeMapping('field-1', 'Name', 'title'),
    makeMapping('field-2', 'Description', 'rich_text'),
    makeMapping('field-3', 'Count', 'number'),
    makeMapping('field-4', 'Status', 'select'),
    makeMapping('field-5', 'Done', 'checkbox'),
    makeMapping('field-6', 'Tags', 'multi_select'),
    makeMapping('field-7', 'Due Date', 'date'),
    makeMapping('field-8', 'Email', 'email'),
    makeMapping('field-9', 'Website', 'url'),
    makeMapping('field-10', 'Phone', 'phone_number'),
    makeMapping('field-11', 'Category', 'status'),
    makeMapping('field-12', 'Created', 'created_time'),
    makeMapping('field-13', 'Updated', 'last_edited_time'),
  ];

  // -----------------------------------------------------------------------
  // Empty / no rules
  // -----------------------------------------------------------------------

  it('returns undefined for empty rules array', () => {
    expect(translateToNotionFilter([], mappings)).toBeUndefined();
  });

  it('returns undefined for null-ish rules', () => {
    expect(translateToNotionFilter(null as unknown as FilterRule[], mappings)).toBeUndefined();
  });

  it('returns undefined when no rules map to known fields', () => {
    const rules: FilterRule[] = [
      { fieldId: 'unknown-field', operator: 'equals', value: 'test', conjunction: 'and' },
    ];
    expect(translateToNotionFilter(rules, mappings)).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // Single rule — text-like types
  // -----------------------------------------------------------------------

  it('translates title equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-1', operator: 'equals', value: 'Test', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Name',
      rich_text: { equals: 'Test' },
    });
  });

  it('translates rich_text contains filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-2', operator: 'contains', value: 'important', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Description',
      rich_text: { contains: 'important' },
    });
  });

  it('translates text not_contains filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-2', operator: 'not_contains', value: 'draft', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Description',
      rich_text: { does_not_contain: 'draft' },
    });
  });

  it('translates text not_equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-1', operator: 'not_equals', value: 'Archived', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Name',
      rich_text: { does_not_equal: 'Archived' },
    });
  });

  it('translates text is_empty filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-1', operator: 'is_empty', value: null, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Name',
      rich_text: { is_empty: true },
    });
  });

  it('translates text is_not_empty filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-1', operator: 'is_not_empty', value: null, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Name',
      rich_text: { is_not_empty: true },
    });
  });

  // -----------------------------------------------------------------------
  // Single rule — email, url, phone (all use rich_text filter key)
  // -----------------------------------------------------------------------

  it('translates email equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-8', operator: 'equals', value: 'test@example.com', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Email',
      rich_text: { equals: 'test@example.com' },
    });
  });

  it('translates url contains filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-9', operator: 'contains', value: 'example.com', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Website',
      rich_text: { contains: 'example.com' },
    });
  });

  // -----------------------------------------------------------------------
  // Single rule — number
  // -----------------------------------------------------------------------

  it('translates number equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'equals', value: 42, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { equals: 42 },
    });
  });

  it('translates number greater_than filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'greater_than', value: 10, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { greater_than: 10 },
    });
  });

  it('translates number less_than filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'less_than', value: 100, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { less_than: 100 },
    });
  });

  it('translates number greater_equal filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'greater_equal', value: 5, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { greater_than_or_equal_to: 5 },
    });
  });

  it('translates number less_equal filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'less_equal', value: 50, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { less_than_or_equal_to: 50 },
    });
  });

  it('translates number not_equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'not_equals', value: 0, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { does_not_equal: 0 },
    });
  });

  it('translates number is_empty filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'is_empty', value: null, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Count',
      number: { is_empty: true },
    });
  });

  // -----------------------------------------------------------------------
  // Single rule — select and status
  // -----------------------------------------------------------------------

  it('translates select equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-4', operator: 'equals', value: 'Active', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Status',
      select: { equals: 'Active' },
    });
  });

  it('translates select not_equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-4', operator: 'not_equals', value: 'Archived', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Status',
      select: { does_not_equal: 'Archived' },
    });
  });

  it('translates status (as select) equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-11', operator: 'equals', value: 'In Progress', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Category',
      select: { equals: 'In Progress' },
    });
  });

  it('translates select is_empty filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-4', operator: 'is_empty', value: null, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Status',
      select: { is_empty: true },
    });
  });

  // -----------------------------------------------------------------------
  // Single rule — multi_select
  // -----------------------------------------------------------------------

  it('translates multi_select contains filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-6', operator: 'contains', value: 'Urgent', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Tags',
      multi_select: { contains: 'Urgent' },
    });
  });

  it('translates multi_select not_contains filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-6', operator: 'not_contains', value: 'Low', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Tags',
      multi_select: { does_not_contain: 'Low' },
    });
  });

  it('translates multi_select is_empty filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-6', operator: 'is_empty', value: null, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Tags',
      multi_select: { is_empty: true },
    });
  });

  // -----------------------------------------------------------------------
  // Single rule — checkbox
  // -----------------------------------------------------------------------

  it('translates checkbox equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-5', operator: 'equals', value: true, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Done',
      checkbox: { equals: true },
    });
  });

  it('translates checkbox not_equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-5', operator: 'not_equals', value: false, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Done',
      checkbox: { does_not_equal: true },
    });
  });

  // -----------------------------------------------------------------------
  // Single rule — date
  // -----------------------------------------------------------------------

  it('translates date equals filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-7', operator: 'equals', value: '2024-03-15', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Due Date',
      date: { equals: '2024-03-15' },
    });
  });

  it('translates date is_before filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-7', operator: 'is_before', value: '2024-03-15', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Due Date',
      date: { before: '2024-03-15' },
    });
  });

  it('translates date is_after filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-7', operator: 'is_after', value: '2024-06-01', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Due Date',
      date: { after: '2024-06-01' },
    });
  });

  it('translates date greater_equal filter (on_or_after)', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-7', operator: 'greater_equal', value: '2024-01-01', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Due Date',
      date: { on_or_after: '2024-01-01' },
    });
  });

  it('translates date less_equal filter (on_or_before)', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-7', operator: 'less_equal', value: '2024-12-31', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Due Date',
      date: { on_or_before: '2024-12-31' },
    });
  });

  it('translates date is_empty filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-7', operator: 'is_empty', value: null, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Due Date',
      date: { is_empty: true },
    });
  });

  it('translates created_time filter as date type', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-12', operator: 'is_after', value: '2024-01-01', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Created',
      date: { after: '2024-01-01' },
    });
  });

  it('translates last_edited_time filter as date type', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-13', operator: 'is_before', value: '2024-12-31', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      property: 'Updated',
      date: { before: '2024-12-31' },
    });
  });

  // -----------------------------------------------------------------------
  // Compound filters — AND
  // -----------------------------------------------------------------------

  it('combines multiple AND rules into compound filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-4', operator: 'not_equals', value: 'Archived', conjunction: 'and' },
      { fieldId: 'field-3', operator: 'greater_than', value: 0, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      and: [
        { property: 'Status', select: { does_not_equal: 'Archived' } },
        { property: 'Count', number: { greater_than: 0 } },
      ],
    });
  });

  it('handles three AND rules', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-1', operator: 'is_not_empty', value: null, conjunction: 'and' },
      { fieldId: 'field-5', operator: 'equals', value: false, conjunction: 'and' },
      { fieldId: 'field-3', operator: 'greater_than', value: 5, conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      and: [
        { property: 'Name', rich_text: { is_not_empty: true } },
        { property: 'Done', checkbox: { equals: true } },
        { property: 'Count', number: { greater_than: 5 } },
      ],
    });
  });

  // -----------------------------------------------------------------------
  // Compound filters — OR
  // -----------------------------------------------------------------------

  it('combines OR rules into or compound filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-4', operator: 'equals', value: 'Active', conjunction: 'or' },
      { fieldId: 'field-4', operator: 'equals', value: 'In Progress', conjunction: 'or' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      or: [
        { property: 'Status', select: { equals: 'Active' } },
        { property: 'Status', select: { equals: 'In Progress' } },
      ],
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('skips rules for unmapped fields', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-1', operator: 'equals', value: 'Test', conjunction: 'and' },
      { fieldId: 'unknown-field', operator: 'equals', value: 'skip me', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    // Only the mapped rule should be included
    expect(result).toEqual({
      property: 'Name',
      rich_text: { equals: 'Test' },
    });
  });

  it('skips rules with unsupported operator for the filter type', () => {
    const rules: FilterRule[] = [
      // 'greater_than' is not supported for text-like filters
      { fieldId: 'field-1', operator: 'greater_than', value: 'abc', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toBeUndefined();
  });

  it('returns undefined when all rules are skipped', () => {
    const rules: FilterRule[] = [
      { fieldId: 'unknown-field', operator: 'equals', value: 'test', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toBeUndefined();
  });

  it('handles mixed valid and invalid rules in compound filter', () => {
    const rules: FilterRule[] = [
      { fieldId: 'field-3', operator: 'greater_than', value: 10, conjunction: 'and' },
      { fieldId: 'unknown-field', operator: 'equals', value: 'skip', conjunction: 'and' },
      { fieldId: 'field-4', operator: 'equals', value: 'Active', conjunction: 'and' },
    ];
    const result = translateToNotionFilter(rules, mappings);
    expect(result).toEqual({
      and: [
        { property: 'Count', number: { greater_than: 10 } },
        { property: 'Status', select: { equals: 'Active' } },
      ],
    });
  });
});
