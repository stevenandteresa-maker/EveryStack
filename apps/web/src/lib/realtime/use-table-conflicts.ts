'use client';

/**
 * useTableConflicts — Wires Socket.io conflict events to the ConflictStore.
 *
 * On mount (table navigation):
 *   1. Joins the table room via Socket.io
 *   2. Fetches initial conflicts via Server Action (getPendingConflictsForTable)
 *   3. Attaches listeners for sync.conflict_detected / sync.conflict_resolved
 *
 * On unmount (table navigation away):
 *   1. Leaves the table room
 *   2. Clears conflict store
 *   3. Removes event listeners
 *
 * @see docs/reference/sync-engine.md § Real-Time Conflict Push
 */

import { useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import {
  REALTIME_EVENTS,
} from '@everystack/shared/realtime';
import type {
  SyncConflictDetectedPayload,
  SyncConflictResolvedPayload,
} from '@everystack/shared/realtime';
import { useSyncConflictStore } from '@/lib/sync-conflict-store';
import type { ConflictMap, ConflictMeta } from '@/lib/sync-conflict-store';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UseTableConflictsOptions {
  /** Connected Socket.io client (from useRealtimeConnection). */
  socket: Socket | null;
  /** EveryStack table ID for the currently-viewed table. */
  tableId: string | null;
  /** Tenant ID for room scoping. */
  tenantId: string | null;
  /** Fetcher for initial conflicts — injected to keep this hook server-action-agnostic. */
  fetchInitialConflicts: (tableId: string) => Promise<ConflictMap>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTableConflicts({
  socket,
  tableId,
  tenantId,
  fetchInitialConflicts,
}: UseTableConflictsOptions): void {
  const setInitialConflicts = useSyncConflictStore((s) => s.setInitialConflicts);
  const addConflict = useSyncConflictStore((s) => s.addConflict);
  const removeConflict = useSyncConflictStore((s) => s.removeConflict);

  const handleConflictDetected = useCallback(
    (payload: SyncConflictDetectedPayload) => {
      const meta: ConflictMeta = {
        id: payload.conflictId,
        localValue: payload.localValue,
        remoteValue: payload.remoteValue,
        platform: payload.platform,
        createdAt: new Date().toISOString(),
      };
      addConflict(payload.recordId, payload.fieldId, meta);
    },
    [addConflict],
  );

  const handleConflictResolved = useCallback(
    (payload: SyncConflictResolvedPayload) => {
      removeConflict(payload.recordId, payload.fieldId);
    },
    [removeConflict],
  );

  useEffect(() => {
    if (!socket || !tableId || !tenantId) return;

    const roomId = `table:${tableId}`;

    // 1. Join the table room
    socket.emit('room:join', roomId, (response: { ok: boolean }) => {
      if (!response?.ok) return;

      // 2. Fetch initial conflicts once room is joined
      void fetchInitialConflicts(tableId).then((conflicts) => {
        setInitialConflicts(conflicts);
      });
    });

    // 3. Attach conflict event listeners
    socket.on(REALTIME_EVENTS.SYNC_CONFLICT_DETECTED, handleConflictDetected);
    socket.on(REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED, handleConflictResolved);

    return () => {
      // Cleanup: leave room, remove listeners, clear store
      socket.emit('room:leave', roomId);
      socket.off(REALTIME_EVENTS.SYNC_CONFLICT_DETECTED, handleConflictDetected);
      socket.off(REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED, handleConflictResolved);
      setInitialConflicts({});
    };
  }, [
    socket,
    tableId,
    tenantId,
    fetchInitialConflicts,
    setInitialConflicts,
    handleConflictDetected,
    handleConflictResolved,
  ]);
}
