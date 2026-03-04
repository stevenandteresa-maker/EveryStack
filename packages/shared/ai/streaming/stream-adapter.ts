/**
 * Stream Adapter — bridges AIService.stream() AsyncIterable to a ReadableStream
 * compatible with Vercel AI SDK's text stream format.
 *
 * The adapter:
 * - Calls AIService.stream() which routes to the provider adapter's streamComplete()
 * - Wraps the AsyncIterable<AIStreamChunk> into a ReadableStream<Uint8Array>
 * - Metering is handled by AIService.stream() on the final chunk (Steps 5–6)
 * - Error mid-stream: closes the stream gracefully, AIService logs with status: 'error'
 *
 * The ReadableStream produces UTF-8 encoded text deltas, compatible with
 * Vercel AI SDK's useChat/useCompletion hooks on the client (Phase 5).
 */

import type { AIService, AIServiceRequest } from '../service';
import type { AIStreamChunk } from '../types';
import { createLogger } from '../../logging/logger';
import { getTraceId } from '../../logging/trace-context';

const logger = createLogger({ service: 'ai-stream-adapter' });

/**
 * Result metadata available after the stream completes.
 * Populated from the final AIStreamChunk's usage field.
 */
export interface StreamResult {
  /** Whether the stream completed successfully */
  success: boolean;
  /** Total input tokens (from final chunk) */
  inputTokens: number;
  /** Total output tokens (from final chunk) */
  outputTokens: number;
  /** Cached input tokens (from final chunk) */
  cachedInputTokens: number;
}

/**
 * Create a ReadableStream from an AIService streaming request.
 *
 * Consumes the AsyncIterable<AIStreamChunk> from AIService.stream(),
 * encoding each text delta as UTF-8 and enqueuing it to the ReadableStream.
 *
 * Metering (cost calculation, usage logging, credit deduction) fires
 * automatically within AIService.stream() when the final chunk arrives.
 * The adapter does not duplicate metering logic.
 *
 * @param request - The AI service request (tenantId, userId, feature, prompt, etc.)
 * @param aiService - The AIService singleton instance
 * @returns A ReadableStream<Uint8Array> suitable for streaming HTTP responses
 */
export function createAIStream(
  request: AIServiceRequest,
  aiService: AIService,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let iterator: AsyncIterator<AIStreamChunk> | null = null;

  return new ReadableStream<Uint8Array>({
    async start() {
      // Obtain the async iterator from AIService.stream()
      const iterable = aiService.stream(request);
      iterator = iterable[Symbol.asyncIterator]();
    },

    async pull(controller) {
      if (!iterator) {
        controller.close();
        return;
      }

      try {
        // Loop until we enqueue content or the stream ends.
        // This handles empty deltas (e.g., intermediate chunks with no text)
        // without returning to the ReadableStream with nothing enqueued.
        while (true) {
          const { value, done } = await iterator.next();

          if (done) {
            // Generator has fully completed — metering code has run
            controller.close();
            return;
          }

          const chunk = value as AIStreamChunk;

          // Enqueue text delta if non-empty
          if (chunk.delta) {
            controller.enqueue(encoder.encode(chunk.delta));
          }

          if (chunk.done) {
            // Final chunk received. Drive the generator one more time so
            // AIService.stream() can execute its post-yield metering code
            // (Steps 5–6: cost calculation, usage logging, credit deduction).
            await iterator.next();
            controller.close();
            return;
          }

          // Non-final chunk with content — break out so ReadableStream
          // can deliver the enqueued data before pulling the next chunk.
          if (chunk.delta) {
            return;
          }

          // Empty non-final delta — loop to get the next chunk immediately
        }
      } catch (error) {
        // Error mid-stream: close gracefully
        // AIService.stream() logs the error internally
        logger.error(
          {
            traceId: getTraceId(),
            tenantId: request.tenantId,
            feature: request.feature,
            error: error instanceof Error ? error.message : 'Unknown stream error',
          },
          'Stream adapter error — closing stream',
        );

        controller.close();
      }
    },

    cancel() {
      // Stream was cancelled by the consumer (e.g., client disconnected)
      logger.info(
        {
          traceId: getTraceId(),
          tenantId: request.tenantId,
          feature: request.feature,
        },
        'Stream cancelled by consumer',
      );
    },
  });
}
