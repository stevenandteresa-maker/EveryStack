import { describe, it, expect } from 'vitest';
import { calculateCost } from '../cost-calculator';
import { AI_FEATURES } from '../features';
import type { AIFeature } from '../features';
import { AI_RATES } from '../rates';
import type { TokenUsage } from '../../types';

describe('calculateCost', () => {
  it('calculates correct cost for Haiku (1000 input + 500 output + 0 cached)', () => {
    const usage: TokenUsage = {
      input_tokens: 1000,
      output_tokens: 500,
      cached_input_tokens: 0,
    };

    const result = calculateCost('claude-haiku-4-5-20251001', usage);

    // 1000 * 0.000001 + 500 * 0.000005 = 0.001 + 0.0025 = 0.0035
    expect(result.cost_usd).toBeCloseTo(0.0035, 10);
    // ceil(0.0035 * 100) = ceil(0.35) = 1
    expect(result.credits_charged).toBe(1);
  });

  it('calculates correct cost for Sonnet (1000 input + 500 output + 2000 cached)', () => {
    const usage: TokenUsage = {
      input_tokens: 1000,
      output_tokens: 500,
      cached_input_tokens: 2000,
    };

    const result = calculateCost('claude-sonnet-4-5-20250929', usage);

    // 1000 * 0.000003 + 500 * 0.000015 + 2000 * 0.0000003
    // = 0.003 + 0.0075 + 0.0006 = 0.0111
    expect(result.cost_usd).toBeCloseTo(0.0111, 10);
    // ceil(0.0111 * 100) = ceil(1.11) = 2
    expect(result.credits_charged).toBe(2);
  });

  it('calculates correct cost for Opus (1000 input + 500 output + 0 cached)', () => {
    const usage: TokenUsage = {
      input_tokens: 1000,
      output_tokens: 500,
      cached_input_tokens: 0,
    };

    const result = calculateCost('claude-opus-4-6', usage);

    // 1000 * 0.000005 + 500 * 0.000025 = 0.005 + 0.0125 = 0.0175
    expect(result.cost_usd).toBeCloseTo(0.0175, 10);
    // ceil(0.0175 * 100) = ceil(1.75) = 2
    expect(result.credits_charged).toBe(2);
  });

  it('always rounds credits UP (never down)', () => {
    // Craft usage that produces a fractional credit value
    // 100 input tokens on Haiku: 100 * 0.000001 = 0.0001 USD → ceil(0.01) = 1 credit
    const usage: TokenUsage = {
      input_tokens: 100,
      output_tokens: 0,
      cached_input_tokens: 0,
    };

    const result = calculateCost('claude-haiku-4-5-20251001', usage);

    expect(result.cost_usd).toBeCloseTo(0.0001, 10);
    // 0.0001 * 100 = 0.01 → ceil = 1 (never 0)
    expect(result.credits_charged).toBe(1);
  });

  it('throws on unknown model ID', () => {
    const usage: TokenUsage = {
      input_tokens: 100,
      output_tokens: 50,
      cached_input_tokens: 0,
    };

    expect(() => calculateCost('unknown-model', usage)).toThrow(
      'Unknown model ID: unknown-model'
    );
  });

  it('returns zero cost and zero credits for zero tokens', () => {
    const usage: TokenUsage = {
      input_tokens: 0,
      output_tokens: 0,
      cached_input_tokens: 0,
    };

    const result = calculateCost('claude-haiku-4-5-20251001', usage);

    expect(result.cost_usd).toBe(0);
    expect(result.credits_charged).toBe(0);
  });
});

describe('AI_FEATURES', () => {
  it('contains all 13 feature values', () => {
    const features = Object.values(AI_FEATURES);
    expect(features).toHaveLength(13);
  });

  it('contains all expected feature identifiers', () => {
    const expected = [
      'command_bar',
      'formula_suggest',
      'email_draft',
      'automation_build',
      'cross_base_analysis',
      'guide_mode',
      'doc_assist',
      'record_summary',
      'app_suggest',
      'thread_summary',
      'agent_planning',
      'agent_tool_selection',
      'agent_observation',
    ];

    for (const feature of expected) {
      expect(Object.values(AI_FEATURES)).toContain(feature);
    }
  });

  it('has AIFeature type correctly constrained to enum values', () => {
    // This is a compile-time check — if AIFeature allows arbitrary strings,
    // this assignment would succeed at runtime but fail type-checking.
    const feature: AIFeature = AI_FEATURES.command_bar;
    expect(feature).toBe('command_bar');

    // Verify all values are assignable to AIFeature
    const allFeatures: AIFeature[] = Object.values(AI_FEATURES);
    expect(allFeatures).toHaveLength(13);
  });
});

describe('AI_RATES', () => {
  it('has Haiku rates matching $1/$5 per MTok', () => {
    const haiku = AI_RATES['claude-haiku-4-5-20251001'];
    // $1.00 per MTok = $0.000001 per token
    expect(haiku?.input).toBe(0.000_001);
    // $5.00 per MTok = $0.000005 per token
    expect(haiku?.output).toBe(0.000_005);
    // $0.10 per MTok = $0.0000001 per token
    expect(haiku?.cache_read).toBe(0.000_000_1);
  });

  it('has Sonnet rates matching $3/$15 per MTok', () => {
    const sonnet = AI_RATES['claude-sonnet-4-5-20250929'];
    expect(sonnet?.input).toBe(0.000_003);
    expect(sonnet?.output).toBe(0.000_015);
    expect(sonnet?.cache_read).toBe(0.000_000_3);
  });

  it('has Opus rates matching $5/$25 per MTok', () => {
    const opus = AI_RATES['claude-opus-4-6'];
    expect(opus?.input).toBe(0.000_005);
    expect(opus?.output).toBe(0.000_025);
    expect(opus?.cache_read).toBe(0.000_000_5);
  });
});
