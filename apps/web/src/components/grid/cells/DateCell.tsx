'use client';

/**
 * DateCell — display and edit components for date / datetime field types.
 *
 * Display: Formatted date (e.g., "Feb 9, 2026" — locale-aware).
 * Edit: Native date input. Full date picker (shadcn Calendar + Popover) deferred.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

function formatDate(value: unknown, includeTime: boolean): string {
  if (value == null) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  if (includeTime) {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function toInputValue(value: unknown, includeTime: boolean): string {
  if (value == null) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  if (includeTime) {
    // yyyy-MM-ddTHH:mm format for datetime-local input
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  return date.toISOString().split('T')[0] ?? '';
}

export function DateCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const includeTime = field.fieldType === 'datetime';
  const formatted = formatDate(value, includeTime);

  return (
    <div className="flex w-full items-center gap-1">
      <span className="truncate text-sm">{formatted}</span>
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function DateCellEdit({ value, field, onSave, onCancel }: CellRendererProps) {
  const includeTime = field.fieldType === 'datetime';
  const [localValue, setLocalValue] = useState(toInputValue(value, includeTime));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (localValue === '') {
      onSave(null);
      return;
    }
    onSave(new Date(localValue).toISOString());
  };

  return (
    <input
      ref={inputRef}
      type={includeTime ? 'datetime-local' : 'date'}
      className={cn(
        'h-full w-full bg-transparent text-sm outline-none',
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
