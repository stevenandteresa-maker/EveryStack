/**
 * Platform API Error Response Utilities
 *
 * Standard error response helpers for the Platform API surface.
 * All error responses follow the shape:
 *   { error: { code, message, details?, request_id? } }
 *
 * Every response includes the X-API-Version header.
 *
 * @see docs/reference/platform-api.md § Error Format
 */

import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Date-based API version stamped on every Platform API response.
 * Bump when a new backwards-compatible release ships.
 */
export const API_VERSION = '2026-03-01';

export const API_VERSION_HEADER = 'X-API-Version';

// ---------------------------------------------------------------------------
// Error response shape
// ---------------------------------------------------------------------------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown[];
    request_id?: string;
  };
}

// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------

/**
 * Build a Platform API error response with the correct status, body shape,
 * and X-API-Version header.
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown[],
  requestId?: string,
): NextResponse<ApiErrorBody> {
  const body: ApiErrorBody = {
    error: {
      code,
      message,
    },
  };

  if (details !== undefined && details.length > 0) {
    body.error.details = details;
  }

  if (requestId !== undefined) {
    body.error.request_id = requestId;
  }

  return NextResponse.json(body, {
    status,
    headers: { [API_VERSION_HEADER]: API_VERSION },
  });
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/** 400 Bad Request */
export function apiBadRequest(
  code: string,
  message: string,
  details?: unknown[],
): NextResponse<ApiErrorBody> {
  return apiError(400, code, message, details);
}

/** 401 Unauthorized */
export function apiUnauthorized(
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return apiError(401, code, message);
}

/** 403 Forbidden */
export function apiForbidden(
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return apiError(403, code, message);
}

/** 404 Not Found */
export function apiNotFound(
  message = 'Resource not found',
): NextResponse<ApiErrorBody> {
  return apiError(404, 'NOT_FOUND', message);
}

/** 409 Conflict */
export function apiConflict(
  message = 'Resource was modified by another request',
): NextResponse<ApiErrorBody> {
  return apiError(409, 'CONFLICT', message);
}

/** 400 Validation Error with details array */
export function apiValidationError(
  details: unknown[],
): NextResponse<ApiErrorBody> {
  return apiError(400, 'VALIDATION_ERROR', 'Invalid field values', details);
}

/** 413 Payload Too Large */
export function apiPayloadTooLarge(): NextResponse<ApiErrorBody> {
  return apiError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds size limit');
}

/** 429 Rate Limited — includes Retry-After header */
export function apiRateLimited(
  retryAfter: number,
): NextResponse<ApiErrorBody> {
  const response = apiError(
    429,
    'RATE_LIMITED',
    'Rate limit exceeded. Retry after the specified period.',
  );
  response.headers.set('Retry-After', String(retryAfter));
  return response;
}

/** 500 Internal Error — includes request_id for support debugging */
export function apiInternalError(
  requestId: string,
): NextResponse<ApiErrorBody> {
  return apiError(
    500,
    'INTERNAL_ERROR',
    'An internal error occurred. Please contact support with the request_id.',
    undefined,
    requestId,
  );
}
