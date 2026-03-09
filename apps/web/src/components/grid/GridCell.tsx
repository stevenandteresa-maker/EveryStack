'use client';

/**
 * GridCell — wrapper that selects the correct cell renderer based on field type.
 *
 * Uses the FieldTypeRegistry pattern (no switch statement on field types).
 * Handles active cell highlighting, edit mode transitions (replace vs edit),
 * and passes edit state to renderers.
 *
 * Editing modes (spreadsheet-style):
 * - Single click + type: Replace mode — clears content, new keystroke becomes value
 * - Double-click: Edit mode — cursor placed within existing content
 * - Checkbox/Rating: Single click directly toggles value (no edit mode)
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 6
 */

import { memo, useCallback, useRef } from 'react';
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
// Field types that toggle directly on single click (no edit mode)
// ---------------------------------------------------------------------------

const DIRECT_TOGGLE_TYPES = new Set(['checkbox', 'rating']);

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
  onDoubleClick?: () => void;
  onStartReplace?: () => void;
  validationError?: string | null;
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
  onDoubleClick,
  onStartReplace,
  validationError,
  style,
}: GridCellProps) {
  const canonicalData = record.canonicalData as Record<string, unknown> | null;
  const value = canonicalData?.[field.id] ?? null;
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);

  const entry = getCellRenderer(field.fieldType);
  const DisplayComponent = entry?.DisplayComponent ?? DefaultCellDisplay;
  const EditComponent = entry?.EditComponent;
  const isDirectToggle = DIRECT_TOGGLE_TYPES.has(field.fieldType);

  const rendererProps: CellRendererProps = {
    value,
    field,
    isEditing,
    onSave,
    onCancel,
  };

  // Use edit component when editing and one exists
  const ActiveComponent = isEditing && EditComponent ? EditComponent : DisplayComponent;

  const handleClick = useCallback(() => {
    // Read-only cells: just set active, no edit
    if (field.readOnly) {
      onClick();
      return;
    }

    // Direct toggle types (checkbox, rating) handle their own save
    if (isDirectToggle) {
      onClick();
      return;
    }

    clickCountRef.current += 1;

    if (clickCountRef.current === 1) {
      // Single click: set active. Start a timer to detect double-click.
      clickTimerRef.current = setTimeout(() => {
        clickCountRef.current = 0;
        onClick();
      }, 200);
    } else if (clickCountRef.current >= 2) {
      // Double click: enter edit mode (preserve content)
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      clickCountRef.current = 0;
      onDoubleClick?.();
    }
  }, [field.readOnly, isDirectToggle, onClick, onDoubleClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // If already editing, let the edit component handle keys
      if (isEditing) return;

      // Read-only cells ignore keyboard input
      if (field.readOnly) return;

      // Direct toggle types don't use replace mode
      if (isDirectToggle) return;

      // Only trigger replace mode on printable character keys
      if (
        isActive &&
        !isEditing &&
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        onStartReplace?.();
      }
    },
    [isActive, isEditing, field.readOnly, isDirectToggle, onStartReplace],
  );

  return (
    <div
      role="gridcell"
      tabIndex={isActive ? 0 : -1}
      className={cn(
        'flex items-center overflow-hidden px-3 py-2',
        'border-r border-b',
        'outline-none',
        isActive && !isEditing && 'ring-2 ring-inset z-10',
        isEditing && 'ring-2 ring-inset z-20 shadow-sm',
        validationError && 'ring-2 ring-inset ring-red-500 z-20',
      )}
      style={{
        borderColor: GRID_TOKENS.borderDefault,
        ...(
          (isActive || isEditing) && !validationError
            ? { '--tw-ring-color': GRID_TOKENS.activeCellBorder } as React.CSSProperties
            : {}
        ),
        ...style,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="w-full truncate">
        <ActiveComponent {...rendererProps} />
      </div>
      {validationError && (
        <div className="absolute left-0 top-full z-30 bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-600 shadow-sm whitespace-nowrap">
          {validationError}
        </div>
      )}
    </div>
  );
});
