/**
 * POST /api/editor/merge-tag-fields
 *
 * Returns available fields for merge-tag insertion, grouped by table.
 * Source table fields + cross-linked target table fields.
 * Filters out hidden fields via field permissions when viewId is provided.
 *
 * @see docs/reference/smart-docs.md § Template Authoring Mode
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import { getFieldsByTable } from '@/data/fields';
import { getTableById } from '@/data/tables';
import { listCrossLinkDefinitions } from '@/data/cross-links';
import { getFieldPermissions } from '@/data/permissions';
import type { MergeTagField } from '@/lib/types/document-templates';
import type { MergeTagFieldGroup } from '@/components/editor/hooks/use-merge-tag-fields';

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  tableId: z.string().uuid(),
  userId: z.string().uuid(),
  viewId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const { tenantId: authTenantId, userId: authUserId } = await getAuthContext();

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Invalid request body' } },
      { status: 400 },
    );
  }

  const { tenantId, tableId, viewId } = parsed.data;

  // Ensure the authenticated user matches the request
  if (tenantId !== authTenantId) {
    return NextResponse.json(
      { error: { code: 'PERMISSION_DENIED', message: 'Tenant mismatch' } },
      { status: 403 },
    );
  }

  // Load source table info
  const sourceTable = await getTableById(tenantId, tableId);

  // Load source table fields
  const sourceFields = await getFieldsByTable(tenantId, tableId);

  // Load permission map if viewId is provided
  let hiddenFieldIds: Set<string> | null = null;
  if (viewId) {
    const permissionMap = await getFieldPermissions(tenantId, viewId, authUserId);
    hiddenFieldIds = new Set<string>();
    for (const [fieldId, state] of permissionMap.entries()) {
      if (state === 'hidden') {
        hiddenFieldIds.add(fieldId);
      }
    }
  }

  // Build source table group
  const sourceGroup: MergeTagFieldGroup = {
    tableId,
    tableName: sourceTable.name,
    isLinked: false,
    fields: sourceFields
      .filter((f) => !hiddenFieldIds || !hiddenFieldIds.has(f.id))
      .map((f): MergeTagField => ({
        fieldId: f.id,
        tableId,
        fieldName: f.name,
        fieldType: f.fieldType,
        isLinked: false,
      })),
  };

  // Load cross-link definitions from this source table
  const crossLinks = await listCrossLinkDefinitions(tenantId, tableId);

  // Build linked table groups
  const linkedGroups: MergeTagFieldGroup[] = [];

  for (const crossLink of crossLinks) {
    const targetTable = await getTableById(tenantId, crossLink.targetTableId);
    const targetFields = await getFieldsByTable(tenantId, crossLink.targetTableId);

    const group: MergeTagFieldGroup = {
      tableId: crossLink.targetTableId,
      tableName: targetTable.name,
      isLinked: true,
      crossLinkId: crossLink.id,
      fields: targetFields.map((f): MergeTagField => ({
        fieldId: f.id,
        tableId: crossLink.targetTableId,
        fieldName: f.name,
        fieldType: f.fieldType,
        isLinked: true,
        crossLinkId: crossLink.id,
      })),
    };

    linkedGroups.push(group);
  }

  return NextResponse.json({
    groups: [sourceGroup, ...linkedGroups],
  });
}
