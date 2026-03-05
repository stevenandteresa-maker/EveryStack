import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted by vitest before imports
// ---------------------------------------------------------------------------

const mockInsertValues = vi.fn();
const mockInsert = vi.fn();

mockInsertValues.mockReturnValue(Promise.resolve());
mockInsert.mockReturnValue({ values: (...args: unknown[]) => mockInsertValues(...args) });

vi.mock('@everystack/shared/db', () => ({
  db: { insert: (table: unknown) => mockInsert(table) },
  apiRequestLog: { __table: 'api_request_log' },
  generateUUIDv7: vi.fn(() => 'test-uuid-v7'),
}));

const mockLoggerError = vi.fn();

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args: unknown[]) => mockLoggerError(...args),
    debug: vi.fn(),
  })),
}));

import { logApiRequest } from './request-logger';
import type { ApiRequestLogEntry } from './request-logger';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createEntry(overrides?: Partial<ApiRequestLogEntry>): ApiRequestLogEntry {
  return {
    tenantId: 'tenant-001',
    apiKeyId: 'key-001',
    method: 'GET',
    path: '/api/v1/records',
    statusCode: 200,
    durationMs: 42,
    requestSize: null,
    responseSize: 256,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logApiRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts a row into api_request_log with correct values', async () => {
    const entry = createEntry({
      tenantId: 'tenant-xyz',
      apiKeyId: 'key-abc',
      method: 'POST',
      path: '/api/v1/records',
      statusCode: 201,
      durationMs: 100,
      requestSize: 512,
      responseSize: 1024,
    });

    await logApiRequest(entry);

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsertValues).toHaveBeenCalledTimes(1);

    const calls = mockInsertValues.mock.calls as unknown[][];
    const insertedValues = calls[0]![0] as Record<string, unknown>;
    expect(insertedValues).toMatchObject({
      id: 'test-uuid-v7',
      tenantId: 'tenant-xyz',
      apiKeyId: 'key-abc',
      method: 'POST',
      path: '/api/v1/records',
      statusCode: 201,
      durationMs: 100,
      requestSize: 512,
      responseSize: 1024,
    });
    expect(insertedValues.createdAt).toBeInstanceOf(Date);
  });

  it('handles null requestSize and responseSize', async () => {
    const entry = createEntry({ requestSize: null, responseSize: null });

    await logApiRequest(entry);

    const calls = mockInsertValues.mock.calls as unknown[][];
    const insertedValues = calls[0]![0] as Record<string, unknown>;
    expect(insertedValues.requestSize).toBeNull();
    expect(insertedValues.responseSize).toBeNull();
  });

  it('does not throw on insert failure', async () => {
    mockInsertValues.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(logApiRequest(createEntry())).resolves.toBeUndefined();
  });

  it('logs error to Pino on insert failure', async () => {
    const dbError = new Error('DB connection lost');
    mockInsertValues.mockRejectedValueOnce(dbError);

    await logApiRequest(createEntry({
      tenantId: 'tenant-err',
      apiKeyId: 'key-err',
    }));

    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: dbError,
        tenantId: 'tenant-err',
        apiKeyId: 'key-err',
      }),
      'Failed to insert API request log',
    );
  });

  it('returns void (undefined) on success', async () => {
    const result = await logApiRequest(createEntry());
    expect(result).toBeUndefined();
  });
});
