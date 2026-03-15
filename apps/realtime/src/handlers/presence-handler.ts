import type { Socket, Server } from 'socket.io';
import { realtimeLogger } from '@everystack/shared/logging';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { PresenceService } from '../services/presence-service';
import type { ChatPresenceState, CustomStatus } from '../types/chat';

const logger = realtimeLogger;

/**
 * Registers presence event handlers on a socket.
 *
 * Client → Server events:
 * - presence:heartbeat — refreshes TTL on all presence keys for the user
 * - presence:update — user sets presence state (e.g., DND toggle), broadcasts to workspace room
 * - presence:status — request current user's presence state
 *
 * On disconnect: removes presence from all rooms.
 *
 * @see docs/reference/realtime.md § Presence System
 * @see docs/reference/communications.md § Presence & Status
 */
export function registerPresenceHandlers(
  socket: Socket,
  io: Server,
  presenceService: PresenceService,
): void {
  const userId = socket.data['userId'] as string;
  const tenantId = socket.data['tenantId'] as string;

  socket.on('presence:heartbeat', () => {
    void handleHeartbeat(presenceService, userId, tenantId);
  });

  socket.on(
    'presence:update',
    (data: { state: ChatPresenceState; workspaceId?: string; customStatus?: CustomStatus }) => {
      void handlePresenceUpdate(socket, io, presenceService, userId, tenantId, data);
    },
  );

  socket.on(
    'presence:status',
    (callback?: (response: { state: ChatPresenceState }) => void) => {
      void handlePresenceStatus(presenceService, userId, tenantId, callback);
    },
  );

  // Clean up presence on disconnect
  socket.on('disconnect', () => {
    void handleDisconnectCleanup(socket, presenceService, userId, tenantId);
  });
}

async function handleHeartbeat(
  presenceService: PresenceService,
  userId: string,
  tenantId: string,
): Promise<void> {
  try {
    await presenceService.heartbeat(tenantId, userId);
  } catch (err) {
    logger.warn(
      { userId, tenantId, err },
      'Presence heartbeat failed',
    );
  }
}

async function handlePresenceUpdate(
  socket: Socket,
  io: Server,
  presenceService: PresenceService,
  userId: string,
  tenantId: string,
  data: { state: ChatPresenceState; workspaceId?: string; customStatus?: CustomStatus },
): Promise<void> {
  try {
    // Set presence in a general workspace room if workspaceId is provided
    const roomId = data.workspaceId
      ? `workspace:${data.workspaceId}`
      : `user:${userId}`;

    await presenceService.setPresence(tenantId, roomId, userId, data.state);

    // Broadcast presence update to workspace room if workspaceId provided
    if (data.workspaceId) {
      const workspaceRoom = `t:${tenantId}:workspace:${data.workspaceId}`;
      socket.to(workspaceRoom).emit(REALTIME_EVENTS.PRESENCE_UPDATE, {
        userId,
        state: data.state,
        customStatus: data.customStatus,
      });
    }

    logger.debug(
      { userId, tenantId, state: data.state, workspaceId: data.workspaceId },
      'Presence updated',
    );
  } catch (err) {
    logger.warn(
      { userId, tenantId, err },
      'Presence update failed',
    );
  }
}

async function handlePresenceStatus(
  presenceService: PresenceService,
  userId: string,
  tenantId: string,
  callback?: (response: { state: ChatPresenceState }) => void,
): Promise<void> {
  try {
    const state = await presenceService.getUserStatus(tenantId, userId);
    callback?.({ state });
  } catch (err) {
    logger.warn(
      { userId, tenantId, err },
      'Presence status query failed',
    );
    callback?.({ state: 'offline' });
  }
}

/**
 * Remove presence from all rooms on disconnect.
 * Scans for all presence keys belonging to this user and deletes them.
 */
async function handleDisconnectCleanup(
  socket: Socket,
  presenceService: PresenceService,
  userId: string,
  tenantId: string,
): Promise<void> {
  try {
    // Get all rooms this socket was in and remove presence for thread/workspace rooms
    for (const room of socket.rooms) {
      // Skip the socket's own room (socket.id)
      if (room === socket.id) continue;

      // Room format: t:{tenantId}:{resourceType}:{resourceId}
      // Extract the roomId portion (after t:{tenantId}:)
      const prefix = `t:${tenantId}:`;
      if (!room.startsWith(prefix)) continue;

      const roomId = room.slice(prefix.length);
      await presenceService.removePresence(tenantId, roomId, userId);
    }

    logger.debug(
      { socketId: socket.id, userId, tenantId },
      'Presence cleaned up on disconnect',
    );
  } catch (err) {
    logger.warn(
      { socketId: socket.id, userId, tenantId, err },
      'Presence disconnect cleanup failed',
    );
  }
}
