import {
  getDbForTenant,
  eq,
  and,
  workspaceMemberships,
  tables,
  records,
  threads,
} from '@everystack/shared/db';
import { realtimeLogger } from '@everystack/shared/logging';

const logger = realtimeLogger;

/**
 * Supported room resource types for authorization.
 * Each type maps to a specific authorization strategy.
 */
type ResourceType = 'user' | 'workspace' | 'table' | 'record' | 'thread';

interface AuthorizeRoomJoinParams {
  roomId: string;
  userId: string;
  tenantId: string;
}

interface ParsedRoom {
  resourceType: ResourceType;
  resourceId: string;
}

const VALID_RESOURCE_TYPES = new Set<string>([
  'user',
  'workspace',
  'table',
  'record',
  'thread',
]);

/**
 * Parses a room ID into resource type and resource ID.
 * Room format: `{resourceType}:{resourceId}`
 */
export function parseRoomId(roomId: string): ParsedRoom | null {
  const colonIndex = roomId.indexOf(':');
  if (colonIndex === -1) return null;

  const resourceType = roomId.slice(0, colonIndex);
  const resourceId = roomId.slice(colonIndex + 1);

  if (!resourceType || !resourceId) return null;
  if (!VALID_RESOURCE_TYPES.has(resourceType)) return null;

  return { resourceType: resourceType as ResourceType, resourceId };
}

/**
 * Authorizes a user to join a room based on room type and resource access.
 *
 * Authorization rules:
 * - user:{id} — only own userId
 * - workspace:{id} — check workspace membership
 * - table:{id} — check table access via workspace membership
 * - record:{id} — check record access via workspace membership
 * - thread:{id} — check thread access via workspace membership
 *
 * Returns true if authorized, false if denied.
 * Silent denial — no error details to prevent resource enumeration.
 */
export async function authorizeRoomJoin({
  roomId,
  userId,
  tenantId,
}: AuthorizeRoomJoinParams): Promise<boolean> {
  const parsed = parseRoomId(roomId);
  if (!parsed) {
    logger.warn({ roomId, userId }, 'Invalid room pattern');
    return false;
  }

  const { resourceType, resourceId } = parsed;

  switch (resourceType) {
    case 'user':
      return authorizeUserRoom(resourceId, userId);
    case 'workspace':
      return authorizeWorkspaceRoom(resourceId, userId, tenantId);
    case 'table':
      return authorizeTableRoom(resourceId, userId, tenantId);
    case 'record':
      return authorizeRecordRoom(resourceId, userId, tenantId);
    case 'thread':
      return authorizeThreadRoom(resourceId, userId, tenantId);
    default:
      return false;
  }
}

/**
 * user:{userId} — only the owner can join their own user room.
 */
function authorizeUserRoom(resourceId: string, userId: string): boolean {
  return resourceId === userId;
}

/**
 * workspace:{workspaceId} — user must have an active workspace membership.
 */
async function authorizeWorkspaceRoom(
  workspaceId: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const db = getDbForTenant(tenantId, 'read');

  const [membership] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.tenantId, tenantId),
      ),
    )
    .limit(1);

  return !!membership;
}

/**
 * table:{tableId} — user must have workspace membership for the table's workspace.
 * TODO: Full permission resolution (field-level) in Core UX phase.
 */
async function authorizeTableRoom(
  tableId: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const db = getDbForTenant(tenantId, 'read');

  // Look up the table to find its workspace
  const [table] = await db
    .select({ workspaceId: tables.workspaceId })
    .from(tables)
    .where(and(eq(tables.id, tableId), eq(tables.tenantId, tenantId)))
    .limit(1);

  if (!table) return false;

  return authorizeWorkspaceRoom(table.workspaceId, userId, tenantId);
}

/**
 * record:{recordId} — user must have workspace membership for the record's table's workspace.
 * TODO: Full permission resolution in Core UX phase.
 */
async function authorizeRecordRoom(
  recordId: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const db = getDbForTenant(tenantId, 'read');

  // Look up the record to find its table
  const [record] = await db
    .select({ tableId: records.tableId })
    .from(records)
    .where(and(eq(records.id, recordId), eq(records.tenantId, tenantId)))
    .limit(1);

  if (!record) return false;

  return authorizeTableRoom(record.tableId, userId, tenantId);
}

/**
 * thread:{threadId} — user must have workspace membership for the thread's scope.
 * Thread scopeType can be 'record', 'workspace', etc.
 * TODO: Full permission resolution in Core UX phase.
 */
async function authorizeThreadRoom(
  threadId: string,
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const db = getDbForTenant(tenantId, 'read');

  const [thread] = await db
    .select({ scopeType: threads.scopeType, scopeId: threads.scopeId })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.tenantId, tenantId)))
    .limit(1);

  if (!thread) return false;

  // For now, check workspace membership based on scope type.
  // Thread scopes: 'record' (needs table→workspace), 'workspace' (direct), 'dm' (always allowed for participants)
  // Simplified: check that user has at least one workspace membership in this tenant.
  // Full permission resolution deferred to Core UX.
  const [membership] = await db
    .select({ id: workspaceMemberships.id })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.userId, userId),
        eq(workspaceMemberships.tenantId, tenantId),
      ),
    )
    .limit(1);

  return !!membership;
}
