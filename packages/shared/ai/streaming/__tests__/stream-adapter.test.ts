import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — set up before importing module under test
// ---------------------------------------------------------------------------

vi.mock('../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../logging/trace-context', () => ({
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

// Mock metering modules (used by AIService internally)
const mockCheckBudget = vi.fn();
const mockDeductCredits = vi.fn();
const mockCheckAlertThresholds = vi.fn();
const mockLogAIUsage = vi.fn();
const mockCalculateCost = vi.fn();

vi.mock('../../metering/credit-ledger', () => ({
  checkBudget: (...args: unknown[]) => mockCheckBudget(...args),
  deductCredits: (...args: unknown[]) => mockDeductCredits(...args),
  checkAlertThresholds: (...args: unknown[]) => mockCheckAlertThresholds(...args),
}));

vi.mock('../../metering/usage-logger', () => ({
  logAIUsage: (...args: unknown[]) => mockLogAIUsage(...args),
}));

vi.mock('../../metering/cost-calculator', () => ({
  calculateCost: (...args: unknown[]) => mockCalculateCost(...args),
}));

import { createAIStream } from '../stream-adapter';
import { AIService } from '../../service';
import type { AIProviderAdapter } from '../../providers/adapter';
import type {
  AIStreamChunk,
  AIResponse,
  AIToolResponse,
  TokenUsage,
  CreditCost,
} from '../../types';
import type { BudgetStatus } from '../../metering/credit-ledger';

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

function createMockAdapter(
  streamChunks: AIStreamChunk[],
): AIProviderAdapter {
  async function* mockStream() {
    for (const chunk of streamChunks) {
      yield chunk;
    }
  }

  return {
    providerId: 'anthropic',
    complete: vi.fn().mockResolvedValue({
      content: 'mock response',
      usage: DEFAULT_USAGE,
      finishReason: 'stop',
      providerRequestId: 'req-123',
    } satisfies AIResponse),
    streamComplete: vi.fn().mockReturnValue(mockStream()),
    completeWithTools: vi.fn().mockResolvedValue({
      content: 'tool response',
      toolCalls: [],
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
  };
}

function initServiceWithChunks(chunks: AIStreamChunk[]): AIService {
  const adapters = new Map<string, AIProviderAdapter>();
  adapters.set('anthropic', createMockAdapter(chunks));
  return AIService.initialize(adapters);
}

function initServiceWithErrorAdapter(error: Error): AIService {
  const adapter: AIProviderAdapter = {
    providerId: 'anthropic',
    complete: vi.fn(),
    streamComplete: vi.fn().mockImplementation(async function* () {
      yield { delta: 'partial', done: false } as AIStreamChunk;
      throw error;
    }),
    completeWithTools: vi.fn(),
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
  };

  const adapters = new Map<string, AIProviderAdapter>();
  adapters.set('anthropic', adapter);
  return AIService.initialize(adapters);
}

async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  result += decoder.decode(); // flush
  return result;
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

describe('createAIStream', () => {
  it('produces a valid ReadableStream from mocked adapter chunks', async () => {
    setupHealthyMocks();
    const chunks: AIStreamChunk[] = [
      { delta: 'Hello', done: false },
      { delta: ' world', done: false },
      { delta: '', done: true, usage: DEFAULT_USAGE },
    ];

    const service = initServiceWithChunks(chunks);

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test prompt',
      },
      service,
    );

    expect(stream).toBeInstanceOf(ReadableStream);
    const text = await readStreamToString(stream);
    expect(text).toBe('Hello world');
  }, 10_000);

  it('stream completes and final usage is accumulated', async () => {
    setupHealthyMocks();
    const chunks: AIStreamChunk[] = [
      { delta: 'chunk1', done: false },
      { delta: 'chunk2', done: false },
      { delta: '', done: true, usage: DEFAULT_USAGE },
    ];

    const service = initServiceWithChunks(chunks);

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test',
      },
      service,
    );

    await readStreamToString(stream);

    // Metering fires inside AIService.stream() on the final chunk
    expect(mockLogAIUsage).toHaveBeenCalledTimes(1);
    expect(mockLogAIUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        inputTokens: 100,
        outputTokens: 50,
        status: 'success',
      }),
    );
  }, 10_000);

  it('metering fires after stream completes, not during', async () => {
    setupHealthyMocks();
    const chunks: AIStreamChunk[] = [
      { delta: 'a', done: false },
      { delta: 'b', done: false },
      { delta: 'c', done: false },
      { delta: '', done: true, usage: DEFAULT_USAGE },
    ];

    const service = initServiceWithChunks(chunks);

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test',
      },
      service,
    );

    // Read chunks one at a time
    const reader = stream.getReader();

    // Read first 3 non-final chunks
    await reader.read(); // 'a'
    await reader.read(); // 'b'
    await reader.read(); // 'c'

    // Metering should NOT have fired yet (only on final chunk)
    expect(mockLogAIUsage).not.toHaveBeenCalled();
    expect(mockDeductCredits).not.toHaveBeenCalled();

    // Read final chunk — triggers metering
    await reader.read(); // done=true, triggers metering in AIService.stream()

    // Now drain to close
    await reader.read(); // stream end

    expect(mockLogAIUsage).toHaveBeenCalledTimes(1);
    expect(mockDeductCredits).toHaveBeenCalledTimes(1);
  }, 10_000);

  it('error mid-stream closes gracefully with zero credits', async () => {
    setupHealthyMocks();

    const service = initServiceWithErrorAdapter(new Error('Provider exploded'));

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test',
      },
      service,
    );

    // Should not throw — stream closes gracefully
    const text = await readStreamToString(stream);

    // Partial content may have been delivered before the error
    expect(text).toBe('partial');

    // No credits charged on error — AIService.stream() catch block
    // does not call logAIUsage for zero-credit entry
    expect(mockDeductCredits).not.toHaveBeenCalled();
  }, 10_000);

  it('handles empty stream (budget exhausted)', async () => {
    mockCheckBudget.mockResolvedValue({
      ...HEALTHY_BUDGET,
      exhausted: true,
      creditsRemaining: 0,
    });

    const chunks: AIStreamChunk[] = [];
    const service = initServiceWithChunks(chunks);

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test',
      },
      service,
    );

    const text = await readStreamToString(stream);
    expect(text).toBe('');

    // No metering when budget is exhausted
    expect(mockLogAIUsage).not.toHaveBeenCalled();
    expect(mockDeductCredits).not.toHaveBeenCalled();
  }, 10_000);

  it('skips empty delta strings', async () => {
    setupHealthyMocks();
    const chunks: AIStreamChunk[] = [
      { delta: 'Hello', done: false },
      { delta: '', done: false }, // empty delta — skipped
      { delta: ' world', done: false },
      { delta: '', done: true, usage: DEFAULT_USAGE },
    ];

    const service = initServiceWithChunks(chunks);

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test',
      },
      service,
    );

    const text = await readStreamToString(stream);
    expect(text).toBe('Hello world');
  }, 10_000);

  it('produces UTF-8 encoded Uint8Array chunks', async () => {
    setupHealthyMocks();
    const chunks: AIStreamChunk[] = [
      { delta: 'café', done: false },
      { delta: '', done: true, usage: DEFAULT_USAGE },
    ];

    const service = initServiceWithChunks(chunks);

    const stream = createAIStream(
      {
        tenantId: TENANT_ID,
        userId: USER_ID,
        feature: 'command_bar',
        prompt: 'test',
      },
      service,
    );

    const reader = stream.getReader();
    const { value } = await reader.read();

    // Value should be a Uint8Array
    expect(value).toBeInstanceOf(Uint8Array);

    // Decode back to verify UTF-8
    const decoder = new TextDecoder();
    expect(decoder.decode(value)).toBe('café');

    // Drain the rest
    await reader.read(); // done=true chunk (empty delta)
    await reader.read(); // stream end
  }, 10_000);
});
