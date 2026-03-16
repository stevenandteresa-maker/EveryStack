import type Redis from 'ioredis';
import type { Server } from 'socket.io';
import { realtimeLogger } from '@everystack/shared/logging';
import { broadcastMessageToThread } from '../handlers/chat-handler';
import type { ChatEvent } from '../types/chat';

const logger = realtimeLogger;

/**
 * Redis channel pattern for chat thread events.
 *
 * Publishers write to `realtime:t:{tenantId}:thread:{threadId}`.
 * This subscriber uses the existing redis-event-subscriber's
 * `realtime:t:*` pattern, which already covers thread channels.
 *
 * This module provides the handler logic for thread-specific events
 * that are forwarded by the main redis-event-subscriber.
 */

/** Redis channel pattern for thread events (matched by main subscriber) */
const THREAD_CHANNEL_REGEX = /^t:([^:]+):thread:(.+)$/;

/** Chat event names that this subscriber handles */
const CHAT_EVENT_NAMES = new Set([
  'message.new',
  'message.edit',
  'message.delete',
]);

/**
 * Checks if a room name matches a thread channel pattern.
 *
 * @param roomName - The Socket.IO room name (after stripping 'realtime:' prefix)
 * @returns Parsed tenant and thread IDs, or null if not a thread channel
 */
export function parseThreadRoom(roomName: string): { tenantId: string; threadId: string } | null {
  const match = roomName.match(THREAD_CHANNEL_REGEX);
  if (!match) return null;
  return { tenantId: match[1]!, threadId: match[2]! };
}

/**
 * Checks if an event name is a chat event that should be handled by this subscriber.
 */
export function isChatEvent(eventName: string): boolean {
  return CHAT_EVENT_NAMES.has(eventName);
}

/**
 * Handles a chat event received from the Redis event bus.
 *
 * Called by the main redis-event-subscriber when an event on a thread channel
 * is identified as a chat event. Forwards the event to the appropriate
 * Socket.IO thread room via broadcastMessageToThread.
 *
 * @param io - Socket.IO server instance
 * @param tenantId - Tenant ID extracted from channel
 * @param threadId - Thread ID extracted from channel
 * @param eventName - Event name (message.new, message.edit, message.delete)
 * @param payload - Event payload
 * @param excludeUserId - Optional user to exclude from broadcast
 */
export function handleChatEvent(
  io: Server,
  tenantId: string,
  threadId: string,
  eventName: string,
  payload: unknown,
  excludeUserId?: string,
): void {
  const chatEvent: ChatEvent = {
    type: eventName,
    threadId,
    payload,
  };

  broadcastMessageToThread(io, tenantId, threadId, chatEvent, excludeUserId);

  logger.debug(
    { tenantId, threadId, eventName, excludeUserId },
    'Chat event forwarded to thread room',
  );
}

/**
 * Starts a dedicated Redis pattern subscriber for thread chat events.
 *
 * NOTE: The existing redis-event-subscriber already subscribes to `realtime:t:*`
 * which covers thread channels. This function provides an ALTERNATIVE approach
 * using a dedicated subscriber specifically for thread events, useful if
 * thread events need separate processing or a dedicated Redis client.
 *
 * For the MVP, chat events flow through the existing redis-event-subscriber.
 * This function is provided for future horizontal scaling where thread events
 * may need dedicated subscribers.
 *
 * @param subscriberRedis - Dedicated Redis client in subscribe mode
 * @param io - Socket.IO server instance
 */
export async function startChatEventSubscriber(
  subscriberRedis: Redis,
  io: Server,
): Promise<void> {
  const pattern = 'realtime:t:*:thread:*';
  await subscriberRedis.psubscribe(pattern);

  logger.info(
    { pattern },
    'Chat event subscriber started',
  );

  subscriberRedis.on(
    'pmessage',
    (_pattern: string, channel: string, message: string) => {
      handleChatMessage(io, channel, message);
    },
  );
}

/**
 * Parses and routes a raw Redis message from a thread channel.
 */
function handleChatMessage(io: Server, channel: string, rawMessage: string): void {
  // Strip "realtime:" prefix to get room name
  const roomName = channel.slice('realtime:'.length);
  const parsed = parseThreadRoom(roomName);

  if (!parsed) {
    logger.warn(
      { channel },
      'Chat subscriber received non-thread channel — skipping',
    );
    return;
  }

  let payload: { event?: string; payload?: unknown; excludeUserId?: string };
  try {
    payload = JSON.parse(rawMessage) as typeof payload;
  } catch {
    logger.error(
      { channel, rawMessage },
      'Malformed chat message from Redis — skipping',
    );
    return;
  }

  if (!payload.event) {
    logger.error(
      { channel, payload },
      'Missing event name in chat message — skipping',
    );
    return;
  }

  if (!isChatEvent(payload.event)) {
    // Not a chat event — the main subscriber handles it
    return;
  }

  handleChatEvent(
    io,
    parsed.tenantId,
    parsed.threadId,
    payload.event,
    payload.payload,
    payload.excludeUserId,
  );
}
