'use client';

/**
 * GridHeader — renders column headers with field type icon, name, and
 * sort/filter indicator placeholders.
 *
 * @see docs/reference/tables-and-views.md § Column Behavior
 */

import { memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Header } from '@tanstack/react-table';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { GRID_TOKENS, CHECKBOX_COLUMN_WIDTH, ROW_NUMBER_WIDTH, DRAG_HANDLE_WIDTH } from './grid-types';
import type { GridRecord, GridField } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Field type icon map (simple text abbreviations — can be replaced with SVGs)
// ---------------------------------------------------------------------------

const FIELD_TYPE_ICONS: Record<string, string> = {
  text: 'Aa',
  textarea: 'Aa',
  number: '#',
  currency: '$',
  percent: '%',
  date: 'D',
  datetime: 'DT',
  checkbox: '☑',
  rating: '★',
  single_select: '▾',
  multi_select: '▾▾',
  people: '👤',
  phone: '📞',
  email: '@',
  url: '🔗',
  attachment: '📎',
  linked_record: '↗',
  smart_doc: '📄',
  barcode: '|||',
  duration: '⏱',
};

function getFieldTypeIcon(fieldType: string): string {
  return FIELD_TYPE_ICONS[fieldType] ?? '?';
}

// ---------------------------------------------------------------------------
// GridHeader component
// ---------------------------------------------------------------------------

export interface GridHeaderProps {
  headers: Header<GridRecord, unknown>[];
  fields: GridField[];
  frozenFieldIds: string[];
  showAddColumn: boolean;
  addColumnWidth: number;
  onSelectColumn: (fieldId: string) => void;
}

export const GridHeader = memo(function GridHeader({
  headers,
  fields,
  frozenFieldIds,
  showAddColumn,
  addColumnWidth,
  onSelectColumn,
}: GridHeaderProps) {
  const t = useTranslations('grid');

  return (
    <div
      className="sticky top-0 z-20 flex"
      role="row"
      style={{ backgroundColor: GRID_TOKENS.panelBg }}
    >
      {/* Drag handle spacer */}
      <div
        className="shrink-0 border-r border-b"
        style={{
          width: DRAG_HANDLE_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      />

      {/* Checkbox header */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b"
        style={{
          width: CHECKBOX_COLUMN_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
        }}
      >
        <Checkbox aria-label={t('checkbox_select_all')} />
      </div>

      {/* Row number header */}
      <div
        className="shrink-0 flex items-center justify-center border-r border-b text-xs font-medium"
        style={{
          width: ROW_NUMBER_WIDTH,
          borderColor: GRID_TOKENS.borderDefault,
          color: GRID_TOKENS.textSecondary,
        }}
      >
        #
      </div>

      {/* Data column headers */}
      {headers.map((header) => {
        const field = fields.find((f) => f.id === header.column.id);
        if (!field) return null;

        const isFrozen = frozenFieldIds.includes(field.id);

        return (
          <ColumnHeader
            key={header.id}
            field={field}
            width={header.getSize()}
            isFrozen={isFrozen}
            onSelect={() => onSelectColumn(field.id)}
          />
        );
      })}

      {/* "+" column header */}
      {showAddColumn && (
        <div
          className="shrink-0 flex items-center justify-center border-r border-b text-xs"
          style={{
            width: addColumnWidth,
            borderColor: GRID_TOKENS.borderDefault,
            color: GRID_TOKENS.textSecondary,
          }}
        >
          <button
            className="flex h-full w-full items-center justify-center hover:bg-slate-200 transition-colors"
            aria-label={t('add_field')}
            type="button"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Individual column header
// ---------------------------------------------------------------------------

interface ColumnHeaderProps {
  field: GridField;
  width: number;
  isFrozen: boolean;
  onSelect: () => void;
}

const ColumnHeader = memo(function ColumnHeader({
  field,
  width,
  isFrozen,
  onSelect,
}: ColumnHeaderProps) {
  const t = useTranslations('grid');

  const handleClick = useCallback(() => {
    onSelect();
  }, [onSelect]);

  return (
    <div
      role="columnheader"
      className={cn(
        'shrink-0 flex items-center gap-1.5 px-3 py-2 border-r border-b',
        'text-xs font-medium select-none cursor-pointer',
        'hover:bg-slate-200 transition-colors',
        isFrozen && 'sticky z-10',
      )}
      style={{
        width,
        borderColor: GRID_TOKENS.borderDefault,
        color: GRID_TOKENS.textSecondary,
      }}
      onClick={handleClick}
      aria-label={t('header_select_column', { name: field.name })}
    >
      <span className="shrink-0 text-[10px] font-mono opacity-60">
        {getFieldTypeIcon(field.fieldType)}
      </span>
      <span className="truncate">{field.name}</span>
    </div>
  );
});
