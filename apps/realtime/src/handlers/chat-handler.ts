import type { Socket, Server } from 'socket.io';
import { realtimeLogger } from '@everystack/shared/logging';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import { authorizeRoomJoin } from './authorize-room-join';
import type { PresenceService } from '../services/presence-service';
import type { ChatEvent, TypingEvent } from '../types/chat';
import { CHAT_PRESENCE_STATES } from '../types/chat';

const logger = realtimeLogger;

interface ThreadCallback {
  (response: { ok: boolean }): void;
}

/**
 * Registers chat event handlers on a socket.
 *
 * Client → Server events:
 * - thread:join — join thread room, validate tenant, set presence
 * - thread:leave — leave thread room, remove presence
 * - typing:start — broadcast to thread room excluding sender
 * - typing:stop — broadcast stop event to thread room excluding sender
 *
 * Server-side broadcast (called by chat-event-subscriber, Prompt 10):
 * - broadcastMessageToThread() — message:new, message:edit, message:delete
 *
 * @see docs/reference/realtime.md § Room Model, Chat / DM Message Delivery
 */
export function registerChatHandlers(
  socket: Socket,
  io: Server,
  presenceService: PresenceService,
): void {
  const userId = socket.data['userId'] as string;
  const tenantId = socket.data['tenantId'] as string;

  socket.on('thread:join', (threadId: string, callback?: ThreadCallback) => {
    void handleThreadJoin(socket, io, presenceService, threadId, userId, tenantId, callback);
  });

  socket.on('thread:leave', (threadId: string) => {
    void handleThreadLeave(socket, presenceService, threadId, userId, tenantId);
  });

  socket.on('typing:start', (data: { threadId: string; displayName: string }) => {
    handleTypingStart(socket, data.threadId, userId, tenantId, data.displayName);
  });

  socket.on('typing:stop', (data: { threadId: string }) => {
    handleTypingStop(socket, data.threadId, userId, tenantId);
  });
}

async function handleThreadJoin(
  socket: Socket,
  io: Server,
  presenceService: PresenceService,
  threadId: string,
  userId: string,
  tenantId: string,
  callback?: ThreadCallback,
): Promise<void> {
  try {
    const roomId = `thread:${threadId}`;
    const authorized = await authorizeRoomJoin({ roomId, userId, tenantId });

    if (!authorized) {
      logger.info(
        { socketId: socket.id, userId, tenantId, threadId },
        'Thread join denied',
      );
      callback?.({ ok: false });
      return;
    }

    const fullRoomName = `t:${tenantId}:thread:${threadId}`;
    await socket.join(fullRoomName);

    // Set presence in thread room
    await presenceService.setPresence(tenantId, `thread:${threadId}`, userId, CHAT_PRESENCE_STATES.ONLINE);

    logger.info(
      { socketId: socket.id, userId, tenantId, threadId, fullRoomName },
      'Thread joined',
    );

    callback?.({ ok: true });
  } catch (err) {
    logger.error(
      { socketId: socket.id, userId, tenantId, threadId, err },
      'Thread join error',
    );
    callback?.({ ok: false });
  }
}

async function handleThreadLeave(
  socket: Socket,
  presenceService: PresenceService,
  threadId: string,
  userId: string,
  tenantId: string,
): Promise<void> {
  const fullRoomName = `t:${tenantId}:thread:${threadId}`;
  void socket.leave(fullRoomName);

  // Remove presence from thread room
  try {
    await presenceService.removePresence(tenantId, `thread:${threadId}`, userId);
  } catch (err) {
    logger.warn(
      { socketId: socket.id, userId, tenantId, threadId, err },
      'Failed to remove presence on thread leave',
    );
  }

  logger.info(
    { socketId: socket.id, userId, tenantId, threadId, fullRoomName },
    'Thread left',
  );
}

function handleTypingStart(
  socket: Socket,
  threadId: string,
  userId: string,
  tenantId: string,
  displayName: string,
): void {
  const fullRoomName = `t:${tenantId}:thread:${threadId}`;
  const event: TypingEvent = { threadId, userId, displayName };

  // Broadcast to room excluding sender
  socket.to(fullRoomName).emit(REALTIME_EVENTS.TYPING_START, event);

  logger.debug(
    { socketId: socket.id, userId, tenantId, threadId },
    'Typing start',
  );
}

function handleTypingStop(
  socket: Socket,
  threadId: string,
  userId: string,
  tenantId: string,
): void {
  const fullRoomName = `t:${tenantId}:thread:${threadId}`;
  const event: TypingEvent = { threadId, userId, displayName: '' };

  // Broadcast to room excluding sender
  socket.to(fullRoomName).emit(REALTIME_EVENTS.TYPING_STOP, event);

  logger.debug(
    { socketId: socket.id, userId, tenantId, threadId },
    'Typing stop',
  );
}

/**
 * Broadcast a message event to a thread room.
 * Called by the chat-event-subscriber (Prompt 10) when a message is received
 * from Redis pub/sub. Not called directly by clients.
 *
 * @param io - Socket.IO server instance
 * @param tenantId - Tenant ID for room scoping
 * @param threadId - Target thread ID
 * @param event - Chat event (message:new, message:edit, message:delete)
 * @param excludeUserId - Optional userId to exclude from broadcast (sender)
 */
export function broadcastMessageToThread(
  io: Server,
  tenantId: string,
  threadId: string,
  event: ChatEvent,
  excludeUserId?: string,
): void {
  const fullRoomName = `t:${tenantId}:thread:${threadId}`;
  const eventName = event.type as string;

  if (excludeUserId) {
    const excludeRoom = `t:${tenantId}:user:${excludeUserId}`;
    io.to(fullRoomName).except(excludeRoom).emit(eventName, event.payload);
  } else {
    io.to(fullRoomName).emit(eventName, event.payload);
  }

  logger.debug(
    { tenantId, threadId, eventType: event.type, excludeUserId },
    'Message broadcast to thread',
  );
}
