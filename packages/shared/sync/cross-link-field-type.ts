// ---------------------------------------------------------------------------
// Cross-Link FieldTypeRegistry Registration — canonical platform identity
// transform for the `linked_record` field type.
//
// Cross-links are EveryStack-native (not platform-synced), so the canonical
// platform uses an identity transform: validate shape, pass through.
//
// Import this module to auto-register on load.
// @see docs/reference/cross-linking.md § Cross-Link + Sync Interaction
// ---------------------------------------------------------------------------

import type { CrossLinkFieldValue } from './cross-link-types';
import { fieldTypeRegistry } from './field-registry';
import type { CanonicalValue, PlatformFieldConfig } from './types';

/**
 * Type guard for CrossLinkFieldValue shape.
 * Used by the identity transform to validate before pass-through.
 */
function isCrossLinkFieldValue(value: unknown): value is CrossLinkFieldValue {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  if (obj.type !== 'cross_link') {
    return false;
  }

  const inner = obj.value;
  if (typeof inner !== 'object' || inner === null) {
    return false;
  }

  const innerObj = inner as Record<string, unknown>;
  if (typeof innerObj.cross_link_id !== 'string') {
    return false;
  }

  if (!Array.isArray(innerObj.linked_records)) {
    return false;
  }

  return true;
}

/**
 * Identity transform for cross-link fields on the canonical platform.
 * Validates shape, passes through valid values, returns null for invalid.
 */
fieldTypeRegistry.register('canonical', 'linked_record', {
  toCanonical(value: unknown, _fieldConfig: PlatformFieldConfig): CanonicalValue {
    if (isCrossLinkFieldValue(value)) {
      return value as unknown as CanonicalValue;
    }

    // Invalid shape — return empty linked_record value
    return {
      type: 'linked_record',
      value: [],
    } as CanonicalValue;
  },

  fromCanonical(value: CanonicalValue, _fieldConfig: PlatformFieldConfig): unknown {
    // Identity — pass through canonical value as-is
    return value;
  },

  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
});
