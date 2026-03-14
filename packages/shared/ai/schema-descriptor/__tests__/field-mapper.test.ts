import { describe, it, expect } from 'vitest';
import { mapFieldToDescriptor } from '../field-mapper';
import type { Field } from '../../../db/schema/fields';
import type { CrossLink } from '../../../db/schema/cross-links';

/**
 * Creates a minimal Field row with sensible defaults.
 * Only fieldType and optional overrides need to be specified.
 */
function createField(overrides: Partial<Field> & { fieldType: string }): Field {
  const { fieldType, ...rest } = overrides;
  return {
    id: 'fld_001',
    tableId: 'tbl_001',
    tenantId: 'tenant_001',
    name: 'Test Field',
    fieldType,
    fieldSubType: null,
    isPrimary: false,
    isSystem: false,
    required: false,
    unique: false,
    readOnly: false,
    config: {},
    display: {},
    permissions: {},
    defaultValue: null,
    description: null,
    sortOrder: 0,
    externalFieldId: null,
    environment: 'live',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...rest,
  };
}

/**
 * Creates a minimal CrossLink row for testing linked_record mapping.
 */
function createCrossLink(overrides?: Partial<CrossLink>): CrossLink {
  return {
    id: 'cl_001',
    tenantId: 'tenant_001',
    name: 'Deal → Contact',
    sourceTableId: 'tbl_001',
    sourceFieldId: 'fld_001',
    targetTableId: 'tbl_002',
    targetDisplayFieldId: 'fld_100',
    relationshipType: 'many_to_one',
    reverseFieldId: 'fld_101',
    linkScopeFilter: null,
    cardFields: [],
    maxLinksPerRecord: 50,
    maxDepth: 3,
    environment: 'live',
    createdBy: 'user_001',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('mapFieldToDescriptor', () => {
  // ------------------------------------------------------------------
  // Searchable field types
  // ------------------------------------------------------------------
  describe('searchable fields', () => {
    const searchableTypes = ['text', 'email', 'url', 'phone', 'rich_text'];

    it.each(searchableTypes)('marks %s as searchable', (fieldType) => {
      const field = createField({ fieldType });
      const result = mapFieldToDescriptor(field);

      expect(result.searchable).toBe(true);
      expect(result.aggregatable).toBe(false);
      expect(result.type).toBe(fieldType);
    });
  });

  // ------------------------------------------------------------------
  // Aggregatable field types
  // ------------------------------------------------------------------
  describe('aggregatable fields', () => {
    const aggregatableTypes = ['number', 'currency', 'percent', 'duration', 'rating'];

    it.each(aggregatableTypes)('marks %s as aggregatable', (fieldType) => {
      const field = createField({ fieldType });
      const result = mapFieldToDescriptor(field);

      expect(result.aggregatable).toBe(true);
      expect(result.searchable).toBe(false);
      expect(result.type).toBe(fieldType);
    });
  });

  // ------------------------------------------------------------------
  // Default (neither searchable nor aggregatable) field types
  // ------------------------------------------------------------------
  describe('default fields (not searchable, not aggregatable)', () => {
    const defaultTypes = [
      'text_area', 'smart_doc',
      'progress', 'auto_number',
      'status', 'tag',
      'date', 'date_range', 'due_date', 'time', 'created_at', 'updated_at',
      'people', 'created_by', 'updated_by', 'address', 'full_name', 'social',
      'checkbox', 'button', 'checklist', 'signature',
      'files', 'barcode',
    ];

    it.each(defaultTypes)('marks %s as non-searchable and non-aggregatable', (fieldType) => {
      const field = createField({ fieldType });
      const result = mapFieldToDescriptor(field);

      expect(result.searchable).toBe(false);
      expect(result.aggregatable).toBe(false);
      expect(result.type).toBe(fieldType);
    });
  });

  // ------------------------------------------------------------------
  // Basic field mapping
  // ------------------------------------------------------------------
  describe('basic mapping', () => {
    it('maps field_id, name, and type from the field row', () => {
      const field = createField({
        id: 'fld_abc',
        name: 'Deal Name',
        fieldType: 'text',
      });
      const result = mapFieldToDescriptor(field);

      expect(result.field_id).toBe('fld_abc');
      expect(result.name).toBe('Deal Name');
      expect(result.type).toBe('text');
    });
  });

  // ------------------------------------------------------------------
  // Select fields with options
  // ------------------------------------------------------------------
  describe('select fields', () => {
    it('extracts options from single_select config', () => {
      const field = createField({
        fieldType: 'single_select',
        config: {
          options: [
            { id: 'opt1', label: 'Prospect', color: 'blue' },
            { id: 'opt2', label: 'Qualified', color: 'green' },
            { id: 'opt3', label: 'Closed Won', color: 'gold' },
          ],
        },
      });
      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('single_select');
      expect(result.options).toEqual(['Prospect', 'Qualified', 'Closed Won']);
      expect(result.searchable).toBe(false);
      expect(result.aggregatable).toBe(false);
    });

    it('extracts options from multiple_select config', () => {
      const field = createField({
        fieldType: 'multiple_select',
        config: {
          options: [
            { id: 'opt1', label: 'Frontend' },
            { id: 'opt2', label: 'Backend' },
          ],
        },
      });
      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('multiple_select');
      expect(result.options).toEqual(['Frontend', 'Backend']);
    });

    it('handles select field with no options in config', () => {
      const field = createField({
        fieldType: 'single_select',
        config: {},
      });
      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('single_select');
      expect(result.options).toBeUndefined();
    });

    it('handles select field with empty options array', () => {
      const field = createField({
        fieldType: 'single_select',
        config: { options: [] },
      });
      const result = mapFieldToDescriptor(field);

      expect(result.options).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // Currency field
  // ------------------------------------------------------------------
  describe('currency field', () => {
    it('extracts currency_code from config', () => {
      const field = createField({
        fieldType: 'currency',
        config: { currency_code: 'USD' },
      });
      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('currency');
      expect(result.currency_code).toBe('USD');
      expect(result.aggregatable).toBe(true);
    });

    it('handles currency field without currency_code in config', () => {
      const field = createField({
        fieldType: 'currency',
        config: {},
      });
      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('currency');
      expect(result.currency_code).toBeUndefined();
      expect(result.aggregatable).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // Linked record field
  // ------------------------------------------------------------------
  describe('linked_record field', () => {
    it('populates full linked metadata when crossLinkDef is provided', () => {
      const field = createField({ fieldType: 'linked_record' });
      const crossLink = createCrossLink({
        targetTableId: 'tbl_contacts',
        relationshipType: 'many_to_one',
        reverseFieldId: 'fld_reverse',
      });

      const result = mapFieldToDescriptor(field, crossLink);

      expect(result.type).toBe('linked_record');
      expect(result.linked_table).toBe('tbl_contacts');
      expect(result.cardinality).toBe('many_to_one');
      expect(result.symmetric_field).toBe('fld_reverse');
      expect(result.searchable).toBe(false);
      expect(result.aggregatable).toBe(false);
    });

    it('handles one_to_many cardinality', () => {
      const field = createField({ fieldType: 'linked_record' });
      const crossLink = createCrossLink({
        relationshipType: 'one_to_many',
      });

      const result = mapFieldToDescriptor(field, crossLink);

      expect(result.cardinality).toBe('one_to_many');
    });

    it('omits symmetric_field when reverseFieldId is null', () => {
      const field = createField({ fieldType: 'linked_record' });
      const crossLink = createCrossLink({
        reverseFieldId: null,
      });

      const result = mapFieldToDescriptor(field, crossLink);

      expect(result.linked_table).toBe('tbl_002');
      expect(result.cardinality).toBe('many_to_one');
      expect(result.symmetric_field).toBeUndefined();
    });

    it('produces valid descriptor without crossLinkDef', () => {
      const field = createField({ fieldType: 'linked_record' });

      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('linked_record');
      expect(result.linked_table).toBeUndefined();
      expect(result.linked_base).toBeUndefined();
      expect(result.cardinality).toBeUndefined();
      expect(result.symmetric_field).toBeUndefined();
      expect(result.searchable).toBe(false);
      expect(result.aggregatable).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // Unknown field type
  // ------------------------------------------------------------------
  describe('unknown field type', () => {
    it('defaults to non-searchable, non-aggregatable', () => {
      const field = createField({ fieldType: 'some_future_type' });
      const result = mapFieldToDescriptor(field);

      expect(result.type).toBe('some_future_type');
      expect(result.searchable).toBe(false);
      expect(result.aggregatable).toBe(false);
      expect(result.options).toBeUndefined();
      expect(result.currency_code).toBeUndefined();
      expect(result.linked_table).toBeUndefined();
    });
  });
});
