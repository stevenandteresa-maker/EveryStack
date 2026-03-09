'use client';

/**
 * PhoneCell — display and edit components for phone field type.
 *
 * Display: Formatted phone number + phone icon.
 * Edit: Text input on desktop.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Phone, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

export function PhoneCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const phone = value != null ? String(value) : '';

  if (!phone) return null;

  return (
    <div className="flex w-full items-center gap-1">
      <Phone className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
      <a
        href={`tel:${phone}`}
        className="truncate text-sm text-slate-700 hover:underline"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('phone_call', { phone })}
      >
        {phone}
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

export function PhoneCellEdit({ value, onSave, onCancel }: CellRendererProps) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="tel"
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
