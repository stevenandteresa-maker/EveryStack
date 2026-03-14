/**
 * Command Bar Sessions — analytics tracking for Command Bar usage.
 *
 * - Creates a session row on open (with context)
 * - Updates with messages + result_set on close
 *
 * @see packages/shared/db/schema/command-bar-sessions.ts
 */

import {
  getDbForTenant,
  eq,
  commandBarSessions,
} from '@everystack/shared/db';
import type { CommandBarSession } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionContext {
  mode: 'global' | 'scoped';
  scopedTableId?: string;
  currentPath?: string;
  [key: string]: unknown;
}

export interface SessionCloseData {
  messages: Array<{ query: string; channel: string; timestamp: string }>;
  resultSet: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Create session (on open)
// ---------------------------------------------------------------------------

export async function createCommandBarSession(
  userId: string,
  tenantId: string,
  context: SessionContext,
): Promise<string> {
  const db = getDbForTenant(tenantId, 'write');

  const rows = await db
    .insert(commandBarSessions)
    .values({
      userId,
      tenantId,
      context: context as unknown as Record<string, unknown>,
    })
    .returning({ id: commandBarSessions.id });

  return rows[0]!.id;
}

// ---------------------------------------------------------------------------
// Close session (on close)
// ---------------------------------------------------------------------------

export async function closeCommandBarSession(
  sessionId: string,
  tenantId: string,
  data: SessionCloseData,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(commandBarSessions)
    .set({
      messages: data.messages as Record<string, unknown>[],
      resultSet: data.resultSet,
    })
    .where(eq(commandBarSessions.id, sessionId));
}

// ---------------------------------------------------------------------------
// Get session (for testing/debugging)
// ---------------------------------------------------------------------------

export async function getCommandBarSession(
  sessionId: string,
  tenantId: string,
): Promise<CommandBarSession | undefined> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(commandBarSessions)
    .where(eq(commandBarSessions.id, sessionId))
    .limit(1);

  return rows[0];
}
