'use client';

/**
 * ConflictToolbarBadge — Amber conflict count in the grid toolbar.
 *
 * Shows "{count} conflicts" in amber text when pending conflicts exist.
 * Hidden when count is 0. Click fires onFilterConflicts to show only
 * conflicted records in the grid.
 *
 * @see docs/reference/sync-engine.md § Conflict count in toolbar
 */

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConflictToolbarBadgeProps {
  /** Number of pending conflicts on the current table. */
  count: number;
  /** Called when the user clicks to filter the grid to conflicted records. */
  onFilterConflicts: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConflictToolbarBadge({
  count,
  onFilterConflicts,
}: ConflictToolbarBadgeProps) {
  const t = useTranslations('sync_conflicts');

  if (count === 0) {
    return null;
  }

  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[13px] font-medium text-amber-600 hover:bg-amber-50"
      onClick={onFilterConflicts}
      data-testid="conflict-toolbar-badge"
    >
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <span>{t('toolbar_badge', { count })}</span>
    </button>
  );
}
