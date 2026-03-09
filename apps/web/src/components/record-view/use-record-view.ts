'use client';

/**
 * useRecordView — manages Record View overlay state.
 *
 * Tracks open/closed state, current record ID, config ID,
 * and navigation between records in the current view.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordViewState {
  /** Whether the Record View overlay is open */
  isOpen: boolean;
  /** The ID of the record currently displayed */
  currentRecordId: string | null;
  /** The ID of the Record View config being used */
  currentConfigId: string | null;
}

export interface UseRecordViewResult extends RecordViewState {
  /** Open the Record View for a specific record */
  openRecordView: (recordId: string, configId?: string) => void;
  /** Close the Record View overlay */
  closeRecordView: () => void;
  /** Navigate to the previous or next record in the list */
  navigateRecord: (direction: 'prev' | 'next') => void;
  /** Update the current record without closing (e.g. clicking another row) */
  setCurrentRecordId: (recordId: string) => void;
  /** Update the config being used */
  setCurrentConfigId: (configId: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * @param recordIds — ordered list of record IDs in the current view,
 *                    used for prev/next navigation.
 */
export function useRecordView(recordIds: string[]): UseRecordViewResult {
  const [isOpen, setIsOpen] = useState(false);
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [currentConfigId, setCurrentConfigId] = useState<string | null>(null);

  const openRecordView = useCallback(
    (recordId: string, configId?: string) => {
      setCurrentRecordId(recordId);
      if (configId) {
        setCurrentConfigId(configId);
      }
      setIsOpen(true);
    },
    [],
  );

  const closeRecordView = useCallback(() => {
    setIsOpen(false);
    setCurrentRecordId(null);
  }, []);

  const navigateRecord = useCallback(
    (direction: 'prev' | 'next') => {
      if (!currentRecordId || recordIds.length === 0) return;

      const currentIndex = recordIds.indexOf(currentRecordId);
      if (currentIndex === -1) return;

      const nextIndex =
        direction === 'next'
          ? Math.min(currentIndex + 1, recordIds.length - 1)
          : Math.max(currentIndex - 1, 0);

      if (nextIndex !== currentIndex) {
        setCurrentRecordId(recordIds[nextIndex]!);
      }
    },
    [currentRecordId, recordIds],
  );

  return {
    isOpen,
    currentRecordId,
    currentConfigId,
    openRecordView,
    closeRecordView,
    navigateRecord,
    setCurrentRecordId,
    setCurrentConfigId,
  };
}
