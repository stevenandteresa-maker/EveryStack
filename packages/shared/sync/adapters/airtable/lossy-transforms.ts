// ---------------------------------------------------------------------------
// Airtable Lossy (Computed) Field Transforms
//
// Transforms for: lookup, rollup, formula, count
// Airtable types: lookup, rollup, formulaField, count
//
// These are Airtable's computed/derived field types. Their values exist
// on the platform but are read-only — they cannot be written back.
//
// Strategy:
// - toCanonical() stores the raw computed value as-is (preserves for display)
// - fromCanonical() is a no-op (returns undefined — never sync back)
// - isLossless: false (we cannot reconstruct the formula/config)
// - supportedOperations: ['read'] only
//
// Per CLAUDE.md: "Never sync computed fields back to platforms."
// ---------------------------------------------------------------------------

import type {
  FieldTransform,
  PlatformFieldConfig,
  CanonicalValue,
} from '../../types';

/**
 * Create a read-only stub transform for an Airtable computed field type.
 * Stores the computed value inbound as a text representation; outbound is a no-op.
 *
 * The canonical type is 'text' for all lossy fields — the computed value is
 * stored as a string snapshot for display purposes only. The original
 * computation cannot be reproduced in EveryStack (formula engine is post-MVP).
 */
function createLossyTransform(): FieldTransform {
  return {
    toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
      if (value == null) return { type: 'text', value: null };

      // Arrays (lookup/rollup results) → join as comma-separated string
      if (Array.isArray(value)) {
        return { type: 'text', value: value.map(String).join(', ') };
      }

      return { type: 'text', value: String(value) };
    },

    fromCanonical: (_canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
      // No-op: computed fields are never written back to Airtable
      return undefined;
    },

    isLossless: false,
    supportedOperations: ['read'],
  };
}

/** lookup → text (read-only, lossy) */
export const airtableLookupTransform: FieldTransform = createLossyTransform();

/** rollup → text (read-only, lossy) */
export const airtableRollupTransform: FieldTransform = createLossyTransform();

/** formulaField → text (read-only, lossy) */
export const airtableFormulaTransform: FieldTransform = createLossyTransform();

/** count → text (read-only, lossy) */
export const airtableCountTransform: FieldTransform = createLossyTransform();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_LOSSY_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'lookup', transform: airtableLookupTransform },
  { airtableType: 'rollup', transform: airtableRollupTransform },
  { airtableType: 'formula', transform: airtableFormulaTransform },
  { airtableType: 'count', transform: airtableCountTransform },
];
