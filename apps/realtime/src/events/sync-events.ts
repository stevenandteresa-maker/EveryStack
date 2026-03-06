/**
 * Re-exports sync conflict event payload types from the shared package.
 *
 * @see packages/shared/realtime/sync-conflict-payloads.ts
 */

export type {
  SyncConflictDetectedPayload,
  SyncConflictResolvedPayload,
  SyncConflictEventPayload,
} from '@everystack/shared/realtime';
