'use client';

/**
 * GridRow — renders a single data row with drag handle, checkbox,
 * row number, primary field (with expand icon on hover), and data cells.
 *
 * @see docs/reference/tables-and-views.md § Row Behavior
 */

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Row } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { GridCell } from './GridCell';
import {
  GRID_TOKENS,
  DRAG_HANDLE_WIDTH,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
} from './grid-types';
import type { GridRecord, GridField, RowDensity } from '@/lib/types/grid';
import type { CellPosition } from './grid-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GridRowProps {
  row: Row<GridRecord>;
  rowIndex: number;
  fields: GridField[];
  density: RowDensity;
  rowHeight: number;
  activeCell: CellPosition | null;
  editingCell: CellPosition | null;
  onCellClick: (rowId: string, fieldId: string) => void;
  onCellDoubleClick: (rowId: string, fieldId: string) => void;
  onCellStartReplace: (rowId: string, fieldId: string) => void;
  onCellSave: (rowId: string, fieldId: string, value: unknown) => void;
  onCellCancel: () => void;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GridRow = memo(function GridRow({
  row,
  rowIndex,
  fields,
  density: _density,
  rowHeight,
  activeCell,
  editingCell,
  onCellClick,
  onCellDoubleClick,
  onCellStartReplace,
  onCellSave,
  onCellCancel,
  style,
}: GridRowProps) {
  const t = useTranslations('grid');
  const [isHovered, setIsHovered] = useState(false);

  const isOdd = rowIndex % 2 === 1;
  const record = row.original;
  const primaryField = fields.find((f) => f.isPrimary);

  return (
    <div
      role="row"
      className="flex"
      style={{
        height: rowHeight,
        backgroundColor: isHovered
          ? GRID_TOKENS.rowHover
          : isOdd
            ? GRID_TOKENS.rowStripeOdd
            : GRID_TOKENS.rowStripeEven,
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b cursor-grab"
        style={{
          width: DRAG_HANDLE_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
        aria-label={t('drag_handle')}
      >
        {isHovered && (
          <span className="text-xs" style={{ color: GRID_TOKENS.textSecondary }}>
            ⠿
          </span>
        )}
      </div>

      {/* Checkbox */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b"
        style={{
          width: CHECKBOX_COLUMN_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      >
        <Checkbox aria-label={t('checkbox_select')} />
      </div>

      {/* Row number */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b text-xs"
        style={{
          width: ROW_NUMBER_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
          color: GRID_TOKENS.textSecondary,
        }}
      >
        {rowIndex + 1}
      </div>

      {/* Data cells */}
      {row.getVisibleCells().map((cell) => {
        const field = fields.find((f) => f.id === cell.column.id);
        if (!field) return null;

        const isActive =
          activeCell?.rowId === record.id &&
          activeCell?.fieldId === field.id;
        const isEditing =
          editingCell?.rowId === record.id &&
          editingCell?.fieldId === field.id;
        const isPrimary = field.id === primaryField?.id;

        return (
          <div key={cell.id} className="relative" style={{ width: cell.column.getSize() }}>
            <GridCell
              record={record}
              field={field}
              isActive={isActive}
              isEditing={isEditing}
              onSave={(value) => onCellSave(record.id, field.id, value)}
              onCancel={onCellCancel}
              onClick={() => onCellClick(record.id, field.id)}
              onDoubleClick={() => onCellDoubleClick(record.id, field.id)}
              onStartReplace={() => onCellStartReplace(record.id, field.id)}
              style={{ height: rowHeight }}
            />
            {/* Expand icon on primary field hover */}
            {isPrimary && isHovered && (
              <button
                type="button"
                className={cn(
                  'absolute right-1 top-1/2 -translate-y-1/2',
                  'flex items-center justify-center',
                  'h-5 w-5 rounded text-xs',
                  'bg-white/80 hover:bg-white shadow-sm',
                  'transition-opacity',
                )}
                style={{ color: GRID_TOKENS.textSecondary }}
                aria-label={t('expand_record')}
              >
                ⤢
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
});
