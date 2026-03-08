'use client';

/**
 * SyncDashboard — Main Sync Settings Dashboard component.
 *
 * Displays connection info, health, and 6 tabs: Overview, Tables & Filters,
 * Conflicts, Failures, Schema Changes, and History.
 *
 * @see docs/reference/sync-engine.md § Sync Connection Status Model
 */

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  Pause,
  Play,
  Unplug,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { SyncDashboardData, SyncHistoryEntry } from '@/data/sync-dashboard';
import type { SyncFailureWithRecord } from '@/data/sync-failures';
import type { SyncSchemaChangeRow } from '@/data/sync-schema-changes';
import {
  syncNowAction,
  pauseSyncAction,
  resumeSyncAction,
  disconnectSyncAction,
} from '@/actions/sync-dashboard-actions';
import { OverviewTab } from './OverviewTab';
import { TablesFiltersTab } from './TablesFiltersTab';
import { ConflictsTab } from './ConflictsTab';
import type { ConflictForDashboard } from './ConflictsTab';
import { FailuresTab } from './FailuresTab';
import { SchemaChangesTab } from './SchemaChangesTab';
import { HistoryTab } from './HistoryTab';

// ---------------------------------------------------------------------------
// Re-export ConflictForDashboard type for page-level usage
// ---------------------------------------------------------------------------

export type { ConflictForDashboard };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SyncDashboardProps {
  dashboardData: SyncDashboardData;
  failures: SyncFailureWithRecord[];
  schemaChanges: SyncSchemaChangeRow[];
  conflicts: ConflictForDashboard[];
  history: SyncHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Health state badge config
// ---------------------------------------------------------------------------

function getStatusBadgeVariant(
  state: string,
): 'success' | 'warning' | 'error' | 'default' | 'outline' {
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
// SyncDashboard
// ---------------------------------------------------------------------------

export function SyncDashboard({
  dashboardData,
  failures,
  schemaChanges,
  conflicts,
  history,
}: SyncDashboardProps) {
  const t = useTranslations('sync_dashboard');
  const [activeTab, setActiveTab] = useState('overview');
  const [isPending, startTransition] = useTransition();

  const {
    connectionId,
    platform,
    baseName,
    syncDirection,
    syncStatus,
    healthState,
    health,
    lastSyncAt,
    pollingIntervalSeconds,
    totalSyncedRecords,
    pendingConflictCount,
    pendingFailureCount,
    pendingSchemaChangeCount,
    syncConfig,
  } = dashboardData;

  const isPaused = syncStatus === 'paused';
  const isSyncing = healthState === 'syncing';

  // Action handlers
  const handleSyncNow = () => {
    startTransition(async () => {
      await syncNowAction({ baseConnectionId: connectionId });
    });
  };

  const handlePause = () => {
    startTransition(async () => {
      await pauseSyncAction({ baseConnectionId: connectionId });
    });
  };

  const handleResume = () => {
    startTransition(async () => {
      await resumeSyncAction({ baseConnectionId: connectionId });
    });
  };

  const handleDisconnect = () => {
    const confirmed = window.confirm(t('disconnect_confirm'));
    if (!confirmed) return;

    startTransition(async () => {
      await disconnectSyncAction({ baseConnectionId: connectionId });
    });
  };

  const handleMutate = () => {
    // In a real implementation, this would trigger a router.refresh() or revalidation
    // For now it serves as the callback hook for child components
  };

  return (
    <div className="flex flex-col gap-6" data-testid="sync-dashboard">
      {/* Header section */}
      <div className="flex flex-col gap-4" data-testid="sync-dashboard-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-[20px] font-semibold text-foreground">
              {t('title')}
            </h2>
            <Badge
              variant={getStatusBadgeVariant(healthState)}
              className="text-[11px]"
              data-testid="sync-dashboard-status-badge"
            >
              {t(`status_${healthState}`)}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="capitalize">{platform}</span>
            {baseName && (
              <>
                <span>·</span>
                <span>{baseName}</span>
              </>
            )}
          </div>
        </div>

        {/* Key metrics row */}
        <div className="flex items-center gap-6 text-[13px] text-muted-foreground">
          <span>
            {t('header_records', { count: totalSyncedRecords })}
          </span>
          <span>
            {t('header_conflicts', { count: pendingConflictCount })}
          </span>
          <span>
            {t('header_failures', { count: pendingFailureCount })}
          </span>
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        data-testid="sync-dashboard-tabs"
      >
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            {t('tab_overview')}
          </TabsTrigger>
          <TabsTrigger value="tables" data-testid="tab-tables">
            {t('tab_tables')}
          </TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">
            <span className="flex items-center gap-1.5">
              {t('tab_conflicts')}
              {pendingConflictCount > 0 && (
                <Badge variant="error" className="px-1.5 py-0 text-[10px]">
                  {pendingConflictCount}
                </Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="failures" data-testid="tab-failures">
            <span className="flex items-center gap-1.5">
              {t('tab_failures')}
              {pendingFailureCount > 0 && (
                <Badge variant="error" className="px-1.5 py-0 text-[10px]">
                  {pendingFailureCount}
                </Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="schema-changes" data-testid="tab-schema-changes">
            <span className="flex items-center gap-1.5">
              {t('tab_schema_changes')}
              {pendingSchemaChangeCount > 0 && (
                <Badge variant="error" className="px-1.5 py-0 text-[10px]">
                  {pendingSchemaChangeCount}
                </Badge>
              )}
            </span>
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            {t('tab_history')}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="overview">
            <OverviewTab
              platform={platform}
              baseName={baseName}
              syncDirection={syncDirection}
              healthState={healthState}
              health={health}
              lastSyncAt={lastSyncAt}
              pollingIntervalSeconds={pollingIntervalSeconds}
              totalSyncedRecords={totalSyncedRecords}
              pendingConflictCount={pendingConflictCount}
              pendingFailureCount={pendingFailureCount}
            />
          </TabsContent>

          <TabsContent value="tables">
            <TablesFiltersTab
              baseConnectionId={connectionId}
              syncConfig={syncConfig}
              onMutate={handleMutate}
            />
          </TabsContent>

          <TabsContent value="conflicts">
            <ConflictsTab
              baseConnectionId={connectionId}
              conflicts={conflicts}
              platform={platform}
              onMutate={handleMutate}
            />
          </TabsContent>

          <TabsContent value="failures">
            <FailuresTab
              baseConnectionId={connectionId}
              failures={failures}
              onMutate={handleMutate}
            />
          </TabsContent>

          <TabsContent value="schema-changes">
            <SchemaChangesTab
              baseConnectionId={connectionId}
              platform={platform}
              changes={schemaChanges}
              onMutate={handleMutate}
            />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab
              baseConnectionId={connectionId}
              history={history}
            />
          </TabsContent>
        </div>
      </Tabs>

      <Separator />

      {/* Action buttons */}
      <div className="flex items-center gap-2" data-testid="sync-dashboard-actions">
        <Button
          variant="default"
          size="sm"
          onClick={handleSyncNow}
          disabled={isPending || isSyncing || isPaused}
          data-testid="sync-now-button"
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {t('action_sync_now')}
        </Button>

        {isPaused ? (
          <Button
            variant="default"
            size="sm"
            onClick={handleResume}
            disabled={isPending}
            data-testid="resume-sync-button"
          >
            <Play className="mr-1.5 h-3.5 w-3.5" />
            {t('action_resume')}
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handlePause}
            disabled={isPending}
            data-testid="pause-sync-button"
          >
            <Pause className="mr-1.5 h-3.5 w-3.5" />
            {t('action_pause')}
          </Button>
        )}

        <Button
          variant="destructive"
          size="sm"
          onClick={handleDisconnect}
          disabled={isPending}
          data-testid="disconnect-button"
        >
          <Unplug className="mr-1.5 h-3.5 w-3.5" />
          {t('action_disconnect')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

export function SyncDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="sync-dashboard-skeleton">
      {/* Header skeleton */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-16 rounded-[5px]" />
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <Separator />

      {/* Tabs skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full max-w-[600px] rounded-lg" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
        <Skeleton className="h-[120px] w-full rounded-lg" />
      </div>

      <Separator />

      {/* Actions skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
    </div>
  );
}
