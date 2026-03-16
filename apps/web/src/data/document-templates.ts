/**
 * Document Template data access functions.
 *
 * Tenant-scoped CRUD for document templates (TipTap Smart Doc templates
 * with merge tags, stored per table).
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  documentTemplates,
  users,
} from '@everystack/shared/db';
import type { DocumentTemplate } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { DocumentTemplate } from '@everystack/shared/db';

export interface DocumentTemplateWithCreator extends DocumentTemplate {
  creatorName: string;
}

// ---------------------------------------------------------------------------
// getDocumentTemplate
// ---------------------------------------------------------------------------

/**
 * Fetch a single document template by ID, tenant-scoped.
 * Joins the creator's name from the users table.
 */
export async function getDocumentTemplate(
  tenantId: string,
  templateId: string,
): Promise<DocumentTemplateWithCreator | null> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: documentTemplates.id,
      tenantId: documentTemplates.tenantId,
      tableId: documentTemplates.tableId,
      name: documentTemplates.name,
      content: documentTemplates.content,
      settings: documentTemplates.settings,
      version: documentTemplates.version,
      environment: documentTemplates.environment,
      createdBy: documentTemplates.createdBy,
      createdAt: documentTemplates.createdAt,
      updatedAt: documentTemplates.updatedAt,
      creatorName: users.name,
    })
    .from(documentTemplates)
    .innerJoin(users, eq(documentTemplates.createdBy, users.id))
    .where(
      and(
        eq(documentTemplates.tenantId, tenantId),
        eq(documentTemplates.id, templateId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    tableId: row.tableId,
    name: row.name,
    content: row.content,
    settings: row.settings,
    version: row.version,
    environment: row.environment,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creatorName: row.creatorName,
  };
}

// ---------------------------------------------------------------------------
// listDocumentTemplates
// ---------------------------------------------------------------------------

/**
 * List all document templates for a given table, tenant-scoped.
 * Ordered by updated_at descending (most recently edited first).
 */
export async function listDocumentTemplates(
  tenantId: string,
  tableId: string,
): Promise<DocumentTemplateWithCreator[]> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: documentTemplates.id,
      tenantId: documentTemplates.tenantId,
      tableId: documentTemplates.tableId,
      name: documentTemplates.name,
      content: documentTemplates.content,
      settings: documentTemplates.settings,
      version: documentTemplates.version,
      environment: documentTemplates.environment,
      createdBy: documentTemplates.createdBy,
      createdAt: documentTemplates.createdAt,
      updatedAt: documentTemplates.updatedAt,
      creatorName: users.name,
    })
    .from(documentTemplates)
    .innerJoin(users, eq(documentTemplates.createdBy, users.id))
    .where(
      and(
        eq(documentTemplates.tenantId, tenantId),
        eq(documentTemplates.tableId, tableId),
      ),
    )
    .orderBy(desc(documentTemplates.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    tableId: row.tableId,
    name: row.name,
    content: row.content,
    settings: row.settings,
    version: row.version,
    environment: row.environment,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    creatorName: row.creatorName,
  }));
}
