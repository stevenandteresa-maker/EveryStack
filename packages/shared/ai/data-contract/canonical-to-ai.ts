/**
 * canonicalToAIContext — Read path: canonical JSONB → AI prompt context.
 *
 * Converts a canonical JSONB value into a string representation suitable
 * for inclusion in an LLM prompt. Produces the most useful, unambiguous
 * text for an LLM to reason about.
 *
 * Implemented for MVP field types: text, number, single_select, checkbox.
 */

import type {
  AIDataContractFieldType,
  AIFieldConfig,
  NumberFieldConfig,
  SingleSelectFieldConfig,
} from './types';

/**
 * Convert a canonical JSONB value to a string for AI prompt context.
 *
 * @param value - The canonical JSONB value (from records.canonical_data[fieldId])
 * @param fieldType - The field type identifier
 * @param fieldConfig - The field-type-specific configuration from fields.config
 * @returns A human-readable string representation for LLM consumption
 */
export function canonicalToAIContext(
  value: unknown,
  fieldType: AIDataContractFieldType,
  fieldConfig: AIFieldConfig,
): string {
  if (value === null || value === undefined) {
    return '';
  }

  switch (fieldType) {
    case 'text':
      return textToAIContext(value);
    case 'number':
      return numberToAIContext(value, fieldConfig as NumberFieldConfig);
    case 'single_select':
      return singleSelectToAIContext(
        value,
        fieldConfig as SingleSelectFieldConfig,
      );
    case 'checkbox':
      return checkboxToAIContext(value);
    default:
      return String(value);
  }
}

// ---------------------------------------------------------------------------
// Per-type implementations
// ---------------------------------------------------------------------------

function textToAIContext(value: unknown): string {
  return String(value);
}

function numberToAIContext(
  value: unknown,
  config: NumberFieldConfig,
): string {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return String(value);
  }

  const precision = config.precision ?? 0;
  const useThousandsSeparator = config.thousands_separator ?? false;

  const fixed = num.toFixed(precision);

  if (!useThousandsSeparator) {
    return fixed;
  }

  // Split on decimal point and format integer part with commas
  const [intPart, decPart] = fixed.split('.');
  const formattedInt = formatWithCommas(intPart!);

  return decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
}

function formatWithCommas(intStr: string): string {
  const isNegative = intStr.startsWith('-');
  const digits = isNegative ? intStr.slice(1) : intStr;
  const parts: string[] = [];

  for (let i = digits.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    parts.unshift(digits.slice(start, i));
  }

  const formatted = parts.join(',');
  return isNegative ? `-${formatted}` : formatted;
}

function singleSelectToAIContext(
  value: unknown,
  config: SingleSelectFieldConfig,
): string {
  const optionId = String(value);
  const options = config.options ?? [];
  const match = options.find((opt) => opt.id === optionId);

  // Return label if found, otherwise return the raw value
  return match ? match.label : optionId;
}

function checkboxToAIContext(value: unknown): string {
  return value === true || value === 'true' ? 'Yes' : 'No';
}
