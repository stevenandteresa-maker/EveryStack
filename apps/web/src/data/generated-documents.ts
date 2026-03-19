/**
 * Generated Document data access functions.
 *
 * Tenant-scoped read access for documents produced by the PDF generation
 * pipeline (Gotenberg). Each generated document is linked to a source
 * record and the template that produced it.
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  generatedDocuments,
} from '@everystack/shared/db';
import type { GeneratedDocument } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { GeneratedDocument } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// getGeneratedDocument
// ---------------------------------------------------------------------------

/**
 * Fetch a single generated document by ID, tenant-scoped.
 */
export async function getGeneratedDocument(
  tenantId: string,
  documentId: string,
): Promise<GeneratedDocument | null> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(generatedDocuments)
    .where(
      and(
        eq(generatedDocuments.tenantId, tenantId),
        eq(generatedDocuments.id, documentId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// listGeneratedDocuments
// ---------------------------------------------------------------------------

/**
 * List all generated documents for a given record, tenant-scoped.
 * Ordered by generated_at descending (most recent first).
 */
export async function listGeneratedDocuments(
  tenantId: string,
  recordId: string,
): Promise<GeneratedDocument[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(generatedDocuments)
    .where(
      and(
        eq(generatedDocuments.tenantId, tenantId),
        eq(generatedDocuments.sourceRecordId, recordId),
      ),
    )
    .orderBy(desc(generatedDocuments.generatedAt));
}
