'use client';

/**
 * DragToFillHandle — small square at bottom-right of selection for drag-to-fill.
 *
 * Drag down/right to fill: numbers increment, dates increment by interval,
 * text/select repeat. Skips read-only cells.
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior — Drag-to-fill
 */

import { useCallback, useRef, useState } from 'react';
import { GRID_TOKENS } from './grid-types';
import type { CellPosition } from './grid-types';
import type { GridRecord, GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DragToFillHandleProps {
  /** The position of the active cell (bottom-right of selection). */
  anchorCell: CellPosition;
  records: GridRecord[];
  fields: GridField[];
  onFill: (recordId: string, fieldId: string, value: unknown) => void;
  /** Pixel position of the anchor cell's bottom-right corner. */
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Fill value logic
// ---------------------------------------------------------------------------

/**
 * Compute the next value for filling. Numbers increment, dates
 * increment by day, text and other types simply repeat.
 */
function computeFillValue(
  sourceValue: unknown,
  fieldType: string,
  stepIndex: number,
): unknown {
  if (sourceValue === null || sourceValue === undefined) return sourceValue;

  // Numbers: increment
  if (
    (fieldType === 'number' ||
      fieldType === 'currency' ||
      fieldType === 'percent' ||
      fieldType === 'rating') &&
    typeof sourceValue === 'number'
  ) {
    return sourceValue + stepIndex;
  }

  // Dates: increment by day
  if (
    (fieldType === 'date' || fieldType === 'datetime') &&
    typeof sourceValue === 'string'
  ) {
    const d = new Date(sourceValue);
    if (!Number.isNaN(d.getTime())) {
      d.setDate(d.getDate() + stepIndex);
      return fieldType === 'date'
        ? d.toISOString().split('T')[0]
        : d.toISOString();
    }
  }

  // Everything else: repeat
  return sourceValue;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DragToFillHandle({
  anchorCell,
  records,
  fields,
  onFill,
  style,
}: DragToFillHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startXRef = useRef(0);

  const anchorRowIdx = records.findIndex((r) => r.id === anchorCell.rowId);
  const anchorColIdx = fields.findIndex((f) => f.id === anchorCell.fieldId);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
      startYRef.current = e.clientY;
      startXRef.current = e.clientX;

      const sourceRecord = records[anchorRowIdx];
      if (!sourceRecord) return;

      const handleMouseMove = (_moveEvent: MouseEvent) => {
        // Visual feedback could be added here; actual fill happens on mouse up
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        setIsDragging(false);

        const deltaY = upEvent.clientY - startYRef.current;
        const deltaX = upEvent.clientX - startXRef.current;

        // Determine direction: vertical drag is more common
        if (Math.abs(deltaY) >= Math.abs(deltaX) && Math.abs(deltaY) > 10) {
          // Vertical fill (down/up)
          const rowStep = deltaY > 0 ? 1 : -1;
          const fillCount = Math.max(1, Math.round(Math.abs(deltaY) / 44)); // Approximate row height

          const sourceField = fields[anchorColIdx];
          if (!sourceField || sourceField.readOnly) return;

          const sourceValue =
            (sourceRecord.canonicalData as Record<string, unknown>)[
              sourceField.id
            ] ?? null;

          for (let i = 1; i <= fillCount; i++) {
            const targetRowIdx = anchorRowIdx + i * rowStep;
            const targetRecord = records[targetRowIdx];
            if (!targetRecord) break;

            const fillValue = computeFillValue(
              sourceValue,
              sourceField.fieldType,
              i,
            );
            onFill(targetRecord.id, sourceField.id, fillValue);
          }
        } else if (Math.abs(deltaX) > 10) {
          // Horizontal fill (right/left)
          const colStep = deltaX > 0 ? 1 : -1;
          const fillCount = Math.max(1, Math.round(Math.abs(deltaX) / 160)); // Approximate column width

          const sourceFieldObj = fields[anchorColIdx];
          if (!sourceFieldObj) return;

          const sourceValue =
            (sourceRecord.canonicalData as Record<string, unknown>)[
              sourceFieldObj.id
            ] ?? null;

          for (let i = 1; i <= fillCount; i++) {
            const targetColIdx = anchorColIdx + i * colStep;
            const targetField = fields[targetColIdx];
            if (!targetField || targetField.readOnly) break;

            // For horizontal fill, repeat the value (no increment)
            onFill(sourceRecord.id, targetField.id, sourceValue);
          }
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [anchorRowIdx, anchorColIdx, records, fields, onFill],
  );

  if (anchorRowIdx === -1 || anchorColIdx === -1) return null;

  return (
    <div
      className="absolute z-30 cursor-crosshair"
      style={{
        width: 8,
        height: 8,
        backgroundColor: isDragging
          ? GRID_TOKENS.activeCellBorder
          : GRID_TOKENS.activeCellBorder,
        border: '1px solid white',
        borderRadius: 1,
        ...style,
      }}
      onMouseDown={handleMouseDown}
      role="presentation"
    />
  );
}
