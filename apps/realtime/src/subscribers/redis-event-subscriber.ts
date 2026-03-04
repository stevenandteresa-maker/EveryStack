import type Redis from 'ioredis';
import type { Server } from 'socket.io';
import { realtimeLogger } from '@everystack/shared/logging';
import type { RedisEventPayload } from '@everystack/shared/realtime';

const logger = realtimeLogger;

/** Redis channel pattern for all realtime events */
const SUBSCRIBE_PATTERN = 'realtime:t:*';

/** Prefix to strip from Redis channel to get the Socket.io room name */
const CHANNEL_PREFIX = 'realtime:';

/**
 * Subscribes to the Redis event bus and forwards events to Socket.io rooms.
 *
 * IMPORTANT: Uses a SEPARATE Redis client in subscribe mode.
 * Redis clients in subscribe mode cannot run other commands.
 *
 * Channel format: realtime:t:{tenantId}:{roomPattern}
 * Room name (after stripping prefix): t:{tenantId}:{roomPattern}
 *
 * If excludeUserId is set in the payload, the event is broadcast to the room
 * except to sockets belonging to that user (using Socket.io's except()).
 */
export async function startRedisEventSubscriber(
  subscriberRedis: Redis,
  io: Server,
): Promise<void> {
  await subscriberRedis.psubscribe(SUBSCRIBE_PATTERN);

  logger.info(
    { pattern: SUBSCRIBE_PATTERN },
    'Redis event subscriber started',
  );

  subscriberRedis.on(
    'pmessage',
    (_pattern: string, channel: string, message: string) => {
      handleMessage(io, channel, message);
    },
  );
}

function handleMessage(io: Server, channel: string, rawMessage: string): void {
  let parsed: RedisEventPayload;

  try {
    parsed = JSON.parse(rawMessage) as RedisEventPayload;
  } catch {
    logger.error(
      { channel, rawMessage },
      'Malformed message from Redis — skipping',
    );
    return;
  }

  if (!parsed.event) {
    logger.error(
      { channel, parsed },
      'Missing event name in Redis message — skipping',
    );
    return;
  }

  // Strip "realtime:" prefix to get the Socket.io room name
  const roomName = channel.slice(CHANNEL_PREFIX.length);

  const { event, payload, excludeUserId } = parsed;

  if (excludeUserId) {
    // Broadcast to room, excluding sockets for the specified user
    // User's personal room is t:{tenantId}:user:{userId}
    // We extract tenantId from the room name to build the exclude room
    const tenantIdMatch = roomName.match(/^t:([^:]+):/);
    const tenantId = tenantIdMatch?.[1];

    if (tenantId) {
      const excludeRoom = `t:${tenantId}:user:${excludeUserId}`;
      io.to(roomName).except(excludeRoom).emit(event, payload);
    } else {
      // Fallback: broadcast without exclusion
      io.to(roomName).emit(event, payload);
    }
  } else {
    io.to(roomName).emit(event, payload);
  }
}
