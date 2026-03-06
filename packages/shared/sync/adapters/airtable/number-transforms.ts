// ---------------------------------------------------------------------------
// Airtable Number Category Transforms (Category 2)
//
// Transforms for: number, currency, percent, rating, duration, progress, auto_number
// Airtable types: number, currency, percent, rating, duration, (progress via number), autoNumber
// ---------------------------------------------------------------------------

import type { FieldTransform, PlatformFieldConfig, CanonicalValue } from '../../types';

/**
 * Safely coerce an unknown value to a number, returning null for non-numeric input.
 */
function toNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n;
}

// ---------------------------------------------------------------------------
// Transform definitions
// ---------------------------------------------------------------------------

/** number → number (lossless passthrough) */
export const airtableNumberTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => ({
    type: 'number',
    value: toNumber(value),
  }),
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'number') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** currency → currency (lossless — value passthrough, currency code is field config) */
export const airtableCurrencyTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => ({
    type: 'currency',
    value: toNumber(value),
  }),
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'currency') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** percent → percent (lossless — Airtable stores as decimal, canonical stores as decimal) */
export const airtablePercentTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => ({
    type: 'percent',
    value: toNumber(value),
  }),
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'percent') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** rating → rating (lossless integer passthrough) */
export const airtableRatingTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const n = toNumber(value);
    return { type: 'rating', value: n != null ? Math.round(n) : null };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'rating') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * duration → duration (lossless)
 * Airtable stores duration in seconds; canonical stores in minutes.
 */
export const airtableDurationTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const seconds = toNumber(value);
    return { type: 'duration', value: seconds != null ? seconds / 60 : null };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'duration') return null;
    return canonical.value != null ? canonical.value * 60 : null;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** progress (mapped via Airtable number with 0-100 constraint) → progress (lossless) */
export const airtableProgressTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => ({
    type: 'progress',
    value: toNumber(value),
  }),
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'progress') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** autoNumber → auto_number (lossless, read-only system field) */
export const airtableAutoNumberTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    const n = toNumber(value);
    return { type: 'auto_number', value: n != null ? Math.round(n) : null };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'auto_number') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_NUMBER_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'number', transform: airtableNumberTransform },
  { airtableType: 'currency', transform: airtableCurrencyTransform },
  { airtableType: 'percent', transform: airtablePercentTransform },
  { airtableType: 'rating', transform: airtableRatingTransform },
  { airtableType: 'duration', transform: airtableDurationTransform },
  { airtableType: 'progress', transform: airtableProgressTransform },
  { airtableType: 'autoNumber', transform: airtableAutoNumberTransform },
];
