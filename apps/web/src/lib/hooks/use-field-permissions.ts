'use client';

/**
 * TanStack Query hook for loading resolved field permissions.
 *
 * Fetches the FieldPermissionMap for the current user + view via
 * GET /api/field-permissions. Uses the same query key prefix as
 * the real-time invalidation handler so permission.updated events
 * automatically trigger re-fetch.
 *
 * @see docs/reference/permissions.md § Field-Level Permissions
 * @see apps/web/src/lib/realtime/permission-handlers.ts
 */

import { useQuery } from '@tanstack/react-query';
import type { FieldPermissionMap, FieldPermissionState } from '@everystack/shared/auth';
import { PERMISSION_QUERY_KEY_PREFIX } from '@/lib/realtime/permission-handlers';

// ---------------------------------------------------------------------------
// Fetch function
// ---------------------------------------------------------------------------

async function fetchFieldPermissions(
  viewId: string,
): Promise<FieldPermissionMap> {
  const params = new URLSearchParams({ viewId });
  const res = await fetch(`/api/field-permissions?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Failed to fetch field permissions: ${res.status}`);
  }

  const json = (await res.json()) as {
    data: Array<[string, FieldPermissionState]>;
  };

  return new Map(json.data);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseFieldPermissionsResult {
  permissionMap: FieldPermissionMap;
  isLoading: boolean;
}

/**
 * Load field permissions for a view.
 *
 * Query key uses PERMISSION_QUERY_KEY_PREFIX so that handlePermissionUpdated()
 * invalidation matches this query automatically.
 *
 * - staleTime: 30s (permissions rarely change during active editing)
 * - gcTime: 5 min (matches Redis cache TTL)
 */
export function useFieldPermissions(viewId: string): UseFieldPermissionsResult {
  const { data, isLoading } = useQuery({
    queryKey: [PERMISSION_QUERY_KEY_PREFIX, viewId],
    queryFn: () => fetchFieldPermissions(viewId),
    enabled: !!viewId,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  return {
    permissionMap: data ?? new Map(),
    isLoading,
  };
}
