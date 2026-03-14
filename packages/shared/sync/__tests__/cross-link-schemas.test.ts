import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { CROSS_LINK_LIMITS } from '../cross-link-types';
import {
  createCrossLinkSchema,
  linkRecordsSchema,
  linkScopeFilterSchema,
  unlinkRecordsSchema,
  updateCrossLinkSchema,
} from '../cross-link-schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validCreateInput() {
  return {
    name: 'Project -> Client',
    sourceTableId: randomUUID(),
    sourceFieldId: randomUUID(),
    targetTableId: randomUUID(),
    targetDisplayFieldId: randomUUID(),
    relationshipType: 'many_to_one' as const,
  };
}

// ---------------------------------------------------------------------------
// createCrossLinkSchema
// ---------------------------------------------------------------------------

describe('createCrossLinkSchema', () => {
  it('accepts valid minimal input', () => {
    const result = createCrossLinkSchema.safeParse(validCreateInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cardFields).toEqual([]);
      expect(result.data.maxLinksPerRecord).toBe(CROSS_LINK_LIMITS.DEFAULT_LINKS_PER_RECORD);
      expect(result.data.maxDepth).toBe(CROSS_LINK_LIMITS.DEFAULT_DEPTH);
    }
  });

  it('accepts valid full input', () => {
    const input = {
      ...validCreateInput(),
      reverseFieldId: randomUUID(),
      linkScopeFilter: {
        conditions: [{ field_id: randomUUID(), operator: 'eq' as const, value: 'Active' }],
        logic: 'and' as const,
      },
      cardFields: [randomUUID(), randomUUID()],
      maxLinksPerRecord: 100,
      maxDepth: 4,
    };
    const result = createCrossLinkSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = createCrossLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const { name: _, ...input } = validCreateInput();
    const result = createCrossLinkSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createCrossLinkSchema.safeParse({ ...validCreateInput(), name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name over 255 chars', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      name: 'x'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid relationship type', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      relationshipType: 'many_to_many',
    });
    expect(result.success).toBe(false);
  });

  it('accepts one_to_many relationship type', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      relationshipType: 'one_to_many',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid sourceTableId', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      sourceTableId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  // Boundary: maxLinksPerRecord
  it('rejects maxLinksPerRecord of 0', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxLinksPerRecord: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts maxLinksPerRecord of 1', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxLinksPerRecord: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts maxLinksPerRecord of 500', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxLinksPerRecord: 500,
    });
    expect(result.success).toBe(true);
  });

  it('rejects maxLinksPerRecord of 501', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxLinksPerRecord: 501,
    });
    expect(result.success).toBe(false);
  });

  // Boundary: maxDepth
  it('rejects maxDepth of 0', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxDepth: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts maxDepth of 1', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxDepth: 1,
    });
    expect(result.success).toBe(true);
  });

  it('accepts maxDepth of 5', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxDepth: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects maxDepth of 6', () => {
    const result = createCrossLinkSchema.safeParse({
      ...validCreateInput(),
      maxDepth: 6,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linkScopeFilterSchema
// ---------------------------------------------------------------------------

describe('linkScopeFilterSchema', () => {
  it('accepts valid filter with conditions', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [
        { field_id: randomUUID(), operator: 'eq', value: 'Active' },
        { field_id: randomUUID(), operator: 'in', value: ['A', 'B'] },
      ],
      logic: 'and',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty conditions array', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [],
      logic: 'or',
    });
    expect(result.success).toBe(true);
  });

  it('accepts is_empty without value', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [{ field_id: randomUUID(), operator: 'is_empty' }],
      logic: 'and',
    });
    expect(result.success).toBe(true);
  });

  it('accepts is_not_empty without value', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [{ field_id: randomUUID(), operator: 'is_not_empty' }],
      logic: 'and',
    });
    expect(result.success).toBe(true);
  });

  it('validates all supported operators', () => {
    const operators = ['eq', 'neq', 'in', 'not_in', 'contains', 'is_empty', 'is_not_empty'];
    for (const op of operators) {
      const result = linkScopeFilterSchema.safeParse({
        conditions: [{ field_id: randomUUID(), operator: op, value: 'test' }],
        logic: 'and',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid operator', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [{ field_id: randomUUID(), operator: 'greater_than', value: 5 }],
      logic: 'and',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid logic value', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [],
      logic: 'xor',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-uuid field_id', () => {
    const result = linkScopeFilterSchema.safeParse({
      conditions: [{ field_id: 'bad-id', operator: 'eq', value: 'x' }],
      logic: 'and',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// linkRecordsSchema
// ---------------------------------------------------------------------------

describe('linkRecordsSchema', () => {
  it('accepts valid input', () => {
    const result = linkRecordsSchema.safeParse({
      crossLinkId: randomUUID(),
      sourceRecordId: randomUUID(),
      targetRecordIds: [randomUUID()],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty targetRecordIds', () => {
    const result = linkRecordsSchema.safeParse({
      crossLinkId: randomUUID(),
      sourceRecordId: randomUUID(),
      targetRecordIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 500 targetRecordIds', () => {
    const ids = Array.from({ length: 501 }, () => randomUUID());
    const result = linkRecordsSchema.safeParse({
      crossLinkId: randomUUID(),
      sourceRecordId: randomUUID(),
      targetRecordIds: ids,
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 500 targetRecordIds', () => {
    const ids = Array.from({ length: 500 }, () => randomUUID());
    const result = linkRecordsSchema.safeParse({
      crossLinkId: randomUUID(),
      sourceRecordId: randomUUID(),
      targetRecordIds: ids,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// unlinkRecordsSchema
// ---------------------------------------------------------------------------

describe('unlinkRecordsSchema', () => {
  it('accepts valid input', () => {
    const result = unlinkRecordsSchema.safeParse({
      crossLinkId: randomUUID(),
      sourceRecordId: randomUUID(),
      targetRecordIds: [randomUUID()],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty targetRecordIds', () => {
    const result = unlinkRecordsSchema.safeParse({
      crossLinkId: randomUUID(),
      sourceRecordId: randomUUID(),
      targetRecordIds: [],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCrossLinkSchema
// ---------------------------------------------------------------------------

describe('updateCrossLinkSchema', () => {
  it('accepts single field update', () => {
    const result = updateCrossLinkSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts multiple field updates', () => {
    const result = updateCrossLinkSchema.safeParse({
      name: 'New Name',
      maxLinksPerRecord: 100,
      maxDepth: 4,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty object (no fields)', () => {
    const result = updateCrossLinkSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts nullable reverseFieldId', () => {
    const result = updateCrossLinkSchema.safeParse({ reverseFieldId: null });
    expect(result.success).toBe(true);
  });

  it('accepts nullable linkScopeFilter', () => {
    const result = updateCrossLinkSchema.safeParse({ linkScopeFilter: null });
    expect(result.success).toBe(true);
  });

  it('rejects invalid maxLinksPerRecord in update', () => {
    const result = updateCrossLinkSchema.safeParse({ maxLinksPerRecord: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects invalid maxDepth in update', () => {
    const result = updateCrossLinkSchema.safeParse({ maxDepth: 6 });
    expect(result.success).toBe(false);
  });
});
