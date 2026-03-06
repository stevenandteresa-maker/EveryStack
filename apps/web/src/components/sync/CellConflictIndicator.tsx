'use client';

/**
 * CellConflictIndicator — Amber triangle + dashed underline for conflicted cells.
 *
 * Renders a 4px amber triangle in the top-right corner of a cell and adds
 * a 1px dashed amber underline to the cell text. On hover, shows a tooltip
 * explaining the conflict. Click opens the ConflictResolutionModal.
 *
 * @see docs/reference/sync-engine.md § Grid-Level Conflict Rendering
 */

import { useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { ConflictMeta } from '@/data/sync-conflicts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CellConflictIndicatorProps {
  /** The conflict metadata for this cell. */
  conflict: ConflictMeta;
  /** Called when the user clicks to resolve. */
  onResolveClick: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CellConflictIndicator({
  conflict,
  onResolveClick,
}: CellConflictIndicatorProps) {
  const t = useTranslations('sync_conflicts');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-pointer border-0 bg-transparent p-0"
            onClick={onResolveClick}
            data-testid="cell-conflict-indicator"
            aria-label={t('cell_tooltip', { platform: conflict.platform })}
          >
            {/* 4px amber triangle — top-right corner */}
            <span
              className="absolute right-0 top-0 h-0 w-0 border-l-[4px] border-t-[4px] border-l-transparent border-t-amber-500"
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('cell_tooltip', { platform: conflict.platform })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// RowConflictBadge — Amber badge in the row number area
// ---------------------------------------------------------------------------

export interface RowConflictBadgeProps {
  /** Number of conflicts on this row. */
  count: number;
  /** Called when the user clicks to resolve all conflicts on this record. */
  onResolveClick: () => void;
}

/**
 * RowConflictBadge — Amber warning icon in the row index column.
 *
 * Shown when any cell in the row has a pending conflict. Click opens the
 * ConflictResolutionModal for the record.
 */
export function RowConflictBadge({
  count,
  onResolveClick,
}: RowConflictBadgeProps) {
  const t = useTranslations('sync_conflicts');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded p-0.5 text-amber-500 hover:bg-amber-50"
            onClick={onResolveClick}
            data-testid="row-conflict-badge"
            aria-label={t('row_badge_tooltip', { count })}
          >
            <AlertTriangle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('row_badge_tooltip', { count })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// CellWrapper — Wraps any cell with optional conflict indicator overlay
// ---------------------------------------------------------------------------

export interface CellWrapperProps {
  /** Conflict metadata for this cell, if any. */
  conflict?: ConflictMeta;
  /** Called when the user clicks the conflict indicator to resolve. */
  onResolveClick?: () => void;
  /** The cell content to render. */
  children: React.ReactNode;
}

/**
 * CellWrapper — Composable cell wrapper for Phase 3 TanStack Table integration.
 *
 * Wraps any cell renderer with an optional conflict indicator overlay. When
 * `conflict` is provided, renders the amber triangle, dashed underline, and
 * tooltip. When absent, renders children with no overhead.
 *
 * Usage in TanStack Table column definitions:
 * ```tsx
 * cell: ({ getValue, row, column }) => {
 *   const conflict = row.original._conflicts?.[column.id];
 *   return (
 *     <CellWrapper conflict={conflict} onResolveClick={() => openModal(row)}>
 *       <FieldRenderer value={getValue()} fieldDef={column.columnDef.meta.fieldDef} />
 *     </CellWrapper>
 *   );
 * };
 * ```
 */
export function CellWrapper({
  conflict,
  onResolveClick,
  children,
}: CellWrapperProps) {
  if (!conflict) {
    return <>{children}</>;
  }

  return (
    <div className="relative" data-testid="cell-wrapper-conflicted">
      {onResolveClick && (
        <CellConflictIndicator
          conflict={conflict}
          onResolveClick={onResolveClick}
        />
      )}
      {/* 1px amber dashed underline on cell text */}
      <div className="border-b border-dashed border-amber-500">
        {children}
      </div>
    </div>
  );
}
