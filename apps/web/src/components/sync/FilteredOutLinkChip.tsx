'use client';

/**
 * FilteredOutLinkChip — Grayed-out chip for cross-linked records outside the sync filter.
 *
 * Pure display component for Phase 3B cross-link cell renderer integration.
 * Not clickable — indicates the linked record exists on the platform but is
 * excluded by the sync filter.
 */

import { useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FilteredOutLinkChipProps {
  displayName: string;
  platformName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DISPLAY_LENGTH = 24;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilteredOutLinkChip({
  displayName,
  platformName,
}: FilteredOutLinkChipProps) {
  const t = useTranslations('sync_orphans');

  const truncatedName =
    displayName.length > MAX_DISPLAY_LENGTH
      ? `${displayName.slice(0, MAX_DISPLAY_LENGTH)}…`
      : displayName;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="cursor-default gap-1 opacity-50"
            data-testid="filtered-out-link-chip"
          >
            <Filter className="h-3 w-3" />
            <span>{truncatedName}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{t('filtered_out_tooltip', { platform: platformName ?? 'the source platform' })}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
