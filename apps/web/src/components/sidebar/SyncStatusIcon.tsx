'use client';

/**
 * SyncStatusIcon — Sync health indicator icon for the sidebar table tab.
 *
 * Renders a compact sync icon to the right of the table name with
 * 6 health states. Shown in the always-dark sidebar so colors use
 * light-on-dark contrast.
 *
 * @see docs/reference/field-groups.md § Sync Status Indicator
 */

import { useTranslations } from 'next-intl';
import { ArrowUpDown, Pause, XCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SyncHealthState } from '@everystack/shared/sync';

export interface SyncStatusIconProps {
  healthState: SyncHealthState;
  platform: string;
  lastSyncAt: Date | null;
  pendingConflictCount: number;
  /** Called when user clicks the icon (navigates to sync settings). */
  onClick?: () => void;
  /** Called when user clicks on conflicts state (navigates to conflicts tab). */
  onClickConflicts?: () => void;
}

/** Format a relative time string for the tooltip. */
function formatRelativeTime(date: Date | null): string {
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
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

/** Capitalize platform name for display. */
function formatPlatformName(platform: string): string {
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** 6 sidebar-visible states (excludes stale/retrying which map to healthy/error in sidebar context). */
type SidebarSyncState = 'healthy' | 'syncing' | 'conflicts' | 'paused' | 'error' | 'converted';

function mapToSidebarState(healthState: SyncHealthState): SidebarSyncState {
  switch (healthState) {
    case 'healthy':
    case 'stale':
      return 'healthy';
    case 'syncing':
      return 'syncing';
    case 'conflicts':
      return 'conflicts';
    case 'paused':
      return 'paused';
    case 'error':
    case 'retrying':
    case 'auth_required':
      return 'error';
    default:
      return 'healthy';
  }
}

export function SyncStatusIcon({
  healthState,
  platform,
  lastSyncAt,
  pendingConflictCount,
  onClick,
  onClickConflicts,
}: SyncStatusIconProps) {
  const t = useTranslations('sync_sidebar');
  const sidebarState = mapToSidebarState(healthState);
  const platformDisplay = formatPlatformName(platform);
  const relativeTime = formatRelativeTime(lastSyncAt);

  // Converted tables show no icon
  if (sidebarState === 'converted') return null;

  const getTooltipText = (): string => {
    switch (sidebarState) {
      case 'healthy':
        return relativeTime
          ? t('tooltip_healthy_with_time', { platform: platformDisplay, time: relativeTime })
          : t('tooltip_healthy', { platform: platformDisplay });
      case 'syncing':
        return t('tooltip_syncing', { platform: platformDisplay });
      case 'conflicts':
        return t('tooltip_conflicts', { count: pendingConflictCount });
      case 'paused':
        return t('tooltip_paused');
      case 'error':
        return t('tooltip_error');
      default:
        return '';
    }
  };

  const isClickable = sidebarState !== 'healthy' && sidebarState !== 'syncing';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isClickable) return;
    if (sidebarState === 'conflicts') {
      onClickConflicts?.();
    } else {
      onClick?.();
    }
  };

  const iconClasses = cn(
    'relative inline-flex shrink-0',
    isClickable && 'cursor-pointer',
  );

  const renderIcon = () => {
    switch (sidebarState) {
      case 'healthy':
        return (
          <ArrowUpDown
            size={12}
            className="text-[var(--sidebar-text-muted)]"
            data-testid="sync-icon-healthy"
          />
        );
      case 'syncing':
        return (
          <ArrowUpDown
            size={12}
            className="animate-spin text-teal-400"
            data-testid="sync-icon-syncing"
          />
        );
      case 'conflicts':
        return (
          <span className="relative" data-testid="sync-icon-conflicts">
            <ArrowUpDown size={12} className="text-amber-400" />
            <span
              className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-400"
              aria-hidden="true"
            />
          </span>
        );
      case 'paused':
        return (
          <Pause
            size={12}
            className="text-[var(--sidebar-text-muted)]"
            data-testid="sync-icon-paused"
          />
        );
      case 'error':
        return (
          <XCircle
            size={12}
            className="text-red-400"
            data-testid="sync-icon-error"
          />
        );
      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={iconClasses}
            onClick={handleClick}
            data-testid={`sync-status-icon-${sidebarState}`}
            aria-label={getTooltipText()}
          >
            {renderIcon()}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-[13px]">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
