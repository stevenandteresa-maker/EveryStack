'use client';

/**
 * Hook for drag-to-reorder rows in the grid view.
 *
 * Allows users to reorder rows via native HTML drag-and-drop.
 * Disabled when a sort is active to prevent conflicting order states.
 *
 * @see docs/reference/tables-and-views.md § Row Behavior
 */

import { useCallback, useState } from 'react';

import type { GridRecord } from '@/lib/types/grid';

export interface UseRowReorderOptions {
  records: GridRecord[];
  isSortActive: boolean;
  onReorder: (recordId: string, fromIndex: number, toIndex: number) => void;
}

export interface UseRowReorderReturn {
  draggedRowId: string | null;
  dropTargetIndex: number | null;
  handleDragStart: (e: React.DragEvent, recordId: string, rowIndex: number) => void;
  handleDragOver: (e: React.DragEvent, rowIndex: number) => void;
  handleDragEnd: () => void;
  handleDrop: (e: React.DragEvent, rowIndex: number) => void;
  isDisabled: boolean;
}

export function useRowReorder({
  isSortActive,
  onReorder,
}: UseRowReorderOptions): UseRowReorderReturn {
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [draggedFromIndex, setDraggedFromIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const isDisabled = isSortActive;

  const handleDragStart = useCallback(
    (e: React.DragEvent, recordId: string, rowIndex: number) => {
      if (isDisabled) {
        e.preventDefault();
        return;
      }

      setDraggedRowId(recordId);
      setDraggedFromIndex(rowIndex);

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', recordId);
    },
    [isDisabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, rowIndex: number) => {
      if (isDisabled || draggedRowId === null) {
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDropTargetIndex(rowIndex);
    },
    [isDisabled, draggedRowId],
  );

  const resetState = useCallback(() => {
    setDraggedRowId(null);
    setDraggedFromIndex(null);
    setDropTargetIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, rowIndex: number) => {
      if (isDisabled || draggedRowId === null || draggedFromIndex === null) {
        resetState();
        return;
      }

      e.preventDefault();

      if (draggedFromIndex !== rowIndex) {
        onReorder(draggedRowId, draggedFromIndex, rowIndex);
      }

      resetState();
    },
    [isDisabled, draggedRowId, draggedFromIndex, onReorder, resetState],
  );

  const handleDragEnd = useCallback(() => {
    resetState();
  }, [resetState]);

  return {
    draggedRowId,
    dropTargetIndex,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
    isDisabled,
  };
}
