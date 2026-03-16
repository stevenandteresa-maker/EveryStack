'use client';

/**
 * PresenceIndicator — colored dot indicating user presence state.
 *
 * Online (green), Away (yellow), DND (red + minus), Offline (gray).
 * Three sizes: small (8px), medium (10px), large (12px).
 *
 * @see docs/reference/communications.md § Presence & Status
 */

import { useTranslations } from 'next-intl';
import { Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PresenceState } from './use-presence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PresenceIndicatorProps {
  /** Presence state to display */
  status: PresenceState;
  /** Dot size variant */
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_MAP = {
  small: 'w-2 h-2',       // 8px
  medium: 'w-2.5 h-2.5',  // 10px
  large: 'w-3 h-3',       // 12px
} as const;

const COLOR_MAP: Record<PresenceState, string> = {
  online: 'bg-emerald-500',
  away: 'bg-yellow-500',
  dnd: 'bg-red-500',
  offline: 'bg-gray-400',
};

const STATUS_LABEL_MAP: Record<PresenceState, string> = {
  online: 'online',
  away: 'away',
  dnd: 'dnd',
  offline: 'offline',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceIndicator({
  status,
  size = 'medium',
  className,
}: PresenceIndicatorProps) {
  const t = useTranslations('presence');

  return (
    <span
      data-testid="presence-indicator"
      data-status={status}
      role="img"
      aria-label={t(STATUS_LABEL_MAP[status])}
      className={cn(
        'inline-flex items-center justify-center rounded-full shrink-0',
        SIZE_MAP[size],
        COLOR_MAP[status],
        className,
      )}
    >
      {status === 'dnd' && size === 'large' && (
        <Minus className="w-2 h-2 text-white" strokeWidth={3} />
      )}
    </span>
  );
}
