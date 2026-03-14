/**
 * SDS Table Descriptor Builder — assembles a TableDescriptor for a single table.
 *
 * Queries table metadata, fields (ordered by sort_order), and cross-link
 * definitions, then maps each field through mapFieldToDescriptor().
 *
 * Uses pg_stat_user_tables.n_live_tup for approximate row counts (no table scan).
 *
 * This function does NOT filter by permissions — that happens in Unit 2.
 *
 * @see docs/reference/schema-descriptor-service.md § Output Schema
 */

import { eq, and, sql } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { tables } from '../../db/schema/tables';
import { fields } from '../../db/schema/fields';
import { crossLinks } from '../../db/schema/cross-links';
import type { DrizzleClient } from '../../db/client';
import type { CrossLink } from '../../db/schema/cross-links';
import type { TableDescriptor } from './types';
import { mapFieldToDescriptor } from './field-mapper';

/**
 * Builds an LLM-optimized TableDescriptor for a single table.
 *
 * @param tableId - UUID of the table
 * @param tenantId - UUID of the tenant (for isolation)
 * @param db - Drizzle client from getDbForTenant()
 * @returns TableDescriptor ready for SDS output
 * @throws Error if the table is not found for the given tenant
 */
export async function buildTableDescriptor(
  tableId: string,
  tenantId: string,
  db: DrizzleClient,
): Promise<TableDescriptor> {
  // 1. Query table metadata, scoped by tenantId
  const [tableRow] = await db
    .select({ id: tables.id, name: tables.name })
    .from(tables)
    .where(and(eq(tables.id, tableId), eq(tables.tenantId, tenantId)));

  if (!tableRow) {
    throw new Error(`Table ${tableId} not found for tenant ${tenantId}`);
  }

  // 2. Get approximate row count from pg_stat_user_tables (no table scan)
  const recordCountApprox = await getApproxRowCount(tableRow.name, db);

  // 3. Retrieve all fields ordered by sort_order
  const fieldRows = await db
    .select()
    .from(fields)
    .where(and(eq(fields.tableId, tableId), eq(fields.tenantId, tenantId)))
    .orderBy(asc(fields.sortOrder));

  // 4. Batch-fetch cross-link definitions for linked_record fields
  const linkedFieldIds = fieldRows
    .filter((f) => f.fieldType === 'linked_record')
    .map((f) => f.id);

  const crossLinkMap = new Map<string, CrossLink>();

  if (linkedFieldIds.length > 0) {
    const crossLinkRows = await db
      .select()
      .from(crossLinks)
      .where(
        and(
          eq(crossLinks.tenantId, tenantId),
          sql`${crossLinks.sourceFieldId} IN (${sql.join(
            linkedFieldIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      );

    for (const cl of crossLinkRows) {
      crossLinkMap.set(cl.sourceFieldId, cl);
    }
  }

  // 5. Map each field through mapFieldToDescriptor()
  const fieldDescriptors = fieldRows.map((field) => {
    const crossLinkDef = crossLinkMap.get(field.id);
    return mapFieldToDescriptor(field, crossLinkDef);
  });

  // 6. Assemble and return TableDescriptor
  return {
    table_id: tableRow.id,
    name: tableRow.name,
    record_count_approx: recordCountApprox,
    fields: fieldDescriptors,
  };
}

/**
 * Gets approximate row count from pg_stat_user_tables.n_live_tup.
 * Falls back to 0 if the stats row doesn't exist (e.g., freshly created table).
 */
async function getApproxRowCount(
  tableName: string,
  db: DrizzleClient,
): Promise<number> {
  const result = await db.execute(
    sql`SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = ${tableName}`,
  );

  const rows = result as unknown as Array<{ n_live_tup: string | number }>;
  const first = rows[0];
  if (!first) {
    return 0;
  }

  return Number(first.n_live_tup) || 0;
}
