'use client';

/**
 * useTypingIndicator — broadcasts typing events via Socket.IO and
 * tracks other users' typing state in a thread.
 *
 * - Broadcasts typing:start on keystroke (debounced 500ms)
 * - Broadcasts typing:stop after 3s of no keystrokes
 * - Listens for other users' typing events
 *
 * @see docs/reference/communications.md § Typing Indicator
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TypingPayload {
  threadId: string;
  userId: string;
  userName: string;
}

interface UseTypingIndicatorOptions {
  threadId: string | null;
  socket: Socket | null;
  currentUserId: string;
  currentUserName: string;
}

interface UseTypingIndicatorResult {
  /** Names of users currently typing (excludes self) */
  typingUsers: string[];
  /** Call on keystroke to broadcast typing state */
  startTyping: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 500;
const TIMEOUT_MS = 3000;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTypingIndicator({
  threadId,
  socket,
  currentUserId,
  currentUserName,
}: UseTypingIndicatorOptions): UseTypingIndicatorResult {
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBroadcastingRef = useRef(false);

  // Clean up on unmount or thread change
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [threadId]);

  // Listen for other users' typing events
  useEffect(() => {
    if (!socket || !threadId) return;

    function handleTypingStart(payload: TypingPayload) {
      if (payload.threadId !== threadId) return;
      if (payload.userId === currentUserId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(payload.userId, payload.userName);
        return next;
      });

      // Auto-remove after timeout (in case stop event is missed)
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          next.delete(payload.userId);
          return next;
        });
      }, TIMEOUT_MS + 1000);
    }

    function handleTypingStop(payload: TypingPayload) {
      if (payload.threadId !== threadId) return;
      if (payload.userId === currentUserId) return;

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(payload.userId);
        return next;
      });
    }

    socket.on(REALTIME_EVENTS.TYPING_START, handleTypingStart);
    socket.on(REALTIME_EVENTS.TYPING_STOP, handleTypingStop);

    return () => {
      socket.off(REALTIME_EVENTS.TYPING_START, handleTypingStart);
      socket.off(REALTIME_EVENTS.TYPING_STOP, handleTypingStop);
      setTypingUsers(new Map());
    };
  }, [socket, threadId, currentUserId]);

  const startTyping = useCallback(() => {
    if (!socket || !threadId) return;

    // Debounce: don't spam typing:start on every keystroke
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (!isBroadcastingRef.current) {
        isBroadcastingRef.current = true;
        socket.emit(REALTIME_EVENTS.TYPING_START, {
          threadId,
          userId: currentUserId,
          userName: currentUserName,
        });
      }

      // Reset the stop timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        isBroadcastingRef.current = false;
        socket.emit(REALTIME_EVENTS.TYPING_STOP, {
          threadId,
          userId: currentUserId,
          userName: currentUserName,
        });
      }, TIMEOUT_MS);
    }, DEBOUNCE_MS);
  }, [socket, threadId, currentUserId, currentUserName]);

  return {
    typingUsers: Array.from(typingUsers.values()),
    startTyping,
  };
}
