import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — set up before importing module under test
// ---------------------------------------------------------------------------

const mockCheckBudget = vi.fn();
const mockDeductCredits = vi.fn();
const mockCheckAlertThresholds = vi.fn();
const mockLogAIUsage = vi.fn();
const mockCalculateCost = vi.fn();

vi.mock('../metering/credit-ledger', () => ({
  checkBudget: (...args: unknown[]) => mockCheckBudget(...args),
  deductCredits: (...args: unknown[]) => mockDeductCredits(...args),
  checkAlertThresholds: (...args: unknown[]) => mockCheckAlertThresholds(...args),
}));

vi.mock('../metering/usage-logger', () => ({
  logAIUsage: (...args: unknown[]) => mockLogAIUsage(...args),
}));

vi.mock('../metering/cost-calculator', () => ({
  calculateCost: (...args: unknown[]) => mockCalculateCost(...args),
}));

vi.mock('../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../logging/trace-context', () => ({
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

import { AIService, FEATURE_TASK_MAP } from '../service';
import type { AIServiceRequest } from '../service';
import type { AIProviderAdapter } from '../providers/adapter';
import type {
  AIResponse,
  AIToolResponse,
  AIStreamChunk,
  TokenUsage,
  CreditCost,
  ToolDefinition,
} from '../types';
import { AIProviderError, AIProviderRateLimitError, AIProviderTimeoutError } from '../providers/errors';
import { ToolRegistry } from '../tools/registry';
import type { BudgetStatus } from '../metering/credit-ledger';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const TENANT_ID = '01900000-0000-7000-8000-aaaaaaaaaaaa';
const USER_ID = '01900000-0000-7000-8000-bbbbbbbbbbbb';

const DEFAULT_USAGE: TokenUsage = {
  input_tokens: 100,
  output_tokens: 50,
  cached_input_tokens: 20,
};

const DEFAULT_COST: CreditCost = {
  cost_usd: 0.00025,
  credits_charged: 1,
};

const HEALTHY_BUDGET: BudgetStatus = {
  creditsTotal: 2500,
  creditsUsed: 1000,
  creditsRemaining: 1500,
  usagePct: 40,
  exhausted: false,
};

const EXHAUSTED_BUDGET: BudgetStatus = {
  creditsTotal: 2500,
  creditsUsed: 2500,
  creditsRemaining: 0,
  usagePct: 100,
  exhausted: true,
};

function createMockAdapter(overrides?: Partial<AIProviderAdapter>): AIProviderAdapter {
  return {
    providerId: 'anthropic',
    complete: vi.fn().mockResolvedValue({
      content: 'mock response',
      usage: DEFAULT_USAGE,
      finishReason: 'stop',
      providerRequestId: 'req-123',
    } satisfies AIResponse),
    streamComplete: vi.fn(),
    completeWithTools: vi.fn().mockResolvedValue({
      content: 'tool response',
      toolCalls: [
        {
          name: 'search_records',
          params: { query: 'test' },
          result: { success: true, data: [] },
        },
      ],
      usage: DEFAULT_USAGE,
    } satisfies AIToolResponse),
    supportedCapabilities: vi.fn().mockReturnValue({
      maxContextTokens: 200_000,
      supportsStreaming: true,
      supportsToolUse: true,
      supportsPromptCaching: true,
      supportsBatchAPI: true,
      supportsStructuredOutput: true,
      supportsVision: true,
    }),
    calculateCost: vi.fn().mockReturnValue(DEFAULT_COST),
    ...overrides,
  };
}

function createMockToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  const mockTool: ToolDefinition = {
    name: 'search_records',
    description: 'Search records',
    parameters: { type: 'object', properties: {} },
    handler: vi.fn().mockResolvedValue({ success: true, data: [] }),
    requiredPermissions: ['records:read'],
  };
  registry.register(mockTool);
  return registry;
}

function makeRequest(overrides?: Partial<AIServiceRequest>): AIServiceRequest {
  return {
    tenantId: TENANT_ID,
    userId: USER_ID,
    feature: 'command_bar',
    prompt: 'Find all records with status active',
    ...overrides,
  };
}

function setupHealthyMocks() {
  mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
  mockCalculateCost.mockReturnValue(DEFAULT_COST);
  mockLogAIUsage.mockResolvedValue(undefined);
  mockDeductCredits.mockResolvedValue({
    ...HEALTHY_BUDGET,
    creditsUsed: 1001,
    creditsRemaining: 1499,
  });
  mockCheckAlertThresholds.mockReturnValue([]);
}

function initService(adapter?: AIProviderAdapter, toolRegistry?: ToolRegistry): AIService {
  const adapters = new Map<string, AIProviderAdapter>();
  adapters.set('anthropic', adapter ?? createMockAdapter());
  return AIService.initialize(adapters, toolRegistry);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  AIService.resetInstance();
});

afterEach(() => {
  AIService.resetInstance();
});

describe('AIService — Singleton', () => {
  it('getInstance() throws before initialize()', () => {
    expect(() => AIService.getInstance()).toThrow('AIService not initialized');
  });

  it('getInstance() returns the same instance after initialize()', () => {
    initService();
    const a = AIService.getInstance();
    const b = AIService.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance() clears the singleton', () => {
    initService();
    AIService.resetInstance();
    expect(() => AIService.getInstance()).toThrow('AIService not initialized');
  });

  it('initialize() can be called again after reset', () => {
    initService();
    AIService.resetInstance();
    const service = initService();
    expect(AIService.getInstance()).toBe(service);
  });
});

describe('AIService.execute() — Happy Path', () => {
  it('executes the 6-step flow and returns success response', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    const service = initService(adapter);

    const result = await service.execute(makeRequest());

    expect(result.success).toBe(true);
    expect(result.content).toBe('mock response');
    expect(result.creditsCharged).toBe(1);
    expect(result.creditsRemaining).toBe(1499);
    expect(result.budgetExhausted).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('calls checkBudget first (Step 1)', async () => {
    setupHealthyMocks();
    initService();

    await AIService.getInstance().execute(makeRequest());

    expect(mockCheckBudget).toHaveBeenCalledWith(TENANT_ID);
    expect(mockCheckBudget).toHaveBeenCalledTimes(1);
  });

  it('routes through the adapter (Step 4)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(adapter.complete).toHaveBeenCalledTimes(1);
    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-haiku-4-5-20251001');
    expect(compiledReq.modelConfig.providerId).toBe('anthropic');
  });

  it('calculates cost and logs usage (Step 5)', async () => {
    setupHealthyMocks();
    initService();

    await AIService.getInstance().execute(makeRequest());

    expect(mockCalculateCost).toHaveBeenCalledWith(
      'claude-haiku-4-5-20251001',
      DEFAULT_USAGE,
    );
    expect(mockLogAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 100,
        outputTokens: 50,
        cachedInput: 20,
        creditsCharged: 1,
        status: 'success',
      }),
    );
  });

  it('deducts credits (Step 6)', async () => {
    setupHealthyMocks();
    initService();

    await AIService.getInstance().execute(makeRequest());

    expect(mockDeductCredits).toHaveBeenCalledWith(TENANT_ID, 1);
  });
});

describe('AIService.execute() — Budget Exhaustion', () => {
  it('returns budgetExhausted: true when budget is exhausted', async () => {
    mockCheckBudget.mockResolvedValue(EXHAUSTED_BUDGET);
    const adapter = createMockAdapter();
    initService(adapter);

    const result = await AIService.getInstance().execute(makeRequest());

    expect(result.success).toBe(false);
    expect(result.budgetExhausted).toBe(true);
    expect(result.creditsCharged).toBe(0);
    expect(result.creditsRemaining).toBe(0);
  });

  it('does NOT call the provider adapter when budget is exhausted', async () => {
    mockCheckBudget.mockResolvedValue(EXHAUSTED_BUDGET);
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(adapter.complete).not.toHaveBeenCalled();
    expect(adapter.completeWithTools).not.toHaveBeenCalled();
  });

  it('does NOT log usage when budget is exhausted', async () => {
    mockCheckBudget.mockResolvedValue(EXHAUSTED_BUDGET);
    initService();

    await AIService.getInstance().execute(makeRequest());

    expect(mockLogAIUsage).not.toHaveBeenCalled();
  });

  it('does NOT deduct credits when budget is exhausted', async () => {
    mockCheckBudget.mockResolvedValue(EXHAUSTED_BUDGET);
    initService();

    await AIService.getInstance().execute(makeRequest());

    expect(mockDeductCredits).not.toHaveBeenCalled();
  });
});

describe('AIService.execute() — API Error Handling', () => {
  it('returns error with zero credits on provider error', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockLogAIUsage.mockResolvedValue(undefined);
    // checkBudget called again in error handler for creditsRemaining
    mockCheckBudget.mockResolvedValueOnce(HEALTHY_BUDGET).mockResolvedValueOnce(HEALTHY_BUDGET);

    const adapter = createMockAdapter({
      complete: vi.fn().mockRejectedValue(
        new AIProviderError('Server error', 'anthropic', 500),
      ),
    });
    initService(adapter);

    const result = await AIService.getInstance().execute(makeRequest());

    expect(result.success).toBe(false);
    expect(result.error).toBe('AI service temporarily unavailable');
    expect(result.creditsCharged).toBe(0);
  });

  it('logs error usage with status: error and zero credits', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockLogAIUsage.mockResolvedValue(undefined);

    const adapter = createMockAdapter({
      complete: vi.fn().mockRejectedValue(
        new AIProviderError('Server error', 'anthropic', 500),
      ),
    });
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(mockLogAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        creditsCharged: 0,
        inputTokens: 0,
        outputTokens: 0,
      }),
    );
  });

  it('returns "Request timed out" on timeout error', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockLogAIUsage.mockResolvedValue(undefined);

    const adapter = createMockAdapter({
      complete: vi.fn().mockRejectedValue(
        new AIProviderTimeoutError('Connection timed out', 'anthropic'),
      ),
    });
    initService(adapter);

    const result = await AIService.getInstance().execute(makeRequest());

    expect(result.success).toBe(false);
    expect(result.error).toBe('Request timed out');
  });

  it('logs rate_limited status on rate limit error', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockLogAIUsage.mockResolvedValue(undefined);

    const adapter = createMockAdapter({
      complete: vi.fn().mockRejectedValue(
        new AIProviderRateLimitError('Rate limited', 'anthropic', 30),
      ),
    });
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(mockLogAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'rate_limited',
        errorCode: 'RATE_LIMITED',
      }),
    );
  });

  it('never exposes provider details in error messages', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockLogAIUsage.mockResolvedValue(undefined);

    const adapter = createMockAdapter({
      complete: vi.fn().mockRejectedValue(
        new AIProviderError('Anthropic internal: model overloaded claude-sonnet-4-5', 'anthropic', 529),
      ),
    });
    initService(adapter);

    const result = await AIService.getInstance().execute(makeRequest());

    expect(result.error).not.toContain('Anthropic');
    expect(result.error).not.toContain('claude-sonnet');
    expect(result.error).toBe('AI service temporarily unavailable');
  });
});

describe('AIService.execute() — Feature Routing', () => {
  it('command_bar routes to fast tier (Haiku)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest({ feature: 'command_bar' }));

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-haiku-4-5-20251001');
  });

  it('record_summary routes to fast tier (Haiku)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest({ feature: 'record_summary' }));

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-haiku-4-5-20251001');
  });

  it('email_draft routes to standard tier (Sonnet)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest({ feature: 'email_draft' }));

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-sonnet-4-5-20250929');
  });

  it('automation_build routes to standard tier (Sonnet)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest({ feature: 'automation_build' }));

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-sonnet-4-5-20250929');
  });

  it('app_suggest routes to advanced tier (Opus)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest({ feature: 'app_suggest' }));

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-opus-4-6');
  });

  it('uses explicit taskType when provided (overrides feature mapping)', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    // command_bar normally maps to classify_intent (fast/Haiku)
    // but explicit conversation task type should route to standard/Sonnet
    await AIService.getInstance().execute(
      makeRequest({ feature: 'command_bar', taskType: 'conversation' }),
    );

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.modelConfig.modelId).toBe('claude-sonnet-4-5-20250929');
  });
});

describe('AIService.execute() — Tool Use', () => {
  it('resolves tools from ToolRegistry and calls completeWithTools', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    const toolRegistry = createMockToolRegistry();
    initService(adapter, toolRegistry);

    const result = await AIService.getInstance().execute(
      makeRequest({ tools: ['search_records'] }),
    );

    expect(adapter.completeWithTools).toHaveBeenCalledTimes(1);
    expect(adapter.complete).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0]!.name).toBe('search_records');
  });

  it('falls back to complete() when no tools are specified', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(adapter.complete).toHaveBeenCalledTimes(1);
    expect(adapter.completeWithTools).not.toHaveBeenCalled();
  });

  it('ignores unknown tool names gracefully', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    const toolRegistry = createMockToolRegistry();
    initService(adapter, toolRegistry);

    await AIService.getInstance().execute(
      makeRequest({ tools: ['nonexistent_tool'] }),
    );

    // No tools resolved → falls back to complete()
    expect(adapter.complete).toHaveBeenCalledTimes(1);
    expect(adapter.completeWithTools).not.toHaveBeenCalled();
  });
});

describe('AIService.execute() — Alert Thresholds', () => {
  it('logs warn when 80% threshold is crossed', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockCalculateCost.mockReturnValue(DEFAULT_COST);
    mockLogAIUsage.mockResolvedValue(undefined);

    const updatedBudget: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2001,
      creditsRemaining: 499,
      usagePct: 80,
      exhausted: false,
    };
    mockDeductCredits.mockResolvedValue(updatedBudget);
    mockCheckAlertThresholds.mockReturnValue([
      { type: 'budget_80pct', tenantId: TENANT_ID },
    ]);

    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(mockCheckAlertThresholds).toHaveBeenCalledWith(
      TENANT_ID,
      updatedBudget,
    );
  });

  it('logs warn when 95% threshold is crossed', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockCalculateCost.mockReturnValue(DEFAULT_COST);
    mockLogAIUsage.mockResolvedValue(undefined);

    const updatedBudget: BudgetStatus = {
      creditsTotal: 2500,
      creditsUsed: 2376,
      creditsRemaining: 124,
      usagePct: 95,
      exhausted: false,
    };
    mockDeductCredits.mockResolvedValue(updatedBudget);
    mockCheckAlertThresholds.mockReturnValue([
      { type: 'budget_95pct', tenantId: TENANT_ID },
    ]);

    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(makeRequest());

    expect(mockCheckAlertThresholds).toHaveBeenCalledWith(
      TENANT_ID,
      updatedBudget,
    );
  });

  it('does not log when no thresholds crossed', async () => {
    setupHealthyMocks();
    initService();

    await AIService.getInstance().execute(makeRequest());

    // checkAlertThresholds returns [], so no warn logs
    expect(mockCheckAlertThresholds).toHaveBeenCalledTimes(1);
  });
});

describe('AIService.execute() — Context Builder', () => {
  it('includes context in the system instruction when provided', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(
      makeRequest({
        context: {
          tableSchemas: [{ id: 'table-1', name: 'Tasks' }],
          recordSample: [{ id: 'rec-1' }],
        },
      }),
    );

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.systemInstruction).toContain('Table schemas:');
    expect(compiledReq.systemInstruction).toContain('Record samples:');
    expect(compiledReq.systemInstruction).toContain('Tasks');
  });

  it('includes conversation history in context', async () => {
    setupHealthyMocks();
    const adapter = createMockAdapter();
    initService(adapter);

    await AIService.getInstance().execute(
      makeRequest({
        context: {
          conversationHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
          ],
        },
      }),
    );

    const compiledReq = (adapter.complete as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(compiledReq.systemInstruction).toContain('Conversation history:');
    expect(compiledReq.systemInstruction).toContain('user: Hello');
  });
});

describe('AIService.stream()', () => {
  it('yields chunks from the adapter', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockCalculateCost.mockReturnValue(DEFAULT_COST);
    mockLogAIUsage.mockResolvedValue(undefined);
    mockDeductCredits.mockResolvedValue(HEALTHY_BUDGET);
    mockCheckAlertThresholds.mockReturnValue([]);

    const chunks: AIStreamChunk[] = [
      { delta: 'Hello', done: false },
      { delta: ' world', done: false },
      { delta: '', done: true, usage: DEFAULT_USAGE },
    ];

    async function* mockStream() {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    const adapter = createMockAdapter({
      streamComplete: vi.fn().mockReturnValue(mockStream()),
    });
    initService(adapter);

    const collected: AIStreamChunk[] = [];
    for await (const chunk of AIService.getInstance().stream(makeRequest())) {
      collected.push(chunk);
    }

    expect(collected).toHaveLength(3);
    expect(collected[0]!.delta).toBe('Hello');
    expect(collected[2]!.done).toBe(true);
  });

  it('does not yield chunks when budget is exhausted', async () => {
    mockCheckBudget.mockResolvedValue(EXHAUSTED_BUDGET);

    initService();

    const collected: AIStreamChunk[] = [];
    for await (const chunk of AIService.getInstance().stream(makeRequest())) {
      collected.push(chunk);
    }

    expect(collected).toHaveLength(0);
  });

  it('logs and deducts credits on the final chunk', async () => {
    mockCheckBudget.mockResolvedValue(HEALTHY_BUDGET);
    mockCalculateCost.mockReturnValue(DEFAULT_COST);
    mockLogAIUsage.mockResolvedValue(undefined);
    mockDeductCredits.mockResolvedValue(HEALTHY_BUDGET);
    mockCheckAlertThresholds.mockReturnValue([]);

    async function* mockStream() {
      yield { delta: 'Hi', done: false };
      yield { delta: '', done: true, usage: DEFAULT_USAGE };
    }

    const adapter = createMockAdapter({
      streamComplete: vi.fn().mockReturnValue(mockStream()),
    });
    initService(adapter);

    // Consume the stream
    for await (const _chunk of AIService.getInstance().stream(makeRequest())) {
      // consume
    }

    expect(mockLogAIUsage).toHaveBeenCalledTimes(1);
    expect(mockDeductCredits).toHaveBeenCalledTimes(1);
  });
});

describe('FEATURE_TASK_MAP', () => {
  it('maps all 13 AIFeature values to valid AITaskType values', () => {
    const expectedMappings: Record<string, string> = {
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

    expect(FEATURE_TASK_MAP).toEqual(expectedMappings);
  });

  it('maps command_bar to fast tier', () => {
    expect(FEATURE_TASK_MAP.command_bar).toBe('classify_intent');
  });

  it('maps conversation features to standard tier tasks', () => {
    expect(FEATURE_TASK_MAP.email_draft).toBe('draft_communication');
    expect(FEATURE_TASK_MAP.automation_build).toBe('generate_automation');
    expect(FEATURE_TASK_MAP.doc_assist).toBe('draft_content');
  });
});
