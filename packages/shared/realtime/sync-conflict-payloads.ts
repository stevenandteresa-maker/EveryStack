/**
 * Sync conflict real-time event payload types.
 *
 * These events flow through Redis pub/sub → Socket.io → client stores.
 * The worker emits after writing sync_conflicts; clients consume
 * to update the ConflictStore and re-render cell indicators.
 *
 * @see docs/reference/sync-engine.md § Real-Time Conflict Push
 */

import type { REALTIME_EVENTS } from './events';

// ---------------------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------------------

/**
 * Emitted after writeConflictRecords() writes pending conflicts.
 * Each conflict field gets its own event so cell indicators update independently.
 */
export interface SyncConflictDetectedPayload {
  type: typeof REALTIME_EVENTS.SYNC_CONFLICT_DETECTED;
  recordId: string;
  fieldId: string;
  conflictId: string;
  localValue: unknown;
  remoteValue: unknown;
  platform: string;
}

/**
 * Emitted after a Manager resolves a conflict via the resolution Server Action.
 * Emission wired in Prompt 10 — type defined here for client listener setup.
 */
export interface SyncConflictResolvedPayload {
  type: typeof REALTIME_EVENTS.SYNC_CONFLICT_RESOLVED;
  recordId: string;
  fieldId: string;
  conflictId: string;
  resolvedValue: unknown;
  resolution: 'resolved_local' | 'resolved_remote' | 'resolved_merged';
}

/** Union of all sync conflict event payloads. */
export type SyncConflictEventPayload =
  | SyncConflictDetectedPayload
  | SyncConflictResolvedPayload;
