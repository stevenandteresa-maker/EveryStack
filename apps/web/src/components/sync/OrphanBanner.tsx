'use client';

/**
 * OrphanBanner — Alert banner shown when records are orphaned by a filter change.
 *
 * Displays a count of orphaned records with three resolution options:
 * delete, keep as local-only, or undo the filter change.
 */

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrphanBannerProps {
  tableId: string;
  orphanedCount: number;
  onDelete: () => void;
  onKeepLocal: () => void;
  onUndoFilter: () => void;
  isUndoAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrphanBanner({
  orphanedCount,
  onDelete,
  onKeepLocal,
  onUndoFilter,
  isUndoAvailable,
}: OrphanBannerProps) {
  const t = useTranslations('sync_orphans');

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
      data-testid="orphan-banner"
      role="alert"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="flex flex-1 flex-col gap-3">
        <p className="text-sm text-amber-900">
          {t('banner_message', { count: orphanedCount })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            data-testid="orphan-delete-btn"
          >
            {t('delete_button')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onKeepLocal}
            data-testid="orphan-keep-local-btn"
          >
            {t('keep_local_button')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onUndoFilter}
            disabled={!isUndoAvailable}
            data-testid="orphan-undo-filter-btn"
          >
            {t('undo_filter_button')}
          </Button>
        </div>
      </div>
    </div>
  );
}
