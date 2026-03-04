/**
 * AIService — the single entry point for all AI calls in the platform.
 *
 * No code should call the Anthropic SDK or any provider adapter directly.
 * Feature code calls AIService.getInstance().execute() with a capability
 * request; the service handles routing, metering, and error handling.
 *
 * 6-Step Metering Flow (per call):
 *   1. Pre-check budget
 *   2. Route feature → task type → tier → provider/model
 *   3. Compile request
 *   4. Execute via provider adapter
 *   5. Calculate cost & log usage
 *   6. Deduct credits & check alert thresholds
 */

import type {
  CompiledAIRequest,
  AIStreamChunk,
  AIToolCall,
  JSONSchema,
  TokenUsage,
} from './types';
import type { AIProviderAdapter } from './providers/adapter';
import type { AITaskType, ProviderModelConfig } from './config/routing';
import { resolveRoute } from './config/routing';
import type { AIFeature } from './metering/features';
import { calculateCost } from './metering/cost-calculator';
import { logAIUsage } from './metering/usage-logger';
import { checkBudget, deductCredits, checkAlertThresholds } from './metering/credit-ledger';
import type { ToolRegistry } from './tools/registry';
import { createDefaultToolRegistry } from './tools/registry';
import {
  AIProviderError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
} from './providers/errors';
import { createLogger } from '../logging/logger';
import { getTraceId } from '../logging/trace-context';

const logger = createLogger({ service: 'ai-service' });

// ---------------------------------------------------------------------------
// Feature → TaskType mapping
// ---------------------------------------------------------------------------

/**
 * Maps AIFeature identifiers to their default AITaskType.
 * Used when AIServiceRequest.taskType is omitted — the service infers
 * the task type from the feature identifier.
 */
export const FEATURE_TASK_MAP: Readonly<Record<AIFeature, AITaskType>> = {
  command_bar: 'classify_intent',
  formula_suggest: 'suggest_schema',
  email_draft: 'draft_communication',
  automation_build: 'generate_automation',
  cross_base_analysis: 'conversation',
  guide_mode: 'conversation',
  doc_assist: 'draft_content',
  record_summary: 'summarize',
  app_suggest: 'generate_app',
  thread_summary: 'summarize',
  agent_planning: 'conversation',
  agent_tool_selection: 'classify_intent',
  agent_observation: 'summarize',
};

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

/** Context data that can be provided alongside the prompt */
export interface AIServiceContext {
  tableSchemas?: unknown[];
  recordSample?: unknown[];
  conversationHistory?: Array<{ role: string; content: string }>;
}

/** Request shape for AIService.execute() and AIService.stream() */
export interface AIServiceRequest {
  tenantId: string;
  userId: string;
  feature: AIFeature;
  prompt: string;
  context?: AIServiceContext;
  /** If omitted, inferred from feature via FEATURE_TASK_MAP */
  taskType?: AITaskType;
  outputSchema?: JSONSchema;
  /** Tool names from ToolRegistry to make available */
  tools?: string[];
  stream?: boolean;
}

/** Response shape returned by AIService.execute() */
export interface AIServiceResponse {
  success: boolean;
  content?: string;
  structuredOutput?: unknown;
  toolCalls?: AIToolCall[];
  creditsCharged: number;
  creditsRemaining: number;
  budgetExhausted?: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Context Builder — placeholder
// ---------------------------------------------------------------------------

/**
 * Build context text from the optional AIServiceContext.
 *
 * Placeholder: concatenates context fields into simple text.
 * Real Context Builder with schema retrieval ships in Phase 5.
 */
function buildContext(context?: AIServiceContext): string {
  if (!context) return '';

  const parts: string[] = [];

  if (context.tableSchemas && context.tableSchemas.length > 0) {
    parts.push(`Table schemas:\n${JSON.stringify(context.tableSchemas, null, 2)}`);
  }

  if (context.recordSample && context.recordSample.length > 0) {
    parts.push(`Record samples:\n${JSON.stringify(context.recordSample, null, 2)}`);
  }

  if (context.conversationHistory && context.conversationHistory.length > 0) {
    const history = context.conversationHistory
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');
    parts.push(`Conversation history:\n${history}`);
  }

  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// AIService — singleton
// ---------------------------------------------------------------------------

export class AIService {
  private static instance: AIService | null = null;

  private readonly adapters: Map<string, AIProviderAdapter>;
  private readonly toolRegistry: ToolRegistry;

  private constructor(
    adapters: Map<string, AIProviderAdapter>,
    toolRegistry?: ToolRegistry,
  ) {
    this.adapters = adapters;
    this.toolRegistry = toolRegistry ?? createDefaultToolRegistry();
  }

  /**
   * Get the singleton AIService instance.
   * Must be initialized first via AIService.initialize().
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      throw new Error(
        'AIService not initialized. Call AIService.initialize() first.',
      );
    }
    return AIService.instance;
  }

  /**
   * Initialize the singleton with provider adapters and an optional tool registry.
   * Typically called once at application startup.
   */
  static initialize(
    adapters: Map<string, AIProviderAdapter>,
    toolRegistry?: ToolRegistry,
  ): AIService {
    AIService.instance = new AIService(adapters, toolRegistry);
    return AIService.instance;
  }

  /**
   * Reset the singleton — used in tests only.
   * @internal
   */
  static resetInstance(): void {
    AIService.instance = null;
  }

  // -------------------------------------------------------------------------
  // execute() — the primary entry point
  // -------------------------------------------------------------------------

  /**
   * Execute an AI request through the 6-step metering flow.
   *
   * Step 1 — Pre-check: Budget
   * Step 2 — Route: Feature → TaskType → Tier → Provider/Model
   * Step 3 — Compile: Build CompiledAIRequest
   * Step 4 — Execute: Call provider adapter
   * Step 5 — Calculate & Log: Cost + usage log
   * Step 6 — Deduct & Alert: Credits + thresholds
   */
  async execute(request: AIServiceRequest): Promise<AIServiceResponse> {
    const traceId = getTraceId();

    // Step 1 — Pre-check budget
    const budgetStatus = await checkBudget(request.tenantId);
    if (budgetStatus.exhausted) {
      logger.info(
        { traceId, tenantId: request.tenantId, feature: request.feature },
        'AI request rejected — budget exhausted',
      );
      return {
        success: false,
        budgetExhausted: true,
        creditsCharged: 0,
        creditsRemaining: 0,
      };
    }

    // Step 2 — Route
    const taskType = request.taskType ?? FEATURE_TASK_MAP[request.feature];
    const routeConfig = resolveRoute(taskType);
    const adapter = this.getAdapter(routeConfig.providerId);

    // Step 3 — Compile
    const compiledRequest = this.compileRequest(request, routeConfig);
    const resolvedTools = this.resolveTools(request.tools);

    // Step 4 — Execute
    const startMs = Date.now();
    try {
      let content: string;
      let toolCalls: AIToolCall[] | undefined;
      let usage: TokenUsage;

      if (resolvedTools && resolvedTools.length > 0) {
        const toolResponse = await adapter.completeWithTools(compiledRequest, resolvedTools);
        content = toolResponse.content;
        toolCalls = toolResponse.toolCalls;
        usage = toolResponse.usage;
      } else {
        const response = await adapter.complete(compiledRequest);
        content = response.content;
        usage = response.usage;
      }

      const durationMs = Date.now() - startMs;

      // Step 5 — Calculate & Log
      const cost = calculateCost(routeConfig.modelId, usage);

      await logAIUsage({
        tenantId: request.tenantId,
        userId: request.userId,
        feature: request.feature,
        model: routeConfig.modelId,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cachedInput: usage.cached_input_tokens,
        costUsd: cost.cost_usd,
        creditsCharged: cost.credits_charged,
        durationMs,
        status: 'success',
      });

      // Step 6 — Deduct & Alert
      const updatedBudget = await deductCredits(request.tenantId, cost.credits_charged);
      const alerts = checkAlertThresholds(request.tenantId, updatedBudget);

      if (alerts.length > 0) {
        for (const alert of alerts) {
          logger.warn(
            { traceId, tenantId: request.tenantId, alertType: alert.type, usagePct: updatedBudget.usagePct },
            'AI budget alert threshold crossed',
          );
        }
      }

      return {
        success: true,
        content,
        toolCalls,
        creditsCharged: cost.credits_charged,
        creditsRemaining: updatedBudget.creditsRemaining,
      };
    } catch (error) {
      return this.handleExecutionError(error, request, routeConfig, startMs);
    }
  }

  // -------------------------------------------------------------------------
  // stream() — streaming entry point
  // -------------------------------------------------------------------------

  /**
   * Stream an AI request. Yields AIStreamChunks.
   *
   * Follows the same 6-step metering flow but yields intermediate content
   * and finalizes metering on the last chunk.
   */
  async *stream(request: AIServiceRequest): AsyncIterable<AIStreamChunk> {
    const traceId = getTraceId();

    // Step 1 — Pre-check budget
    const budgetStatus = await checkBudget(request.tenantId);
    if (budgetStatus.exhausted) {
      logger.info(
        { traceId, tenantId: request.tenantId, feature: request.feature },
        'AI stream rejected — budget exhausted',
      );
      return;
    }

    // Step 2 — Route
    const taskType = request.taskType ?? FEATURE_TASK_MAP[request.feature];
    const routeConfig = resolveRoute(taskType);
    const adapter = this.getAdapter(routeConfig.providerId);

    // Step 3 — Compile
    const compiledRequest = this.compileRequest(request, routeConfig);

    // Step 4 — Stream
    const startMs = Date.now();
    try {
      for await (const chunk of adapter.streamComplete(compiledRequest)) {
        yield chunk;

        // On the final chunk, finalize metering (Steps 5–6)
        if (chunk.done && chunk.usage) {
          const durationMs = Date.now() - startMs;
          const cost = calculateCost(routeConfig.modelId, chunk.usage);

          await logAIUsage({
            tenantId: request.tenantId,
            userId: request.userId,
            feature: request.feature,
            model: routeConfig.modelId,
            inputTokens: chunk.usage.input_tokens,
            outputTokens: chunk.usage.output_tokens,
            cachedInput: chunk.usage.cached_input_tokens,
            costUsd: cost.cost_usd,
            creditsCharged: cost.credits_charged,
            durationMs,
            status: 'success',
          });

          const updatedBudget = await deductCredits(request.tenantId, cost.credits_charged);
          const alerts = checkAlertThresholds(request.tenantId, updatedBudget);

          if (alerts.length > 0) {
            for (const alert of alerts) {
              logger.warn(
                { traceId, tenantId: request.tenantId, alertType: alert.type, usagePct: updatedBudget.usagePct },
                'AI budget alert threshold crossed (stream)',
              );
            }
          }
        }
      }
    } catch (error) {
      logger.error(
        {
          traceId,
          tenantId: request.tenantId,
          feature: request.feature,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        'AI stream execution failed',
      );
      // Stream errors cannot return a response — the caller handles
      // the async iterable ending abruptly
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getAdapter(providerId: string): AIProviderAdapter {
    const adapter = this.adapters.get(providerId);
    if (!adapter) {
      throw new Error(`No adapter registered for provider: ${providerId}`);
    }
    return adapter;
  }

  private compileRequest(
    request: AIServiceRequest,
    routeConfig: ProviderModelConfig,
  ): CompiledAIRequest {
    const contextText = buildContext(request.context);
    const systemInstruction = contextText
      ? `${contextText}\n\n${request.prompt}`
      : request.prompt;

    return {
      systemInstruction,
      messages: [{ role: 'user', content: request.prompt }],
      modelConfig: {
        modelId: routeConfig.modelId,
        providerId: routeConfig.providerId,
      },
      outputSchema: request.outputSchema,
      maxTokens: 4096,
      temperature: 0.7,
    };
  }

  private resolveTools(toolNames?: string[]) {
    if (!toolNames || toolNames.length === 0) return undefined;

    return toolNames
      .map((name) => this.toolRegistry.get(name))
      .filter((tool) => tool !== undefined);
  }

  private async handleExecutionError(
    error: unknown,
    request: AIServiceRequest,
    routeConfig: ProviderModelConfig,
    startMs: number,
  ): Promise<AIServiceResponse> {
    const traceId = getTraceId();
    const durationMs = Date.now() - startMs;

    let status = 'error';
    let errorCode: string | undefined;
    let userMessage = 'AI service temporarily unavailable';

    if (error instanceof AIProviderTimeoutError) {
      status = 'timeout';
      errorCode = 'TIMEOUT';
      userMessage = 'Request timed out';
    } else if (error instanceof AIProviderRateLimitError) {
      status = 'rate_limited';
      errorCode = 'RATE_LIMITED';
      userMessage = 'AI service temporarily unavailable';
    } else if (error instanceof AIProviderError) {
      errorCode = `PROVIDER_${error.statusCode ?? 'UNKNOWN'}`;
    }

    logger.error(
      {
        traceId,
        tenantId: request.tenantId,
        feature: request.feature,
        model: routeConfig.modelId,
        status,
        errorCode,
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'AI execution failed',
    );

    // Log failed call with zero credits
    await logAIUsage({
      tenantId: request.tenantId,
      userId: request.userId,
      feature: request.feature,
      model: routeConfig.modelId,
      inputTokens: 0,
      outputTokens: 0,
      cachedInput: 0,
      costUsd: 0,
      creditsCharged: 0,
      durationMs,
      status,
      errorCode,
    });

    // Get current budget for the response (don't deduct — zero credits)
    const currentBudget = await checkBudget(request.tenantId);

    return {
      success: false,
      error: userMessage,
      creditsCharged: 0,
      creditsRemaining: currentBudget.creditsRemaining,
    };
  }
}
