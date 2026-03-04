/**
 * Provider Adapter Interface.
 *
 * Every AI provider (Anthropic, OpenAI, self-hosted) implements this interface.
 * Feature code never touches adapters directly — only AIService does.
 */

import type {
  CompiledAIRequest,
  AIResponse,
  AIStreamChunk,
  AIToolResponse,
  TokenUsage,
  CreditCost,
  ToolDefinition,
  ProviderId,
} from '../types';

/** Capability flags reported by a provider adapter */
export interface ProviderCapabilities {
  /** Maximum context window size in tokens */
  maxContextTokens: number;
  /** Whether the provider supports streaming responses */
  supportsStreaming: boolean;
  /** Whether the provider supports tool/function calling */
  supportsToolUse: boolean;
  /** Whether the provider supports prompt caching */
  supportsPromptCaching: boolean;
  /** Whether the provider supports batch API calls */
  supportsBatchAPI: boolean;
  /** Whether the provider supports structured JSON output */
  supportsStructuredOutput: boolean;
  /** Whether the provider supports vision/image inputs */
  supportsVision: boolean;
}

/**
 * Contract that every AI provider must implement.
 *
 * Adding a new provider = one file implementing this interface.
 * Zero modifications to feature code, prompts, or tools.
 */
export interface AIProviderAdapter {
  /** Provider identifier — never changes after construction */
  readonly providerId: ProviderId;

  /** Standard (non-streaming) completion */
  complete(request: CompiledAIRequest): Promise<AIResponse>;

  /** Streaming completion returning an async iterable of chunks */
  streamComplete(request: CompiledAIRequest): AsyncIterable<AIStreamChunk>;

  /** Completion with tool/function calling */
  completeWithTools(
    request: CompiledAIRequest,
    tools: ToolDefinition[],
  ): Promise<AIToolResponse>;

  /** Report this provider's capability flags */
  supportedCapabilities(): ProviderCapabilities;

  /** Calculate cost in USD and credits for a given token usage */
  calculateCost(usage: TokenUsage): CreditCost;
}
