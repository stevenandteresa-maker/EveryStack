/**
 * Section data access functions — queries for the universal list organizer.
 *
 * @see docs/reference/tables-and-views.md § Sections — Universal List Organizer
 */

import {
  getDbForTenant,
  eq,
  and,
  or,
  isNull,
  asc,
  sections,
} from '@everystack/shared/db';
import type { Section } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// getSectionsByContext
// ---------------------------------------------------------------------------

/**
 * Fetch all sections for a given context and parent.
 *
 * Returns both shared sections (userId IS NULL) and the requesting user's
 * personal sections (userId = userId). Ordered by sortOrder ascending.
 */
export async function getSectionsByContext(
  tenantId: string,
  context: string,
  parentListId: string | null,
  userId: string,
): Promise<Section[]> {
  const db = getDbForTenant(tenantId, 'read');

  const parentCondition = parentListId
    ? eq(sections.contextParentId, parentListId)
    : isNull(sections.contextParentId);

  return db
    .select()
    .from(sections)
    .where(
      and(
        eq(sections.tenantId, tenantId),
        eq(sections.context, context),
        parentCondition,
        or(
          isNull(sections.userId),
          eq(sections.userId, userId),
        ),
      ),
    )
    .orderBy(asc(sections.sortOrder));
}

// ---------------------------------------------------------------------------
// getSectionById
// ---------------------------------------------------------------------------

/**
 * Fetch a single section by ID. Throws NotFoundError if not found.
 */
export async function getSectionById(
  tenantId: string,
  sectionId: string,
): Promise<Section> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(sections)
    .where(and(eq(sections.id, sectionId), eq(sections.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new NotFoundError('Section not found');
  }

  return row;
}
