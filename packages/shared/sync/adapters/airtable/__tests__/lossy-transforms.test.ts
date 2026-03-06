import { describe, it, expect, beforeAll } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableLookupTransform,
  airtableRollupTransform,
  airtableFormulaTransform,
  airtableCountTransform,
  AIRTABLE_LOSSY_TRANSFORMS,
} from '../lossy-transforms';
import { fieldTypeRegistry } from '../../../field-registry';
import { registerAirtableTransforms } from '../index';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldComputed001',
  name: 'Computed Field',
  platformFieldType: 'lookup',
};

// ---------------------------------------------------------------------------
// Shared behavior for all lossy transforms
// ---------------------------------------------------------------------------

describe.each([
  { name: 'lookup', transform: airtableLookupTransform },
  { name: 'rollup', transform: airtableRollupTransform },
  { name: 'formula', transform: airtableFormulaTransform },
  { name: 'count', transform: airtableCountTransform },
])('$name transform', ({ transform }) => {
  describe('toCanonical', () => {
    it('stores string value as text', () => {
      const result = transform.toCanonical('computed result', baseConfig);
      expect(result).toEqual({ type: 'text', value: 'computed result' });
    });

    it('stores numeric value as string text', () => {
      const result = transform.toCanonical(42, baseConfig);
      expect(result).toEqual({ type: 'text', value: '42' });
    });

    it('joins array values as comma-separated text', () => {
      const result = transform.toCanonical(['Alice', 'Bob', 'Charlie'], baseConfig);
      expect(result).toEqual({ type: 'text', value: 'Alice, Bob, Charlie' });
    });

    it('handles numeric array values', () => {
      const result = transform.toCanonical([10, 20, 30], baseConfig);
      expect(result).toEqual({ type: 'text', value: '10, 20, 30' });
    });

    it('returns null for null input', () => {
      const result = transform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('returns null for undefined input', () => {
      const result = transform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'text', value: null });
    });

    it('stores boolean value as string', () => {
      const result = transform.toCanonical(true, baseConfig);
      expect(result).toEqual({ type: 'text', value: 'true' });
    });
  });

  describe('fromCanonical', () => {
    it('returns undefined (no-op — never writes computed fields)', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'computed result' };
      const result = transform.fromCanonical(canonical, baseConfig);
      expect(result).toBeUndefined();
    });

    it('returns undefined for any canonical type', () => {
      const canonical: CanonicalValue = { type: 'number', value: 42 };
      const result = transform.fromCanonical(canonical, baseConfig);
      expect(result).toBeUndefined();
    });
  });

  it('is marked as NOT lossless', () => {
    expect(transform.isLossless).toBe(false);
  });

  it('supports read-only operations', () => {
    expect(transform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('lossy transforms registration', () => {
  it('registers all 4 computed field types', () => {
    const types = AIRTABLE_LOSSY_TRANSFORMS.map((t) => t.airtableType);
    expect(types).toEqual(['lookup', 'rollup', 'formula', 'count']);
  });
});

// ---------------------------------------------------------------------------
// Integration: adapter skips lossy fields on outbound sync
// ---------------------------------------------------------------------------

describe('lossy fields are skipped on outbound sync', () => {
  beforeAll(() => {
    fieldTypeRegistry.clear();
    registerAirtableTransforms();
  });

  it('lookup is registered and read-only', () => {
    expect(fieldTypeRegistry.has('airtable', 'lookup')).toBe(true);
    const transform = fieldTypeRegistry.get('airtable', 'lookup');
    expect(transform.supportedOperations).toEqual(['read']);
    expect(transform.supportedOperations.includes('write')).toBe(false);
  });

  it('rollup is registered and read-only', () => {
    expect(fieldTypeRegistry.has('airtable', 'rollup')).toBe(true);
    const transform = fieldTypeRegistry.get('airtable', 'rollup');
    expect(transform.supportedOperations).toEqual(['read']);
  });

  it('formula is registered and read-only', () => {
    expect(fieldTypeRegistry.has('airtable', 'formula')).toBe(true);
    const transform = fieldTypeRegistry.get('airtable', 'formula');
    expect(transform.supportedOperations).toEqual(['read']);
  });

  it('count is registered and read-only', () => {
    expect(fieldTypeRegistry.has('airtable', 'count')).toBe(true);
    const transform = fieldTypeRegistry.get('airtable', 'count');
    expect(transform.supportedOperations).toEqual(['read']);
  });
});
