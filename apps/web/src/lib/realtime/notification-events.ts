/**
 * Server-side notification event publisher.
 *
 * Publishes notification events to Redis channel `user:{userId}:notifications`
 * for delivery via the realtime server's notification-handler.
 *
 * Fire-and-forget — failure is logged but never blocks the calling service.
 *
 * @see docs/reference/realtime.md § Event Flow
 * @see apps/realtime/src/handlers/notification-handler.ts
 */

import { createRedisClient } from '@everystack/shared/redis';
import { webLogger } from '@everystack/shared/logging';

const logger = webLogger.child({ service: 'notification-events' });

// ---------------------------------------------------------------------------
// Redis singleton (lazy)
// ---------------------------------------------------------------------------

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('web:notification-events');
  }
  return redisClient;
}

/** @internal Exposed for testing — replaces the Redis client. */
export function setRedisClient(client: ReturnType<typeof createRedisClient> | null): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/**
 * Publish a notification event to the Redis channel for a specific user.
 *
 * The realtime server's notification-handler subscribes to
 * `user:{userId}:notifications` and pushes the payload to the client
 * via Socket.IO with DND suppression.
 *
 * Fire-and-forget: errors are logged but never thrown.
 *
 * @param userId - Target user ID
 * @param notification - Notification payload (already persisted to DB)
 */
export async function publishNotificationEvent(
  userId: string,
  notification: unknown,
): Promise<void> {
  try {
    const redis = getRedis();
    await redis.publish(
      `user:${userId}:notifications`,
      JSON.stringify(notification),
    );

    logger.debug(
      { userId },
      'Notification event published',
    );
  } catch (error) {
    logger.warn(
      { userId, err: error },
      'Failed to publish notification event — fire-and-forget',
    );
    // Intentionally swallowed — fire-and-forget
  }
}
