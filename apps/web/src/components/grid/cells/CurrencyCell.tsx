'use client';

/**
 * CurrencyCell — display and edit components for currency field type.
 *
 * Display: Formatted with currency symbol from field.config.currency (e.g., "$1,250.00").
 * Edit: Number input with currency symbol prefix.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

function getCurrencyCode(field: CellRendererProps['field']): string {
  const config = field.config as Record<string, unknown> | null;
  const currency = config?.currency;
  if (typeof currency === 'string' && currency.length > 0) return currency;
  return 'USD';
}

function getCurrencySymbol(currencyCode: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).formatToParts(0);
    const symbolPart = parts.find((p) => p.type === 'currency');
    return symbolPart?.value ?? currencyCode;
  } catch {
    return currencyCode;
  }
}

function formatCurrency(value: unknown, currencyCode: string): string {
  if (value == null) return '';
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(num);
  } catch {
    return String(num);
  }
}

export function CurrencyCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const currencyCode = getCurrencyCode(field);
  const formatted = formatCurrency(value, currencyCode);

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

export function CurrencyCellEdit({ value, field, onSave, onCancel }: CellRendererProps) {
  const currencyCode = getCurrencyCode(field);
  const symbol = getCurrencySymbol(currencyCode);
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
    <div className="flex h-full w-full items-center gap-1">
      <span className="shrink-0 text-sm text-slate-500">{symbol}</span>
      <input
        ref={inputRef}
        type="number"
        step="0.01"
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
    </div>
  );
}
