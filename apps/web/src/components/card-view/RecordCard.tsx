'use client';

/**
 * RecordCard — unified card component for desktop + mobile.
 *
 * Displays record fields in configured order with inline editing.
 * Expand icon opens Record View overlay. Smart Doc fields show preview.
 * Variable height with internal scroll after 80vh.
 *
 * @see docs/reference/tables-and-views.md § RecordCard — Unified Component
 */

import { memo, useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Maximize2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCellRenderer, type CellRendererProps } from '@/components/grid/GridCell';
import type { GridField, GridRecord, CardLayout } from '@/lib/types/grid';
import { GRID_TOKENS } from '@/components/grid/grid-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordCardProps {
  record: GridRecord;
  fields: GridField[];
  layout: CardLayout;
  onExpandRecord: (recordId: string) => void;
  onSaveField: (recordId: string, fieldId: string, value: unknown) => void;
  /** Desktop: false (default). Phone (3H-i): true. */
  swipeActions?: boolean;
  /** Desktop: status only (default). Phone (3H-i): all badges. */
  badges?: 'status' | 'all';
}

// ---------------------------------------------------------------------------
// Smart Doc preview — first ~3 lines + "Expand"
// ---------------------------------------------------------------------------

const SMART_DOC_PREVIEW_LINES = 3;
const SMART_DOC_PREVIEW_CHARS = 200;

function SmartDocPreview({
  value,
  onExpand,
}: {
  value: unknown;
  onExpand: () => void;
}) {
  const t = useTranslations('card_view');

  if (!value) return null;

  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const lines = text.split('\n').slice(0, SMART_DOC_PREVIEW_LINES);
  const preview = lines.join('\n');
  const isTruncated =
    text.split('\n').length > SMART_DOC_PREVIEW_LINES ||
    text.length > SMART_DOC_PREVIEW_CHARS;

  return (
    <div className="space-y-1">
      <div className="flex items-start gap-1">
        <FileText
          className="mt-0.5 h-3 w-3 shrink-0 text-slate-400"
          aria-hidden="true"
        />
        <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">
          {preview.length > SMART_DOC_PREVIEW_CHARS
            ? `${preview.slice(0, SMART_DOC_PREVIEW_CHARS)}...`
            : preview}
        </p>
      </div>
      {isTruncated && (
        <button
          type="button"
          className="text-xs text-blue-600 hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          {t('expand')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card field row — renders a single field with inline editing
// ---------------------------------------------------------------------------

interface CardFieldRowProps {
  record: GridRecord;
  field: GridField;
  isCompact: boolean;
  onSave: (value: unknown) => void;
}

const CardFieldRow = memo(function CardFieldRow({
  record,
  field,
  isCompact,
  onSave,
}: CardFieldRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const cellRef = useRef<HTMLDivElement>(null);

  const value =
    (record.canonicalData as Record<string, unknown> | null)?.[field.id] ??
    null;

  const entry = getCellRenderer(field.fieldType);

  const handleSave = useCallback(
    (newValue: unknown) => {
      setIsEditing(false);
      onSave(newValue);
    },
    [onSave],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleClick = useCallback(() => {
    if (field.readOnly) return;
    setIsEditing(true);
  }, [field.readOnly]);

  const rendererProps: CellRendererProps = {
    value,
    field,
    isEditing,
    onSave: handleSave,
    onCancel: handleCancel,
  };

  const DisplayComponent = entry?.DisplayComponent;
  const EditComponent = entry?.EditComponent;

  return (
    <div
      ref={cellRef}
      className={cn(
        'group/field flex min-h-[28px] items-start gap-2',
        isCompact ? 'py-0.5' : 'py-1',
      )}
      onClick={!isEditing ? handleClick : undefined}
      role="button"
      tabIndex={isEditing ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !isEditing) {
          handleClick();
        }
      }}
    >
      {/* Field label */}
      <span
        className={cn(
          'shrink-0 text-xs font-medium',
          isCompact ? 'w-20' : 'w-28',
        )}
        style={{ color: GRID_TOKENS.textSecondary }}
      >
        {field.name}
      </span>

      {/* Field value */}
      <div className="min-w-0 flex-1 text-sm">
        {isEditing && EditComponent ? (
          <EditComponent {...rendererProps} />
        ) : DisplayComponent ? (
          <DisplayComponent {...rendererProps} />
        ) : (
          <span
            className="truncate text-sm"
            style={{ color: GRID_TOKENS.textPrimary }}
          >
            {value != null ? String(value) : ''}
          </span>
        )}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// RecordCard component
// ---------------------------------------------------------------------------

export const RecordCard = memo(function RecordCard({
  record,
  fields,
  layout,
  onExpandRecord,
  onSaveField,
  swipeActions: _swipeActions = false,
  badges: _badges = 'status',
}: RecordCardProps) {
  const t = useTranslations('card_view');
  const isCompact = layout === 'compact_list';

  // Primary field is always first
  const primaryField = fields.find((f) => f.isPrimary);
  const primaryValue = primaryField
    ? ((record.canonicalData as Record<string, unknown> | null)?.[
        primaryField.id
      ] ?? null)
    : null;
  const recordName = primaryValue != null ? String(primaryValue) : t('untitled');

  // Non-primary fields for display
  const displayFields = fields.filter((f) => !f.isPrimary);

  const handleSaveField = useCallback(
    (fieldId: string, value: unknown) => {
      onSaveField(record.id, fieldId, value);
    },
    [record.id, onSaveField],
  );

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-white transition-shadow hover:shadow-md',
        isCompact ? 'px-3 py-2' : 'px-4 py-3',
      )}
      style={{ borderColor: GRID_TOKENS.borderDefault }}
      data-testid="record-card"
      data-record-id={record.id}
      data-layout={layout}
    >
      {/* Expand icon — top-right on hover */}
      <button
        type="button"
        className={cn(
          'absolute right-2 top-2 flex h-6 w-6 items-center justify-center',
          'rounded opacity-0 transition-opacity hover:bg-slate-100',
          'group-hover:opacity-100 focus-visible:opacity-100',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onExpandRecord(record.id);
        }}
        aria-label={t('expand_record')}
      >
        <Maximize2 className="h-3.5 w-3.5 text-slate-500" />
      </button>

      {/* Record name (primary field) */}
      <div className={cn('pr-8', isCompact ? 'mb-1' : 'mb-2')}>
        <h3
          className={cn(
            'font-semibold leading-tight',
            isCompact ? 'text-sm' : 'text-base',
          )}
          style={{ color: GRID_TOKENS.textPrimary }}
        >
          {recordName}
        </h3>
      </div>

      {/* Fields */}
      <div
        className={cn('space-y-0', isCompact && 'max-h-[60vh]')}
        style={{ maxHeight: isCompact ? undefined : '80vh', overflowY: 'auto' }}
      >
        {displayFields.map((field) => {
          // Smart Doc fields get special preview treatment
          if (field.fieldType === 'smart_doc') {
            const docValue =
              (record.canonicalData as Record<string, unknown> | null)?.[
                field.id
              ] ?? null;
            return (
              <div key={field.id} className={cn('py-1', isCompact && 'py-0.5')}>
                <span
                  className={cn(
                    'mb-0.5 block text-xs font-medium',
                    isCompact ? 'w-20' : 'w-28',
                  )}
                  style={{ color: GRID_TOKENS.textSecondary }}
                >
                  {field.name}
                </span>
                <SmartDocPreview
                  value={docValue}
                  onExpand={() => onExpandRecord(record.id)}
                />
              </div>
            );
          }

          return (
            <CardFieldRow
              key={field.id}
              record={record}
              field={field}
              isCompact={isCompact}
              onSave={(value) => handleSaveField(field.id, value)}
            />
          );
        })}
      </div>
    </div>
  );
});
