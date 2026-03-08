'use client';

/**
 * EmailCell — display and edit components for email field type.
 *
 * Display: Clickable mailto link (blue text).
 * Edit: Text input with email validation.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

export function EmailCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const email = value != null ? String(value) : '';

  if (!email) return null;

  return (
    <div className="flex w-full items-center gap-1">
      <a
        href={`mailto:${email}`}
        className="truncate text-sm text-blue-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('email_send', { email })}
      >
        {email}
      </a>
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function EmailCellEdit({ value, onSave, onCancel }: CellRendererProps) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="email"
      className={cn(
        'h-full w-full bg-transparent text-sm outline-none',
        'px-0 py-0',
      )}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={() => onSave(localValue || null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSave(localValue || null);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    />
  );
}
