'use client';

/**
 * TextCell — display and edit components for text / textarea field types.
 *
 * Display: Renders text value, truncated with ellipsis.
 * Edit: Text input filling cell, auto-focused on mount.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

export function TextCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const text = value != null ? String(value) : '';

  return (
    <div className="flex w-full items-center gap-1">
      <span className="truncate text-sm">{text}</span>
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function TextCellEdit({ value, onSave, onCancel }: CellRendererProps) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      className={cn(
        'h-full w-full bg-transparent text-sm outline-none',
        'px-0 py-0',
      )}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onSave(localValue)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(localValue);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
