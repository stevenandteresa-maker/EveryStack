import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from '@everystack/shared/redis';
import { realtimeLogger } from '@everystack/shared/logging';
import { authenticateSocket } from './middleware/auth';
import { registerRoomHandlers } from './handlers/room-handler';
import { registerLockHandlers } from './handlers/lock-handler';
import { registerChatHandlers } from './handlers/chat-handler';
import { registerPresenceHandlers } from './handlers/presence-handler';
import { registerNotificationHandlers } from './handlers/notification-handler';
import { startRedisEventSubscriber } from './subscribers/redis-event-subscriber';
import { PresenceService } from './services/presence-service';

const logger = realtimeLogger;

const REALTIME_PORT = Number(process.env['REALTIME_PORT'] ?? '3002');
const WEB_APP_URL = process.env['WEB_APP_URL'] ?? 'http://localhost:3000';

/**
 * Creates and configures the Socket.io server with Redis adapter.
 * Returns the HTTP server and Socket.io instance for lifecycle management.
 */
export function createRealtimeServer() {
  const httpServer = createServer();

  const io = new Server(httpServer, {
    cors: {
      origin: WEB_APP_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 20_000,
    pingInterval: 25_000,
  });

  // Redis adapter for horizontal scaling
  const pubClient = createRedisClient('realtime-pub');
  const subClient = createRedisClient('realtime-sub');

  // Dedicated Redis client for event subscriber (subscribe mode — cannot run other commands)
  const eventSubClient = createRedisClient('realtime-event-sub');

  // Dedicated Redis client for field lock operations (get/set/del)
  const lockRedisClient = createRedisClient('realtime-lock');

  // Dedicated Redis client for presence operations (get/set/scan)
  const presenceRedisClient = createRedisClient('realtime-presence');

  // Dedicated Redis client for notification subscriptions (subscribe mode)
  const notificationSubClient = createRedisClient('realtime-notification-sub');

  const adapterReady = Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter attached');
  });

  // Authenticate every socket connection via Clerk JWT
  io.use(authenticateSocket);

  // Create PresenceService instance (shared across handlers)
  const presenceService = new PresenceService(presenceRedisClient);

  // Connection lifecycle
  io.on('connection', (socket) => {
    const userId = socket.data['userId'] as string;
    const tenantId = socket.data['tenantId'] as string;

    logger.info(
      { socketId: socket.id, userId, tenantId },
      'Client connected',
    );

    // Auto-join personal room for direct user notifications
    void socket.join(`t:${tenantId}:user:${userId}`);

    // Register room:join and room:leave handlers
    registerRoomHandlers(socket);

    // Register field lock handlers
    registerLockHandlers(socket, io, lockRedisClient);

    // Register chat handlers (thread join/leave, typing indicators)
    registerChatHandlers(socket, io, presenceService);

    // Register presence handlers (heartbeat, status, disconnect cleanup)
    registerPresenceHandlers(socket, io, presenceService);

    // Register notification handlers (Redis channel subscription, DND suppression)
    registerNotificationHandlers(socket, notificationSubClient, presenceService);

    socket.on('disconnect', (reason) => {
      logger.info(
        { socketId: socket.id, userId, tenantId, reason },
        'Client disconnected',
      );
    });

    socket.on('error', (err) => {
      logger.error(
        { socketId: socket.id, userId, tenantId, err },
        'Socket error',
      );
    });
  });

  return { httpServer, io, pubClient, subClient, eventSubClient, lockRedisClient, presenceRedisClient, notificationSubClient, adapterReady };
}

/**
 * Starts the realtime server: connects Redis adapter, binds to port.
 * Called from index.ts entry point.
 */
export async function startServer() {
  const { httpServer, io, pubClient, subClient, eventSubClient, lockRedisClient, presenceRedisClient, notificationSubClient, adapterReady } =
    createRealtimeServer();

  await adapterReady;

  // Connect auxiliary Redis clients
  await lockRedisClient.connect();
  await presenceRedisClient.connect();
  await notificationSubClient.connect();

  // Start Redis event subscriber with dedicated client
  await eventSubClient.connect();
  await startRedisEventSubscriber(eventSubClient, io);

  httpServer.listen(REALTIME_PORT, () => {
    logger.info({ port: REALTIME_PORT }, 'Realtime server listening');
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down realtime server');

    io.close();

    await Promise.all([pubClient.quit(), subClient.quit(), eventSubClient.quit(), lockRedisClient.quit(), presenceRedisClient.quit(), notificationSubClient.quit()]).catch((err) => {
      logger.warn({ err }, 'Error closing Redis connections');
    });

    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return { httpServer, io };
}
