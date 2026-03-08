'use client';

/**
 * DataGrid — core grid component using TanStack Table for column model
 * and TanStack Virtual for windowed row/column virtualization.
 *
 * Grid anatomy (left to right):
 * Drag Handle → Checkbox → Row # → Primary Field (frozen) → Fields → "+" Column
 *
 * @see docs/reference/tables-and-views.md § Grid Anatomy
 * @see docs/reference/tables-and-views.md § Scrolling & Performance
 */

import { useMemo, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslations } from 'next-intl';
import { roleAtLeast, type EffectiveRole } from '@everystack/shared/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { GridHeader } from './GridHeader';
import { GridRow } from './GridRow';
import {
  getDefaultColumnWidth,
  DRAG_HANDLE_WIDTH,
  CHECKBOX_COLUMN_WIDTH,
  ROW_NUMBER_WIDTH,
  ADD_FIELD_COLUMN_WIDTH,
  ROW_OVERSCAN,
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
  onCellClick: (rowId: string, fieldId: string) => void;
  onCellSave: (rowId: string, fieldId: string, value: unknown) => void;
  onCellCancel: () => void;
  onSelectColumn: (fieldId: string) => void;
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
  onCellClick,
  onCellSave,
  onCellCancel,
  onSelectColumn,
}: DataGridProps) {
  const t = useTranslations('grid');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const rowHeight = ROW_DENSITY_HEIGHTS[density];
  const showAddColumn = roleAtLeast(userRole, 'manager');

  // -----------------------------------------------------------------------
  // Sort fields: primary first, then by column order or sort_order
  // -----------------------------------------------------------------------
  const orderedFields = useMemo(() => {
    const primaryField = fields.find((f) => f.isPrimary);
    const nonPrimary = fields.filter((f) => !f.isPrimary);

    if (columnOrder.length > 0) {
      const orderMap = new Map(columnOrder.map((id, idx) => [id, idx]));
      nonPrimary.sort((a, b) => {
        const aIdx = orderMap.get(a.id) ?? a.sortOrder;
        const bIdx = orderMap.get(b.id) ?? b.sortOrder;
        return aIdx - bIdx;
      });
    }

    return primaryField ? [primaryField, ...nonPrimary] : nonPrimary;
  }, [fields, columnOrder]);

  // -----------------------------------------------------------------------
  // Frozen field IDs (primary always + user-frozen)
  // -----------------------------------------------------------------------
  const frozenFieldIds = useMemo(() => {
    const ids: string[] = [];
    for (let i = 0; i < orderedFields.length && i <= frozenColumnCount; i++) {
      const field = orderedFields[i];
      if (field) ids.push(field.id);
    }
    return ids;
  }, [orderedFields, frozenColumnCount]);

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
      <div className="flex flex-col gap-1 p-4" role="status" aria-label={t('loading')}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
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
      <div className="flex items-center justify-center p-8 text-sm" style={{ color: GRID_TOKENS.textSecondary }}>
        {t('empty')}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={scrollContainerRef}
      className="relative overflow-auto flex-1"
      role="grid"
      aria-rowcount={totalCount}
      aria-colcount={orderedFields.length}
    >
      <div
        style={{
          width: totalWidth,
          height: rowVirtualizer.getTotalSize() + rowHeight, // +header
          position: 'relative',
        }}
      >
        {/* Header */}
        <GridHeader
          headers={table.getHeaderGroups()[0]?.headers ?? []}
          fields={orderedFields}
          frozenFieldIds={frozenFieldIds}
          showAddColumn={showAddColumn}
          addColumnWidth={ADD_FIELD_COLUMN_WIDTH}
          onSelectColumn={onSelectColumn}
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
              fields={orderedFields}
              density={density}
              rowHeight={rowHeight}
              activeCell={activeCell}
              editingCell={editingCell}
              onCellClick={onCellClick}
              onCellSave={onCellSave}
              onCellCancel={onCellCancel}
              style={{
                position: 'absolute',
                top: virtualRow.start + rowHeight, // offset by header
                left: 0,
                width: totalWidth,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
