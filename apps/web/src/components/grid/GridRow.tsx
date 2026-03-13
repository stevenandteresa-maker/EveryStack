'use client';

/**
 * GridRow — renders a single data row with drag handle, checkbox,
 * row number, primary field (with expand icon on hover), and data cells.
 *
 * Wraps content in RowContextMenu for right-click actions.
 * Supports row drag-and-drop reordering via the grip handle.
 *
 * @see docs/reference/tables-and-views.md § Row Behavior
 */

import { memo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Row } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { GridCell } from './GridCell';
import { RowContextMenu } from './RowContextMenu';
import {
  GRID_TOKENS,
  DRAG_HANDLE_WIDTH,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
} from './grid-types';
import type { GridRecord, GridField, RowDensity } from '@/lib/types/grid';
import type { CellPosition } from './grid-types';
import { DATA_COLORS } from '@/lib/design-system/colors';
import { RowPresenceIndicator } from './RowPresenceIndicator';
import type { FieldLockInfo } from '@/lib/hooks/use-field-lock';

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
  columnColors: Record<string, string>;
  isSelected?: boolean;
  onRowSelect?: (recordId: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  onCellClick: (rowId: string, fieldId: string) => void;
  onCellDoubleClick: (rowId: string, fieldId: string) => void;
  onCellStartReplace: (rowId: string, fieldId: string) => void;
  onCellSave: (rowId: string, fieldId: string, value: unknown) => void;
  onCellCancel: () => void;
  style?: React.CSSProperties;
  // Row reorder drag props
  isDragDisabled?: boolean;
  isDropTarget?: boolean;
  onRowDragStart?: (e: React.DragEvent, recordId: string, rowIndex: number) => void;
  onRowDragOver?: (e: React.DragEvent, rowIndex: number) => void;
  onRowDragEnd?: () => void;
  onRowDrop?: (e: React.DragEvent, rowIndex: number) => void;
  // Context menu callbacks
  onExpandRecord?: (recordId: string) => void;
  onCopyRecord?: (recordId: string) => void;
  onDuplicateRecord?: (recordId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  onInsertAbove?: (recordId: string) => void;
  onInsertBelow?: (recordId: string) => void;
  onCopyCellValue?: () => void;
  onPaste?: () => void;
  onClearCellValue?: () => void;
  onCopyRecordLink?: (recordId: string) => void;
  // Color coding
  rowTintColor?: string | null;
  cellTintColors?: Record<string, string>;
  // Collaboration — field locks & row presence
  /** Get lock info for a field in this record. Returns null if free. */
  getFieldLock?: (recordId: string, fieldId: string) => FieldLockInfo | null;
  /** Color for the row presence indicator (left border). Empty string = no presence. */
  presenceColor?: string;
  /** Field IDs that are read-only due to field-level permissions. */
  readOnlyFieldIds?: Set<string>;
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
  columnColors,
  isSelected,
  onRowSelect,
  onCellClick,
  onCellDoubleClick,
  onCellStartReplace,
  onCellSave,
  onCellCancel,
  style,
  isDragDisabled,
  isDropTarget,
  onRowDragStart,
  onRowDragOver,
  onRowDragEnd,
  onRowDrop,
  onExpandRecord,
  onCopyRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onInsertAbove,
  onInsertBelow,
  onCopyCellValue,
  onPaste,
  onClearCellValue,
  onCopyRecordLink,
  rowTintColor,
  cellTintColors,
  getFieldLock,
  presenceColor,
  readOnlyFieldIds,
}: GridRowProps) {
  const t = useTranslations('grid');
  const [isHovered, setIsHovered] = useState(false);

  const isOdd = rowIndex % 2 === 1;
  const record = row.original;
  const primaryField = fields.find((f) => f.isPrimary);

  const rowContent = (
    <div
      role="row"
      className={cn('relative flex', isDropTarget && 'ring-2 ring-inset ring-blue-400')}
      style={{
        height: rowHeight,
        backgroundColor: isSelected
          ? '#EFF6FF'
          : isHovered
            ? GRID_TOKENS.rowHover
            : rowTintColor
              ? rowTintColor
              : isOdd
                ? GRID_TOKENS.rowStripeOdd
                : GRID_TOKENS.rowStripeEven,
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragOver={
        onRowDragOver
          ? (e) => onRowDragOver(e, rowIndex)
          : undefined
      }
      onDrop={
        onRowDrop
          ? (e) => onRowDrop(e, rowIndex)
          : undefined
      }
    >
      {/* Row presence indicator */}
      {presenceColor && (
        <RowPresenceIndicator color={presenceColor} height={rowHeight} />
      )}

      {/* Drag handle */}
      <div
        className={cn(
          'shrink-0 flex items-center justify-center border-r border-b',
          !isDragDisabled && 'cursor-grab',
          isDragDisabled && 'cursor-default',
        )}
        style={{
          width: DRAG_HANDLE_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
        aria-label={t('drag_handle')}
        draggable={!isDragDisabled}
        onDragStart={
          onRowDragStart && !isDragDisabled
            ? (e) => onRowDragStart(e, record.id, rowIndex)
            : undefined
        }
        onDragEnd={onRowDragEnd}
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
        onClick={(e) => {
          e.stopPropagation();
          onRowSelect?.(record.id, {
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
          });
        }}
      >
        <Checkbox
          aria-label={t('checkbox_select')}
          checked={isSelected ?? false}
          tabIndex={-1}
        />
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

        const colorName = columnColors[field.id];
        const columnColorBg = colorName
          ? DATA_COLORS.find((c) => c.name === colorName)?.light
          : undefined;
        // Cell-level color rule overrides column color (higher specificity)
        const cellTint = cellTintColors?.[field.id];
        const cellBg = cellTint ?? columnColorBg;

        const fieldLock = getFieldLock?.(record.id, field.id) ?? null;

        return (
          <div key={cell.id} className="relative" style={{ width: cell.column.getSize(), backgroundColor: cellBg }}>
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
              lockInfo={fieldLock}
              readOnly={readOnlyFieldIds?.has(field.id)}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onExpandRecord?.(record.id);
                }}
              >
                ⤢
              </button>
            )}
          </div>
        );
      })}
    </div>
  );

  // Wrap in context menu if callbacks are provided
  if (onCopyRecord && onDuplicateRecord && onDeleteRecord) {
    return (
      <RowContextMenu
        recordId={record.id}
        onExpandRecord={onExpandRecord ?? (() => {})}
        onCopyRecord={onCopyRecord}
        onDuplicateRecord={onDuplicateRecord}
        onDeleteRecord={onDeleteRecord}
        onInsertAbove={onInsertAbove ?? (() => {})}
        onInsertBelow={onInsertBelow ?? (() => {})}
        onCopyCellValue={onCopyCellValue ?? (() => {})}
        onPaste={onPaste ?? (() => {})}
        onClearCellValue={onClearCellValue ?? (() => {})}
        onCopyRecordLink={onCopyRecordLink ?? (() => {})}
      >
        {rowContent}
      </RowContextMenu>
    );
  }

  return rowContent;
});
