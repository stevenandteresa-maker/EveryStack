// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { PermissionUpdatedPayload } from '@everystack/shared/realtime';
import type { QueryClient } from '@tanstack/react-query';
import {
  handlePermissionUpdated,
  PERMISSION_QUERY_KEY_PREFIX,
} from '../permission-handlers';

// ---------------------------------------------------------------------------
// Mock QueryClient
// ---------------------------------------------------------------------------

function createMockQueryClient(): QueryClient {
  return {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
  } as unknown as QueryClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPayload(overrides?: Partial<PermissionUpdatedPayload>): PermissionUpdatedPayload {
  return {
    type: REALTIME_EVENTS.PERMISSION_UPDATED,
    tenantId: 'tenant-1',
    viewId: 'view-1',
    tableId: 'table-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handlePermissionUpdated', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createMockQueryClient();
  });

  it('invalidates permission queries when affectedUserIds is undefined (all users)', () => {
    const payload = createPayload({ affectedUserIds: undefined });

    handlePermissionUpdated(payload, 'user-1', queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PERMISSION_QUERY_KEY_PREFIX, 'view-1'],
    });
  });

  it('invalidates permission queries when currentUserId is in affectedUserIds', () => {
    const payload = createPayload({ affectedUserIds: ['user-1', 'user-2'] });

    handlePermissionUpdated(payload, 'user-1', queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PERMISSION_QUERY_KEY_PREFIX, 'view-1'],
    });
  });

  it('skips invalidation when currentUserId is NOT in affectedUserIds', () => {
    const payload = createPayload({ affectedUserIds: ['user-2', 'user-3'] });

    handlePermissionUpdated(payload, 'user-1', queryClient);

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });

  it('uses the correct query key prefix', () => {
    expect(PERMISSION_QUERY_KEY_PREFIX).toBe('field-permissions');
  });

  it('invalidates with the viewId from the payload', () => {
    const payload = createPayload({ viewId: 'view-xyz' });

    handlePermissionUpdated(payload, 'user-1', queryClient);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [PERMISSION_QUERY_KEY_PREFIX, 'view-xyz'],
    });
  });

  it('handles empty affectedUserIds array by skipping all users', () => {
    const payload = createPayload({ affectedUserIds: [] });

    handlePermissionUpdated(payload, 'user-1', queryClient);

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});
