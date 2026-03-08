'use client';

/**
 * CheckboxCell — combined display + edit for checkbox field type.
 *
 * Single click toggles directly. No separate edit mode.
 * Uses shadcn/ui Checkbox component.
 *
 * @see docs/reference/tables-and-views.md § Cell Type Rendering
 */

import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { CellRendererProps } from '../GridCell';

export function CheckboxCellDisplay({ value, field, onSave }: CellRendererProps) {
  const t = useTranslations('grid.cells');
  const checked = Boolean(value);

  if (field.readOnly) {
    return (
      <div className="flex w-full items-center justify-center gap-1">
        <Checkbox checked={checked} disabled aria-label={field.name} />
        <Lock
          className="h-3 w-3 shrink-0 text-slate-400"
          aria-label={t('read_only')}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center justify-center">
      <Checkbox
        checked={checked}
        onCheckedChange={(state) => {
          onSave(Boolean(state));
        }}
        aria-label={field.name}
      />
    </div>
  );
}
