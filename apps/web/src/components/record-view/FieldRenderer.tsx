'use client';

/**
 * FieldRenderer — renders a single field in the Record View canvas.
 *
 * Reuses cell renderers from the grid's cell-registry but adapts them
 * for the Record View context: larger display, no truncation, full value.
 * Inline editable via useCellEdit + useOptimisticRecord pattern.
 *
 * For linked_record fields, renders LinkedRecordPills instead of the
 * standard cell renderer.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getCellRenderer } from '@/components/grid/GridCell';
import type { CellRendererProps } from '@/components/grid/GridCell';
import { useCellEdit } from '@/lib/hooks/use-cell-edit';
import {
  LinkedRecordPills,
  type LinkedRecordPill,
} from './LinkedRecordPills';
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
  onNavigateToLinkedRecord?: (recordId: string) => void;
  onTab?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts linked record pills from a linked_record field value.
 * The canonical value can be an array of { id, displayValue } objects
 * or an array of record IDs (strings).
 */
function extractLinkedRecordPills(value: unknown): LinkedRecordPill[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): LinkedRecordPill | null => {
      if (typeof item === 'string') {
        return { recordId: item, displayValue: item };
      }
      if (
        item &&
        typeof item === 'object' &&
        'id' in item &&
        typeof (item as Record<string, unknown>).id === 'string'
      ) {
        const obj = item as Record<string, unknown>;
        return {
          recordId: obj.id as string,
          displayValue:
            typeof obj.displayValue === 'string'
              ? obj.displayValue
              : typeof obj.name === 'string'
                ? obj.name
                : (obj.id as string),
        };
      }
      return null;
    })
    .filter((p): p is LinkedRecordPill => p !== null);
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
  onNavigateToLinkedRecord,
  onTab,
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
    onMoveRight: onTab,
  });

  // Linked record fields render pills instead of standard cell renderer
  const isLinkedRecord = field.fieldType === 'linked_record';

  const entry = getCellRenderer(field.fieldType);
  const DisplayComponent = entry?.DisplayComponent;
  const EditComponent = entry?.EditComponent;
  const isEditable = !readOnly && !field.readOnly && EditComponent && !isLinkedRecord;

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
      {isLinkedRecord && onNavigateToLinkedRecord ? (
        <LinkedRecordPills
          pills={extractLinkedRecordPills(value)}
          onNavigateToRecord={onNavigateToLinkedRecord}
        />
      ) : (
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
      )}
    </div>
  );
}
