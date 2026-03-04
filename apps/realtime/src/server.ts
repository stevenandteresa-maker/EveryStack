import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from '@everystack/shared/redis';
import { realtimeLogger } from '@everystack/shared/logging';

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

  const adapterReady = Promise.all([
    pubClient.connect(),
    subClient.connect(),
  ]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Redis adapter attached');
  });

  return { httpServer, io, pubClient, subClient, adapterReady };
}

/**
 * Starts the realtime server: connects Redis adapter, binds to port.
 * Called from index.ts entry point.
 */
export async function startServer() {
  const { httpServer, io, pubClient, subClient, adapterReady } =
    createRealtimeServer();

  await adapterReady;

  httpServer.listen(REALTIME_PORT, () => {
    logger.info({ port: REALTIME_PORT }, 'Realtime server listening');
  });

  // Graceful shutdown
  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down realtime server');

    io.close();

    await Promise.all([pubClient.quit(), subClient.quit()]).catch((err) => {
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
