'use client';

/**
 * useRealtimeUpdates — buffers real-time record update events and applies
 * them as a single batch update to the TanStack Query cache.
 *
 * Buffer window: 100ms idle (no new events) OR 500ms max.
 * Excludes updates made by the current user (already handled by optimistic updates).
 * Shows an "Updating..." amber indicator during the buffer period.
 *
 * @see docs/reference/tables-and-views.md § Real-Time Updates & Event Coalescing
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecordUpdateEvent {
  recordId: string;
  tableId: string;
  tenantId: string;
  canonicalData: Record<string, unknown>;
  updatedBy: string;
  updatedAt: string;
}

interface UseRealtimeUpdatesOptions {
  socket: Socket | null;
  currentUserId: string;
  tableId: string;
}

interface UseRealtimeUpdatesResult {
  /** Whether updates are currently being buffered. */
  isBuffering: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Idle timeout: flush after 100ms of no new events. */
const IDLE_TIMEOUT_MS = 100;

/** Max buffer timeout: flush after 500ms regardless. */
const MAX_BUFFER_TIMEOUT_MS = 500;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRealtimeUpdates({
  socket,
  currentUserId,
  tableId,
}: UseRealtimeUpdatesOptions): UseRealtimeUpdatesResult {
  const queryClient = useQueryClient();
  const [isBuffering, setIsBuffering] = useState(false);

  // Buffer state — refs to avoid re-renders on each event
  const bufferRef = useRef<Map<string, RecordUpdateEvent>>(new Map());
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBufferingRef = useRef(false);

  // Flush buffered updates to TanStack Query cache
  const flushBuffer = useCallback(() => {
    // Clear timers
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    const updates = Array.from(bufferRef.current.values());
    bufferRef.current.clear();
    isBufferingRef.current = false;
    setIsBuffering(false);

    if (updates.length === 0) return;

    // Apply batch updates to the records query cache
    queryClient.setQueryData<unknown>(
      ['records', tableId],
      (old: unknown) => {
        if (!old || !Array.isArray(old)) return old;

        const updateMap = new Map(updates.map((u) => [u.recordId, u]));
        return (old as Record<string, unknown>[]).map((record) => {
          const recordId = (record as { id?: string }).id;
          if (!recordId) return record;

          const update = updateMap.get(recordId);
          if (!update) return record;

          return {
            ...record,
            canonicalData: update.canonicalData,
            updatedAt: update.updatedAt,
          };
        });
      },
    );
  }, [queryClient, tableId]);

  useEffect(() => {
    if (!socket) return;

    function handleRecordUpdated(data: RecordUpdateEvent) {
      // Ignore own updates (handled by optimistic updates)
      if (data.updatedBy === currentUserId) return;

      // Only process updates for the current table
      if (data.tableId !== tableId) return;

      // Add to buffer (latest update per record wins)
      bufferRef.current.set(data.recordId, data);

      // Start buffering indicator
      if (!isBufferingRef.current) {
        isBufferingRef.current = true;
        setIsBuffering(true);

        // Start the max buffer timer (500ms hard cap)
        maxTimerRef.current = setTimeout(flushBuffer, MAX_BUFFER_TIMEOUT_MS);
      }

      // Reset idle timer (100ms of no new events triggers flush)
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = setTimeout(flushBuffer, IDLE_TIMEOUT_MS);
    }

    socket.on(REALTIME_EVENTS.RECORD_UPDATED, handleRecordUpdated);

    const buffer = bufferRef;

    return () => {
      socket.off(REALTIME_EVENTS.RECORD_UPDATED, handleRecordUpdated);

      // Flush any remaining updates on cleanup
      if (buffer.current.size > 0) {
        flushBuffer();
      }
    };
  }, [socket, currentUserId, tableId, flushBuffer]);

  return { isBuffering };
}
