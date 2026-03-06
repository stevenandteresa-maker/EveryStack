// ---------------------------------------------------------------------------
// Airtable Boolean & Interactive Category Transforms (Category 6)
//
// Transforms for: checkbox, button
// Airtable types: checkbox, button
//
// EveryStack-only types NOT registered for Airtable:
//   - checklist: No Airtable equivalent
//   - signature: No Airtable equivalent
// ---------------------------------------------------------------------------

import type { FieldTransform, PlatformFieldConfig, CanonicalValue } from '../../types';

// ---------------------------------------------------------------------------
// Transform definitions
// ---------------------------------------------------------------------------

/**
 * checkbox → checkbox (lossless)
 *
 * Airtable returns `true` for checked and `undefined` for unchecked.
 * We map undefined/null to false for a clean boolean canonical form.
 */
export const airtableCheckboxTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    // Airtable returns undefined for unchecked — map to false
    return { type: 'checkbox', value: value === true };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'checkbox') return null;
    // Airtable expects true to check, undefined/null to uncheck
    return canonical.value === true ? true : null;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * button → button (N/A — no stored value)
 *
 * Airtable buttons have no stored value. They trigger actions.
 * The canonical form is always null. Both directions are no-ops.
 */
export const airtableButtonTransform: FieldTransform = {
  toCanonical: (_value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    return { type: 'button', value: null };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'button') return null;
    return null;
  },
  isLossless: true,
  supportedOperations: ['read'],
};

// ---------------------------------------------------------------------------
// Registration
//
// Note: checklist and signature are EveryStack-only field types with no
// Airtable equivalent. They are intentionally NOT registered here.
// The FieldTypeRegistry will not have entries for ('airtable', 'checklist')
// or ('airtable', 'signature') — this is correct behavior.
// ---------------------------------------------------------------------------

export const AIRTABLE_BOOLEAN_INTERACTIVE_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'checkbox', transform: airtableCheckboxTransform },
  { airtableType: 'button', transform: airtableButtonTransform },
];
