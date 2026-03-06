import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetJob } = vi.hoisted(() => ({
  mockGetJob: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({ getJob: mockGetJob })),
}));

import { getOutboundSyncStatus } from '../records';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-1';
const RECORD_ID = 'a1234567-89ab-4def-8123-456789abcde0';
const FIELD_ID = 'b1234567-89ab-4def-8123-456789abcde1';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getOutboundSyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns synced when no job exists', async () => {
    mockGetJob.mockResolvedValue(null);

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('synced');
    expect(mockGetJob).toHaveBeenCalledWith(`outbound:${TENANT_ID}:${RECORD_ID}`);
  });

  it('returns pending when job is waiting', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('pending');
  });

  it('returns pending when job is delayed', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('delayed'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('pending');
  });

  it('returns pending when job is active', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('active'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('pending');
  });

  it('returns pending when job is waiting-children', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting-children'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('pending');
  });

  it('returns failed when job has failed', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('failed'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('failed');
  });

  it('returns synced when job is completed', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('completed'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('synced');
  });

  it('returns synced for unknown job states', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('unknown'),
    });

    const status = await getOutboundSyncStatus(TENANT_ID, RECORD_ID, FIELD_ID);
    expect(status).toBe('synced');
  });
});
