/**
 * SDS Schema Version Hash — produces a stable SHA-256 hash of workspace schema.
 *
 * The hash captures table definitions, field definitions, and cross-link
 * definitions for a workspace. Same schema → same hash. Used as part of
 * Redis cache keys so that schema changes naturally invalidate cached entries
 * (keys with old hashes are never hit again).
 *
 * @see docs/reference/schema-descriptor-service.md § Caching Strategy
 */

import { createHash } from 'node:crypto';
import { eq, and, sql, asc } from 'drizzle-orm';
import { tables } from '../../db/schema/tables';
import { fields } from '../../db/schema/fields';
import { crossLinks } from '../../db/schema/cross-links';
import type { DrizzleClient } from '../../db/client';

/**
 * Computes a stable SHA-256 hash from workspace schema metadata.
 *
 * Hash inputs (all sorted for stability):
 * - Table IDs (sorted)
 * - Field metadata per table: id, fieldType, config (sorted by id)
 * - Cross-link metadata: id, sourceTableId, sourceFieldId, targetTableId,
 *   targetDisplayFieldId, relationshipType (sorted by id)
 *
 * @param workspaceId - UUID of the workspace
 * @param tenantId - UUID of the tenant (for isolation)
 * @param db - Drizzle client from getDbForTenant()
 * @returns Hex-encoded SHA-256 hash string
 */
export async function computeSchemaVersionHash(
  workspaceId: string,
  tenantId: string,
  db: DrizzleClient,
): Promise<string> {
  // 1. Get all table IDs in this workspace, sorted for stability
  const workspaceTables = await db
    .select({ id: tables.id })
    .from(tables)
    .where(and(eq(tables.workspaceId, workspaceId), eq(tables.tenantId, tenantId)))
    .orderBy(asc(tables.id));

  const tableIds = workspaceTables.map((t) => t.id);

  if (tableIds.length === 0) {
    // Empty workspace — deterministic empty hash
    return createHash('sha256').update('empty').digest('hex');
  }

  // 2. Get all fields for these tables, sorted by id for stability
  const fieldRows = await db
    .select({
      id: fields.id,
      tableId: fields.tableId,
      fieldType: fields.fieldType,
      config: fields.config,
    })
    .from(fields)
    .where(
      and(
        eq(fields.tenantId, tenantId),
        sql`${fields.tableId} IN (${sql.join(
          tableIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    )
    .orderBy(asc(fields.id));

  // 3. Get all cross-links where source or target is in workspace tables, sorted by id
  const crossLinkRows = await db
    .select({
      id: crossLinks.id,
      sourceTableId: crossLinks.sourceTableId,
      sourceFieldId: crossLinks.sourceFieldId,
      targetTableId: crossLinks.targetTableId,
      targetDisplayFieldId: crossLinks.targetDisplayFieldId,
      relationshipType: crossLinks.relationshipType,
    })
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
    )
    .orderBy(asc(crossLinks.id));

  // 4. Build deterministic hash input
  const hash = createHash('sha256');

  // Tables
  for (const t of workspaceTables) {
    hash.update(`t:${t.id}\n`);
  }

  // Fields (id + type + config as sorted JSON)
  for (const f of fieldRows) {
    const configStr = JSON.stringify(f.config ?? {}, Object.keys(f.config ?? {}).sort());
    hash.update(`f:${f.id}:${f.tableId}:${f.fieldType}:${configStr}\n`);
  }

  // Cross-links
  for (const cl of crossLinkRows) {
    hash.update(
      `cl:${cl.id}:${cl.sourceTableId}:${cl.sourceFieldId}:${cl.targetTableId}:${cl.targetDisplayFieldId}:${cl.relationshipType}\n`,
    );
  }

  return hash.digest('hex');
}
