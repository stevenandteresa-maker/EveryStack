import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockValues = vi.fn();
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockDb = { insert: mockInsert };

vi.mock('../../../db/client', () => ({
  getDbForTenant: vi.fn(() => mockDb),
}));

vi.mock('../../../db/uuid', () => ({
  generateUUIDv7: vi.fn(() => '01900000-0000-7000-8000-000000000001'),
}));

vi.mock('../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock('../../../logging/trace-context', () => ({
  getTraceId: vi.fn(() => 'test-trace-id'),
}));

import { logAIUsage } from '../usage-logger';
import type { UsageLogEntry } from '../usage-logger';
import { getDbForTenant } from '../../../db/client';
import { AI_FEATURES } from '../features';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<UsageLogEntry> = {}): UsageLogEntry {
  return {
    tenantId: '01900000-0000-7000-8000-aaaaaaaaaaaa',
    userId: '01900000-0000-7000-8000-bbbbbbbbbbbb',
    feature: AI_FEATURES.command_bar,
    model: 'claude-haiku-4-5-20251001',
    inputTokens: 1000,
    outputTokens: 500,
    cachedInput: 0,
    costUsd: 0.0035,
    creditsCharged: 1,
    status: 'success',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockValues.mockResolvedValue(undefined);
});

describe('logAIUsage', () => {
  it('inserts a row with correct values for a successful call', async () => {
    const entry = makeEntry();

    await logAIUsage(entry);

    expect(getDbForTenant).toHaveBeenCalledWith(entry.tenantId, 'write');
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '01900000-0000-7000-8000-000000000001',
        tenantId: entry.tenantId,
        userId: entry.userId,
        feature: 'command_bar',
        model: 'claude-haiku-4-5-20251001',
        inputTokens: 1000,
        outputTokens: 500,
        cachedInput: 0,
        costUsd: '0.0035',
        creditsCharged: '1',
        status: 'success',
        metadata: {},
      }),
    );
  });

  it('sets credits_charged to 0 for error calls', async () => {
    const entry = makeEntry({
      status: 'error',
      creditsCharged: 5,
      errorCode: 'overloaded_error',
    });

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        creditsCharged: '0',
        status: 'error',
      }),
    );
  });

  it('sets credits_charged to 0 for timeout status', async () => {
    const entry = makeEntry({
      status: 'timeout',
      creditsCharged: 3,
    });

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        creditsCharged: '0',
        status: 'timeout',
      }),
    );
  });

  it('sets credits_charged to 0 for rate_limited status', async () => {
    const entry = makeEntry({
      status: 'rate_limited',
      creditsCharged: 2,
    });

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        creditsCharged: '0',
        status: 'rate_limited',
      }),
    );
  });

  it('passes metadata through when provided', async () => {
    const metadata = { table_ids: ['t1', 't2'], record_count: 42 };
    const entry = makeEntry({ metadata });

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ metadata }),
    );
  });

  it('defaults metadata to empty object when not provided', async () => {
    const entry = makeEntry();
    delete (entry as Partial<UsageLogEntry>).metadata;

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: {} }),
    );
  });

  it('defaults cachedInput to 0 when not provided', async () => {
    const entry = makeEntry();
    delete (entry as Partial<UsageLogEntry>).cachedInput;

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ cachedInput: 0 }),
    );
  });

  it('sets durationMs to null when not provided', async () => {
    const entry = makeEntry();

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: null }),
    );
  });

  it('passes durationMs through when provided', async () => {
    const entry = makeEntry({ durationMs: 1234 });

    await logAIUsage(entry);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ durationMs: 1234 }),
    );
  });

  it('generates a UUIDv7 for the row id', async () => {
    await logAIUsage(makeEntry());

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '01900000-0000-7000-8000-000000000001',
      }),
    );
  });
});
