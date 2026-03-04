import { describe, it, expect } from 'vitest';

import {
  AIProviderError,
  AIProviderAuthError,
  AIProviderRateLimitError,
  AIProviderTimeoutError,
} from '../errors';

describe('AIProviderError', () => {
  it('stores providerId and statusCode', () => {
    const error = new AIProviderError('test error', 'anthropic', 500);
    expect(error.message).toBe('test error');
    expect(error.providerId).toBe('anthropic');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('AIProviderError');
    expect(error).toBeInstanceOf(Error);
  });

  it('allows undefined statusCode', () => {
    const error = new AIProviderError('test', 'anthropic');
    expect(error.statusCode).toBeUndefined();
  });

  it('supports cause option', () => {
    const cause = new Error('original');
    const error = new AIProviderError('wrapped', 'anthropic', 500, {
      cause,
    });
    expect(error.cause).toBe(cause);
  });
});

describe('AIProviderAuthError', () => {
  it('sets statusCode to 401', () => {
    const error = new AIProviderAuthError('unauthorized', 'anthropic');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AIProviderAuthError');
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('AIProviderRateLimitError', () => {
  it('sets statusCode to 429 and includes retryAfter', () => {
    const error = new AIProviderRateLimitError(
      'rate limited',
      'anthropic',
      30,
    );
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(30);
    expect(error.name).toBe('AIProviderRateLimitError');
    expect(error).toBeInstanceOf(AIProviderError);
  });

  it('allows undefined retryAfter', () => {
    const error = new AIProviderRateLimitError('rate limited', 'anthropic');
    expect(error.retryAfter).toBeUndefined();
  });
});

describe('AIProviderTimeoutError', () => {
  it('sets statusCode to 408', () => {
    const error = new AIProviderTimeoutError('timed out', 'anthropic');
    expect(error.statusCode).toBe(408);
    expect(error.name).toBe('AIProviderTimeoutError');
    expect(error).toBeInstanceOf(AIProviderError);
  });
});
