/**
 * AIJobPayload — type definition for heavy AI tasks submitted to BullMQ.
 *
 * Pattern for heavy AI tasks (complex automations, app generation):
 * 1. Feature code submits AIJobPayload to the 'automation' or dedicated AI queue
 * 2. Worker processes the job via AIService.execute() (non-streaming)
 * 3. On completion, worker publishes result via Redis pub/sub
 * 4. Socket.io server forwards the event to the originating user's room
 *
 * This is the type definition only — BullMQ AI job processor implementation
 * is built in a later phase.
 */

import type { BaseJobData } from '../../queue/types';
import type { AIFeature } from '../metering/features';
import type { AITaskType } from '../config/routing';
import type { AIServiceContext } from '../service';
import type { JSONSchema } from '../types';

/**
 * Job payload for AI tasks submitted to BullMQ queues.
 *
 * Extends BaseJobData with AI-specific fields needed by the worker
 * to reconstruct an AIServiceRequest and execute via AIService.execute().
 */
export interface AIJobPayload extends BaseJobData {
  /** The AI feature identifier for routing and metering */
  feature: AIFeature;
  /** The user prompt to process */
  prompt: string;
  /** Optional explicit task type override (inferred from feature if omitted) */
  taskType?: AITaskType;
  /** Optional context (schemas, samples, conversation history) */
  context?: AIServiceContext;
  /** Optional Zod-compatible JSON schema for structured output */
  outputSchema?: JSONSchema;
  /** Tool names from ToolRegistry to make available */
  tools?: string[];
  /** Optional callback channel for Redis pub/sub completion notification */
  callbackChannel?: string;
}

/**
 * Result shape published via Redis pub/sub when an AI job completes.
 * The Socket.io server forwards this to the user's room.
 */
export interface AIJobResult {
  /** The BullMQ job ID */
  jobId: string;
  /** Whether the AI call succeeded */
  success: boolean;
  /** AI-generated content (if successful) */
  content?: string;
  /** Structured output (if outputSchema was provided) */
  structuredOutput?: unknown;
  /** Credits charged for this job */
  creditsCharged: number;
  /** Credits remaining after this job */
  creditsRemaining: number;
  /** Error message (if failed) */
  error?: string;
}
