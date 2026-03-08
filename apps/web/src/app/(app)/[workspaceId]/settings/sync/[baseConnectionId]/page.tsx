/**
 * Sync Settings Dashboard — Route Page
 *
 * Server Component that loads all dashboard data and renders the
 * SyncDashboard client component with 6 tabs.
 *
 * Route: /[workspaceId]/settings/sync/[baseConnectionId]
 *
 * @see docs/reference/sync-engine.md § Sync Settings Dashboard
 */

import { Suspense } from 'react';
import { getAuthContext } from '@/lib/auth-context';
import { getSyncDashboardData, getSyncHistory } from '@/data/sync-dashboard';
import { getSyncFailures } from '@/data/sync-failures';
import { getSyncSchemaChanges } from '@/data/sync-schema-changes';
import { getConflictsForConnection } from '@/data/sync-dashboard-conflicts';
import { SyncDashboard, SyncDashboardSkeleton } from '@/components/sync/SyncDashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SyncSettingsPageProps {
  params: Promise<{
    workspaceId: string;
    baseConnectionId: string;
  }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SyncSettingsPage({ params }: SyncSettingsPageProps) {
  const { baseConnectionId } = await params;
  const { tenantId } = await getAuthContext();

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Suspense fallback={<SyncDashboardSkeleton />}>
        <SyncDashboardLoader
          tenantId={tenantId}
          baseConnectionId={baseConnectionId}
        />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data loader (Server Component)
// ---------------------------------------------------------------------------

async function SyncDashboardLoader({
  tenantId,
  baseConnectionId,
}: {
  tenantId: string;
  baseConnectionId: string;
}) {
  const [dashboardData, failures, schemaChanges, conflicts, history] =
    await Promise.all([
      getSyncDashboardData(tenantId, baseConnectionId),
      getSyncFailures(tenantId, baseConnectionId),
      getSyncSchemaChanges(tenantId, baseConnectionId),
      getConflictsForConnection(tenantId, baseConnectionId),
      getSyncHistory(tenantId, baseConnectionId, 7),
    ]);

  return (
    <SyncDashboard
      dashboardData={dashboardData}
      failures={failures}
      schemaChanges={schemaChanges}
      conflicts={conflicts}
      history={history}
    />
  );
}
