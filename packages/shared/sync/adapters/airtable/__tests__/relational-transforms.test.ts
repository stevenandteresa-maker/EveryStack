import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableLinkedRecordTransform,
  AIRTABLE_RELATIONAL_TRANSFORMS,
} from '../relational-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldLink001',
  name: 'Projects',
  platformFieldType: 'multipleRecordLinks',
  options: {
    recordIdMap: {
      recAAA: 'es-uuid-111',
      recBBB: 'es-uuid-222',
    },
  },
};

// ---------------------------------------------------------------------------
// multipleRecordLinks → linked_record
// ---------------------------------------------------------------------------

describe('airtableLinkedRecordTransform', () => {
  describe('toCanonical', () => {
    it('resolves Airtable record IDs to ES UUIDs via recordIdMap', () => {
      const result = airtableLinkedRecordTransform.toCanonical(
        ['recAAA', 'recBBB'],
        baseConfig,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          { record_id: 'es-uuid-111' },
          { record_id: 'es-uuid-222' },
        ],
      });
    });

    it('sets filtered_out: true for unsynced records', () => {
      const result = airtableLinkedRecordTransform.toCanonical(
        ['recAAA', 'recCCC'],
        baseConfig,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          { record_id: 'es-uuid-111' },
          { record_id: null, platform_record_id: 'recCCC', filtered_out: true },
        ],
      });
    });

    it('marks all records as filtered_out when recordIdMap is empty', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: { recordIdMap: {} },
      };
      const result = airtableLinkedRecordTransform.toCanonical(
        ['recXXX', 'recYYY'],
        config,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          { record_id: null, platform_record_id: 'recXXX', filtered_out: true },
          { record_id: null, platform_record_id: 'recYYY', filtered_out: true },
        ],
      });
    });

    it('handles missing recordIdMap in options gracefully', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {},
      };
      const result = airtableLinkedRecordTransform.toCanonical(
        ['recAAA'],
        config,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          { record_id: null, platform_record_id: 'recAAA', filtered_out: true },
        ],
      });
    });

    it('returns empty array for null input', () => {
      const result = airtableLinkedRecordTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'linked_record', value: [] });
    });

    it('returns empty array for undefined input', () => {
      const result = airtableLinkedRecordTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'linked_record', value: [] });
    });

    it('returns empty array for non-array input', () => {
      const result = airtableLinkedRecordTransform.toCanonical('recAAA', baseConfig);
      expect(result).toEqual({ type: 'linked_record', value: [] });
    });

    it('coerces non-string elements to string', () => {
      const result = airtableLinkedRecordTransform.toCanonical(
        [123],
        baseConfig,
      );
      expect(result).toEqual({
        type: 'linked_record',
        value: [
          { record_id: null, platform_record_id: '123', filtered_out: true },
        ],
      });
    });
  });

  describe('fromCanonical', () => {
    it('converts filtered-out entries using platform_record_id', () => {
      const canonical: CanonicalValue = {
        type: 'linked_record',
        value: [
          { record_id: null, platform_record_id: 'recCCC', filtered_out: true },
        ],
      };
      const result = airtableLinkedRecordTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual(['recCCC']);
    });

    it('converts resolved entries using reverseRecordIdMap', () => {
      const config: PlatformFieldConfig = {
        ...baseConfig,
        options: {
          ...baseConfig.options,
          reverseRecordIdMap: { 'es-uuid-111': 'recAAA' },
        },
      };
      const canonical: CanonicalValue = {
        type: 'linked_record',
        value: [{ record_id: 'es-uuid-111' }],
      };
      const result = airtableLinkedRecordTransform.fromCanonical(canonical, config);
      expect(result).toEqual(['recAAA']);
    });

    it('skips entries that cannot be resolved', () => {
      const canonical: CanonicalValue = {
        type: 'linked_record',
        value: [
          { record_id: 'es-uuid-999' },
        ],
      };
      const result = airtableLinkedRecordTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty value', () => {
      const canonical: CanonicalValue = { type: 'linked_record', value: [] };
      const result = airtableLinkedRecordTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([]);
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableLinkedRecordTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableLinkedRecordTransform.isLossless).toBe(true);
  });

  it('supports read and write operations', () => {
    expect(airtableLinkedRecordTransform.supportedOperations).toEqual(['read', 'write']);
  });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('relational transforms registration', () => {
  it('registers multipleRecordLinks', () => {
    const types = AIRTABLE_RELATIONAL_TRANSFORMS.map((t) => t.airtableType);
    expect(types).toEqual(['multipleRecordLinks']);
  });
});
