'use client';

/**
 * PercentCell — display and edit components for percent field type.
 *
 * Display: Inline progress bar filling cell background with value text overlaid (e.g., "75%").
 * Edit: Number input (0–100).
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

export function PercentCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  if (value == null) {
    return field.readOnly ? (
      <Lock
        className="h-3 w-3 text-slate-400"
        aria-label={t('read_only')}
      />
    ) : null;
  }

  const num = Number(value);
  if (Number.isNaN(num)) return null;

  const clamped = Math.min(Math.max(0, num), 100);

  return (
    <div className="relative flex h-full w-full items-center">
      {/* Progress bar fill */}
      <div
        className="absolute inset-0 bg-blue-100 transition-all"
        style={{ width: `${clamped}%` }}
        aria-hidden="true"
      />
      {/* Value text overlaid */}
      <span className="relative z-10 w-full text-sm tabular-nums text-center">
        {t('percent_value', { value: Math.round(num) })}
      </span>
      {field.readOnly && (
        <Lock
          className="relative z-10 ml-1 h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function PercentCellEdit({ value, onSave, onCancel }: CellRendererProps) {
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
      min={0}
      max={100}
      className={cn(
        'h-full w-full bg-transparent text-sm text-center outline-none tabular-nums',
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
