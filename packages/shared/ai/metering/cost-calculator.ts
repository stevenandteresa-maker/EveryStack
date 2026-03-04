/**
 * Cost calculator for AI API calls.
 *
 * Computes USD cost from token usage and converts to credits.
 * 1 credit = $0.01. Credits are always rounded UP (Math.ceil).
 */

import type { TokenUsage, CreditCost } from '../types';
import { AI_RATES, isKnownModel } from './rates';

/**
 * Calculate the USD cost and credit charge for an AI API call.
 *
 * @param modelId - Anthropic model identifier (must exist in AI_RATES)
 * @param usage - Token usage breakdown from the API response
 * @returns CreditCost with cost_usd and credits_charged
 * @throws Error if modelId is not in the rate card
 */
export function calculateCost(modelId: string, usage: TokenUsage): CreditCost {
  if (!isKnownModel(modelId)) {
    throw new Error(`Unknown model ID: ${modelId}. No rate card entry found.`);
  }

  // Safe: isKnownModel() guarantees modelId exists in AI_RATES
  const rate = AI_RATES[modelId]!;

  const cost_usd =
    usage.input_tokens * rate.input +
    usage.cached_input_tokens * rate.cache_read +
    usage.output_tokens * rate.output;

  // 1 credit = $0.01. Always round UP so we never undercharge.
  const credits_charged = Math.ceil(cost_usd * 100);

  return { cost_usd, credits_charged };
}
