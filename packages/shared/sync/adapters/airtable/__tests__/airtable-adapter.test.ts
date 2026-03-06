import { describe, it, expect, beforeEach } from 'vitest';
import { fieldTypeRegistry } from '../../../field-registry';
import type { CanonicalValue } from '../../../types';
import type { FieldMapping } from '../../types';
import { AirtableAdapter, registerAirtableTransforms } from '../index';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('AirtableAdapter', () => {
  let adapter: AirtableAdapter;

  beforeEach(() => {
    fieldTypeRegistry.clear();
    registerAirtableTransforms();
    adapter = new AirtableAdapter();
  });

  it('has platform set to "airtable"', () => {
    expect(adapter.platform).toBe('airtable');
  });

  // -------------------------------------------------------------------------
  // toCanonical
  // -------------------------------------------------------------------------

  describe('toCanonical()', () => {
    it('transforms an Airtable record with text fields into canonical JSONB', () => {
      const record = {
        fields: {
          fldName: 'Acme Corp',
          fldDescription: 'A great company\nwith multiple lines',
        },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-field-1',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-field-2',
          externalFieldId: 'fldDescription',
          fieldType: 'text_area',
          externalFieldType: 'multilineText',
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);

      expect(result['es-field-1']).toEqual({ type: 'text', value: 'Acme Corp' });
      expect(result['es-field-2']).toEqual({
        type: 'text_area',
        value: 'A great company\nwith multiple lines',
      });
    });

    it('transforms an Airtable record with number fields into canonical JSONB', () => {
      const record = {
        fields: {
          fldPrice: 49.99,
          fldDuration: 3600,
          fldRating: 4,
          fldPercent: 0.85,
        },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-currency',
          externalFieldId: 'fldPrice',
          fieldType: 'currency',
          externalFieldType: 'currency',
          config: {},
        },
        {
          fieldId: 'es-duration',
          externalFieldId: 'fldDuration',
          fieldType: 'duration',
          externalFieldType: 'duration',
          config: {},
        },
        {
          fieldId: 'es-rating',
          externalFieldId: 'fldRating',
          fieldType: 'rating',
          externalFieldType: 'rating',
          config: {},
        },
        {
          fieldId: 'es-percent',
          externalFieldId: 'fldPercent',
          fieldType: 'percent',
          externalFieldType: 'percent',
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);

      expect(result['es-currency']).toEqual({ type: 'currency', value: 49.99 });
      expect(result['es-duration']).toEqual({ type: 'duration', value: 60 }); // 3600s → 60min
      expect(result['es-rating']).toEqual({ type: 'rating', value: 4 });
      expect(result['es-percent']).toEqual({ type: 'percent', value: 0.85 });
    });

    it('transforms a mixed text + number record', () => {
      const record = {
        fields: {
          fldTitle: 'Project Alpha',
          fldBudget: 10000,
          fldProgress: 45,
        },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-title',
          externalFieldId: 'fldTitle',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-budget',
          externalFieldId: 'fldBudget',
          fieldType: 'currency',
          externalFieldType: 'currency',
          config: {},
        },
        {
          fieldId: 'es-progress',
          externalFieldId: 'fldProgress',
          fieldType: 'progress',
          externalFieldType: 'progress',
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);

      expect(result['es-title']).toEqual({ type: 'text', value: 'Project Alpha' });
      expect(result['es-budget']).toEqual({ type: 'currency', value: 10000 });
      expect(result['es-progress']).toEqual({ type: 'progress', value: 45 });
    });

    it('handles null/undefined field values gracefully', () => {
      const record = {
        fields: {
          fldName: null,
          fldAmount: undefined,
        },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-amount',
          externalFieldId: 'fldAmount',
          fieldType: 'number',
          externalFieldType: 'number',
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);

      expect(result['es-name']).toEqual({ type: 'text', value: null });
      expect(result['es-amount']).toEqual({ type: 'number', value: null });
    });

    it('handles missing fields (not present in record) as undefined → null', () => {
      const record = { fields: {} };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);
      expect(result['es-name']).toEqual({ type: 'text', value: null });
    });

    it('skips unregistered field types without crashing', () => {
      const record = {
        fields: {
          fldName: 'Test',
          fldFormula: '=SUM(1,2)',
        },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-formula',
          externalFieldId: 'fldFormula',
          fieldType: 'formula',
          externalFieldType: 'formula', // Not registered
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);

      // Registered field is transformed
      expect(result['es-name']).toEqual({ type: 'text', value: 'Test' });
      // Unregistered field is skipped
      expect(result['es-formula']).toBeUndefined();
    });

    it('handles record with no fields property', () => {
      const record = {};
      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
      ];

      const result = adapter.toCanonical(record, mappings);
      expect(result['es-name']).toEqual({ type: 'text', value: null });
    });

    it('handles empty mappings', () => {
      const record = { fields: { fldName: 'Test' } };
      const result = adapter.toCanonical(record, []);
      expect(result).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // fromCanonical
  // -------------------------------------------------------------------------

  describe('fromCanonical()', () => {
    it('transforms canonical text and number values back to Airtable format', () => {
      const canonicalData: Record<string, CanonicalValue> = {
        'es-name': { type: 'text', value: 'Acme Corp' },
        'es-amount': { type: 'number', value: 42 },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-amount',
          externalFieldId: 'fldAmount',
          fieldType: 'number',
          externalFieldType: 'number',
          config: {},
        },
      ];

      const result = adapter.fromCanonical(canonicalData, mappings) as Record<string, unknown>;

      expect(result['fldName']).toBe('Acme Corp');
      expect(result['fldAmount']).toBe(42);
    });

    it('converts duration from canonical minutes back to Airtable seconds', () => {
      const canonicalData: Record<string, CanonicalValue> = {
        'es-duration': { type: 'duration', value: 30 },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-duration',
          externalFieldId: 'fldDuration',
          fieldType: 'duration',
          externalFieldType: 'duration',
          config: {},
        },
      ];

      const result = adapter.fromCanonical(canonicalData, mappings) as Record<string, unknown>;
      expect(result['fldDuration']).toBe(1800); // 30 min → 1800 sec
    });

    it('skips read-only fields (autoNumber)', () => {
      const canonicalData: Record<string, CanonicalValue> = {
        'es-auto': { type: 'auto_number', value: 42 },
        'es-name': { type: 'text', value: 'Test' },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-auto',
          externalFieldId: 'fldAuto',
          fieldType: 'auto_number',
          externalFieldType: 'autoNumber',
          config: {},
        },
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
      ];

      const result = adapter.fromCanonical(canonicalData, mappings) as Record<string, unknown>;

      expect(result['fldAuto']).toBeUndefined(); // Read-only, skipped
      expect(result['fldName']).toBe('Test');
    });

    it('skips fields not present in canonical data', () => {
      const canonicalData: Record<string, CanonicalValue> = {
        'es-name': { type: 'text', value: 'Test' },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-missing',
          externalFieldId: 'fldMissing',
          fieldType: 'number',
          externalFieldType: 'number',
          config: {},
        },
      ];

      const result = adapter.fromCanonical(canonicalData, mappings) as Record<string, unknown>;

      expect(result['fldName']).toBe('Test');
      expect(result['fldMissing']).toBeUndefined();
    });

    it('skips unregistered field types without crashing', () => {
      const canonicalData: Record<string, CanonicalValue> = {
        'es-name': { type: 'text', value: 'Test' },
        'es-formula': { type: 'text', value: '=SUM(1,2)' },
      };

      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-formula',
          externalFieldId: 'fldFormula',
          fieldType: 'formula',
          externalFieldType: 'formula', // Not registered
          config: {},
        },
      ];

      const result = adapter.fromCanonical(canonicalData, mappings) as Record<string, unknown>;

      expect(result['fldName']).toBe('Test');
      expect(result['fldFormula']).toBeUndefined();
    });

    it('handles empty canonical data', () => {
      const result = adapter.fromCanonical({}, []);
      expect(result).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  // Round-trip tests
  // -------------------------------------------------------------------------

  describe('round-trip (toCanonical → fromCanonical)', () => {
    it('round-trips text fields losslessly', () => {
      const original = { fields: { fldName: 'Round Trip Test' } };
      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
      ];

      const canonical = adapter.toCanonical(original, mappings);
      const restored = adapter.fromCanonical(canonical, mappings) as Record<string, unknown>;

      expect(restored['fldName']).toBe('Round Trip Test');
    });

    it('round-trips duration with correct unit conversion', () => {
      const original = { fields: { fldDuration: 7200 } }; // 2 hours in seconds
      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-dur',
          externalFieldId: 'fldDuration',
          fieldType: 'duration',
          externalFieldType: 'duration',
          config: {},
        },
      ];

      const canonical = adapter.toCanonical(original, mappings);
      expect(canonical['es-dur']).toEqual({ type: 'duration', value: 120 }); // 120 minutes

      const restored = adapter.fromCanonical(canonical, mappings) as Record<string, unknown>;
      expect(restored['fldDuration']).toBe(7200); // Back to 7200 seconds
    });

    it('round-trips null values correctly', () => {
      const original = { fields: { fldName: null, fldAmount: null } };
      const mappings: FieldMapping[] = [
        {
          fieldId: 'es-name',
          externalFieldId: 'fldName',
          fieldType: 'text',
          externalFieldType: 'singleLineText',
          config: {},
        },
        {
          fieldId: 'es-amount',
          externalFieldId: 'fldAmount',
          fieldType: 'number',
          externalFieldType: 'number',
          config: {},
        },
      ];

      const canonical = adapter.toCanonical(original, mappings);
      const restored = adapter.fromCanonical(canonical, mappings) as Record<string, unknown>;

      expect(restored['fldName']).toBeNull();
      expect(restored['fldAmount']).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// registerAirtableTransforms
// ---------------------------------------------------------------------------

describe('registerAirtableTransforms()', () => {
  it('registers all text and number transforms in the global registry', () => {
    fieldTypeRegistry.clear();
    registerAirtableTransforms();

    // Text transforms (3)
    expect(fieldTypeRegistry.has('airtable', 'singleLineText')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'multilineText')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'richText')).toBe(true);

    // Number transforms (7)
    expect(fieldTypeRegistry.has('airtable', 'number')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'currency')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'percent')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'rating')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'duration')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'progress')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'autoNumber')).toBe(true);

    // Selection transforms (4)
    expect(fieldTypeRegistry.has('airtable', 'singleSelect')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'multipleSelects')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'status')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'tag')).toBe(true);

    // Date transforms (7)
    expect(fieldTypeRegistry.has('airtable', 'date')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'dateTime')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'dateRange')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'dueDate')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'time')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'createdTime')).toBe(true);
    expect(fieldTypeRegistry.has('airtable', 'lastModifiedTime')).toBe(true);
  });

  it('registers exactly 32 transforms total', () => {
    fieldTypeRegistry.clear();
    registerAirtableTransforms();
    expect(fieldTypeRegistry.getSupportedFieldTypes('airtable')).toHaveLength(32);
  });
});
