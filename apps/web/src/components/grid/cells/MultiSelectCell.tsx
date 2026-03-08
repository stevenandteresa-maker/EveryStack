'use client';

/**
 * MultiSelectCell — display and edit components for multi_select field type.
 *
 * Display: Multiple pills with "+N" overflow badge.
 * Edit: Multi-select dropdown with checkmarks, search/filter.
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
import { PillBadge } from './PillBadge';
import { OverflowBadge } from './OverflowBadge';
import type { CellRendererProps } from '../GridCell';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SelectOption {
  value: string;
  label: string;
  color?: number;
}

function getOptions(field: CellRendererProps['field']): SelectOption[] {
  const config = field.config as Record<string, unknown> | null;
  const options = config?.options;
  if (!Array.isArray(options)) return [];
  return options as SelectOption[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return [];
}

/** Maximum pills to show before overflow badge */
const MAX_VISIBLE_PILLS = 3;

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export function MultiSelectCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const selected = toStringArray(value);

  if (selected.length === 0) return null;

  const options = getOptions(field);
  const visible = selected.slice(0, MAX_VISIBLE_PILLS);
  const overflowCount = selected.length - MAX_VISIBLE_PILLS;
  const overflowLabels = selected.slice(MAX_VISIBLE_PILLS).map((v) => {
    const opt = options.find((o) => o.value === v);
    return opt?.label ?? v;
  });

  return (
    <div className="flex w-full items-center gap-1 overflow-hidden">
      {visible.map((val) => {
        const option = options.find((o) => o.value === val);
        const label = option?.label ?? val;
        const colorIndex = option?.color ?? 0;
        const dataColor = getDataColor(colorIndex);

        return (
          <PillBadge
            key={val}
            text={label}
            bgColor={dataColor.light}
            textColor={getContrastText(dataColor.light)}
          />
        );
      })}
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
// Edit
// ---------------------------------------------------------------------------

export function MultiSelectCellEdit({ value, field, onSave, onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(toStringArray(value));
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

  function toggleOption(val: string) {
    const next = selected.includes(val)
      ? selected.filter((s) => s !== val)
      : [...selected, val];
    setSelected(next);
    onSave(next);
  }

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
          const isSelected = selected.includes(option.value);

          return (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50',
                isSelected && 'bg-slate-50',
              )}
              onClick={() => toggleOption(option.value)}
            >
              <span className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                isSelected ? 'border-slate-600 bg-slate-600 text-white' : 'border-slate-300',
              )}>
                {isSelected && <Check className="h-3 w-3" />}
              </span>
              <span
                className="inline-flex items-center truncate rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: dataColor.light,
                  color: getContrastText(dataColor.light),
                }}
              >
                {option.label}
              </span>
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
