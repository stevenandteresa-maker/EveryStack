/**
 * Notion Pipeline End-to-End Verification
 *
 * Integration checkpoint test: mock Notion API → inbound sync → canonical_data
 * populated → outbound edit → mock API receives correct payload.
 *
 * Verifies the full round-trip through the Notion adapter without touching
 * a real Notion API or database.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotionAdapter, registerNotionTransforms } from '../notion-adapter';
import { NotionApiClient, NOTION_API_URL } from '../api-client';
import { translateToNotionFilter } from '../notion-filter';
import { fieldTypeRegistry } from '../../../field-registry';
import type { FieldMapping } from '../../types';
import type { NotionPage, NotionRichText } from '../notion-types';
import type { CanonicalValue } from '../../../types';

// ---------------------------------------------------------------------------
// Mock logger
// ---------------------------------------------------------------------------

vi.mock('../../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRichText(content: string): NotionRichText {
  return {
    type: 'text',
    text: { content },
    annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
    plain_text: content,
    href: null,
  };
}

function makeNotionPage(id: string, properties: NotionPage['properties']): NotionPage {
  return {
    object: 'page',
    id,
    created_time: '2024-06-01T09:00:00.000Z',
    last_edited_time: '2024-06-01T12:00:00.000Z',
    created_by: { object: 'user', id: 'user-1' },
    last_edited_by: { object: 'user', id: 'user-2' },
    archived: false,
    properties,
    url: `https://www.notion.so/${id}`,
  };
}

/** Shared field mappings used across the full pipeline. */
const FIELD_MAPPINGS: FieldMapping[] = [
  { fieldId: 'f-title', externalFieldId: 'prop-title', fieldType: 'text', externalFieldType: 'title', config: {} },
  { fieldId: 'f-desc', externalFieldId: 'prop-desc', fieldType: 'text_area', externalFieldType: 'rich_text', config: {} },
  { fieldId: 'f-count', externalFieldId: 'prop-count', fieldType: 'number', externalFieldType: 'number', config: {} },
  { fieldId: 'f-done', externalFieldId: 'prop-done', fieldType: 'checkbox', externalFieldType: 'checkbox', config: {} },
  { fieldId: 'f-status', externalFieldId: 'prop-status', fieldType: 'single_select', externalFieldType: 'select', config: {} },
  { fieldId: 'f-date', externalFieldId: 'prop-date', fieldType: 'date', externalFieldType: 'date', config: {} },
  { fieldId: 'f-email', externalFieldId: 'prop-email', fieldType: 'email', externalFieldType: 'email', config: {} },
  { fieldId: 'f-url', externalFieldId: 'prop-url', fieldType: 'url', externalFieldType: 'url', config: {} },
  { fieldId: 'f-formula', externalFieldId: 'prop-formula', fieldType: 'text', externalFieldType: 'formula', config: {} },
  { fieldId: 'f-created', externalFieldId: 'prop-created', fieldType: 'created_at', externalFieldType: 'created_time', config: {} },
];

/** A realistic Notion page matching the field mappings. */
const NOTION_PAGE = makeNotionPage('page-abc-123', {
  Name: {
    id: 'prop-title',
    type: 'title',
    title: [makeRichText('Acme Corp Project')],
  },
  Description: {
    id: 'prop-desc',
    type: 'rich_text',
    rich_text: [makeRichText('Important client project')],
  },
  Count: {
    id: 'prop-count',
    type: 'number',
    number: 42,
  },
  Done: {
    id: 'prop-done',
    type: 'checkbox',
    checkbox: false,
  },
  Status: {
    id: 'prop-status',
    type: 'select',
    select: { id: 'opt-active', name: 'Active', color: 'green' },
  },
  'Due Date': {
    id: 'prop-date',
    type: 'date',
    date: { start: '2024-06-15', end: null, time_zone: null },
  },
  Email: {
    id: 'prop-email',
    type: 'email',
    email: 'contact@acme.com',
  },
  Website: {
    id: 'prop-url',
    type: 'url',
    url: 'https://acme.com',
  },
  'Computed Score': {
    id: 'prop-formula',
    type: 'formula',
    formula: { type: 'number', number: 95 },
  },
  'Created': {
    id: 'prop-created',
    type: 'created_time',
    created_time: '2024-06-01T09:00:00.000Z',
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Notion Pipeline E2E', () => {
  let adapter: NotionAdapter;

  beforeEach(() => {
    fieldTypeRegistry.clear();
    registerNotionTransforms();
    adapter = new NotionAdapter();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Step 1: Mock Notion API → inbound sync → canonical_data populated', () => {
    it('transforms a full Notion page response into canonical_data', () => {
      // Simulate the inbound sync: Notion API returns pages, adapter converts
      const mockApiResponse = {
        object: 'list' as const,
        results: [NOTION_PAGE],
        has_more: false,
        next_cursor: null,
      };

      // Process each page through adapter.toCanonical
      const canonical = adapter.toCanonical(mockApiResponse.results[0], FIELD_MAPPINGS);

      // Verify all writable fields are populated
      expect(canonical['f-title']).toEqual({ type: 'text', value: 'Acme Corp Project' });
      expect(canonical['f-desc']).toEqual({ type: 'text_area', value: 'Important client project' });
      expect(canonical['f-count']).toEqual({ type: 'number', value: 42 });
      expect(canonical['f-done']).toEqual({ type: 'checkbox', value: false });
      expect(canonical['f-email']).toEqual({ type: 'email', value: 'contact@acme.com' });
      expect(canonical['f-url']).toEqual({ type: 'url', value: 'https://acme.com' });

      // Verify select has source_refs
      const status = canonical['f-status'] as { type: string; value: { label: string; source_refs: unknown } };
      expect(status.type).toBe('single_select');
      expect(status.value.label).toBe('Active');
      expect(status.value.source_refs).toEqual({ notion: { option_id: 'opt-active', color: 'green' } });

      // Verify date
      expect(canonical['f-date']).toEqual({ type: 'date', value: '2024-06-15' });

      // Verify read-only fields are still captured inbound
      expect(canonical['f-formula']).toBeDefined();
      expect(canonical['f-created']).toBeDefined();
    });

    it('populates canonical_data keyed by ES field UUIDs, not Notion property names', () => {
      const canonical = adapter.toCanonical(NOTION_PAGE, FIELD_MAPPINGS);

      // Keys are ES field IDs
      expect(Object.keys(canonical)).toContain('f-title');
      expect(Object.keys(canonical)).toContain('f-desc');
      // Keys are NOT Notion property names
      expect(Object.keys(canonical)).not.toContain('Name');
      expect(Object.keys(canonical)).not.toContain('Description');
    });
  });

  describe('Step 2: Outbound edit → mock API receives correct payload', () => {
    it('converts user edits in canonical form back to Notion property format', () => {
      // User edits canonical_data (e.g., changes title and marks Done)
      const editedCanonical: Record<string, CanonicalValue> = {
        'f-title': { type: 'text', value: 'Acme Corp — Updated' },
        'f-count': { type: 'number', value: 100 },
        'f-done': { type: 'checkbox', value: true },
        'f-email': { type: 'email', value: 'new@acme.com' },
        'f-url': { type: 'url', value: 'https://acme.com/updated' },
      };

      const outbound = adapter.fromCanonical(editedCanonical, FIELD_MAPPINGS);

      // Verify Notion-native format
      expect(outbound['prop-title']).toEqual({
        title: [{ type: 'text', text: { content: 'Acme Corp — Updated' } }],
      });
      expect(outbound['prop-count']).toEqual({ number: 100 });
      expect(outbound['prop-done']).toEqual({ checkbox: true });
      expect(outbound['prop-email']).toEqual({ email: 'new@acme.com' });
      expect(outbound['prop-url']).toEqual({ url: 'https://acme.com/updated' });
    });

    it('skips read-only fields (formula, created_time) in outbound payload', () => {
      const canonical: Record<string, CanonicalValue> = {
        'f-title': { type: 'text', value: 'Test' },
        'f-formula': { type: 'number', value: 95 },
        'f-created': { type: 'created_at', value: '2024-06-01T09:00:00.000Z' },
      };

      const outbound = adapter.fromCanonical(canonical, FIELD_MAPPINGS);

      expect(outbound['prop-title']).toBeDefined();
      expect(outbound['prop-formula']).toBeUndefined();
      expect(outbound['prop-created']).toBeUndefined();
    });

    it('sends correct payload shape to mock Notion updatePage API', async () => {
      // Mock global fetch
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ object: 'page', id: 'page-abc-123' }), { status: 200 }),
      );

      const client = new NotionApiClient('ntn_test_token');
      const editedCanonical: Record<string, CanonicalValue> = {
        'f-title': { type: 'text', value: 'Final Title' },
        'f-count': { type: 'number', value: 200 },
      };

      const outboundProperties = adapter.fromCanonical(editedCanonical, FIELD_MAPPINGS);
      await client.updatePage('page-abc-123', outboundProperties);

      // Verify fetch was called with correct endpoint and payload
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const call = fetchSpy.mock.calls[0]!;
      const [url, options] = call;
      expect(url).toBe(`${NOTION_API_URL}/pages/page-abc-123`);
      expect(options?.method).toBe('PATCH');

      const body = JSON.parse(options?.body as string);
      expect(body.properties['prop-title']).toEqual({
        title: [{ type: 'text', text: { content: 'Final Title' } }],
      });
      expect(body.properties['prop-count']).toEqual({ number: 200 });
    });
  });

  describe('Step 3: Full round-trip data integrity', () => {
    it('inbound → canonical → outbound preserves all writable field values', () => {
      // Inbound: Notion page → canonical
      const canonical = adapter.toCanonical(NOTION_PAGE, FIELD_MAPPINGS);

      // Only keep writable fields (exclude formula, created_time)
      const writableMappings = FIELD_MAPPINGS.filter(
        m => !['formula', 'created_time'].includes(m.externalFieldType),
      );

      // Outbound: canonical → Notion properties
      const outbound = adapter.fromCanonical(canonical, writableMappings);

      // Verify round-trip integrity
      expect(outbound['prop-title']).toEqual({
        title: [{ type: 'text', text: { content: 'Acme Corp Project' } }],
      });
      expect(outbound['prop-desc']).toEqual({
        rich_text: [{ type: 'text', text: { content: 'Important client project' } }],
      });
      expect(outbound['prop-count']).toEqual({ number: 42 });
      expect(outbound['prop-done']).toEqual({ checkbox: false });
      expect(outbound['prop-email']).toEqual({ email: 'contact@acme.com' });
      expect(outbound['prop-url']).toEqual({ url: 'https://acme.com' });
      expect(outbound['prop-date']).toEqual({ date: { start: '2024-06-15' } });
    });

    it('mock Notion query → toCanonical → edit → fromCanonical → mock updatePage', async () => {
      // Mock fetch for both query and update
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            object: 'list',
            results: [NOTION_PAGE],
            has_more: false,
            next_cursor: null,
          }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ object: 'page', id: 'page-abc-123' }), { status: 200 }),
        );

      const client = new NotionApiClient('ntn_test_token');

      // Step 1: Query Notion database (simulates inbound sync)
      const queryResult = await client.queryDatabase('db-123');
      expect(queryResult.results).toHaveLength(1);

      // Step 2: Transform to canonical
      const canonical = adapter.toCanonical(queryResult.results[0] as unknown as NotionPage, FIELD_MAPPINGS);
      expect(canonical['f-title']).toEqual({ type: 'text', value: 'Acme Corp Project' });

      // Step 3: User edits in canonical space
      canonical['f-title'] = { type: 'text', value: 'Modified Title' };

      // Step 4: Transform back to Notion format
      const writableMappings = FIELD_MAPPINGS.filter(
        m => !['formula', 'created_time'].includes(m.externalFieldType),
      );
      const outbound = adapter.fromCanonical(canonical, writableMappings);

      // Step 5: Send update to Notion (simulates outbound sync)
      await client.updatePage('page-abc-123', outbound);

      // Verify the update call payload
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const updateBody = JSON.parse(fetchSpy.mock.calls[1]![1]?.body as string);
      expect(updateBody.properties['prop-title']).toEqual({
        title: [{ type: 'text', text: { content: 'Modified Title' } }],
      });
    });
  });

  describe('Step 4: Filter pushdown integration', () => {
    it('translates ES filter rules to Notion API filter format', () => {
      const filterMappings: FieldMapping[] = [
        { fieldId: 'f-status', externalFieldId: 'Status', fieldType: 'single_select', externalFieldType: 'select', config: {} },
        { fieldId: 'f-count', externalFieldId: 'Count', fieldType: 'number', externalFieldType: 'number', config: {} },
      ];

      const filter = translateToNotionFilter(
        [
          { fieldId: 'f-status', operator: 'equals', value: 'Active', conjunction: 'and' },
          { fieldId: 'f-count', operator: 'greater_than', value: 10, conjunction: 'and' },
        ],
        filterMappings,
      );

      expect(filter).toEqual({
        and: [
          { property: 'Status', select: { equals: 'Active' } },
          { property: 'Count', number: { greater_than: 10 } },
        ],
      });
    });
  });
});
