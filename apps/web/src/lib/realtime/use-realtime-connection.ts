'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import type { Socket } from 'socket.io-client';
import { getRealtimeClient, disconnectRealtimeClient } from './client';

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

interface UseRealtimeConnectionResult {
  socket: Socket | null;
  status: ConnectionStatus;
}

/**
 * React hook that manages a Socket.io connection authenticated via Clerk.
 *
 * - Connects when a valid Clerk token is available
 * - Tracks connection status (connecting → connected → reconnecting → disconnected)
 * - On AUTH_FAILED: disconnects permanently (no retry)
 * - Cleans up on unmount
 */
export function useRealtimeConnection(): UseRealtimeConnectionResult {
  const { getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const token = await getToken();

      if (cancelled || !token) {
        return;
      }

      setStatus('connecting');
      const client = getRealtimeClient(token);
      setSocket(client);

      client.on('connect', () => {
        if (!cancelled) {
          setStatus('connected');
        }
      });

      client.on('disconnect', () => {
        if (!cancelled) {
          setStatus('disconnected');
        }
      });

      client.on('reconnecting', () => {
        if (!cancelled) {
          setStatus('reconnecting');
        }
      });

      client.on('connect_error', (err: Error) => {
        if (!cancelled && err.message === 'AUTH_FAILED') {
          // Do not retry on auth failure
          disconnectRealtimeClient();
          setSocket(null);
          setStatus('disconnected');
        }
      });

      // If already connected by the time we attach listeners
      if (client.connected) {
        setStatus('connected');
      }
    }

    void connect();

    return () => {
      cancelled = true;
      disconnectRealtimeClient();
      setSocket(null);
      setStatus('disconnected');
    };
  }, [getToken]);

  return { socket, status };
}
