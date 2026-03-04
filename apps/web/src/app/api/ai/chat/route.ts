/**
 * SSE Route Handler — POST /api/ai/chat
 *
 * Foundation skeleton for AI streaming. Feature-specific logic (Command Bar AI,
 * Document AI Draft, etc.) is added in Phase 5.
 *
 * Flow:
 * 1. Authenticate via Clerk session (getAuthContext)
 * 2. Parse and validate request body (feature, prompt, context)
 * 3. Call createAIStream() with AIService singleton
 * 4. Return streaming response with appropriate SSE headers
 *
 * Heavy AI tasks (complex automations, app generation) are submitted to
 * BullMQ queues instead — see AIJobPayload type in packages/shared/ai/streaming.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import type { AIFeature } from '@everystack/shared/ai';
import { AI_FEATURES, AIService, createAIStream } from '@everystack/shared/ai';
import { webLogger } from '@everystack/shared/logging';

/**
 * Valid AI feature values for Zod validation.
 * Cast to tuple type required by z.enum().
 */
const AI_FEATURE_VALUES = Object.values(AI_FEATURES) as [string, ...string[]];

const ChatRequestSchema = z.object({
  feature: z.enum(AI_FEATURE_VALUES),
  prompt: z.string().min(1).max(10_000),
  context: z.object({
    tableSchemas: z.array(z.unknown()).optional(),
    recordSample: z.array(z.unknown()).optional(),
    conversationHistory: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })).optional(),
  }).optional(),
});

export async function POST(request: Request) {
  // Step 1 — Authenticate via Clerk
  let authCtx;
  try {
    authCtx = await getAuthContext();
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 },
    );
  }

  // Step 2 — Parse and validate request body
  const body = await request.json().catch(() => null);
  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid request body',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  const { feature, prompt, context } = parsed.data;

  webLogger.info(
    {
      tenantId: authCtx.tenantId,
      userId: authCtx.userId,
      feature,
    },
    'AI chat stream requested',
  );

  // Step 3 — Create the streaming ReadableStream
  let aiService: AIService;
  try {
    aiService = AIService.getInstance();
  } catch {
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'AI service not available' } },
      { status: 500 },
    );
  }

  const stream = createAIStream(
    {
      tenantId: authCtx.tenantId,
      userId: authCtx.userId,
      feature: feature as AIFeature,
      prompt,
      context,
    },
    aiService,
  );

  // Step 4 — Return streaming response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
