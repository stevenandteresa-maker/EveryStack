'use client';

/**
 * useRecordView — manages Record View overlay state.
 *
 * Tracks open/closed state, current record ID, config ID,
 * navigation between records in the current view, and a
 * navigation stack for linked record drill-down.
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
  /** Navigation stack for linked record drill-down */
  navigationStack: string[];
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
  /** Push a linked record onto the navigation stack */
  pushLinkedRecord: (recordId: string) => void;
  /** Pop back to the previous record in the stack */
  popLinkedRecord: () => void;
  /** Whether there is a previous record in the stack to go back to */
  canGoBack: boolean;
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
  const [navigationStack, setNavigationStack] = useState<string[]>([]);

  const openRecordView = useCallback(
    (recordId: string, configId?: string) => {
      setCurrentRecordId(recordId);
      if (configId) {
        setCurrentConfigId(configId);
      }
      setNavigationStack([]);
      setIsOpen(true);
    },
    [],
  );

  const closeRecordView = useCallback(() => {
    setIsOpen(false);
    setCurrentRecordId(null);
    setNavigationStack([]);
  }, []);

  const navigateRecord = useCallback(
    (direction: 'prev' | 'next') => {
      if (recordIds.length === 0) return;

      // Find reference index: current record, or the original record from stack
      let referenceIndex = currentRecordId
        ? recordIds.indexOf(currentRecordId)
        : -1;

      // If current record isn't in the list (e.g. we're in a linked record),
      // use the bottom of the navigation stack as reference
      if (referenceIndex === -1 && navigationStack.length > 0) {
        referenceIndex = recordIds.indexOf(navigationStack[0]!);
      }

      if (referenceIndex === -1) return;

      const nextIndex =
        direction === 'next'
          ? Math.min(referenceIndex + 1, recordIds.length - 1)
          : Math.max(referenceIndex - 1, 0);

      if (nextIndex !== referenceIndex) {
        setCurrentRecordId(recordIds[nextIndex]!);
        setNavigationStack([]);
      }
    },
    [currentRecordId, recordIds, navigationStack],
  );

  const pushLinkedRecord = useCallback(
    (recordId: string) => {
      if (currentRecordId) {
        setNavigationStack((prev) => [...prev, currentRecordId]);
      }
      setCurrentRecordId(recordId);
    },
    [currentRecordId],
  );

  const popLinkedRecord = useCallback(() => {
    setNavigationStack((prev) => {
      if (prev.length === 0) return prev;
      const newStack = [...prev];
      const previousRecordId = newStack.pop()!;
      setCurrentRecordId(previousRecordId);
      return newStack;
    });
  }, []);

  const canGoBack = navigationStack.length > 0;

  return {
    isOpen,
    currentRecordId,
    currentConfigId,
    navigationStack,
    openRecordView,
    closeRecordView,
    navigateRecord,
    setCurrentRecordId,
    setCurrentConfigId,
    pushLinkedRecord,
    popLinkedRecord,
    canGoBack,
  };
}
