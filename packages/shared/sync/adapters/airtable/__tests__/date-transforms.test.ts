import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableDateTransform,
  airtableDateRangeTransform,
  airtableDueDateTransform,
  airtableTimeTransform,
  airtableCreatedAtTransform,
  airtableUpdatedAtTransform,
} from '../date-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldDate001',
  name: 'Date Field',
  platformFieldType: 'date',
};

function configWithTimezone(timezone: string): PlatformFieldConfig {
  return { ...baseConfig, options: { timezone } };
}

// ---------------------------------------------------------------------------
// date/dateTime → date
// ---------------------------------------------------------------------------

describe('airtableDateTransform', () => {
  describe('toCanonical', () => {
    it('converts date-only ISO string', () => {
      const result = airtableDateTransform.toCanonical('2024-03-15', baseConfig);
      expect(result).toEqual({ type: 'date', value: '2024-03-15' });
    });

    it('converts datetime ISO string', () => {
      const result = airtableDateTransform.toCanonical('2024-03-15T10:30:00.000Z', baseConfig);
      expect(result).toEqual({ type: 'date', value: '2024-03-15T10:30:00.000Z' });
    });

    it('returns null value for null input', () => {
      const result = airtableDateTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'date', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableDateTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'date', value: null });
    });

    it('preserves date-only strings without timezone manipulation', () => {
      const config = configWithTimezone('America/New_York');
      const result = airtableDateTransform.toCanonical('2024-03-15', config);
      expect(result).toEqual({ type: 'date', value: '2024-03-15' });
    });

    it('normalizes datetime with UTC timezone config', () => {
      const config = configWithTimezone('utc');
      const result = airtableDateTransform.toCanonical('2024-03-15T10:30:00.000Z', config);
      expect(result).toEqual({ type: 'date', value: '2024-03-15T10:30:00.000Z' });
    });

    it('handles datetime with workspace timezone config', () => {
      const config = configWithTimezone('America/New_York');
      const result = airtableDateTransform.toCanonical('2024-03-15T10:30:00.000Z', config);
      expect(result.type).toBe('date');
      // Value should be a valid ISO string
      expect(typeof (result as { type: 'date'; value: string }).value).toBe('string');
    });
  });

  describe('fromCanonical', () => {
    it('returns the ISO string value', () => {
      const canonical: CanonicalValue = { type: 'date', value: '2024-03-15' };
      const result = airtableDateTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('2024-03-15');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'date', value: null };
      const result = airtableDateTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableDateTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableDateTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableDateTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// dateTime (start/end) → date_range
// ---------------------------------------------------------------------------

describe('airtableDateRangeTransform', () => {
  describe('toCanonical', () => {
    it('converts start/end object to date_range', () => {
      const result = airtableDateRangeTransform.toCanonical(
        { start: '2024-03-15', end: '2024-03-20' },
        baseConfig,
      );
      expect(result).toEqual({
        type: 'date_range',
        value: { start: '2024-03-15', end: '2024-03-20' },
      });
    });

    it('handles start-only (end null)', () => {
      const result = airtableDateRangeTransform.toCanonical(
        { start: '2024-03-15', end: null },
        baseConfig,
      );
      expect(result).toEqual({
        type: 'date_range',
        value: { start: '2024-03-15', end: null },
      });
    });

    it('handles single date string as start-only', () => {
      const result = airtableDateRangeTransform.toCanonical('2024-03-15', baseConfig);
      expect(result).toEqual({
        type: 'date_range',
        value: { start: '2024-03-15', end: null },
      });
    });

    it('returns null value for null input', () => {
      const result = airtableDateRangeTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'date_range', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableDateRangeTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'date_range', value: null });
    });

    it('handles datetime ISO strings with timezone normalization', () => {
      const result = airtableDateRangeTransform.toCanonical(
        { start: '2024-03-15T09:00:00.000Z', end: '2024-03-20T17:00:00.000Z' },
        baseConfig,
      );
      const val = (result as { type: 'date_range'; value: { start: string; end: string } }).value;
      expect(val.start).toBe('2024-03-15T09:00:00.000Z');
      expect(val.end).toBe('2024-03-20T17:00:00.000Z');
    });
  });

  describe('fromCanonical', () => {
    it('returns start/end object', () => {
      const canonical: CanonicalValue = {
        type: 'date_range',
        value: { start: '2024-03-15', end: '2024-03-20' },
      };
      const result = airtableDateRangeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual({ start: '2024-03-15', end: '2024-03-20' });
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'date_range', value: null };
      const result = airtableDateRangeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableDateRangeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableDateRangeTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// date/dateTime → due_date
// ---------------------------------------------------------------------------

describe('airtableDueDateTransform', () => {
  describe('toCanonical', () => {
    it('converts ISO string to due_date', () => {
      const result = airtableDueDateTransform.toCanonical('2024-03-20', baseConfig);
      expect(result).toEqual({ type: 'due_date', value: '2024-03-20' });
    });

    it('converts datetime ISO string to due_date', () => {
      const result = airtableDueDateTransform.toCanonical('2024-03-20T17:00:00.000Z', baseConfig);
      expect(result).toEqual({ type: 'due_date', value: '2024-03-20T17:00:00.000Z' });
    });

    it('returns null value for null input', () => {
      const result = airtableDueDateTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'due_date', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the ISO string value', () => {
      const canonical: CanonicalValue = { type: 'due_date', value: '2024-03-20' };
      const result = airtableDueDateTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('2024-03-20');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'due_date', value: null };
      const result = airtableDueDateTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableDueDateTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableDueDateTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableDueDateTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// dateTime → time
// ---------------------------------------------------------------------------

describe('airtableTimeTransform', () => {
  describe('toCanonical', () => {
    it('extracts HH:MM from ISO datetime', () => {
      const result = airtableTimeTransform.toCanonical('2024-03-15T14:30:00.000Z', baseConfig);
      expect(result).toEqual({ type: 'time', value: '14:30' });
    });

    it('passes through HH:MM format directly', () => {
      const result = airtableTimeTransform.toCanonical('09:15', baseConfig);
      expect(result).toEqual({ type: 'time', value: '09:15' });
    });

    it('handles midnight correctly', () => {
      const result = airtableTimeTransform.toCanonical('2024-03-15T00:00:00.000Z', baseConfig);
      expect(result).toEqual({ type: 'time', value: '00:00' });
    });

    it('returns null value for null input', () => {
      const result = airtableTimeTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'time', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableTimeTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'time', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the HH:MM string', () => {
      const canonical: CanonicalValue = { type: 'time', value: '14:30' };
      const result = airtableTimeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('14:30');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'time', value: null };
      const result = airtableTimeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableTimeTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableTimeTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createdTime → created_at (read-only)
// ---------------------------------------------------------------------------

describe('airtableCreatedAtTransform', () => {
  describe('toCanonical', () => {
    it('converts ISO string to created_at', () => {
      const result = airtableCreatedAtTransform.toCanonical('2024-01-01T12:00:00.000Z', baseConfig);
      expect(result).toEqual({ type: 'created_at', value: '2024-01-01T12:00:00.000Z' });
    });

    it('returns null value for null input', () => {
      const result = airtableCreatedAtTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'created_at', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the ISO string value', () => {
      const canonical: CanonicalValue = { type: 'created_at', value: '2024-01-01T12:00:00.000Z' };
      const result = airtableCreatedAtTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('2024-01-01T12:00:00.000Z');
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableCreatedAtTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableCreatedAtTransform.isLossless).toBe(true);
  });

  it('is read-only (supportedOperations: read only)', () => {
    expect(airtableCreatedAtTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// lastModifiedTime → updated_at (read-only)
// ---------------------------------------------------------------------------

describe('airtableUpdatedAtTransform', () => {
  describe('toCanonical', () => {
    it('converts ISO string to updated_at', () => {
      const result = airtableUpdatedAtTransform.toCanonical('2024-06-15T08:45:00.000Z', baseConfig);
      expect(result).toEqual({ type: 'updated_at', value: '2024-06-15T08:45:00.000Z' });
    });

    it('returns null value for null input', () => {
      const result = airtableUpdatedAtTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'updated_at', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the ISO string value', () => {
      const canonical: CanonicalValue = { type: 'updated_at', value: '2024-06-15T08:45:00.000Z' };
      const result = airtableUpdatedAtTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('2024-06-15T08:45:00.000Z');
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableUpdatedAtTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableUpdatedAtTransform.isLossless).toBe(true);
  });

  it('is read-only (supportedOperations: read only)', () => {
    expect(airtableUpdatedAtTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('date transforms round-trip', () => {
  it('date round-trips losslessly', () => {
    const canonical = airtableDateTransform.toCanonical('2024-03-15', baseConfig);
    const platformValue = airtableDateTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('2024-03-15');
  });

  it('date with time round-trips losslessly', () => {
    const canonical = airtableDateTransform.toCanonical('2024-03-15T10:30:00.000Z', baseConfig);
    const platformValue = airtableDateTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('2024-03-15T10:30:00.000Z');
  });

  it('date_range round-trips losslessly', () => {
    const input = { start: '2024-03-15', end: '2024-03-20' };
    const canonical = airtableDateRangeTransform.toCanonical(input, baseConfig);
    const platformValue = airtableDateRangeTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toEqual(input);
  });

  it('due_date round-trips losslessly', () => {
    const canonical = airtableDueDateTransform.toCanonical('2024-03-20', baseConfig);
    const platformValue = airtableDueDateTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('2024-03-20');
  });
});
