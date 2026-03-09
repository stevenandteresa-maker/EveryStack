'use client';

/**
 * DataGrid — core grid component using TanStack Table for column model
 * and TanStack Virtual for windowed row virtualization.
 *
 * Grid anatomy (left to right):
 * Drag Handle → Checkbox → Row # → Primary Field (frozen) → Fields → "+" Column
 *
 * @see docs/reference/tables-and-views.md § Grid Anatomy
 * @see docs/reference/tables-and-views.md § Scrolling & Performance
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { roleAtLeast, type EffectiveRole } from '@everystack/shared/auth';
import { GridHeader } from './GridHeader';
import { GridRow } from './GridRow';
import { NewRowInput } from './NewRowInput';
import { GridSkeleton } from './GridSkeleton';
import { GridEmptyState } from './GridEmptyState';
import { PerformanceBanner } from './PerformanceBanner';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { useKeyboardNavigation } from './use-keyboard-navigation';
import { useRowSelection } from './use-row-selection';
import { KeyboardShortcutsDialog } from './KeyboardShortcutsDialog';
import { useColumnResize } from './use-column-resize';
import { useColumnReorder } from './use-column-reorder';
import { useRowReorder } from './use-row-reorder';
import { useClipboard } from './use-clipboard';
import { useUndoRedo } from './use-undo-redo';
import {
  getDefaultColumnWidth,
  DRAG_HANDLE_WIDTH,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
  ADD_FIELD_COLUMN_WIDTH,
  ROW_OVERSCAN,
  COLUMN_OVERSCAN,
  MAX_FROZEN_COLUMNS,
  GRID_TOKENS,
} from './grid-types';
import type { CellPosition } from './grid-types';
import type {
  GridRecord,
  GridField,
  ViewConfig,
  RowDensity,
} from '@/lib/types/grid';
import { ROW_DENSITY_HEIGHTS } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DataGridProps {
  records: GridRecord[];
  fields: GridField[];
  viewConfig: ViewConfig;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
  userRole: EffectiveRole;
  activeCell: CellPosition | null;
  editingCell: CellPosition | null;
  density: RowDensity;
  frozenColumnCount: number;
  columnWidths: Record<string, number>;
  columnOrder: string[];
  columnColors: Record<string, string>;
  hiddenFieldIds: Set<string>;
  isSortActive: boolean;
  sorts: { fieldId: string; direction: 'asc' | 'desc' }[];
  filteredFieldIds: Set<string>;
  onToggleSort: (fieldId: string) => void;
  onSortAscending: (fieldId: string) => void;
  onSortDescending: (fieldId: string) => void;
  onApplyQuickFilter: (fieldId: string, operator: string, value: unknown) => void;
  onClearQuickFilter: (fieldId: string) => void;
  onCellClick: (rowId: string, fieldId: string) => void;
  onCellDoubleClick: (rowId: string, fieldId: string) => void;
  onCellStartReplace: (rowId: string, fieldId: string) => void;
  onCellSave: (rowId: string, fieldId: string, value: unknown) => void;
  onCellCancel: () => void;
  onSelectColumn: (fieldId: string) => void;
  // Keyboard navigation
  editMode: 'replace' | 'edit';
  selectedRows: Set<string>;
  selectionAnchor: CellPosition | null;
  selectionRange: CellPosition | null;
  setActiveCell: (cell: CellPosition | null) => void;
  startEditing: (cell: CellPosition, mode: 'replace' | 'edit') => void;
  stopEditing: () => void;
  setSelectedRows: (rows: Set<string>) => void;
  setSelectionAnchor: (cell: CellPosition | null) => void;
  setSelectionRange: (cell: CellPosition | null) => void;
  onAddRecord?: () => void;
  // Column behavior callbacks
  onColumnResize: (fieldId: string, width: number) => void;
  onColumnResizeEnd: (fieldId: string, width: number) => void;
  onColumnReorder: (newOrder: string[]) => void;
  onFreezeUpTo: (fieldId: string) => void;
  onUnfreeze: () => void;
  onHideField: (fieldId: string) => void;
  onSetColumnColor: (fieldId: string, colorName: string | null) => void;
  onRenameField: (fieldId: string, newName: string) => void;
  // Row behavior callbacks
  onRowReorder?: (recordId: string, fromIndex: number, toIndex: number) => void;
  onCreateRecord?: (primaryFieldId: string, initialValue: string) => void;
  onDuplicateRecord?: (recordId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  onRestoreRecord?: (recordId: string) => void;
  onInsertAbove?: (recordId: string) => void;
  onInsertBelow?: (recordId: string) => void;
  onCopyRecordLink?: (recordId: string) => void;
  onShowToast?: (message: string) => void;
  // Bulk action callbacks
  onBulkDelete?: (recordIds: string[]) => void;
  onBulkUpdateField?: (recordIds: string[], fieldId: string, value: unknown) => void;
  onBulkDuplicate?: (recordIds: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataGrid({
  records,
  fields,
  viewConfig,
  totalCount,
  isLoading,
  error,
  userRole,
  activeCell,
  editingCell,
  density,
  frozenColumnCount,
  columnWidths,
  columnOrder,
  columnColors,
  hiddenFieldIds,
  isSortActive,
  sorts,
  filteredFieldIds,
  onToggleSort,
  onSortAscending,
  onSortDescending,
  onApplyQuickFilter,
  onClearQuickFilter,
  onCellClick,
  onCellDoubleClick,
  onCellStartReplace,
  onCellSave,
  onCellCancel,
  onSelectColumn,
  editMode: _editMode,
  selectedRows,
  selectionAnchor,
  selectionRange,
  setActiveCell,
  startEditing,
  stopEditing,
  setSelectedRows,
  setSelectionAnchor,
  setSelectionRange,
  onAddRecord,
  onColumnResize,
  onColumnResizeEnd,
  onColumnReorder,
  onFreezeUpTo,
  onUnfreeze,
  onHideField,
  onSetColumnColor,
  onRenameField,
  onRowReorder,
  onCreateRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onRestoreRecord,
  onInsertAbove,
  onInsertBelow,
  onCopyRecordLink,
  onShowToast,
  onBulkDelete,
  onBulkUpdateField,
  onBulkDuplicate,
}: DataGridProps) {
  const t = useTranslations('grid');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const rowHeight = ROW_DENSITY_HEIGHTS[density];
  const showAddColumn = roleAtLeast(userRole, 'manager');

  // -----------------------------------------------------------------------
  // Sort fields: primary first, then by column order or sort_order
  // Filter out hidden fields
  // -----------------------------------------------------------------------
  const orderedFields = useMemo(() => {
    const visibleFields = fields.filter((f) => !hiddenFieldIds.has(f.id));
    const primaryField = visibleFields.find((f) => f.isPrimary);
    const nonPrimary = visibleFields.filter((f) => !f.isPrimary);

    if (columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((id, idx) => [id, idx]));
      nonPrimary.sort((a, b) => {
        const aIdx = orderMap.get(a.id) ?? a.sortOrder;
        const bIdx = orderMap.get(b.id) ?? b.sortOrder;
        return aIdx - bIdx;
      });
    }

    return primaryField ? [primaryField, ...nonPrimary] : nonPrimary;
  }, [fields, columnOrder, hiddenFieldIds]);

  // -----------------------------------------------------------------------
  // Frozen field IDs (primary always + user-frozen)
  // -----------------------------------------------------------------------
  const frozenFieldIds = useMemo(() => {
    const ids: string[] = [];
    const maxFrozen = Math.min(frozenColumnCount, MAX_FROZEN_COLUMNS);
    for (let i = 0; i < orderedFields.length && i <= maxFrozen; i++) {
      const field = orderedFields[i];
      if (field) ids.push(field.id);
    }
    return ids;
  }, [orderedFields, frozenColumnCount]);

  // -----------------------------------------------------------------------
  // Max frozen width: 40% of viewport
  // -----------------------------------------------------------------------
  const effectiveFrozenFieldIds = useMemo(() => {
    const containerWidth = scrollContainerRef.current?.clientWidth ?? 1440;
    const maxFrozenWidth = containerWidth * 0.4;
    let totalFrozenWidth = 0;
    const validFrozen: string[] = [];

    for (const fieldId of frozenFieldIds) {
      const field = orderedFields.find((f) => f.id === fieldId);
      if (!field) continue;
      const configWidth = viewConfig.columns?.find(
        (c) => c.fieldId === field.id,
      )?.width;
      const storeWidth = columnWidths[field.id];
      const defaultWidth = getDefaultColumnWidth(field.fieldType, field.isPrimary);
      const w = storeWidth ?? configWidth ?? defaultWidth;

      if (totalFrozenWidth + w <= maxFrozenWidth) {
        validFrozen.push(fieldId);
        totalFrozenWidth += w;
      } else {
        break;
      }
    }

    return validFrozen;
  }, [frozenFieldIds, orderedFields, viewConfig.columns, columnWidths]);

  // -----------------------------------------------------------------------
  // Primary field ID (for column reorder)
  // -----------------------------------------------------------------------
  const primaryFieldId = useMemo(() => {
    return fields.find((f) => f.isPrimary)?.id ?? null;
  }, [fields]);

  // -----------------------------------------------------------------------
  // Column order for reorder hook
  // -----------------------------------------------------------------------
  const effectiveColumnOrder = useMemo(() => {
    return orderedFields.map((f) => f.id);
  }, [orderedFields]);

  // -----------------------------------------------------------------------
  // Column resize hook
  // -----------------------------------------------------------------------
  const { startResize } = useColumnResize({
    onResize: onColumnResize,
    onResizeEnd: onColumnResizeEnd,
  });

  // -----------------------------------------------------------------------
  // Column reorder hook
  // -----------------------------------------------------------------------
  const {
    handleDragStart: colDragStart,
    handleDragOver: colDragOver,
    handleDragEnd: colDragEnd,
    handleDrop: colDrop,
  } = useColumnReorder({
    columnOrder: effectiveColumnOrder,
    primaryFieldId,
    onReorder: onColumnReorder,
  });

  // -----------------------------------------------------------------------
  // Row reorder hook
  // -----------------------------------------------------------------------
  const rowReorder = useRowReorder({
    records,
    isSortActive,
    onReorder: onRowReorder ?? (() => {}),
  });

  // -----------------------------------------------------------------------
  // Undo/redo hook
  // -----------------------------------------------------------------------
  const undoRedo = useUndoRedo({
    onApply: onCellSave,
  });

  // -----------------------------------------------------------------------
  // Row selection hook
  // -----------------------------------------------------------------------
  const rowSelection = useRowSelection({
    records,
    selectedRows,
    setSelectedRows,
  });

  // -----------------------------------------------------------------------
  // Bulk action handlers
  // -----------------------------------------------------------------------
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedRows);
    onBulkDelete?.(ids);
    setSelectedRows(new Set());
  }, [selectedRows, onBulkDelete, setSelectedRows]);

  const handleBulkUpdateField = useCallback(
    (fieldId: string, value: unknown) => {
      const ids = Array.from(selectedRows);
      onBulkUpdateField?.(ids, fieldId, value);
    },
    [selectedRows, onBulkUpdateField],
  );

  const handleBulkDuplicate = useCallback(() => {
    const ids = Array.from(selectedRows);
    onBulkDuplicate?.(ids);
  }, [selectedRows, onBulkDuplicate]);

  // -----------------------------------------------------------------------
  // Cell save wrapper — pushes edits to undo stack
  // -----------------------------------------------------------------------
  const handleCellSaveWithUndo = useCallback(
    (rowId: string, fieldId: string, value: unknown) => {
      const record = records.find((r) => r.id === rowId);
      const oldValue = record
        ? (record.canonicalData as Record<string, unknown>)[fieldId] ?? null
        : null;
      undoRedo.pushEdit(rowId, fieldId, oldValue, value);
      onCellSave(rowId, fieldId, value);
    },
    [records, undoRedo, onCellSave],
  );

  // -----------------------------------------------------------------------
  // Clipboard hook
  // -----------------------------------------------------------------------
  const clipboard = useClipboard({
    records,
    fields: orderedFields,
    activeCell,
    selectionAnchor,
    selectionRange,
    onUpdateCell: handleCellSaveWithUndo,
    onShowToast: onShowToast ?? (() => {}),
  });

  const handleBulkCopy = useCallback(() => {
    clipboard.handleCopy();
  }, [clipboard]);

  // -----------------------------------------------------------------------
  // Context menu callbacks
  // -----------------------------------------------------------------------
  const handleCopyRecord = useCallback(
    (recordId: string) => {
      onDuplicateRecord?.(recordId);
    },
    [onDuplicateRecord],
  );

  const handleCopyCellValue = useCallback(() => {
    clipboard.handleCopy();
  }, [clipboard]);

  const handlePaste = useCallback(() => {
    void clipboard.handlePaste();
  }, [clipboard]);

  const handleClearCellValue = useCallback(() => {
    if (activeCell) {
      handleCellSaveWithUndo(activeCell.rowId, activeCell.fieldId, null);
    }
  }, [activeCell, handleCellSaveWithUndo]);

  // -----------------------------------------------------------------------
  // Delete with 10s undo toast
  // -----------------------------------------------------------------------
  const handleDeleteWithUndo = useCallback(
    (recordId: string) => {
      onDeleteRecord?.(recordId);

      toast(t('record_deleted'), {
        duration: 10_000,
        action: {
          label: t('record_deleted_undo'),
          onClick: () => {
            onRestoreRecord?.(recordId);
          },
        },
      });
    },
    [onDeleteRecord, onRestoreRecord, t],
  );

  // -----------------------------------------------------------------------
  // Column definitions for TanStack Table
  // -----------------------------------------------------------------------
  const columns = useMemo<ColumnDef<GridRecord>[]>(() => {
    return orderedFields.map((field) => {
      const configWidth = viewConfig.columns?.find(
        (c) => c.fieldId === field.id,
      )?.width;
      const storeWidth = columnWidths[field.id];
      const defaultWidth = getDefaultColumnWidth(field.fieldType, field.isPrimary);

      return {
        id: field.id,
        accessorFn: (row) => {
          const data = row.canonicalData as Record<string, unknown> | null;
          return data?.[field.id] ?? null;
        },
        header: field.name,
        size: storeWidth ?? configWidth ?? defaultWidth,
        minSize: 60,
        maxSize: 800,
      };
    });
  }, [orderedFields, viewConfig.columns, columnWidths]);

  // -----------------------------------------------------------------------
  // TanStack Table instance
  // -----------------------------------------------------------------------
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  const { rows } = table.getRowModel();

  // -----------------------------------------------------------------------
  // Row virtualizer
  // -----------------------------------------------------------------------
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => rowHeight,
    overscan: ROW_OVERSCAN,
  });

  // -----------------------------------------------------------------------
  // Non-frozen fields for column virtualization
  // -----------------------------------------------------------------------
  const scrollableFields = useMemo(() => {
    return orderedFields.filter((f) => !effectiveFrozenFieldIds.includes(f.id));
  }, [orderedFields, effectiveFrozenFieldIds]);

  // -----------------------------------------------------------------------
  // Column virtualizer (horizontal — excludes frozen columns)
  // -----------------------------------------------------------------------
  const columnVirtualizer = useVirtualizer({
    count: scrollableFields.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const field = scrollableFields[index];
      if (!field) return 160;
      const storeWidth = columnWidths[field.id];
      const configWidth = viewConfig.columns?.find(
        (c) => c.fieldId === field.id,
      )?.width;
      return storeWidth ?? configWidth ?? getDefaultColumnWidth(field.fieldType, field.isPrimary);
    },
    horizontal: true,
    overscan: COLUMN_OVERSCAN,
  });

  // -----------------------------------------------------------------------
  // Derive the visible fields: frozen (always) + virtualized scrollable
  // -----------------------------------------------------------------------
  const visibleFieldIds = useMemo(() => {
    const ids = new Set<string>(effectiveFrozenFieldIds);
    for (const vCol of columnVirtualizer.getVirtualItems()) {
      const field = scrollableFields[vCol.index];
      if (field) ids.add(field.id);
    }
    return ids;
  }, [effectiveFrozenFieldIds, columnVirtualizer, scrollableFields]);

  const visibleFields = useMemo(() => {
    return orderedFields.filter((f) => visibleFieldIds.has(f.id));
  }, [orderedFields, visibleFieldIds]);

  // -----------------------------------------------------------------------
  // Re-measure column virtualizer when column widths change
  // -----------------------------------------------------------------------
  useEffect(() => {
    columnVirtualizer.measure();
  }, [columnWidths, columnVirtualizer]);

  // -----------------------------------------------------------------------
  // Visible row count (for Page Up / Page Down)
  // -----------------------------------------------------------------------
  const visibleRowCount = useMemo(() => {
    const containerHeight = scrollContainerRef.current?.clientHeight ?? 600;
    return Math.max(1, Math.floor(containerHeight / rowHeight));
  }, [rowHeight]);

  // -----------------------------------------------------------------------
  // Scroll-to-cell callback for keyboard navigation
  // -----------------------------------------------------------------------
  const scrollToCell = useCallback(
    (rowIndex: number, colIndex: number) => {
      rowVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
      // Scroll column into view (adjust for frozen columns)
      const frozenCount = effectiveFrozenFieldIds.length;
      const scrollableColIndex = colIndex - frozenCount;
      if (scrollableColIndex >= 0) {
        columnVirtualizer.scrollToIndex(scrollableColIndex, { align: 'auto' });
      }
    },
    [rowVirtualizer, columnVirtualizer, effectiveFrozenFieldIds.length],
  );

  // -----------------------------------------------------------------------
  // Keyboard navigation hook
  // -----------------------------------------------------------------------
  const { handleKeyDown: navKeyDown } = useKeyboardNavigation({
    fields: orderedFields,
    records,
    activeCell,
    editingCell,
    visibleRowCount,
    setActiveCell,
    startEditing,
    stopEditing,
    onCellSave: handleCellSaveWithUndo,
    selectedRows,
    setSelectedRows,
    selectionAnchor,
    setSelectionAnchor,
    selectionRange,
    setSelectionRange,
    onAddRecord,
    onOpenShortcutsHelp: () => setShortcutsOpen(true),
    scrollToCell,
  });

  // -----------------------------------------------------------------------
  // Combined keyboard handler (nav + clipboard + undo)
  // -----------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      // Undo: Cmd+Z
      if (isMeta && e.key === 'z' && !e.shiftKey && !editingCell) {
        e.preventDefault();
        undoRedo.undo();
        return;
      }

      // Redo: Cmd+Shift+Z
      if (isMeta && e.key === 'z' && e.shiftKey && !editingCell) {
        e.preventDefault();
        undoRedo.redo();
        return;
      }

      // Copy: Cmd+C
      if (isMeta && e.key === 'c' && !editingCell) {
        e.preventDefault();
        clipboard.handleCopy();
        return;
      }

      // Paste: Cmd+V
      if (isMeta && e.key === 'v' && !editingCell) {
        e.preventDefault();
        void clipboard.handlePaste();
        return;
      }

      // Fill Down: Cmd+D
      if (isMeta && e.key === 'd' && !editingCell) {
        e.preventDefault();
        clipboard.handleFillDown();
        return;
      }

      // Delegate to keyboard navigation
      navKeyDown(e);
    },
    [editingCell, undoRedo, clipboard, navKeyDown],
  );

  // -----------------------------------------------------------------------
  // Fixed column width (drag handle + checkbox + row number)
  // -----------------------------------------------------------------------
  const fixedLeftWidth = DRAG_HANDLE_WIDTH + CHECKBOX_COLUMN_WIDTH + ROW_NUMBER_WIDTH;

  // -----------------------------------------------------------------------
  // Total data column width
  // -----------------------------------------------------------------------
  const dataColumnWidth = useMemo(() => {
    return table.getAllColumns().reduce((sum, col) => sum + col.getSize(), 0);
  }, [table]);

  const totalWidth =
    fixedLeftWidth +
    dataColumnWidth +
    (showAddColumn ? ADD_FIELD_COLUMN_WIDTH : 0);

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <GridSkeleton
        columnCount={orderedFields.length || 6}
        rowHeight={rowHeight}
      />
    );
  }

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-sm" style={{ color: GRID_TOKENS.textSecondary }}>
        {t('error')}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------
  if (records.length === 0) {
    return (
      <GridEmptyState
        onCreateRecord={
          onCreateRecord
            ? () => {
                const primaryField = orderedFields.find((f) => f.isPrimary);
                if (primaryField) {
                  onCreateRecord(primaryField.id, '');
                }
              }
            : undefined
        }
      />
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="flex flex-col flex-1">
      <PerformanceBanner
        totalRowCount={totalCount}
        visibleColumnCount={orderedFields.length}
      />
      <BulkActionsToolbar
        selectedCount={selectedRows.size}
        fields={orderedFields}
        onDelete={handleBulkDelete}
        onBulkUpdateField={handleBulkUpdateField}
        onDuplicate={handleBulkDuplicate}
        onCopy={handleBulkCopy}
        onClearSelection={rowSelection.clearSelection}
      />
    <div
      ref={scrollContainerRef}
      className="relative overflow-auto flex-1 outline-none"
      role="grid"
      aria-rowcount={totalCount}
      aria-colcount={orderedFields.length}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          width: totalWidth,
          height: rowVirtualizer.getTotalSize() + rowHeight + rowHeight, // +header +new row
          position: 'relative',
        }}
      >
        {/* Header */}
        <GridHeader
          headers={table.getHeaderGroups()[0]?.headers ?? []}
          fields={visibleFields}
          frozenFieldIds={effectiveFrozenFieldIds}
          showAddColumn={showAddColumn}
          addColumnWidth={ADD_FIELD_COLUMN_WIDTH}
          userRole={userRole}
          columnColors={columnColors}
          sorts={sorts}
          filteredFieldIds={filteredFieldIds}
          allSelected={rowSelection.allSelected}
          someSelected={rowSelection.someSelected}
          onToggleSelectAll={rowSelection.toggleSelectAll}
          onSelectColumn={onSelectColumn}
          onToggleSort={onToggleSort}
          onSortAscending={onSortAscending}
          onSortDescending={onSortDescending}
          onApplyQuickFilter={onApplyQuickFilter}
          onClearQuickFilter={onClearQuickFilter}
          onStartResize={startResize}
          onDragStart={colDragStart}
          onDragOver={colDragOver}
          onDragEnd={colDragEnd}
          onDrop={colDrop}
          onFreezeUpTo={onFreezeUpTo}
          onUnfreeze={onUnfreeze}
          onHideField={onHideField}
          onSetColumnColor={onSetColumnColor}
          onRenameField={onRenameField}
        />

        {/* Virtual rows */}
        {virtualRows.map((virtualRow) => {
          const row = rows[virtualRow.index];
          if (!row) return null;

          return (
            <GridRow
              key={row.id}
              row={row}
              rowIndex={virtualRow.index}
              fields={visibleFields}
              density={density}
              rowHeight={rowHeight}
              activeCell={activeCell}
              editingCell={editingCell}
              columnColors={columnColors}
              isSelected={selectedRows.has(row.original.id)}
              onRowSelect={rowSelection.handleRowSelect}
              onCellClick={onCellClick}
              onCellDoubleClick={onCellDoubleClick}
              onCellStartReplace={onCellStartReplace}
              onCellSave={handleCellSaveWithUndo}
              onCellCancel={onCellCancel}
              style={{
                position: 'absolute',
                top: virtualRow.start + rowHeight, // offset by header
                left: 0,
                width: totalWidth,
              }}
              // Row reorder
              isDragDisabled={rowReorder.isDisabled}
              isDropTarget={rowReorder.dropTargetIndex === virtualRow.index}
              onRowDragStart={rowReorder.handleDragStart}
              onRowDragOver={rowReorder.handleDragOver}
              onRowDragEnd={rowReorder.handleDragEnd}
              onRowDrop={rowReorder.handleDrop}
              // Context menu
              onExpandRecord={() => {}} // Placeholder — Record View ships in 3A-ii
              onCopyRecord={handleCopyRecord}
              onDuplicateRecord={onDuplicateRecord}
              onDeleteRecord={handleDeleteWithUndo}
              onInsertAbove={onInsertAbove}
              onInsertBelow={onInsertBelow}
              onCopyCellValue={handleCopyCellValue}
              onPaste={handlePaste}
              onClearCellValue={handleClearCellValue}
              onCopyRecordLink={onCopyRecordLink}
            />
          );
        })}

        {/* New row input — always at bottom */}
        {onCreateRecord && (
          <div
            style={{
              position: 'absolute',
              top: rowVirtualizer.getTotalSize() + rowHeight, // after header + all rows
              left: 0,
            }}
          >
            <NewRowInput
              fields={orderedFields}
              rowHeight={rowHeight}
              totalWidth={totalWidth}
              rowCount={records.length}
              onCreateRecord={onCreateRecord}
            />
          </div>
        )}
      </div>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
    </div>
  );
}
