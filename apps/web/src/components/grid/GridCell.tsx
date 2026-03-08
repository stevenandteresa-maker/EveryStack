'use client';

/**
 * GridCell — wrapper that selects the correct cell renderer based on field type.
 *
 * Uses the FieldTypeRegistry pattern (no switch statement on field types).
 * Handles active cell highlighting and passes edit mode state to renderers.
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior
 */

import { memo } from 'react';
import { cn } from '@/lib/utils';
import { GRID_TOKENS } from './grid-types';
import type { GridField, GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Cell renderer registry (populated by Prompt 3/4/5)
// ---------------------------------------------------------------------------

export interface CellRendererProps {
  value: unknown;
  field: GridField;
  isEditing: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
}

interface CellRendererEntry {
  DisplayComponent: React.ComponentType<CellRendererProps>;
  EditComponent?: React.ComponentType<CellRendererProps>;
}

const cellRendererRegistry = new Map<string, CellRendererEntry>();

export function registerCellRenderer(
  fieldType: string,
  entry: CellRendererEntry,
): void {
  cellRendererRegistry.set(fieldType, entry);
}

export function getCellRenderer(fieldType: string): CellRendererEntry | undefined {
  return cellRendererRegistry.get(fieldType);
}

// ---------------------------------------------------------------------------
// Default cell renderer (fallback for unregistered field types)
// ---------------------------------------------------------------------------

function DefaultCellDisplay({ value }: CellRendererProps) {
  return (
    <span className="truncate text-sm" style={{ color: GRID_TOKENS.textPrimary }}>
      {value != null ? String(value) : ''}
    </span>
  );
}

// ---------------------------------------------------------------------------
// GridCell component
// ---------------------------------------------------------------------------

export interface GridCellProps {
  record: GridRecord;
  field: GridField;
  isActive: boolean;
  isEditing: boolean;
  onSave: (value: unknown) => void;
  onCancel: () => void;
  onClick: () => void;
  style?: React.CSSProperties;
}

export const GridCell = memo(function GridCell({
  record,
  field,
  isActive,
  isEditing,
  onSave,
  onCancel,
  onClick,
  style,
}: GridCellProps) {
  const canonicalData = record.canonicalData as Record<string, unknown> | null;
  const value = canonicalData?.[field.id] ?? null;

  const entry = getCellRenderer(field.fieldType);
  const DisplayComponent = entry?.DisplayComponent ?? DefaultCellDisplay;

  const rendererProps: CellRendererProps = {
    value,
    field,
    isEditing,
    onSave,
    onCancel,
  };

  return (
    <div
      role="gridcell"
      className={cn(
        'flex items-center overflow-hidden px-3 py-2',
        'border-r border-b',
        isActive && 'ring-2 ring-inset z-10',
      )}
      style={{
        borderColor: GRID_TOKENS.borderDefault,
        ...(isActive ? { '--tw-ring-color': GRID_TOKENS.activeCellBorder } as React.CSSProperties : {}),
        ...style,
      }}
      onClick={onClick}
    >
      <div className="w-full truncate">
        <DisplayComponent {...rendererProps} />
      </div>
    </div>
  );
});
