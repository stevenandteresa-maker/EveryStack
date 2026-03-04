import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { AnthropicAdapter } from '../anthropic';
import {
  AIProviderAuthError,
  AIProviderRateLimitError,
  AIProviderError,
} from '../errors';
import type { CompiledAIRequest, ToolDefinition } from '../../types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'sk-ant-test-key-12345';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function makeRequest(
  overrides: Partial<CompiledAIRequest> = {},
): CompiledAIRequest {
  return {
    systemInstruction: 'You are a helpful assistant.',
    messages: [{ role: 'user', content: 'Hello' }],
    modelConfig: {
      modelId: 'claude-sonnet-4-5-20250929',
      providerId: 'anthropic',
    },
    maxTokens: 1024,
    temperature: 0.7,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Standard Anthropic API response shape
// ---------------------------------------------------------------------------

function makeAnthropicResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_test_001',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: 'Hello! How can I help?' }],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 25,
      output_tokens: 10,
      cache_read_input_tokens: 5,
    },
    ...overrides,
  };
}

function makeToolUseResponse() {
  return {
    id: 'msg_test_002',
    type: 'message',
    role: 'assistant',
    content: [
      { type: 'text', text: 'Let me search for that.' },
      {
        type: 'tool_use',
        id: 'toolu_001',
        name: 'search_records',
        input: { query: 'test', limit: 10 },
      },
    ],
    model: 'claude-sonnet-4-5-20250929',
    stop_reason: 'tool_use',
    usage: {
      input_tokens: 50,
      output_tokens: 30,
    },
  };
}

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const handlers = [
  http.post(ANTHROPIC_API, () => {
    return HttpResponse.json(makeAnthropicResponse());
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — constructor', () => {
  it('throws AIProviderAuthError if no API key', () => {
    const originalEnv = process.env['ANTHROPIC_API_KEY'];
    delete process.env['ANTHROPIC_API_KEY'];

    expect(() => new AnthropicAdapter()).toThrow(AIProviderAuthError);
    expect(() => new AnthropicAdapter()).toThrow(
      'ANTHROPIC_API_KEY is required but not set',
    );

    if (originalEnv) process.env['ANTHROPIC_API_KEY'] = originalEnv;
  });

  it('accepts an explicit API key', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    expect(adapter.providerId).toBe('anthropic');
  });

  it('reads API key from environment', () => {
    process.env['ANTHROPIC_API_KEY'] = TEST_API_KEY;
    const adapter = new AnthropicAdapter();
    expect(adapter.providerId).toBe('anthropic');
    delete process.env['ANTHROPIC_API_KEY'];
  });
});

// ---------------------------------------------------------------------------
// complete()
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — complete()', () => {
  it('returns normalized AIResponse from mocked response', async () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const response = await adapter.complete(makeRequest());

    expect(response.content).toBe('Hello! How can I help?');
    expect(response.finishReason).toBe('stop');
    expect(response.providerRequestId).toBe('msg_test_001');
    expect(response.usage).toEqual({
      input_tokens: 25,
      output_tokens: 10,
      cached_input_tokens: 5,
    });
  });

  it('maps max_tokens stop reason', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          makeAnthropicResponse({ stop_reason: 'max_tokens' }),
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const response = await adapter.complete(makeRequest());
    expect(response.finishReason).toBe('max_tokens');
  });

  it('maps tool_use stop reason', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          makeAnthropicResponse({ stop_reason: 'tool_use' }),
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const response = await adapter.complete(makeRequest());
    expect(response.finishReason).toBe('tool_use');
  });

  it('sends system instruction with cache_control', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      http.post(ANTHROPIC_API, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeAnthropicResponse());
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    await adapter.complete(makeRequest());

    expect(capturedBody).toBeDefined();
    const system = capturedBody!['system'] as Array<Record<string, unknown>>;
    expect(system).toHaveLength(1);
    expect(system[0]).toMatchObject({
      type: 'text',
      text: 'You are a helpful assistant.',
      cache_control: { type: 'ephemeral' },
    });
  });

  it('defaults cached_input_tokens to 0 when not present', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          makeAnthropicResponse({
            usage: { input_tokens: 20, output_tokens: 10 },
          }),
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const response = await adapter.complete(makeRequest());
    expect(response.usage.cached_input_tokens).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// streamComplete()
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — streamComplete()', () => {
  it('yields chunks and includes usage on final chunk', async () => {
    // The Anthropic SDK handles SSE internally — we mock the underlying HTTP
    // to return a streaming response that the SDK can parse
    server.use(
      http.post(ANTHROPIC_API, () => {
        const encoder = new TextEncoder();
        const events = [
          'event: message_start\ndata: {"type":"message_start","message":{"id":"msg_stream_001","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250929","stop_reason":null,"usage":{"input_tokens":25,"output_tokens":0}}}\n\n',
          'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}\n\n',
          'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}\n\n',
          'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n',
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":5}}\n\n',
          'event: message_stop\ndata: {"type":"message_stop"}\n\n',
        ];

        const stream = new ReadableStream({
          start(controller) {
            for (const event of events) {
              controller.enqueue(encoder.encode(event));
            }
            controller.close();
          },
        });

        return new HttpResponse(stream, {
          headers: {
            'content-type': 'text/event-stream',
          },
        });
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const chunks: Array<{ delta: string; done: boolean; usage?: unknown }> = [];

    for await (const chunk of adapter.streamComplete(makeRequest())) {
      chunks.push(chunk);
    }

    // Should have text chunks + final done chunk
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    // Non-final chunks have content
    const textChunks = chunks.filter((c) => !c.done);
    expect(textChunks.length).toBeGreaterThan(0);
    for (const chunk of textChunks) {
      expect(typeof chunk.delta).toBe('string');
    }

    // Final chunk has done=true and usage
    const finalChunk = chunks[chunks.length - 1];
    expect(finalChunk!.done).toBe(true);
    expect(finalChunk!.usage).toBeDefined();
    expect(finalChunk!.usage).toHaveProperty('input_tokens');
    expect(finalChunk!.usage).toHaveProperty('output_tokens');
  });
});

// ---------------------------------------------------------------------------
// completeWithTools()
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — completeWithTools()', () => {
  it('parses tool calls from mocked response', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(makeToolUseResponse());
      }),
    );

    const mockHandler = vi.fn().mockResolvedValue({
      success: true,
      data: [{ id: 'rec_001', name: 'Test' }],
    });

    const tools: ToolDefinition[] = [
      {
        name: 'search_records',
        description: 'Search records in a table',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            limit: { type: 'number' },
          },
          required: ['query'],
        },
        handler: mockHandler,
        requiredPermissions: ['read'],
      },
    ];

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const response = await adapter.completeWithTools(makeRequest(), tools);

    expect(response.content).toBe('Let me search for that.');
    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0]).toMatchObject({
      name: 'search_records',
      params: { query: 'test', limit: 10 },
      result: {
        success: true,
        data: [{ id: 'rec_001', name: 'Test' }],
      },
    });
    expect(mockHandler).toHaveBeenCalledWith({ query: 'test', limit: 10 });
    expect(response.usage.input_tokens).toBe(50);
    expect(response.usage.output_tokens).toBe(30);
  });

  it('handles unknown tool gracefully', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(makeToolUseResponse());
      }),
    );

    // Provide no tools — the model's tool call will be unrecognized
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const response = await adapter.completeWithTools(makeRequest(), []);

    expect(response.toolCalls).toHaveLength(1);
    expect(response.toolCalls[0]!.result).toMatchObject({
      success: false,
      error: 'Unknown tool: search_records',
    });
  });

  it('sends tools in Anthropic native format', async () => {
    let capturedBody: Record<string, unknown> | undefined;

    server.use(
      http.post(ANTHROPIC_API, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeToolUseResponse());
      }),
    );

    const tools: ToolDefinition[] = [
      {
        name: 'create_record',
        description: 'Create a new record',
        parameters: {
          type: 'object',
          properties: { name: { type: 'string' } },
        },
        handler: vi.fn().mockResolvedValue({ success: true }),
        requiredPermissions: ['write'],
      },
    ];

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    await adapter.completeWithTools(makeRequest(), tools);

    expect(capturedBody).toBeDefined();
    const sentTools = capturedBody!['tools'] as Array<Record<string, unknown>>;
    expect(sentTools).toHaveLength(1);
    expect(sentTools[0]).toMatchObject({
      name: 'create_record',
      description: 'Create a new record',
      input_schema: {
        type: 'object',
        properties: { name: { type: 'string' } },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// supportedCapabilities()
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — supportedCapabilities()', () => {
  it('returns correct capability flags', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const caps = adapter.supportedCapabilities();

    expect(caps).toEqual({
      maxContextTokens: 200_000,
      supportsStreaming: true,
      supportsToolUse: true,
      supportsPromptCaching: true,
      supportsBatchAPI: true,
      supportsStructuredOutput: true,
      supportsVision: true,
    });
  });
});

// ---------------------------------------------------------------------------
// calculateCost()
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — calculateCost()', () => {
  it('computes cost for Haiku model', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const cost = adapter.calculateCostForModel(
      { input_tokens: 1_000_000, output_tokens: 1_000_000, cached_input_tokens: 0 },
      'claude-haiku-4-5-20251001',
    );

    // Haiku: $1/MTok input + $5/MTok output = $6 total
    expect(cost.cost_usd).toBeCloseTo(6.0, 6);
    expect(cost.credits_charged).toBe(600);
  });

  it('computes cost for Sonnet model', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const cost = adapter.calculateCostForModel(
      { input_tokens: 1_000_000, output_tokens: 1_000_000, cached_input_tokens: 0 },
      'claude-sonnet-4-5-20250929',
    );

    // Sonnet: $3/MTok input + $15/MTok output = $18 total
    expect(cost.cost_usd).toBeCloseTo(18.0, 6);
    expect(cost.credits_charged).toBe(1800);
  });

  it('computes cost for Opus model', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const cost = adapter.calculateCostForModel(
      { input_tokens: 1_000_000, output_tokens: 1_000_000, cached_input_tokens: 0 },
      'claude-opus-4-6',
    );

    // Opus: $5/MTok input + $25/MTok output = $30 total
    expect(cost.cost_usd).toBeCloseTo(30.0, 6);
    expect(cost.credits_charged).toBe(3000);
  });

  it('applies 90% discount to cached input tokens', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const cost = adapter.calculateCostForModel(
      {
        input_tokens: 1_000_000,
        output_tokens: 0,
        cached_input_tokens: 500_000,
      },
      'claude-sonnet-4-5-20250929',
    );

    // 500K non-cached at $3/MTok = $1.50
    // 500K cached at $3 * 0.1 / MTok = $0.15
    // Total = $1.65
    expect(cost.cost_usd).toBeCloseTo(1.65, 6);
    expect(cost.credits_charged).toBe(165);
  });

  it('uses default rates for unknown model', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const cost = adapter.calculateCostForModel(
      { input_tokens: 1_000_000, output_tokens: 1_000_000, cached_input_tokens: 0 },
      'unknown-model-id',
    );

    // Default = Sonnet pricing: $3 + $15 = $18
    expect(cost.cost_usd).toBeCloseTo(18.0, 6);
  });

  it('credits_charged rounds up via Math.ceil', () => {
    const adapter = new AnthropicAdapter(TEST_API_KEY);
    const cost = adapter.calculateCostForModel(
      { input_tokens: 100, output_tokens: 100, cached_input_tokens: 0 },
      'claude-haiku-4-5-20251001',
    );

    // Very small cost: 100 * $1/1M + 100 * $5/1M = 0.0001 + 0.0005 = $0.0006
    expect(cost.cost_usd).toBeCloseTo(0.0006, 8);
    // Math.ceil(0.06) = 1
    expect(cost.credits_charged).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

describe('AnthropicAdapter — error mapping', () => {
  it('maps 401 to AIProviderAuthError', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          {
            type: 'error',
            error: { type: 'authentication_error', message: 'Invalid API key' },
          },
          { status: 401 },
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    await expect(adapter.complete(makeRequest())).rejects.toThrow(
      AIProviderAuthError,
    );
  });

  it('maps 403 to AIProviderAuthError', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          {
            type: 'error',
            error: { type: 'permission_error', message: 'Forbidden' },
          },
          { status: 403 },
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    await expect(adapter.complete(makeRequest())).rejects.toThrow(
      AIProviderAuthError,
    );
  });

  it('maps 429 to AIProviderRateLimitError', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          {
            type: 'error',
            error: { type: 'rate_limit_error', message: 'Rate limited' },
          },
          {
            status: 429,
            headers: { 'retry-after': '30' },
          },
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    try {
      await adapter.complete(makeRequest());
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderRateLimitError);
      // retryAfter may or may not be parsed depending on SDK header forwarding
      expect((error as AIProviderRateLimitError).statusCode).toBe(429);
    }
  });

  it('maps 500 to AIProviderError', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          {
            type: 'error',
            error: { type: 'api_error', message: 'Internal server error' },
          },
          { status: 500 },
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    await expect(adapter.complete(makeRequest())).rejects.toThrow(
      AIProviderError,
    );
  });

  it('maps 529 (overloaded) to AIProviderError', async () => {
    server.use(
      http.post(ANTHROPIC_API, () => {
        return HttpResponse.json(
          {
            type: 'error',
            error: { type: 'overloaded_error', message: 'Overloaded' },
          },
          { status: 529 },
        );
      }),
    );

    const adapter = new AnthropicAdapter(TEST_API_KEY);
    await expect(adapter.complete(makeRequest())).rejects.toThrow(
      AIProviderError,
    );
  });
});
