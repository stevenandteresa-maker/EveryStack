'use client';

/**
 * Multi-cell copy/paste and fill-down hook for the grid view.
 *
 * Supports Cmd+C (copy), Cmd+V (paste with type coercion), and Cmd+D (fill down).
 *
 * @see docs/reference/tables-and-views.md § Cell Behavior
 */

import { useCallback } from 'react';

import type { CellPosition } from './grid-types';
import type { GridRecord, GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface UseClipboardOptions {
  records: GridRecord[];
  fields: GridField[];
  activeCell: CellPosition | null;
  selectionAnchor: CellPosition | null;
  selectionRange: CellPosition | null;
  onUpdateCell: (recordId: string, fieldId: string, value: unknown) => void;
  onShowToast: (message: string) => void;
}

export interface UseClipboardReturn {
  handleCopy: () => void;
  handlePaste: () => Promise<void>;
  handleFillDown: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the row and column index boundaries of the current selection.
 * Falls back to the active cell when no range is selected.
 */
function resolveSelectionBounds(
  records: GridRecord[],
  fields: GridField[],
  activeCell: CellPosition | null,
  selectionAnchor: CellPosition | null,
  selectionRange: CellPosition | null,
): { rowStart: number; rowEnd: number; colStart: number; colEnd: number } | null {
  const anchor = selectionAnchor ?? activeCell;
  const range = selectionRange ?? activeCell;

  if (!anchor || !range) return null;

  const anchorRowIdx = records.findIndex((r) => r.id === anchor.rowId);
  const rangeRowIdx = records.findIndex((r) => r.id === range.rowId);
  const anchorColIdx = fields.findIndex((f) => f.id === anchor.fieldId);
  const rangeColIdx = fields.findIndex((f) => f.id === range.fieldId);

  if (anchorRowIdx === -1 || rangeRowIdx === -1 || anchorColIdx === -1 || rangeColIdx === -1) {
    return null;
  }

  return {
    rowStart: Math.min(anchorRowIdx, rangeRowIdx),
    rowEnd: Math.max(anchorRowIdx, rangeRowIdx),
    colStart: Math.min(anchorColIdx, rangeColIdx),
    colEnd: Math.max(anchorColIdx, rangeColIdx),
  };
}

/** Read a cell value from a record's canonical data by field id. */
function getCellValue(record: GridRecord, field: GridField): unknown {
  return record.canonicalData[field.id] ?? '';
}

/** Serialize a cell value to a string suitable for clipboard text. */
function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Coerce a pasted string to the target field type.
 * Returns `{ value, skipped }` — `skipped` is true when the value is
 * incompatible with the target type.
 */
function coerceToFieldType(
  text: string,
  fieldType: string,
): { value: unknown; skipped: boolean } {
  switch (fieldType) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration':
    case 'rating': {
      const num = parseFloat(text);
      if (Number.isNaN(num)) return { value: null, skipped: true };
      return { value: num, skipped: false };
    }

    case 'checkbox': {
      const lower = text.toLowerCase().trim();
      const truthy = ['true', '1', 'yes'];
      const falsy = ['false', '0', 'no'];
      if (truthy.includes(lower)) return { value: true, skipped: false };
      if (falsy.includes(lower)) return { value: false, skipped: false };
      return { value: null, skipped: true };
    }

    case 'text':
    case 'textarea':
    case 'url':
    case 'email':
    case 'phone':
    case 'barcode':
      return { value: text, skipped: false };

    default:
      // For complex types (multi_select, linked_record, attachment, etc.)
      // we skip rather than blindly paste incompatible data.
      if (
        fieldType === 'single_select' ||
        fieldType === 'date' ||
        fieldType === 'datetime'
      ) {
        // Allow paste as-is — the server will validate.
        return { value: text, skipped: false };
      }
      return { value: null, skipped: true };
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClipboard({
  records,
  fields,
  activeCell,
  selectionAnchor,
  selectionRange,
  onUpdateCell,
  onShowToast,
}: UseClipboardOptions): UseClipboardReturn {
  // -----------------------------------------------------------------------
  // Copy — Cmd+C
  // -----------------------------------------------------------------------
  const handleCopy = useCallback(() => {
    const bounds = resolveSelectionBounds(
      records,
      fields,
      activeCell,
      selectionAnchor,
      selectionRange,
    );
    if (!bounds) return;

    const { rowStart, rowEnd, colStart, colEnd } = bounds;
    const rows: string[] = [];

    for (let r = rowStart; r <= rowEnd; r++) {
      const record = records[r];
      if (!record) continue;
      const cells: string[] = [];
      for (let c = colStart; c <= colEnd; c++) {
        const field = fields[c];
        if (!field) continue;
        cells.push(valueToString(getCellValue(record, field)));
      }
      rows.push(cells.join('\t'));
    }

    const tsv = rows.join('\n');
    void navigator.clipboard.writeText(tsv);
  }, [records, fields, activeCell, selectionAnchor, selectionRange]);

  // -----------------------------------------------------------------------
  // Paste — Cmd+V
  // -----------------------------------------------------------------------
  const handlePaste = useCallback(async () => {
    if (!activeCell) return;

    const text = await navigator.clipboard.readText();
    if (!text) return;

    const pastedRows = text.split('\n').map((row) => row.split('\t'));

    const startRowIdx = records.findIndex((r) => r.id === activeCell.rowId);
    const startColIdx = fields.findIndex((f) => f.id === activeCell.fieldId);

    if (startRowIdx === -1 || startColIdx === -1) return;

    let skippedCount = 0;

    for (let r = 0; r < pastedRows.length; r++) {
      const targetRowIdx = startRowIdx + r;
      if (targetRowIdx >= records.length) break;

      const record = records[targetRowIdx];
      if (!record) continue;

      const rowValues = pastedRows[r];
      if (!rowValues) continue;

      for (let c = 0; c < rowValues.length; c++) {
        const targetColIdx = startColIdx + c;
        if (targetColIdx >= fields.length) break;

        const field = fields[targetColIdx];
        if (!field) continue;

        if (field.readOnly) {
          skippedCount++;
          continue;
        }

        const cellText = rowValues[c] ?? '';
        const { value, skipped } = coerceToFieldType(cellText, field.fieldType);

        if (skipped) {
          skippedCount++;
          continue;
        }

        onUpdateCell(record.id, field.id, value);
      }
    }

    if (skippedCount > 0) {
      onShowToast(
        `${skippedCount} cell${skippedCount === 1 ? '' : 's'} skipped due to incompatible types`,
      );
    }
  }, [records, fields, activeCell, onUpdateCell, onShowToast]);

  // -----------------------------------------------------------------------
  // Fill Down — Cmd+D
  // -----------------------------------------------------------------------
  const handleFillDown = useCallback(() => {
    const bounds = resolveSelectionBounds(
      records,
      fields,
      activeCell,
      selectionAnchor,
      selectionRange,
    );
    if (!bounds) return;

    const { rowStart, rowEnd, colStart, colEnd } = bounds;

    // Nothing to fill if only one row is selected.
    if (rowStart === rowEnd) return;

    const sourceRecord = records[rowStart];
    if (!sourceRecord) return;

    for (let c = colStart; c <= colEnd; c++) {
      const field = fields[c];
      if (!field || field.readOnly) continue;

      const sourceValue = getCellValue(sourceRecord, field);

      for (let r = rowStart + 1; r <= rowEnd; r++) {
        const targetRecord = records[r];
        if (!targetRecord) continue;
        onUpdateCell(targetRecord.id, field.id, sourceValue);
      }
    }
  }, [records, fields, activeCell, selectionAnchor, selectionRange, onUpdateCell]);

  return { handleCopy, handlePaste, handleFillDown };
}
