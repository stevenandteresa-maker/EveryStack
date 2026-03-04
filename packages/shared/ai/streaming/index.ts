/**
 * AI Streaming — public barrel export.
 *
 * Stream adapter for bridging AIService.stream() to ReadableStream (SSE),
 * and BullMQ AI job type definitions.
 */

export type { StreamResult } from './stream-adapter';
export { createAIStream } from './stream-adapter';

export type { AIJobPayload, AIJobResult } from './ai-job-types';
