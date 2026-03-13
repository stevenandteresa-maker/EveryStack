import { describe, it, expect } from 'vitest';
import {
  type CrossLinkFieldValue,
  type LinkedRecordEntry,
  type RelationshipType,
  type LinkScopeFilter,
  type LinkScopeCondition,
  RELATIONSHIP_TYPES,
  CROSS_LINK_LIMITS,
  extractCrossLinkField,
  setCrossLinkField,
} from '../cross-link-types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIELD_ID = 'f1a2b3c4-0000-0000-0000-000000000001';
const OTHER_FIELD_ID = 'f1a2b3c4-0000-0000-0000-000000000002';
const CROSS_LINK_ID = 'cl000000-0000-0000-0000-000000000001';

function makeLinkedRecordEntry(overrides?: Partial<LinkedRecordEntry>): LinkedRecordEntry {
  return {
    record_id: 'r0000000-0000-0000-0000-000000000001',
    table_id: 't0000000-0000-0000-0000-000000000001',
    display_value: 'Acme Corp',
    _display_updated_at: '2026-03-13T10:30:00Z',
    ...overrides,
  };
}

function makeCrossLinkFieldValue(overrides?: {
  linked_records?: LinkedRecordEntry[];
  cross_link_id?: string;
}): CrossLinkFieldValue {
  return {
    type: 'cross_link',
    value: {
      linked_records: overrides?.linked_records ?? [makeLinkedRecordEntry()],
      cross_link_id: overrides?.cross_link_id ?? CROSS_LINK_ID,
    },
  };
}

// ---------------------------------------------------------------------------
// Type exports — compile-time checks
// ---------------------------------------------------------------------------

describe('Cross-Link Types', () => {
  describe('RelationshipType', () => {
    it('accepts valid relationship types', () => {
      const manyToOne: RelationshipType = 'many_to_one';
      const oneToMany: RelationshipType = 'one_to_many';
      expect(manyToOne).toBe('many_to_one');
      expect(oneToMany).toBe('one_to_many');
    });
  });

  describe('RELATIONSHIP_TYPES', () => {
    it('has correct values', () => {
      expect(RELATIONSHIP_TYPES.MANY_TO_ONE).toBe('many_to_one');
      expect(RELATIONSHIP_TYPES.ONE_TO_MANY).toBe('one_to_many');
    });
  });

  describe('LinkScopeCondition', () => {
    it('accepts valid condition shapes', () => {
      const condition: LinkScopeCondition = {
        field_id: FIELD_ID,
        operator: 'eq',
        value: 'Active',
      };
      expect(condition.operator).toBe('eq');
    });

    it('accepts conditions without value (is_empty / is_not_empty)', () => {
      const condition: LinkScopeCondition = {
        field_id: FIELD_ID,
        operator: 'is_empty',
      };
      expect(condition.value).toBeUndefined();
    });
  });

  describe('LinkScopeFilter', () => {
    it('accepts valid filter shape', () => {
      const filter: LinkScopeFilter = {
        conditions: [
          { field_id: FIELD_ID, operator: 'in', value: ['Active', 'Pending'] },
        ],
        logic: 'and',
      };
      expect(filter.conditions).toHaveLength(1);
      expect(filter.logic).toBe('and');
    });

    it('accepts empty conditions array', () => {
      const filter: LinkScopeFilter = { conditions: [], logic: 'or' };
      expect(filter.conditions).toHaveLength(0);
    });
  });

  describe('CROSS_LINK_LIMITS', () => {
    it('has correct limit values', () => {
      expect(CROSS_LINK_LIMITS.MAX_LINKS_PER_RECORD).toBe(500);
      expect(CROSS_LINK_LIMITS.DEFAULT_LINKS_PER_RECORD).toBe(50);
      expect(CROSS_LINK_LIMITS.MAX_DEFINITIONS_PER_TABLE).toBe(20);
      expect(CROSS_LINK_LIMITS.MAX_DEPTH).toBe(5);
      expect(CROSS_LINK_LIMITS.DEFAULT_DEPTH).toBe(3);
      expect(CROSS_LINK_LIMITS.CIRCUIT_BREAKER_THRESHOLD).toBe(1000);
    });
  });
});

// ---------------------------------------------------------------------------
// extractCrossLinkField
// ---------------------------------------------------------------------------

describe('extractCrossLinkField', () => {
  it('returns correct CrossLinkFieldValue from valid canonical JSONB', () => {
    const fieldValue = makeCrossLinkFieldValue();
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: fieldValue,
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('cross_link');
    expect(result!.value.cross_link_id).toBe(CROSS_LINK_ID);
    expect(result!.value.linked_records).toHaveLength(1);
    expect(result!.value.linked_records[0]!.record_id).toBe(
      'r0000000-0000-0000-0000-000000000001',
    );
    expect(result!.value.linked_records[0]!.display_value).toBe('Acme Corp');
  });

  it('returns correct shape with multiple linked records', () => {
    const fieldValue = makeCrossLinkFieldValue({
      linked_records: [
        makeLinkedRecordEntry({ record_id: 'r001', display_value: 'Acme' }),
        makeLinkedRecordEntry({ record_id: 'r002', display_value: 'Globex' }),
      ],
    });
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: fieldValue,
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).not.toBeNull();
    expect(result!.value.linked_records).toHaveLength(2);
    expect(result!.value.linked_records[0]!.display_value).toBe('Acme');
    expect(result!.value.linked_records[1]!.display_value).toBe('Globex');
  });

  it('returns correct shape with empty linked_records array', () => {
    const fieldValue = makeCrossLinkFieldValue({ linked_records: [] });
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: fieldValue,
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).not.toBeNull();
    expect(result!.value.linked_records).toHaveLength(0);
  });

  it('returns null for missing field', () => {
    const canonicalData: Record<string, unknown> = {};

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for null field value', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: null,
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for wrong type (text field)', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: { type: 'text', value: 'hello' },
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for primitive value', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: 'just a string',
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for malformed data (missing value property)', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: { type: 'cross_link' },
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for malformed data (value is not an object)', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: { type: 'cross_link', value: 'not-an-object' },
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for malformed data (missing cross_link_id)', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: {
        type: 'cross_link',
        value: { linked_records: [] },
      },
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for malformed data (linked_records is not an array)', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: {
        type: 'cross_link',
        value: { linked_records: 'not-array', cross_link_id: CROSS_LINK_ID },
      },
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });

  it('returns null for malformed data (cross_link_id is not a string)', () => {
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: {
        type: 'cross_link',
        value: { linked_records: [], cross_link_id: 123 },
      },
    };

    const result = extractCrossLinkField(canonicalData, FIELD_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// setCrossLinkField
// ---------------------------------------------------------------------------

describe('setCrossLinkField', () => {
  it('sets a cross-link field value on empty canonical data', () => {
    const canonicalData: Record<string, unknown> = {};
    const fieldValue = makeCrossLinkFieldValue();

    const result = setCrossLinkField(canonicalData, FIELD_ID, fieldValue);

    expect(result[FIELD_ID]).toEqual(fieldValue);
  });

  it('merges correctly with existing non-cross-link fields', () => {
    const canonicalData: Record<string, unknown> = {
      [OTHER_FIELD_ID]: { type: 'text', value: 'existing text' },
    };
    const fieldValue = makeCrossLinkFieldValue();

    const result = setCrossLinkField(canonicalData, FIELD_ID, fieldValue);

    expect(result[FIELD_ID]).toEqual(fieldValue);
    expect(result[OTHER_FIELD_ID]).toEqual({ type: 'text', value: 'existing text' });
  });

  it('does not mutate the input canonical data', () => {
    const canonicalData: Record<string, unknown> = {
      [OTHER_FIELD_ID]: { type: 'text', value: 'keep me' },
    };
    const originalRef = { ...canonicalData };
    const fieldValue = makeCrossLinkFieldValue();

    const result = setCrossLinkField(canonicalData, FIELD_ID, fieldValue);

    // Original object unchanged
    expect(canonicalData).toEqual(originalRef);
    expect(canonicalData[FIELD_ID]).toBeUndefined();
    // Result is a new object
    expect(result).not.toBe(canonicalData);
    expect(result[FIELD_ID]).toEqual(fieldValue);
  });

  it('overwrites existing cross-link field value', () => {
    const oldValue = makeCrossLinkFieldValue({
      linked_records: [makeLinkedRecordEntry({ display_value: 'Old Corp' })],
      cross_link_id: 'old-link-id',
    });
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: oldValue,
    };

    const newValue = makeCrossLinkFieldValue({
      linked_records: [
        makeLinkedRecordEntry({ display_value: 'New Corp', record_id: 'r-new' }),
      ],
      cross_link_id: 'new-link-id',
    });

    const result = setCrossLinkField(canonicalData, FIELD_ID, newValue);

    expect(result[FIELD_ID]).toEqual(newValue);
    expect((result[FIELD_ID] as CrossLinkFieldValue).value.cross_link_id).toBe('new-link-id');
    expect(
      (result[FIELD_ID] as CrossLinkFieldValue).value.linked_records[0]!.display_value,
    ).toBe('New Corp');
  });

  it('preserves all other fields when overwriting', () => {
    const existingCrossLink = makeCrossLinkFieldValue();
    const canonicalData: Record<string, unknown> = {
      [FIELD_ID]: existingCrossLink,
      [OTHER_FIELD_ID]: { type: 'number', value: 42 },
    };

    const newValue = makeCrossLinkFieldValue({ linked_records: [] });
    const result = setCrossLinkField(canonicalData, FIELD_ID, newValue);

    expect(result[FIELD_ID]).toEqual(newValue);
    expect(result[OTHER_FIELD_ID]).toEqual({ type: 'number', value: 42 });
  });
});
