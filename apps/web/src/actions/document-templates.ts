'use server';

/**
 * Server Actions — Document Template mutations.
 *
 * CRUD operations for document templates (TipTap Smart Doc templates
 * with merge tags, stored per table).
 *
 * @see docs/reference/smart-docs.md § Document Generation — Two Prongs
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  documentTemplates,
  generatedDocuments,
  generateUUIDv7,
  writeAuditLog,
  count,
} from '@everystack/shared/db';
import type { DrizzleTransaction, DocumentTemplate } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError, ConflictError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import {
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
  duplicateDocumentTemplateSchema,
  deleteDocumentTemplateSchema,
} from '@/lib/schemas/document-templates';

// ---------------------------------------------------------------------------
// createDocumentTemplate
// ---------------------------------------------------------------------------

/**
 * Create a new document template for a table.
 *
 * Defaults content to an empty TipTap doc and settings to A4/portrait/20mm.
 */
export async function createDocumentTemplate(
  input: z.input<typeof createDocumentTemplateSchema>,
): Promise<DocumentTemplate> {
  const { userId, tenantId } = await getAuthContext();
  const validated = createDocumentTemplateSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');
  const id = generateUUIDv7();

  try {
    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(documentTemplates)
        .values({
          id,
          tenantId,
          tableId: validated.tableId,
          name: validated.name,
          content: validated.content,
          settings: validated.settings,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'document_template.created',
        entityType: 'document_template',
        entityId: id,
        details: {
          tableId: validated.tableId,
          name: validated.name,
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to create document template');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// updateDocumentTemplate
// ---------------------------------------------------------------------------

/**
 * Update an existing document template.
 *
 * At least one of name, content, or settings must be provided.
 * Increments the version number on every update.
 */
export async function updateDocumentTemplate(
  input: z.input<typeof updateDocumentTemplateSchema>,
): Promise<DocumentTemplate> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateDocumentTemplateSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      // Verify template exists and belongs to this tenant
      const [existing] = await tx
        .select({ id: documentTemplates.id, version: documentTemplates.version })
        .from(documentTemplates)
        .where(
          and(
            eq(documentTemplates.tenantId, tenantId),
            eq(documentTemplates.id, validated.templateId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Document template not found');
      }

      // Build set clause with only provided fields + version increment
      const setClause: Record<string, unknown> = {
        version: existing.version + 1,
      };
      if (validated.name !== undefined) setClause.name = validated.name;
      if (validated.content !== undefined) setClause.content = validated.content;
      if (validated.settings !== undefined) setClause.settings = validated.settings;

      const [updated] = await tx
        .update(documentTemplates)
        .set(setClause)
        .where(
          and(
            eq(documentTemplates.tenantId, tenantId),
            eq(documentTemplates.id, validated.templateId),
          ),
        )
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'document_template.updated',
        entityType: 'document_template',
        entityId: validated.templateId,
        details: {
          version: existing.version + 1,
          ...(validated.name !== undefined && { name: validated.name }),
        },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to update document template');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// duplicateDocumentTemplate
// ---------------------------------------------------------------------------

/**
 * Duplicate an existing document template.
 *
 * Copies content and settings, appends " (Copy)" to the name,
 * and resets version to 1.
 */
export async function duplicateDocumentTemplate(
  input: z.input<typeof duplicateDocumentTemplateSchema>,
): Promise<DocumentTemplate> {
  const { userId, tenantId } = await getAuthContext();
  const validated = duplicateDocumentTemplateSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');
  const newId = generateUUIDv7();

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(documentTemplates)
        .where(
          and(
            eq(documentTemplates.tenantId, tenantId),
            eq(documentTemplates.id, validated.templateId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Document template not found');
      }

      const [row] = await tx
        .insert(documentTemplates)
        .values({
          id: newId,
          tenantId,
          tableId: existing.tableId,
          name: `${existing.name} (Copy)`,
          content: existing.content,
          settings: existing.settings,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'document_template.duplicated',
        entityType: 'document_template',
        entityId: newId,
        details: {
          sourceTemplateId: validated.templateId,
          name: `${existing.name} (Copy)`,
        },
        traceId: getTraceId(),
      });

      return row;
    });

    if (!result) {
      throw new Error('Failed to duplicate document template');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteDocumentTemplate
// ---------------------------------------------------------------------------

/**
 * Delete a document template.
 *
 * Blocks deletion if any generated documents reference this template
 * (to preserve audit trail). Hard delete — no soft delete.
 */
export async function deleteDocumentTemplate(
  input: z.input<typeof deleteDocumentTemplateSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = deleteDocumentTemplateSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      // Verify template exists and belongs to this tenant
      const [existing] = await tx
        .select({ id: documentTemplates.id })
        .from(documentTemplates)
        .where(
          and(
            eq(documentTemplates.tenantId, tenantId),
            eq(documentTemplates.id, validated.templateId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Document template not found');
      }

      // Block deletion if generated documents exist
      const [genDocCount] = await tx
        .select({ value: count() })
        .from(generatedDocuments)
        .where(
          and(
            eq(generatedDocuments.tenantId, tenantId),
            eq(generatedDocuments.templateId, validated.templateId),
          ),
        );

      if (genDocCount && genDocCount.value > 0) {
        throw new ConflictError(
          'Cannot delete template with existing generated documents. Delete generated documents first.',
        );
      }

      await tx
        .delete(documentTemplates)
        .where(
          and(
            eq(documentTemplates.tenantId, tenantId),
            eq(documentTemplates.id, validated.templateId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'document_template.deleted',
        entityType: 'document_template',
        entityId: validated.templateId,
        details: {},
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
