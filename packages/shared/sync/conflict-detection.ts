/**
 * Three-Way Conflict Detection — compares base (last-synced), local
 * (current canonical_data), and remote (inbound platform) values per field.
 *
 * Pure functions — no DB access. Callers provide inputs and handle writes.
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX > Detection
 */

import type {
  SyncMetadata,
  ConflictDetectionResult,
  DetectedConflict,
  CleanChange,
  SyncPlatform,
} from './types';

import type { DrizzleClient } from '@everystack/shared/db';
import { syncConflicts } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Value comparison
// ---------------------------------------------------------------------------

/**
 * Normalize a value for comparison: treat `undefined` and `null` as equivalent.
 * Returns a stable JSON string for deep equality checks on objects/arrays.
 */
function normalizeForComparison(value: unknown): string {
  if (value === undefined || value === null) {
    return 'null';
  }
  return JSON.stringify(value);
}

/**
 * Deep-equal comparison that treats null and undefined as equivalent.
 */
export function valuesAreEqual(a: unknown, b: unknown): boolean {
  return normalizeForComparison(a) === normalizeForComparison(b);
}

// ---------------------------------------------------------------------------
// Core detection algorithm
// ---------------------------------------------------------------------------

/**
 * Perform three-way conflict detection for a single record.
 *
 * For each synced field, compares:
 *   - baseValue:   syncMetadata.last_synced_values[fieldId].value
 *   - localValue:  currentCanonical[fieldId]
 *   - remoteValue: inboundCanonical[fieldId]
 *
 * Results per field:
 *   - local unchanged + remote changed → clean remote change (apply it)
 *   - local changed + remote unchanged → clean local change (keep it)
 *   - both changed to DIFFERENT values  → CONFLICT
 *   - both changed to SAME value        → convergent (no conflict)
 *   - all three equal                   → unchanged
 *
 * Edge case: when syncMetadata is null or last_synced_values is empty,
 * all inbound values are treated as clean remote changes.
 *
 * @param currentCanonical - Current canonical_data from the DB record
 * @param inboundCanonical - Canonical data transformed from platform inbound
 * @param syncMetadata     - Record's sync_metadata (null for pre-Phase-2B records)
 * @param syncedFieldIds   - Field UUIDs to compare (from synced_field_mappings)
 */
export function detectConflicts(
  currentCanonical: Record<string, unknown>,
  inboundCanonical: Record<string, unknown>,
  syncMetadata: SyncMetadata | null,
  syncedFieldIds: string[],
): ConflictDetectionResult {
  const cleanRemoteChanges: CleanChange[] = [];
  const cleanLocalChanges: CleanChange[] = [];
  const conflicts: DetectedConflict[] = [];
  const unchangedFieldIds: string[] = [];
  const convergentFieldIds: string[] = [];

  const lastSyncedValues = syncMetadata?.last_synced_values ?? {};

  for (const fieldId of syncedFieldIds) {
    const remoteValue = inboundCanonical[fieldId];
    const localValue = currentCanonical[fieldId];
    const baseEntry = lastSyncedValues[fieldId];

    // No base value — treat as clean remote change (first sync or pre-Phase-2B)
    if (!baseEntry) {
      if (!valuesAreEqual(localValue, remoteValue)) {
        cleanRemoteChanges.push({ fieldId, value: remoteValue });
      } else {
        unchangedFieldIds.push(fieldId);
      }
      continue;
    }

    const baseValue = baseEntry.value;
    const localChanged = !valuesAreEqual(localValue, baseValue);
    const remoteChanged = !valuesAreEqual(remoteValue, baseValue);

    if (!localChanged && !remoteChanged) {
      // All three equal — unchanged
      unchangedFieldIds.push(fieldId);
    } else if (!localChanged && remoteChanged) {
      // Only remote changed — clean remote change, apply it
      cleanRemoteChanges.push({ fieldId, value: remoteValue });
    } else if (localChanged && !remoteChanged) {
      // Only local changed — clean local change, preserve
      cleanLocalChanges.push({ fieldId, value: localValue });
    } else if (valuesAreEqual(localValue, remoteValue)) {
      // Both changed to the same value — convergent, no conflict
      convergentFieldIds.push(fieldId);
    } else {
      // Both changed to different values — CONFLICT
      conflicts.push({
        fieldId,
        localValue,
        remoteValue,
        baseValue,
      });
    }
  }

  return {
    cleanRemoteChanges,
    cleanLocalChanges,
    conflicts,
    unchangedFieldIds,
    convergentFieldIds,
  };
}

// ---------------------------------------------------------------------------
// Write conflict records
// ---------------------------------------------------------------------------

/**
 * Insert one sync_conflicts row per detected conflict field.
 *
 * @param tx        - Drizzle transaction (or connection)
 * @param tenantId  - Tenant UUID
 * @param recordId  - Record UUID
 * @param conflicts - Detected conflicts from detectConflicts()
 * @param platform  - Source platform identifier
 */
export async function writeConflictRecords(
  tx: DrizzleClient,
  tenantId: string,
  recordId: string,
  conflicts: DetectedConflict[],
  platform: SyncPlatform,
): Promise<void> {
  if (conflicts.length === 0) return;

  const rows = conflicts.map((conflict) => ({
    tenantId,
    recordId,
    fieldId: conflict.fieldId,
    localValue: conflict.localValue,
    remoteValue: conflict.remoteValue,
    baseValue: conflict.baseValue,
    platform,
    status: 'pending' as const,
  }));

  await tx.insert(syncConflicts).values(rows);
}
