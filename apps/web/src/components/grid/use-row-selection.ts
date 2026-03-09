'use client';

/**
 * Row selection hook — manages multi-row selection state
 * with header checkbox, individual checkboxes, Shift+Click range,
 * and Cmd/Ctrl+Click toggle.
 *
 * @see docs/reference/tables-and-views.md § Selection & Bulk Actions
 */

import { useCallback, useRef } from 'react';
import type { GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface UseRowSelectionOptions {
  records: GridRecord[];
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseRowSelectionReturn {
  /** Toggle header checkbox — selects all or deselects all */
  toggleSelectAll: () => void;
  /** Whether all visible rows are selected */
  allSelected: boolean;
  /** Whether some (but not all) visible rows are selected */
  someSelected: boolean;
  /** Handle individual row checkbox click with shift/meta modifier support */
  handleRowSelect: (recordId: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  /** Clear all selected rows */
  clearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRowSelection({
  records,
  selectedRows,
  setSelectedRows,
}: UseRowSelectionOptions): UseRowSelectionReturn {
  const lastSelectedRef = useRef<string | null>(null);

  const allSelected = records.length > 0 && records.every((r) => selectedRows.has(r.id));
  const someSelected = records.some((r) => selectedRows.has(r.id)) && !allSelected;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(records.map((r) => r.id)));
    }
  }, [allSelected, records, setSelectedRows]);

  const handleRowSelect = useCallback(
    (
      recordId: string,
      event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
    ) => {
      const isMeta = event.metaKey || event.ctrlKey;

      if (event.shiftKey && lastSelectedRef.current) {
        // Shift+Click: range select from last-selected to clicked
        const lastIdx = records.findIndex((r) => r.id === lastSelectedRef.current);
        const currentIdx = records.findIndex((r) => r.id === recordId);
        if (lastIdx !== -1 && currentIdx !== -1) {
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          const rangeIds = records.slice(start, end + 1).map((r) => r.id);
          const next = new Set(selectedRows);
          for (const id of rangeIds) {
            next.add(id);
          }
          setSelectedRows(next);
        }
      } else if (isMeta) {
        // Cmd/Ctrl+Click: toggle individual row
        const next = new Set(selectedRows);
        if (next.has(recordId)) {
          next.delete(recordId);
        } else {
          next.add(recordId);
        }
        setSelectedRows(next);
        lastSelectedRef.current = recordId;
      } else {
        // Plain click: select only this row
        setSelectedRows(new Set([recordId]));
        lastSelectedRef.current = recordId;
      }
    },
    [records, selectedRows, setSelectedRows],
  );

  const clearSelection = useCallback(() => {
    setSelectedRows(new Set());
    lastSelectedRef.current = null;
  }, [setSelectedRows]);

  return {
    toggleSelectAll,
    allSelected,
    someSelected,
    handleRowSelect,
    clearSelection,
  };
}
