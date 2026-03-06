import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableNumberTransform,
  airtableCurrencyTransform,
  airtablePercentTransform,
  airtableRatingTransform,
  airtableDurationTransform,
  airtableProgressTransform,
  airtableAutoNumberTransform,
} from '../number-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldNum456',
  name: 'Number Field',
  platformFieldType: 'number',
};

// ---------------------------------------------------------------------------
// number → number
// ---------------------------------------------------------------------------

describe('airtableNumberTransform', () => {
  describe('toCanonical', () => {
    it('converts an integer to number canonical form', () => {
      expect(airtableNumberTransform.toCanonical(42, baseConfig)).toEqual({
        type: 'number', value: 42,
      });
    });

    it('converts a float to number canonical form', () => {
      expect(airtableNumberTransform.toCanonical(3.14, baseConfig)).toEqual({
        type: 'number', value: 3.14,
      });
    });

    it('returns null value for null input', () => {
      expect(airtableNumberTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'number', value: null,
      });
    });

    it('returns null value for undefined input', () => {
      expect(airtableNumberTransform.toCanonical(undefined, baseConfig)).toEqual({
        type: 'number', value: null,
      });
    });

    it('returns null value for NaN input', () => {
      expect(airtableNumberTransform.toCanonical('not a number', baseConfig)).toEqual({
        type: 'number', value: null,
      });
    });

    it('coerces numeric string to number', () => {
      expect(airtableNumberTransform.toCanonical('99', baseConfig)).toEqual({
        type: 'number', value: 99,
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the numeric value', () => {
      const canonical: CanonicalValue = { type: 'number', value: 42 };
      expect(airtableNumberTransform.fromCanonical(canonical, baseConfig)).toBe(42);
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'number', value: null };
      expect(airtableNumberTransform.fromCanonical(canonical, baseConfig)).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'hello' };
      expect(airtableNumberTransform.fromCanonical(canonical, baseConfig)).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// currency → currency
// ---------------------------------------------------------------------------

describe('airtableCurrencyTransform', () => {
  describe('toCanonical', () => {
    it('converts a currency value to canonical form', () => {
      expect(airtableCurrencyTransform.toCanonical(1500.50, baseConfig)).toEqual({
        type: 'currency', value: 1500.50,
      });
    });

    it('returns null value for null input', () => {
      expect(airtableCurrencyTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'currency', value: null,
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the numeric value', () => {
      const canonical: CanonicalValue = { type: 'currency', value: 1500.50 };
      expect(airtableCurrencyTransform.fromCanonical(canonical, baseConfig)).toBe(1500.50);
    });
  });
});

// ---------------------------------------------------------------------------
// percent → percent
// ---------------------------------------------------------------------------

describe('airtablePercentTransform', () => {
  describe('toCanonical', () => {
    it('passes decimal value through (0.75 = 75%)', () => {
      expect(airtablePercentTransform.toCanonical(0.75, baseConfig)).toEqual({
        type: 'percent', value: 0.75,
      });
    });

    it('returns null value for null input', () => {
      expect(airtablePercentTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'percent', value: null,
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the decimal value', () => {
      const canonical: CanonicalValue = { type: 'percent', value: 0.75 };
      expect(airtablePercentTransform.fromCanonical(canonical, baseConfig)).toBe(0.75);
    });
  });
});

// ---------------------------------------------------------------------------
// rating → rating
// ---------------------------------------------------------------------------

describe('airtableRatingTransform', () => {
  describe('toCanonical', () => {
    it('converts integer rating', () => {
      expect(airtableRatingTransform.toCanonical(4, baseConfig)).toEqual({
        type: 'rating', value: 4,
      });
    });

    it('rounds non-integer rating to nearest integer', () => {
      expect(airtableRatingTransform.toCanonical(3.7, baseConfig)).toEqual({
        type: 'rating', value: 4,
      });
    });

    it('returns null value for null input', () => {
      expect(airtableRatingTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'rating', value: null,
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the integer value', () => {
      const canonical: CanonicalValue = { type: 'rating', value: 5 };
      expect(airtableRatingTransform.fromCanonical(canonical, baseConfig)).toBe(5);
    });
  });
});

// ---------------------------------------------------------------------------
// duration → duration (seconds ↔ minutes)
// ---------------------------------------------------------------------------

describe('airtableDurationTransform', () => {
  describe('toCanonical', () => {
    it('converts Airtable seconds to canonical minutes', () => {
      expect(airtableDurationTransform.toCanonical(120, baseConfig)).toEqual({
        type: 'duration', value: 2,
      });
    });

    it('handles fractional minutes (90 seconds = 1.5 minutes)', () => {
      expect(airtableDurationTransform.toCanonical(90, baseConfig)).toEqual({
        type: 'duration', value: 1.5,
      });
    });

    it('handles zero duration', () => {
      expect(airtableDurationTransform.toCanonical(0, baseConfig)).toEqual({
        type: 'duration', value: 0,
      });
    });

    it('returns null value for null input', () => {
      expect(airtableDurationTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'duration', value: null,
      });
    });

    it('returns null value for undefined input', () => {
      expect(airtableDurationTransform.toCanonical(undefined, baseConfig)).toEqual({
        type: 'duration', value: null,
      });
    });
  });

  describe('fromCanonical', () => {
    it('converts canonical minutes back to Airtable seconds', () => {
      const canonical: CanonicalValue = { type: 'duration', value: 2 };
      expect(airtableDurationTransform.fromCanonical(canonical, baseConfig)).toBe(120);
    });

    it('handles fractional minutes (1.5 minutes = 90 seconds)', () => {
      const canonical: CanonicalValue = { type: 'duration', value: 1.5 };
      expect(airtableDurationTransform.fromCanonical(canonical, baseConfig)).toBe(90);
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'duration', value: null };
      expect(airtableDurationTransform.fromCanonical(canonical, baseConfig)).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'number', value: 120 };
      expect(airtableDurationTransform.fromCanonical(canonical, baseConfig)).toBeNull();
    });
  });

  it('round-trips correctly (120s → 2min → 120s)', () => {
    const toCanonical = airtableDurationTransform.toCanonical(120, baseConfig);
    const backToAirtable = airtableDurationTransform.fromCanonical(toCanonical, baseConfig);
    expect(backToAirtable).toBe(120);
  });
});

// ---------------------------------------------------------------------------
// progress → progress
// ---------------------------------------------------------------------------

describe('airtableProgressTransform', () => {
  describe('toCanonical', () => {
    it('converts progress value (0-100)', () => {
      expect(airtableProgressTransform.toCanonical(75, baseConfig)).toEqual({
        type: 'progress', value: 75,
      });
    });

    it('returns null value for null input', () => {
      expect(airtableProgressTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'progress', value: null,
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the progress value', () => {
      const canonical: CanonicalValue = { type: 'progress', value: 75 };
      expect(airtableProgressTransform.fromCanonical(canonical, baseConfig)).toBe(75);
    });
  });
});

// ---------------------------------------------------------------------------
// autoNumber → auto_number (read-only)
// ---------------------------------------------------------------------------

describe('airtableAutoNumberTransform', () => {
  describe('toCanonical', () => {
    it('converts auto number integer', () => {
      expect(airtableAutoNumberTransform.toCanonical(1001, baseConfig)).toEqual({
        type: 'auto_number', value: 1001,
      });
    });

    it('rounds non-integer values', () => {
      expect(airtableAutoNumberTransform.toCanonical(5.9, baseConfig)).toEqual({
        type: 'auto_number', value: 6,
      });
    });

    it('returns null value for null input', () => {
      expect(airtableAutoNumberTransform.toCanonical(null, baseConfig)).toEqual({
        type: 'auto_number', value: null,
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the integer value', () => {
      const canonical: CanonicalValue = { type: 'auto_number', value: 1001 };
      expect(airtableAutoNumberTransform.fromCanonical(canonical, baseConfig)).toBe(1001);
    });
  });

  it('is read-only (no write operation)', () => {
    expect(airtableAutoNumberTransform.supportedOperations).toEqual(['read']);
    expect(airtableAutoNumberTransform.supportedOperations).not.toContain('write');
  });
});
