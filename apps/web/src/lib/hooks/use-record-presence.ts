'use client';

/**
 * useRecordPresence — derives row-level presence from field locks.
 *
 * When any user is editing any field in a record, returns a colored indicator
 * for that row. Color is assigned based on the user's index in a fixed palette.
 *
 * @see docs/reference/tables-and-views.md § Row-level presence
 */

import { useMemo } from 'react';
import type { FieldLockInfo } from './use-field-lock';

// ---------------------------------------------------------------------------
// Presence color palette (8 colors, cycles on user index)
// ---------------------------------------------------------------------------

const PRESENCE_COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
] as const;

/**
 * Assigns a stable color to a user based on their userId.
 * Uses a simple hash to produce a consistent color across sessions.
 */
function getPresenceColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % PRESENCE_COLORS.length;
  return PRESENCE_COLORS[index] ?? PRESENCE_COLORS[0]!;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordPresence {
  /** Whether another user is editing this record. */
  isActive: boolean;
  /** Color for the left border indicator. */
  color: string;
  /** Users currently editing fields in this record. */
  users: FieldLockInfo[];
}

interface UseRecordPresenceOptions {
  /**
   * Function to get all lock infos for a record.
   * Provided by useFieldLock's getRecordLocks.
   */
  getRecordLocks: (recordId: string) => FieldLockInfo[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecordPresence({ getRecordLocks }: UseRecordPresenceOptions) {
  /**
   * Get presence state for a specific record.
   */
  const getRecordPresence = useMemo(() => {
    return (recordId: string): RecordPresence => {
      const users = getRecordLocks(recordId);

      if (users.length === 0) {
        return { isActive: false, color: '', users: [] };
      }

      // Use the first active user's color for the border
      const primaryUser = users[0]!;
      const color = getPresenceColor(primaryUser.userId);

      return { isActive: true, color, users };
    };
  }, [getRecordLocks]);

  return { getRecordPresence, getPresenceColor };
}

export { PRESENCE_COLORS, getPresenceColor };
