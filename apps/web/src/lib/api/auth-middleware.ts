/**
 * Platform API Authentication Middleware
 *
 * Authenticates API requests using Bearer token API keys (esk_live_ / esk_test_).
 * Provides scope checking and a higher-order function for wrapping route handlers.
 *
 * @see docs/reference/platform-api.md § Authentication
 * @see docs/reference/platform-api.md § Audit Integration
 */

import { randomBytes } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  hashApiKey,
  API_KEY_PREFIXES,
  db,
  eq,
  apiKeys,
} from '@everystack/shared/db';
import { AppError, toErrorResponse } from '@/lib/errors';
import { getApiKeyByHash } from '@/data/api-keys';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'api-auth' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApiRequestContext {
  tenantId: string;
  apiKeyId: string;
  apiKeyScopes: string[];
  rateLimitTier: string;
  actorLabel: string | null;
  requestId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PREFIXES = [API_KEY_PREFIXES.live, API_KEY_PREFIXES.test] as const;
const MAX_ACTOR_LABEL_LENGTH = 255;

// ---------------------------------------------------------------------------
// authenticateApiKey
// ---------------------------------------------------------------------------

/**
 * Authenticate an API request by extracting and validating the Bearer token.
 *
 * Flow: extract key -> validate prefix -> hash -> lookup -> validate status/expiry ->
 * fire-and-forget last_used_at update -> build context.
 *
 * @throws AppError with code UNAUTHORIZED (401), KEY_REVOKED (401), or KEY_EXPIRED (401)
 */
export async function authenticateApiKey(
  request: NextRequest,
): Promise<ApiRequestContext> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError(
      'UNAUTHORIZED',
      401,
      'Missing or invalid Authorization header',
    );
  }

  const fullKey = authHeader.slice(7);

  const hasValidPrefix = VALID_PREFIXES.some((prefix) =>
    fullKey.startsWith(prefix),
  );
  if (!hasValidPrefix) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid API key format');
  }

  const keyHash = hashApiKey(fullKey);
  const keyRecord = await getApiKeyByHash(keyHash);

  if (!keyRecord) {
    throw new AppError('UNAUTHORIZED', 401, 'Invalid API key');
  }

  if (keyRecord.status !== 'active') {
    throw new AppError('KEY_REVOKED', 401, 'API key has been revoked');
  }

  if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
    throw new AppError('KEY_EXPIRED', 401, 'API key has expired');
  }

  // Fire-and-forget: update last_used_at — failure must not block the request
  void (async () => {
    try {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, keyRecord.id));
    } catch (err: unknown) {
      logger.warn(
        { err, apiKeyId: keyRecord.id },
        'Failed to update last_used_at',
      );
    }
  })();

  const rawActorLabel = request.headers.get('x-actor-label');
  const actorLabel = rawActorLabel
    ? rawActorLabel.slice(0, MAX_ACTOR_LABEL_LENGTH)
    : null;

  const requestId = `req_${randomBytes(4).toString('hex')}`;

  return {
    tenantId: keyRecord.tenantId,
    apiKeyId: keyRecord.id,
    apiKeyScopes: keyRecord.scopes,
    rateLimitTier: keyRecord.rateLimitTier,
    actorLabel,
    requestId,
  };
}

// ---------------------------------------------------------------------------
// requireScope
// ---------------------------------------------------------------------------

/**
 * Verify the API key has at least one of the required scopes.
 * The 'admin' scope grants access to all operations.
 *
 * @throws AppError with code INSUFFICIENT_SCOPE (403)
 */
export function requireScope(
  context: ApiRequestContext,
  ...requiredScopes: string[]
): void {
  if (context.apiKeyScopes.includes('admin')) {
    return;
  }

  const hasScope = requiredScopes.some((scope) =>
    context.apiKeyScopes.includes(scope),
  );

  if (!hasScope) {
    throw new AppError(
      'INSUFFICIENT_SCOPE',
      403,
      'Insufficient scope for this operation',
      { required: requiredScopes, available: context.apiKeyScopes },
    );
  }
}

// ---------------------------------------------------------------------------
// withApiAuth — higher-order function for Next.js Route Handlers
// ---------------------------------------------------------------------------

type ApiRouteHandler = (
  request: NextRequest,
  context: ApiRequestContext,
) => Promise<NextResponse>;

/**
 * Wrap a Next.js Route Handler with API key authentication and scope checking.
 * Catches auth errors and returns them as JSON responses.
 */
export function withApiAuth(
  handler: ApiRouteHandler,
  ...requiredScopes: string[]
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const apiContext = await authenticateApiKey(request);

      if (requiredScopes.length > 0) {
        requireScope(apiContext, ...requiredScopes);
      }

      return await handler(request, apiContext);
    } catch (error: unknown) {
      if (error instanceof AppError) {
        return NextResponse.json(toErrorResponse(error), {
          status: error.statusCode,
        });
      }

      return NextResponse.json(toErrorResponse(error), { status: 500 });
    }
  };
}
