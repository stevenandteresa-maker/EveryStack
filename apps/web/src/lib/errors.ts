/**
 * Base application error matching the AppError interface from CLAUDE.md.
 * Thrown by Server Actions, caught by the global error boundary.
 */
export class AppError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;
  readonly traceId?: string;

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    traceId?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.traceId = traceId;
  }
}

/**
 * Resource not found. Returns 404 — also used for cross-tenant access
 * attempts to prevent tenant enumeration.
 */
export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: Record<string, unknown>) {
    super('NOT_FOUND', message, details);
    this.name = 'NotFoundError';
  }
}
