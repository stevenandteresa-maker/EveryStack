import { describe, it, expect } from 'vitest';
import { isComputedFieldType, COMPUTED_FIELD_TYPES } from '../outbound';

describe('isComputedFieldType', () => {
  it.each([
    'lookup', 'rollup', 'formula', 'count', 'auto_number',
    'created_at', 'updated_at', 'created_by', 'updated_by',
  ])('returns true for %s', (fieldType) => {
    expect(isComputedFieldType(fieldType)).toBe(true);
  });

  it.each([
    'text', 'number', 'single_select', 'checkbox', 'date',
    'email', 'url', 'phone', 'currency', 'linked_record',
  ])('returns false for %s', (fieldType) => {
    expect(isComputedFieldType(fieldType)).toBe(false);
  });

  it('COMPUTED_FIELD_TYPES contains exactly 9 types', () => {
    expect(COMPUTED_FIELD_TYPES.size).toBe(9);
  });
});
