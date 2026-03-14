'use client';

/**
 * LinkedRecordCell — display and edit components for linked_record field type.
 *
 * Display: LinkedRecordChip components showing display values. Overflow as "+N".
 * Edit: Opens Link Picker via useLinkPicker().open().
 *
 * @see docs/reference/cross-linking.md § Cross-Link Field Value
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { LinkedRecordChip } from '@/components/cross-links/linked-record-chip';
import { OverflowBadge } from './OverflowBadge';
import { useLinkPicker } from '@/components/cross-links/use-link-picker';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkedRecordEntry {
  record_id: string;
  table_id: string;
  display_value: string;
  _display_updated_at?: string;
}

interface CrossLinkFieldValue {
  type: 'cross_link';
  value: {
    linked_records: LinkedRecordEntry[];
    cross_link_id: string;
  };
}

function toCrossLinkValue(value: unknown): CrossLinkFieldValue | null {
  if (
    value != null &&
    typeof value === 'object' &&
    'type' in value &&
    (value as Record<string, unknown>).type === 'cross_link'
  ) {
    return value as CrossLinkFieldValue;
  }
  return null;
}

/** Legacy format fallback */
interface LegacyLinkedRecordValue {
  id: string;
  primaryFieldValue?: string;
}

function toLegacyRecords(value: unknown): LegacyLinkedRecordValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is LegacyLinkedRecordValue =>
      v != null && typeof v === 'object' && 'id' in v,
  );
}

/** Maximum visible chips before overflow */
const MAX_VISIBLE = 3;

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function LinkedRecordCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');

  // Check if this field uses inline_table display style
  const displayConfig = field.display as Record<string, unknown> | null;
  const isInlineTable = displayConfig?.style === 'inline_table';

  // Try cross_link format first
  const crossLinkValue = toCrossLinkValue(value);

  if (crossLinkValue) {
    const entries = crossLinkValue.value.linked_records;
    if (entries.length === 0) return null;

    if (isInlineTable) {
      return (
        <div className="flex w-full items-center gap-1 overflow-hidden">
          <span className="text-sm text-muted-foreground">
            {t('linked_record_items', { count: entries.length })}
          </span>
          {field.readOnly && (
            <Lock
              className="h-3 w-3 shrink-0 text-slate-400"
              aria-label={t('read_only')}
            />
          )}
        </div>
      );
    }

    const visible = entries.slice(0, MAX_VISIBLE);
    const overflowCount = entries.length - MAX_VISIBLE;
    const overflowLabels = entries
      .slice(MAX_VISIBLE)
      .map((e) => e.display_value || e.record_id);

    return (
      <div className="flex w-full items-center gap-1 overflow-hidden" role="list">
        {visible.map((entry) => (
          <LinkedRecordChip
            key={entry.record_id}
            recordId={entry.record_id}
            displayValue={entry.display_value || entry.record_id}
            displayUpdatedAt={entry._display_updated_at}
          />
        ))}
        {overflowCount > 0 && (
          <OverflowBadge count={overflowCount} labels={overflowLabels} />
        )}
        {field.readOnly && (
          <Lock
            className="h-3 w-3 shrink-0 text-slate-400"
            aria-label={t('read_only')}
          />
        )}
      </div>
    );
  }

  // Legacy array format fallback
  const records = toLegacyRecords(value);
  if (records.length === 0) return null;

  if (isInlineTable) {
    return (
      <div className="flex w-full items-center gap-1 overflow-hidden">
        <span className="text-sm text-muted-foreground">
          {t('linked_record_items', { count: records.length })}
        </span>
        {field.readOnly && (
          <Lock
            className="h-3 w-3 shrink-0 text-slate-400"
            aria-label={t('read_only')}
          />
        )}
      </div>
    );
  }

  const visible = records.slice(0, MAX_VISIBLE);
  const overflowCount = records.length - MAX_VISIBLE;
  const overflowLabels = records
    .slice(MAX_VISIBLE)
    .map((r) => r.primaryFieldValue ?? r.id);

  return (
    <div className="flex w-full items-center gap-1 overflow-hidden" role="list">
      {visible.map((record) => (
        <LinkedRecordChip
          key={record.id}
          recordId={record.id}
          displayValue={record.primaryFieldValue ?? record.id}
        />
      ))}
      {overflowCount > 0 && (
        <OverflowBadge count={overflowCount} labels={overflowLabels} />
      )}
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit — Opens Link Picker
// ---------------------------------------------------------------------------

export function LinkedRecordCellEdit({ value, field, onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const picker = useLinkPicker();

  // Extract cross_link_id and determine mode from the field value
  const crossLinkValue = toCrossLinkValue(value);
  const crossLinkId = crossLinkValue?.value.cross_link_id ?? (field.config as Record<string, unknown> | null)?.crossLinkId as string | undefined;

  const handleOpenPicker = useCallback(() => {
    if (!crossLinkId) return;
    // Use field.recordId if available from context, otherwise the picker
    // needs to be opened from the cell's parent context
    const recordId = (field as Record<string, unknown>).recordId as string | undefined;
    if (recordId) {
      picker.open(crossLinkId, recordId);
    }
    onCancel();
  }, [crossLinkId, field, picker, onCancel]);

  // If we have a cross-link ID, open the picker directly
  if (crossLinkId) {
    handleOpenPicker();
    return null;
  }

  // Fallback: show placeholder
  return (
    <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[200px] rounded-md border border-slate-200 bg-white p-3 shadow-lg">
      <p className="text-sm text-slate-500">{t('linked_record_placeholder')}</p>
      <button
        type="button"
        className="mt-2 text-xs text-slate-400 hover:text-slate-600"
        onClick={onCancel}
      >
        {t('linked_record_close')}
      </button>
    </div>
  );
}
