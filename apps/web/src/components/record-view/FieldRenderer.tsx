'use client';

/**
 * FieldRenderer — renders a single field in the Record View canvas.
 *
 * Reuses cell renderers from the grid's cell-registry but adapts them
 * for the Record View context: larger display, no truncation, full value.
 * Inline editable via useCellEdit + useOptimisticRecord pattern.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getCellRenderer } from '@/components/grid/GridCell';
import type { CellRendererProps } from '@/components/grid/GridCell';
import { useCellEdit } from '@/lib/hooks/use-cell-edit';
import type { GridField, GridRecord } from '@/lib/types/grid';
import { Lock } from 'lucide-react';

// ---------------------------------------------------------------------------
// Field type icon map
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Aa',
  textarea: '¶',
  number: '#',
  date: '📅',
  datetime: '📅',
  checkbox: '☑',
  rating: '★',
  currency: '$',
  percent: '%',
  single_select: '▼',
  multi_select: '▤',
  people: '👤',
  linked_record: '🔗',
  attachment: '📎',
  url: '🌐',
  email: '✉',
  phone: '📞',
  smart_doc: '📝',
  barcode: '▮',
  checklist: '☐',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FieldRendererProps {
  field: GridField;
  record: GridRecord;
  onSave: (fieldId: string, value: unknown) => void;
  columnSpan?: number;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldRenderer({
  field,
  record,
  onSave,
  columnSpan = 1,
  readOnly = false,
}: FieldRendererProps) {
  const t = useTranslations('record_view');
  const canonicalData = record.canonicalData as Record<string, unknown> | null;
  const value = canonicalData?.[field.id] ?? null;

  const handleSave = useCallback(
    (newValue: unknown) => {
      onSave(field.id, newValue);
    },
    [field.id, onSave],
  );

  const handleCancel = useCallback(() => {
    // No-op: field stays as-is
  }, []);

  const cellEdit = useCellEdit({
    value,
    readOnly: readOnly || field.readOnly,
    onSave: handleSave,
    onCancel: handleCancel,
  });

  const entry = getCellRenderer(field.fieldType);
  const DisplayComponent = entry?.DisplayComponent;
  const EditComponent = entry?.EditComponent;
  const isEditable = !readOnly && !field.readOnly && EditComponent;

  const rendererProps: CellRendererProps = {
    value: cellEdit.isEditing ? cellEdit.localValue : value,
    field,
    isEditing: cellEdit.isEditing,
    onSave: (newValue) => {
      cellEdit.setLocalValue(newValue);
      cellEdit.save();
    },
    onCancel: cellEdit.cancel,
  };

  const ActiveComponent = cellEdit.isEditing && EditComponent
    ? EditComponent
    : DisplayComponent;

  const typeIcon = FIELD_TYPE_LABELS[field.fieldType] ?? '·';

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-md border border-transparent px-3 py-2',
        'hover:border-border transition-colors',
        cellEdit.isEditing && 'border-border ring-2 ring-accent/30',
      )}
      style={{
        gridColumn: `span ${columnSpan} / span ${columnSpan}`,
      }}
    >
      {/* Field label */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ opacity: 0.5 }}>
          {typeIcon}
        </span>
        <span className="text-xs font-medium text-muted-foreground truncate">
          {field.name}
        </span>
        {(readOnly || field.readOnly) && (
          <Lock className="h-3 w-3 text-muted-foreground" aria-label={t('field_read_only')} />
        )}
      </div>

      {/* Field value */}
      <div
        className={cn(
          'min-h-[28px] text-sm',
          isEditable && 'cursor-text',
        )}
        onClick={isEditable ? cellEdit.startEdit : undefined}
        onKeyDown={cellEdit.isEditing ? cellEdit.handleKeyDown : undefined}
        onBlur={cellEdit.isEditing ? cellEdit.handleBlur : undefined}
        role={isEditable ? 'button' : undefined}
        tabIndex={isEditable ? 0 : undefined}
      >
        {ActiveComponent ? (
          <ActiveComponent {...rendererProps} />
        ) : (
          <span className="text-muted-foreground">
            {value != null ? String(value) : ''}
          </span>
        )}
      </div>
    </div>
  );
}
