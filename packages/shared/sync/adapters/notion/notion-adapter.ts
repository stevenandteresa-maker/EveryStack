// ---------------------------------------------------------------------------
// NotionAdapter — transforms Notion pages to/from canonical JSONB
//
// Delegates per-field transforms to the FieldTypeRegistry.
// Unregistered field types are skipped with a warning (never crash the record).
//
// Notion's page/property model: each Notion page has a `properties` map.
// Each property has a `type` discriminant and the value is nested under
// the type key. The adapter extracts the value before passing to transforms.
// ---------------------------------------------------------------------------

import { createLogger } from '../../../logging/logger';
import { fieldTypeRegistry } from '../../field-registry';
import type { CanonicalValue, PlatformFieldConfig } from '../../types';
import type { PlatformAdapter, FieldMapping } from '../types';
import { NOTION_TRANSFORMS } from './notion-field-transforms';
import type { NotionPage, NotionProperty, NotionPropertyType } from './notion-types';

const logger = createLogger({ service: 'sync' });

/**
 * Extract the typed value from a Notion property object.
 *
 * Notion nests the value under the property's type key:
 *   { type: 'title', title: [...] }        -> rich text array
 *   { type: 'number', number: 42 }         -> 42
 *   { type: 'select', select: {...} }       -> option object
 *   { type: 'checkbox', checkbox: true }    -> true
 *
 * This function extracts that nested value for the transform.
 */
function extractPropertyValue(property: NotionProperty): unknown {
  const type = property.type as NotionPropertyType;
  return (property as unknown as Record<string, unknown>)[type];
}

/**
 * Register all Notion transforms with the global FieldTypeRegistry.
 * Called once at application startup.
 */
export function registerNotionTransforms(): void {
  for (const { notionType, transform } of NOTION_TRANSFORMS) {
    fieldTypeRegistry.register('notion', notionType, transform);
  }
}

/**
 * Sync adapter for Notion.
 *
 * Transforms Notion page properties to canonical JSONB keyed by ES field UUID,
 * and reverses canonical JSONB back to Notion property values for outbound sync.
 */
export class NotionAdapter implements PlatformAdapter {
  readonly platform = 'notion' as const;

  /**
   * Transform a Notion page into canonical JSONB form.
   *
   * Iterates field mappings, looks up the transform for each Notion property type,
   * and converts the value. Unregistered property types are skipped with a warning.
   *
   * @param record - Raw Notion page object (must have a `properties` map)
   * @param fieldMappings - Maps between ES fields and Notion properties
   * @returns Canonical data keyed by ES field UUID
   */
  toCanonical(
    record: unknown,
    fieldMappings: FieldMapping[],
  ): Record<string, CanonicalValue> {
    const page = record as NotionPage;
    const properties = page?.properties ?? {};
    const canonical: Record<string, CanonicalValue> = {};

    for (const mapping of fieldMappings) {
      if (!fieldTypeRegistry.has('notion', mapping.externalFieldType)) {
        logger.warn(
          { fieldType: mapping.externalFieldType, fieldId: mapping.fieldId },
          `Skipping unregistered Notion property type "${mapping.externalFieldType}"`,
        );
        continue;
      }

      // Find the property by external field ID (Notion property ID)
      const property = findPropertyById(properties, mapping.externalFieldId);
      if (!property) continue;

      const transform = fieldTypeRegistry.get('notion', mapping.externalFieldType);
      const rawValue = extractPropertyValue(property);

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
   * Transform canonical JSONB data back to Notion property values.
   *
   * Iterates field mappings and converts each canonical value back to
   * its Notion-native representation. Read-only fields and unregistered
   * types are skipped.
   *
   * @param canonicalData - Canonical values keyed by ES field UUID
   * @param fieldMappings - Maps between ES fields and Notion properties
   * @returns Notion properties object for the Notion API
   */
  fromCanonical(
    canonicalData: Record<string, CanonicalValue>,
    fieldMappings: FieldMapping[],
  ): Record<string, unknown> {
    const properties: Record<string, unknown> = {};

    for (const mapping of fieldMappings) {
      const canonicalValue = canonicalData[mapping.fieldId];
      if (canonicalValue === undefined) continue;

      if (!fieldTypeRegistry.has('notion', mapping.externalFieldType)) {
        logger.warn(
          { fieldType: mapping.externalFieldType, fieldId: mapping.fieldId },
          `Skipping unregistered Notion property type "${mapping.externalFieldType}"`,
        );
        continue;
      }

      const transform = fieldTypeRegistry.get('notion', mapping.externalFieldType);

      // Skip read-only fields on outbound sync
      if (!transform.supportedOperations.includes('write')) continue;

      const fieldConfig: PlatformFieldConfig = {
        externalFieldId: mapping.externalFieldId,
        name: mapping.externalFieldId,
        platformFieldType: mapping.externalFieldType,
        options: mapping.config,
      };

      const result = transform.fromCanonical(canonicalValue, fieldConfig);
      if (result !== undefined) {
        properties[mapping.externalFieldId] = result;
      }
    }

    return properties;
  }
}

/**
 * Find a Notion property by its ID within the properties map.
 * Notion properties are keyed by name, but each has an `id` field.
 */
function findPropertyById(
  properties: Record<string, NotionProperty>,
  propertyId: string,
): NotionProperty | undefined {
  // First try direct key lookup (in case the map is keyed by ID)
  const direct = properties[propertyId];
  if (direct) return direct;

  // Search by the property's id field
  for (const property of Object.values(properties)) {
    if (property.id === propertyId) return property;
  }

  return undefined;
}
