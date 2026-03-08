'use client';

/**
 * BarcodeCell — display and edit components for barcode field type.
 *
 * Display: Value as text + barcode icon (QR code icon from lucide-react).
 * Edit: Text input. Paste-friendly for USB barcode scanners.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { QrCode, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

export function BarcodeCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const text = value != null ? String(value) : '';

  if (!text) return null;

  return (
    <div className="flex w-full items-center gap-1">
      <QrCode className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
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

export function BarcodeCellEdit({ value, onSave, onCancel }: CellRendererProps) {
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
