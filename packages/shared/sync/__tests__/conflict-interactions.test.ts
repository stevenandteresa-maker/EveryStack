import { describe, it, expect } from 'vitest';
import { shouldRecomputeOnResolution } from '../conflict-interactions';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const RESOLVED_FIELD_ID = 'field-status-uuid';

function makeField(overrides: {
  id: string;
  fieldType: string;
  config?: Record<string, unknown>;
}) {
  return {
    id: overrides.id,
    fieldType: overrides.fieldType,
    config: overrides.config ?? {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('shouldRecomputeOnResolution', () => {
  it('identifies formula fields referencing the resolved field', () => {
    const fields = [
      makeField({
        id: 'formula-1',
        fieldType: 'formula',
        config: { referencedFieldIds: [RESOLVED_FIELD_ID, 'other-field-uuid'] },
      }),
      makeField({
        id: 'formula-2',
        fieldType: 'formula',
        config: { referencedFieldIds: ['unrelated-field-uuid'] },
      }),
      makeField({ id: RESOLVED_FIELD_ID, fieldType: 'singleSelect' }),
    ];

    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, fields);

    expect(result.formulaFields).toEqual(['formula-1']);
    expect(result.formulaFields).not.toContain('formula-2');
  });

  it('identifies cross-link display fields referencing the resolved field', () => {
    const fields = [
      makeField({
        id: 'crosslink-1',
        fieldType: 'crossLinkDisplay',
        config: { displayFieldId: RESOLVED_FIELD_ID },
      }),
      makeField({
        id: 'crosslink-2',
        fieldType: 'crossLinkDisplay',
        config: { displayFieldId: 'other-field-uuid' },
      }),
      makeField({
        id: 'lookup-1',
        fieldType: 'lookup',
        config: { displayFieldId: RESOLVED_FIELD_ID },
      }),
    ];

    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, fields);

    expect(result.crossLinkFields).toEqual(['crosslink-1', 'lookup-1']);
    expect(result.crossLinkFields).not.toContain('crosslink-2');
  });

  it('returns empty arrays when no downstream fields exist', () => {
    const fields = [
      makeField({ id: RESOLVED_FIELD_ID, fieldType: 'singleSelect' }),
      makeField({ id: 'text-field', fieldType: 'text' }),
      makeField({ id: 'number-field', fieldType: 'number' }),
    ];

    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, fields);

    expect(result.formulaFields).toEqual([]);
    expect(result.crossLinkFields).toEqual([]);
  });

  it('always sets requiresTsvectorUpdate to true', () => {
    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, []);

    expect(result.requiresTsvectorUpdate).toBe(true);
  });

  it('handles formula fields with no referencedFieldIds config', () => {
    const fields = [
      makeField({ id: 'formula-empty', fieldType: 'formula', config: {} }),
    ];

    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, fields);

    expect(result.formulaFields).toEqual([]);
  });

  it('handles formula fields with non-array referencedFieldIds', () => {
    const fields = [
      makeField({
        id: 'formula-bad',
        fieldType: 'formula',
        config: { referencedFieldIds: 'not-an-array' },
      }),
    ];

    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, fields);

    expect(result.formulaFields).toEqual([]);
  });

  it('returns both formula and cross-link fields when both reference resolved field', () => {
    const fields = [
      makeField({
        id: 'formula-1',
        fieldType: 'formula',
        config: { referencedFieldIds: [RESOLVED_FIELD_ID] },
      }),
      makeField({
        id: 'lookup-1',
        fieldType: 'lookup',
        config: { displayFieldId: RESOLVED_FIELD_ID },
      }),
    ];

    const result = shouldRecomputeOnResolution(RESOLVED_FIELD_ID, fields);

    expect(result.formulaFields).toEqual(['formula-1']);
    expect(result.crossLinkFields).toEqual(['lookup-1']);
    expect(result.requiresTsvectorUpdate).toBe(true);
  });
});
