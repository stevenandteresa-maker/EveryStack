'use client';

/**
 * OverviewTab — Connection summary and sync health overview
 * for the Sync Settings Dashboard.
 *
 * @see docs/reference/sync-engine.md § Sync Connection Status Model
 */

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConnectionHealth } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OverviewTabProps {
  platform: string;
  baseName: string | null;
  syncDirection: string;
  healthState: string;
  health: ConnectionHealth;
  lastSyncAt: Date | null;
  pollingIntervalSeconds: number;
  totalSyncedRecords: number;
  pendingConflictCount: number;
  pendingFailureCount: number;
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date | null, t: ReturnType<typeof useTranslations>): string {
  if (!date) return t('overview_never');

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return t('overview_just_now');
  if (diffMinutes === 1) return t('overview_minutes_ago', { count: 1 });
  if (diffMinutes < 60) return t('overview_minutes_ago', { count: diffMinutes });
  if (diffHours === 1) return t('overview_hours_ago', { count: 1 });
  if (diffHours < 24) return t('overview_hours_ago', { count: diffHours });
  if (diffDays === 1) return t('overview_days_ago', { count: 1 });
  return t('overview_days_ago', { count: diffDays });
}

// ---------------------------------------------------------------------------
// Health state badge config
// ---------------------------------------------------------------------------

function getHealthBadgeVariant(state: string): 'success' | 'warning' | 'error' | 'default' | 'outline' {
  switch (state) {
    case 'healthy':
      return 'success';
    case 'syncing':
      return 'outline';
    case 'stale':
    case 'retrying':
    case 'conflicts':
      return 'warning';
    case 'error':
    case 'auth_required':
      return 'error';
    case 'paused':
      return 'default';
    default:
      return 'outline';
  }
}

// ---------------------------------------------------------------------------
// OverviewTab
// ---------------------------------------------------------------------------

export function OverviewTab({
  platform,
  baseName,
  syncDirection,
  healthState,
  health,
  lastSyncAt,
  pollingIntervalSeconds,
  totalSyncedRecords,
  pendingConflictCount,
  pendingFailureCount,
}: OverviewTabProps) {
  const t = useTranslations('sync_dashboard');

  const relativeTime = formatRelativeTime(lastSyncAt, t);
  const pollingMinutes = Math.round(pollingIntervalSeconds / 60);

  return (
    <div className="flex flex-col gap-6" data-testid="overview-tab">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Connection Info card */}
        <Card data-testid="overview-connection-info">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-medium">
              {t('overview_connection_info')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_platform')}
              </span>
              <span className="text-[14px] font-medium text-foreground capitalize">
                {platform}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_base_name')}
              </span>
              <span className="text-[14px] font-medium text-foreground">
                {baseName ?? t('overview_unknown')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_direction')}
              </span>
              <span className="text-[14px] font-medium text-foreground capitalize">
                {syncDirection}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_polling_interval')}
              </span>
              <span className="text-[14px] font-medium text-foreground">
                {t('overview_polling_minutes', { count: pollingMinutes })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Sync Health card */}
        <Card data-testid="overview-sync-health">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-medium">
              {t('overview_sync_health')}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_health_state')}
              </span>
              <Badge variant={getHealthBadgeVariant(healthState)} className="text-[11px]">
                {t(`overview_state_${healthState}`)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_last_sync')}
              </span>
              <span className="text-[14px] font-medium text-foreground">
                {relativeTime}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_records_synced')}
              </span>
              <span className="text-[14px] font-medium text-foreground">
                {health.records_synced.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-muted-foreground">
                {t('overview_consecutive_failures')}
              </span>
              <span className="text-[14px] font-medium text-foreground">
                {health.consecutive_failures}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Overview section */}
      <Card data-testid="overview-sync-summary">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px] font-medium">
            {t('overview_sync_overview')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-4">
              <span className="text-[20px] font-semibold text-foreground">
                {totalSyncedRecords.toLocaleString()}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {t('overview_total_records')}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-4">
              <span className="text-[20px] font-semibold text-foreground">
                {pendingConflictCount}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {t('overview_pending_conflicts')}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 rounded-lg bg-muted p-4">
              <span className="text-[20px] font-semibold text-foreground">
                {pendingFailureCount}
              </span>
              <span className="text-[12px] text-muted-foreground">
                {t('overview_pending_failures')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function OverviewTabSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
      <Skeleton className="h-[120px] w-full rounded-lg" />
    </div>
  );
}
