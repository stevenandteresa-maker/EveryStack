'use client';

/**
 * UrlCell — display and edit components for URL field type.
 *
 * Display: Clickable link (blue text), external link icon on hover. Opens in new tab.
 * Edit: Text input with auto-focus.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CellRendererProps } from '../GridCell';

export function UrlCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const url = value != null ? String(value) : '';

  if (!url) return null;

  return (
    <div className="group flex w-full items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate text-sm text-blue-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
        aria-label={t('url_open', { url })}
      >
        {url}
      </a>
      <ExternalLink
        className="h-3 w-3 shrink-0 text-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function UrlCellEdit({ value, onSave, onCancel }: CellRendererProps) {
  const [localValue, setLocalValue] = useState(value != null ? String(value) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      type="url"
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
