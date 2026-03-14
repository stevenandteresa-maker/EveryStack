'use client';

/**
 * LinkedRecordChip — enhanced pill for displaying a linked record.
 *
 * Shows display_value with click-to-navigate, shimmer while cascade
 * is in-flight, remove button in edit mode, and truncation with tooltip.
 *
 * @see docs/reference/cross-linking.md § Cross-Link Field Value
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Link2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkedRecordChipProps {
  /** Target record ID */
  recordId: string;
  /** Display value text (from denormalized canonical data) */
  displayValue: string;
  /** When the display value was last updated */
  displayUpdatedAt?: string;
  /** When the source record was last updated — used to detect stale display values */
  sourceUpdatedAt?: string;
  /** Whether the chip is in edit mode (shows remove button) */
  editable?: boolean;
  /** Called when user clicks the chip to navigate to the target record */
  onNavigate?: (recordId: string) => void;
  /** Called when user clicks remove button to unlink */
  onRemove?: (recordId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determines if the display value is stale (cascade in-flight).
 * Stale = displayUpdatedAt is older than sourceUpdatedAt by more than 2s.
 */
function isDisplayStale(
  displayUpdatedAt?: string,
  sourceUpdatedAt?: string,
): boolean {
  if (!displayUpdatedAt || !sourceUpdatedAt) return false;
  const displayTime = new Date(displayUpdatedAt).getTime();
  const sourceTime = new Date(sourceUpdatedAt).getTime();
  return sourceTime - displayTime > 2000;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkedRecordChip({
  recordId,
  displayValue,
  displayUpdatedAt,
  sourceUpdatedAt,
  editable = false,
  onNavigate,
  onRemove,
}: LinkedRecordChipProps) {
  const t = useTranslations('linked_record_chip');
  const stale = isDisplayStale(displayUpdatedAt, sourceUpdatedAt);

  const handleClick = useCallback(() => {
    onNavigate?.(recordId);
  }, [onNavigate, recordId]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove?.(recordId);
    },
    [onRemove, recordId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate?.(recordId);
      }
    },
    [onNavigate, recordId],
  );

  const chip = (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer gap-1 px-2 py-0.5 text-xs font-normal transition-colors',
        'hover:bg-accent/20',
        stale && 'animate-shimmer',
      )}
      role="listitem"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      aria-label={t('navigate', { name: displayValue })}
      data-testid="linked-record-chip"
    >
      <Link2 className="h-3 w-3 shrink-0" />
      <span className="max-w-[160px] truncate">{displayValue}</span>
      {editable && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-0.5 rounded-sm hover:bg-muted"
          aria-label={t('remove', { name: displayValue })}
          data-testid="linked-record-chip-remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </Badge>
  );

  // Wrap in tooltip when text is long enough to potentially truncate
  if (displayValue.length > 20) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[300px]">
          <p>{displayValue}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return chip;
}
