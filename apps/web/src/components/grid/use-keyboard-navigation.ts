'use client';

/**
 * useKeyboardNavigation — spreadsheet-style keyboard navigation for the DataGrid.
 *
 * Attaches to the grid container via `onKeyDown`. Handles arrow keys, Tab,
 * Enter, Escape, Home/End, Page Up/Down, selection shortcuts, and editing
 * shortcuts. When a cell is in edit mode, most navigation shortcuts are
 * suppressed to let the input handle them.
 *
 * @see docs/reference/tables-and-views.md § Keyboard Shortcuts
 * @see docs/Playbooks/playbook-phase-3a-i.md § Prompt 7
 */

import { useCallback } from 'react';
import type { CellPosition } from './grid-types';
import type { GridField, GridRecord } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Platform-aware meta key helper
// ---------------------------------------------------------------------------

function isMod(e: React.KeyboardEvent | KeyboardEvent): boolean {
  // macOS: metaKey, Windows/Linux: ctrlKey
  return e.metaKey || e.ctrlKey;
}

// ---------------------------------------------------------------------------
// Hook options
// ---------------------------------------------------------------------------

export interface KeyboardNavigationOptions {
  /** Ordered list of visible fields (columns) */
  fields: GridField[];
  /** All records currently in the grid */
  records: GridRecord[];
  /** Currently focused cell */
  activeCell: CellPosition | null;
  /** Cell currently being edited */
  editingCell: CellPosition | null;
  /** Number of rows visible in the viewport */
  visibleRowCount: number;

  // Actions
  setActiveCell: (cell: CellPosition | null) => void;
  startEditing: (cell: CellPosition, mode: 'replace' | 'edit') => void;
  stopEditing: () => void;
  onCellSave: (rowId: string, fieldId: string, value: unknown) => void;

  // Selection
  selectedRows: Set<string>;
  setSelectedRows: (rows: Set<string>) => void;
  selectionAnchor: CellPosition | null;
  setSelectionAnchor: (cell: CellPosition | null) => void;
  selectionRange: CellPosition | null;
  setSelectionRange: (cell: CellPosition | null) => void;

  // Callbacks
  onAddRecord?: () => void;
  onOpenShortcutsHelp?: () => void;

  // Scroll helper — ensures the active cell is visible
  scrollToCell?: (rowIndex: number, colIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  const {
    fields,
    records,
    activeCell,
    editingCell,
    visibleRowCount,
    setActiveCell,
    startEditing,
    stopEditing,
    onCellSave,
    selectedRows: _selectedRows,
    setSelectedRows,
    selectionAnchor,
    setSelectionAnchor,
    selectionRange: _selectionRange,
    setSelectionRange,
    onAddRecord,
    onOpenShortcutsHelp,
    scrollToCell,
  } = options;

  // -------------------------------------------------------------------------
  // Index helpers
  // -------------------------------------------------------------------------

  const getRowIndex = useCallback(
    (rowId: string) => records.findIndex((r) => r.id === rowId),
    [records],
  );

  const getColIndex = useCallback(
    (fieldId: string) => fields.findIndex((f) => f.id === fieldId),
    [fields],
  );

  const getCellAt = useCallback(
    (rowIdx: number, colIdx: number): CellPosition | null => {
      const record = records[rowIdx];
      const field = fields[colIdx];
      if (!record || !field) return null;
      return { rowId: record.id, fieldId: field.id };
    },
    [records, fields],
  );

  // -------------------------------------------------------------------------
  // Movement helpers
  // -------------------------------------------------------------------------

  const moveTo = useCallback(
    (rowIdx: number, colIdx: number, extend?: boolean) => {
      const clampedRow = Math.max(0, Math.min(rowIdx, records.length - 1));
      const clampedCol = Math.max(0, Math.min(colIdx, fields.length - 1));
      const cell = getCellAt(clampedRow, clampedCol);
      if (!cell) return;

      if (extend) {
        // Shift+Arrow: extend selection range
        if (!selectionAnchor && activeCell) {
          setSelectionAnchor(activeCell);
        }
        setSelectionRange(cell);
      } else {
        // Clear selection when moving without Shift
        setSelectionAnchor(null);
        setSelectionRange(null);
      }

      setActiveCell(cell);
      scrollToCell?.(clampedRow, clampedCol);
    },
    [
      records.length,
      fields.length,
      getCellAt,
      activeCell,
      selectionAnchor,
      setActiveCell,
      setSelectionAnchor,
      setSelectionRange,
      scrollToCell,
    ],
  );

  // -------------------------------------------------------------------------
  // Key handler
  // -------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isEditing = editingCell !== null;
      const mod = isMod(e);

      // -------------------------------------------------------------------
      // Grid actions (always active)
      // -------------------------------------------------------------------

      // Cmd+/ — Keyboard shortcuts help
      if (mod && e.key === '/') {
        e.preventDefault();
        onOpenShortcutsHelp?.();
        return;
      }

      // Cmd+Shift+N — New record
      if (mod && e.shiftKey && (e.key === 'N' || e.key === 'n')) {
        e.preventDefault();
        onAddRecord?.();
        return;
      }

      // Cmd+A — Select all rows
      if (mod && (e.key === 'a' || e.key === 'A') && !isEditing) {
        e.preventDefault();
        const allIds = new Set(records.map((r) => r.id));
        setSelectedRows(allIds);
        return;
      }

      // -------------------------------------------------------------------
      // Placeholder shortcuts (no-ops wired here, functional in later prompts)
      // -------------------------------------------------------------------

      // Cmd+Shift+F — Toggle filter panel (3A-ii)
      if (mod && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        return;
      }

      // Cmd+Shift+S — Toggle sort panel (3A-ii)
      if (mod && e.shiftKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        return;
      }

      // Cmd+F — Command Bar scoped (3B-ii)
      if (mod && !e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        // Don't prevent default — let browser find work for now
        return;
      }

      // Cmd+Shift+E — Open Record View (3A-ii)
      if (mod && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        return;
      }

      // Cmd+K — Command Bar (3B-ii)
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        return;
      }

      // Cmd+Z — Undo (Prompt 9)
      if (mod && !e.shiftKey && (e.key === 'z' || e.key === 'Z') && !isEditing) {
        e.preventDefault();
        return;
      }

      // Cmd+Shift+Z — Redo (Prompt 9)
      if (mod && e.shiftKey && (e.key === 'z' || e.key === 'Z') && !isEditing) {
        e.preventDefault();
        return;
      }

      // Cmd+C — Copy (Prompt 9)
      if (mod && (e.key === 'c' || e.key === 'C') && !isEditing) {
        e.preventDefault();
        return;
      }

      // Cmd+V — Paste (Prompt 9)
      if (mod && (e.key === 'v' || e.key === 'V') && !isEditing) {
        e.preventDefault();
        return;
      }

      // Cmd+D — Fill down (Prompt 9)
      if (mod && (e.key === 'd' || e.key === 'D') && !isEditing) {
        e.preventDefault();
        return;
      }

      // -------------------------------------------------------------------
      // When editing, suppress most navigation — let the input handle them
      // -------------------------------------------------------------------

      if (isEditing) {
        // Enter while editing → confirm edit + move down
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          stopEditing();
          if (activeCell) {
            const rowIdx = getRowIndex(activeCell.rowId);
            const colIdx = getColIndex(activeCell.fieldId);
            if (rowIdx < records.length - 1) {
              moveTo(rowIdx + 1, colIdx);
            }
          }
          return;
        }

        // Escape while editing → cancel edit
        if (e.key === 'Escape') {
          e.preventDefault();
          stopEditing();
          return;
        }

        // Tab while editing → confirm edit + move to next/prev cell
        if (e.key === 'Tab') {
          e.preventDefault();
          stopEditing();
          if (activeCell) {
            const rowIdx = getRowIndex(activeCell.rowId);
            const colIdx = getColIndex(activeCell.fieldId);
            if (e.shiftKey) {
              // Shift+Tab: previous cell, wrap to previous row
              if (colIdx > 0) {
                moveTo(rowIdx, colIdx - 1);
              } else if (rowIdx > 0) {
                moveTo(rowIdx - 1, fields.length - 1);
              }
            } else {
              // Tab: next cell, wrap to next row
              if (colIdx < fields.length - 1) {
                moveTo(rowIdx, colIdx + 1);
              } else if (rowIdx < records.length - 1) {
                moveTo(rowIdx + 1, 0);
              }
            }
          }
          return;
        }

        // All other keys while editing — let the input handle them
        return;
      }

      // -------------------------------------------------------------------
      // No active cell — nothing to navigate
      // -------------------------------------------------------------------

      if (!activeCell) return;

      const rowIdx = getRowIndex(activeCell.rowId);
      const colIdx = getColIndex(activeCell.fieldId);
      if (rowIdx === -1 || colIdx === -1) return;

      const extend = e.shiftKey && !mod;

      // -------------------------------------------------------------------
      // Navigation (not editing)
      // -------------------------------------------------------------------

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveTo(rowIdx - 1, colIdx, extend);
          break;

        case 'ArrowDown':
          e.preventDefault();
          moveTo(rowIdx + 1, colIdx, extend);
          break;

        case 'ArrowLeft':
          e.preventDefault();
          moveTo(rowIdx, colIdx - 1, extend);
          break;

        case 'ArrowRight':
          e.preventDefault();
          moveTo(rowIdx, colIdx + 1, extend);
          break;

        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            if (colIdx > 0) {
              moveTo(rowIdx, colIdx - 1);
            } else if (rowIdx > 0) {
              moveTo(rowIdx - 1, fields.length - 1);
            }
          } else {
            if (colIdx < fields.length - 1) {
              moveTo(rowIdx, colIdx + 1);
            } else if (rowIdx < records.length - 1) {
              moveTo(rowIdx + 1, 0);
            }
          }
          break;

        case 'Enter':
          e.preventDefault();
          startEditing(activeCell, 'edit');
          break;

        case 'Escape':
          e.preventDefault();
          setActiveCell(null);
          setSelectionAnchor(null);
          setSelectionRange(null);
          break;

        case 'Home':
          e.preventDefault();
          if (mod) {
            // Cmd+Home → first row, first column
            moveTo(0, 0, extend);
          } else {
            // Home → first column in current row
            moveTo(rowIdx, 0, extend);
          }
          break;

        case 'End':
          e.preventDefault();
          if (mod) {
            // Cmd+End → last row, last column
            moveTo(records.length - 1, fields.length - 1, extend);
          } else {
            // End → last column in current row
            moveTo(rowIdx, fields.length - 1, extend);
          }
          break;

        case 'PageUp':
          e.preventDefault();
          moveTo(Math.max(0, rowIdx - visibleRowCount), colIdx);
          break;

        case 'PageDown':
          e.preventDefault();
          moveTo(
            Math.min(records.length - 1, rowIdx + visibleRowCount),
            colIdx,
          );
          break;

        // Editing shortcuts
        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          const field = fields[colIdx];
          if (field && !field.readOnly) {
            onCellSave(activeCell.rowId, activeCell.fieldId, null);
          }
          break;
        }

        case ' ': {
          // Space → toggle checkbox
          const field = fields[colIdx];
          if (field?.fieldType === 'checkbox' && !field.readOnly) {
            e.preventDefault();
            const record = records[rowIdx];
            if (record) {
              const data = record.canonicalData as Record<string, unknown> | null;
              const currentValue = data?.[field.id];
              onCellSave(
                activeCell.rowId,
                activeCell.fieldId,
                !currentValue,
              );
            }
          }
          break;
        }

        case 'F2':
          e.preventDefault();
          startEditing(activeCell, 'edit');
          break;

        default: {
          // Any printable character → start replace-mode editing
          if (
            e.key.length === 1 &&
            !mod &&
            !e.altKey
          ) {
            const field = fields[colIdx];
            if (field && !field.readOnly) {
              // Don't prevent default — let the keystroke flow to the edit input
              startEditing(activeCell, 'replace');
            }
          }
          break;
        }
      }
    },
    [
      activeCell,
      editingCell,
      fields,
      records,
      visibleRowCount,
      setActiveCell,
      startEditing,
      stopEditing,
      onCellSave,
      setSelectedRows,
      setSelectionAnchor,
      setSelectionRange,
      onAddRecord,
      onOpenShortcutsHelp,
      moveTo,
      getRowIndex,
      getColIndex,
    ],
  );

  return { handleKeyDown };
}
