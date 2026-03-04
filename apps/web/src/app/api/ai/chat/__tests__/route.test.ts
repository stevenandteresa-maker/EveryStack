import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockAuthCtx, mockGetAuthContext, mockAIServiceInstance, mockCreateAIStream } = vi.hoisted(() => {
  const mockAuthCtx = {
    userId: '00000000-0000-7000-8000-000000000001',
    tenantId: '00000000-0000-7000-8000-000000000002',
    clerkUserId: 'user_test123',
  };

  const mockGetAuthContext = vi.fn().mockResolvedValue(mockAuthCtx);

  const mockAIServiceInstance = {
    execute: vi.fn(),
    stream: vi.fn(),
  };

  const mockCreateAIStream = vi.fn();

  return { mockAuthCtx, mockGetAuthContext, mockAIServiceInstance, mockCreateAIStream };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: (...args: unknown[]) => mockGetAuthContext(...args),
}));

vi.mock('@everystack/shared/ai', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    AIService: {
      getInstance: vi.fn(() => mockAIServiceInstance),
      initialize: vi.fn(),
      resetInstance: vi.fn(),
    },
    createAIStream: (...args: unknown[]) => mockCreateAIStream(...args),
  };
});

vi.mock('@everystack/shared/logging', () => {
  const noopLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
  return {
    createLogger: vi.fn(() => noopLogger),
    createChildLogger: vi.fn(() => noopLogger),
    webLogger: noopLogger,
    workerLogger: noopLogger,
    realtimeLogger: noopLogger,
    getTraceId: vi.fn(() => 'test-trace-id'),
    getTenantIdFromTrace: vi.fn(),
    runWithTraceContext: vi.fn(),
    generateTraceId: vi.fn(() => 'test-trace-id'),
  };
});

import { POST } from '../route';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createMockStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

async function readResponse(response: Response): Promise<string> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let result = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  result += decoder.decode();
  return result;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthContext.mockResolvedValue(mockAuthCtx);
});

describe('POST /api/ai/chat', () => {
  describe('Authentication', () => {
    it('returns 401 for unauthenticated requests', async () => {
      mockGetAuthContext.mockRejectedValue(new Error('Not authenticated'));

      const response = await POST(makeRequest({
        feature: 'command_bar',
        prompt: 'test prompt',
      }));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Validation', () => {
    it('returns 422 for missing feature', async () => {
      const response = await POST(makeRequest({
        prompt: 'test prompt',
      }));

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 422 for invalid feature value', async () => {
      const response = await POST(makeRequest({
        feature: 'not_a_real_feature',
        prompt: 'test prompt',
      }));

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 422 for empty prompt', async () => {
      const response = await POST(makeRequest({
        feature: 'command_bar',
        prompt: '',
      }));

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 422 for missing prompt', async () => {
      const response = await POST(makeRequest({
        feature: 'command_bar',
      }));

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe('VALIDATION_FAILED');
    });

    it('returns 422 for invalid JSON body', async () => {
      const response = await POST(new Request('http://localhost/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }));

      expect(response.status).toBe(422);
    });
  });

  describe('Streaming Response', () => {
    it('returns streaming response for valid request', async () => {
      const mockStream = createMockStream('Hello from AI');
      mockCreateAIStream.mockReturnValue(mockStream);

      const response = await POST(makeRequest({
        feature: 'command_bar',
        prompt: 'Find all active records',
      }));

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/plain; charset=utf-8');
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate');

      const text = await readResponse(response);
      expect(text).toBe('Hello from AI');
    });

    it('calls createAIStream with correct parameters', async () => {
      const mockStream = createMockStream('response');
      mockCreateAIStream.mockReturnValue(mockStream);

      await POST(makeRequest({
        feature: 'record_summary',
        prompt: 'Summarize this record',
        context: {
          tableSchemas: [{ id: 'table-1' }],
        },
      }));

      expect(mockCreateAIStream).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: mockAuthCtx.tenantId,
          userId: mockAuthCtx.userId,
          feature: 'record_summary',
          prompt: 'Summarize this record',
          context: {
            tableSchemas: [{ id: 'table-1' }],
          },
        }),
        mockAIServiceInstance,
      );
    });

    it('accepts all valid AIFeature values', async () => {
      const mockStream = createMockStream('ok');
      mockCreateAIStream.mockReturnValue(mockStream);

      const validFeatures = [
        'command_bar',
        'email_draft',
        'automation_build',
        'doc_assist',
        'record_summary',
        'thread_summary',
      ];

      for (const feature of validFeatures) {
        const response = await POST(makeRequest({
          feature,
          prompt: 'test',
        }));

        expect(response.status).toBe(200);
      }
    });

    it('accepts request with context including conversation history', async () => {
      const mockStream = createMockStream('reply');
      mockCreateAIStream.mockReturnValue(mockStream);

      const response = await POST(makeRequest({
        feature: 'command_bar',
        prompt: 'Follow up question',
        context: {
          conversationHistory: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi' },
          ],
        },
      }));

      expect(response.status).toBe(200);
    });

    it('accepts request without optional context', async () => {
      const mockStream = createMockStream('no context');
      mockCreateAIStream.mockReturnValue(mockStream);

      const response = await POST(makeRequest({
        feature: 'command_bar',
        prompt: 'Simple query',
      }));

      expect(response.status).toBe(200);
    });
  });

  describe('AIService Unavailable', () => {
    it('returns 500 when AIService is not initialized', async () => {
      // Import the actual module to override getInstance
      const aiModule = await import('@everystack/shared/ai');
      vi.mocked(aiModule.AIService.getInstance).mockImplementation(() => {
        throw new Error('AIService not initialized');
      });

      const response = await POST(makeRequest({
        feature: 'command_bar',
        prompt: 'test',
      }));

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe('INTERNAL_ERROR');
    });
  });
});
