/**
 * aiToCanonical — Write path: AI output → canonical JSONB.
 *
 * Converts raw LLM text output into a canonical JSONB value. Tolerant on
 * input, strict on output. Returns { value, warnings } on success or
 * { error } on failure. Never throws.
 *
 * Implemented for MVP field types: text, number, single_select, checkbox.
 */

import type {
  AIDataContractFieldType,
  AIFieldConfig,
  AIToCanonicalResult,
  NumberFieldConfig,
  SingleSelectFieldConfig,
  TextFieldConfig,
} from './types';

/**
 * Convert raw LLM output to a canonical JSONB value.
 *
 * @param rawLLMOutput - The raw string output from the LLM
 * @param fieldType - The target field type
 * @param fieldConfig - The field-type-specific configuration
 * @returns Success with value + warnings, or error string. Never throws.
 */
export function aiToCanonical(
  rawLLMOutput: string,
  fieldType: AIDataContractFieldType,
  fieldConfig: AIFieldConfig,
): AIToCanonicalResult {
  try {
    switch (fieldType) {
      case 'text':
        return textFromAI(rawLLMOutput, fieldConfig as TextFieldConfig);
      case 'number':
        return numberFromAI(rawLLMOutput, fieldConfig as NumberFieldConfig);
      case 'single_select':
        return singleSelectFromAI(
          rawLLMOutput,
          fieldConfig as SingleSelectFieldConfig,
        );
      case 'checkbox':
        return checkboxFromAI(rawLLMOutput);
      default:
        return { error: `Unsupported field type: ${String(fieldType)}` };
    }
  } catch {
    return { error: `Unexpected error processing ${fieldType} value` };
  }
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function textFromAI(
  raw: string,
  config: TextFieldConfig,
): AIToCanonicalResult {
  const warnings: string[] = [];
  let value = raw;

  if (config.max_length && value.length > config.max_length) {
    value = value.slice(0, config.max_length);
    warnings.push(
      `Text truncated from ${raw.length} to ${config.max_length} characters`,
    );
  }

  return { value, warnings };
}

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

/**
 * Regex to extract the first numeric value from LLM output.
 * Strips currency symbols, commas, whitespace, and unit suffixes.
 */
const NUMBER_EXTRACTION_PATTERN = /[-+]?[\d,]+\.?\d*/;

function numberFromAI(
  raw: string,
  config: NumberFieldConfig,
): AIToCanonicalResult {
  const warnings: string[] = [];

  // Strip common non-numeric characters LLMs add
  const cleaned = raw
    .replace(/[$€£¥₹₽₩₺₫₴₦₱₲₵₡₢₸₹¢]/g, '') // currency symbols
    .replace(/%/g, '') // percentage sign
    .replace(/\s/g, '') // whitespace
    .trim();

  const match = NUMBER_EXTRACTION_PATTERN.exec(cleaned);
  if (!match) {
    return { error: `No numeric value found in: "${raw}"` };
  }

  // Remove commas from the matched number string
  const numStr = match[0].replace(/,/g, '');
  const parsed = parseFloat(numStr);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return { error: `Could not parse number from: "${raw}"` };
  }

  // Apply precision rounding
  const precision = config.precision ?? 0;
  const rounded = roundToPrecision(parsed, precision);

  if (rounded !== parsed) {
    warnings.push(
      `Number rounded from ${parsed} to ${rounded} (precision: ${precision})`,
    );
  }

  return { value: rounded, warnings };
}

function roundToPrecision(num: number, precision: number): number {
  const factor = Math.pow(10, precision);
  return Math.round(num * factor) / factor;
}

// ---------------------------------------------------------------------------
// Single Select
// ---------------------------------------------------------------------------

function singleSelectFromAI(
  raw: string,
  config: SingleSelectFieldConfig,
): AIToCanonicalResult {
  const options = config.options ?? [];

  if (options.length === 0) {
    return { error: 'No options configured for single_select field' };
  }

  // Step 1: Exact match
  const exactMatch = options.find((opt) => opt.label === raw);
  if (exactMatch) {
    return { value: exactMatch.id, warnings: [] };
  }

  // Step 2: Case-insensitive match
  const lowerRaw = raw.toLowerCase();
  const caseMatch = options.find(
    (opt) => opt.label.toLowerCase() === lowerRaw,
  );
  if (caseMatch) {
    return {
      value: caseMatch.id,
      warnings: [`Matched "${raw}" to "${caseMatch.label}" (case-insensitive)`],
    };
  }

  // Step 3: Trimmed match
  const trimmedRaw = raw.trim().toLowerCase();
  const trimMatch = options.find(
    (opt) => opt.label.trim().toLowerCase() === trimmedRaw,
  );
  if (trimMatch) {
    return {
      value: trimMatch.id,
      warnings: [
        `Matched "${raw}" to "${trimMatch.label}" (trimmed + case-insensitive)`,
      ],
    };
  }

  // Step 4: Extract from explanatory text (e.g., "I'd suggest 'Active'")
  const candidates = extractAllQuotedStrings(raw);
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();
    const extractMatch = options.find(
      (opt) => opt.label.toLowerCase() === candidateLower,
    );
    if (extractMatch) {
      return {
        value: extractMatch.id,
        warnings: [
          `Extracted "${candidate}" from "${raw}", matched to "${extractMatch.label}"`,
        ],
      };
    }
  }

  const availableLabels = options.map((opt) => opt.label).join(', ');
  return {
    error: `No matching option found for "${raw}". Available: ${availableLabels}`,
  };
}

/**
 * Extract all potential option labels from explanatory LLM text.
 * Finds all single-quoted, double-quoted, or backtick-quoted strings.
 * Returns them all so the caller can match against options.
 */
function extractAllQuotedStrings(text: string): string[] {
  const results: string[] = [];

  // Global patterns to find all quoted substrings.
  // Single quotes require a non-letter before the opening quote to avoid
  // matching apostrophes in contractions (e.g., "I'd", "don't").
  const quotePatterns = [
    /(?:^|[^a-zA-Z])'([^']+)'/g,
    /"([^"]+)"/g,
    /`([^`]+)`/g,
    /\u201c([^\u201d]+)\u201d/g, // smart double quotes
    /\u2018([^\u2019]+)\u2019/g, // smart single quotes
  ];

  for (const pattern of quotePatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) {
        results.push(match[1].trim());
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

const TRUTHY_VALUES = new Set([
  'true',
  'yes',
  '1',
  'checked',
]);

const FALSY_VALUES = new Set([
  'false',
  'no',
  '0',
  'unchecked',
]);

function checkboxFromAI(raw: string): AIToCanonicalResult {
  const normalized = raw.trim().toLowerCase();

  if (TRUTHY_VALUES.has(normalized)) {
    return { value: true, warnings: [] };
  }

  if (FALSY_VALUES.has(normalized)) {
    return { value: false, warnings: [] };
  }

  return {
    error: `Unrecognized checkbox value: "${raw}". Expected: true/false, yes/no, 1/0, checked/unchecked`,
  };
}
