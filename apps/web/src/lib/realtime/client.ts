import { io, type Socket } from 'socket.io-client';

const REALTIME_URL =
  process.env['NEXT_PUBLIC_REALTIME_URL'] ?? 'http://localhost:3002';

/** Jitter factor applied to reconnection delays (±20%). */
const JITTER_FACTOR = 0.2;

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.io client connected to the realtime server.
 *
 * Reconnection strategy per `realtime.md`:
 * - Initial delay: 1,000ms
 * - Backoff multiplier: 2x (Socket.io default)
 * - Max delay: 30,000ms
 * - Jitter: ±20%
 * - Unlimited retry attempts
 *
 * @param token - Clerk session JWT for authentication
 */
export function getRealtimeClient(token: string): Socket {
  if (socket) {
    return socket;
  }

  socket = io(REALTIME_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: JITTER_FACTOR,
    autoConnect: true,
  });

  return socket;
}

/**
 * Disconnects the singleton Socket.io client and clears the reference.
 * Safe to call even if no client exists.
 */
export function disconnectRealtimeClient(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
