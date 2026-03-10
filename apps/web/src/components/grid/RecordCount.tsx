'use client';

/**
 * RecordCount — displays filtered/total record count in grid footer.
 *
 * "32 of 247 records" when filtered, "247 records" when unfiltered.
 *
 * @see docs/reference/tables-and-views.md § Record Count
 */

import { memo } from 'react';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordCountProps {
  /** Number of records currently visible (after filters) */
  filteredCount: number;
  /** Total number of records (without filters) */
  totalCount: number;
  /** Whether filters are currently active */
  isFiltered: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RecordCount = memo(function RecordCount({
  filteredCount,
  totalCount,
  isFiltered,
}: RecordCountProps) {
  const t = useTranslations('grid.toolbar');

  return (
    <div className="px-3 py-1 text-xs text-muted-foreground select-none" aria-live="polite">
      {isFiltered
        ? t('record_count_filtered', { filtered: filteredCount, total: totalCount })
        : t('record_count', { count: totalCount })}
    </div>
  );
});
