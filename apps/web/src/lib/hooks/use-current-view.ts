'use client';

/**
 * Manages the active view ID in URL search params and applies view config
 * to the grid store.
 *
 * @see docs/reference/tables-and-views.md § My Views & Shared Views
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { View } from '@everystack/shared/db';
import type { ViewsByTable } from '@/data/views';

const VIEW_PARAM = 'viewId';

/**
 * Extracts the view config fields used by the grid store.
 */
export function extractViewConfig(view: View, overrides?: Record<string, unknown>) {
  const base = view.config as Record<string, unknown>;
  const merged = overrides ? { ...base, ...overrides } : base;

  return {
    sorts: (merged.sorts as { fieldId: string; direction: 'asc' | 'desc' }[]) ?? [],
    filters: merged.filters ?? null,
    groups: (merged.groups as { fieldId: string; direction: 'asc' | 'desc' }[]) ?? [],
    columns: merged.columns ?? null,
    columnOrder: (merged.columnOrder as string[]) ?? null,
    columnColors: (merged.columnColors as Record<string, string>) ?? null,
    hiddenFields: (merged.hidden_fields as string[]) ?? null,
    frozenColumns: (merged.frozenColumns as number) ?? null,
    density: (merged.density as string) ?? null,
    locked: (merged.locked as boolean) ?? false,
  };
}

export interface UseCurrentViewOptions {
  viewsByTable: ViewsByTable | null;
  defaultView: View | null;
  userOverrides?: Record<string, unknown> | null;
}

export interface UseCurrentViewReturn {
  /** The currently active view (resolved via URL param or default) */
  currentView: View | null;
  /** Switch to a different view by ID */
  switchView: (viewId: string) => void;
  /** Whether the current view is a shared view with user overrides */
  hasUserOverrides: boolean;
  /** The extracted and merged config for the current view */
  viewConfig: ReturnType<typeof extractViewConfig> | null;
}

export function useCurrentView({
  viewsByTable,
  defaultView,
  userOverrides,
}: UseCurrentViewOptions): UseCurrentViewReturn {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const viewIdParam = searchParams.get(VIEW_PARAM);

  // Resolve the current view
  const currentView = useMemo(() => {
    if (!viewsByTable) return defaultView;

    const allViews = [...viewsByTable.sharedViews, ...viewsByTable.myViews];

    if (viewIdParam) {
      const found = allViews.find((v) => v.id === viewIdParam);
      if (found) return found;
    }

    // Fallback to default
    return defaultView;
  }, [viewsByTable, viewIdParam, defaultView]);

  const hasUserOverrides = Boolean(
    userOverrides && currentView?.isShared && Object.keys(userOverrides).length > 0,
  );

  const viewConfig = useMemo(() => {
    if (!currentView) return null;
    return extractViewConfig(
      currentView,
      hasUserOverrides ? (userOverrides ?? undefined) : undefined,
    );
  }, [currentView, hasUserOverrides, userOverrides]);

  const switchView = useCallback(
    (viewId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(VIEW_PARAM, viewId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  return {
    currentView,
    switchView,
    hasUserOverrides,
    viewConfig,
  };
}
