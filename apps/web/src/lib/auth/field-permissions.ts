/**
 * Field permission enforcement guards with audit logging.
 *
 * Bridges the data layer (getFieldPermissions) with server actions and API
 * handlers. Provides check-and-throw guards for single/batch field access
 * and a utility for stripping hidden fields from records.
 *
 * @see docs/reference/permissions.md § Permission Denial Behavior
 * @see apps/web/src/data/permissions.ts
 */

import { ForbiddenError } from '@everystack/shared/errors';
import { webLogger, getTraceId } from '@everystack/shared/logging';
import { createRedisClient } from '@everystack/shared/redis';
import { writeAuditLog, getDbForTenant } from '@everystack/shared/db';
import type { FieldPermissionMap, FieldPermissionState } from '@everystack/shared/auth';
import { getFieldPermissions } from '@/data/permissions';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEDUP_TTL_SECONDS = 300; // 5 minutes
const DEDUP_KEY_PREFIX = 'dedup:perm';

// ---------------------------------------------------------------------------
// Redis — lazy singleton
// ---------------------------------------------------------------------------

const logger = webLogger;

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('permission-audit-dedup');
  }
  return redisClient;
}

// ---------------------------------------------------------------------------
// Permission denial details
// ---------------------------------------------------------------------------

export interface PermissionDenialDetails {
  action: 'read' | 'edit';
  resource: string;
  resourceId: string;
  fieldIds?: string[];
  deniedCount?: number;
}

// ---------------------------------------------------------------------------
// logPermissionDenial
// ---------------------------------------------------------------------------

/**
 * Write a permission denial to audit_log with Redis-based deduplication.
 *
 * Within a 5-minute window, repeated denials for the same
 * (tenantId, userId, resource, resourceId) increment a counter instead of
 * writing new audit entries.
 */
export async function logPermissionDenial(
  tenantId: string,
  userId: string,
  details: PermissionDenialDetails,
): Promise<void> {
  const dedupKey = `${DEDUP_KEY_PREFIX}:${tenantId}:${userId}:${details.resource}:${details.resourceId}`;

  try {
    const redis = getRedis();
    const existing = await redis.get(dedupKey);

    if (existing) {
      // Increment dedup counter — skip new audit entry
      await redis.incr(dedupKey);
      return;
    }

    // First denial in this window — write audit entry and set dedup key
    await redis.set(dedupKey, '1', 'EX', DEDUP_TTL_SECONDS);
  } catch (error) {
    // Redis failure is non-fatal — still write the audit entry
    logger.warn(
      { error, tenantId, userId },
      'Permission denial dedup check failed — writing audit entry anyway',
    );
  }

  // Write audit log entry
  try {
    const db = getDbForTenant(tenantId);
    await writeAuditLog(db, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'permission_denied',
      entityType: details.resource,
      entityId: details.resourceId,
      details: details as unknown as Record<string, unknown>,
      traceId: getTraceId(),
    });
  } catch (error) {
    // Audit log failure is non-fatal — log and continue
    logger.error(
      { error, tenantId, userId, details },
      'Failed to write permission denial audit log',
    );
  }
}

// ---------------------------------------------------------------------------
// checkFieldPermission — single field
// ---------------------------------------------------------------------------

/**
 * Check that the user has at least the required access level for a single field.
 *
 * - Throws ForbiddenError if the field is hidden (action: 'read').
 * - Throws ForbiddenError if the field is read_only and requiredState is 'read_write' (action: 'edit').
 * - Logs denial to audit log via logPermissionDenial().
 */
export async function checkFieldPermission(
  tenantId: string,
  viewId: string,
  userId: string,
  fieldId: string,
  requiredState: 'read_write' | 'read_only',
): Promise<void> {
  const permissionMap = await getFieldPermissions(tenantId, viewId, userId);
  const state: FieldPermissionState = permissionMap.get(fieldId) ?? 'hidden';

  if (state === 'hidden') {
    const details: PermissionDenialDetails = {
      action: 'read',
      resource: 'field',
      resourceId: fieldId,
    };
    await logPermissionDenial(tenantId, userId, details);
    throw new ForbiddenError("You don't have access to this field.", {
      action: 'read',
      resource: 'field',
      resourceId: fieldId,
    });
  }

  if (state === 'read_only' && requiredState === 'read_write') {
    const details: PermissionDenialDetails = {
      action: 'edit',
      resource: 'field',
      resourceId: fieldId,
    };
    await logPermissionDenial(tenantId, userId, details);
    throw new ForbiddenError('This field is read-only for your role.', {
      action: 'edit',
      resource: 'field',
      resourceId: fieldId,
    });
  }
}

// ---------------------------------------------------------------------------
// checkFieldPermissions — batch (all-or-nothing)
// ---------------------------------------------------------------------------

/**
 * Batch permission check — all-or-nothing.
 *
 * Loads the permission map once, checks all fields. If any fail, throws
 * ForbiddenError with the count of denied fields. Logs once with all
 * denied field IDs.
 */
export async function checkFieldPermissions(
  tenantId: string,
  viewId: string,
  userId: string,
  fieldIds: string[],
  requiredState: 'read_write' | 'read_only',
): Promise<void> {
  const permissionMap = await getFieldPermissions(tenantId, viewId, userId);
  const deniedFieldIds: string[] = [];

  for (const fieldId of fieldIds) {
    const state: FieldPermissionState = permissionMap.get(fieldId) ?? 'hidden';

    if (state === 'hidden') {
      deniedFieldIds.push(fieldId);
    } else if (state === 'read_only' && requiredState === 'read_write') {
      deniedFieldIds.push(fieldId);
    }
  }

  if (deniedFieldIds.length === 0) {
    return;
  }

  const action: 'read' | 'edit' = requiredState === 'read_write' ? 'edit' : 'read';
  const details: PermissionDenialDetails = {
    action,
    resource: 'field',
    resourceId: deniedFieldIds[0]!,
    fieldIds: deniedFieldIds,
    deniedCount: deniedFieldIds.length,
  };

  await logPermissionDenial(tenantId, userId, details);

  throw new ForbiddenError(
    `You don't have permission to ${action} ${deniedFieldIds.length} field(s).`,
    {
      action,
      resource: 'field',
      fieldIds: deniedFieldIds,
      deniedCount: deniedFieldIds.length,
    },
  );
}

// ---------------------------------------------------------------------------
// filterHiddenFields
// ---------------------------------------------------------------------------

/**
 * Strip keys from a record where the field permission is 'hidden'.
 *
 * Returns a new object — never mutates the input.
 */
export function filterHiddenFields<T extends Record<string, unknown>>(
  record: T,
  permissionMap: FieldPermissionMap,
): T {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(record)) {
    const state = permissionMap.get(key);
    if (state !== 'hidden') {
      result[key] = record[key];
    }
  }

  return result as T;
}

// ---------------------------------------------------------------------------
// Test utility — allows injecting a mock Redis client
// ---------------------------------------------------------------------------

/** @internal — for tests only */
export function setRedisClient(client: ReturnType<typeof createRedisClient> | null): void {
  redisClient = client;
}
