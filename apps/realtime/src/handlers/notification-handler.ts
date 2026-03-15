import type { Socket } from 'socket.io';
import type { Redis } from 'ioredis';
import { realtimeLogger } from '@everystack/shared/logging';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { PresenceService } from '../services/presence-service';
import { CHAT_PRESENCE_STATES } from '../types/chat';

const logger = realtimeLogger;

/**
 * Notification payload received from Redis pub/sub.
 * Published by NotificationService (Prompt 5) via publishNotificationEvent (Prompt 10).
 *
 * Known type values: 'mention', 'dm', 'thread_reply', 'record_update',
 * 'assignment', 'system'. VARCHAR — not exhaustive.
 */
interface NotificationPayload {
  id: string;
  /** Known values: 'mention', 'dm', 'thread_reply', 'record_update', 'assignment', 'system' */
  type: string;
  title: string;
  body?: string;
  /** Known values: 'owner', 'admin', 'member' */
  senderRole?: string;
  metadata?: Record<string, unknown>;
}

/** Notification types that bypass DND suppression. */
const DND_BYPASS_TYPES = new Set(['mention', 'dm']);

/** Sender roles whose DM notifications bypass DND. */
const DND_BYPASS_ROLES = new Set(['owner']);

/**
 * Builds the Redis channel name for a user's notification stream.
 */
export function buildNotificationChannel(userId: string): string {
  return `user:${userId}:notifications`;
}

/**
 * Registers notification event handlers on a socket.
 *
 * On connect: subscribes to Redis channel `user:{userId}:notifications`.
 * On notification: pushes payload to client via Socket.IO `notification:new`,
 * with DND suppression logic.
 * On disconnect: unsubscribes from Redis channel.
 *
 * IMPORTANT: The `notificationRedis` client must be in subscriber mode
 * (supports subscribe/unsubscribe). It is shared across all sockets —
 * ioredis allows multiple channel subscriptions on a single client.
 *
 * @see docs/reference/realtime.md § Event Flow
 */
export function registerNotificationHandlers(
  socket: Socket,
  notificationRedis: Redis,
  presenceService: PresenceService,
): void {
  const userId = socket.data['userId'] as string;
  const tenantId = socket.data['tenantId'] as string;
  const channel = buildNotificationChannel(userId);

  // Message handler for this socket's user channel
  const messageHandler = (_channel: string, message: string) => {
    void handleNotificationMessage(socket, presenceService, userId, tenantId, _channel, channel, message);
  };

  // Subscribe to the user's notification channel
  void subscribeToNotifications(notificationRedis, channel, messageHandler, socket.id);

  // Unsubscribe on disconnect
  socket.on('disconnect', () => {
    void unsubscribeFromNotifications(notificationRedis, channel, messageHandler, socket.id);
  });
}

async function subscribeToNotifications(
  redis: Redis,
  channel: string,
  handler: (channel: string, message: string) => void,
  socketId: string,
): Promise<void> {
  try {
    await redis.subscribe(channel);
    redis.on('message', handler);

    logger.debug(
      { socketId, channel },
      'Subscribed to notification channel',
    );
  } catch (err) {
    logger.warn(
      { socketId, channel, err },
      'Failed to subscribe to notification channel',
    );
  }
}

async function unsubscribeFromNotifications(
  redis: Redis,
  channel: string,
  handler: (channel: string, message: string) => void,
  socketId: string,
): Promise<void> {
  try {
    redis.removeListener('message', handler);
    await redis.unsubscribe(channel);

    logger.debug(
      { socketId, channel },
      'Unsubscribed from notification channel',
    );
  } catch (err) {
    logger.warn(
      { socketId, channel, err },
      'Failed to unsubscribe from notification channel',
    );
  }
}

async function handleNotificationMessage(
  socket: Socket,
  presenceService: PresenceService,
  userId: string,
  tenantId: string,
  receivedChannel: string,
  expectedChannel: string,
  rawMessage: string,
): Promise<void> {
  // Only handle messages for this user's channel
  if (receivedChannel !== expectedChannel) return;

  let notification: NotificationPayload;
  try {
    notification = JSON.parse(rawMessage) as NotificationPayload;
  } catch {
    logger.warn(
      { socketId: socket.id, userId, rawMessage },
      'Malformed notification message — skipping',
    );
    return;
  }

  // DND suppression check
  const userState = await presenceService.getUserStatus(tenantId, userId);

  if (userState === CHAT_PRESENCE_STATES.DND) {
    if (!shouldBypassDnd(notification)) {
      logger.debug(
        { socketId: socket.id, userId, notificationType: notification.type },
        'Notification suppressed by DND',
      );
      return;
    }
  }

  // Push to client
  socket.emit(REALTIME_EVENTS.NOTIFICATION_NEW, notification);

  logger.debug(
    { socketId: socket.id, userId, notificationType: notification.type },
    'Notification pushed to client',
  );
}

/**
 * Determines if a notification should bypass DND suppression.
 * Only 'mention' notifications and 'dm' from Owners bypass DND.
 */
function shouldBypassDnd(notification: NotificationPayload): boolean {
  if (!DND_BYPASS_TYPES.has(notification.type)) {
    return false;
  }

  // Mentions always bypass DND
  if (notification.type === 'mention') {
    return true;
  }

  // DMs bypass only if from an Owner
  if (notification.type === 'dm') {
    return DND_BYPASS_ROLES.has(notification.senderRole ?? '');
  }

  return false;
}
