'use client';

/**
 * CustomStatusDisplay — shows emoji + text next to a user name.
 *
 * Truncates long status text with ellipsis. Used in sidebar, @mention,
 * DM list, and thread participants.
 *
 * @see docs/reference/communications.md § Presence & Status
 */

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomStatusDisplayProps {
  emoji: string;
  text: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomStatusDisplay({
  emoji,
  text,
  className,
}: CustomStatusDisplayProps) {
  if (!emoji && !text) return null;

  return (
    <span
      data-testid="custom-status-display"
      className={cn(
        'inline-flex items-center gap-1 min-w-0 text-caption text-muted-foreground',
        className,
      )}
    >
      {emoji && <span className="shrink-0">{emoji}</span>}
      {text && (
        <span className="truncate max-w-[120px]" title={text}>
          {text}
        </span>
      )}
    </span>
  );
}
