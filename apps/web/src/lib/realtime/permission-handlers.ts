'use client';

/**
 * Client-side handler for permission.updated real-time events.
 *
 * When the server modifies field permissions and publishes a permission.updated
 * event, this handler invalidates the relevant TanStack Query cache so the
 * client re-fetches fresh permission data.
 *
 * @see docs/reference/permissions.md § Permission Caching Strategy
 */

import type { QueryClient } from '@tanstack/react-query';
import type { PermissionUpdatedPayload } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Query key constant — matches the key used by permission data hooks
// ---------------------------------------------------------------------------

export const PERMISSION_QUERY_KEY_PREFIX = 'field-permissions' as const;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle a permission.updated event from Socket.io.
 *
 * - If affectedUserIds is undefined, ALL users on this view should re-fetch.
 * - If affectedUserIds is an array, only re-fetch if currentUserId is in the list.
 *
 * Triggers TanStack Query invalidation so permission data is re-fetched.
 * The server-side Redis cache is already busted before this event arrives.
 */
export function handlePermissionUpdated(
  payload: PermissionUpdatedPayload,
  currentUserId: string,
  queryClient: QueryClient,
): void {
  // Skip if this user is not affected
  if (
    payload.affectedUserIds !== undefined &&
    !payload.affectedUserIds.includes(currentUserId)
  ) {
    return;
  }

  // Invalidate all permission queries for this view
  void queryClient.invalidateQueries({
    queryKey: [PERMISSION_QUERY_KEY_PREFIX, payload.viewId],
  });
}
