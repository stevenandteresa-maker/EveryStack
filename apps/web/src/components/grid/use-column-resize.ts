/**
 * Column resize hook — handles drag-to-resize on column right edges.
 *
 * Min width: 60px, Max width: 800px.
 * Uses requestAnimationFrame for 16ms smooth updates.
 * Saves widths to views.config via updateViewConfig on drag end.
 *
 * @see docs/reference/tables-and-views.md § Column Behavior
 */

import { useCallback, useEffect, useRef } from 'react';

const MIN_WIDTH = 60;
const MAX_WIDTH = 800;

interface UseColumnResizeOptions {
  onResize: (fieldId: string, width: number) => void;
  onResizeEnd: (fieldId: string, width: number) => void;
}

export function useColumnResize({
  onResize,
  onResizeEnd,
}: UseColumnResizeOptions) {
  const callbacksRef = useRef({ onResize, onResizeEnd });

  useEffect(() => {
    callbacksRef.current = { onResize, onResizeEnd };
  });

  const startResize = useCallback(
    (fieldId: string, currentWidth: number, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      let lastClientX = e.clientX;
      let rafId: number | null = null;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent: MouseEvent) => {
        lastClientX = moveEvent.clientX;

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
          const delta = lastClientX - startX;
          const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, currentWidth + delta));
          callbacksRef.current.onResize(fieldId, newWidth);
          rafId = null;
        });
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (rafId !== null) {
          cancelAnimationFrame(rafId);
        }

        const delta = lastClientX - startX;
        const finalWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, currentWidth + delta));
        callbacksRef.current.onResizeEnd(fieldId, finalWidth);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [],
  );

  return { startResize };
}
