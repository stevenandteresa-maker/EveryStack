'use client';

/**
 * OverflowBadge — "+N" indicator with tooltip showing remaining items.
 *
 * Used by MultiSelectCell, PeopleCell, LinkedRecordCell, and AttachmentCell
 * when there are too many items to display in the cell.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface OverflowBadgeProps {
  /** Number of overflow items */
  count: number;
  /** Labels of the overflow items (shown in tooltip) */
  labels?: string[];
  /** Additional className */
  className?: string;
}

export function OverflowBadge({ count, labels, className }: OverflowBadgeProps) {
  if (count <= 0) return null;

  const badge = (
    <span
      className={`inline-flex shrink-0 items-center rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 ${className ?? ''}`}
    >
      +{count}
    </span>
  );

  if (!labels || labels.length === 0) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="flex flex-col gap-0.5">
            {labels.map((label, i) => (
              <span key={i} className="text-xs">
                {label}
              </span>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
