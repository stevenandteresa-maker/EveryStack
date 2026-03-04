/**
 * Anthropic Claude provider adapter.
 *
 * The only production adapter for MVP. Implements AIProviderAdapter
 * for all Claude models (Haiku, Sonnet, Opus).
 *
 * @anthropic-ai/sdk is imported ONLY in this file — never in feature code.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Message, ContentBlock, TextBlock, ToolUseBlock, Usage } from '@anthropic-ai/sdk/resources/messages';

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
import {
  AIProviderError,
  AIProviderAuthError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
} from './errors';

// ---------------------------------------------------------------------------
// Cost rate card (USD per million tokens)
// ---------------------------------------------------------------------------

interface ModelRates {
  inputPerMTok: number;
  outputPerMTok: number;
}

const MODEL_RATES: Record<string, ModelRates> = {
  // Haiku — $1/$5 per MTok
  'claude-haiku-4-5-20251001': { inputPerMTok: 1, outputPerMTok: 5 },
  // Sonnet — $3/$15 per MTok
  'claude-sonnet-4-5-20250929': { inputPerMTok: 3, outputPerMTok: 15 },
  // Opus — $5/$25 per MTok
  'claude-opus-4-6': { inputPerMTok: 5, outputPerMTok: 25 },
};

/** Default rates for unknown models — use Sonnet pricing as a safe default */
const DEFAULT_RATES: ModelRates = { inputPerMTok: 3, outputPerMTok: 15 };

// ---------------------------------------------------------------------------
// Anthropic Adapter
// ---------------------------------------------------------------------------

export class AnthropicAdapter implements AIProviderAdapter {
  readonly providerId = 'anthropic' as const;
  private readonly client: Anthropic;
  private readonly modelRates: Record<string, ModelRates>;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw new AIProviderAuthError(
        'ANTHROPIC_API_KEY is required but not set',
        'anthropic',
      );
    }
    this.client = new Anthropic({ apiKey: key, maxRetries: 0 });
    this.modelRates = MODEL_RATES;
  }

  // -------------------------------------------------------------------------
  // complete() — standard non-streaming call
  // -------------------------------------------------------------------------

  async complete(request: CompiledAIRequest): Promise<AIResponse> {
    try {
      const response: Message = await this.client.messages.create({
        ...this.buildMessageParams(request),
        stream: false,
      });

      return {
        content: this.extractTextContent(response.content),
        usage: this.normalizeUsage(response.usage),
        finishReason: this.mapStopReason(response.stop_reason),
        providerRequestId: response.id,
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // -------------------------------------------------------------------------
  // streamComplete() — streaming via async iterable
  // -------------------------------------------------------------------------

  async *streamComplete(
    request: CompiledAIRequest,
  ): AsyncIterable<AIStreamChunk> {
    try {
      const stream = this.client.messages.stream(
        this.buildMessageParams(request),
      );

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield { delta: event.delta.text, done: false };
        }
      }

      // Final chunk with usage from the accumulated message
      const finalMessage = await stream.finalMessage();
      yield {
        delta: '',
        done: true,
        usage: this.normalizeUsage(finalMessage.usage),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // -------------------------------------------------------------------------
  // completeWithTools() — tool/function calling
  // -------------------------------------------------------------------------

  async completeWithTools(
    request: CompiledAIRequest,
    tools: ToolDefinition[],
  ): Promise<AIToolResponse> {
    try {
      const anthropicTools: Anthropic.Tool[] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters as Anthropic.Tool['input_schema'],
      }));

      const response: Message = await this.client.messages.create({
        ...this.buildMessageParams(request),
        stream: false,
        tools: anthropicTools,
      });

      // Parse tool calls from tool_use content blocks
      const toolCalls = await Promise.all(
        response.content
          .filter(
            (block: ContentBlock): block is ToolUseBlock =>
              block.type === 'tool_use',
          )
          .map(async (block: ToolUseBlock) => {
            const toolDef = tools.find((t) => t.name === block.name);
            const result = toolDef
              ? await toolDef.handler(block.input)
              : { success: false, error: `Unknown tool: ${block.name}` };

            return {
              name: block.name,
              params: block.input as Record<string, unknown>,
              result,
            };
          }),
      );

      return {
        content: this.extractTextContent(response.content),
        toolCalls,
        usage: this.normalizeUsage(response.usage),
      };
    } catch (error) {
      throw this.mapError(error);
    }
  }

  // -------------------------------------------------------------------------
  // supportedCapabilities()
  // -------------------------------------------------------------------------

  supportedCapabilities(): ProviderCapabilities {
    return {
      maxContextTokens: 200_000,
      supportsStreaming: true,
      supportsToolUse: true,
      supportsPromptCaching: true,
      supportsBatchAPI: true,
      supportsStructuredOutput: true,
      supportsVision: true,
    };
  }

  // -------------------------------------------------------------------------
  // calculateCost()
  // -------------------------------------------------------------------------

  calculateCost(usage: TokenUsage): CreditCost {
    return this.calculateCostForModel(usage, this._lastModelId);
  }

  /**
   * Calculate cost for a specific model ID.
   * Exposed for direct use when the caller knows the model.
   */
  calculateCostForModel(usage: TokenUsage, modelId?: string): CreditCost {
    const rates: ModelRates =
      modelId !== undefined ? (this.modelRates[modelId] ?? DEFAULT_RATES) : DEFAULT_RATES;

    // Input cost: non-cached tokens at full price
    // Cached tokens are 90% cheaper (10% of input cost) on Anthropic
    const nonCachedInputTokens = usage.input_tokens - usage.cached_input_tokens;
    const inputCost =
      (nonCachedInputTokens * rates.inputPerMTok) / 1_000_000 +
      (usage.cached_input_tokens * rates.inputPerMTok * 0.1) / 1_000_000;

    const outputCost =
      (usage.output_tokens * rates.outputPerMTok) / 1_000_000;

    const costUsd = inputCost + outputCost;

    return {
      cost_usd: costUsd,
      credits_charged: Math.ceil(costUsd * 100),
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /** Tracks the last model ID used for cost calculation */
  private _lastModelId?: string;

  private buildMessageParams(
    request: CompiledAIRequest,
  ): Anthropic.MessageCreateParams {
    this._lastModelId = request.modelConfig.modelId;

    return {
      model: request.modelConfig.modelId,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: [
        {
          type: 'text' as const,
          text: request.systemInstruction,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: request.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
    };
  }

  private extractTextContent(content: ContentBlock[]): string {
    return content
      .filter((block: ContentBlock): block is TextBlock => block.type === 'text')
      .map((block: TextBlock) => block.text)
      .join('');
  }

  private normalizeUsage(usage: Usage): TokenUsage {
    return {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cached_input_tokens:
        (usage as unknown as Record<string, unknown>)['cache_read_input_tokens'] as number ?? 0,
    };
  }

  private mapStopReason(
    reason: string | null,
  ): AIResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'max_tokens';
      case 'tool_use':
        return 'tool_use';
      default:
        return 'stop';
    }
  }

  private mapError(error: unknown): AIProviderError {
    if (error instanceof AIProviderError) {
      return error;
    }

    if (error instanceof Anthropic.APIError) {
      const status = error.status;
      const msg = error.message;

      if (status === 401 || status === 403) {
        return new AIProviderAuthError(msg, 'anthropic', { cause: error });
      }

      if (status === 429) {
        const retryAfter = this.parseRetryAfter(error.headers);
        return new AIProviderRateLimitError(
          msg,
          'anthropic',
          retryAfter,
          { cause: error },
        );
      }

      return new AIProviderError(msg, 'anthropic', status, {
        cause: error,
      });
    }

    if (error instanceof Anthropic.APIConnectionError) {
      return new AIProviderTimeoutError(
        error.message || 'Connection timed out',
        'anthropic',
        { cause: error },
      );
    }

    const msg =
      error instanceof Error ? error.message : 'Unknown provider error';
    return new AIProviderError(msg, 'anthropic', undefined, {
      cause: error,
    });
  }

  private parseRetryAfter(headers: Record<string, string | null | undefined> | null | undefined): number | undefined {
    if (!headers) return undefined;

    const retryAfterStr = headers['retry-after'];
    if (!retryAfterStr) return undefined;

    const parsed = Number(retryAfterStr);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
}
