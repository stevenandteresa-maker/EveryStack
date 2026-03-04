/**
 * Per-token rate card for Anthropic Claude models.
 *
 * Rates are pre-divided from per-million-token pricing to per-token.
 * Source: Anthropic API pricing as of February 2026.
 *
 * | Model      | Input (per MTok) | Output (per MTok) | Cache Read (per MTok) |
 * |------------|------------------|-------------------|-----------------------|
 * | Haiku 4.5  | $1.00            | $5.00             | $0.10                 |
 * | Sonnet 4.5 | $3.00            | $15.00            | $0.30                 |
 * | Opus 4.5   | $5.00            | $25.00            | $0.50                 |
 */

/** Per-token pricing for a single model */
export interface ModelRate {
  /** Cost per input token (USD) */
  readonly input: number;
  /** Cost per output token (USD) */
  readonly output: number;
  /** Cost per cached input token (USD) — ~10% of input rate */
  readonly cache_read: number;
}

/**
 * Per-token rates indexed by Anthropic model ID.
 *
 * These are the actual model IDs returned by the Anthropic API,
 * matching the values in config/routing.ts modelId fields.
 */
export const AI_RATES: Readonly<Record<string, ModelRate>> = {
  'claude-haiku-4-5-20251001': {
    input: 0.000_001,
    output: 0.000_005,
    cache_read: 0.000_000_1,
  },
  'claude-sonnet-4-5-20250929': {
    input: 0.000_003,
    output: 0.000_015,
    cache_read: 0.000_000_3,
  },
  'claude-opus-4-6': {
    input: 0.000_005,
    output: 0.000_025,
    cache_read: 0.000_000_5,
  },
} as const;

/** Returns true if the given model ID has a known rate entry */
export function isKnownModel(modelId: string): modelId is keyof typeof AI_RATES {
  return modelId in AI_RATES;
}
