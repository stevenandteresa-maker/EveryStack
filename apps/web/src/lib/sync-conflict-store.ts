'use client';

/**
 * Sync Conflict Store — Zustand store for real-time conflict state.
 *
 * Manages the conflict map for the currently-viewed table.
 * Fed by:
 *   1. Initial fetch via getPendingConflictsForTable() on table navigation
 *   2. Real-time sync.conflict_detected events via Socket.io
 *   3. Real-time sync.conflict_resolved events via Socket.io
 *
 * Shape mirrors ConflictMap from data/sync-conflicts.ts:
 *   { [recordId]: { [fieldId]: ConflictMeta } }
 *
 * @see docs/reference/sync-engine.md § Real-Time Conflict Push
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Conflict metadata for a single field on a single record. */
export interface ConflictMeta {
  id: string;
  localValue: unknown;
  remoteValue: unknown;
  platform: string;
  createdAt: string;
}

/** Nested conflict map: recordId → fieldId → ConflictMeta. */
export type ConflictMap = Record<string, Record<string, ConflictMeta>>;

interface SyncConflictState {
  /** Current table's conflict map. */
  conflicts: ConflictMap;

  /** Replace entire conflict map (used on table navigation). */
  setInitialConflicts: (conflicts: ConflictMap) => void;

  /** Add a single conflict (used on sync.conflict_detected event). */
  addConflict: (recordId: string, fieldId: string, meta: ConflictMeta) => void;

  /** Remove a single conflict (used on sync.conflict_resolved event). */
  removeConflict: (recordId: string, fieldId: string) => void;

  /** Get all conflicts for a specific record. */
  getConflictsForRecord: (recordId: string) => Record<string, ConflictMeta>;

  /** Total number of pending conflicts across all records. */
  conflictCount: () => number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSyncConflictStore = create<SyncConflictState>()((set, get) => ({
  conflicts: {},

  setInitialConflicts: (conflicts) => set({ conflicts }),

  addConflict: (recordId, fieldId, meta) =>
    set((state) => {
      const recordConflicts = state.conflicts[recordId] ?? {};
      return {
        conflicts: {
          ...state.conflicts,
          [recordId]: {
            ...recordConflicts,
            [fieldId]: meta,
          },
        },
      };
    }),

  removeConflict: (recordId, fieldId) =>
    set((state) => {
      const recordConflicts = state.conflicts[recordId];
      if (!recordConflicts?.[fieldId]) return state;

      const { [fieldId]: _removed, ...remaining } = recordConflicts;
      const hasRemaining = Object.keys(remaining).length > 0;

      if (hasRemaining) {
        return {
          conflicts: {
            ...state.conflicts,
            [recordId]: remaining,
          },
        };
      }

      // Remove the record entry entirely when no conflicts remain
      const { [recordId]: _removedRecord, ...remainingRecords } = state.conflicts;
      return { conflicts: remainingRecords };
    }),

  getConflictsForRecord: (recordId) => get().conflicts[recordId] ?? {},

  conflictCount: () => {
    const { conflicts } = get();
    let count = 0;
    for (const recordId of Object.keys(conflicts)) {
      count += Object.keys(conflicts[recordId]!).length;
    }
    return count;
  },
}));
