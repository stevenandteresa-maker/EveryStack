'use client';

/**
 * OrphanRowIndicator — Small icon + tooltip for orphaned record rows.
 *
 * Pure display component for Phase 3 grid integration. Shows a cloud-off
 * icon with a tooltip explaining why the record is no longer synced.
 */

import { useTranslations } from 'next-intl';
import { CloudOff } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrphanRowIndicatorProps {
  orphanedAt: string;
}

// ---------------------------------------------------------------------------
// CSS class for Phase 3 row-level muted styling
// ---------------------------------------------------------------------------

export const ORPHAN_ROW_CLASS = 'orphan-row';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrphanRowIndicator({ orphanedAt }: OrphanRowIndicatorProps) {
  const t = useTranslations('sync_orphans');

  const formattedDate = new Date(orphanedAt).toLocaleDateString();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center"
            data-testid="orphan-row-indicator"
          >
            <CloudOff className="h-4 w-4 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('row_indicator_tooltip', { date: formattedDate })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
