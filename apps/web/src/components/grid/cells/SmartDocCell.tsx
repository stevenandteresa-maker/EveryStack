'use client';

/**
 * SmartDocCell — display-only component for smart_doc field type.
 *
 * Display: Badge indicating "Doc" content exists when value is truthy. Empty if no content.
 * Edit: No inline edit — placeholder for Smart Doc editor (Phase 3D).
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useTranslations } from 'next-intl';
import { FileText, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CellRendererProps } from '../GridCell';

export function SmartDocCellDisplay({ value, field }: CellRendererProps) {
  const t = useTranslations('grid.cells');

  if (!value) return null;

  return (
    <div className="flex w-full items-center gap-1">
      <Badge variant="default" className="gap-1 text-xs">
        <FileText className="h-3 w-3" aria-hidden="true" />
        {t('smart_doc_badge')}
      </Badge>
      {field.readOnly && (
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      )}
    </div>
  );
}

export function SmartDocCellEdit({ onCancel }: CellRendererProps) {
  const t = useTranslations('grid.cells');

  return (
    <div className="flex w-full items-center gap-2 text-sm text-slate-500">
      <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{t('smart_doc_placeholder')}</span>
      <button
        type="button"
        className="ml-auto shrink-0 text-xs text-blue-600 hover:underline"
        onClick={onCancel}
      >
        {t('smart_doc_close')}
      </button>
    </div>
  );
}
