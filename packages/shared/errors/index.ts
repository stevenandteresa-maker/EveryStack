// ---------------------------------------------------------------------------
// Shared typed error classes for all EveryStack services.
// Matches the AppError interface defined in CLAUDE.md § Error Handling.
// ---------------------------------------------------------------------------

import { getTraceId } from '../logging/trace-context';

// ---------------------------------------------------------------------------
// Error codes — machine-readable identifiers
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

/**
 * Base application error. All EveryStack errors extend this class.
 *
 * - `code`       — machine-readable error code (e.g. 'VALIDATION_FAILED')
 * - `statusCode` — HTTP status code for API responses
 * - `details`    — optional structured context (field IDs, limits, etc.)
 * - `traceId`    — auto-populated from AsyncLocalStorage trace context
 */
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;
  readonly traceId: string;

  constructor(
    code: string,
    statusCode: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.traceId = getTraceId();
  }
}

// ---------------------------------------------------------------------------
// Concrete error classes
// ---------------------------------------------------------------------------

/** Zod failures, bad input, invalid parameters. */
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ERROR_CODES.VALIDATION_FAILED, 422, message, details);
    this.name = 'ValidationError';
  }
}

/** Entity not found. Also used for cross-tenant access to prevent enumeration. */
export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: Record<string, unknown>) {
    super(ERROR_CODES.NOT_FOUND, 404, message, details);
    this.name = 'NotFoundError';
  }
}

/** Insufficient permission. Base class for permission-related errors. */
export class ForbiddenError extends AppError {
  constructor(message = "You don't have permission to do that.", details?: Record<string, unknown>) {
    super(ERROR_CODES.PERMISSION_DENIED, 403, message, details);
    this.name = 'ForbiddenError';
  }
}

/** Concurrent modification / optimistic lock failure. */
export class ConflictError extends AppError {
  constructor(message = 'This was modified by someone else. Please refresh.', details?: Record<string, unknown>) {
    super(ERROR_CODES.CONFLICT, 409, message, details);
    this.name = 'ConflictError';
  }
}

/** Rate limit exceeded. */
export class RateLimitedError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment.', details?: Record<string, unknown>) {
    super(ERROR_CODES.RATE_LIMITED, 429, message, details);
    this.name = 'RateLimitedError';
  }
}

/** Unexpected server error. Wraps unknown errors with a generic message. */
export class InternalError extends AppError {
  /** The original error, if one was provided. Kept for server-side logging only. */
  readonly cause?: unknown;

  constructor(message = 'Something went wrong. Please try again.', cause?: unknown) {
    super(ERROR_CODES.INTERNAL_ERROR, 500, message);
    this.name = 'InternalError';
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Returns the HTTP status code for an AppError instance. */
export function getHttpStatus(error: AppError): number {
  return error.statusCode;
}

/**
 * Error response shape for API surfaces.
 * Matches the `{ error: AppError }` format defined in CLAUDE.md.
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    traceId?: string;
  };
}

/**
 * Formats an error into the standard API response shape.
 *
 * - `traceId` is included only for 500 (INTERNAL_ERROR) responses.
 * - For non-AppError inputs, wraps in InternalError with a generic message.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  const appError = error instanceof AppError
    ? error
    : new InternalError('Something went wrong. Please try again.', error);

  const response: ErrorResponse = {
    error: {
      code: appError.code,
      message: appError.message,
    },
  };

  if (appError.details) {
    response.error.details = appError.details;
  }

  // Include traceId only for 500 errors (for support debugging)
  if (appError.statusCode === 500) {
    response.error.traceId = appError.traceId;
  }

  return response;
}

/**
 * Wraps an unknown error in InternalError if it isn't already an AppError.
 * Useful for catch blocks that need to normalize errors.
 */
export function wrapUnknownError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new InternalError('Something went wrong. Please try again.', error);
}
