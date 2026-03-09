'use client';

/**
 * TanStack Query hook for loading grid data.
 *
 * Fetches records, fields, and view config for a given table + view.
 * Used by the DataGrid component.
 *
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 2
 */

import { useQuery } from '@tanstack/react-query';
import type { GridField, GridRecord, ViewConfig } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Server action wrappers (called via fetch from client)
// ---------------------------------------------------------------------------

async function fetchGridData(
  tableId: string,
  viewId: string | null,
): Promise<{
  records: GridRecord[];
  fields: GridField[];
  viewConfig: ViewConfig;
  totalCount: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams({ tableId });
  if (viewId) params.set('viewId', viewId);

  const res = await fetch(`/api/grid-data?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch grid data: ${res.status}`);
  }
  return res.json() as Promise<{
    records: GridRecord[];
    fields: GridField[];
    viewConfig: ViewConfig;
    totalCount: number;
    hasMore: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseGridDataResult {
  records: GridRecord[];
  fields: GridField[];
  viewConfig: ViewConfig;
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function useGridData(
  tableId: string,
  viewId: string | null,
): UseGridDataResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['grid-data', tableId, viewId],
    queryFn: () => fetchGridData(tableId, viewId),
    enabled: !!tableId,
  });

  return {
    records: data?.records ?? [],
    fields: data?.fields ?? [],
    viewConfig: data?.viewConfig ?? {},
    totalCount: data?.totalCount ?? 0,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error: error as Error | null,
  };
}
