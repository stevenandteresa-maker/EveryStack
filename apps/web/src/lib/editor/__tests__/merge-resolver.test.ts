/**
 * Tests for merge-tag resolution service.
 *
 * @see docs/reference/smart-docs.md § Rendering Pipelines
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import {
  resolveMergeTags,
  resolveAndRenderHTML,
  formatCanonicalValue,
} from '../merge-resolver';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/data/records', () => ({
  getRecordById: vi.fn(),
}));

vi.mock('@/data/fields', () => ({
  getFieldsByTable: vi.fn(),
}));

vi.mock('@/data/cross-links', () => ({
  listCrossLinkDefinitions: vi.fn(),
}));

vi.mock('@/data/cross-link-resolution', () => ({
  resolveLinkedRecordsL1: vi.fn(),
}));

vi.mock('@tiptap/html', () => ({
  generateHTML: vi.fn((_content: JSONContent) => '<p>rendered</p>'),
}));

vi.mock('@/components/editor/extensions', () => ({
  createSmartDocExtensions: vi.fn(() => []),
}));

import { getRecordById } from '@/data/records';
import { getFieldsByTable } from '@/data/fields';
import { listCrossLinkDefinitions } from '@/data/cross-links';
import { resolveLinkedRecordsL1 } from '@/data/cross-link-resolution';
import { generateHTML } from '@tiptap/html';

const mockGetRecordById = vi.mocked(getRecordById);
const mockGetFieldsByTable = vi.mocked(getFieldsByTable);
const mockListCrossLinks = vi.mocked(listCrossLinkDefinitions);
const mockResolveL1 = vi.mocked(resolveLinkedRecordsL1);
const mockGenerateHTML = vi.mocked(generateHTML);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_ID = '01234567-0000-0000-0000-000000000001';
const RECORD_ID = '01234567-0000-0000-0000-000000000010';
const TABLE_ID = '01234567-0000-0000-0000-000000000100';
const LINKED_TABLE_ID = '01234567-0000-0000-0000-000000000200';
const FIELD_TEXT_ID = '01234567-0000-0000-0000-000000001000';
const FIELD_NUMBER_ID = '01234567-0000-0000-0000-000000002000';
const _FIELD_DATE_ID = '01234567-0000-0000-0000-000000003000';
const LINKED_FIELD_ID = '01234567-0000-0000-0000-000000004000';
const CROSS_LINK_ID = '01234567-0000-0000-0000-000000005000';
const LINKED_RECORD_ID = '01234567-0000-0000-0000-000000006000';

function makeField(id: string, fieldType: string, name: string) {
  return {
    id,
    tenantId: TENANT_ID,
    tableId: TABLE_ID,
    fieldType,
    name,
    sortOrder: 0,
    config: {},
    isPrimary: false,
    platformFieldId: null,
    permissions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRecord(
  id: string,
  tableId: string,
  canonicalData: Record<string, unknown>,
) {
  return {
    id,
    tenantId: TENANT_ID,
    tableId,
    canonicalData,
    syncMetadata: {},
    platformRecordId: null,
    baseConnectionId: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// formatCanonicalValue
// ---------------------------------------------------------------------------

describe('formatCanonicalValue', () => {
  it('formats text values', () => {
    expect(formatCanonicalValue({ value: 'hello' }, 'text')).toBe('hello');
  });

  it('formats number values', () => {
    const result = formatCanonicalValue({ value: 1234.5 }, 'number');
    expect(result).toContain('1');
    expect(result).toContain('234');
  });

  it('formats currency values', () => {
    const result = formatCanonicalValue(
      { value: 99.99, currency: 'USD' },
      'currency',
    );
    expect(result).toContain('99.99');
  });

  it('formats percent values', () => {
    expect(formatCanonicalValue({ value: 75 }, 'percent')).toBe('75%');
  });

  it('formats date values', () => {
    const result = formatCanonicalValue(
      { value: '2025-01-15T00:00:00Z' },
      'date',
    );
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });

  it('formats checkbox values', () => {
    expect(formatCanonicalValue({ value: true }, 'checkbox')).toBe('Yes');
    expect(formatCanonicalValue({ value: false }, 'checkbox')).toBe('No');
  });

  it('formats single_select values', () => {
    expect(
      formatCanonicalValue(
        { value: { id: '1', label: 'Active' } },
        'single_select',
      ),
    ).toBe('Active');
  });

  it('formats multiple_select values', () => {
    expect(
      formatCanonicalValue(
        {
          value: [
            { id: '1', label: 'A' },
            { id: '2', label: 'B' },
          ],
        },
        'multiple_select',
      ),
    ).toBe('A, B');
  });

  it('returns null for null entries', () => {
    expect(formatCanonicalValue(null, 'text')).toBeNull();
  });

  it('returns null for null value', () => {
    expect(formatCanonicalValue({ value: null }, 'text')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveMergeTags
// ---------------------------------------------------------------------------

describe('resolveMergeTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves simple fields from canonical_data', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {
        [FIELD_TEXT_ID]: { type: 'text', value: 'Acme Corp' },
        [FIELD_NUMBER_ID]: { type: 'number', value: 42 },
      }) as never,
    );

    mockGetFieldsByTable.mockResolvedValue([
      makeField(FIELD_TEXT_ID, 'text', 'Company'),
      makeField(FIELD_NUMBER_ID, 'number', 'Count'),
    ] as never);

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            {
              type: 'mergeTag',
              attrs: {
                tableId: TABLE_ID,
                fieldId: FIELD_TEXT_ID,
                fallback: 'N/A',
              },
            },
            { type: 'text', text: ', count: ' },
            {
              type: 'mergeTag',
              attrs: {
                tableId: TABLE_ID,
                fieldId: FIELD_NUMBER_ID,
                fallback: '0',
              },
            },
          ],
        },
      ],
    };

    const result = await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    // Verify merge tags were replaced with text nodes
    const para = result.content![0]!;
    expect(para.content).toHaveLength(4);
    expect(para.content![0]).toEqual({ type: 'text', text: 'Hello ' });
    expect(para.content![1]).toEqual({ type: 'text', text: 'Acme Corp' });
    expect(para.content![2]).toEqual({ type: 'text', text: ', count: ' });
    // Number formatting includes locale separators
    expect(para.content![3]!.type).toBe('text');
    expect(para.content![3]!.text).toContain('42');
  });

  it('resolves linked fields via cross-link L1', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {}) as never,
    );

    mockGetFieldsByTable
      .mockResolvedValueOnce([] as never) // source table fields
      .mockResolvedValueOnce([
        makeField(LINKED_FIELD_ID, 'text', 'Client Name'),
      ] as never); // linked table fields

    mockListCrossLinks.mockResolvedValue([
      {
        id: CROSS_LINK_ID,
        tenantId: TENANT_ID,
        sourceTableId: TABLE_ID,
        targetTableId: LINKED_TABLE_ID,
        sourceFieldId: 'f1',
        targetFieldId: 'f2',
        cardFields: [],
        maxDepth: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as never);

    mockResolveL1.mockResolvedValue({
      records: [
        {
          record: makeRecord(LINKED_RECORD_ID, LINKED_TABLE_ID, {
            [LINKED_FIELD_ID]: { type: 'text', value: 'Jane Doe' },
          }),
          crossLinkIndexCreatedAt: new Date(),
        },
      ],
      totalCount: 1,
    } as never);

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mergeTag',
              attrs: {
                tableId: LINKED_TABLE_ID,
                fieldId: LINKED_FIELD_ID,
                fallback: 'Unknown',
              },
            },
          ],
        },
      ],
    };

    const result = await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    const para = result.content![0]!;
    expect(para.content![0]).toEqual({ type: 'text', text: 'Jane Doe' });
  });

  it('uses fallback when field value is null', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {
        [FIELD_TEXT_ID]: { type: 'text', value: null },
      }) as never,
    );

    mockGetFieldsByTable.mockResolvedValue([
      makeField(FIELD_TEXT_ID, 'text', 'Company'),
    ] as never);

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mergeTag',
              attrs: {
                tableId: TABLE_ID,
                fieldId: FIELD_TEXT_ID,
                fallback: 'N/A',
              },
            },
          ],
        },
      ],
    };

    const result = await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    const para = result.content![0]!;
    expect(para.content![0]).toEqual({ type: 'text', text: 'N/A' });
  });

  it('uses empty string when value is null and no fallback', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {}) as never,
    );

    mockGetFieldsByTable.mockResolvedValue([
      makeField(FIELD_TEXT_ID, 'text', 'Company'),
    ] as never);

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mergeTag',
              attrs: {
                tableId: TABLE_ID,
                fieldId: FIELD_TEXT_ID,
                fallback: '',
              },
            },
          ],
        },
      ],
    };

    const result = await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    const para = result.content![0]!;
    expect(para.content![0]).toEqual({ type: 'text', text: '' });
  });

  it('preserves non-mergeTag nodes', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {}) as never,
    );
    mockGetFieldsByTable.mockResolvedValue([] as never);

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello world' },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            { type: 'text', text: 'Title' },
          ],
        },
      ],
    };

    const result = await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    // Structure preserved
    expect(result.content).toHaveLength(2);
    expect(result.content![0]!.type).toBe('paragraph');
    expect(result.content![0]!.content![0]).toEqual({
      type: 'text',
      text: 'Hello world',
    });
    expect(result.content![1]!.type).toBe('heading');
    expect(result.content![1]!.attrs).toEqual({ level: 1 });
  });

  it('does not mutate the original content', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {
        [FIELD_TEXT_ID]: { type: 'text', value: 'Resolved' },
      }) as never,
    );
    mockGetFieldsByTable.mockResolvedValue([
      makeField(FIELD_TEXT_ID, 'text', 'Company'),
    ] as never);

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mergeTag',
              attrs: {
                tableId: TABLE_ID,
                fieldId: FIELD_TEXT_ID,
                fallback: 'N/A',
              },
            },
          ],
        },
      ],
    };

    await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    // Original should still have mergeTag
    expect(content.content![0]!.content![0]!.type).toBe('mergeTag');
  });

  it('returns content unchanged when no merge tags exist', async () => {
    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'No tags here' }],
        },
      ],
    };

    const result = await resolveMergeTags(content, RECORD_ID, TENANT_ID);

    expect(result.content![0]!.content![0]!.text).toBe('No tags here');
    // Should not call any data functions
    expect(mockGetRecordById).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resolveAndRenderHTML
// ---------------------------------------------------------------------------

describe('resolveAndRenderHTML', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves merge tags and returns HTML', async () => {
    mockGetRecordById.mockResolvedValue(
      makeRecord(RECORD_ID, TABLE_ID, {
        [FIELD_TEXT_ID]: { type: 'text', value: 'Test' },
      }) as never,
    );
    mockGetFieldsByTable.mockResolvedValue([
      makeField(FIELD_TEXT_ID, 'text', 'Name'),
    ] as never);

    mockGenerateHTML.mockReturnValue('<p>Test</p>');

    const content: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'mergeTag',
              attrs: {
                tableId: TABLE_ID,
                fieldId: FIELD_TEXT_ID,
                fallback: '',
              },
            },
          ],
        },
      ],
    };

    const html = await resolveAndRenderHTML(content, RECORD_ID, TENANT_ID);

    expect(html).toBe('<p>Test</p>');
    expect(mockGenerateHTML).toHaveBeenCalledTimes(1);

    // The resolved content passed to generateHTML should have text nodes, not mergeTags
    const resolvedContent = mockGenerateHTML.mock.calls[0]![0] as JSONContent;
    expect(resolvedContent.content![0]!.content![0]!.type).toBe('text');
    expect(resolvedContent.content![0]!.content![0]!.text).toBe('Test');
  });
});
