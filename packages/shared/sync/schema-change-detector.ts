/**
 * Schema Change Detector — compares platform field schema against
 * locally stored synced_field_mappings to detect schema mismatches.
 *
 * Called at the start of each inbound sync cycle. Detects:
 * - field_type_changed: mapped field's platform type differs
 * - field_deleted: mapped field no longer exists on platform
 * - field_added: platform field has no local mapping
 * - field_renamed: mapped field's name changed on platform
 *
 * @see docs/reference/sync-engine.md § Schema Mismatch
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocalFieldMapping {
  /** synced_field_mappings.field_id */
  fieldId: string;
  /** synced_field_mappings.external_field_id */
  externalFieldId: string;
  /** synced_field_mappings.external_field_type */
  externalFieldType: string;
  /** fields.name */
  fieldName: string;
}

export interface PlatformFieldDefinition {
  /** External platform field ID (e.g. Airtable fldXxx, Notion property ID) */
  id: string;
  /** Field name on the platform */
  name: string;
  /** Field type string on the platform (e.g. 'singleLineText', 'number') */
  type: string;
  /** Platform-specific options/config */
  options?: Record<string, unknown>;
}

export interface SchemaChange {
  changeType: 'field_type_changed' | 'field_deleted' | 'field_added' | 'field_renamed';
  /** EveryStack field ID (null for field_added — no local field yet) */
  fieldId: string | null;
  /** External platform field ID */
  platformFieldId: string;
  /** Previous field schema (null for field_added) */
  oldSchema: Record<string, unknown> | null;
  /** New field schema from platform (null for field_deleted) */
  newSchema: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/**
 * Compare local field mappings against the platform's current field schema
 * and return a list of detected schema changes.
 *
 * A single field can produce multiple changes (e.g. renamed AND type changed).
 */
export function detectSchemaChanges(
  localMappings: LocalFieldMapping[],
  platformFields: PlatformFieldDefinition[],
): SchemaChange[] {
  const changes: SchemaChange[] = [];

  // Index platform fields by their ID for O(1) lookup
  const platformFieldMap = new Map<string, PlatformFieldDefinition>();
  for (const pf of platformFields) {
    platformFieldMap.set(pf.id, pf);
  }

  // Index local mappings by external field ID for O(1) lookup
  const localMappingMap = new Map<string, LocalFieldMapping>();
  for (const mapping of localMappings) {
    localMappingMap.set(mapping.externalFieldId, mapping);
  }

  // Check each local mapping against platform fields
  for (const mapping of localMappings) {
    const platformField = platformFieldMap.get(mapping.externalFieldId);

    if (!platformField) {
      // Field deleted on platform
      changes.push({
        changeType: 'field_deleted',
        fieldId: mapping.fieldId,
        platformFieldId: mapping.externalFieldId,
        oldSchema: {
          name: mapping.fieldName,
          type: mapping.externalFieldType,
        },
        newSchema: null,
      });
      continue;
    }

    // Field type changed
    if (platformField.type !== mapping.externalFieldType) {
      changes.push({
        changeType: 'field_type_changed',
        fieldId: mapping.fieldId,
        platformFieldId: mapping.externalFieldId,
        oldSchema: {
          name: mapping.fieldName,
          type: mapping.externalFieldType,
        },
        newSchema: {
          name: platformField.name,
          type: platformField.type,
          options: platformField.options ?? {},
        },
      });
    }

    // Field renamed (detect by matching on platform_field_id)
    if (platformField.name !== mapping.fieldName) {
      changes.push({
        changeType: 'field_renamed',
        fieldId: mapping.fieldId,
        platformFieldId: mapping.externalFieldId,
        oldSchema: {
          name: mapping.fieldName,
          type: mapping.externalFieldType,
        },
        newSchema: {
          name: platformField.name,
          type: platformField.type,
          options: platformField.options ?? {},
        },
      });
    }
  }

  // Check for new fields on the platform (no local mapping)
  for (const platformField of platformFields) {
    if (!localMappingMap.has(platformField.id)) {
      changes.push({
        changeType: 'field_added',
        fieldId: null,
        platformFieldId: platformField.id,
        oldSchema: null,
        newSchema: {
          name: platformField.name,
          type: platformField.type,
          options: platformField.options ?? {},
        },
      });
    }
  }

  return changes;
}
