import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so they're available in vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockPublish,
  mockCreateEventPublisher,
  mockInvalidatePermissionCache,
  mockCreateRedisClient,
} = vi.hoisted(() => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  return {
    mockPublish,
    mockCreateEventPublisher: vi.fn(() => ({ publish: mockPublish })),
    mockInvalidatePermissionCache: vi.fn().mockResolvedValue(undefined),
    mockCreateRedisClient: vi.fn(() => 'mock-redis-client'),
  };
});

vi.mock('@everystack/shared/realtime', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    createEventPublisher: mockCreateEventPublisher,
  };
});

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: mockCreateRedisClient,
}));

vi.mock('@/data/permissions', () => ({
  invalidatePermissionCache: mockInvalidatePermissionCache,
}));

// Import AFTER mocks are set up
const { publishPermissionUpdate, setRedisClient } = await import('../permission-events');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('publishPermissionUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRedisClient(null);
  });

  afterEach(() => {
    setRedisClient(null);
  });

  it('calls invalidatePermissionCache before publishing event', async () => {
    const callOrder: string[] = [];
    mockInvalidatePermissionCache.mockImplementation(async () => {
      callOrder.push('invalidate');
    });
    mockPublish.mockImplementation(async () => {
      callOrder.push('publish');
    });

    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1');

    expect(callOrder).toEqual(['invalidate', 'publish']);
  });

  it('passes correct tenantId and viewId to invalidatePermissionCache', async () => {
    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1');

    expect(mockInvalidatePermissionCache).toHaveBeenCalledWith('tenant-1', 'view-1');
  });

  it('publishes event with correct payload shape', async () => {
    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1');

    expect(mockPublish).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      channel: 'table:table-1',
      event: REALTIME_EVENTS.PERMISSION_UPDATED,
      payload: {
        type: REALTIME_EVENTS.PERMISSION_UPDATED,
        tenantId: 'tenant-1',
        viewId: 'view-1',
        tableId: 'table-1',
      },
    });
  });

  it('includes affectedUserIds in payload when provided', async () => {
    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1', ['user-a', 'user-b']);

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          affectedUserIds: ['user-a', 'user-b'],
        }),
      }),
    );
  });

  it('omits affectedUserIds from payload when not provided', async () => {
    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1');

    const publishCall = mockPublish.mock.calls[0]![0] as Record<string, unknown>;
    expect(publishCall.payload).not.toHaveProperty('affectedUserIds');
  });

  it('creates Redis client lazily on first call', async () => {
    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1');

    expect(mockCreateRedisClient).toHaveBeenCalledWith('web:permission-events');
    expect(mockCreateEventPublisher).toHaveBeenCalledWith('mock-redis-client');
  });

  it('reuses Redis client on subsequent calls', async () => {
    await publishPermissionUpdate('tenant-1', 'view-1', 'table-1');
    await publishPermissionUpdate('tenant-2', 'view-2', 'table-2');

    expect(mockCreateRedisClient).toHaveBeenCalledTimes(1);
  });
});
