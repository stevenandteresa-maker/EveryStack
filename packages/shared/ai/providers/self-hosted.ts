/**
 * Self-hosted LLM adapter skeleton.
 *
 * Post-MVP: targets an internal inference endpoint (vLLM, SGLang, Ollama).
 * All methods throw — this file exists as an extension point only.
 */

import type {
  CompiledAIRequest,
  AIResponse,
  AIStreamChunk,
  AIToolResponse,
  TokenUsage,
  CreditCost,
  ToolDefinition,
} from '../types';
import type { AIProviderAdapter, ProviderCapabilities } from './adapter';

const NOT_IMPLEMENTED = 'Self-hosted adapter not implemented — post-MVP';

export class SelfHostedAdapter implements AIProviderAdapter {
  readonly providerId = 'self-hosted' as const;

  async complete(_request: CompiledAIRequest): Promise<AIResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  // eslint-disable-next-line require-yield
  async *streamComplete(
    _request: CompiledAIRequest,
  ): AsyncIterable<AIStreamChunk> {
    throw new Error(NOT_IMPLEMENTED);
  }

  async completeWithTools(
    _request: CompiledAIRequest,
    _tools: ToolDefinition[],
  ): Promise<AIToolResponse> {
    throw new Error(NOT_IMPLEMENTED);
  }

  supportedCapabilities(): ProviderCapabilities {
    throw new Error(NOT_IMPLEMENTED);
  }

  calculateCost(_usage: TokenUsage): CreditCost {
    throw new Error(NOT_IMPLEMENTED);
  }
}
