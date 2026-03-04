import { describe, it, expectTypeOf } from 'vitest';
import type {
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
  ProviderCapabilities,
  AIProviderAdapter,
} from '../index';

describe('AI type system — barrel exports', () => {
  it('exports CapabilityTier as a union of fast | standard | advanced', () => {
    expectTypeOf<CapabilityTier>().toEqualTypeOf<
      'fast' | 'standard' | 'advanced'
    >();
  });

  it('exports ProviderId with self-hosted extension point', () => {
    expectTypeOf<ProviderId>().toEqualTypeOf<
      'anthropic' | 'openai' | 'self-hosted'
    >();
  });

  it('exports AIMessage with role and content', () => {
    expectTypeOf<AIMessage>().toHaveProperty('role');
    expectTypeOf<AIMessage>().toHaveProperty('content');
    expectTypeOf<AIMessage['role']>().toEqualTypeOf<
      'system' | 'user' | 'assistant'
    >();
    expectTypeOf<AIMessage['content']>().toBeString();
  });

  it('exports CompiledAIRequest with required fields', () => {
    expectTypeOf<CompiledAIRequest>().toHaveProperty('systemInstruction');
    expectTypeOf<CompiledAIRequest>().toHaveProperty('messages');
    expectTypeOf<CompiledAIRequest>().toHaveProperty('modelConfig');
    expectTypeOf<CompiledAIRequest>().toHaveProperty('maxTokens');
    expectTypeOf<CompiledAIRequest>().toHaveProperty('temperature');
    expectTypeOf<CompiledAIRequest['messages']>().toEqualTypeOf<AIMessage[]>();
    expectTypeOf<CompiledAIRequest['modelConfig']['providerId']>().toEqualTypeOf<ProviderId>();
  });

  it('exports TokenUsage with all three token counts', () => {
    expectTypeOf<TokenUsage>().toHaveProperty('input_tokens');
    expectTypeOf<TokenUsage>().toHaveProperty('output_tokens');
    expectTypeOf<TokenUsage>().toHaveProperty('cached_input_tokens');
    expectTypeOf<TokenUsage['input_tokens']>().toBeNumber();
    expectTypeOf<TokenUsage['output_tokens']>().toBeNumber();
    expectTypeOf<TokenUsage['cached_input_tokens']>().toBeNumber();
  });

  it('exports CreditCost with cost_usd and credits_charged', () => {
    expectTypeOf<CreditCost>().toHaveProperty('cost_usd');
    expectTypeOf<CreditCost>().toHaveProperty('credits_charged');
    expectTypeOf<CreditCost['cost_usd']>().toBeNumber();
    expectTypeOf<CreditCost['credits_charged']>().toBeNumber();
  });

  it('exports AIResponse with content, usage, finishReason, providerRequestId', () => {
    expectTypeOf<AIResponse>().toHaveProperty('content');
    expectTypeOf<AIResponse>().toHaveProperty('usage');
    expectTypeOf<AIResponse>().toHaveProperty('finishReason');
    expectTypeOf<AIResponse>().toHaveProperty('providerRequestId');
    expectTypeOf<AIResponse['content']>().toBeString();
    expectTypeOf<AIResponse['usage']>().toEqualTypeOf<TokenUsage>();
    expectTypeOf<AIResponse['finishReason']>().toEqualTypeOf<
      'stop' | 'max_tokens' | 'tool_use' | 'error'
    >();
  });

  it('exports AIStreamChunk with delta, done, optional usage', () => {
    expectTypeOf<AIStreamChunk>().toHaveProperty('delta');
    expectTypeOf<AIStreamChunk>().toHaveProperty('done');
    expectTypeOf<AIStreamChunk['delta']>().toBeString();
    expectTypeOf<AIStreamChunk['done']>().toBeBoolean();
    expectTypeOf<AIStreamChunk['usage']>().toEqualTypeOf<
      TokenUsage | undefined
    >();
  });

  it('exports ToolDefinition with name, description, parameters, handler, requiredPermissions', () => {
    expectTypeOf<ToolDefinition>().toHaveProperty('name');
    expectTypeOf<ToolDefinition>().toHaveProperty('description');
    expectTypeOf<ToolDefinition>().toHaveProperty('parameters');
    expectTypeOf<ToolDefinition>().toHaveProperty('handler');
    expectTypeOf<ToolDefinition>().toHaveProperty('requiredPermissions');
    expectTypeOf<ToolDefinition['name']>().toBeString();
    expectTypeOf<ToolDefinition['parameters']>().toEqualTypeOf<JSONSchema>();
    expectTypeOf<ToolDefinition['requiredPermissions']>().toEqualTypeOf<string[]>();
  });

  it('exports AIToolCall with name, params, result', () => {
    expectTypeOf<AIToolCall>().toHaveProperty('name');
    expectTypeOf<AIToolCall>().toHaveProperty('params');
    expectTypeOf<AIToolCall>().toHaveProperty('result');
    expectTypeOf<AIToolCall['params']>().toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf<AIToolCall['result']>().toEqualTypeOf<ToolResult>();
  });

  it('exports AIToolResponse with content, toolCalls, usage', () => {
    expectTypeOf<AIToolResponse>().toHaveProperty('content');
    expectTypeOf<AIToolResponse>().toHaveProperty('toolCalls');
    expectTypeOf<AIToolResponse>().toHaveProperty('usage');
    expectTypeOf<AIToolResponse['toolCalls']>().toEqualTypeOf<AIToolCall[]>();
    expectTypeOf<AIToolResponse['usage']>().toEqualTypeOf<TokenUsage>();
  });

  it('exports ProviderCapabilities with all 7 flags including supportsVision', () => {
    expectTypeOf<ProviderCapabilities>().toHaveProperty('maxContextTokens');
    expectTypeOf<ProviderCapabilities>().toHaveProperty('supportsStreaming');
    expectTypeOf<ProviderCapabilities>().toHaveProperty('supportsToolUse');
    expectTypeOf<ProviderCapabilities>().toHaveProperty('supportsPromptCaching');
    expectTypeOf<ProviderCapabilities>().toHaveProperty('supportsBatchAPI');
    expectTypeOf<ProviderCapabilities>().toHaveProperty('supportsStructuredOutput');
    expectTypeOf<ProviderCapabilities>().toHaveProperty('supportsVision');
    expectTypeOf<ProviderCapabilities['maxContextTokens']>().toBeNumber();
    expectTypeOf<ProviderCapabilities['supportsVision']>().toBeBoolean();
  });

  it('exports AIProviderAdapter with all required methods', () => {
    expectTypeOf<AIProviderAdapter>().toHaveProperty('providerId');
    expectTypeOf<AIProviderAdapter>().toHaveProperty('complete');
    expectTypeOf<AIProviderAdapter>().toHaveProperty('streamComplete');
    expectTypeOf<AIProviderAdapter>().toHaveProperty('completeWithTools');
    expectTypeOf<AIProviderAdapter>().toHaveProperty('supportedCapabilities');
    expectTypeOf<AIProviderAdapter>().toHaveProperty('calculateCost');
    expectTypeOf<AIProviderAdapter['providerId']>().toEqualTypeOf<ProviderId>();
  });

  it('exports AgentScope with allowedTools and permissionConstraints (post-MVP shape)', () => {
    expectTypeOf<AgentScope>().toHaveProperty('allowedTools');
    expectTypeOf<AgentScope>().toHaveProperty('permissionConstraints');
    expectTypeOf<AgentScope['allowedTools']>().toEqualTypeOf<ReadonlySet<string>>();
    expectTypeOf<AgentScope['permissionConstraints']>().toHaveProperty('maxRoleLevel');
    expectTypeOf<AgentScope['permissionConstraints']>().toHaveProperty('workspaceIds');
    expectTypeOf<AgentScope['permissionConstraints']>().toHaveProperty('canWrite');
  });

  it('exports AgentConfig with budgetCredits, maxSteps, scope, timeoutMs (post-MVP shape)', () => {
    expectTypeOf<AgentConfig>().toHaveProperty('budgetCredits');
    expectTypeOf<AgentConfig>().toHaveProperty('maxSteps');
    expectTypeOf<AgentConfig>().toHaveProperty('scope');
    expectTypeOf<AgentConfig>().toHaveProperty('timeoutMs');
    expectTypeOf<AgentConfig['budgetCredits']>().toBeNumber();
    expectTypeOf<AgentConfig['scope']>().toEqualTypeOf<AgentScope>();
  });

  it('exports EmbeddingProvider with embed, embedBatch, dimensions (post-MVP shape)', () => {
    expectTypeOf<EmbeddingProvider>().toHaveProperty('embed');
    expectTypeOf<EmbeddingProvider>().toHaveProperty('embedBatch');
    expectTypeOf<EmbeddingProvider>().toHaveProperty('dimensions');
    expectTypeOf<EmbeddingProvider['dimensions']>().toBeNumber();
  });
});
