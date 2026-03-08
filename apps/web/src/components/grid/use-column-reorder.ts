/**
 * Column reorder hook — HTML5 Drag and Drop for column header reordering.
 *
 * Primary field cannot be reordered (always first data column).
 * Order saved to views.config.column_order via callback.
 *
 * @see docs/reference/tables-and-views.md § Column Behavior
 */

import { useCallback, useRef } from 'react';

interface UseColumnReorderOptions {
  columnOrder: string[];
  primaryFieldId: string | null;
  onReorder: (newOrder: string[]) => void;
}

export function useColumnReorder({
  columnOrder,
  primaryFieldId,
  onReorder,
}: UseColumnReorderOptions) {
  const dragFieldIdRef = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (fieldId: string, e: React.DragEvent) => {
      // Primary field cannot be reordered
      if (fieldId === primaryFieldId) {
        e.preventDefault();
        return;
      }

      dragFieldIdRef.current = fieldId;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', fieldId);

      // Reduce opacity of dragged element
      const target = e.currentTarget as HTMLElement;
      requestAnimationFrame(() => {
        target.style.opacity = '0.4';
      });
    },
    [primaryFieldId],
  );

  const handleDragOver = useCallback(
    (fieldId: string, e: React.DragEvent) => {
      e.preventDefault();
      // Primary field is not a valid drop target for reordering
      if (fieldId === primaryFieldId) return;
      e.dataTransfer.dropEffect = 'move';
    },
    [primaryFieldId],
  );

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '';
    dragFieldIdRef.current = null;
  }, []);

  const handleDrop = useCallback(
    (targetFieldId: string, e: React.DragEvent) => {
      e.preventDefault();
      const draggedFieldId = dragFieldIdRef.current;
      if (!draggedFieldId || draggedFieldId === targetFieldId) return;
      if (targetFieldId === primaryFieldId) return;

      const currentOrder = [...columnOrder];
      const fromIndex = currentOrder.indexOf(draggedFieldId);
      const toIndex = currentOrder.indexOf(targetFieldId);

      if (fromIndex === -1 || toIndex === -1) return;

      currentOrder.splice(fromIndex, 1);
      currentOrder.splice(toIndex, 0, draggedFieldId);

      onReorder(currentOrder);
      dragFieldIdRef.current = null;
    },
    [columnOrder, primaryFieldId, onReorder],
  );

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,
  };
}
