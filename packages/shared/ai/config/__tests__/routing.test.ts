import { describe, expect, it } from 'vitest';

import type { CapabilityTier, ProviderId } from '../../types';
import type { AITaskType, ProviderModelConfig } from '../routing';
import {
  AI_TASK_TYPES,
  CAPABILITY_ROUTING,
  FALLBACK_CHAINS,
  FEATURE_ROUTING,
  getFallbackChain,
  resolveRoute,
  resolveRouteByTier,
} from '../routing';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PROVIDER_IDS: readonly ProviderId[] = [
  'anthropic',
  'openai',
  'self-hosted',
];

const ALL_TIERS: readonly CapabilityTier[] = ['fast', 'standard', 'advanced'];

function isValidProviderModelConfig(
  config: ProviderModelConfig,
): config is ProviderModelConfig {
  return (
    VALID_PROVIDER_IDS.includes(config.providerId) &&
    typeof config.modelId === 'string' &&
    config.modelId.length > 0
  );
}

// ---------------------------------------------------------------------------
// CAPABILITY_ROUTING
// ---------------------------------------------------------------------------

describe('CAPABILITY_ROUTING', () => {
  it('maps all 3 capability tiers', () => {
    for (const tier of ALL_TIERS) {
      expect(CAPABILITY_ROUTING[tier]).toBeDefined();
    }
  });

  it('maps fast tier to Anthropic Haiku', () => {
    expect(CAPABILITY_ROUTING.fast).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-haiku-4-5-20251001',
    });
  });

  it('maps standard tier to Anthropic Sonnet', () => {
    expect(CAPABILITY_ROUTING.standard).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-sonnet-4-5-20250929',
    });
  });

  it('maps advanced tier to Anthropic Opus', () => {
    expect(CAPABILITY_ROUTING.advanced).toEqual({
      providerId: 'anthropic',
      modelId: 'claude-opus-4-6',
    });
  });

  it('all configs reference a valid ProviderId', () => {
    for (const tier of ALL_TIERS) {
      expect(isValidProviderModelConfig(CAPABILITY_ROUTING[tier])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// FEATURE_ROUTING
// ---------------------------------------------------------------------------

describe('FEATURE_ROUTING', () => {
  it('maps all 8 task types to capability tiers', () => {
    expect(Object.keys(FEATURE_ROUTING)).toHaveLength(8);
    for (const taskType of AI_TASK_TYPES) {
      expect(ALL_TIERS).toContain(FEATURE_ROUTING[taskType]);
    }
  });

  it('classify_intent routes to fast tier', () => {
    expect(FEATURE_ROUTING.classify_intent).toBe('fast');
  });

  it('summarize routes to fast tier', () => {
    expect(FEATURE_ROUTING.summarize).toBe('fast');
  });

  it('conversation routes to standard tier', () => {
    expect(FEATURE_ROUTING.conversation).toBe('standard');
  });

  it('draft_content routes to standard tier', () => {
    expect(FEATURE_ROUTING.draft_content).toBe('standard');
  });

  it('draft_communication routes to standard tier', () => {
    expect(FEATURE_ROUTING.draft_communication).toBe('standard');
  });

  it('suggest_schema routes to standard tier', () => {
    expect(FEATURE_ROUTING.suggest_schema).toBe('standard');
  });

  it('generate_automation routes to standard tier', () => {
    expect(FEATURE_ROUTING.generate_automation).toBe('standard');
  });

  it('generate_app routes to advanced tier', () => {
    expect(FEATURE_ROUTING.generate_app).toBe('advanced');
  });
});

// ---------------------------------------------------------------------------
// AI_TASK_TYPES constant
// ---------------------------------------------------------------------------

describe('AI_TASK_TYPES', () => {
  it('contains all 8 task types', () => {
    expect(AI_TASK_TYPES).toHaveLength(8);
  });

  it('matches the keys of FEATURE_ROUTING', () => {
    const routingKeys = Object.keys(FEATURE_ROUTING).sort();
    const taskTypes = [...AI_TASK_TYPES].sort();
    expect(taskTypes).toEqual(routingKeys);
  });
});

// ---------------------------------------------------------------------------
// resolveRoute()
// ---------------------------------------------------------------------------

describe('resolveRoute', () => {
  it('resolves every AITaskType to a valid ProviderModelConfig', () => {
    for (const taskType of AI_TASK_TYPES) {
      const config = resolveRoute(taskType);
      expect(isValidProviderModelConfig(config)).toBe(true);
    }
  });

  it('classify_intent resolves to fast tier model', () => {
    const config = resolveRoute('classify_intent');
    expect(config).toEqual(CAPABILITY_ROUTING.fast);
  });

  it('conversation resolves to standard tier model', () => {
    const config = resolveRoute('conversation');
    expect(config).toEqual(CAPABILITY_ROUTING.standard);
  });

  it('generate_app resolves to advanced tier model', () => {
    const config = resolveRoute('generate_app');
    expect(config).toEqual(CAPABILITY_ROUTING.advanced);
  });

  it('summarize resolves to fast tier model', () => {
    const config = resolveRoute('summarize');
    expect(config).toEqual(CAPABILITY_ROUTING.fast);
  });

  it('draft_content resolves to standard tier model', () => {
    const config = resolveRoute('draft_content');
    expect(config).toEqual(CAPABILITY_ROUTING.standard);
  });
});

// ---------------------------------------------------------------------------
// resolveRouteByTier()
// ---------------------------------------------------------------------------

describe('resolveRouteByTier', () => {
  it('resolves each tier to the correct ProviderModelConfig', () => {
    for (const tier of ALL_TIERS) {
      expect(resolveRouteByTier(tier)).toEqual(CAPABILITY_ROUTING[tier]);
    }
  });

  it('fast tier resolves to Haiku', () => {
    expect(resolveRouteByTier('fast').modelId).toBe(
      'claude-haiku-4-5-20251001',
    );
  });

  it('standard tier resolves to Sonnet', () => {
    expect(resolveRouteByTier('standard').modelId).toBe(
      'claude-sonnet-4-5-20250929',
    );
  });

  it('advanced tier resolves to Opus', () => {
    expect(resolveRouteByTier('advanced').modelId).toBe('claude-opus-4-6');
  });
});

// ---------------------------------------------------------------------------
// FALLBACK_CHAINS
// ---------------------------------------------------------------------------

describe('FALLBACK_CHAINS', () => {
  it('defines a chain for every capability tier', () => {
    for (const tier of ALL_TIERS) {
      expect(FALLBACK_CHAINS[tier]).toBeDefined();
      expect(Array.isArray(FALLBACK_CHAINS[tier])).toBe(true);
    }
  });

  it('every chain contains at least the primary config', () => {
    for (const tier of ALL_TIERS) {
      const chain = FALLBACK_CHAINS[tier];
      expect(chain.length).toBeGreaterThanOrEqual(1);
      expect(chain[0]).toEqual(CAPABILITY_ROUTING[tier]);
    }
  });

  it('all entries in all chains are valid ProviderModelConfigs', () => {
    for (const tier of ALL_TIERS) {
      for (const config of FALLBACK_CHAINS[tier]) {
        expect(isValidProviderModelConfig(config)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getFallbackChain()
// ---------------------------------------------------------------------------

describe('getFallbackChain', () => {
  it('returns the same chain as FALLBACK_CHAINS for each tier', () => {
    for (const tier of ALL_TIERS) {
      expect(getFallbackChain(tier)).toEqual(FALLBACK_CHAINS[tier]);
    }
  });

  it('returns a non-empty array for every tier', () => {
    for (const tier of ALL_TIERS) {
      expect(getFallbackChain(tier).length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Type-level consistency checks
// ---------------------------------------------------------------------------

describe('type consistency', () => {
  it('resolveRoute and resolveRouteByTier agree for every task type', () => {
    for (const taskType of AI_TASK_TYPES) {
      const tier = FEATURE_ROUTING[taskType];
      expect(resolveRoute(taskType)).toEqual(resolveRouteByTier(tier));
    }
  });

  it('all ProviderModelConfigs have non-empty modelId strings', () => {
    for (const tier of ALL_TIERS) {
      const config = CAPABILITY_ROUTING[tier];
      expect(typeof config.modelId).toBe('string');
      expect(config.modelId.length).toBeGreaterThan(0);
    }
  });

  it('AI_TASK_TYPES satisfies AITaskType[]', () => {
    // Runtime check that the const tuple matches the union type
    const types: readonly AITaskType[] = AI_TASK_TYPES;
    expect(types).toHaveLength(8);
  });
});
