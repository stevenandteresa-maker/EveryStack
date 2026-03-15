/**
 * Server-side chat event publisher.
 *
 * Publishes message events (new, edit, delete) to Redis for cross-process
 * delivery via the realtime server's chat-event-subscriber.
 *
 * Fire-and-forget — failure is logged but never blocks the calling action.
 *
 * @see docs/reference/realtime.md § Chat / DM Message Delivery
 */

import {
  REALTIME_EVENTS,
  createEventPublisher,
} from '@everystack/shared/realtime';
import type { RealtimeEventName } from '@everystack/shared/realtime';
import { createRedisClient } from '@everystack/shared/redis';
import { webLogger } from '@everystack/shared/logging';

const logger = webLogger.child({ service: 'chat-events' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Chat event published to Redis for thread-scoped delivery. */
export interface ChatEventPayload {
  /** Known values: 'message:new', 'message:edit', 'message:delete' */
  type: string;
  threadId: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Redis singleton (lazy)
// ---------------------------------------------------------------------------

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('web:chat-events');
  }
  return redisClient;
}

/** @internal Exposed for testing — replaces the Redis client. */
export function setRedisClient(client: ReturnType<typeof createRedisClient> | null): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// Event type mapping
// ---------------------------------------------------------------------------

const EVENT_TYPE_MAP: Record<string, RealtimeEventName> = {
  'message:new': REALTIME_EVENTS.MESSAGE_NEW,
  'message:edit': REALTIME_EVENTS.MESSAGE_EDIT,
  'message:delete': REALTIME_EVENTS.MESSAGE_DELETE,
};

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/**
 * Publish a chat event to the Redis event bus.
 *
 * The realtime server's chat-event-subscriber picks this up and forwards
 * it to all Socket.IO clients in the matching thread room.
 *
 * Fire-and-forget: errors are logged but never thrown. The calling server
 * action must not be blocked by realtime delivery failures.
 *
 * @param tenantId - Tenant ID for channel scoping
 * @param threadId - Target thread ID
 * @param event - Chat event with type, threadId, and payload
 * @param excludeUserId - Optional userId to exclude from broadcast (sender)
 */
export async function publishChatEvent(
  tenantId: string,
  threadId: string,
  event: ChatEventPayload,
  excludeUserId?: string,
): Promise<void> {
  try {
    const eventName = EVENT_TYPE_MAP[event.type];
    if (!eventName) {
      logger.warn(
        { tenantId, threadId, eventType: event.type },
        'Unknown chat event type — skipping publish',
      );
      return;
    }

    const publisher = createEventPublisher(getRedis());

    await publisher.publish({
      tenantId,
      channel: `thread:${threadId}`,
      event: eventName,
      payload: event.payload,
      excludeUserId,
    });

    logger.debug(
      { tenantId, threadId, eventType: event.type },
      'Chat event published',
    );
  } catch (error) {
    logger.warn(
      { tenantId, threadId, eventType: event.type, err: error },
      'Failed to publish chat event — fire-and-forget',
    );
    // Intentionally swallowed — fire-and-forget
  }
}
