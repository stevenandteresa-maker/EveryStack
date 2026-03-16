'use client';

/**
 * usePresence — real-time presence tracking via Socket.IO.
 *
 * Subscribes to `presence:update` events for a tenant room.
 * Sends a heartbeat every 30s to keep presence alive.
 * Detects idle (5min no user activity) and transitions to 'away'.
 *
 * @see docs/reference/communications.md § Presence & Status
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresenceState = 'online' | 'away' | 'dnd' | 'offline';

export interface PresenceEntry {
  userId: string;
  state: PresenceState;
  lastActiveAt: number;
}

export interface UsePresenceResult {
  /** Map of userId → presence state for all users in room */
  presenceMap: Record<string, PresenceState>;
  /** Current user's own presence state */
  myStatus: PresenceState;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Heartbeat interval in ms (30 seconds). */
export const HEARTBEAT_INTERVAL_MS = 30_000;

/** Idle timeout in ms (5 minutes). */
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

/** User activity events to track for idle detection. */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresence(
  tenantId: string | undefined,
  socket: Socket | null,
  userId: string | undefined,
  roomId?: string,
): UsePresenceResult {
  const [presenceMap, setPresenceMap] = useState<Record<string, PresenceState>>({});
  const [myStatus, setMyStatus] = useState<PresenceState>('online');
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track user activity for idle detection
  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (myStatus === 'away') {
      setMyStatus('online');
    }
  }, [myStatus]);

  // Idle detection: check every 30s if 5min has passed with no activity
  useEffect(() => {
    if (!tenantId || !userId) return;

    function checkIdle() {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setMyStatus((prev) => (prev === 'dnd' ? prev : 'away'));
      }
      idleTimerRef.current = setTimeout(checkIdle, HEARTBEAT_INTERVAL_MS);
    }

    idleTimerRef.current = setTimeout(checkIdle, HEARTBEAT_INTERVAL_MS);

    // Listen for user activity
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [tenantId, userId, handleActivity]);

  // Socket.IO: subscribe to presence updates + send heartbeat
  useEffect(() => {
    if (!socket || !tenantId || !userId) return;

    const presenceRoom = roomId
      ? `presence:${tenantId}:${roomId}`
      : `presence:${tenantId}`;

    // Join presence room
    socket.emit('join', presenceRoom);

    // Handle presence updates from server
    function handlePresenceUpdate(entries: PresenceEntry[]) {
      const map: Record<string, PresenceState> = {};
      for (const entry of entries) {
        map[entry.userId] = entry.state;
      }
      setPresenceMap(map);
    }

    socket.on(REALTIME_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);

    // Heartbeat every 30s
    const heartbeatInterval = setInterval(() => {
      socket.emit('presence:heartbeat', { tenantId, userId, state: myStatus });
    }, HEARTBEAT_INTERVAL_MS);

    // Send initial online state
    socket.emit('presence:heartbeat', { tenantId, userId, state: myStatus });

    return () => {
      clearInterval(heartbeatInterval);
      socket.off(REALTIME_EVENTS.PRESENCE_UPDATE, handlePresenceUpdate);
      socket.emit('leave', presenceRoom);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, tenantId, userId, roomId]);

  // Send updated state when myStatus changes
  useEffect(() => {
    if (!socket || !tenantId || !userId) return;
    socket.emit('presence:heartbeat', { tenantId, userId, state: myStatus });
  }, [socket, tenantId, userId, myStatus]);

  return { presenceMap, myStatus };
}
