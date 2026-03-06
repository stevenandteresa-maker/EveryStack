// ---------------------------------------------------------------------------
// AirtableAdapter — transforms Airtable records to/from canonical JSONB
//
// Delegates per-field transforms to the FieldTypeRegistry.
// Unregistered field types are skipped with a warning (never crash the record).
// ---------------------------------------------------------------------------

import { createLogger } from '../../../logging/logger';
import { fieldTypeRegistry } from '../../field-registry';
import type { CanonicalValue, PlatformFieldConfig } from '../../types';
import type { PlatformAdapter, FieldMapping } from '../types';
import { AIRTABLE_TEXT_TRANSFORMS } from './text-transforms';
import { AIRTABLE_NUMBER_TRANSFORMS } from './number-transforms';
import { AIRTABLE_SELECTION_TRANSFORMS } from './selection-transforms';
import { AIRTABLE_DATE_TRANSFORMS } from './date-transforms';
import { AIRTABLE_PEOPLE_CONTACT_TRANSFORMS } from './people-contact-transforms';
import { AIRTABLE_BOOLEAN_INTERACTIVE_TRANSFORMS } from './boolean-interactive-transforms';
import { AIRTABLE_FILES_TRANSFORMS } from './files-transforms';
import { AIRTABLE_RELATIONAL_TRANSFORMS } from './relational-transforms';
import { AIRTABLE_IDENTIFICATION_TRANSFORMS } from './identification-transforms';
import { AIRTABLE_LOSSY_TRANSFORMS } from './lossy-transforms';

// Re-export filter pushdown utilities
export {
  translateFilterToFormula,
  applyLocalFilters,
  getLocalOnlyFilters,
  canPushDown,
} from './filter-pushdown';

// Re-export API client
export { AirtableApiClient, AIRTABLE_API_BASE_URL } from './api-client';
export type {
  AirtableApiRecord,
  AirtableListRecordsResponse,
  ListRecordsOptions,
} from './api-client';

const logger = createLogger({ service: 'sync' });

/**
 * Airtable record shape from the API.
 * Fields are keyed by field name or field ID depending on API config.
 */
interface AirtableRecord {
  fields: Record<string, unknown>;
}

/**
 * Register all Airtable transforms with the global FieldTypeRegistry.
 * Called once at application startup.
 */
export function registerAirtableTransforms(): void {
  for (const { airtableType, transform } of AIRTABLE_TEXT_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_NUMBER_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_SELECTION_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_DATE_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_PEOPLE_CONTACT_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_BOOLEAN_INTERACTIVE_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_FILES_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_RELATIONAL_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_IDENTIFICATION_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
  for (const { airtableType, transform } of AIRTABLE_LOSSY_TRANSFORMS) {
    fieldTypeRegistry.register('airtable', airtableType, transform);
  }
}

/**
 * Sync adapter for Airtable.
 *
 * Transforms Airtable API records to canonical JSONB keyed by ES field UUID,
 * and reverses canonical JSONB back to Airtable field values for outbound sync.
 */
export class AirtableAdapter implements PlatformAdapter {
  readonly platform = 'airtable' as const;

  /**
   * Transform an Airtable record into canonical JSONB form.
   *
   * Iterates field mappings, looks up the transform for each Airtable field type,
   * and converts the value. Unregistered field types are skipped with a warning.
   *
   * @param record - Raw Airtable record (must have a `fields` object)
   * @param fieldMappings - Maps between ES fields and Airtable fields
   * @returns Canonical data keyed by ES field UUID
   */
  toCanonical(
    record: unknown,
    fieldMappings: FieldMapping[],
  ): Record<string, CanonicalValue> {
    const airtableRecord = record as AirtableRecord;
    const fields = airtableRecord?.fields ?? {};
    const canonical: Record<string, CanonicalValue> = {};

    for (const mapping of fieldMappings) {
      if (!fieldTypeRegistry.has('airtable', mapping.externalFieldType)) {
        logger.warn(
          { fieldType: mapping.externalFieldType, fieldId: mapping.fieldId },
          `Skipping unregistered Airtable field type "${mapping.externalFieldType}"`,
        );
        continue;
      }

      const transform = fieldTypeRegistry.get('airtable', mapping.externalFieldType);
      const rawValue = fields[mapping.externalFieldId];

      const fieldConfig: PlatformFieldConfig = {
        externalFieldId: mapping.externalFieldId,
        name: mapping.externalFieldId,
        platformFieldType: mapping.externalFieldType,
        options: mapping.config,
      };

      canonical[mapping.fieldId] = transform.toCanonical(rawValue, fieldConfig);
    }

    return canonical;
  }

  /**
   * Transform canonical JSONB data back to Airtable field values.
   *
   * Iterates field mappings and converts each canonical value back to
   * its Airtable-native representation. Read-only fields and unregistered
   * types are skipped.
   *
   * @param canonicalData - Canonical values keyed by ES field UUID
   * @param fieldMappings - Maps between ES fields and Airtable fields
   * @returns Airtable record fields object
   */
  fromCanonical(
    canonicalData: Record<string, CanonicalValue>,
    fieldMappings: FieldMapping[],
  ): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      const canonicalValue = canonicalData[mapping.fieldId];
      if (canonicalValue === undefined) continue;

      if (!fieldTypeRegistry.has('airtable', mapping.externalFieldType)) {
        logger.warn(
          { fieldType: mapping.externalFieldType, fieldId: mapping.fieldId },
          `Skipping unregistered Airtable field type "${mapping.externalFieldType}"`,
        );
        continue;
      }

      const transform = fieldTypeRegistry.get('airtable', mapping.externalFieldType);

      // Skip read-only fields on outbound sync
      if (!transform.supportedOperations.includes('write')) continue;

      const fieldConfig: PlatformFieldConfig = {
        externalFieldId: mapping.externalFieldId,
        name: mapping.externalFieldId,
        platformFieldType: mapping.externalFieldType,
        options: mapping.config,
      };

      fields[mapping.externalFieldId] = transform.fromCanonical(canonicalValue, fieldConfig);
    }

    return fields;
  }
}
