/**
 * SDS Permission Filter — filters WorkspaceDescriptor by user permissions.
 *
 * Deep-copies the unfiltered descriptor and removes tables, fields, and link
 * edges the user is not authorized to see. This is the security boundary that
 * ensures the AI only receives schema metadata the user has access to.
 *
 * Owner/Admin bypass: returned immediately with no filtering.
 * Other roles: permission resolution via Table View grants + field permissions.
 *
 * Cross-link edge case: when a linked_record field is visible but the target
 * table is NOT accessible, the field is kept with linked_table: null and
 * cardinality: 'restricted' to indicate a restricted link.
 *
 * @see docs/reference/schema-descriptor-service.md § Permissions Integration
 * @see docs/reference/permissions.md § Permission Resolution at Runtime
 */

import { eq, and, sql } from 'drizzle-orm';
import { views } from '../../db/schema/views';
import { fields as fieldsTable } from '../../db/schema/fields';
import type { DrizzleClient } from '../../db/client';
import { resolveEffectiveRole } from '../../auth/check-role';
import { roleAtLeast } from '../../auth/roles';
import { resolveAllFieldPermissions } from '../../auth/permissions/resolve';
import { viewPermissionsSchema } from '../../auth/permissions/schemas';
import type {
  FieldPermissionMap,
  FieldPermissionState,
  ResolvedPermissionContext,
  ViewPermissions,
} from '../../auth/permissions/types';
import type { WorkspaceDescriptor } from './types';

/**
 * Filters a WorkspaceDescriptor to only include tables and fields the user
 * is permitted to access. Never mutates the input — always deep-copies first.
 *
 * @param descriptor - Unfiltered workspace descriptor (may be cached)
 * @param userId - The requesting user's ID
 * @param tenantId - Tenant ID for isolation
 * @param db - Drizzle client from getDbForTenant()
 * @returns Permission-filtered WorkspaceDescriptor
 */
export async function filterDescriptorByPermissions(
  descriptor: WorkspaceDescriptor,
  userId: string,
  tenantId: string,
  db: DrizzleClient,
): Promise<WorkspaceDescriptor> {
  // 1. Deep-copy — never mutate cached descriptor
  const filtered = structuredClone(descriptor);

  // 2. Resolve effective role for this workspace
  // Extract workspace ID — we need it for role resolution
  const workspaceId = filtered.workspace_id;
  const effectiveRole = await resolveEffectiveRole(userId, tenantId, workspaceId);

  // No membership → empty descriptor
  if (!effectiveRole) {
    return { workspace_id: workspaceId, bases: [], link_graph: [] };
  }

  // Owner/Admin bypass — they see everything
  if (roleAtLeast(effectiveRole, 'admin')) {
    return filtered;
  }

  // 3. Collect all table IDs from the descriptor
  const allTableIds: string[] = [];
  for (const base of filtered.bases) {
    for (const table of base.tables) {
      allTableIds.push(table.table_id);
    }
  }

  if (allTableIds.length === 0) {
    return filtered;
  }

  // 4. Query shared views for these tables (batch)
  const sharedViews = await db
    .select({
      id: views.id,
      tableId: views.tableId,
      config: views.config,
      permissions: views.permissions,
    })
    .from(views)
    .where(
      and(
        eq(views.tenantId, tenantId),
        eq(views.isShared, true),
        eq(views.environment, 'live'),
        sql`${views.tableId} IN (${sql.join(
          allTableIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    );

  // 5. Query all fields for these tables (batch) — needed for permission context
  const tableFields = await db
    .select({
      id: fieldsTable.id,
      tableId: fieldsTable.tableId,
      permissions: fieldsTable.permissions,
    })
    .from(fieldsTable)
    .where(
      and(
        eq(fieldsTable.tenantId, tenantId),
        sql`${fieldsTable.tableId} IN (${sql.join(
          allTableIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      ),
    );

  // Group fields by tableId
  const fieldsByTable = new Map<string, Array<{ id: string; permissions: Record<string, unknown> }>>();
  for (const f of tableFields) {
    const existing = fieldsByTable.get(f.tableId) ?? [];
    existing.push({ id: f.id, permissions: (f.permissions ?? {}) as Record<string, unknown> });
    fieldsByTable.set(f.tableId, existing);
  }

  // 6. For each table, resolve permissions across all accessible views.
  //    A user sees a table if they have access to at least one shared view on it.
  //    Field visibility = most permissive across all accessible views.
  const tablePermissions = new Map<string, FieldPermissionMap>();

  for (const view of sharedViews) {
    const viewPerms: ViewPermissions = viewPermissionsSchema.parse(view.permissions ?? {});

    // Check if user has access to this view
    if (!userCanAccessView(userId, effectiveRole, viewPerms)) {
      continue;
    }

    const tblFields = fieldsByTable.get(view.tableId) ?? [];
    const fieldIds = tblFields.map((f) => f.id);

    // Extract view field_overrides from config
    const viewConfig = (view.config ?? {}) as Record<string, unknown>;
    const viewFieldOverrides = Array.isArray(viewConfig.columns)
      ? (viewConfig.columns as Array<{ fieldId?: string; visible?: boolean }>)
          .filter((col) => col.visible !== false && col.fieldId)
          .map((col) => col.fieldId as string)
      : fieldIds; // No config = all fields visible

    // Build field-level global permissions map
    const fieldPermissions: Record<string, Record<string, unknown>> = {};
    for (const f of tblFields) {
      fieldPermissions[f.id] = f.permissions;
    }

    const context: ResolvedPermissionContext = {
      userId,
      effectiveRole,
      tableId: view.tableId,
      viewId: view.id,
      fieldIds,
      viewFieldOverrides,
      viewPermissions: viewPerms,
      fieldPermissions,
    };

    const permMap = resolveAllFieldPermissions(context);

    // Merge with existing — take most permissive state per field
    const existing = tablePermissions.get(view.tableId);
    if (existing) {
      for (const [fieldId, state] of permMap) {
        const currentState = existing.get(fieldId);
        if (!currentState || isMorePermissive(state, currentState)) {
          existing.set(fieldId, state);
        }
      }
    } else {
      tablePermissions.set(view.tableId, permMap);
    }
  }

  // 7. Build set of accessible table IDs and removed field IDs
  const accessibleTableIds = new Set(tablePermissions.keys());
  const removedFieldIds = new Set<string>();

  // Track all remaining field IDs for link graph pruning
  const remainingFieldIds = new Set<string>();

  // 8. Filter bases → tables → fields
  for (const base of filtered.bases) {
    base.tables = base.tables.filter((table) => {
      if (!accessibleTableIds.has(table.table_id)) {
        // Track all fields in removed tables
        for (const field of table.fields) {
          removedFieldIds.add(field.field_id);
        }
        return false;
      }

      const permMap = tablePermissions.get(table.table_id)!;

      // Filter hidden fields, track removed
      table.fields = table.fields.filter((field) => {
        const state = permMap.get(field.field_id);
        if (!state || state === 'hidden') {
          removedFieldIds.add(field.field_id);
          return false;
        }
        remainingFieldIds.add(field.field_id);
        return true;
      });

      // Handle cross-link edge case: visible linked_record but inaccessible target
      for (const field of table.fields) {
        if (field.type === 'linked_record' && field.linked_table) {
          if (!accessibleTableIds.has(field.linked_table)) {
            field.linked_table = null as unknown as string | undefined;
            field.cardinality = 'restricted';
          }
        }
      }

      return true;
    });
  }

  // 9. Remove empty bases
  filtered.bases = filtered.bases.filter((base) => base.tables.length > 0);

  // 10. Prune link_graph — remove edges where either side's field was removed
  filtered.link_graph = filtered.link_graph.filter((edge) => {
    const fromFieldId = extractFieldIdFromPath(edge.from);
    const toFieldId = extractFieldIdFromPath(edge.to);
    return remainingFieldIds.has(fromFieldId) && remainingFieldIds.has(toFieldId);
  });

  return filtered;
}

/**
 * Checks if a user can access a specific shared view based on its permissions config.
 */
function userCanAccessView(
  userId: string,
  effectiveRole: string,
  viewPerms: ViewPermissions,
): boolean {
  // Excluded users are always denied
  if (viewPerms.excludedUsers.includes(userId)) {
    return false;
  }

  // Specific user grant
  if (viewPerms.specificUsers.includes(userId)) {
    return true;
  }

  // Role-based grant (maps workspace roles to view access roles)
  const roleMapping: Record<string, string> = {
    team_member: 'team_member',
    viewer: 'viewer',
  };

  const viewRole = roleMapping[effectiveRole];
  if (viewRole && viewPerms.roles.includes(viewRole as 'team_member' | 'viewer')) {
    return true;
  }

  // Manager role: managers can access views they manage
  // (they see all shared views on tables they manage)
  if (effectiveRole === 'manager') {
    return true;
  }

  return false;
}

/**
 * Returns true if `a` is more permissive than `b`.
 * read_write > read_only > hidden
 */
function isMorePermissive(a: FieldPermissionState, b: FieldPermissionState): boolean {
  const rank: Record<FieldPermissionState, number> = {
    hidden: 0,
    read_only: 1,
    read_write: 2,
  };
  return rank[a] > rank[b];
}

/**
 * Extracts the field ID from a dotted link_graph path (base_id.table_id.field_id).
 */
function extractFieldIdFromPath(path: string): string {
  const parts = path.split('.');
  return parts[2] ?? '';
}
