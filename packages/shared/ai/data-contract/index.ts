/**
 * AI Data Contract — canonical JSONB ↔ AI translation.
 *
 * Two translation functions that ensure AI speaks canonical JSONB:
 * - canonicalToAIContext: read path (canonical → AI prompt)
 * - aiToCanonical: write path (AI output → canonical)
 *
 * MVP field types: text, number, single_select, checkbox.
 */

export { canonicalToAIContext } from './canonical-to-ai';
export { aiToCanonical } from './ai-to-canonical';
export type {
  AIDataContractFieldType,
  AIFieldConfig,
  TextFieldConfig,
  NumberFieldConfig,
  SelectOption,
  SingleSelectFieldConfig,
  CheckboxFieldConfig,
  AIToCanonicalResult,
  AIToCanonicalSuccess,
  AIToCanonicalError,
} from './types';
export { isAIToCanonicalSuccess, isAIToCanonicalError } from './types';
