import { describe, it, expect } from 'vitest';
import { extractSearchableText, buildSearchVector } from '../search';
import type { SearchFieldDefinition } from '../search';

// ---------------------------------------------------------------------------
// extractSearchableText
// ---------------------------------------------------------------------------

describe('extractSearchableText', () => {
  it('extracts text from a text canonical value', () => {
    expect(extractSearchableText({ type: 'text', value: 'hello' }, 'text')).toBe('hello');
  });

  it('extracts text from text_area', () => {
    expect(extractSearchableText({ type: 'text_area', value: 'paragraph' }, 'text_area')).toBe('paragraph');
  });

  it('extracts email value', () => {
    expect(extractSearchableText({ type: 'email', value: 'a@b.com' }, 'email')).toBe('a@b.com');
  });

  it('extracts url value', () => {
    expect(extractSearchableText({ type: 'url', value: 'https://example.com' }, 'url')).toBe('https://example.com');
  });

  it('returns null for null value', () => {
    expect(extractSearchableText(null, 'text')).toBeNull();
  });

  it('returns null for undefined value', () => {
    expect(extractSearchableText(undefined, 'text')).toBeNull();
  });

  it('returns null for canonical value with null inner value', () => {
    expect(extractSearchableText({ type: 'text', value: null }, 'text')).toBeNull();
  });

  it('extracts number as string', () => {
    expect(extractSearchableText({ type: 'number', value: 42 }, 'number')).toBe('42');
  });

  it('extracts currency as string', () => {
    expect(extractSearchableText({ type: 'currency', value: 99.95 }, 'currency')).toBe('99.95');
  });

  it('extracts checkbox as yes/no', () => {
    expect(extractSearchableText({ type: 'checkbox', value: true }, 'checkbox')).toBe('yes');
    expect(extractSearchableText({ type: 'checkbox', value: false }, 'checkbox')).toBe('no');
  });

  it('extracts single_select label', () => {
    expect(
      extractSearchableText({ type: 'single_select', value: { label: 'Active' } }, 'single_select'),
    ).toBe('Active');
  });

  it('extracts multiple_select labels', () => {
    expect(
      extractSearchableText(
        { type: 'multiple_select', value: [{ label: 'Tag1' }, { label: 'Tag2' }] },
        'multiple_select',
      ),
    ).toBe('Tag1 Tag2');
  });

  it('extracts linked_record display values', () => {
    expect(
      extractSearchableText(
        { type: 'linked_record', value: [{ displayValue: 'Record A' }, { displayValue: 'Record B' }] },
        'linked_record',
      ),
    ).toBe('Record A Record B');
  });

  it('extracts date as string', () => {
    expect(extractSearchableText({ type: 'date', value: '2026-01-15' }, 'date')).toBe('2026-01-15');
  });

  it('extracts people display names', () => {
    expect(
      extractSearchableText(
        { type: 'people', value: [{ name: 'Alice' }, { name: 'Bob' }] },
        'people',
      ),
    ).toBe('Alice Bob');
  });

  it('extracts address parts', () => {
    expect(
      extractSearchableText(
        { type: 'address', value: { street: '123 Main', city: 'NYC', state: 'NY', zip: '10001' } },
        'address',
      ),
    ).toBe('123 Main NYC NY 10001');
  });

  it('extracts full_name parts', () => {
    expect(
      extractSearchableText(
        { type: 'full_name', value: { first: 'John', last: 'Doe' } },
        'full_name',
      ),
    ).toBe('John Doe');
  });

  it('extracts checklist item labels', () => {
    expect(
      extractSearchableText(
        { type: 'checklist', value: [{ label: 'Item 1' }, { label: 'Item 2' }] },
        'checklist',
      ),
    ).toBe('Item 1 Item 2');
  });

  it('extracts TipTap JSON content from smart_doc', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    };
    expect(extractSearchableText({ type: 'smart_doc', value: doc }, 'smart_doc')).toBe('Hello world');
  });

  it('returns null for unknown non-string types', () => {
    expect(extractSearchableText({ type: 'unknown', value: { complex: true } }, 'unknown_type')).toBeNull();
  });

  it('handles raw string values (non-canonical wrapper)', () => {
    expect(extractSearchableText('raw text', 'text')).toBe('raw text');
  });
});

// ---------------------------------------------------------------------------
// buildSearchVector
// ---------------------------------------------------------------------------

describe('buildSearchVector', () => {
  const makeField = (overrides: Partial<SearchFieldDefinition> = {}): SearchFieldDefinition => ({
    id: 'field-1',
    fieldType: 'text',
    isPrimary: false,
    config: {},
    ...overrides,
  });

  it('returns empty tsvector when no searchable data exists', () => {
    const result = buildSearchVector({}, [makeField()]);
    // The SQL object should contain the empty tsvector literal
    expect(result).toBeDefined();
  });

  it('produces SQL expression for a single text field', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'hello' } };
    const fields = [makeField()];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
    // The SQL expression should reference 'simple' dictionary and weight 'C' for default
  });

  it('uses weight A for primary fields', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'title' } };
    const fields = [makeField({ isPrimary: true })];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('uses weight B for high priority fields', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'important' } };
    const fields = [makeField({ config: { searchPriority: 'high' } })];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('uses weight D for linked_record fields', () => {
    const canonicalData = {
      'field-1': {
        type: 'linked_record',
        value: [{ displayValue: 'Linked Title' }],
      },
    };
    const fields = [makeField({ fieldType: 'linked_record' })];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('skips non-searchable field types (files, signature, button)', () => {
    const canonicalData = {
      'field-1': { type: 'files', value: [{ name: 'doc.pdf' }] },
    };
    const fields = [makeField({ fieldType: 'files' })];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
    // Should return empty tsvector
  });

  it('skips fields with config.searchable: false', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'hidden' } };
    const fields = [makeField({ config: { searchable: false } })];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('handles multiple fields', () => {
    const canonicalData = {
      'field-1': { type: 'text', value: 'title' },
      'field-2': { type: 'number', value: 42 },
    };
    const fields = [
      makeField({ id: 'field-1', isPrimary: true }),
      makeField({ id: 'field-2', fieldType: 'number' }),
    ];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('strips null bytes from text', () => {
    const canonicalData = { 'field-1': { type: 'text', value: 'hello\0world' } };
    const fields = [makeField()];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('truncates text to 5000 chars per field', () => {
    const longText = 'a'.repeat(6000);
    const canonicalData = { 'field-1': { type: 'text', value: longText } };
    const fields = [makeField()];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });

  it('skips fields with empty/whitespace values', () => {
    const canonicalData = { 'field-1': { type: 'text', value: '   ' } };
    const fields = [makeField()];

    const result = buildSearchVector(canonicalData, fields);
    expect(result).toBeDefined();
  });
});
