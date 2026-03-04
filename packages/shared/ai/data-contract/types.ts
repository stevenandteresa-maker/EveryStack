/**
 * AI Data Contract — field config types for canonical ↔ AI translation.
 *
 * These are the subset of field configuration properties that the
 * translation functions need. They mirror what will live in fields.config
 * JSONB once the FieldTypeRegistry is fully implemented.
 */

// ---------------------------------------------------------------------------
// Supported field types for MVP data contract
// ---------------------------------------------------------------------------

export type AIDataContractFieldType =
  | 'text'
  | 'number'
  | 'single_select'
  | 'checkbox';

// ---------------------------------------------------------------------------
// Per-field-type config shapes
// ---------------------------------------------------------------------------

export interface TextFieldConfig {
  max_length?: number;
}

export interface NumberFieldConfig {
  precision?: number;
  thousands_separator?: boolean;
}

export interface SelectOption {
  id: string;
  label: string;
  color?: string;
}

export interface SingleSelectFieldConfig {
  options: SelectOption[];
}

export type CheckboxFieldConfig = Record<string, never>;

/** Union of all field configs the data contract supports */
export type AIFieldConfig =
  | TextFieldConfig
  | NumberFieldConfig
  | SingleSelectFieldConfig
  | CheckboxFieldConfig;

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** Successful coercion — value is canonical, warnings list lossy conversions */
export interface AIToCanonicalSuccess {
  value: unknown;
  warnings: string[];
}

/** Failed coercion — error describes why conversion was impossible */
export interface AIToCanonicalError {
  error: string;
}

/** Result of aiToCanonical — either success or error, never throws */
export type AIToCanonicalResult = AIToCanonicalSuccess | AIToCanonicalError;

/** Type guard: is the result a success? */
export function isAIToCanonicalSuccess(
  result: AIToCanonicalResult,
): result is AIToCanonicalSuccess {
  return 'value' in result;
}

/** Type guard: is the result an error? */
export function isAIToCanonicalError(
  result: AIToCanonicalResult,
): result is AIToCanonicalError {
  return 'error' in result;
}
