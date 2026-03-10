'use client';

/**
 * FieldLockIndicator — avatar badge shown on cells locked by another user.
 *
 * Displays a small avatar at the top-right corner of a cell with a tooltip
 * showing "{userName} is editing". The cell is made non-interactive when locked.
 *
 * @see docs/reference/tables-and-views.md § Field-Level Presence & Locking
 */

import { memo } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FieldLockInfo } from '@/lib/hooks/use-field-lock';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FieldLockIndicatorProps {
  lockInfo: FieldLockInfo;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FieldLockIndicator = memo(function FieldLockIndicator({
  lockInfo,
}: FieldLockIndicatorProps) {
  const t = useTranslations('grid');

  const initials = lockInfo.userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="absolute right-0.5 top-0.5 z-30 flex h-5 w-5 items-center justify-center rounded-full border border-white shadow-sm"
            style={{ backgroundColor: '#3B82F6' }}
          >
            {lockInfo.avatarUrl ? (
              <Image
                src={lockInfo.avatarUrl}
                alt=""
                width={20}
                height={20}
                className="h-full w-full rounded-full object-cover"
                unoptimized
              />
            ) : (
              <span className="text-[9px] font-medium leading-none text-white">
                {initials}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {t('collaboration.user_editing', { userName: lockInfo.userName })}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
