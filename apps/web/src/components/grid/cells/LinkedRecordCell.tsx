'use client';

/**
 * LinkedRecordCell — display and edit components for linked_record field type.
 *
 * Display: Clickable pills showing primary field value of linked records.
 * Overflow as "+N" badge.
 *
 * Edit: Placeholder — Link Picker ships in Phase 3B-i.
 * Click on a pill is a no-op for now (navigation ships with Record View in 3A-ii).
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { PillBadge } from './PillBadge';
import { OverflowBadge } from './OverflowBadge';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LinkedRecordValue {
  id: string;
  primaryFieldValue?: string;
}

function toLinkedRecords(value: unknown): LinkedRecordValue[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is LinkedRecordValue =>
      v != null && typeof v === 'object' && 'id' in v,
  );
}

/** Maximum visible pills before overflow */
const MAX_VISIBLE = 3;

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function LinkedRecordCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const records = toLinkedRecords(value);

  // Check if this field uses inline_table display style
  const displayConfig = field.display as Record<string, unknown> | null;
  const isInlineTable = displayConfig?.style === 'inline_table';

  if (records.length === 0) return null;

  // Inline table style: show compact "N items" summary
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
    <div className="flex w-full items-center gap-1 overflow-hidden">
      {visible.map((record) => (
        <PillBadge
          key={record.id}
          text={record.primaryFieldValue ?? record.id}
          bgColor="#FFFFFF"
          textColor="#0F172A"
          className="border border-slate-200"
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
// Edit (Placeholder — Link Picker deferred to Phase 3B-i)
// ---------------------------------------------------------------------------

export function LinkedRecordCellEdit({ onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');

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
