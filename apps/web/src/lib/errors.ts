// ---------------------------------------------------------------------------
// Re-export shared error classes for use within the web app.
// The canonical definitions live in @everystack/shared/errors.
// ---------------------------------------------------------------------------

export {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  RateLimitedError,
  InternalError,
  getHttpStatus,
  toErrorResponse,
  wrapUnknownError,
} from '@everystack/shared/errors';

export type { ErrorResponse, ErrorCode } from '@everystack/shared/errors';
