'use client';

/**
 * ColumnResizer — drag handle rendered at the right edge of each column header.
 *
 * @see docs/reference/tables-and-views.md § Column Behavior
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';

interface ColumnResizerProps {
  fieldId: string;
  width: number;
  onStartResize: (fieldId: string, width: number, e: React.MouseEvent) => void;
}

export const ColumnResizer = memo(function ColumnResizer({
  fieldId,
  width,
  onStartResize,
}: ColumnResizerProps) {
  return (
    <div
      className={cn(
        'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize',
        'hover:bg-blue-500 active:bg-blue-500',
        'transition-colors z-10',
      )}
      onMouseDown={(e) => onStartResize(fieldId, width, e)}
      role="separator"
      aria-orientation="vertical"
    />
  );
});
