/**
 * SDS Workspace Descriptor Builder — assembles a full WorkspaceDescriptor.
 *
 * Queries workspace tables, groups them by base connection (via synced_field_mappings),
 * builds TableDescriptors per table, and constructs a deduplicated link_graph from
 * cross_links definitions.
 *
 * Native EveryStack tables (no synced field mappings) appear under a synthetic
 * "Native" base grouping with base_id: 'native', platform: 'everystack'.
 *
 * This function does NOT filter by permissions — that happens in Unit 2.
 *
 * @see docs/reference/schema-descriptor-service.md § Output Schema
 */

import { eq, and, sql } from 'drizzle-orm';
import { tables } from '../../db/schema/tables';
import { fields } from '../../db/schema/fields';
import { crossLinks } from '../../db/schema/cross-links';
import { baseConnections } from '../../db/schema/base-connections';
import { syncedFieldMappings } from '../../db/schema/synced-field-mappings';
import type { DrizzleClient } from '../../db/client';
import type { WorkspaceDescriptor, BaseDescriptor, LinkEdge } from './types';
import { buildTableDescriptor } from './table-builder';

/** Synthetic base grouping constants for native (non-synced) tables. */
const NATIVE_BASE_ID = 'native';
const NATIVE_BASE_NAME = 'Native Tables';
const NATIVE_BASE_PLATFORM = 'everystack';

/**
 * Builds an LLM-optimized WorkspaceDescriptor for a single workspace.
 *
 * @param workspaceId - UUID of the workspace
 * @param tenantId - UUID of the tenant (for isolation)
 * @param db - Drizzle client from getDbForTenant()
 * @returns WorkspaceDescriptor with bases, tables, fields, and link_graph
 */
export async function buildWorkspaceDescriptor(
  workspaceId: string,
  tenantId: string,
  db: DrizzleClient,
): Promise<WorkspaceDescriptor> {
  // 1. Get all tables in this workspace, scoped by tenant
  const workspaceTables = await db
    .select({ id: tables.id, name: tables.name })
    .from(tables)
    .where(and(eq(tables.workspaceId, workspaceId), eq(tables.tenantId, tenantId)));

  if (workspaceTables.length === 0) {
    return { workspace_id: workspaceId, bases: [], link_graph: [] };
  }

  const tableIds = workspaceTables.map((t) => t.id);

  // 2. Find which tables are synced to which base_connections (batch query)
  const mappings = await db
    .select({
      tableId: syncedFieldMappings.tableId,
      baseConnectionId: syncedFieldMappings.baseConnectionId,
    })
    .from(syncedFieldMappings)
    .where(
      and(
        eq(syncedFieldMappings.tenantId, tenantId),
        sql`${syncedFieldMappings.tableId} IN (${sql.join(
          tableIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    );

  // Build a map: tableId → baseConnectionId (first match — a table belongs to one base)
  const tableToBaseMap = new Map<string, string>();
  for (const m of mappings) {
    if (!tableToBaseMap.has(m.tableId)) {
      tableToBaseMap.set(m.tableId, m.baseConnectionId);
    }
  }

  // 3. Fetch base_connection details for all discovered base IDs (batch query)
  const baseIds = [...new Set(tableToBaseMap.values())];
  const baseMap = new Map<string, { id: string; name: string; platform: string }>();

  if (baseIds.length > 0) {
    const baseRows = await db
      .select({
        id: baseConnections.id,
        name: baseConnections.externalBaseName,
        platform: baseConnections.platform,
      })
      .from(baseConnections)
      .where(
        and(
          eq(baseConnections.tenantId, tenantId),
          sql`${baseConnections.id} IN (${sql.join(
            baseIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    for (const row of baseRows) {
      baseMap.set(row.id, {
        id: row.id,
        name: row.name ?? row.id,
        platform: row.platform,
      });
    }
  }

  // 4. Group tables by base connection
  const baseToTables = new Map<string, string[]>();
  const nativeTableIds: string[] = [];

  for (const t of workspaceTables) {
    const baseId = tableToBaseMap.get(t.id);
    if (baseId) {
      const existing = baseToTables.get(baseId) ?? [];
      existing.push(t.id);
      baseToTables.set(baseId, existing);
    } else {
      nativeTableIds.push(t.id);
    }
  }

  // 5. Build TableDescriptors per table using buildTableDescriptor()
  const bases: BaseDescriptor[] = [];

  // Process synced bases
  for (const [baseId, tIds] of baseToTables) {
    const baseInfo = baseMap.get(baseId);
    const tableDescriptors = await Promise.all(
      tIds.map((tableId) => buildTableDescriptor(tableId, tenantId, db)),
    );

    bases.push({
      base_id: baseInfo?.id ?? baseId,
      name: baseInfo?.name ?? baseId,
      platform: baseInfo?.platform ?? 'unknown',
      tables: tableDescriptors,
    });
  }

  // Process native tables
  if (nativeTableIds.length > 0) {
    const nativeDescriptors = await Promise.all(
      nativeTableIds.map((tableId) => buildTableDescriptor(tableId, tenantId, db)),
    );

    bases.push({
      base_id: NATIVE_BASE_ID,
      name: NATIVE_BASE_NAME,
      platform: NATIVE_BASE_PLATFORM,
      tables: nativeDescriptors,
    });
  }

  // 6. Build deduplicated link_graph from cross_links
  const linkGraph = await buildLinkGraph(tableIds, tenantId, db, tableToBaseMap);

  return {
    workspace_id: workspaceId,
    bases,
    link_graph: linkGraph,
  };
}

/**
 * Builds a deduplicated link_graph array from cross_links definitions.
 *
 * Symmetric cross-links (where reverse_field_id exists) are deduplicated:
 * only the direction where source_table_id < target_table_id lexicographically
 * is included.
 */
async function buildLinkGraph(
  tableIds: string[],
  tenantId: string,
  db: DrizzleClient,
  tableToBaseMap: Map<string, string>,
): Promise<LinkEdge[]> {
  // Query all cross_links where source or target is in our workspace tables
  const crossLinkRows = await db
    .select()
    .from(crossLinks)
    .where(
      and(
        eq(crossLinks.tenantId, tenantId),
        sql`(${crossLinks.sourceTableId} IN (${sql.join(
          tableIds.map((id) => sql`${id}`),
          sql`, `,
        )}) OR ${crossLinks.targetTableId} IN (${sql.join(
          tableIds.map((id) => sql`${id}`),
          sql`, `,
        )}))`,
      ),
    );

  if (crossLinkRows.length === 0) {
    return [];
  }

  // Collect all field IDs and table IDs we need names for
  const fieldIdsNeeded = new Set<string>();
  const tableIdsNeeded = new Set<string>();

  for (const cl of crossLinkRows) {
    fieldIdsNeeded.add(cl.sourceFieldId);
    tableIdsNeeded.add(cl.sourceTableId);
    tableIdsNeeded.add(cl.targetTableId);
    if (cl.reverseFieldId) {
      fieldIdsNeeded.add(cl.reverseFieldId);
    }
  }

  // Batch-fetch field names
  const fieldIdArray = [...fieldIdsNeeded];
  const fieldNameMap = new Map<string, string>();

  if (fieldIdArray.length > 0) {
    const fieldRows = await db
      .select({ id: fields.id, name: fields.name, tableId: fields.tableId })
      .from(fields)
      .where(
        sql`${fields.id} IN (${sql.join(
          fieldIdArray.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    for (const f of fieldRows) {
      fieldNameMap.set(f.id, f.name);
    }
  }

  // Batch-fetch table names
  const tableIdArray = [...tableIdsNeeded];
  const tableNameMap = new Map<string, string>();

  if (tableIdArray.length > 0) {
    const tableRows = await db
      .select({ id: tables.id, name: tables.name })
      .from(tables)
      .where(
        sql`${tables.id} IN (${sql.join(
          tableIdArray.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    for (const t of tableRows) {
      tableNameMap.set(t.id, t.name);
    }
  }

  // Build edges with deduplication
  const edges: LinkEdge[] = [];
  const seen = new Set<string>();

  for (const cl of crossLinkRows) {
    // Deduplication: if reverse_field_id exists, only include the direction
    // where source_table_id < target_table_id lexicographically
    if (cl.reverseFieldId && cl.sourceTableId > cl.targetTableId) {
      continue;
    }

    // Dedup key to prevent duplicate edges from the same cross_link
    const dedupKey = cl.id;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    const sourceBaseId = tableToBaseMap.get(cl.sourceTableId) ?? NATIVE_BASE_ID;
    const targetBaseId = tableToBaseMap.get(cl.targetTableId) ?? NATIVE_BASE_ID;

    const sourceTableName = tableNameMap.get(cl.sourceTableId) ?? cl.sourceTableId;
    const targetTableName = tableNameMap.get(cl.targetTableId) ?? cl.targetTableId;
    const fieldName = fieldNameMap.get(cl.sourceFieldId) ?? cl.sourceFieldId;

    edges.push({
      from: `${sourceBaseId}.${cl.sourceTableId}.${cl.sourceFieldId}`,
      to: `${targetBaseId}.${cl.targetTableId}.${cl.reverseFieldId ?? cl.targetDisplayFieldId}`,
      cardinality: cl.relationshipType as 'many_to_one' | 'one_to_many',
      label: `${sourceTableName} \u2192 ${targetTableName} via ${fieldName}`,
    });
  }

  return edges;
}
