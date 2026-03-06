import { describe, it, expect } from 'vitest';
import {
  canonicalFieldExpression,
  canonicalFieldExists,
  canonicalFieldOrderBy,
  QUERYABLE_FIELD_TYPES,
} from '../query-helpers';
import type { QueryableFieldType, SortDirection } from '../query-helpers';
import type { SQL } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helper to recursively extract raw SQL string from a Drizzle SQL fragment.
// Drizzle SQL objects nest: a `sql` template containing another `sql` object
// stores the inner SQL as a chunk. We must recursively flatten these.
// ---------------------------------------------------------------------------

function toSqlString(fragment: SQL): string {
  const chunks = (fragment as unknown as { queryChunks: unknown[] }).queryChunks;
  if (!chunks) return String(fragment);

  return chunks
    .map((chunk: unknown) => {
      if (typeof chunk === 'string') return chunk;
      // Nested SQL object — recurse
      if (
        typeof chunk === 'object' &&
        chunk !== null &&
        'queryChunks' in chunk
      ) {
        return toSqlString(chunk as SQL);
      }
      // Drizzle param wrapper: { value: [...] }
      if (
        typeof chunk === 'object' &&
        chunk !== null &&
        'value' in chunk
      ) {
        const values = (chunk as { value: unknown[] }).value;
        return Array.isArray(values) ? values.map(String).join('') : String(values);
      }
      return String(chunk);
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const FIELD_ID = '01912345-6789-7abc-8def-0123456789ef';

// ---------------------------------------------------------------------------
// QUERYABLE_FIELD_TYPES
// ---------------------------------------------------------------------------

describe('QUERYABLE_FIELD_TYPES', () => {
  it('contains exactly the 5 supported types', () => {
    expect(QUERYABLE_FIELD_TYPES).toEqual([
      'text',
      'number',
      'date',
      'single_select',
      'checkbox',
    ]);
  });
});

// ---------------------------------------------------------------------------
// canonicalFieldExpression
// ---------------------------------------------------------------------------

describe('canonicalFieldExpression', () => {
  it('returns text extraction for text fields', () => {
    const expr = canonicalFieldExpression(FIELD_ID, 'text');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`canonical_data->'${FIELD_ID}'->>'value'`);
    expect(sqlStr).not.toContain('::');
  });

  it('returns text extraction for single_select fields', () => {
    const expr = canonicalFieldExpression(FIELD_ID, 'single_select');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`canonical_data->'${FIELD_ID}'->>'value'`);
    expect(sqlStr).not.toContain('::');
  });

  it('returns numeric cast for number fields', () => {
    const expr = canonicalFieldExpression(FIELD_ID, 'number');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`canonical_data->'${FIELD_ID}'->>'value'`);
    expect(sqlStr).toContain('::numeric');
  });

  it('returns timestamptz cast for date fields', () => {
    const expr = canonicalFieldExpression(FIELD_ID, 'date');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`canonical_data->'${FIELD_ID}'->>'value'`);
    expect(sqlStr).toContain('::timestamptz');
  });

  it('returns boolean cast for checkbox fields', () => {
    const expr = canonicalFieldExpression(FIELD_ID, 'checkbox');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`canonical_data->'${FIELD_ID}'->>'value'`);
    expect(sqlStr).toContain('::boolean');
  });

  it('returns a SQL object for all supported types', () => {
    for (const fieldType of QUERYABLE_FIELD_TYPES) {
      const expr = canonicalFieldExpression(FIELD_ID, fieldType);
      expect(expr).toBeDefined();
      expect(toSqlString(expr)).toContain(FIELD_ID);
    }
  });
});

// ---------------------------------------------------------------------------
// canonicalFieldExists
// ---------------------------------------------------------------------------

describe('canonicalFieldExists', () => {
  it('returns IS NOT NULL check for the field', () => {
    const expr = canonicalFieldExists(FIELD_ID);
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`canonical_data->'${FIELD_ID}' IS NOT NULL`);
  });
});

// ---------------------------------------------------------------------------
// canonicalFieldOrderBy
// ---------------------------------------------------------------------------

describe('canonicalFieldOrderBy', () => {
  it('defaults to ASC direction', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'text');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain('ASC');
    expect(sqlStr).toContain('NULLS LAST');
  });

  it('supports DESC direction', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'text', 'desc');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain('DESC');
    expect(sqlStr).toContain('NULLS LAST');
  });

  it('applies numeric cast for number fields in ORDER BY', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'number', 'asc');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain('::numeric');
    expect(sqlStr).toContain('ASC');
  });

  it('applies timestamptz cast for date fields in ORDER BY', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'date', 'desc');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain('::timestamptz');
    expect(sqlStr).toContain('DESC');
  });

  it('applies boolean cast for checkbox fields in ORDER BY', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'checkbox', 'asc');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain('::boolean');
    expect(sqlStr).toContain('ASC');
  });

  it('does not apply cast for text fields in ORDER BY', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'text', 'asc');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`->>'value'`);
    expect(sqlStr).not.toContain('::numeric');
    expect(sqlStr).not.toContain('::timestamptz');
    expect(sqlStr).not.toContain('::boolean');
  });

  it('does not apply cast for single_select fields in ORDER BY', () => {
    const expr = canonicalFieldOrderBy(FIELD_ID, 'single_select', 'desc');
    const sqlStr = toSqlString(expr);
    expect(sqlStr).toContain(`->>'value'`);
    expect(sqlStr).not.toContain('::numeric');
    expect(sqlStr).not.toContain('::timestamptz');
    expect(sqlStr).not.toContain('::boolean');
  });

  it.each([
    ['text', 'asc'],
    ['text', 'desc'],
    ['number', 'asc'],
    ['number', 'desc'],
    ['date', 'asc'],
    ['date', 'desc'],
    ['single_select', 'asc'],
    ['single_select', 'desc'],
    ['checkbox', 'asc'],
    ['checkbox', 'desc'],
  ] as [QueryableFieldType, SortDirection][])('produces valid SQL for %s/%s', (fieldType, direction) => {
    const expr = canonicalFieldOrderBy(FIELD_ID, fieldType, direction);
    const sqlStr = toSqlString(expr);

    // Must include field reference, direction, and NULLS LAST
    expect(sqlStr).toContain(FIELD_ID);
    expect(sqlStr).toContain(direction.toUpperCase());
    expect(sqlStr).toContain('NULLS LAST');
  });
});
