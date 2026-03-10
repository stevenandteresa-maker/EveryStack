'use client';

/**
 * InlineSubTableRow — a single row in the Inline Sub-Table widget.
 *
 * Renders a linked record as a row of inline-editable cells.
 * Spreadsheet-like: click to edit, Tab moves right, Enter saves,
 * Escape reverts. Auto-save on blur.
 *
 * Reuses cell renderers from the grid in compact form.
 *
 * @see docs/reference/tables-and-views.md § Inline Sub-Table Display
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getCellRenderer } from '@/components/grid/GridCell';
import type { CellRendererProps } from '@/components/grid/GridCell';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Field, DbRecord } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface InlineSubTableRowProps {
  /** The linked record to render */
  record: DbRecord;
  /** Visible columns (fields from target table) */
  columns: Field[];
  /** Column widths */
  columnWidths: Record<string, number>;
  /** Whether inline delete is allowed */
  canDelete: boolean;
  /** Whether cells are editable */
  readOnly?: boolean;
  /** Called when a cell value changes */
  onCellEdit: (targetRecordId: string, fieldId: string, value: unknown) => void;
  /** Called when delete button is clicked */
  onDelete: (targetRecordId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineSubTableRow({
  record,
  columns,
  columnWidths,
  canDelete,
  readOnly = false,
  onCellEdit,
  onDelete,
}: InlineSubTableRowProps) {
  const t = useTranslations('record_view.inline_sub_table');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
  const rowRef = useRef<HTMLDivElement>(null);

  const canonicalData = record.canonicalData as Record<string, unknown> | null;

  const handleCellClick = useCallback(
    (fieldId: string) => {
      if (readOnly) return;
      setEditingFieldId(fieldId);
      // Initialize local value from canonical data
      setLocalValues((prev) => ({
        ...prev,
        [fieldId]: canonicalData?.[fieldId] ?? null,
      }));
    },
    [readOnly, canonicalData],
  );

  const handleSave = useCallback(
    (fieldId: string, value: unknown) => {
      onCellEdit(record.id, fieldId, value);
      setEditingFieldId(null);
      setLocalValues((prev) => {
        const next = { ...prev };
        delete next[fieldId];
        return next;
      });
    },
    [record.id, onCellEdit],
  );

  const handleCancel = useCallback(() => {
    setEditingFieldId(null);
    setLocalValues({});
  }, []);

  const handleBlur = useCallback(
    (fieldId: string) => {
      if (editingFieldId !== fieldId) return;
      const value = localValues[fieldId] ?? canonicalData?.[fieldId] ?? null;
      handleSave(fieldId, value);
    },
    [editingFieldId, localValues, canonicalData, handleSave],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, fieldId: string) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        // Save current cell
        const value = localValues[fieldId] ?? canonicalData?.[fieldId] ?? null;
        handleSave(fieldId, value);
        // Move to next column
        const currentIndex = columns.findIndex((c) => c.id === fieldId);
        const nextColumn = columns[currentIndex + 1];
        if (nextColumn) {
          handleCellClick(nextColumn.id);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const value = localValues[fieldId] ?? canonicalData?.[fieldId] ?? null;
        handleSave(fieldId, value);
      }
    },
    [columns, localValues, canonicalData, handleSave, handleCancel, handleCellClick],
  );

  return (
    <div
      ref={rowRef}
      className="flex items-center border-b border-border last:border-b-0 group"
      role="row"
    >
      {columns.map((column) => {
        const isEditing = editingFieldId === column.id;
        const value = isEditing
          ? (localValues[column.id] ?? canonicalData?.[column.id] ?? null)
          : (canonicalData?.[column.id] ?? null);

        const entry = getCellRenderer(column.fieldType);
        const DisplayComponent = entry?.DisplayComponent;
        const EditComponent = entry?.EditComponent;

        const rendererProps: CellRendererProps = {
          value,
          field: column,
          isEditing,
          onSave: (newValue) => handleSave(column.id, newValue),
          onCancel: handleCancel,
        };

        const ActiveComponent =
          isEditing && EditComponent ? EditComponent : DisplayComponent;

        return (
          <div
            key={column.id}
            className={cn(
              'flex items-center overflow-hidden px-2 py-1.5 text-sm shrink-0',
              'border-r border-border last:border-r-0',
              !readOnly && 'cursor-text',
              isEditing && 'ring-1 ring-inset ring-accent/40 z-10',
            )}
            style={{ width: columnWidths[column.id] ?? 150 }}
            role="gridcell"
            onClick={() => handleCellClick(column.id)}
            onBlur={() => handleBlur(column.id)}
            onKeyDown={(e) => handleKeyDown(e, column.id)}
            tabIndex={0}
          >
            {ActiveComponent ? (
              <ActiveComponent {...rendererProps} />
            ) : (
              <span className="truncate text-muted-foreground">
                {value != null ? String(value) : ''}
              </span>
            )}
          </div>
        );
      })}

      {/* Delete button */}
      {canDelete && (
        <div className="flex items-center px-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDelete(record.id)}
            aria-label={t('delete_row')}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreationRow — blank row at the bottom for inline record creation
// ---------------------------------------------------------------------------

export interface CreationRowProps {
  columns: Field[];
  columnWidths: Record<string, number>;
  data: Record<string, unknown>;
  onCellChange: (fieldId: string, value: unknown) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreationRow({
  columns,
  columnWidths,
  data,
  onCellChange,
  onConfirm,
  onCancel,
}: CreationRowProps) {
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const firstCellRef = useRef<HTMLDivElement>(null);

  // Focus first cell on mount
  useEffect(() => {
    firstCellRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, fieldId: string) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        // If all cells empty, cancel creation
        const hasData = Object.values(data).some(
          (v) => v != null && v !== '',
        );
        if (!hasData) {
          onCancel();
        } else {
          setActiveFieldId(null);
        }
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = columns.findIndex((c) => c.id === fieldId);
        const nextColumn = columns[currentIndex + 1];
        if (nextColumn) {
          setActiveFieldId(nextColumn.id);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        // On last column, confirm creation
        const currentIndex = columns.findIndex((c) => c.id === fieldId);
        if (currentIndex === columns.length - 1) {
          onConfirm();
        } else {
          // Move to next column
          const nextColumn = columns[currentIndex + 1];
          if (nextColumn) {
            setActiveFieldId(nextColumn.id);
          }
        }
      }
    },
    [columns, data, onConfirm, onCancel],
  );

  return (
    <div className="flex items-center border-b border-border border-dashed bg-muted/20" role="row">
      {columns.map((column, index) => {
        const isActive = activeFieldId === column.id;
        const value = data[column.id] ?? null;

        const entry = getCellRenderer(column.fieldType);
        const EditComponent = entry?.EditComponent;
        const DisplayComponent = entry?.DisplayComponent;

        const rendererProps: CellRendererProps = {
          value,
          field: column,
          isEditing: isActive,
          onSave: (newValue) => {
            onCellChange(column.id, newValue);
            setActiveFieldId(null);
          },
          onCancel: () => setActiveFieldId(null),
        };

        const ActiveComponent =
          isActive && EditComponent ? EditComponent : DisplayComponent;

        return (
          <div
            key={column.id}
            ref={index === 0 ? firstCellRef : undefined}
            className={cn(
              'flex items-center overflow-hidden px-2 py-1.5 text-sm cursor-text shrink-0',
              'border-r border-border last:border-r-0',
              isActive && 'ring-1 ring-inset ring-accent/40 z-10',
            )}
            style={{ width: columnWidths[column.id] ?? 150 }}
            role="gridcell"
            tabIndex={0}
            onClick={() => setActiveFieldId(column.id)}
            onKeyDown={(e) => handleKeyDown(e, column.id)}
          >
            {ActiveComponent ? (
              <ActiveComponent {...rendererProps} />
            ) : (
              <span className="truncate text-muted-foreground/50">
                {value != null ? String(value) : ''}
              </span>
            )}
          </div>
        );
      })}
      {/* Spacer for delete column alignment */}
      <div className="w-7 shrink-0" />
    </div>
  );
}
