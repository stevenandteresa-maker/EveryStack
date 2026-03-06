/**
 * Sidebar Navigation Data Fetcher
 *
 * Builds the multi-tenant navigation tree for the sidebar.
 * Cross-tenant query by design — aggregates all tenants/workspaces
 * a user can access via effective_memberships.
 *
 * Uses dbRead directly (not getDbForTenant) since this is user-scoped,
 * cross-tenant aggregation.
 */

import {
  dbRead,
  eq,
  and,
  isNull,
  inArray,
  asc,
  users,
  tenants,
  workspaces,
  boards,
  workspaceMemberships,
  portals,
  portalAccess,
  getEffectiveMemberships,
} from '@everystack/shared/db';
import type { DrizzleClient } from '@everystack/shared/db';
import { getShellAccent } from '@/lib/design-system/shell-accent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SidebarNavigation {
  tenants: TenantNavSection[];
  portals: PortalNavEntry[];
}

export interface TenantNavSection {
  tenantId: string;
  tenantName: string;
  accentColor: string;
  isPersonalTenant: boolean;
  isActive: boolean;
  workspaces: WorkspaceNavEntry[];
  boards: BoardNavGroup[];
}

export interface BoardNavGroup {
  boardId: string;
  boardName: string;
  workspaces: WorkspaceNavEntry[];
}

export interface WorkspaceNavEntry {
  workspaceId: string;
  workspaceName: string;
  icon: string | null;
}

export interface PortalNavEntry {
  portalId: string;
  portalName: string;
  tenantName: string;
  portalSlug: string;
}

// ---------------------------------------------------------------------------
// Data Fetcher
// ---------------------------------------------------------------------------

export async function getSidebarNavigation(
  userId: string,
  activeTenantId: string,
  client: DrizzleClient = dbRead,
): Promise<SidebarNavigation> {
  // 1. Look up user to get personalTenantId and email
  const [user] = await client
    .select({
      id: users.id,
      email: users.email,
      personalTenantId: users.personalTenantId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return { tenants: [], portals: [] };
  }

  // 2. Get all accessible tenant IDs via effective_memberships
  const memberships = await getEffectiveMemberships(userId, client);

  if (memberships.length === 0) {
    return { tenants: [], portals: [] };
  }

  const tenantIds = [...new Set(memberships.map((m) => m.tenantId))];
  const membershipByTenant = new Map(
    memberships.map((m) => [m.tenantId, m]),
  );

  // 3. Fetch tenant rows
  const tenantRows = await client
    .select({
      id: tenants.id,
      name: tenants.name,
      settings: tenants.settings,
    })
    .from(tenants)
    .where(inArray(tenants.id, tenantIds));

  // 4. For each tenant, fetch workspaces (role-aware) and boards
  const tenantSections: TenantNavSection[] = [];

  for (const tenant of tenantRows) {
    const membership = membershipByTenant.get(tenant.id);
    const role = membership?.role ?? 'member';
    const isPersonal = tenant.settings?.personal === true;
    const accentColor = getShellAccent(
      tenant.id,
      isPersonal,
      tenant.settings?.branding_accent_color,
    );

    // Owner/Admin: all workspaces; Member: only via workspace_memberships
    let tenantWorkspaces;
    if (role === 'owner' || role === 'admin') {
      tenantWorkspaces = await client
        .select({
          id: workspaces.id,
          name: workspaces.name,
          icon: workspaces.icon,
          boardId: workspaces.boardId,
          sortOrder: workspaces.sortOrder,
        })
        .from(workspaces)
        .where(eq(workspaces.tenantId, tenant.id))
        .orderBy(asc(workspaces.sortOrder), asc(workspaces.name));
    } else {
      tenantWorkspaces = await client
        .select({
          id: workspaces.id,
          name: workspaces.name,
          icon: workspaces.icon,
          boardId: workspaces.boardId,
          sortOrder: workspaces.sortOrder,
        })
        .from(workspaces)
        .innerJoin(
          workspaceMemberships,
          and(
            eq(workspaceMemberships.workspaceId, workspaces.id),
            eq(workspaceMemberships.userId, userId),
          ),
        )
        .where(eq(workspaces.tenantId, tenant.id))
        .orderBy(asc(workspaces.sortOrder), asc(workspaces.name));
    }

    // Personal tenant with no workspaces → exclude
    if (isPersonal && tenantWorkspaces.length === 0) {
      continue;
    }

    // Fetch boards for this tenant
    const tenantBoards = await client
      .select({
        id: boards.id,
        name: boards.name,
        sortOrder: boards.sortOrder,
      })
      .from(boards)
      .where(eq(boards.tenantId, tenant.id))
      .orderBy(asc(boards.sortOrder), asc(boards.name));

    // Group workspaces by board
    const boardMap = new Map<string, BoardNavGroup>();
    for (const board of tenantBoards) {
      boardMap.set(board.id, {
        boardId: board.id,
        boardName: board.name,
        workspaces: [],
      });
    }

    const ungroupedWorkspaces: WorkspaceNavEntry[] = [];

    for (const ws of tenantWorkspaces) {
      const entry: WorkspaceNavEntry = {
        workspaceId: ws.id,
        workspaceName: ws.name,
        icon: ws.icon,
      };

      if (ws.boardId && boardMap.has(ws.boardId)) {
        boardMap.get(ws.boardId)!.workspaces.push(entry);
      } else {
        ungroupedWorkspaces.push(entry);
      }
    }

    // Only include boards that have workspaces visible to this user
    const boardGroups = [...boardMap.values()].filter(
      (b) => b.workspaces.length > 0,
    );

    tenantSections.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      accentColor,
      isPersonalTenant: isPersonal,
      isActive: tenant.id === activeTenantId,
      workspaces: ungroupedWorkspaces,
      boards: boardGroups,
    });
  }

  // Sort: personal tenant first, then alphabetical
  tenantSections.sort((a, b) => {
    if (a.isPersonalTenant && !b.isPersonalTenant) return -1;
    if (!a.isPersonalTenant && b.isPersonalTenant) return 1;
    return a.tenantName.localeCompare(b.tenantName);
  });

  // 5. Fetch portal entries for this user's email
  const portalEntries = await getPortalEntries(user.email, client);

  return {
    tenants: tenantSections,
    portals: portalEntries,
  };
}

// ---------------------------------------------------------------------------
// Portal entries helper
// ---------------------------------------------------------------------------

async function getPortalEntries(
  email: string,
  client: DrizzleClient,
): Promise<PortalNavEntry[]> {
  const rows = await client
    .select({
      portalId: portals.id,
      portalName: portals.name,
      portalSlug: portals.slug,
      tenantName: tenants.name,
    })
    .from(portalAccess)
    .innerJoin(portals, eq(portalAccess.portalId, portals.id))
    .innerJoin(tenants, eq(portals.tenantId, tenants.id))
    .where(
      and(
        eq(portalAccess.email, email),
        isNull(portalAccess.revokedAt),
      ),
    );

  // Deduplicate by portalId (user may have multiple records in same portal)
  const seen = new Set<string>();
  const entries: PortalNavEntry[] = [];

  for (const row of rows) {
    if (!seen.has(row.portalId)) {
      seen.add(row.portalId);
      entries.push({
        portalId: row.portalId,
        portalName: row.portalName,
        tenantName: row.tenantName,
        portalSlug: row.portalSlug,
      });
    }
  }

  return entries;
}
