'use client';

/**
 * Sort state hook for the grid view.
 *
 * Manages multi-level sorting (up to 3 levels) and persists
 * sort configuration to views.config.sorts via updateViewConfig().
 *
 * @see docs/reference/tables-and-views.md § Sorting
 */

import { useCallback, useEffect, useRef } from 'react';
import type { SortLevel } from '@/lib/types/grid';

/** Maximum sort levels for MVP (soft limit). */
export const MAX_SORT_LEVELS = 3;

export interface SortStoreSlice {
  sorts: SortLevel[];
  setSorts: (sorts: SortLevel[]) => void;
}

export interface UseSortOptions {
  /** Current sorts from store (for reading in render). */
  sorts: SortLevel[];
  /** Setter to update sorts in the store. */
  setSorts: (sorts: SortLevel[]) => void;
  /** Getter for latest sorts (avoids stale closures). */
  getSorts: () => SortLevel[];
  viewId: string;
  initialSorts?: SortLevel[];
  onPersist: (viewId: string, sorts: SortLevel[]) => void;
}

export interface UseSortReturn {
  sorts: SortLevel[];
  addSort: (fieldId: string, direction: 'asc' | 'desc') => void;
  removeSort: (fieldId: string) => void;
  toggleSort: (fieldId: string) => void;
  reorderSorts: (fromIndex: number, toIndex: number) => void;
  clearSorts: () => void;
  updateSortDirection: (fieldId: string, direction: 'asc' | 'desc') => void;
  updateSortField: (index: number, fieldId: string) => void;
  getSortForField: (fieldId: string) => SortLevel | undefined;
  getSortIndex: (fieldId: string) => number;
  isSortActive: boolean;
  isAtLimit: boolean;
}

export function useSort({
  sorts,
  setSorts,
  getSorts,
  viewId,
  initialSorts,
  onPersist,
}: UseSortOptions): UseSortReturn {
  const initialized = useRef(false);

  // Initialize sorts from view config on mount
  useEffect(() => {
    if (!initialized.current && initialSorts) {
      setSorts(initialSorts);
      initialized.current = true;
    }
  }, [initialSorts, setSorts]);

  const persistAndSet = useCallback(
    (newSorts: SortLevel[]) => {
      setSorts(newSorts);
      onPersist(viewId, newSorts);
    },
    [setSorts, viewId, onPersist],
  );

  const addSort = useCallback(
    (fieldId: string, direction: 'asc' | 'desc') => {
      const current = getSorts();
      if (current.some((s) => s.fieldId === fieldId)) return;
      persistAndSet([...current, { fieldId, direction }]);
    },
    [getSorts, persistAndSet],
  );

  const removeSort = useCallback(
    (fieldId: string) => {
      persistAndSet(getSorts().filter((s) => s.fieldId !== fieldId));
    },
    [getSorts, persistAndSet],
  );

  const toggleSort = useCallback(
    (fieldId: string) => {
      const current = getSorts();
      const existing = current.find((s) => s.fieldId === fieldId);

      if (!existing) {
        persistAndSet([...current, { fieldId, direction: 'asc' as const }]);
      } else if (existing.direction === 'asc') {
        persistAndSet(
          current.map((s) =>
            s.fieldId === fieldId ? { ...s, direction: 'desc' as const } : s,
          ),
        );
      } else {
        persistAndSet(current.filter((s) => s.fieldId !== fieldId));
      }
    },
    [getSorts, persistAndSet],
  );

  const reorderSorts = useCallback(
    (fromIndex: number, toIndex: number) => {
      const current = [...getSorts()];
      if (
        fromIndex < 0 ||
        fromIndex >= current.length ||
        toIndex < 0 ||
        toIndex >= current.length
      ) {
        return;
      }
      const removed = current.splice(fromIndex, 1);
      const moved = removed[0];
      if (!moved) return;
      current.splice(toIndex, 0, moved);
      persistAndSet(current);
    },
    [getSorts, persistAndSet],
  );

  const clearSorts = useCallback(() => {
    persistAndSet([]);
  }, [persistAndSet]);

  const updateSortDirection = useCallback(
    (fieldId: string, direction: 'asc' | 'desc') => {
      persistAndSet(
        getSorts().map((s) =>
          s.fieldId === fieldId ? { ...s, direction } : s,
        ),
      );
    },
    [getSorts, persistAndSet],
  );

  const updateSortField = useCallback(
    (index: number, fieldId: string) => {
      const current = [...getSorts()];
      const existing = current[index];
      if (!existing) return;
      const existingIdx = current.findIndex((s) => s.fieldId === fieldId);
      if (existingIdx !== -1 && existingIdx !== index) return;
      current[index] = { fieldId, direction: existing.direction };
      persistAndSet(current);
    },
    [getSorts, persistAndSet],
  );

  const getSortForField = useCallback(
    (fieldId: string) => sorts.find((s) => s.fieldId === fieldId),
    [sorts],
  );

  const getSortIndex = useCallback(
    (fieldId: string) => sorts.findIndex((s) => s.fieldId === fieldId),
    [sorts],
  );

  return {
    sorts,
    addSort,
    removeSort,
    toggleSort,
    reorderSorts,
    clearSorts,
    updateSortDirection,
    updateSortField,
    getSortForField,
    getSortIndex,
    isSortActive: sorts.length > 0,
    isAtLimit: sorts.length >= MAX_SORT_LEVELS,
  };
}
