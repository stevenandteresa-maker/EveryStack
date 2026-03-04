import { describe, it, expect } from 'vitest';
import { aiToCanonical } from '../ai-to-canonical';
import { canonicalToAIContext } from '../canonical-to-ai';
import {
  isAIToCanonicalSuccess,
  isAIToCanonicalError,
} from '../types';
import type {
  TextFieldConfig,
  NumberFieldConfig,
  SingleSelectFieldConfig,
  CheckboxFieldConfig,
  AIToCanonicalSuccess,
} from '../types';

// ---------------------------------------------------------------------------
// Helper: assert success result
// ---------------------------------------------------------------------------

function expectSuccess(
  result: ReturnType<typeof aiToCanonical>,
): AIToCanonicalSuccess {
  expect(isAIToCanonicalSuccess(result)).toBe(true);
  return result as AIToCanonicalSuccess;
}

function expectError(
  result: ReturnType<typeof aiToCanonical>,
): string {
  expect(isAIToCanonicalError(result)).toBe(true);
  return (result as { error: string }).error;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

describe('aiToCanonical — text', () => {
  const config: TextFieldConfig = {};

  it('returns string as-is', () => {
    const result = expectSuccess(aiToCanonical('hello world', 'text', config));
    expect(result.value).toBe('hello world');
    expect(result.warnings).toHaveLength(0);
  });

  it('handles empty string', () => {
    const result = expectSuccess(aiToCanonical('', 'text', config));
    expect(result.value).toBe('');
    expect(result.warnings).toHaveLength(0);
  });

  it('truncates when max_length is configured', () => {
    const limitedConfig: TextFieldConfig = { max_length: 10 };
    const result = expectSuccess(
      aiToCanonical('this is a very long string', 'text', limitedConfig),
    );
    expect(result.value).toBe('this is a ');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('truncated');
    expect(result.warnings[0]).toContain('10');
  });

  it('does not truncate when within max_length', () => {
    const limitedConfig: TextFieldConfig = { max_length: 100 };
    const result = expectSuccess(
      aiToCanonical('short text', 'text', limitedConfig),
    );
    expect(result.value).toBe('short text');
    expect(result.warnings).toHaveLength(0);
  });

  it('handles very long text truncation', () => {
    const limitedConfig: TextFieldConfig = { max_length: 5 };
    const longInput = 'a'.repeat(10_000);
    const result = expectSuccess(
      aiToCanonical(longInput, 'text', limitedConfig),
    );
    expect(result.value).toBe('aaaaa');
    expect(result.warnings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

describe('aiToCanonical — number', () => {
  const config: NumberFieldConfig = { precision: 2 };

  it('parses simple number', () => {
    const result = expectSuccess(aiToCanonical('42', 'number', config));
    expect(result.value).toBe(42);
  });

  it('parses decimal number', () => {
    const result = expectSuccess(aiToCanonical('15000.50', 'number', config));
    expect(result.value).toBe(15000.5);
  });

  it('strips dollar sign and commas from currency', () => {
    const result = expectSuccess(
      aiToCanonical('$15,000.50', 'number', config),
    );
    expect(result.value).toBe(15000.5);
  });

  it('strips euro sign', () => {
    const result = expectSuccess(aiToCanonical('€1,234.56', 'number', config));
    expect(result.value).toBe(1234.56);
  });

  it('strips percentage sign', () => {
    const result = expectSuccess(aiToCanonical('75%', 'number', config));
    expect(result.value).toBe(75);
  });

  it('strips whitespace', () => {
    const result = expectSuccess(
      aiToCanonical('  1 234  ', 'number', config),
    );
    expect(result.value).toBe(1234);
  });

  it('handles negative numbers', () => {
    const result = expectSuccess(aiToCanonical('-42.5', 'number', config));
    expect(result.value).toBe(-42.5);
  });

  it('applies precision rounding', () => {
    const intConfig: NumberFieldConfig = { precision: 0 };
    const result = expectSuccess(aiToCanonical('42.7', 'number', intConfig));
    expect(result.value).toBe(43);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('rounded');
  });

  it('rounds to configured precision', () => {
    const precConfig: NumberFieldConfig = { precision: 1 };
    const result = expectSuccess(
      aiToCanonical('42.789', 'number', precConfig),
    );
    expect(result.value).toBe(42.8);
    expect(result.warnings).toHaveLength(1);
  });

  it('returns error when no number found', () => {
    const error = expectError(
      aiToCanonical('no numbers here', 'number', config),
    );
    expect(error).toContain('No numeric value');
  });

  it('returns error for empty string', () => {
    const error = expectError(aiToCanonical('', 'number', config));
    expect(error).toContain('No numeric value');
  });

  it('extracts number from text with units', () => {
    const result = expectSuccess(aiToCanonical('$15,000.50 USD', 'number', config));
    expect(result.value).toBe(15000.5);
  });

  it('handles number with many commas', () => {
    const result = expectSuccess(
      aiToCanonical('1,234,567,890', 'number', { precision: 0 }),
    );
    expect(result.value).toBe(1234567890);
  });

  it('handles zero precision by default', () => {
    const noConfig: NumberFieldConfig = {};
    const result = expectSuccess(aiToCanonical('42.7', 'number', noConfig));
    expect(result.value).toBe(43);
  });

  it('handles British pound sign', () => {
    const result = expectSuccess(aiToCanonical('£500', 'number', config));
    expect(result.value).toBe(500);
  });

  it('handles Japanese yen sign', () => {
    const result = expectSuccess(aiToCanonical('¥10000', 'number', config));
    expect(result.value).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Single Select
// ---------------------------------------------------------------------------

describe('aiToCanonical — single_select', () => {
  const config: SingleSelectFieldConfig = {
    options: [
      { id: 'opt_1', label: 'Active', color: 'green' },
      { id: 'opt_2', label: 'Inactive', color: 'red' },
      { id: 'opt_3', label: 'Pending Review', color: 'yellow' },
    ],
  };

  it('matches exact label', () => {
    const result = expectSuccess(
      aiToCanonical('Active', 'single_select', config),
    );
    expect(result.value).toBe('opt_1');
    expect(result.warnings).toHaveLength(0);
  });

  it('matches case-insensitive', () => {
    const result = expectSuccess(
      aiToCanonical('active', 'single_select', config),
    );
    expect(result.value).toBe('opt_1');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('case-insensitive');
  });

  it('matches UPPERCASE', () => {
    const result = expectSuccess(
      aiToCanonical('INACTIVE', 'single_select', config),
    );
    expect(result.value).toBe('opt_2');
  });

  it('matches with extra whitespace (trimmed)', () => {
    const result = expectSuccess(
      aiToCanonical('  Active  ', 'single_select', config),
    );
    expect(result.value).toBe('opt_1');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('trimmed');
  });

  it('extracts from single-quoted explanatory text', () => {
    const result = expectSuccess(
      aiToCanonical("I'd suggest 'Active'", 'single_select', config),
    );
    expect(result.value).toBe('opt_1');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Extracted');
  });

  it('extracts from double-quoted text', () => {
    const result = expectSuccess(
      aiToCanonical('The status should be "Inactive"', 'single_select', config),
    );
    expect(result.value).toBe('opt_2');
  });

  it('extracts from backtick-quoted text', () => {
    const result = expectSuccess(
      aiToCanonical(
        'Based on the data, `Pending Review` is appropriate',
        'single_select',
        config,
      ),
    );
    expect(result.value).toBe('opt_3');
  });

  it('returns error when no match found', () => {
    const error = expectError(
      aiToCanonical('Unknown Status', 'single_select', config),
    );
    expect(error).toContain('No matching option');
    expect(error).toContain('Active');
    expect(error).toContain('Inactive');
  });

  it('returns error for empty options config', () => {
    const emptyConfig: SingleSelectFieldConfig = { options: [] };
    const error = expectError(
      aiToCanonical('Active', 'single_select', emptyConfig),
    );
    expect(error).toContain('No options configured');
  });

  it('matches multi-word options', () => {
    const result = expectSuccess(
      aiToCanonical('Pending Review', 'single_select', config),
    );
    expect(result.value).toBe('opt_3');
    expect(result.warnings).toHaveLength(0);
  });

  it('extracts from smart quotes', () => {
    const result = expectSuccess(
      aiToCanonical(
        'I recommend \u201cActive\u201d for this record',
        'single_select',
        config,
      ),
    );
    expect(result.value).toBe('opt_1');
  });
});

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

describe('aiToCanonical — checkbox', () => {
  const config: CheckboxFieldConfig = {};

  it('accepts "true"', () => {
    const result = expectSuccess(aiToCanonical('true', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('accepts "false"', () => {
    const result = expectSuccess(aiToCanonical('false', 'checkbox', config));
    expect(result.value).toBe(false);
  });

  it('accepts "yes"', () => {
    const result = expectSuccess(aiToCanonical('yes', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('accepts "no"', () => {
    const result = expectSuccess(aiToCanonical('no', 'checkbox', config));
    expect(result.value).toBe(false);
  });

  it('accepts "1"', () => {
    const result = expectSuccess(aiToCanonical('1', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('accepts "0"', () => {
    const result = expectSuccess(aiToCanonical('0', 'checkbox', config));
    expect(result.value).toBe(false);
  });

  it('accepts "checked"', () => {
    const result = expectSuccess(aiToCanonical('checked', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('accepts "unchecked"', () => {
    const result = expectSuccess(
      aiToCanonical('unchecked', 'checkbox', config),
    );
    expect(result.value).toBe(false);
  });

  it('is case-insensitive: "TRUE"', () => {
    const result = expectSuccess(aiToCanonical('TRUE', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('is case-insensitive: "Yes"', () => {
    const result = expectSuccess(aiToCanonical('Yes', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('is case-insensitive: "CHECKED"', () => {
    const result = expectSuccess(aiToCanonical('CHECKED', 'checkbox', config));
    expect(result.value).toBe(true);
  });

  it('handles whitespace', () => {
    const result = expectSuccess(
      aiToCanonical('  true  ', 'checkbox', config),
    );
    expect(result.value).toBe(true);
  });

  it('returns error for unrecognized value', () => {
    const error = expectError(aiToCanonical('maybe', 'checkbox', config));
    expect(error).toContain('Unrecognized checkbox value');
    expect(error).toContain('maybe');
  });

  it('returns error for empty string', () => {
    const error = expectError(aiToCanonical('', 'checkbox', config));
    expect(error).toContain('Unrecognized checkbox value');
  });

  it('returns error for verbose AI response', () => {
    const error = expectError(
      aiToCanonical(
        'Based on the data, this should be checked',
        'checkbox',
        config,
      ),
    );
    expect(error).toContain('Unrecognized checkbox value');
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('round-trip: canonical → AI context → aiToCanonical', () => {
  it('text round-trip', () => {
    const config: TextFieldConfig = {};
    const original = 'Hello, World!';
    const aiContext = canonicalToAIContext(original, 'text', config);
    const result = expectSuccess(aiToCanonical(aiContext, 'text', config));
    expect(result.value).toBe(original);
  });

  it('number round-trip (no formatting)', () => {
    const config: NumberFieldConfig = { precision: 2 };
    const original = 42.5;
    const aiContext = canonicalToAIContext(original, 'number', config);
    const result = expectSuccess(aiToCanonical(aiContext, 'number', config));
    expect(result.value).toBe(original);
  });

  it('number round-trip (with thousands separator)', () => {
    const config: NumberFieldConfig = {
      precision: 2,
      thousands_separator: true,
    };
    const original = 15000.5;
    const aiContext = canonicalToAIContext(original, 'number', config);
    expect(aiContext).toBe('15,000.50');
    const result = expectSuccess(aiToCanonical(aiContext, 'number', config));
    expect(result.value).toBe(original);
  });

  it('single_select round-trip', () => {
    const config: SingleSelectFieldConfig = {
      options: [
        { id: 'opt_1', label: 'Active' },
        { id: 'opt_2', label: 'Inactive' },
      ],
    };
    const original = 'opt_1'; // canonical stores option ID
    const aiContext = canonicalToAIContext(original, 'single_select', config);
    expect(aiContext).toBe('Active'); // AI sees label
    const result = expectSuccess(
      aiToCanonical(aiContext, 'single_select', config),
    );
    expect(result.value).toBe(original); // back to option ID
  });

  it('checkbox round-trip (true)', () => {
    const config: CheckboxFieldConfig = {};
    const original = true;
    const aiContext = canonicalToAIContext(original, 'checkbox', config);
    expect(aiContext).toBe('Yes');
    const result = expectSuccess(aiToCanonical(aiContext, 'checkbox', config));
    expect(result.value).toBe(original);
  });

  it('checkbox round-trip (false)', () => {
    const config: CheckboxFieldConfig = {};
    const original = false;
    const aiContext = canonicalToAIContext(original, 'checkbox', config);
    expect(aiContext).toBe('No');
    const result = expectSuccess(aiToCanonical(aiContext, 'checkbox', config));
    expect(result.value).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// Validation pipeline integration (documented pattern)
// ---------------------------------------------------------------------------

describe('validation pipeline integration', () => {
  /**
   * Demonstrates the full pipeline as documented in ai-data-contract.md:
   *   Raw LLM output → aiToCanonical() → validate() → store
   *
   * aiToCanonical() does NOT replace validate(). A mock validate() is used
   * here to demonstrate the integration pattern.
   */

  function mockValidate(
    value: unknown,
    fieldConfig: { required?: boolean; max_length?: number },
  ): { valid: boolean; error?: string } {
    if (fieldConfig.required && (value === null || value === undefined || value === '')) {
      return { valid: false, error: 'Field is required' };
    }
    if (
      fieldConfig.max_length &&
      typeof value === 'string' &&
      value.length > fieldConfig.max_length
    ) {
      return { valid: false, error: `Exceeds max length of ${fieldConfig.max_length}` };
    }
    return { valid: true };
  }

  it('successful pipeline: coerce → validate → store', () => {
    // Step 1: AI outputs a number with currency symbol
    const rawLLMOutput = '$15,000.50';

    // Step 2: aiToCanonical coerces to canonical number
    const coerced = aiToCanonical(rawLLMOutput, 'number', { precision: 2 });
    expect(isAIToCanonicalSuccess(coerced)).toBe(true);
    const { value } = coerced as AIToCanonicalSuccess;
    expect(value).toBe(15000.5);

    // Step 3: validate() enforces constraints
    const validation = mockValidate(value, { required: true });
    expect(validation.valid).toBe(true);

    // Step 4: Store value in canonical_data — same write path as user input
  });

  it('coercion succeeds but validation catches constraint violation', () => {
    // AI produces text that coerces fine but violates a constraint
    const rawLLMOutput = 'This is a perfectly valid text value';

    const coerced = aiToCanonical(rawLLMOutput, 'text', {});
    expect(isAIToCanonicalSuccess(coerced)).toBe(true);
    const { value } = coerced as AIToCanonicalSuccess;

    // validate() catches the max_length constraint
    const validation = mockValidate(value, { max_length: 10 });
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain('max length');
  });

  it('coercion fails — validation never runs', () => {
    const rawLLMOutput = 'no numbers here';

    const coerced = aiToCanonical(rawLLMOutput, 'number', { precision: 2 });
    expect(isAIToCanonicalError(coerced)).toBe(true);

    // validate() is never called — coercion failed first
  });
});

// ---------------------------------------------------------------------------
// Type guard tests
// ---------------------------------------------------------------------------

describe('type guards', () => {
  it('isAIToCanonicalSuccess identifies success', () => {
    const result = aiToCanonical('hello', 'text', {});
    expect(isAIToCanonicalSuccess(result)).toBe(true);
    expect(isAIToCanonicalError(result)).toBe(false);
  });

  it('isAIToCanonicalError identifies error', () => {
    const result = aiToCanonical('not a number', 'number', { precision: 2 });
    expect(isAIToCanonicalError(result)).toBe(true);
    expect(isAIToCanonicalSuccess(result)).toBe(false);
  });
});
