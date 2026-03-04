/**
 * Capability-based model routing configuration.
 *
 * Feature code specifies an AITaskType; the routing system resolves it
 * to a provider + model via capability tiers. Feature code never references
 * providers or models directly.
 *
 * @module packages/shared/ai/config/routing
 */

import type { CapabilityTier, ProviderId } from '../types';

// ---------------------------------------------------------------------------
// AI Task Types — feature code references these
// ---------------------------------------------------------------------------

/**
 * All AI task types supported by the platform.
 * Feature code passes an AITaskType to AIService, which resolves
 * it to a capability tier and then to a specific provider/model.
 */
export type AITaskType =
  | 'classify_intent'
  | 'summarize'
  | 'conversation'
  | 'draft_content'
  | 'draft_communication'
  | 'suggest_schema'
  | 'generate_automation'
  | 'generate_app'; // Post-MVP — App Designer AI generation

/** All valid AITaskType values as a readonly tuple for runtime validation */
export const AI_TASK_TYPES = [
  'classify_intent',
  'summarize',
  'conversation',
  'draft_content',
  'draft_communication',
  'suggest_schema',
  'generate_automation',
  'generate_app',
] as const satisfies readonly AITaskType[];

// ---------------------------------------------------------------------------
// Provider/Model Configuration
// ---------------------------------------------------------------------------

/** Resolved provider + model pair returned by routing functions */
export interface ProviderModelConfig {
  readonly providerId: ProviderId;
  readonly modelId: string;
}

// ---------------------------------------------------------------------------
// Capability Routing — maps tiers to provider/model pairs
// ---------------------------------------------------------------------------

/**
 * Maps each capability tier to a specific provider and model.
 * To switch providers: update this map and run the evaluation suite.
 */
export const CAPABILITY_ROUTING: Readonly<
  Record<CapabilityTier, ProviderModelConfig>
> = {
  fast: { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' },
  standard: { providerId: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' },
  advanced: { providerId: 'anthropic', modelId: 'claude-opus-4-6' },
};

// ---------------------------------------------------------------------------
// Feature Routing — maps task types to capability tiers
// ---------------------------------------------------------------------------

/**
 * Maps each AI task type to the capability tier it requires.
 * Feature code calls resolveRoute(taskType); the system looks up
 * the tier here, then resolves to a provider/model via CAPABILITY_ROUTING.
 */
export const FEATURE_ROUTING: Readonly<Record<AITaskType, CapabilityTier>> = {
  classify_intent: 'fast',
  summarize: 'fast',
  conversation: 'standard',
  draft_content: 'standard',
  draft_communication: 'standard',
  suggest_schema: 'standard',
  generate_automation: 'standard',
  generate_app: 'advanced',
};

// ---------------------------------------------------------------------------
// Fallback Chains — ordered list of alternatives per tier
// ---------------------------------------------------------------------------

/**
 * Ordered fallback chains per capability tier.
 * MVP: single-entry chains (Anthropic only).
 * Post-MVP: add additional providers for multi-provider failover.
 */
export const FALLBACK_CHAINS: Readonly<
  Record<CapabilityTier, readonly ProviderModelConfig[]>
> = {
  fast: [CAPABILITY_ROUTING.fast],
  standard: [CAPABILITY_ROUTING.standard],
  advanced: [CAPABILITY_ROUTING.advanced],
};

// ---------------------------------------------------------------------------
// Route Resolution Functions
// ---------------------------------------------------------------------------

/**
 * Resolve an AI task type to its provider/model configuration.
 *
 * This is the primary entry point for feature code:
 *   const config = resolveRoute('classify_intent');
 *   // → { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' }
 */
export function resolveRoute(taskType: AITaskType): ProviderModelConfig {
  const tier = FEATURE_ROUTING[taskType];
  return CAPABILITY_ROUTING[tier];
}

/**
 * Resolve a capability tier directly to its provider/model configuration.
 *
 * Used when the caller already knows the tier (e.g., AIService internals).
 */
export function resolveRouteByTier(tier: CapabilityTier): ProviderModelConfig {
  return CAPABILITY_ROUTING[tier];
}

/**
 * Get the fallback chain for a capability tier.
 *
 * Returns an ordered array of ProviderModelConfig to try in sequence.
 * MVP: single entry per tier. Post-MVP: multi-provider failover.
 */
export function getFallbackChain(
  tier: CapabilityTier,
): readonly ProviderModelConfig[] {
  return FALLBACK_CHAINS[tier];
}
