'use client';

/**
 * useFieldLock — client hook for field-level presence locking.
 *
 * Acquires a Redis-backed lock when a user starts editing a field,
 * renews on keystroke, and releases on blur. Other users see the field
 * as locked and non-interactive.
 *
 * @see docs/reference/tables-and-views.md § Field-Level Presence & Locking
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FieldLockInfo {
  userId: string;
  userName: string;
  avatarUrl: string;
  timestamp: number;
}

interface FieldLockState {
  /** Map of `${recordId}:${fieldId}` → lock info */
  locks: Map<string, FieldLockInfo>;
}

interface UseFieldLockOptions {
  socket: Socket | null;
  tenantId: string;
  currentUserId: string;
  currentUserName: string;
  currentAvatarUrl: string;
}

interface UseFieldLockResult {
  /**
   * Acquire a lock on a field. Returns true if successful.
   */
  acquireFieldLock: (recordId: string, fieldId: string) => Promise<boolean>;

  /**
   * Release a lock on a field.
   */
  releaseFieldLock: (recordId: string, fieldId: string) => void;

  /**
   * Renew the TTL on a held lock (call on each keystroke).
   */
  renewFieldLock: (recordId: string, fieldId: string) => void;

  /**
   * Check if a field is locked by another user.
   * Returns lock info if locked by someone else, null if free or locked by current user.
   */
  getFieldLock: (recordId: string, fieldId: string) => FieldLockInfo | null;

  /**
   * Get all locks for a given record (useful for row-level presence).
   */
  getRecordLocks: (recordId: string) => FieldLockInfo[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lockKey(recordId: string, fieldId: string): string {
  return `${recordId}:${fieldId}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useFieldLock({
  socket,
  tenantId,
  currentUserId,
  currentUserName,
  currentAvatarUrl,
}: UseFieldLockOptions): UseFieldLockResult {
  const [state, setState] = useState<FieldLockState>({ locks: new Map() });
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Listen for lock/unlock/renew events from other users
  useEffect(() => {
    if (!socket) return;

    function handleFieldLocked(data: {
      recordId: string;
      fieldId: string;
      lockedBy: FieldLockInfo;
    }) {
      setState((prev) => {
        const next = new Map(prev.locks);
        next.set(lockKey(data.recordId, data.fieldId), data.lockedBy);
        return { locks: next };
      });
    }

    function handleFieldUnlocked(data: {
      recordId: string;
      fieldId: string;
      userId: string;
    }) {
      setState((prev) => {
        const key = lockKey(data.recordId, data.fieldId);
        const existing = prev.locks.get(key);
        if (!existing || existing.userId !== data.userId) return prev;
        const next = new Map(prev.locks);
        next.delete(key);
        return { locks: next };
      });
    }

    function handleFieldLockRenewed(data: {
      recordId: string;
      fieldId: string;
      userId: string;
    }) {
      setState((prev) => {
        const key = lockKey(data.recordId, data.fieldId);
        const existing = prev.locks.get(key);
        if (!existing || existing.userId !== data.userId) return prev;
        const next = new Map(prev.locks);
        next.set(key, { ...existing, timestamp: Date.now() });
        return { locks: next };
      });
    }

    socket.on(REALTIME_EVENTS.FIELD_LOCKED, handleFieldLocked);
    socket.on(REALTIME_EVENTS.FIELD_UNLOCKED, handleFieldUnlocked);
    socket.on(REALTIME_EVENTS.FIELD_LOCK_RENEWED, handleFieldLockRenewed);

    return () => {
      socket.off(REALTIME_EVENTS.FIELD_LOCKED, handleFieldLocked);
      socket.off(REALTIME_EVENTS.FIELD_UNLOCKED, handleFieldUnlocked);
      socket.off(REALTIME_EVENTS.FIELD_LOCK_RENEWED, handleFieldLockRenewed);
    };
  }, [socket]);

  // Auto-expire stale locks (safety net if unlock event was missed)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const STALE_THRESHOLD_MS = 65_000; // 60s TTL + 5s buffer

      setState((prev) => {
        let changed = false;
        const next = new Map(prev.locks);

        for (const [key, info] of next) {
          if (now - info.timestamp > STALE_THRESHOLD_MS) {
            next.delete(key);
            changed = true;
          }
        }

        return changed ? { locks: next } : prev;
      });
    }, 10_000);

    return () => clearInterval(interval);
  }, []);

  const acquireFieldLock = useCallback(
    async (recordId: string, fieldId: string): Promise<boolean> => {
      if (!socket) return false;

      return new Promise<boolean>((resolve) => {
        socket.emit(
          'field:lock',
          {
            tenantId,
            recordId,
            fieldId,
            userName: currentUserName,
            avatarUrl: currentAvatarUrl,
          },
          (response: { ok: boolean; lockedBy?: FieldLockInfo }) => {
            if (response.ok) {
              resolve(true);
            } else {
              // Store the lock from the other user
              if (response.lockedBy) {
                setState((prev) => {
                  const next = new Map(prev.locks);
                  next.set(lockKey(recordId, fieldId), response.lockedBy!);
                  return { locks: next };
                });
              }
              resolve(false);
            }
          },
        );

        // Timeout fallback: if server doesn't respond within 3s, assume failure
        setTimeout(() => resolve(false), 3_000);
      });
    },
    [socket, tenantId, currentUserName, currentAvatarUrl],
  );

  const releaseFieldLock = useCallback(
    (recordId: string, fieldId: string) => {
      if (!socket) return;

      socket.emit('field:unlock', {
        tenantId,
        recordId,
        fieldId,
      });
    },
    [socket, tenantId],
  );

  const renewFieldLock = useCallback(
    (recordId: string, fieldId: string) => {
      if (!socket) return;

      socket.emit('field:lock_renewed', {
        tenantId,
        recordId,
        fieldId,
      });
    },
    [socket, tenantId],
  );

  const getFieldLock = useCallback(
    (recordId: string, fieldId: string): FieldLockInfo | null => {
      const info = stateRef.current.locks.get(lockKey(recordId, fieldId));
      if (!info) return null;
      // Don't show as locked if it's the current user
      if (info.userId === currentUserId) return null;
      return info;
    },
    [currentUserId],
  );

  const getRecordLocks = useCallback(
    (recordId: string): FieldLockInfo[] => {
      const result: FieldLockInfo[] = [];
      const prefix = `${recordId}:`;
      const seen = new Set<string>();

      for (const [key, info] of stateRef.current.locks) {
        if (key.startsWith(prefix) && info.userId !== currentUserId && !seen.has(info.userId)) {
          result.push(info);
          seen.add(info.userId);
        }
      }

      return result;
    },
    [currentUserId],
  );

  return {
    acquireFieldLock,
    releaseFieldLock,
    renewFieldLock,
    getFieldLock,
    getRecordLocks,
  };
}
