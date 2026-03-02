import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock getTraceId before importing error classes
const mockGetTraceId = vi.fn(() => 'trace-abc-123');

vi.mock('../logging/trace-context', () => ({
  getTraceId: () => mockGetTraceId(),
}));

import {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  RateLimitedError,
  InternalError,
  ERROR_CODES,
  getHttpStatus,
  toErrorResponse,
  wrapUnknownError,
} from './index';

beforeEach(() => {
  mockGetTraceId.mockReturnValue('trace-abc-123');
});

// ---------------------------------------------------------------------------
// AppError (base class)
// ---------------------------------------------------------------------------

describe('AppError', () => {
  it('extends Error', () => {
    const err = new AppError('TEST', 418, 'teapot');
    expect(err).toBeInstanceOf(Error);
  });

  it('sets code, statusCode, message, and name', () => {
    const err = new AppError('TEST', 418, 'teapot');
    expect(err.code).toBe('TEST');
    expect(err.statusCode).toBe(418);
    expect(err.message).toBe('teapot');
    expect(err.name).toBe('AppError');
  });

  it('auto-populates traceId from getTraceId()', () => {
    const err = new AppError('TEST', 418, 'teapot');
    expect(err.traceId).toBe('trace-abc-123');
  });

  it('captures traceId at construction time', () => {
    mockGetTraceId.mockReturnValue('trace-first');
    const err1 = new AppError('A', 400, 'first');
    mockGetTraceId.mockReturnValue('trace-second');
    const err2 = new AppError('B', 400, 'second');

    expect(err1.traceId).toBe('trace-first');
    expect(err2.traceId).toBe('trace-second');
  });

  it('accepts optional details', () => {
    const err = new AppError('TEST', 418, 'teapot', { field: 'name' });
    expect(err.details).toEqual({ field: 'name' });
  });

  it('details are undefined when not provided', () => {
    const err = new AppError('TEST', 418, 'teapot');
    expect(err.details).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Concrete error classes
// ---------------------------------------------------------------------------

describe('ValidationError', () => {
  it('extends AppError and Error', () => {
    const err = new ValidationError('Bad input');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, statusCode, and name', () => {
    const err = new ValidationError('Bad input');
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.statusCode).toBe(422);
    expect(err.name).toBe('ValidationError');
  });

  it('accepts details', () => {
    const err = new ValidationError('Bad input', { fields: ['email'] });
    expect(err.details).toEqual({ fields: ['email'] });
  });

  it('auto-populates traceId', () => {
    const err = new ValidationError('Bad input');
    expect(err.traceId).toBe('trace-abc-123');
  });
});

describe('NotFoundError', () => {
  it('extends AppError and Error', () => {
    const err = new NotFoundError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, statusCode, and name', () => {
    const err = new NotFoundError();
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('NotFoundError');
  });

  it('has default message', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Not found');
  });

  it('accepts custom message and details', () => {
    const err = new NotFoundError('Record not found', { id: 'rec-1' });
    expect(err.message).toBe('Record not found');
    expect(err.details).toEqual({ id: 'rec-1' });
  });
});

describe('ForbiddenError', () => {
  it('extends AppError and Error', () => {
    const err = new ForbiddenError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, statusCode, and name', () => {
    const err = new ForbiddenError();
    expect(err.code).toBe('PERMISSION_DENIED');
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe('ForbiddenError');
  });

  it('has default message', () => {
    const err = new ForbiddenError();
    expect(err.message).toBe("You don't have permission to do that.");
  });

  it('accepts custom message and details', () => {
    const err = new ForbiddenError('Cannot edit', { role: 'viewer' });
    expect(err.message).toBe('Cannot edit');
    expect(err.details).toEqual({ role: 'viewer' });
  });
});

describe('ConflictError', () => {
  it('extends AppError and Error', () => {
    const err = new ConflictError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, statusCode, and name', () => {
    const err = new ConflictError();
    expect(err.code).toBe('CONFLICT');
    expect(err.statusCode).toBe(409);
    expect(err.name).toBe('ConflictError');
  });

  it('has default message', () => {
    const err = new ConflictError();
    expect(err.message).toBe('This was modified by someone else. Please refresh.');
  });

  it('accepts custom message and details', () => {
    const err = new ConflictError('Version mismatch', { version: 3 });
    expect(err.message).toBe('Version mismatch');
    expect(err.details).toEqual({ version: 3 });
  });
});

describe('RateLimitedError', () => {
  it('extends AppError and Error', () => {
    const err = new RateLimitedError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, statusCode, and name', () => {
    const err = new RateLimitedError();
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.statusCode).toBe(429);
    expect(err.name).toBe('RateLimitedError');
  });

  it('has default message', () => {
    const err = new RateLimitedError();
    expect(err.message).toBe('Too many requests. Please wait a moment.');
  });

  it('accepts custom message', () => {
    const err = new RateLimitedError('API rate limit hit');
    expect(err.message).toBe('API rate limit hit');
  });
});

describe('InternalError', () => {
  it('extends AppError and Error', () => {
    const err = new InternalError();
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('has correct code, statusCode, and name', () => {
    const err = new InternalError();
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('InternalError');
  });

  it('has default message', () => {
    const err = new InternalError();
    expect(err.message).toBe('Something went wrong. Please try again.');
  });

  it('captures original cause', () => {
    const original = new TypeError('null reference');
    const err = new InternalError('Server error', original);
    expect(err.cause).toBe(original);
  });

  it('cause is undefined when not provided', () => {
    const err = new InternalError();
    expect(err.cause).toBeUndefined();
  });

  it('does not have details (hides internal info)', () => {
    const err = new InternalError();
    expect(err.details).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ERROR_CODES constant
// ---------------------------------------------------------------------------

describe('ERROR_CODES', () => {
  it('contains all 6 error codes', () => {
    expect(ERROR_CODES).toEqual({
      VALIDATION_FAILED: 'VALIDATION_FAILED',
      NOT_FOUND: 'NOT_FOUND',
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      CONFLICT: 'CONFLICT',
      RATE_LIMITED: 'RATE_LIMITED',
      INTERNAL_ERROR: 'INTERNAL_ERROR',
    });
  });
});

// ---------------------------------------------------------------------------
// getHttpStatus()
// ---------------------------------------------------------------------------

describe('getHttpStatus()', () => {
  it('returns 422 for ValidationError', () => {
    expect(getHttpStatus(new ValidationError('bad'))).toBe(422);
  });

  it('returns 404 for NotFoundError', () => {
    expect(getHttpStatus(new NotFoundError())).toBe(404);
  });

  it('returns 403 for ForbiddenError', () => {
    expect(getHttpStatus(new ForbiddenError())).toBe(403);
  });

  it('returns 409 for ConflictError', () => {
    expect(getHttpStatus(new ConflictError())).toBe(409);
  });

  it('returns 429 for RateLimitedError', () => {
    expect(getHttpStatus(new RateLimitedError())).toBe(429);
  });

  it('returns 500 for InternalError', () => {
    expect(getHttpStatus(new InternalError())).toBe(500);
  });

  it('returns custom statusCode for base AppError', () => {
    expect(getHttpStatus(new AppError('CUSTOM', 418, 'teapot'))).toBe(418);
  });
});

// ---------------------------------------------------------------------------
// toErrorResponse()
// ---------------------------------------------------------------------------

describe('toErrorResponse()', () => {
  it('formats ValidationError without traceId', () => {
    const err = new ValidationError('Bad email', { field: 'email' });
    const res = toErrorResponse(err);
    expect(res).toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Bad email',
        details: { field: 'email' },
      },
    });
    expect(res.error.traceId).toBeUndefined();
  });

  it('formats NotFoundError without traceId', () => {
    const res = toErrorResponse(new NotFoundError('Record missing'));
    expect(res.error.code).toBe('NOT_FOUND');
    expect(res.error.traceId).toBeUndefined();
  });

  it('formats ForbiddenError without traceId', () => {
    const res = toErrorResponse(new ForbiddenError());
    expect(res.error.code).toBe('PERMISSION_DENIED');
    expect(res.error.traceId).toBeUndefined();
  });

  it('formats ConflictError without traceId', () => {
    const res = toErrorResponse(new ConflictError());
    expect(res.error.code).toBe('CONFLICT');
    expect(res.error.traceId).toBeUndefined();
  });

  it('formats RateLimitedError without traceId', () => {
    const res = toErrorResponse(new RateLimitedError());
    expect(res.error.code).toBe('RATE_LIMITED');
    expect(res.error.traceId).toBeUndefined();
  });

  it('formats InternalError WITH traceId (500 only)', () => {
    const res = toErrorResponse(new InternalError());
    expect(res.error.code).toBe('INTERNAL_ERROR');
    expect(res.error.traceId).toBe('trace-abc-123');
  });

  it('wraps unknown Error in InternalError with generic message', () => {
    const raw = new TypeError('Cannot read property of null');
    const res = toErrorResponse(raw);
    expect(res.error.code).toBe('INTERNAL_ERROR');
    expect(res.error.message).toBe('Something went wrong. Please try again.');
    expect(res.error.traceId).toBe('trace-abc-123');
  });

  it('wraps string error in InternalError', () => {
    const res = toErrorResponse('unexpected string');
    expect(res.error.code).toBe('INTERNAL_ERROR');
    expect(res.error.message).toBe('Something went wrong. Please try again.');
  });

  it('wraps null error in InternalError', () => {
    const res = toErrorResponse(null);
    expect(res.error.code).toBe('INTERNAL_ERROR');
  });

  it('omits details when not present', () => {
    const res = toErrorResponse(new NotFoundError());
    expect(res.error.details).toBeUndefined();
  });

  it('includes details when present', () => {
    const err = new ValidationError('Invalid', { fields: ['name'] });
    const res = toErrorResponse(err);
    expect(res.error.details).toEqual({ fields: ['name'] });
  });
});

// ---------------------------------------------------------------------------
// wrapUnknownError()
// ---------------------------------------------------------------------------

describe('wrapUnknownError()', () => {
  it('returns AppError instances unchanged', () => {
    const err = new ValidationError('bad');
    expect(wrapUnknownError(err)).toBe(err);
  });

  it('returns ForbiddenError instances unchanged', () => {
    const err = new ForbiddenError();
    expect(wrapUnknownError(err)).toBe(err);
  });

  it('wraps plain Error in InternalError', () => {
    const raw = new Error('oops');
    const wrapped = wrapUnknownError(raw);
    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.code).toBe('INTERNAL_ERROR');
    expect(wrapped.message).toBe('Something went wrong. Please try again.');
    expect((wrapped as InternalError).cause).toBe(raw);
  });

  it('wraps string in InternalError', () => {
    const wrapped = wrapUnknownError('boom');
    expect(wrapped).toBeInstanceOf(InternalError);
    expect((wrapped as InternalError).cause).toBe('boom');
  });

  it('wraps null in InternalError', () => {
    const wrapped = wrapUnknownError(null);
    expect(wrapped).toBeInstanceOf(InternalError);
  });
});
