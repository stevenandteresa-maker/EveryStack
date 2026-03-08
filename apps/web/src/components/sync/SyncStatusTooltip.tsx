'use client';

/**
 * SyncStatusTooltip — Rich tooltip content for sync health indicators.
 *
 * Shows detailed sync health information including error details,
 * retry timing, record counts, and consecutive failure count.
 * Used by SyncStatusBadge as its tooltip content.
 *
 * @see docs/reference/sync-engine.md § Sync Status Indicators
 */

import { useTranslations } from 'next-intl';
import type { SyncHealthState } from '@everystack/shared/sync';
import type { ConnectionHealth } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SyncStatusTooltipProps {
  /** Current derived health state. */
  healthState: SyncHealthState;
  /** Platform name for display. */
  platform: string;
  /** Last sync timestamp. */
  lastSyncAt: Date | null;
  /** Connection health JSONB data. */
  health: ConnectionHealth | null;
  /** Number of pending conflicts. */
  pendingConflictCount: number;
}

// ---------------------------------------------------------------------------
// Relative time formatter (lightweight — no external deps)
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
// Component
// ---------------------------------------------------------------------------

export function SyncStatusTooltip({
  healthState,
  platform,
  lastSyncAt,
  health,
  pendingConflictCount,
}: SyncStatusTooltipProps) {
  const t = useTranslations('sync_status');

  const relativeTime = formatRelativeTime(lastSyncAt);
  const lastSuccessRelative = health?.last_success_at
    ? formatRelativeTime(new Date(health.last_success_at))
    : null;

  return (
    <div
      className="flex max-w-[280px] flex-col gap-1.5"
      data-testid="sync-status-tooltip"
    >
      {/* Primary status message */}
      <p className="text-[13px] font-medium leading-tight">
        {getStatusMessage(healthState, platform, t)}
      </p>

      {/* Detail rows */}
      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
        {/* Last synced */}
        {relativeTime && (
          <span data-testid="tooltip-last-sync">
            {t('tooltip_detail_last_sync', { time: relativeTime })}
          </span>
        )}

        {/* Records synced/failed */}
        {health && health.records_synced > 0 && (
          <span data-testid="tooltip-records">
            {health.records_failed > 0
              ? t('tooltip_detail_records_with_failures', {
                  synced: health.records_synced,
                  failed: health.records_failed,
                })
              : t('tooltip_detail_records', { count: health.records_synced })}
          </span>
        )}

        {/* Error message */}
        {health?.last_error && (healthState === 'error' || healthState === 'retrying') && (
          <span className="text-destructive" data-testid="tooltip-error">
            {health.last_error.message}
          </span>
        )}

        {/* Consecutive failures */}
        {health && health.consecutive_failures > 1 && (
          <span data-testid="tooltip-failures">
            {t('tooltip_detail_consecutive_failures', {
              count: health.consecutive_failures,
            })}
          </span>
        )}

        {/* Next retry */}
        {health?.next_retry_at && healthState === 'retrying' && (
          <span data-testid="tooltip-next-retry">
            {t('tooltip_detail_next_retry', {
              time: formatRelativeTime(new Date(health.next_retry_at)),
            })}
          </span>
        )}

        {/* Last success (shown in error/retrying states) */}
        {lastSuccessRelative &&
          (healthState === 'error' || healthState === 'retrying' || healthState === 'stale') && (
            <span data-testid="tooltip-last-success">
              {t('tooltip_detail_last_success', { time: lastSuccessRelative })}
            </span>
          )}

        {/* Conflict count */}
        {healthState === 'conflicts' && pendingConflictCount > 0 && (
          <span data-testid="tooltip-conflicts">
            {t('tooltip_conflicts', { count: pendingConflictCount })}
          </span>
        )}
      </div>

      {/* Action hint for clickable states */}
      {isActionable(healthState) && (
        <p className="mt-0.5 text-[11px] italic text-muted-foreground" data-testid="tooltip-action-hint">
          {getActionHint(healthState, t)}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusMessage(
  state: SyncHealthState,
  platform: string,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (state) {
    case 'healthy':
      return t('tooltip_healthy', { platform });
    case 'syncing':
      return t('tooltip_syncing', { platform });
    case 'stale':
      return t('tooltip_stale');
    case 'retrying':
      return t('tooltip_detail_retrying_header');
    case 'error':
      return t('tooltip_error');
    case 'auth_required':
      return t('tooltip_auth_required', { platform });
    case 'paused':
      return t('tooltip_paused');
    case 'conflicts':
      return t('tooltip_healthy', { platform });
    default:
      return '';
  }
}

function isActionable(state: SyncHealthState): boolean {
  return (
    state === 'error' ||
    state === 'auth_required' ||
    state === 'conflicts' ||
    state === 'stale'
  );
}

function getActionHint(
  state: SyncHealthState,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (state) {
    case 'error':
      return t('tooltip_action_view_details');
    case 'auth_required':
      return t('tooltip_action_reconnect');
    case 'conflicts':
      return t('tooltip_action_resolve');
    case 'stale':
      return t('tooltip_action_check_connection');
    default:
      return '';
  }
}
