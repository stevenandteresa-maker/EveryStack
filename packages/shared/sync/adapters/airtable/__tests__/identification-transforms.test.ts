import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableBarcodeTransform,
  AIRTABLE_IDENTIFICATION_TRANSFORMS,
} from '../identification-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldBarcode001',
  name: 'Product Code',
  platformFieldType: 'barcode',
};

// ---------------------------------------------------------------------------
// barcode → barcode
// ---------------------------------------------------------------------------

describe('airtableBarcodeTransform', () => {
  describe('toCanonical', () => {
    it('unwraps Airtable {text} object to canonical string', () => {
      const result = airtableBarcodeTransform.toCanonical(
        { text: 'ABC-12345' },
        baseConfig,
      );
      expect(result).toEqual({ type: 'barcode', value: 'ABC-12345' });
    });

    it('handles numeric text value', () => {
      const result = airtableBarcodeTransform.toCanonical(
        { text: 12345 },
        baseConfig,
      );
      expect(result).toEqual({ type: 'barcode', value: '12345' });
    });

    it('returns null for null text value inside object', () => {
      const result = airtableBarcodeTransform.toCanonical(
        { text: null },
        baseConfig,
      );
      expect(result).toEqual({ type: 'barcode', value: null });
    });

    it('accepts a raw string as fallback', () => {
      const result = airtableBarcodeTransform.toCanonical(
        'RAW-STRING-CODE',
        baseConfig,
      );
      expect(result).toEqual({ type: 'barcode', value: 'RAW-STRING-CODE' });
    });

    it('returns null for null input', () => {
      const result = airtableBarcodeTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'barcode', value: null });
    });

    it('returns null for undefined input', () => {
      const result = airtableBarcodeTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'barcode', value: null });
    });

    it('returns null for non-string/non-object input', () => {
      const result = airtableBarcodeTransform.toCanonical(42, baseConfig);
      expect(result).toEqual({ type: 'barcode', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('wraps canonical string in {text} object', () => {
      const canonical: CanonicalValue = { type: 'barcode', value: 'XYZ-999' };
      const result = airtableBarcodeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual({ text: 'XYZ-999' });
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'barcode', value: null };
      const result = airtableBarcodeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableBarcodeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableBarcodeTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableBarcodeTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('barcode transform round-trip', () => {
  it('round-trips {text} object losslessly', () => {
    const canonical = airtableBarcodeTransform.toCanonical({ text: 'UPC-123' }, baseConfig);
    const platformValue = airtableBarcodeTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toEqual({ text: 'UPC-123' });
  });

  it('round-trips null value', () => {
    const canonical = airtableBarcodeTransform.toCanonical(null, baseConfig);
    const platformValue = airtableBarcodeTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

describe('identification transforms registration', () => {
  it('registers barcode', () => {
    const types = AIRTABLE_IDENTIFICATION_TRANSFORMS.map((t) => t.airtableType);
    expect(types).toEqual(['barcode']);
  });
});
