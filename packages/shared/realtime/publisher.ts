import type Redis from 'ioredis';
import type { RealtimeEventName } from './events';

/**
 * Options for publishing a real-time event through the Redis event bus.
 * Workers and Server Actions use this to publish; the realtime service subscribes and forwards.
 */
export interface PublishEventOptions {
  /** Tenant ID for channel scoping */
  tenantId: string;
  /** Room pattern (e.g. 'table:{tableId}', 'workspace:{workspaceId}') */
  channel: string;
  /** Event name from REALTIME_EVENTS */
  event: RealtimeEventName;
  /** Event payload */
  payload: unknown;
  /** Optional userId to exclude from receiving the event (prevents sender echo) */
  excludeUserId?: string;
}

/**
 * Payload shape written to Redis pub/sub channel.
 * The redis-event-subscriber parses this on the other side.
 */
export interface RedisEventPayload {
  event: RealtimeEventName;
  payload: unknown;
  excludeUserId?: string;
  timestamp: number;
}

/** Redis channel prefix for all realtime events */
const CHANNEL_PREFIX = 'realtime:';

/**
 * Builds the full Redis channel name for a tenant-scoped room.
 * Format: realtime:t:{tenantId}:{channel}
 */
export function buildChannel(tenantId: string, channel: string): string {
  return `${CHANNEL_PREFIX}t:${tenantId}:${channel}`;
}

/**
 * Publishes real-time events to Redis for fanout to Socket.io clients.
 *
 * Usage:
 * ```ts
 * const publisher = createEventPublisher(redis);
 * await publisher.publish({
 *   tenantId: 'abc',
 *   channel: 'table:xyz',
 *   event: REALTIME_EVENTS.RECORD_UPDATED,
 *   payload: { recordId: '123', fields: {...} },
 *   excludeUserId: 'user-who-made-the-edit',
 * });
 * ```
 */
export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(options: PublishEventOptions): Promise<void> {
    const { tenantId, channel, event, payload, excludeUserId } = options;

    const redisChannel = buildChannel(tenantId, channel);

    const message: RedisEventPayload = {
      event,
      payload,
      timestamp: Date.now(),
    };

    if (excludeUserId) {
      message.excludeUserId = excludeUserId;
    }

    await this.redis.publish(redisChannel, JSON.stringify(message));
  }
}

/**
 * Factory function to create an EventPublisher.
 * Accepts any ioredis client (should be a separate client from the subscriber).
 */
export function createEventPublisher(redis: Redis): EventPublisher {
  return new EventPublisher(redis);
}
