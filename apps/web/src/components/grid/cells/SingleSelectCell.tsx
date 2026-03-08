'use client';

/**
 * SingleSelectCell — display and edit components for single_select field type.
 *
 * Display: Configurable style — colored pill (default), full block, dot+text, or plain text.
 * Edit: Dropdown with search/filter, click to select.
 * Colors from the 13-color data palette.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 * @see docs/reference/design-system.md § Data Color Palette
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDataColor, getContrastText } from '@/lib/design-system/colors';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Types for select option config
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
  color?: number; // Index into data palette
}

function getOptions(field: CellRendererProps['field']): SelectOption[] {
  const config = field.config as Record<string, unknown> | null;
  const options = config?.options;
  if (!Array.isArray(options)) return [];
  return options as SelectOption[];
}

type DisplayStyle = 'pill' | 'block' | 'dot' | 'plain';

function getDisplayStyle(field: CellRendererProps['field']): DisplayStyle {
  const display = field.display as Record<string, unknown> | null;
  const style = display?.style;
  if (style === 'block' || style === 'dot' || style === 'plain') return style;
  return 'pill';
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function SingleSelectCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');

  if (value == null || value === '') {
    return null;
  }

  const options = getOptions(field);
  const selectedValue = String(value);
  const option = options.find((o) => o.value === selectedValue);
  const label = option?.label ?? selectedValue;
  const colorIndex = option?.color ?? 0;
  const dataColor = getDataColor(colorIndex);
  const displayStyle = getDisplayStyle(field);

  return (
    <div className="flex w-full items-center gap-1">
      {displayStyle === 'pill' && (
        <span
          className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: dataColor.light,
            color: getContrastText(dataColor.light),
          }}
        >
          {label}
        </span>
      )}
      {displayStyle === 'block' && (
        <span
          className="flex w-full items-center truncate rounded px-2 py-0.5 text-xs font-medium"
          style={{
            backgroundColor: dataColor.light,
            color: getContrastText(dataColor.light),
          }}
        >
          {label}
        </span>
      )}
      {displayStyle === 'dot' && (
        <span className="flex items-center gap-1.5 truncate text-sm">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: dataColor.saturated }}
          />
          <span className="truncate">{label}</span>
        </span>
      )}
      {displayStyle === 'plain' && (
        <span className="truncate text-sm">{label}</span>
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
// Edit
// ---------------------------------------------------------------------------

export function SingleSelectCellEdit({ value, field, onSave, onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const options = getOptions(field);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  const selectedValue = value != null ? String(value) : '';

  return (
    <div className="absolute left-0 top-full z-50 mt-0.5 min-w-[200px] rounded-md border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center gap-1 border-b border-slate-100 px-2 py-1.5">
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          placeholder={t('select_search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancel();
            }
          }}
        />
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filteredOptions.map((option) => {
          const colorIndex = option.color ?? 0;
          const dataColor = getDataColor(colorIndex);
          const isSelected = option.value === selectedValue;

          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50',
                isSelected && 'bg-slate-50',
              )}
              onClick={() => onSave(option.value)}
            >
              <span
                className="inline-flex items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: dataColor.light,
                  color: getContrastText(dataColor.light),
                }}
              >
                {option.label}
              </span>
              {isSelected && <Check className="ml-auto h-3.5 w-3.5 text-slate-600" />}
            </button>
          );
        })}
        {filteredOptions.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-slate-400">{t('select_no_results')}</div>
        )}
      </div>
    </div>
  );
}
