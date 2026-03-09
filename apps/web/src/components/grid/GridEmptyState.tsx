'use client';

/**
 * GridEmptyState — shown when a table has zero records.
 *
 * Displays an illustration, "No records yet" text, and a
 * "+ New Record" CTA button that triggers record creation.
 *
 * @see docs/reference/tables-and-views.md § Loading & Empty States
 */

import { Plus, Table2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { GRID_TOKENS } from './grid-types';

export interface GridEmptyStateProps {
  /** Called when the user clicks the new record button. */
  onCreateRecord?: () => void;
}

export function GridEmptyState({ onCreateRecord }: GridEmptyStateProps) {
  const t = useTranslations('grid.empty_state');

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 p-8"
      data-testid="grid-empty-state"
    >
      {/* Illustration */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-xl"
        style={{ backgroundColor: GRID_TOKENS.panelBg }}
      >
        <Table2
          size={32}
          style={{ color: GRID_TOKENS.textSecondary }}
          aria-hidden
        />
      </div>

      {/* Text */}
      <div className="text-center">
        <p
          className="text-sm font-medium"
          style={{ color: GRID_TOKENS.textPrimary }}
        >
          {t('title')}
        </p>
        <p
          className="mt-1 text-sm"
          style={{ color: GRID_TOKENS.textSecondary }}
        >
          {t('description')}
        </p>
      </div>

      {/* CTA */}
      {onCreateRecord && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateRecord}
          data-testid="empty-state-new-record"
        >
          <Plus size={16} className="mr-1" />
          {t('new_record')}
        </Button>
      )}
    </div>
  );
}
