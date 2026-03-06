// ---------------------------------------------------------------------------
// Airtable Relational Category Transforms (Category 7)
//
// Transforms for: linked_record
// Airtable type: multipleRecordLinks
//
// Linked record transforms require a pre-computed record ID map passed
// via fieldConfig.options.recordIdMap: Record<string, string | null>.
// Keys are Airtable record IDs (e.g. "recXyz"); values are ES record UUIDs.
//
// When a linked Airtable record ID is not found in the map, the entry is
// stored with record_id: null, platform_record_id set, and filtered_out: true.
// This follows sync-engine.md § Cross-Links to Filtered-Out Records.
// ---------------------------------------------------------------------------

import type {
  FieldTransform,
  PlatformFieldConfig,
  CanonicalValue,
  LinkedRecordEntry,
} from '../../types';

/**
 * Resolve a single Airtable record ID to a LinkedRecordEntry using the
 * record ID map from field config options.
 *
 * If the map contains the ID → ES UUID mapping, returns a resolved entry.
 * Otherwise, returns a filtered-out entry with the platform record ID preserved.
 */
function resolveLinkedRecord(
  airtableRecordId: string,
  recordIdMap: Record<string, string | null>,
): LinkedRecordEntry {
  const esRecordId = recordIdMap[airtableRecordId];

  if (esRecordId != null) {
    return { record_id: esRecordId };
  }

  // Record exists on Airtable but is not synced into EveryStack
  return {
    record_id: null,
    platform_record_id: airtableRecordId,
    filtered_out: true,
  };
}

/** multipleRecordLinks → linked_record (lossless) */
export const airtableLinkedRecordTransform: FieldTransform = {
  toCanonical: (value: unknown, config: PlatformFieldConfig): CanonicalValue => {
    if (value == null || !Array.isArray(value)) {
      return { type: 'linked_record', value: [] };
    }

    const recordIdMap = (config.options?.recordIdMap ?? {}) as Record<string, string | null>;

    const entries: LinkedRecordEntry[] = value.map((airtableRecordId: unknown) =>
      resolveLinkedRecord(String(airtableRecordId), recordIdMap),
    );

    return { type: 'linked_record', value: entries };
  },

  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'linked_record') return null;
    if (!canonical.value || canonical.value.length === 0) return [];

    // Convert back to Airtable record ID array.
    // Filtered-out entries use platform_record_id; resolved entries would need
    // reverse lookup (not available here — the sync job handles this).
    // For now, emit only entries that have a platform_record_id or can be
    // reverse-looked up via config.options.reverseRecordIdMap.
    return canonical.value
      .map((entry) => {
        if (entry.platform_record_id) return entry.platform_record_id;
        // If we have the ES record ID, the sync job should populate reverse map
        // in config.options.reverseRecordIdMap for outbound writes
        if (entry.record_id != null) {
          const reverseMap = (_config.options?.reverseRecordIdMap ?? {}) as Record<string, string>;
          return reverseMap[entry.record_id] ?? null;
        }
        return null;
      })
      .filter((id): id is string => id != null);
  },

  isLossless: true,
  supportedOperations: ['read', 'write'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_RELATIONAL_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'multipleRecordLinks', transform: airtableLinkedRecordTransform },
];
