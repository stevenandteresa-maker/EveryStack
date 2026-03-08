'use client';

/**
 * SyncStatusBadge — Sync health indicator in the table header.
 *
 * Shows the current sync health state with color-coded badge and
 * relative time display. Click behavior varies by state.
 *
 * @see docs/reference/sync-engine.md § Sync Status Indicators
 * @see docs/reference/field-groups.md § Sync Status Indicator
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SyncHealthState } from '@everystack/shared/sync';
import type { ConnectionHealth } from '@everystack/shared/sync';
import { SyncStatusTooltip } from './SyncStatusTooltip';

// ---------------------------------------------------------------------------
// Relative time formatter
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date | null): string {
  if (!date) return '';

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes === 1) return '1 min ago';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SyncStatusBadgeProps {
  /** Current derived health state. */
  healthState: SyncHealthState;
  /** Platform name for display. */
  platform: string;
  /** Last sync timestamp. */
  lastSyncAt: Date | null;
  /** Number of pending conflicts. */
  pendingConflictCount: number;
  /** Connection health JSONB data for rich tooltip. */
  health?: ConnectionHealth | null;
  /** Error message for tooltip (from health.last_error.message). */
  errorMessage?: string;
  /** Next retry time for retrying state. */
  nextRetryAt?: string | null;
  /** Called when user clicks the badge (navigates to sync settings). */
  onClickSyncSettings?: () => void;
  /** Called when user clicks to re-authenticate. */
  onClickReAuth?: () => void;
  /** Called when user clicks to resolve conflicts. */
  onClickConflicts?: () => void;
}

// ---------------------------------------------------------------------------
// State configuration
// ---------------------------------------------------------------------------

interface StateConfig {
  variant: 'default' | 'success' | 'warning' | 'error' | 'outline';
  dotColor: string;
  animate: boolean;
}

const STATE_CONFIGS: Record<SyncHealthState, StateConfig> = {
  healthy: { variant: 'outline', dotColor: 'bg-green-500', animate: false },
  syncing: { variant: 'outline', dotColor: 'bg-teal-500', animate: true },
  stale: { variant: 'warning', dotColor: 'bg-yellow-500', animate: false },
  retrying: { variant: 'warning', dotColor: 'bg-yellow-500', animate: true },
  error: { variant: 'error', dotColor: 'bg-red-500', animate: false },
  auth_required: { variant: 'error', dotColor: 'bg-red-500', animate: false },
  paused: { variant: 'default', dotColor: 'bg-gray-400', animate: false },
  conflicts: { variant: 'warning', dotColor: 'bg-amber-500', animate: false },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncStatusBadge({
  healthState,
  platform,
  lastSyncAt,
  pendingConflictCount,
  health,
  errorMessage,
  nextRetryAt,
  onClickSyncSettings,
  onClickReAuth,
  onClickConflicts,
}: SyncStatusBadgeProps) {
  const t = useTranslations('sync_status');
  const config = STATE_CONFIGS[healthState];
  const relativeTime = formatRelativeTime(lastSyncAt);

  // Determine badge text
  const getBadgeText = (): string => {
    switch (healthState) {
      case 'healthy':
        return relativeTime ? t('synced_ago', { time: relativeTime }) : t('synced');
      case 'syncing':
        return t('syncing');
      case 'stale':
        return relativeTime ? t('last_synced_ago', { time: relativeTime }) : t('stale');
      case 'retrying':
        return t('retrying');
      case 'error':
        return t('sync_error');
      case 'auth_required':
        return t('auth_required');
      case 'paused':
        return t('paused');
      case 'conflicts':
        return t('synced_conflicts', { count: pendingConflictCount });
      default:
        return t('synced');
    }
  };

  // Determine tooltip text
  const getTooltipText = (): string => {
    switch (healthState) {
      case 'healthy':
        return t('tooltip_healthy', { platform });
      case 'syncing':
        return t('tooltip_syncing', { platform });
      case 'stale':
        return t('tooltip_stale');
      case 'retrying':
        return nextRetryAt
          ? t('tooltip_retrying_with_time', { error: errorMessage ?? '', time: nextRetryAt })
          : t('tooltip_retrying', { error: errorMessage ?? '' });
      case 'error':
        return errorMessage ?? t('tooltip_error');
      case 'auth_required':
        return t('tooltip_auth_required', { platform });
      case 'paused':
        return t('tooltip_paused');
      case 'conflicts':
        return t('tooltip_conflicts', { count: pendingConflictCount });
      default:
        return '';
    }
  };

  // Determine click handler
  const handleClick = () => {
    switch (healthState) {
      case 'auth_required':
        onClickReAuth?.();
        break;
      case 'conflicts':
        onClickConflicts?.();
        break;
      case 'error':
      case 'retrying':
      case 'stale':
        onClickSyncSettings?.();
        break;
      default:
        break;
    }
  };

  const isClickable =
    healthState === 'auth_required' ||
    healthState === 'conflicts' ||
    healthState === 'error' ||
    healthState === 'retrying' ||
    healthState === 'stale';

  const badgeContent = (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.dotColor}${config.animate ? ' animate-pulse' : ''}`}
        aria-hidden="true"
      />
      <span>{getBadgeText()}</span>
    </span>
  );

  const badge = (
    <Badge
      variant={config.variant}
      className={isClickable ? 'cursor-pointer' : 'cursor-default'}
      onClick={isClickable ? handleClick : undefined}
      data-testid={`sync-status-badge-${healthState}`}
    >
      {badgeContent}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          {health ? (
            <SyncStatusTooltip
              healthState={healthState}
              platform={platform}
              lastSyncAt={lastSyncAt}
              health={health}
              pendingConflictCount={pendingConflictCount}
            />
          ) : (
            <p className="text-[13px]">{getTooltipText()}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
