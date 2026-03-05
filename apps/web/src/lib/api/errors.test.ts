import { describe, it, expect } from 'vitest';
import {
  apiError,
  createApiErrorResponse,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiConflict,
  apiValidationError,
  apiPayloadTooLarge,
  apiRateLimited,
  apiInternalError,
  API_VERSION,
  API_VERSION_HEADER,
} from './errors';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

function getVersionHeader(response: Response): string | null {
  return response.headers.get(API_VERSION_HEADER);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API Error Utilities', () => {
  describe('apiError (generic)', () => {
    it('returns the correct status code', () => {
      const res = apiError(418, 'TEAPOT', 'I am a teapot');
      expect(res.status).toBe(418);
    });

    it('returns standard error body shape', async () => {
      const res = apiError(400, 'BAD', 'Bad request');
      const body = await parseBody(res);
      expect(body).toEqual({
        error: { code: 'BAD', message: 'Bad request' },
      });
    });

    it('includes details when provided', async () => {
      const details = [{ field: 'email', code: 'REQUIRED' }];
      const res = apiError(400, 'BAD', 'Bad', details);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).details).toEqual(details);
    });

    it('omits details when empty array', async () => {
      const res = apiError(400, 'BAD', 'Bad', []);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).details).toBeUndefined();
    });

    it('includes request_id when provided', async () => {
      const res = apiError(500, 'ERR', 'Error', undefined, 'req_abc123');
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).request_id).toBe('req_abc123');
    });

    it('omits request_id when not provided', async () => {
      const res = apiError(400, 'BAD', 'Bad');
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).request_id).toBeUndefined();
    });

    it('includes X-API-Version header', () => {
      const res = apiError(400, 'BAD', 'Bad');
      expect(getVersionHeader(res)).toBe(API_VERSION);
    });
  });

  describe('apiBadRequest', () => {
    it('returns 400', () => {
      const res = apiBadRequest('INVALID_FILTER', 'Bad filter');
      expect(res.status).toBe(400);
    });

    it('returns correct error body', async () => {
      const res = apiBadRequest('INVALID_SORT', 'Bad sort');
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('INVALID_SORT');
      expect((body.error as Record<string, unknown>).message).toBe('Bad sort');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiBadRequest('X', 'x'))).toBe(API_VERSION);
    });
  });

  describe('apiUnauthorized', () => {
    it('returns 401', () => {
      const res = apiUnauthorized('UNAUTHORIZED', 'Missing key');
      expect(res.status).toBe(401);
    });

    it('returns correct error body', async () => {
      const res = apiUnauthorized('KEY_REVOKED', 'Key revoked');
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('KEY_REVOKED');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiUnauthorized('X', 'x'))).toBe(API_VERSION);
    });
  });

  describe('apiForbidden', () => {
    it('returns 403', () => {
      const res = apiForbidden('INSUFFICIENT_SCOPE', 'Need admin');
      expect(res.status).toBe(403);
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiForbidden('X', 'x'))).toBe(API_VERSION);
    });
  });

  describe('apiNotFound', () => {
    it('returns 404 with code NOT_FOUND', async () => {
      const res = apiNotFound();
      expect(res.status).toBe(404);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('NOT_FOUND');
    });

    it('uses default message when none provided', async () => {
      const res = apiNotFound();
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).message).toBe('Resource not found');
    });

    it('uses custom message when provided', async () => {
      const res = apiNotFound('Record not found');
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).message).toBe('Record not found');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiNotFound())).toBe(API_VERSION);
    });
  });

  describe('apiConflict', () => {
    it('returns 409 with code CONFLICT', async () => {
      const res = apiConflict();
      expect(res.status).toBe(409);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('CONFLICT');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiConflict())).toBe(API_VERSION);
    });
  });

  describe('apiValidationError', () => {
    it('returns 400 with code VALIDATION_ERROR', async () => {
      const details = [
        { field: 'fields.email', code: 'INVALID_FORMAT', message: 'Must be a valid email' },
      ];
      const res = apiValidationError(details);
      expect(res.status).toBe(400);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('VALIDATION_ERROR');
    });

    it('includes details array in response', async () => {
      const details = [
        { field: 'name', code: 'REQUIRED', message: 'Name is required' },
        { field: 'email', code: 'INVALID_FORMAT', message: 'Invalid email' },
      ];
      const res = apiValidationError(details);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).details).toEqual(details);
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiValidationError([]))).toBe(API_VERSION);
    });
  });

  describe('apiPayloadTooLarge', () => {
    it('returns 413 with code PAYLOAD_TOO_LARGE', async () => {
      const res = apiPayloadTooLarge();
      expect(res.status).toBe(413);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('PAYLOAD_TOO_LARGE');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiPayloadTooLarge())).toBe(API_VERSION);
    });
  });

  describe('apiRateLimited', () => {
    it('returns 429 with code RATE_LIMITED', async () => {
      const res = apiRateLimited(30);
      expect(res.status).toBe(429);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('RATE_LIMITED');
    });

    it('includes Retry-After header', () => {
      const res = apiRateLimited(45);
      expect(res.headers.get('Retry-After')).toBe('45');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiRateLimited(10))).toBe(API_VERSION);
    });
  });

  describe('apiInternalError', () => {
    it('returns 500 with code INTERNAL_ERROR', async () => {
      const res = apiInternalError('req_abc12345');
      expect(res.status).toBe(500);
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).code).toBe('INTERNAL_ERROR');
    });

    it('includes request_id in error body', async () => {
      const res = apiInternalError('req_deadbeef');
      const body = await parseBody(res);
      expect((body.error as Record<string, unknown>).request_id).toBe('req_deadbeef');
    });

    it('includes X-API-Version header', () => {
      expect(getVersionHeader(apiInternalError('req_test'))).toBe(API_VERSION);
    });
  });

  describe('createApiErrorResponse alias', () => {
    it('is the same function as apiError', () => {
      expect(createApiErrorResponse).toBe(apiError);
    });

    it('produces identical output to apiError', async () => {
      const res = createApiErrorResponse(422, 'VALIDATION_FAILED', 'Bad data');
      expect(res.status).toBe(422);
      const body = await parseBody(res);
      expect(body).toEqual({ error: { code: 'VALIDATION_FAILED', message: 'Bad data' } });
    });
  });

  describe('API_VERSION constant', () => {
    it('is the expected date-based version string', () => {
      expect(API_VERSION).toBe('2026-03-01');
    });
  });
});
