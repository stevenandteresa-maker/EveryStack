/**
 * Schema Sync — creates ES tables, fields, and synced_field_mappings
 * from Airtable table metadata during initial sync.
 *
 * Not a separate BullMQ processor — called directly by InitialSyncProcessor
 * as Phase 1 of the progressive sync pipeline.
 */

import type { Logger } from '@everystack/shared/logging';
import {
  getDbForTenant,
  tables,
  fields,
  syncedFieldMappings,
  baseConnections,
  generateUUIDv7,
  eq,
  and,
} from '@everystack/shared/db';
import { fieldTypeRegistry } from '@everystack/shared/sync';
import type { SyncConfig, SyncTableConfig } from '@everystack/shared/sync';
import type { EventPublisher } from '@everystack/shared/realtime';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';
import type { AirtableApiClient } from '@everystack/shared/sync';
import type { AirtableFieldMeta } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Airtable → Canonical type mapping
// ---------------------------------------------------------------------------

/**
 * Static map from Airtable field type strings to ES canonical field types.
 * Derived from the registered transforms. Field types not in this map
 * are skipped during schema sync (logged as warning).
 */
const AIRTABLE_TO_CANONICAL_TYPE: Record<string, string> = {
  // Text
  singleLineText: 'text',
  multilineText: 'text_area',
  richText: 'smart_doc',
  // Number
  number: 'number',
  currency: 'currency',
  percent: 'percent',
  rating: 'rating',
  duration: 'duration',
  progress: 'progress',
  autoNumber: 'auto_number',
  // Selection
  singleSelect: 'single_select',
  multipleSelects: 'multiple_select',
  status: 'status',
  tag: 'tag',
  // Date & Time
  date: 'date',
  dateTime: 'date',
  dateRange: 'date_range',
  dueDate: 'due_date',
  time: 'time',
  createdTime: 'created_at',
  lastModifiedTime: 'updated_at',
  // People & Contact
  collaborator: 'people',
  createdBy: 'created_by',
  lastModifiedBy: 'updated_by',
  email: 'email',
  phoneNumber: 'phone',
  url: 'url',
  address: 'address',
  fullName: 'full_name',
  social: 'social',
  // Boolean & Interactive
  checkbox: 'checkbox',
  button: 'button',
  // Files
  multipleAttachments: 'files',
  // Relational
  multipleRecordLinks: 'linked_record',
  // Identification
  barcode: 'barcode',
  // Lossy (computed — read-only)
  lookup: 'text',
  rollup: 'text',
  formula: 'text',
  count: 'number',
};

// ---------------------------------------------------------------------------
// Schema sync types
// ---------------------------------------------------------------------------

export interface SchemaSyncParams {
  tenantId: string;
  connectionId: string;
  baseId: string;
  workspaceId: string;
  createdBy: string;
  syncConfig: SyncConfig;
  apiClient: AirtableApiClient;
  eventPublisher: EventPublisher;
  logger: Logger;
}

export interface SchemaSyncResult {
  /** Maps external_table_id → ES table UUID */
  tableMap: Map<string, string>;
  /** Updated sync config with remapped filter field IDs */
  updatedSyncConfig: SyncConfig;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Sync schema from Airtable to ES tables/fields/mappings for all enabled
 * tables in the sync config.
 *
 * For each enabled table:
 * 1. Fetch field metadata from Airtable
 * 2. Upsert ES table row
 * 3. Create ES field rows and synced_field_mappings
 * 4. Remap filter field IDs from Airtable → ES
 * 5. Emit SYNC_SCHEMA_READY event
 */
export async function syncSchema(params: SchemaSyncParams): Promise<SchemaSyncResult> {
  const {
    tenantId,
    connectionId,
    workspaceId,
    createdBy,
    syncConfig,
    apiClient,
    eventPublisher,
    logger,
  } = params;

  const db = getDbForTenant(tenantId);
  const tableMap = new Map<string, string>();
  const updatedTables: SyncTableConfig[] = [];

  for (const tableConfig of syncConfig.tables) {
    if (!tableConfig.enabled) {
      updatedTables.push(tableConfig);
      continue;
    }

    logger.info(
      { externalTableId: tableConfig.external_table_id, tableName: tableConfig.external_table_name },
      'Syncing schema for table',
    );

    // 1. Fetch field metadata from Airtable
    const airtableFields = await apiClient.listFields(tableConfig.external_table_id);

    // 2. Create ES table
    const esTableId = generateUUIDv7();
    await db.insert(tables).values({
      id: esTableId,
      workspaceId,
      tenantId,
      name: tableConfig.external_table_name,
      tableType: 'synced',
      createdBy,
    });

    tableMap.set(tableConfig.external_table_id, esTableId);

    // 3. Create fields and mappings
    // Build a map from Airtable fldXxx → ES field UUID for filter remapping
    const airtableToEsFieldMap = new Map<string, string>();
    const createdFields: Array<{ id: string; name: string; fieldType: string; externalFieldId: string }> = [];

    for (const airtableField of airtableFields) {
      const canonicalType = resolveCanonicalType(airtableField, logger);
      if (!canonicalType) continue;

      const esFieldId = generateUUIDv7();
      airtableToEsFieldMap.set(airtableField.id, esFieldId);

      // Insert ES field
      await db.insert(fields).values({
        id: esFieldId,
        tableId: esTableId,
        tenantId,
        name: airtableField.name,
        fieldType: canonicalType,
        externalFieldId: airtableField.id,
        config: airtableField.options ?? {},
      });

      // Insert synced_field_mapping
      await db.insert(syncedFieldMappings).values({
        tenantId,
        baseConnectionId: connectionId,
        tableId: esTableId,
        fieldId: esFieldId,
        externalFieldId: airtableField.id,
        externalFieldType: airtableField.type,
      });

      createdFields.push({
        id: esFieldId,
        name: airtableField.name,
        fieldType: canonicalType,
        externalFieldId: airtableField.id,
      });
    }

    // 4. Remap filter field IDs from Airtable fldXxx → ES UUIDs
    const updatedFilter = remapFilterFieldIds(
      tableConfig.sync_filter,
      airtableToEsFieldMap,
      logger,
    );

    updatedTables.push({
      ...tableConfig,
      sync_filter: updatedFilter,
    });

    // 5. Emit SYNC_SCHEMA_READY event
    await eventPublisher.publish({
      tenantId,
      channel: `workspace:${workspaceId}`,
      event: REALTIME_EVENTS.SYNC_SCHEMA_READY,
      payload: {
        tableId: esTableId,
        externalTableId: tableConfig.external_table_id,
        tableName: tableConfig.external_table_name,
        fields: createdFields,
      },
    });

    logger.info(
      { esTableId, fieldsCreated: createdFields.length, fieldsSkipped: airtableFields.length - createdFields.length },
      'Schema sync complete for table',
    );
  }

  // Update sync_config on base_connections with remapped filter IDs
  const updatedSyncConfig: SyncConfig = {
    ...syncConfig,
    tables: updatedTables,
  };

  await db
    .update(baseConnections)
    .set({ syncConfig: updatedSyncConfig as unknown as Record<string, unknown> })
    .where(
      and(
        eq(baseConnections.id, connectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    );

  return { tableMap, updatedSyncConfig };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical field type for an Airtable field.
 * Returns null for unregistered types (logged as warning).
 */
function resolveCanonicalType(
  field: AirtableFieldMeta,
  logger: Logger,
): string | null {
  // First check the static map
  const canonicalType = AIRTABLE_TO_CANONICAL_TYPE[field.type];
  if (canonicalType) return canonicalType;

  // Check the registry as fallback for any dynamically registered types
  if (fieldTypeRegistry.has('airtable', field.type)) {
    // Use a dummy transform to determine the output type
    logger.warn(
      { fieldType: field.type, fieldId: field.id, fieldName: field.name },
      'Airtable field type not in static map but found in registry — using text fallback',
    );
    return 'text';
  }

  logger.warn(
    { fieldType: field.type, fieldId: field.id, fieldName: field.name },
    'Skipping unregistered Airtable field type',
  );
  return null;
}

/**
 * Remap filter rule field IDs from Airtable fldXxx → ES field UUIDs.
 * Rules referencing unmapped fields are dropped with a warning.
 */
function remapFilterFieldIds(
  filters: SyncTableConfig['sync_filter'],
  airtableToEsFieldMap: Map<string, string>,
  logger: Logger,
): SyncTableConfig['sync_filter'] {
  if (!filters || filters.length === 0) return filters;

  const remapped = filters
    .map((rule) => {
      const esFieldId = airtableToEsFieldMap.get(rule.fieldId);
      if (!esFieldId) {
        logger.warn(
          { airtableFieldId: rule.fieldId },
          'Filter rule references unmapped Airtable field — dropping rule',
        );
        return null;
      }
      return { ...rule, fieldId: esFieldId };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return remapped.length > 0 ? remapped : null;
}
