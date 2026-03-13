/**
 * Permission real-time event payload types.
 *
 * These events flow through Redis pub/sub → Socket.io → client query invalidation.
 * Server Actions publish after modifying field permissions; clients consume
 * to invalidate TanStack Query caches and re-fetch fresh permissions.
 *
 * @see docs/reference/permissions.md § Permission Caching Strategy
 */

import type { REALTIME_EVENTS } from './events';

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

/**
 * Emitted after field permissions are modified for a Table View.
 * Cache invalidation MUST complete before this event is published.
 *
 * - affectedUserIds undefined = all users on this view should re-fetch.
 * - affectedUserIds array = only these users need to re-fetch.
 */
export interface PermissionUpdatedPayload {
  type: typeof REALTIME_EVENTS.PERMISSION_UPDATED;
  tenantId: string;
  viewId: string;
  tableId: string;
  affectedUserIds?: string[];
}
