/**
 * AI Service Layer — public barrel export.
 *
 * All AI types are re-exported here for consumption via @everystack/shared/ai.
 */

// Core types
export type {
  CapabilityTier,
  ProviderId,
  AIMessage,
  CompiledAIRequest,
  TokenUsage,
  CreditCost,
  AIResponse,
  AIStreamChunk,
  JSONSchema,
  ToolResult,
  ToolDefinition,
  AIToolCall,
  AIToolResponse,
  AgentScope,
  AgentConfig,
  EmbeddingProvider,
} from './types';

// Provider adapter interface and capabilities
export type {
  ProviderCapabilities,
  AIProviderAdapter,
} from './providers/adapter';

// Provider error types
export {
  AIProviderError,
  AIProviderAuthError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
} from './providers/errors';

// Provider adapters
export { AnthropicAdapter } from './providers/anthropic';
export { SelfHostedAdapter } from './providers/self-hosted';

// Routing configuration and resolution
export type { AITaskType, ProviderModelConfig } from './config/routing';
export {
  AI_TASK_TYPES,
  CAPABILITY_ROUTING,
  FEATURE_ROUTING,
  FALLBACK_CHAINS,
  resolveRoute,
  resolveRouteByTier,
  getFallbackChain,
} from './config/routing';
