/**
 * AI Provider error types.
 *
 * These errors are thrown by provider adapters and caught by AIService
 * for retry logic, fallback chains, and error reporting.
 * All error types extend a base AIProviderError class.
 */

// ---------------------------------------------------------------------------
// Base class
// ---------------------------------------------------------------------------

/** Base error for all AI provider failures */
export class AIProviderError extends Error {
  readonly providerId: string;
  readonly statusCode?: number;

  constructor(
    message: string,
    providerId: string,
    statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AIProviderError';
    this.providerId = providerId;
    this.statusCode = statusCode;
  }
}

// ---------------------------------------------------------------------------
// Concrete error classes
// ---------------------------------------------------------------------------

/** Authentication or authorization failure (401/403) */
export class AIProviderAuthError extends AIProviderError {
  constructor(message: string, providerId: string, options?: ErrorOptions) {
    super(message, providerId, 401, options);
    this.name = 'AIProviderAuthError';
  }
}

/** Rate limit exceeded (429) */
export class AIProviderRateLimitError extends AIProviderError {
  /** Seconds until the rate limit resets, if provided by the API */
  readonly retryAfter?: number;

  constructor(
    message: string,
    providerId: string,
    retryAfter?: number,
    options?: ErrorOptions,
  ) {
    super(message, providerId, 429, options);
    this.name = 'AIProviderRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/** Request timed out */
export class AIProviderTimeoutError extends AIProviderError {
  constructor(message: string, providerId: string, options?: ErrorOptions) {
    super(message, providerId, 408, options);
    this.name = 'AIProviderTimeoutError';
  }
}
