'use server';

/**
 * Server Actions — Section management (create, update, delete, move items, reorder).
 *
 * Personal sections: any user can create (userId is set, visible only to creator).
 * Shared sections: Manager+ only (userId is null, visible to all workspace members).
 *
 * @see docs/reference/tables-and-views.md § Sections — Universal List Organizer
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  sql,
  sections,
  views,
  writeAuditLog,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { DrizzleTransaction, Section } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError, ForbiddenError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import { resolveEffectiveRole, roleAtLeast } from '@everystack/shared/auth';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createSectionSchema = z.object({
  context: z.string().min(1).max(50),
  contextParentId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  scope: z.enum(['personal', 'shared']),
  workspaceId: z.string().uuid().optional(),
});

const updateSectionSchema = z.object({
  sectionId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  sortOrder: z.number().int().min(0).optional(),
  collapsed: z.boolean().optional(),
});

const deleteSectionSchema = z.object({
  sectionId: z.string().uuid(),
});

const moveItemToSectionSchema = z.object({
  context: z.string().min(1).max(50),
  itemId: z.string().uuid(),
  sectionId: z.string().uuid().nullable(),
});

const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.string().uuid()).min(1),
});

// ---------------------------------------------------------------------------
// createSection
// ---------------------------------------------------------------------------

/**
 * Creates a new section. Personal: any user. Shared: Manager+ only.
 */
export async function createSection(
  input: z.input<typeof createSectionSchema>,
): Promise<Section> {
  const { userId, tenantId } = await getAuthContext();
  const validated = createSectionSchema.parse(input);

  // Shared sections require Manager+
  if (validated.scope === 'shared') {
    const role = await resolveEffectiveRole(userId, tenantId, validated.workspaceId);
    if (!role || !roleAtLeast(role, 'manager')) {
      throw new ForbiddenError("You don't have permission to create shared sections.");
    }
  }

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      // Determine next sort order
      const existing = await tx
        .select({ sortOrder: sections.sortOrder })
        .from(sections)
        .where(
          and(
            eq(sections.tenantId, tenantId),
            eq(sections.context, validated.context),
          ),
        )
        .orderBy(sql`${sections.sortOrder} DESC`)
        .limit(1);

      const nextSortOrder = (existing[0]?.sortOrder ?? -1) + 1;

      const [created] = await tx
        .insert(sections)
        .values({
          id: generateUUIDv7(),
          tenantId,
          userId: validated.scope === 'personal' ? userId : null,
          context: validated.context,
          contextParentId: validated.contextParentId ?? null,
          name: validated.name,
          sortOrder: nextSortOrder,
          collapsed: false,
          createdBy: userId,
        })
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'section.created',
        entityType: 'section',
        entityId: created!.id,
        details: {
          name: validated.name,
          context: validated.context,
          scope: validated.scope,
        },
        traceId: getTraceId(),
      });

      return created;
    });

    if (!result) {
      throw new Error('Failed to create section');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// updateSection
// ---------------------------------------------------------------------------

/**
 * Updates a section (rename, reorder, toggle collapse).
 * Personal sections: only the creator. Shared sections: Manager+.
 */
export async function updateSection(
  input: z.input<typeof updateSectionSchema>,
): Promise<Section> {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateSectionSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(sections)
        .where(and(eq(sections.tenantId, tenantId), eq(sections.id, validated.sectionId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Section not found');
      }

      // Permission check: personal → creator only, shared → Manager+
      if (existing.userId) {
        if (existing.userId !== userId) {
          throw new ForbiddenError("You don't have permission to update this section.");
        }
      } else {
        const role = await resolveEffectiveRole(userId, tenantId);
        if (!role || !roleAtLeast(role, 'manager')) {
          throw new ForbiddenError("You don't have permission to update shared sections.");
        }
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (validated.name !== undefined) updates.name = validated.name;
      if (validated.sortOrder !== undefined) updates.sortOrder = validated.sortOrder;
      if (validated.collapsed !== undefined) updates.collapsed = validated.collapsed;

      const [updated] = await tx
        .update(sections)
        .set(updates)
        .where(and(eq(sections.tenantId, tenantId), eq(sections.id, validated.sectionId)))
        .returning();

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'section.updated',
        entityType: 'section',
        entityId: validated.sectionId,
        details: {
          name: validated.name,
          sortOrder: validated.sortOrder,
          collapsed: validated.collapsed,
        },
        traceId: getTraceId(),
      });

      return updated;
    });

    if (!result) {
      throw new Error('Failed to update section');
    }

    return result;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteSection
// ---------------------------------------------------------------------------

/**
 * Deletes a section. Items in the section are moved to top level
 * (for views: config.sectionId is set to null).
 */
export async function deleteSection(
  input: z.input<typeof deleteSectionSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = deleteSectionSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(sections)
        .where(and(eq(sections.tenantId, tenantId), eq(sections.id, validated.sectionId)))
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Section not found');
      }

      // Permission check
      if (existing.userId) {
        if (existing.userId !== userId) {
          throw new ForbiddenError("You don't have permission to delete this section.");
        }
      } else {
        const role = await resolveEffectiveRole(userId, tenantId);
        if (!role || !roleAtLeast(role, 'manager')) {
          throw new ForbiddenError("You don't have permission to delete shared sections.");
        }
      }

      // Move views in this section to top level (clear sectionId from config)
      if (existing.context === 'view_switcher' && existing.contextParentId) {
        const viewsInTable = await tx
          .select()
          .from(views)
          .where(
            and(
              eq(views.tenantId, tenantId),
              eq(views.tableId, existing.contextParentId),
            ),
          );

        for (const view of viewsInTable) {
          const config = view.config as Record<string, unknown>;
          if (config?.sectionId === validated.sectionId) {
            const { sectionId: _removed, ...rest } = config;
            await tx
              .update(views)
              .set({ config: rest, updatedAt: new Date() })
              .where(and(eq(views.tenantId, tenantId), eq(views.id, view.id)));
          }
        }
      }

      await tx
        .delete(sections)
        .where(and(eq(sections.tenantId, tenantId), eq(sections.id, validated.sectionId)));

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'section.deleted',
        entityType: 'section',
        entityId: validated.sectionId,
        details: { name: existing.name, context: existing.context },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// moveItemToSection
// ---------------------------------------------------------------------------

/**
 * Moves an item into a section (or to top level if sectionId is null).
 * For view_switcher context: stores sectionId in the view's config JSONB.
 */
export async function moveItemToSection(
  input: z.input<typeof moveItemToSectionSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = moveItemToSectionSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      // Verify section exists if sectionId is provided
      if (validated.sectionId) {
        const [section] = await tx
          .select({ id: sections.id })
          .from(sections)
          .where(and(eq(sections.tenantId, tenantId), eq(sections.id, validated.sectionId)))
          .limit(1);

        if (!section) {
          throw new NotFoundError('Section not found');
        }
      }

      if (validated.context === 'view_switcher') {
        const [view] = await tx
          .select()
          .from(views)
          .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.itemId)))
          .limit(1);

        if (!view) {
          throw new NotFoundError('View not found');
        }

        const config = { ...(view.config as Record<string, unknown>) };
        if (validated.sectionId) {
          config.sectionId = validated.sectionId;
        } else {
          delete config.sectionId;
        }

        await tx
          .update(views)
          .set({ config, updatedAt: new Date() })
          .where(and(eq(views.tenantId, tenantId), eq(views.id, validated.itemId)));
      }

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'section.item_moved',
        entityType: 'section',
        entityId: validated.sectionId ?? 'top-level',
        details: {
          context: validated.context,
          itemId: validated.itemId,
        },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// reorderSections
// ---------------------------------------------------------------------------

/**
 * Reorders sections by updating sort_order based on array position.
 */
export async function reorderSections(
  input: z.input<typeof reorderSectionsSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = reorderSectionsSchema.parse(input);

  const db = getDbForTenant(tenantId, 'write');

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < validated.sectionIds.length; i++) {
        const sectionId = validated.sectionIds[i]!;
        await tx
          .update(sections)
          .set({ sortOrder: i, updatedAt: new Date() })
          .where(and(eq(sections.tenantId, tenantId), eq(sections.id, sectionId)));
      }

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'section.reordered',
        entityType: 'section',
        entityId: validated.sectionIds[0]!,
        details: { sectionIds: validated.sectionIds },
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
