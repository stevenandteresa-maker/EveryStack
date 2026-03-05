/**
 * Composed Platform API Middleware
 *
 * withPlatformApi() is the single entry point for all Platform API route
 * handlers. It composes:
 *   1. API key authentication + scope checking
 *   2. Per-key rate limiting + per-tenant ceiling
 *   3. X-API-Version header
 *   4. Rate limit headers
 *   5. Handler invocation
 *   6. Fire-and-forget request logging
 *   7. Unhandled error → 500 INTERNAL_ERROR with Sentry capture
 *
 * @see docs/reference/platform-api.md
 */

import type { NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiKey,
  requireScope,
} from './auth-middleware';
import type { ApiRequestContext } from './auth-middleware';
import {
  checkRateLimit,
  checkTenantCeiling,
  setRateLimitHeaders,
} from './rate-limiter';
import {
  apiError,
  apiInternalError,
  apiRateLimited,
  apiUnauthorized,
  apiForbidden,
  API_VERSION,
  API_VERSION_HEADER,
} from './errors';
import type { ApiErrorBody } from './errors';
import { logApiRequest } from './request-logger';
import { AppError } from '@/lib/errors';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'platform-api' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlatformApiHandler = (
  request: NextRequest,
  context: ApiRequestContext,
) => Promise<NextResponse>;

// ---------------------------------------------------------------------------
// withPlatformApi
// ---------------------------------------------------------------------------

/**
 * Wrap a Next.js Route Handler with the full Platform API middleware stack.
 *
 * @param handler — The route handler receiving (request, context).
 * @param requiredScopes — One or more scopes; the key must hold at least one.
 *                         Pass nothing for public-within-API endpoints (e.g., health).
 */
export function withPlatformApi(
  handler: PlatformApiHandler,
  ...requiredScopes: string[]
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    let context: ApiRequestContext | undefined;

    try {
      // 1. Authenticate API key
      context = await authenticateApiKey(request);

      // 2. Check required scopes
      if (requiredScopes.length > 0) {
        requireScope(context, ...requiredScopes);
      }

      // 3. Per-key rate limit
      const keyResult = await checkRateLimit(
        context.apiKeyId,
        context.rateLimitTier,
      );

      if (!keyResult.allowed) {
        const response = apiRateLimited(keyResult.retryAfter ?? 1);
        setRateLimitHeaders(response, keyResult);
        fireAndForgetLog(context, request, response, startTime);
        return response;
      }

      // 4. Per-tenant ceiling
      const tenantResult = await checkTenantCeiling(
        context.tenantId,
        context.rateLimitTier,
      );

      if (!tenantResult.allowed) {
        const response = apiRateLimited(tenantResult.retryAfter ?? 1);
        setRateLimitHeaders(response, tenantResult);
        fireAndForgetLog(context, request, response, startTime);
        return response;
      }

      // 5. Call the handler
      const response = await handler(request, context);

      // 6. Set X-API-Version + rate limit headers on the response
      response.headers.set(API_VERSION_HEADER, API_VERSION);
      setRateLimitHeaders(response, keyResult);

      // 7. Fire-and-forget request log
      fireAndForgetLog(context, request, response, startTime);

      return response;
    } catch (error: unknown) {
      // Map auth/scope AppError codes to proper API error responses
      if (error instanceof AppError) {
        const response = mapAppErrorToApiResponse(error);
        if (context) {
          setRateLimitHeaders(response, {
            allowed: true,
            limit: 0,
            remaining: 0,
            resetAt: 0,
          });
          fireAndForgetLog(context, request, response, startTime);
        }
        return response;
      }

      // Unhandled error → 500 with Sentry capture
      const requestId = context?.requestId ?? 'unknown';
      logger.error(
        { err: error, requestId, tenantId: context?.tenantId },
        'Unhandled error in Platform API handler',
      );

      // Sentry capture (placeholder — wired when observability ships)
      // Sentry.captureException(error, { extra: { requestId } });

      const response = apiInternalError(requestId);
      if (context) {
        fireAndForgetLog(context, request, response, startTime);
      }
      return response;
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map an AppError thrown by auth or scope middleware into the Platform API
 * error response format with correct HTTP status and error code.
 */
function mapAppErrorToApiResponse(
  error: AppError,
): NextResponse<ApiErrorBody> {
  switch (error.code) {
    case 'UNAUTHORIZED':
    case 'KEY_REVOKED':
    case 'KEY_EXPIRED':
      return apiUnauthorized(error.code, error.message);
    case 'INSUFFICIENT_SCOPE':
      return apiForbidden(error.code, error.message);
    default:
      return apiError(
        error.statusCode,
        error.code,
        error.message,
      );
  }
}

/**
 * Fire-and-forget: log the API request. Never awaited — failures are
 * swallowed by logApiRequest() internally.
 */
function fireAndForgetLog(
  context: ApiRequestContext,
  request: NextRequest,
  response: NextResponse,
  startTime: number,
): void {
  const contentLength = request.headers.get('content-length');
  const responseBody = response.headers.get('content-length');

  void logApiRequest({
    tenantId: context.tenantId,
    apiKeyId: context.apiKeyId,
    method: request.method,
    path: new URL(request.url).pathname,
    statusCode: response.status,
    durationMs: Date.now() - startTime,
    requestSize: contentLength ? Number(contentLength) : null,
    responseSize: responseBody ? Number(responseBody) : null,
  });
}
