// ---------------------------------------------------------------------------
// PlatformAdapter — base interface for all platform sync adapters
//
// Each platform (Airtable, Notion, SmartSuite) implements this interface
// to transform records between platform-native and canonical JSONB form.
// ---------------------------------------------------------------------------

import type { CanonicalValue, SyncPlatform } from '../types';

/**
 * Maps an EveryStack field to its external platform counterpart.
 * Used by adapters to know which platform field corresponds to which
 * canonical field, and what types are involved on each side.
 */
export interface FieldMapping {
  /** EveryStack field UUID (the key in canonical_data). */
  fieldId: string;
  /** The field's ID on the source platform (e.g. Airtable's fldXxx). */
  externalFieldId: string;
  /** EveryStack canonical field type (e.g. 'text', 'number', 'currency'). */
  fieldType: string;
  /** Platform-native field type string (e.g. 'singleLineText', 'number'). */
  externalFieldType: string;
  /** Platform-specific options (select choices, currency codes, etc.). */
  config: Record<string, unknown>;
}

/**
 * Base interface for platform sync adapters.
 *
 * Adapters transform entire records between a platform's native shape
 * and EveryStack's canonical JSONB representation. They delegate
 * per-field transforms to the FieldTypeRegistry.
 */
export interface PlatformAdapter {
  /** Which platform this adapter handles. */
  platform: SyncPlatform;

  /**
   * Transform a platform-native record into canonical JSONB form.
   *
   * @param record - The raw record from the platform API
   * @param fieldMappings - Maps between ES fields and platform fields
   * @returns Canonical data keyed by ES field UUID
   */
  toCanonical(
    record: unknown,
    fieldMappings: FieldMapping[],
  ): Record<string, CanonicalValue>;

  /**
   * Transform canonical JSONB data back into the platform-native shape.
   *
   * @param canonicalData - Canonical values keyed by ES field UUID
   * @param fieldMappings - Maps between ES fields and platform fields
   * @returns Platform-native record fields
   */
  fromCanonical(
    canonicalData: Record<string, CanonicalValue>,
    fieldMappings: FieldMapping[],
  ): unknown;
}
