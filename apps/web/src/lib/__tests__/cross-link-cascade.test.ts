import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockGet = vi.fn();
const mockIncr = vi.fn();
const mockDecr = vi.fn();
const mockSet = vi.fn();
const mockQueueAdd = vi.fn();

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(() => ({
    get: mockGet,
    incr: mockIncr,
    decr: mockDecr,
    set: mockSet,
  })),
}));

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({
    add: mockQueueAdd.mockResolvedValue(undefined),
  })),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

// Import after mocks are set up
import {
  checkCascadeBackpressure,
  incrementCascadeDepth,
  decrementCascadeDepth,
  enqueueCascadeJob,
} from '../cross-link-cascade';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkCascadeBackpressure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when pending jobs exceed threshold (>500)', async () => {
    mockGet.mockResolvedValue('501');

    const result = await checkCascadeBackpressure('tenant-1');

    expect(result).toBe(true);
    expect(mockGet).toHaveBeenCalledWith('q:cascade:depth:tenant-1');
  });

  it('returns false when pending jobs equal threshold (500)', async () => {
    mockGet.mockResolvedValue('500');

    const result = await checkCascadeBackpressure('tenant-1');

    expect(result).toBe(false);
  });

  it('returns false when pending jobs below threshold', async () => {
    mockGet.mockResolvedValue('100');

    const result = await checkCascadeBackpressure('tenant-1');

    expect(result).toBe(false);
  });

  it('returns false when no counter exists (null)', async () => {
    mockGet.mockResolvedValue(null);

    const result = await checkCascadeBackpressure('tenant-1');

    expect(result).toBe(false);
  });
});

describe('incrementCascadeDepth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments the Redis counter for the tenant', async () => {
    mockIncr.mockResolvedValue(1);

    await incrementCascadeDepth('tenant-1');

    expect(mockIncr).toHaveBeenCalledWith('q:cascade:depth:tenant-1');
  });
});

describe('decrementCascadeDepth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('decrements the Redis counter for the tenant', async () => {
    mockDecr.mockResolvedValue(5);

    await decrementCascadeDepth('tenant-1');

    expect(mockDecr).toHaveBeenCalledWith('q:cascade:depth:tenant-1');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('clamps to zero when counter goes negative', async () => {
    mockDecr.mockResolvedValue(-1);

    await decrementCascadeDepth('tenant-1');

    expect(mockSet).toHaveBeenCalledWith('q:cascade:depth:tenant-1', '0');
  });
});

describe('enqueueCascadeJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncr.mockResolvedValue(1);
  });

  it('enqueues a cascade job and increments depth counter', async () => {
    await enqueueCascadeJob('tenant-1', 'record-1', 'high', 'user_edit');

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'cross-link.cascade',
      expect.objectContaining({
        tenantId: 'tenant-1',
        targetRecordId: 'record-1',
        priority: 'high',
        reason: 'user_edit',
      }),
      expect.objectContaining({
        jobId: 'crosslink:cascade:tenant-1:record-1',
        priority: 1,
      }),
    );

    // Should increment backpressure counter
    expect(mockIncr).toHaveBeenCalledWith('q:cascade:depth:tenant-1');
  });
});
