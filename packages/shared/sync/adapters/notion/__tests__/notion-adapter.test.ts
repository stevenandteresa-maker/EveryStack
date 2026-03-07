import { describe, it, expect, beforeEach } from 'vitest';
import { NotionAdapter, registerNotionTransforms } from '../index';
import { fieldTypeRegistry } from '../../../field-registry';
import type { FieldMapping } from '../../types';
import type { NotionPage, NotionRichText } from '../notion-types';

function makeRichText(content: string): NotionRichText {
  return {
    type: 'text',
    text: { content },
    annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
    plain_text: content,
    href: null,
  };
}

function makeNotionPage(properties: NotionPage['properties']): NotionPage {
  return {
    object: 'page',
    id: 'page-id-1',
    created_time: '2024-03-15T10:00:00.000Z',
    last_edited_time: '2024-03-15T14:00:00.000Z',
    created_by: { object: 'user', id: 'user-1' },
    last_edited_by: { object: 'user', id: 'user-2' },
    archived: false,
    properties,
    url: 'https://www.notion.so/page-id-1',
  };
}

describe('NotionAdapter', () => {
  let adapter: NotionAdapter;

  beforeEach(() => {
    fieldTypeRegistry.clear();
    registerNotionTransforms();
    adapter = new NotionAdapter();
  });

  it('has platform set to notion', () => {
    expect(adapter.platform).toBe('notion');
  });

  describe('toCanonical', () => {
    it('transforms a Notion page with multiple properties', () => {
      const page = makeNotionPage({
        Name: {
          id: 'title_prop',
          type: 'title',
          title: [makeRichText('Test Record')],
        },
        Description: {
          id: 'desc_prop',
          type: 'rich_text',
          rich_text: [makeRichText('A description')],
        },
        Count: {
          id: 'num_prop',
          type: 'number',
          number: 42,
        },
        Done: {
          id: 'check_prop',
          type: 'checkbox',
          checkbox: true,
        },
      });

      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'title_prop',
          fieldType: 'text',
          externalFieldType: 'title',
          config: {},
        },
        {
          fieldId: 'es-field-2',
          externalFieldId: 'desc_prop',
          fieldType: 'text_area',
          externalFieldType: 'rich_text',
          config: {},
        },
        {
          fieldId: 'es-field-3',
          externalFieldId: 'num_prop',
          fieldType: 'number',
          externalFieldType: 'number',
          config: {},
        },
        {
          fieldId: 'es-field-4',
          externalFieldId: 'check_prop',
          fieldType: 'checkbox',
          externalFieldType: 'checkbox',
          config: {},
        },
      ];

      const result = adapter.toCanonical(page, fieldMappings);

      expect(result['es-field-1']).toEqual({ type: 'text', value: 'Test Record' });
      expect(result['es-field-2']).toEqual({ type: 'text_area', value: 'A description' });
      expect(result['es-field-3']).toEqual({ type: 'number', value: 42 });
      expect(result['es-field-4']).toEqual({ type: 'checkbox', value: true });
    });

    it('skips unregistered property types with warning', () => {
      const page = makeNotionPage({
        Custom: {
          id: 'custom_prop',
          type: 'title' as const,
          title: [],
        },
      });

      // Clear registry to simulate unregistered type
      fieldTypeRegistry.clear();

      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'custom_prop',
          fieldType: 'text',
          externalFieldType: 'unknown_type',
          config: {},
        },
      ];

      const result = adapter.toCanonical(page, fieldMappings);
      expect(result['es-field-1']).toBeUndefined();
    });

    it('handles missing properties gracefully', () => {
      const page = makeNotionPage({});

      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'nonexistent_prop',
          fieldType: 'text',
          externalFieldType: 'title',
          config: {},
        },
      ];

      const result = adapter.toCanonical(page, fieldMappings);
      // Property not found — should skip without crashing
      expect(result['es-field-1']).toBeUndefined();
    });

    it('handles null record gracefully', () => {
      const result = adapter.toCanonical(null, []);
      expect(result).toEqual({});
    });

    it('finds properties by their id field', () => {
      const page = makeNotionPage({
        'My Title': {
          id: 'prop_id_abc',
          type: 'title',
          title: [makeRichText('Found by ID')],
        },
      });

      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'prop_id_abc',
          fieldType: 'text',
          externalFieldType: 'title',
          config: {},
        },
      ];

      const result = adapter.toCanonical(page, fieldMappings);
      expect(result['es-field-1']).toEqual({ type: 'text', value: 'Found by ID' });
    });

    it('transforms select properties with source_refs', () => {
      const page = makeNotionPage({
        Status: {
          id: 'select_prop',
          type: 'select',
          select: { id: 'opt_1', name: 'Active', color: 'green' },
        },
      });

      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'select_prop',
          fieldType: 'single_select',
          externalFieldType: 'select',
          config: {},
        },
      ];

      const result = adapter.toCanonical(page, fieldMappings);
      const value = result['es-field-1'] as { type: string; value: { source_refs: unknown } };
      expect(value.type).toBe('single_select');
      expect(value.value.source_refs).toEqual({
        notion: { option_id: 'opt_1', color: 'green' },
      });
    });

    it('transforms relations with recordIdMap', () => {
      const page = makeNotionPage({
        Tasks: {
          id: 'rel_prop',
          type: 'relation',
          relation: [{ id: 'page-a' }, { id: 'page-b' }],
        },
      });

      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'rel_prop',
          fieldType: 'linked_record',
          externalFieldType: 'relation',
          config: {
            recordIdMap: { 'page-a': 'es-rec-a' },
          },
        },
      ];

      const result = adapter.toCanonical(page, fieldMappings);
      expect(result['es-field-1']).toEqual({
        type: 'linked_record',
        value: [
          { record_id: 'es-rec-a' },
          { record_id: null, platform_record_id: 'page-b', filtered_out: true },
        ],
      });
    });
  });

  describe('fromCanonical', () => {
    it('skips read-only fields', () => {
      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'created_time_prop',
          fieldType: 'created_at',
          externalFieldType: 'created_time',
          config: {},
        },
      ];

      const result = adapter.fromCanonical(
        { 'es-field-1': { type: 'created_at', value: '2024-03-15T10:00:00.000Z' } },
        fieldMappings,
      );

      expect(result).toEqual({});
    });

    it('skips undefined canonical values', () => {
      const fieldMappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'title_prop',
          fieldType: 'text',
          externalFieldType: 'title',
          config: {},
        },
      ];

      const result = adapter.fromCanonical({}, fieldMappings);
      expect(result).toEqual({});
    });
  });
});

describe('registerNotionTransforms', () => {
  it('registers all 21 Notion property types in the registry', () => {
    fieldTypeRegistry.clear();
    registerNotionTransforms();

    const notionTypes = fieldTypeRegistry.getAllForPlatform('notion');
    expect(notionTypes.size).toBe(21);
  });

  it('registers transforms that are callable', () => {
    fieldTypeRegistry.clear();
    registerNotionTransforms();

    const transform = fieldTypeRegistry.get('notion', 'title');
    expect(typeof transform.toCanonical).toBe('function');
    expect(typeof transform.fromCanonical).toBe('function');
  });
});
