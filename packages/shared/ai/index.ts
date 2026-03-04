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

// Prompt registry and compiler
export type {
  VariableDefinition,
  PromptExample,
  TestedModel,
  PromptTemplate,
} from './prompts/registry';
export { PromptRegistry } from './prompts/registry';
export type { CompilerModelConfig, PromptCompiler } from './prompts/compiler';
export {
  AnthropicPromptCompiler,
  BasicPromptCompiler,
  compilerForProvider,
} from './prompts/compiler';

// Tool registry
export {
  ToolRegistry,
  createDefaultToolRegistry,
  TOOL_NAMES,
} from './tools/registry';

// Metering — features, rates, cost calculator
export type { AIFeature } from './metering/features';
export { AI_FEATURES } from './metering/features';
export type { ModelRate } from './metering/rates';
export { AI_RATES, isKnownModel } from './metering/rates';
export { calculateCost } from './metering/cost-calculator';

// Metering — usage logging and credit ledger
export type { UsageLogEntry } from './metering/usage-logger';
export { logAIUsage } from './metering/usage-logger';
export type { BudgetStatus, AlertAction } from './metering/credit-ledger';
export { checkBudget, deductCredits, checkAlertThresholds } from './metering/credit-ledger';

// AIService — single entry point for all AI calls
export type { AIServiceRequest, AIServiceResponse, AIServiceContext } from './service';
export { AIService, FEATURE_TASK_MAP } from './service';

// Streaming — stream adapter and BullMQ AI job types
export type { StreamResult, AIJobPayload, AIJobResult } from './streaming';
export { createAIStream } from './streaming';

// Data contract — canonical JSONB ↔ AI translation
export { canonicalToAIContext } from './data-contract';
export { aiToCanonical } from './data-contract';
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
} from './data-contract';
export { isAIToCanonicalSuccess, isAIToCanonicalError } from './data-contract';
