/**
 * Sync Metadata Utilities — helpers for creating and updating
 * the `records.sync_metadata` JSONB column.
 *
 * These functions are pure (no DB access) and produce SyncMetadata
 * objects that callers write to the database in a transaction.
 *
 * @see docs/reference/sync-engine.md § Conflict Detection
 */

import type { SyncMetadata, SyncedFieldValue } from './types';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Build initial SyncMetadata for a newly-synced record.
 *
 * Populates `last_synced_values` with a snapshot of every field in
 * `fieldIds` from `canonicalData`, all stamped with the same timestamp.
 */
export function createInitialSyncMetadata(
  platformRecordId: string,
  canonicalData: Record<string, unknown>,
  fieldIds: string[],
  direction: SyncMetadata['sync_direction'] = 'inbound',
): SyncMetadata {
  const now = new Date().toISOString();

  const lastSyncedValues: Record<string, SyncedFieldValue> = {};
  for (const fieldId of fieldIds) {
    if (fieldId in canonicalData) {
      lastSyncedValues[fieldId] = {
        value: canonicalData[fieldId],
        synced_at: now,
      };
    }
  }

  return {
    platform_record_id: platformRecordId,
    last_synced_at: now,
    last_synced_values: lastSyncedValues,
    sync_status: 'active',
    sync_direction: direction,
    orphaned_at: null,
    orphaned_reason: null,
  };
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update `last_synced_values` for specific fields after an incremental sync.
 *
 * Only the fields in `updatedFieldIds` are refreshed from `canonicalData`.
 * All other fields in the existing metadata are preserved unchanged.
 */
export function updateLastSyncedValues(
  existingMetadata: SyncMetadata,
  updatedFieldIds: string[],
  canonicalData: Record<string, unknown>,
): SyncMetadata {
  const now = new Date().toISOString();

  const updatedValues: Record<string, SyncedFieldValue> = {
    ...existingMetadata.last_synced_values,
  };

  for (const fieldId of updatedFieldIds) {
    if (fieldId in canonicalData) {
      updatedValues[fieldId] = {
        value: canonicalData[fieldId],
        synced_at: now,
      };
    }
  }

  return {
    ...existingMetadata,
    last_synced_at: now,
    last_synced_values: updatedValues,
  };
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Retrieve the last-synced canonical value for a specific field.
 * Returns `undefined` if the field has no sync history.
 */
export function getLastSyncedValue(
  metadata: SyncMetadata,
  fieldId: string,
): unknown | undefined {
  const entry = metadata.last_synced_values[fieldId];
  return entry?.value;
}
