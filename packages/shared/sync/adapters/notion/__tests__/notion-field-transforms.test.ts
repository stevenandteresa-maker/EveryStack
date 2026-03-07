import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig } from '../../../types';
import {
  extractPlainText,
  notionTitleTransform,
  notionRichTextTransform,
  notionNumberTransform,
  notionSelectTransform,
  notionMultiSelectTransform,
  notionStatusTransform,
  notionDateTransform,
  notionCreatedTimeTransform,
  notionLastEditedTimeTransform,
  notionPeopleTransform,
  notionCreatedByTransform,
  notionLastEditedByTransform,
  notionEmailTransform,
  notionPhoneNumberTransform,
  notionUrlTransform,
  notionCheckboxTransform,
  notionRelationTransform,
  notionFilesTransform,
  notionFormulaTransform,
  notionRollupTransform,
  notionUniqueIdTransform,
  NOTION_TRANSFORMS,
} from '../notion-field-transforms';
import type { NotionRichText, NotionUser } from '../notion-types';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'prop_abc123',
  name: 'Test Property',
  platformFieldType: 'title',
};

// ---------------------------------------------------------------------------
// Helper: extractPlainText
// ---------------------------------------------------------------------------

describe('extractPlainText', () => {
  it('extracts plain text from rich text array', () => {
    const richText: NotionRichText[] = [
      {
        type: 'text',
        text: { content: 'Hello ' },
        annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
        plain_text: 'Hello ',
        href: null,
      },
      {
        type: 'text',
        text: { content: 'World' },
        annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
        plain_text: 'World',
        href: null,
      },
    ];
    expect(extractPlainText(richText)).toBe('Hello World');
  });

  it('returns empty string for null', () => {
    expect(extractPlainText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(extractPlainText(undefined)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(extractPlainText([])).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Helper: create Notion rich text fixtures
// ---------------------------------------------------------------------------

function makeRichText(content: string, bold = false): NotionRichText {
  return {
    type: 'text',
    text: { content },
    annotations: { bold, italic: false, strikethrough: false, underline: false, code: false, color: 'default' },
    plain_text: content,
    href: null,
  };
}

function makeUser(id: string, name?: string, email?: string): NotionUser {
  return {
    object: 'user',
    id,
    type: 'person',
    name: name ?? null,
    person: email ? { email } : undefined,
  };
}

// ---------------------------------------------------------------------------
// title → text
// ---------------------------------------------------------------------------

describe('notionTitleTransform', () => {
  describe('toCanonical', () => {
    it('extracts plain text from title rich text', () => {
      const result = notionTitleTransform.toCanonical(
        [makeRichText('My Title')],
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: 'My Title' });
    });

    it('concatenates multiple rich text segments', () => {
      const result = notionTitleTransform.toCanonical(
        [makeRichText('Hello '), makeRichText('World', true)],
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: 'Hello World' });
    });

    it('returns null for null input', () => {
      const result = notionTitleTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('returns null for empty array', () => {
      const result = notionTitleTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });
  });

  it('is lossless and supports read/write/filter/sort', () => {
    expect(notionTitleTransform.isLossless).toBe(true);
    expect(notionTitleTransform.supportedOperations).toEqual(['read', 'write', 'filter', 'sort']);
  });
});

// ---------------------------------------------------------------------------
// rich_text → text_area
// ---------------------------------------------------------------------------

describe('notionRichTextTransform', () => {
  describe('toCanonical', () => {
    it('extracts plain text from rich text array', () => {
      const result = notionRichTextTransform.toCanonical(
        [makeRichText('Description text')],
        baseConfig,
      );
      expect(result).toEqual({ type: 'text_area', value: 'Description text' });
    });

    it('handles rich text with mixed annotations', () => {
      const richText: NotionRichText[] = [
        makeRichText('Normal '),
        {
          type: 'text',
          text: { content: 'bold' },
          annotations: { bold: true, italic: true, strikethrough: false, underline: false, code: false, color: 'default' },
          plain_text: 'bold',
          href: null,
        },
        makeRichText(' text'),
      ];
      const result = notionRichTextTransform.toCanonical(richText, baseConfig);
      expect(result).toEqual({ type: 'text_area', value: 'Normal bold text' });
    });

    it('returns null for null input', () => {
      const result = notionRichTextTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text_area', value: null });
    });

    it('returns null for empty array', () => {
      const result = notionRichTextTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'text_area', value: null });
    });
  });
});

// ---------------------------------------------------------------------------
// number → number
// ---------------------------------------------------------------------------

describe('notionNumberTransform', () => {
  describe('toCanonical', () => {
    it('converts a number value', () => {
      const result = notionNumberTransform.toCanonical(42, baseConfig);
      expect(result).toEqual({ type: 'number', value: 42 });
    });

    it('handles floating point', () => {
      const result = notionNumberTransform.toCanonical(3.14, baseConfig);
      expect(result).toEqual({ type: 'number', value: 3.14 });
    });

    it('returns null for null input', () => {
      const result = notionNumberTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'number', value: null });
    });

    it('returns null for NaN input', () => {
      const result = notionNumberTransform.toCanonical('not a number', baseConfig);
      expect(result).toEqual({ type: 'number', value: null });
    });

    it('coerces string numbers', () => {
      const result = notionNumberTransform.toCanonical('42', baseConfig);
      expect(result).toEqual({ type: 'number', value: 42 });
    });
  });
});

// ---------------------------------------------------------------------------
// select → single_select
// ---------------------------------------------------------------------------

describe('notionSelectTransform', () => {
  describe('toCanonical', () => {
    it('maps a Notion select option to single_select', () => {
      const result = notionSelectTransform.toCanonical(
        { id: 'opt_1', name: 'In Progress', color: 'blue' },
        baseConfig,
      );
      expect(result).toEqual({
        type: 'single_select',
        value: {
          id: expect.stringContaining('es_opt_unsynced_'),
          label: 'In Progress',
          source_refs: { notion: { option_id: 'opt_1', color: 'blue' } },
        },
      });
    });

    it('uses existing ES option ID when matched by Notion option_id', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          options: [
            {
              id: 'es-uuid-1',
              label: 'In Progress',
              source_refs: { notion: { option_id: 'opt_1' } },
            },
          ],
        },
      };
      const result = notionSelectTransform.toCanonical(
        { id: 'opt_1', name: 'In Progress', color: 'blue' },
        config,
      );
      expect(result).toEqual({
        type: 'single_select',
        value: {
          id: 'es-uuid-1',
          label: 'In Progress',
          source_refs: { notion: { option_id: 'opt_1', color: 'blue' } },
        },
      });
    });

    it('returns null for null select', () => {
      const result = notionSelectTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'single_select', value: null });
    });
  });
});

// ---------------------------------------------------------------------------
// multi_select → multiple_select
// ---------------------------------------------------------------------------

describe('notionMultiSelectTransform', () => {
  describe('toCanonical', () => {
    it('maps an array of options to multiple_select', () => {
      const result = notionMultiSelectTransform.toCanonical(
        [
          { id: 'opt_a', name: 'Tag A', color: 'red' },
          { id: 'opt_b', name: 'Tag B', color: 'green' },
        ],
        baseConfig,
      );
      expect(result.type).toBe('multiple_select');
      expect((result as { value: unknown[] }).value).toHaveLength(2);
    });

    it('returns empty array for null input', () => {
      const result = notionMultiSelectTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'multiple_select', value: [] });
    });

    it('returns empty array for empty array', () => {
      const result = notionMultiSelectTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'multiple_select', value: [] });
    });

    it('preserves Notion option IDs in source_refs', () => {
      const result = notionMultiSelectTransform.toCanonical(
        [{ id: 'opt_x', name: 'Option X', color: 'yellow' }],
        baseConfig,
      );
      const values = (result as { value: Array<{ source_refs: unknown }> }).value;
      expect(values[0]?.source_refs).toEqual({
        notion: { option_id: 'opt_x', color: 'yellow' },
      });
    });
  });
});

// ---------------------------------------------------------------------------
// status → status
// ---------------------------------------------------------------------------

describe('notionStatusTransform', () => {
  describe('toCanonical', () => {
    it('maps a Notion status option with group resolution', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          groups: [
            { id: 'grp_1', name: 'In Progress', option_ids: ['opt_wip'] },
          ],
        },
      };
      const result = notionStatusTransform.toCanonical(
        { id: 'opt_wip', name: 'Working', color: 'blue' },
        config,
      );
      expect(result).toEqual({
        type: 'status',
        value: {
          id: expect.any(String),
          label: 'Working',
          category: 'in_progress',
          source_refs: { notion: { option_id: 'opt_wip', color: 'blue' } },
        },
      });
    });

    it('defaults to not_started when no group matches', () => {
      const result = notionStatusTransform.toCanonical(
        { id: 'opt_1', name: 'Unknown', color: 'gray' },
        baseConfig,
      );
      expect(result).toEqual({
        type: 'status',
        value: expect.objectContaining({ category: 'not_started' }),
      });
    });

    it('returns null for null status', () => {
      const result = notionStatusTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'status', value: null });
    });

    it('resolves "Done" group to done category', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          groups: [
            { id: 'grp_d', name: 'Done', option_ids: ['opt_done'] },
          ],
        },
      };
      const result = notionStatusTransform.toCanonical(
        { id: 'opt_done', name: 'Complete', color: 'green' },
        config,
      );
      const value = (result as { value: { category: string } }).value;
      expect(value.category).toBe('done');
    });

    it('resolves "To-do" group to not_started category', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          groups: [
            { id: 'grp_t', name: 'To-do', option_ids: ['opt_todo'] },
          ],
        },
      };
      const result = notionStatusTransform.toCanonical(
        { id: 'opt_todo', name: 'Not Started', color: 'gray' },
        config,
      );
      const value = (result as { value: { category: string } }).value;
      expect(value.category).toBe('not_started');
    });
  });
});

// ---------------------------------------------------------------------------
// date → date / date_range
// ---------------------------------------------------------------------------

describe('notionDateTransform', () => {
  describe('toCanonical', () => {
    it('maps a date-only Notion date to date', () => {
      const result = notionDateTransform.toCanonical(
        { start: '2024-03-15', end: null, time_zone: null },
        baseConfig,
      );
      expect(result).toEqual({ type: 'date', value: '2024-03-15' });
    });

    it('maps a datetime Notion date to date', () => {
      const result = notionDateTransform.toCanonical(
        { start: '2024-03-15T10:30:00.000Z', end: null, time_zone: null },
        baseConfig,
      );
      expect(result).toEqual({ type: 'date', value: '2024-03-15T10:30:00.000Z' });
    });

    it('maps a date range to date_range', () => {
      const result = notionDateTransform.toCanonical(
        { start: '2024-03-15', end: '2024-03-20', time_zone: null },
        baseConfig,
      );
      expect(result).toEqual({
        type: 'date_range',
        value: { start: '2024-03-15', end: '2024-03-20' },
      });
    });

    it('returns null for null date', () => {
      const result = notionDateTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'date', value: null });
    });
  });
});

// ---------------------------------------------------------------------------
// created_time → created_at
// ---------------------------------------------------------------------------

describe('notionCreatedTimeTransform', () => {
  it('maps ISO timestamp to created_at', () => {
    const result = notionCreatedTimeTransform.toCanonical(
      '2024-03-15T10:30:00.000Z',
      baseConfig,
    );
    expect(result).toEqual({ type: 'created_at', value: '2024-03-15T10:30:00.000Z' });
  });

  it('returns null for null', () => {
    const result = notionCreatedTimeTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'created_at', value: null });
  });

  it('is lossy and read-only', () => {
    expect(notionCreatedTimeTransform.isLossless).toBe(false);
    expect(notionCreatedTimeTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// last_edited_time → updated_at
// ---------------------------------------------------------------------------

describe('notionLastEditedTimeTransform', () => {
  it('maps ISO timestamp to updated_at', () => {
    const result = notionLastEditedTimeTransform.toCanonical(
      '2024-03-15T14:00:00.000Z',
      baseConfig,
    );
    expect(result).toEqual({ type: 'updated_at', value: '2024-03-15T14:00:00.000Z' });
  });

  it('returns null for null', () => {
    const result = notionLastEditedTimeTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'updated_at', value: null });
  });

  it('is lossy and read-only', () => {
    expect(notionLastEditedTimeTransform.isLossless).toBe(false);
    expect(notionLastEditedTimeTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// people → people
// ---------------------------------------------------------------------------

describe('notionPeopleTransform', () => {
  describe('toCanonical', () => {
    it('extracts user IDs from Notion user array', () => {
      const result = notionPeopleTransform.toCanonical(
        [makeUser('user_1', 'Alice'), makeUser('user_2', 'Bob')],
        baseConfig,
      );
      expect(result).toEqual({ type: 'people', value: ['user_1', 'user_2'] });
    });

    it('returns empty array for null', () => {
      const result = notionPeopleTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'people', value: [] });
    });

    it('returns empty array for empty array', () => {
      const result = notionPeopleTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'people', value: [] });
    });
  });

  it('is lossy (user ID mapping needed)', () => {
    expect(notionPeopleTransform.isLossless).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// created_by → created_by
// ---------------------------------------------------------------------------

describe('notionCreatedByTransform', () => {
  it('extracts user ID from Notion user object', () => {
    const result = notionCreatedByTransform.toCanonical(
      makeUser('user_creator', 'Creator'),
      baseConfig,
    );
    expect(result).toEqual({ type: 'created_by', value: 'user_creator' });
  });

  it('returns null for null', () => {
    const result = notionCreatedByTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'created_by', value: null });
  });

  it('is lossy and read-only', () => {
    expect(notionCreatedByTransform.isLossless).toBe(false);
    expect(notionCreatedByTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// last_edited_by → updated_by
// ---------------------------------------------------------------------------

describe('notionLastEditedByTransform', () => {
  it('extracts user ID from Notion user object', () => {
    const result = notionLastEditedByTransform.toCanonical(
      makeUser('user_editor', 'Editor'),
      baseConfig,
    );
    expect(result).toEqual({ type: 'updated_by', value: 'user_editor' });
  });

  it('returns null for null', () => {
    const result = notionLastEditedByTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'updated_by', value: null });
  });
});

// ---------------------------------------------------------------------------
// email → email
// ---------------------------------------------------------------------------

describe('notionEmailTransform', () => {
  it('maps email string to canonical email', () => {
    const result = notionEmailTransform.toCanonical('alice@example.com', baseConfig);
    expect(result).toEqual({ type: 'email', value: 'alice@example.com' });
  });

  it('returns null for null', () => {
    const result = notionEmailTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'email', value: null });
  });

  it('is lossless', () => {
    expect(notionEmailTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// phone_number → phone
// ---------------------------------------------------------------------------

describe('notionPhoneNumberTransform', () => {
  it('maps phone string to structured phone value', () => {
    const result = notionPhoneNumberTransform.toCanonical('+1-555-0100', baseConfig);
    expect(result).toEqual({
      type: 'phone',
      value: { number: '+1-555-0100', type: 'main' },
    });
  });

  it('returns null for null', () => {
    const result = notionPhoneNumberTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'phone', value: null });
  });
});

// ---------------------------------------------------------------------------
// url → url
// ---------------------------------------------------------------------------

describe('notionUrlTransform', () => {
  it('maps URL string to canonical url', () => {
    const result = notionUrlTransform.toCanonical('https://example.com', baseConfig);
    expect(result).toEqual({ type: 'url', value: 'https://example.com' });
  });

  it('returns null for null', () => {
    const result = notionUrlTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'url', value: null });
  });

  it('is lossless', () => {
    expect(notionUrlTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// checkbox → checkbox
// ---------------------------------------------------------------------------

describe('notionCheckboxTransform', () => {
  it('maps true to checked', () => {
    const result = notionCheckboxTransform.toCanonical(true, baseConfig);
    expect(result).toEqual({ type: 'checkbox', value: true });
  });

  it('maps false to unchecked', () => {
    const result = notionCheckboxTransform.toCanonical(false, baseConfig);
    expect(result).toEqual({ type: 'checkbox', value: false });
  });

  it('maps null to unchecked', () => {
    const result = notionCheckboxTransform.toCanonical(null, baseConfig);
    expect(result).toEqual({ type: 'checkbox', value: false });
  });

  it('maps undefined to unchecked', () => {
    const result = notionCheckboxTransform.toCanonical(undefined, baseConfig);
    expect(result).toEqual({ type: 'checkbox', value: false });
  });

  it('is lossless', () => {
    expect(notionCheckboxTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// relation → linked_record
// ---------------------------------------------------------------------------

describe('notionRelationTransform', () => {
  describe('toCanonical', () => {
    it('maps Notion relation IDs to linked records', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          recordIdMap: {
            'page-uuid-1': 'es-record-1',
            'page-uuid-2': 'es-record-2',
          },
        },
      };
      const result = notionRelationTransform.toCanonical(
        [{ id: 'page-uuid-1' }, { id: 'page-uuid-2' }],
        config,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          { record_id: 'es-record-1' },
          { record_id: 'es-record-2' },
        ],
      });
    });

    it('marks unresolved relations as filtered_out', () => {
      const result = notionRelationTransform.toCanonical(
        [{ id: 'page-unknown' }],
        baseConfig,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          {
            record_id: null,
            platform_record_id: 'page-unknown',
            filtered_out: true,
          },
        ],
      });
    });

    it('returns empty array for null', () => {
      const result = notionRelationTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'linked_record', value: [] });
    });

    it('returns empty array for empty relations', () => {
      const result = notionRelationTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'linked_record', value: [] });
    });
  });
});

// ---------------------------------------------------------------------------
// files → files
// ---------------------------------------------------------------------------

describe('notionFilesTransform', () => {
  describe('toCanonical', () => {
    it('maps external Notion files', () => {
      const result = notionFilesTransform.toCanonical(
        [
          { type: 'external', external: { url: 'https://example.com/file.pdf' }, name: 'file.pdf' },
        ],
        baseConfig,
      );
      expect(result).toEqual({
        type: 'files',
        value: [
          {
            url: 'https://example.com/file.pdf',
            filename: 'file.pdf',
            file_type: '',
            size: 0,
            thumbnail_url: null,
            source_refs: { notion: { type: 'external' } },
          },
        ],
      });
    });

    it('maps internal Notion files', () => {
      const result = notionFilesTransform.toCanonical(
        [
          {
            type: 'file',
            file: { url: 'https://s3.notion.com/abc/img.png', expiry_time: '2024-03-15T10:30:00.000Z' },
            name: 'img.png',
          },
        ],
        baseConfig,
      );
      const value = (result as { value: Array<{ url: string }> }).value;
      expect(value[0]?.url).toBe('https://s3.notion.com/abc/img.png');
    });

    it('returns empty array for null', () => {
      const result = notionFilesTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'files', value: [] });
    });

    it('returns empty array for empty array', () => {
      const result = notionFilesTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'files', value: [] });
    });
  });

  it('is lossy (no file size/type from Notion)', () => {
    expect(notionFilesTransform.isLossless).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// formula → text (read-only, lossy)
// ---------------------------------------------------------------------------

describe('notionFormulaTransform', () => {
  describe('toCanonical', () => {
    it('extracts string formula result', () => {
      const result = notionFormulaTransform.toCanonical(
        { type: 'string', string: 'computed value' },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: 'computed value' });
    });

    it('extracts number formula result', () => {
      const result = notionFormulaTransform.toCanonical(
        { type: 'number', number: 42 },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: '42' });
    });

    it('extracts boolean formula result', () => {
      const result = notionFormulaTransform.toCanonical(
        { type: 'boolean', boolean: true },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: 'true' });
    });

    it('extracts date formula result', () => {
      const result = notionFormulaTransform.toCanonical(
        { type: 'date', date: { start: '2024-03-15', end: null, time_zone: null } },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: '2024-03-15' });
    });

    it('returns null for null formula', () => {
      const result = notionFormulaTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('returns null for formula with null string value', () => {
      const result = notionFormulaTransform.toCanonical(
        { type: 'string', string: null },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: null });
    });
  });

  it('is lossy and read-only', () => {
    expect(notionFormulaTransform.isLossless).toBe(false);
    expect(notionFormulaTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// rollup → text (read-only, lossy)
// ---------------------------------------------------------------------------

describe('notionRollupTransform', () => {
  describe('toCanonical', () => {
    it('extracts number rollup result', () => {
      const result = notionRollupTransform.toCanonical(
        { type: 'number', number: 150 },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: '150' });
    });

    it('extracts date rollup result', () => {
      const result = notionRollupTransform.toCanonical(
        { type: 'date', date: { start: '2024-01-01', end: null, time_zone: null } },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: '2024-01-01' });
    });

    it('returns null for null rollup', () => {
      const result = notionRollupTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('returns null for incomplete rollup', () => {
      const result = notionRollupTransform.toCanonical(
        { type: 'incomplete' },
        baseConfig,
      );
      expect(result).toEqual({ type: 'text', value: null });
    });
  });

  it('is lossy and read-only', () => {
    expect(notionRollupTransform.isLossless).toBe(false);
    expect(notionRollupTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// unique_id → auto_number (read-only)
// ---------------------------------------------------------------------------

describe('notionUniqueIdTransform', () => {
  describe('toCanonical', () => {
    it('extracts number from unique_id', () => {
      const result = notionUniqueIdTransform.toCanonical(
        { prefix: 'TASK', number: 42 },
        baseConfig,
      );
      expect(result).toEqual({ type: 'auto_number', value: 42 });
    });

    it('extracts number when prefix is null', () => {
      const result = notionUniqueIdTransform.toCanonical(
        { prefix: null, number: 1 },
        baseConfig,
      );
      expect(result).toEqual({ type: 'auto_number', value: 1 });
    });

    it('returns null for null', () => {
      const result = notionUniqueIdTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'auto_number', value: null });
    });
  });

  it('is lossy and read-only', () => {
    expect(notionUniqueIdTransform.isLossless).toBe(false);
    expect(notionUniqueIdTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// NOTION_TRANSFORMS array
// ---------------------------------------------------------------------------

describe('NOTION_TRANSFORMS', () => {
  it('has 21 registered transforms', () => {
    expect(NOTION_TRANSFORMS).toHaveLength(21);
  });

  it('includes all 20 Notion property types', () => {
    const types = NOTION_TRANSFORMS.map((t) => t.notionType);
    expect(types).toContain('title');
    expect(types).toContain('rich_text');
    expect(types).toContain('number');
    expect(types).toContain('select');
    expect(types).toContain('multi_select');
    expect(types).toContain('status');
    expect(types).toContain('date');
    expect(types).toContain('created_time');
    expect(types).toContain('last_edited_time');
    expect(types).toContain('people');
    expect(types).toContain('created_by');
    expect(types).toContain('last_edited_by');
    expect(types).toContain('email');
    expect(types).toContain('phone_number');
    expect(types).toContain('url');
    expect(types).toContain('checkbox');
    expect(types).toContain('relation');
    expect(types).toContain('files');
    expect(types).toContain('formula');
    expect(types).toContain('rollup');
    expect(types).toContain('unique_id');
  });

  it('marks lossy fields correctly', () => {
    const lossyTypes = ['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id'];
    for (const entry of NOTION_TRANSFORMS) {
      if (lossyTypes.includes(entry.notionType)) {
        expect(entry.transform.isLossless).toBe(false);
      }
    }
  });

  it('marks computed fields as read-only', () => {
    const readOnlyTypes = ['formula', 'rollup', 'created_time', 'created_by', 'last_edited_time', 'last_edited_by', 'unique_id'];
    for (const entry of NOTION_TRANSFORMS) {
      if (readOnlyTypes.includes(entry.notionType)) {
        expect(entry.transform.supportedOperations).toEqual(['read']);
      }
    }
  });
});
