'use client';

/**
 * NumberCell — display and edit components for number field type.
 *
 * Display: Formatted number (locale-aware via Intl.NumberFormat).
 * Edit: Number input with type validation.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

function formatNumber(value: unknown): string {
  if (value == null) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  return new Intl.NumberFormat().format(num);
}

export function NumberCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const formatted = formatNumber(value);

  return (
    <div className="flex w-full items-center justify-end gap-1">
      <span className="truncate text-sm tabular-nums">{formatted}</span>
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function NumberCellEdit({ value, onSave, onCancel }: CellRendererProps) {
  const [localValue, setLocalValue] = useState(
    value != null ? String(value) : '',
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (localValue === '') {
      onSave(null);
      return;
    }
    const num = Number(localValue);
    onSave(Number.isNaN(num) ? null : num);
  };

  return (
    <input
      ref={inputRef}
      type="number"
      className={cn(
        'h-full w-full bg-transparent text-sm text-right outline-none tabular-nums',
        'px-0 py-0',
      )}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
