// ---------------------------------------------------------------------------
// Airtable Identification Category Transforms (Category 9)
//
// Transforms for: barcode
// Airtable type: barcode
//
// Airtable stores barcodes as { text: string } objects.
// Canonical stores barcode as a plain string.
// Transform unwraps/wraps the {text} object (lossless).
// ---------------------------------------------------------------------------

import type {
  FieldTransform,
  PlatformFieldConfig,
  CanonicalValue,
} from '../../types';

/** barcode → barcode (lossless) */
export const airtableBarcodeTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'barcode', value: null };

    // Airtable barcode is { text: "..." }
    if (typeof value === 'object' && 'text' in (value as Record<string, unknown>)) {
      const text = (value as Record<string, unknown>).text;
      return { type: 'barcode', value: text != null ? String(text) : null };
    }

    // Fallback: if it's already a string, accept it
    if (typeof value === 'string') {
      return { type: 'barcode', value: value };
    }

    return { type: 'barcode', value: null };
  },

  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'barcode') return null;
    if (canonical.value == null) return null;

    // Wrap back into Airtable's { text: "..." } format
    return { text: canonical.value };
  },

  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_IDENTIFICATION_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'barcode', transform: airtableBarcodeTransform },
];
