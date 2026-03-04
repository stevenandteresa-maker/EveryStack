import { describe, it, expect } from 'vitest';
import { canonicalToAIContext } from '../canonical-to-ai';
import type {
  NumberFieldConfig,
  SingleSelectFieldConfig,
  TextFieldConfig,
  CheckboxFieldConfig,
} from '../types';

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

describe('canonicalToAIContext — text', () => {
  const config: TextFieldConfig = {};

  it('returns string as-is', () => {
    expect(canonicalToAIContext('hello world', 'text', config)).toBe(
      'hello world',
    );
  });

  it('returns empty string for empty text', () => {
    expect(canonicalToAIContext('', 'text', config)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(canonicalToAIContext(null, 'text', config)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(canonicalToAIContext(undefined, 'text', config)).toBe('');
  });

  it('handles very long strings', () => {
    const long = 'a'.repeat(10_000);
    expect(canonicalToAIContext(long, 'text', config)).toBe(long);
  });

  it('converts non-string values to string', () => {
    expect(canonicalToAIContext(42, 'text', config)).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

describe('canonicalToAIContext — number', () => {
  it('formats integer with no config', () => {
    const config: NumberFieldConfig = {};
    expect(canonicalToAIContext(15000, 'number', config)).toBe('15000');
  });

  it('formats with precision', () => {
    const config: NumberFieldConfig = { precision: 2 };
    expect(canonicalToAIContext(15000.5, 'number', config)).toBe('15000.50');
  });

  it('formats with thousands separator', () => {
    const config: NumberFieldConfig = { thousands_separator: true };
    expect(canonicalToAIContext(15000, 'number', config)).toBe('15,000');
  });

  it('formats with thousands separator and precision', () => {
    const config: NumberFieldConfig = {
      thousands_separator: true,
      precision: 2,
    };
    expect(canonicalToAIContext(15000.5, 'number', config)).toBe('15,000.50');
  });

  it('handles zero', () => {
    const config: NumberFieldConfig = { precision: 2 };
    expect(canonicalToAIContext(0, 'number', config)).toBe('0.00');
  });

  it('handles negative numbers with thousands separator', () => {
    const config: NumberFieldConfig = {
      thousands_separator: true,
      precision: 2,
    };
    expect(canonicalToAIContext(-1500.75, 'number', config)).toBe('-1,500.75');
  });

  it('handles small numbers (no thousands separator needed)', () => {
    const config: NumberFieldConfig = { thousands_separator: true };
    expect(canonicalToAIContext(42, 'number', config)).toBe('42');
  });

  it('returns empty string for null', () => {
    const config: NumberFieldConfig = {};
    expect(canonicalToAIContext(null, 'number', config)).toBe('');
  });

  it('handles NaN values gracefully', () => {
    const config: NumberFieldConfig = {};
    expect(canonicalToAIContext('not a number', 'number', config)).toBe(
      'not a number',
    );
  });

  it('handles large numbers', () => {
    const config: NumberFieldConfig = {
      thousands_separator: true,
      precision: 0,
    };
    expect(canonicalToAIContext(1234567890, 'number', config)).toBe(
      '1,234,567,890',
    );
  });
});

// ---------------------------------------------------------------------------
// Single Select
// ---------------------------------------------------------------------------

describe('canonicalToAIContext — single_select', () => {
  const config: SingleSelectFieldConfig = {
    options: [
      { id: 'opt_1', label: 'Active', color: 'green' },
      { id: 'opt_2', label: 'Inactive', color: 'red' },
      { id: 'opt_3', label: 'Pending Review', color: 'yellow' },
    ],
  };

  it('resolves option ID to label', () => {
    expect(canonicalToAIContext('opt_1', 'single_select', config)).toBe(
      'Active',
    );
  });

  it('resolves another option ID to label', () => {
    expect(canonicalToAIContext('opt_3', 'single_select', config)).toBe(
      'Pending Review',
    );
  });

  it('returns raw value when option ID not found', () => {
    expect(canonicalToAIContext('opt_unknown', 'single_select', config)).toBe(
      'opt_unknown',
    );
  });

  it('returns empty string for null', () => {
    expect(canonicalToAIContext(null, 'single_select', config)).toBe('');
  });

  it('handles empty options array', () => {
    const emptyConfig: SingleSelectFieldConfig = { options: [] };
    expect(canonicalToAIContext('opt_1', 'single_select', emptyConfig)).toBe(
      'opt_1',
    );
  });
});

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

describe('canonicalToAIContext — checkbox', () => {
  const config: CheckboxFieldConfig = {};

  it('returns "Yes" for true', () => {
    expect(canonicalToAIContext(true, 'checkbox', config)).toBe('Yes');
  });

  it('returns "No" for false', () => {
    expect(canonicalToAIContext(false, 'checkbox', config)).toBe('No');
  });

  it('returns "Yes" for string "true"', () => {
    expect(canonicalToAIContext('true', 'checkbox', config)).toBe('Yes');
  });

  it('returns "No" for string "false"', () => {
    expect(canonicalToAIContext('false', 'checkbox', config)).toBe('No');
  });

  it('returns "No" for 0', () => {
    expect(canonicalToAIContext(0, 'checkbox', config)).toBe('No');
  });

  it('returns "No" for null', () => {
    expect(canonicalToAIContext(null, 'checkbox', config)).toBe('');
  });
});
