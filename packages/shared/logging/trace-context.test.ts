import { describe, it, expect } from 'vitest';
import {
  getTraceId,
  getTenantIdFromTrace,
  runWithTraceContext,
  generateTraceId,
} from './trace-context';

describe('getTraceId', () => {
  it('returns "no-trace" outside any trace context', () => {
    expect(getTraceId()).toBe('no-trace');
  });

  it('returns the correct traceId inside runWithTraceContext', () => {
    const id = 'trace-abc-123';
    runWithTraceContext({ traceId: id }, () => {
      expect(getTraceId()).toBe(id);
    });
  });

  it('returns "no-trace" after context exits', () => {
    runWithTraceContext({ traceId: 'temp-trace' }, () => {
      // inside
    });
    expect(getTraceId()).toBe('no-trace');
  });

  it('isolates nested contexts correctly', () => {
    runWithTraceContext({ traceId: 'outer' }, () => {
      expect(getTraceId()).toBe('outer');

      runWithTraceContext({ traceId: 'inner' }, () => {
        expect(getTraceId()).toBe('inner');
      });

      expect(getTraceId()).toBe('outer');
    });
  });
});

describe('getTenantIdFromTrace', () => {
  it('returns undefined outside any trace context', () => {
    expect(getTenantIdFromTrace()).toBeUndefined();
  });

  it('returns the tenantId when set in context', () => {
    runWithTraceContext({ traceId: 'trace-1', tenantId: 'tenant-xyz' }, () => {
      expect(getTenantIdFromTrace()).toBe('tenant-xyz');
    });
  });

  it('returns undefined when tenantId is not provided', () => {
    runWithTraceContext({ traceId: 'trace-2' }, () => {
      expect(getTenantIdFromTrace()).toBeUndefined();
    });
  });
});

describe('runWithTraceContext', () => {
  it('returns the value produced by the wrapped function', () => {
    const result = runWithTraceContext({ traceId: 'trace-ret' }, () => 42);
    expect(result).toBe(42);
  });

  it('works with async functions', async () => {
    const result = await runWithTraceContext(
      { traceId: 'trace-async', tenantId: 'tenant-async' },
      async () => {
        // simulate async work
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { traceId: getTraceId(), tenantId: getTenantIdFromTrace() };
      },
    );

    expect(result.traceId).toBe('trace-async');
    expect(result.tenantId).toBe('tenant-async');
  });

  it('propagates errors from the wrapped function', () => {
    expect(() =>
      runWithTraceContext({ traceId: 'trace-err' }, () => {
        throw new Error('test error');
      }),
    ).toThrow('test error');
  });

  it('context does not leak across concurrent invocations', async () => {
    const results = await Promise.all([
      runWithTraceContext({ traceId: 'concurrent-a' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getTraceId();
      }),
      runWithTraceContext({ traceId: 'concurrent-b' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getTraceId();
      }),
    ]);

    expect(results[0]).toBe('concurrent-a');
    expect(results[1]).toBe('concurrent-b');
  });
});

describe('generateTraceId', () => {
  it('returns a valid UUID string', () => {
    const id = generateTraceId();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(id).toMatch(uuidRegex);
  });

  it('returns unique values on each call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateTraceId()));
    expect(ids.size).toBe(100);
  });
});
