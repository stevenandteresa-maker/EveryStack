/**
 * Escalation Check Job — scheduled BullMQ job that runs every 15 minutes.
 *
 * Checks all active base_connections for sustained downtime:
 * - If last_success_at >1 hour ago and sync_status !== 'paused': send 1hr email to Owner
 * - If last_success_at >6 hours ago: send escalation email to Owner + Admins
 *
 * Uses deduplication to avoid sending the same notification repeatedly.
 *
 * @see docs/reference/sync-engine.md § Notification System for Sync Issues
 */

import type { Job } from 'bullmq';
import { getDbForTenant, baseConnections, tenants, eq } from '@everystack/shared/db';
import type { ConnectionHealth } from '@everystack/shared/sync';
import { ConnectionHealthSchema } from '@everystack/shared/sync';
import {
  sendSyncNotification,
  isDuplicateNotification,
  markNotificationSent,
} from '@everystack/shared/sync';
import { createLogger } from '@everystack/shared/logging';
import type { BaseJobData } from '@everystack/shared/queue';

const logger = createLogger({ service: 'escalation-check' });

const ONE_HOUR_MS = 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Job data for the escalation check — just needs traceId and triggeredBy.
 */
export interface EscalationCheckJobData extends BaseJobData {
  jobType: 'escalation_check';
}

/**
 * Processes the escalation check. Scans all tenants for connections with
 * sustained downtime and sends appropriate notifications.
 */
export async function processEscalationCheck(
  job: Job<EscalationCheckJobData>,
): Promise<void> {
  const { traceId } = job.data;

  logger.info({ traceId }, 'Starting escalation check');

  // Get all tenants — using system-level read
  const db = getDbForTenant('system', 'read');
  const allTenants = await db
    .select({ id: tenants.id })
    .from(tenants);

  for (const tenant of allTenants) {
    await checkTenantConnections(tenant.id, traceId);
  }

  logger.info({ traceId, tenantCount: allTenants.length }, 'Escalation check complete');
}

async function checkTenantConnections(
  tenantId: string,
  traceId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'read');

  const connections = await db
    .select({
      id: baseConnections.id,
      health: baseConnections.health,
      syncStatus: baseConnections.syncStatus,
      platform: baseConnections.platform,
    })
    .from(baseConnections)
    .where(
      eq(baseConnections.tenantId, tenantId),
    );

  const now = Date.now();

  for (const conn of connections) {
    // Skip paused connections
    if (conn.syncStatus === 'paused') continue;

    const parseResult = ConnectionHealthSchema.safeParse(conn.health);
    if (!parseResult.success) continue;

    const health: ConnectionHealth = parseResult.data;
    if (!health.last_success_at) continue;

    const lastSuccessMs = new Date(health.last_success_at).getTime();
    const downtimeMs = now - lastSuccessMs;

    // Downtime notifications are email-only (Owner/Admin at tenant level).
    // workspaceId is not needed for these — sendSyncNotification resolves
    // recipients from tenant_memberships for sync_down_1h/sync_down_6h.
    const details = {
      connectionId: conn.id,
      platform: conn.platform,
      workspaceId: '', // Not needed for escalation emails (tenant-level)
    };

    // 6-hour escalation (check first — more severe)
    if (downtimeMs > SIX_HOURS_MS) {
      const isDup = await isDuplicateNotification(tenantId, 'sync_down_6h', conn.id);
      if (!isDup) {
        await sendSyncNotification(tenantId, 'sync_down_6h', details, traceId);
        await markNotificationSent(tenantId, 'sync_down_6h', conn.id);
      }
    }
    // 1-hour notification
    else if (downtimeMs > ONE_HOUR_MS) {
      const isDup = await isDuplicateNotification(tenantId, 'sync_down_1h', conn.id);
      if (!isDup) {
        await sendSyncNotification(tenantId, 'sync_down_1h', details, traceId);
        await markNotificationSent(tenantId, 'sync_down_1h', conn.id);
      }
    }
  }
}
