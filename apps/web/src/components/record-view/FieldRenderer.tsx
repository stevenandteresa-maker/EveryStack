'use client';

/**
 * FieldRenderer — renders a single field in the Record View canvas.
 *
 * Reuses cell renderers from the grid's cell-registry but adapts them
 * for the Record View context: larger display, no truncation, full value.
 * Inline editable via useCellEdit + useOptimisticRecord pattern.
 *
 * For linked_record fields, renders LinkedRecordPills (pills display) or
 * InlineSubTable (inline_table display) depending on the field's display config.
 *
 * @see docs/reference/tables-and-views.md § Record View
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { getCellRenderer } from '@/components/grid/GridCell';
import type { CellRendererProps } from '@/components/grid/GridCell';
import { useCellEdit } from '@/lib/hooks/use-cell-edit';
import { type LinkedRecordPill } from './LinkedRecordPills';
import { LinkedRecordChip } from '@/components/cross-links/linked-record-chip';
import { useLinkPicker } from '@/components/cross-links/use-link-picker';
import { InlineSubTable } from './InlineSubTable';
import type { InlineSubTableConfig } from './use-inline-sub-table';
import type { GridField, GridRecord } from '@/lib/types/grid';
import type { DbRecord, Field } from '@everystack/shared/db';
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
  /** Inline sub-table data for linked_record fields with inline_table display */
  inlineSubTableData?: {
    linkedRecords: DbRecord[];
    targetFields: Field[];
    canCreate: boolean;
    canDelete: boolean;
    onUpdateLinkedRecord?: (
      targetRecordId: string,
      fieldId: string,
      value: unknown,
    ) => void;
    onCreateRecord?: (canonicalData: Record<string, unknown>) => void;
    onDeleteLink?: (targetRecordId: string) => void;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts linked record pills from a linked_record field value.
 * Supports both cross_link format and legacy array format.
 */
function extractLinkedRecordPills(value: unknown): LinkedRecordPill[] {
  // Cross-link canonical format
  if (
    value != null &&
    typeof value === 'object' &&
    'type' in value &&
    (value as Record<string, unknown>).type === 'cross_link'
  ) {
    const clValue = value as unknown as {
      value: {
        linked_records: Array<{
          record_id: string;
          display_value: string;
          _display_updated_at?: string;
        }>;
        cross_link_id: string;
      };
    };
    return clValue.value.linked_records.map((entry) => ({
      recordId: entry.record_id,
      displayValue: entry.display_value || entry.record_id,
    }));
  }

  // Legacy array format
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

/**
 * Extracts cross_link_id from a cross-link field value or field config.
 */
function extractCrossLinkId(
  value: unknown,
  field: GridField,
): string | null {
  // From canonical cross-link value
  if (
    value != null &&
    typeof value === 'object' &&
    'type' in value &&
    (value as Record<string, unknown>).type === 'cross_link'
  ) {
    return (value as unknown as { value: { cross_link_id: string } }).value.cross_link_id ?? null;
  }
  // From field config
  const config = field.config as Record<string, unknown> | null;
  return (config?.crossLinkId as string) ?? null;
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
  inlineSubTableData,
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

  // Linked record fields render pills or inline sub-table
  const isLinkedRecord = field.fieldType === 'linked_record';
  const displayConfig = field.display as Record<string, unknown> | null;
  const isInlineTable =
    isLinkedRecord && displayConfig?.style === 'inline_table';

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
      {isInlineTable && inlineSubTableData ? (
        <InlineSubTable
          fieldName={field.name}
          recordId={record.id}
          fieldId={field.id}
          config={displayConfig as unknown as InlineSubTableConfig}
          linkedRecords={inlineSubTableData.linkedRecords}
          targetFields={inlineSubTableData.targetFields}
          canCreate={inlineSubTableData.canCreate}
          canDelete={inlineSubTableData.canDelete}
          readOnly={readOnly}
          onUpdateLinkedRecord={inlineSubTableData.onUpdateLinkedRecord}
          onCreateRecord={inlineSubTableData.onCreateRecord}
          onDeleteLink={inlineSubTableData.onDeleteLink}
        />
      ) : isLinkedRecord && onNavigateToLinkedRecord ? (
        <LinkedRecordFieldValue
          value={value}
          field={field}
          record={record}
          readOnly={readOnly}
          onNavigateToLinkedRecord={onNavigateToLinkedRecord}
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

// ---------------------------------------------------------------------------
// LinkedRecordFieldValue — renders linked records with chips + Link Picker add
// ---------------------------------------------------------------------------

interface LinkedRecordFieldValueProps {
  value: unknown;
  field: GridField;
  record: GridRecord;
  readOnly: boolean;
  onNavigateToLinkedRecord: (recordId: string) => void;
}

function LinkedRecordFieldValue({
  value,
  field,
  record,
  readOnly,
  onNavigateToLinkedRecord,
}: LinkedRecordFieldValueProps) {
  const t = useTranslations('record_view');
  const picker = useLinkPicker();

  const pills = extractLinkedRecordPills(value);
  const crossLinkId = extractCrossLinkId(value, field);

  const handleAddClick = useCallback(() => {
    if (!crossLinkId) return;
    picker.open(crossLinkId, record.id);
  }, [crossLinkId, record.id, picker]);

  const handleRemove = useCallback(
    (recordId: string) => {
      if (!crossLinkId) return;
      picker.remove(recordId);
    },
    [crossLinkId, picker],
  );

  const isEditable = !readOnly && !field.readOnly;

  if (pills.length === 0 && !isEditable) {
    return (
      <span className="text-sm text-muted-foreground">
        {t('no_linked_records')}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="list" aria-label={t('linked_records_label')}>
      {pills.map((pill) => (
        <LinkedRecordChip
          key={pill.recordId}
          recordId={pill.recordId}
          displayValue={pill.displayValue}
          editable={isEditable}
          onNavigate={onNavigateToLinkedRecord}
          onRemove={isEditable ? handleRemove : undefined}
        />
      ))}
      {isEditable && crossLinkId && (
        <button
          type="button"
          onClick={handleAddClick}
          className="flex h-6 items-center gap-1 rounded-md border border-dashed border-muted-foreground/30 px-2 text-xs text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label={t('add_linked_record')}
        >
          + {t('add_link')}
        </button>
      )}
    </div>
  );
}
