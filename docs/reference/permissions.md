# EveryStack — Permissions & Access Control

> **Reference doc.** Complete permission model: workspace roles, Table View–based access, field-level permissions, portal client access, cross-link visibility, runtime resolution, caching, configuration UI.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (views schema, record_view_configs), `cross-linking.md` (cross-link permission resolution, creation/modification permissions), `tables-and-views.md` (Table View field overrides, My Views / Shared Views), `portals.md` (portal auth and field grants)
> Last updated: 2026-02-28 — Two-layer permission model documented. Board permission level added. Environment terminology fixed. Terminology updated (My Views).
> **Update: 2026-03-05 (CP-002)** — Auth resolution updated to use `effective_memberships` database view (unions `tenant_memberships` + `tenant_relationships`). Agency access level derivation documented. All middleware must query the view, never underlying tables directly.

> **Reconciliation Note (2026-02-27):**
>
> - Replaced "interface" as access boundary concept with **Table View**, per glossary ("Table Views are the access boundary for Team Members and Viewers").
> - Replaced all "interface" references with **Table View** / **Shared View** where contextually appropriate.
> - Replaced "bases" / "Boards" with **Workspace** terminology per glossary.
> - Replaced "Interface Designer" with **App Designer** (post-MVP) per glossary naming discipline.
> - Updated portal permissions to align with glossary MVP portal model (Record View configuration with auth wrapper, stored in `portals` table — not `portal_blocks`).
> - Removed references to `interfaces` DB table (not in glossary DB entity reference); permission storage model flagged for architectural alignment with `views` table.
> - Updated cross-references to match glossary-aligned doc names and schema references.
> - Tagged post-MVP content (interface-team grouping concept, portal block-level permissions, elaborate portal page designer references).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                             | Lines   | Covers                                                                                                                                                                                                      |
| ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core Principles                     | 45–59   | 5 axioms: Table View as boundary, field-level granularity, default-open internal, default-closed portal, permissions follow the table                                                                       |
| Workspace Roles                     | 61–91   | 5-role hierarchy (Owner/Admin at tenant level, Manager/Team Member/Viewer at workspace level), resolution flow, key constraints                                                                             |
| Table View–Based Access             | 93–125  | Shared Views as access boundary, 3-step granting, access rules (multi-view, switching, revocation), sidebar contents per role                                                                               |
| Field-Level Permissions             | 127–192 | 3 states (read-write/read-only/hidden), defaults per role, two-layer restriction model (role + individual overrides), resolution order, field_overrides relationship, no-access-table hiding                |
| Permission Configuration UI         | 194–212 | Role-level field grid (click to cycle states), individual override view with effective permissions, UX principle: always show actual result                                                                 |
| Permission Storage (JSONB)          | 214–289 | Two-layer model: `fields.permissions` (global ceiling) + `views.permissions` (contextual overrides), `ViewPermissions`/`ViewFieldPermissions` TypeScript interfaces, query filtering approach, sandbox/live |
| Permission Resolution at Runtime    | 291–358 | Internal user 7-step resolution cascade, portal client resolution, cross-link permission resolution (intersect card_fields + permissions)                                                                   |
| Permission Caching Strategy         | 360–369 | Redis cache key pattern, 300s TTL, invalidation triggers, `permission.updated` real-time push                                                                                                               |
| Permission Management Hierarchy     | 371–388 | Who-can-do-what table: board memberships, field restrictions, view creation/granting, portal config, cross-link creation authority                                                                          |
| Portal Client Permissions (Summary) | 390–403 | Internal vs portal client comparison table (default, direction, config location, scope, filtering, edit capability)                                                                                         |
| Key Decisions Summary               | 405–424 | 13 architectural decisions with resolutions (boundary, granularity, defaults, states, overrides, storage, cross-links, UI principle)                                                                        |
| Permission Denial Behavior          | 426–467 | `PermissionDeniedError` interface, HTTP 403, per-context UI behavior (navigation, hidden fields, read-only, disabled buttons, bulk actions, API, real-time), audit logging with deduplication               |
| Tenant Isolation                    | 469–483 | RLS-enforced boundary, cross-tenant returns 404 not 403 (prevents enumeration), portal tenant isolation                                                                                                     |
| Phase Implementation                | 485–494 | Permission work by phase — Foundation (roles only) → Core UX (full model) → Portals → App Designer                                                                                                          |

---

## Core Principles

These five axioms constrain every permission implementation decision. Violating any one is an architectural bug.

1. **The Table View is the access boundary.** Team Members and Viewers do not access Workspaces or tables directly. They are granted access to Table Views — curated, filtered lenses on table data built by Admins and Managers. The Table View determines what they see and how they interact with data.

2. **Permissions are field-level.** The atomic unit of access control is the field. Every field on every table resolves to one of three states per user: **read-write**, **read-only**, or **hidden**. There are no record-level permissions for internal users.

3. **Default open, subtract where needed (internal).** Internal users start with full access to all fields within their Table View context. Admins and Managers explicitly restrict fields where necessary. Most tables will need no restrictions at all.

4. **Default closed, grant where needed (portal).** Portal clients start with no access. The portal configuration explicitly grants visibility and editability per field. The portal field selection IS the permission definition.

5. **Permissions follow the table, not the link path.** When data from Table B appears through a Cross-Link in Table A, the user's field permissions on Table B govern what they see — regardless of how they arrived at that data. See `cross-linking.md` > Cross-Link Permission Resolution.

---

## Workspace Roles

Every user has a tenant-level role (stored on `tenant_memberships`) and optionally workspace-level roles (stored on `workspace_memberships`). The 5-role hierarchy is presented as a single flat list in the UI — users don't need to know about the table split.

**Tenant-level roles** (`tenant_memberships.role`):

| Role       | Description                                                                                                               | Can be restricted by                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Owner**  | Full org control. Billing, deletion, tenant settings, role assignment. Sees all data in all workspaces.                   | Nobody                              |
| **Admin**  | Org-wide management. Sees all data in all workspaces. Creates/manages Table Views, assigns Managers, configures settings. | Nobody                              |
| **Member** | Default tenant role. Workspace access determined by `workspace_memberships` rows.                                         | N/A (workspace roles govern access) |

**Workspace-level roles** (`workspace_memberships.role` — applies to `member`-tier tenant users only):

| Role            | Description                                                                                                                                                                                                             | Can be restricted by |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| **Manager**     | Manages specific tables and Table Views they are permitted to access. Creates tables, fields, Table Views, automations, portals, Document Templates. Invites and manages Team Members/Viewers within their Table Views. | Admin only           |
| **Team Member** | Day-to-day user. Accesses data through Table Views. Creates/edits records within permission scope. Cannot configure tables, fields, or permissions.                                                                     | Manager or Admin     |
| **Viewer**      | Read-only internal user. Accesses data through Table Views. Cannot edit data by default.                                                                                                                                | Manager or Admin     |

**Permission resolution:** Check `tenant_memberships.role` first. If Owner or Admin → full access to all workspaces, bypass workspace scoping. If Member → fall through to `workspace_memberships` for per-workspace role.

**Key constraints:**

- Owners and Admins always see everything. They bypass Table View scoping and have direct access to every table and field in every workspace.
- Owners and Admins do NOT need `workspace_memberships` rows for access — their tenant-level role is sufficient.
- Managers see permitted tables in raw form (full table structure) plus Table Views they are members of.
- Team Members and Viewers ONLY see Table Views they have been granted access to. No raw table structure. Sidebar shows Table View names (e.g., "Marketing Hub," "Client Projects"), not tables.
- Restriction hierarchy is strictly one-directional downward — no lateral or upward restrictions.

---

## Table View–Based Access

Covers How Table Views Control Access, Granting Access to Table Views, Sidebar Experience.

### How Table Views Control Access

A Shared View is a Table View created by a Manager or Admin — a curated lens on table data that surfaces specific fields, filters, sorts, and groupings. It is the primary way Team Members and Viewers interact with data.

Created by Admins or Managers. Each Shared View has a defined set of workspace members who can access it.

### Granting Access to Table Views

1. **Create a Shared View** and configure fields, filters, sorts, and groupings.
2. **Grant access** to workspace members. No one has access by default — being a workspace Team Member means _eligible_ for access grants, not automatic access.
3. **Configure field permissions** for the Table View's users.

**Access rules:**

- A Team Member can have access to multiple Shared Views. Each access grant is independent — different Table Views may expose different fields with different permissions on the same table.
- Switching Table Views switches permission context. The Table View is the lens.
- Data not surfaced in any granted Table View is invisible to Team Members/Viewers. Only Admins, Owners, and the table's Manager can see it.
- Revoking a member's access to a Table View immediately revokes access to all data surfaced through it (unless also accessible through another Table View).

### Sidebar Experience

| Role          | Sidebar Contents                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner / Admin | Full workspace navigation: My Office, Workspaces with nested tables, Cross-Links, Portals, Documents, Automations, Settings. Raw table structure. |
| Manager       | Permitted tables in raw form + Table Views they belong to.                                                                                        |
| Team Member   | Table View names only. No raw table list.                                                                                                         |
| Viewer        | Table View names only, same as Team Member.                                                                                                       |

---

## Field-Level Permissions

Covers Three States, Default by Role, Two-Layer Restriction Model, Relationship to Table View Field Overrides, Handling "No Access to Any Field".
Touches `field_overrides` tables.

### Three States

Every field, for every user, resolves to exactly one state:

| State          | Meaning                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| **Read-Write** | User can see and edit the field value.                                              |
| **Read-Only**  | User can see but cannot change the field.                                           |
| **Hidden**     | User cannot see the field. Not rendered in any view, record card, or data response. |

No other states. No "write-only," no conditional visibility.

### Default by Role

| Role          | Default                         | Available Restrictions                            |
| ------------- | ------------------------------- | ------------------------------------------------- |
| Owner / Admin | Read-write (all fields, always) | Cannot be restricted                              |
| Manager       | Read-write (permitted tables)   | Admin can restrict to read-only or hidden         |
| Team Member   | Read-write (Table View fields)  | Manager/Admin can restrict to read-only or hidden |
| Viewer        | Read-only (Table View fields)   | Manager/Admin can restrict to hidden              |

### Two-Layer Restriction Model

Permissions configured within Table View context. Two layers:

**Layer 1 — Role-level restrictions (per table in Table View).** "All Team Members in this Table View cannot see Internal Notes and Cost fields on Projects."

**Layer 2 — Individual overrides.** "Sarah also cannot see Client Budget." OR: "Budget is hidden from all Team Members, but James needs it for invoicing — restore it for him."

**Individual overrides work in both directions:**

- Role restriction can be **lifted** for a specific individual (more access than role default).
- A visible field can be **further restricted** for a specific individual (less access than role default).

**Resolution order:**

1. Start with role default (read-write for Team Member, read-only for Viewer).
2. Apply role-level restrictions for this table in this Table View.
3. Apply individual overrides for this user.
4. Result = effective permission per field.

### Relationship to Table View Field Overrides

Table View `field_overrides` JSONB controls **structural presentation** — which fields appear, column order, default read-only marking. The two-layer permission model adds **access control** on top.

Resolution chain (all layers narrow, never expand):

```
1. Fields exposed by Table View (structural — field_overrides JSONB)
2. Role-level field restrictions for this table in this Table View
3. Individual user overrides for this table in this Table View
4. Effective: { field_id → read-write | read-only | hidden }
```

If a Table View hides a field structurally, no permission layer can restore it. If structurally visible but role-restricted, only an individual override can restore it for a specific user.

### Handling "No Access to Any Field"

If a user has no visible fields on a table (all hidden), the table does not appear in their navigation. User is unaware it exists. No empty table shells.

---

## Permission Configuration UI

### Role-Level Configuration View

- Field list down left side.
- Columns per applicable role (Team Member, Viewer — Manager if user is Admin).
- Each cell shows effective state: read-write, read-only, hidden. Click to cycle.
- Bulk configuration for entire role.

### Individual Override View

- Select person from Table View's access roster.
- See **effective permissions** — final resolved state after role defaults + overrides.
- Fields with overrides visually distinguished (badged/highlighted).
- Toggle fields to override role default in either direction.

**Key UX principle: Always show the actual result.** Admin never mentally computes what a user sees. UI shows exactly what their screen looks like. Sarah is Team Member, role hides Budget, but she has override restoring it → Admin sees Budget visible for Sarah, marked as override.

---

## Permission Storage (JSONB)

Permissions stored as JSONB on the `views` table row (for Shared Views with access-controlled membership). Stored in the `permissions` JSONB column on the `views` table.

### Two-Layer Permission Model — Field Global Defaults + View Contextual Overrides

Both `fields.permissions` JSONB and `views.permissions` JSONB are part of a coherent two-layer system:

| Layer                                  | Storage                    | Purpose                                                                      | Scope                                            |
| -------------------------------------- | -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------ |
| **Layer 1: Field Global Defaults**     | `fields.permissions` JSONB | Sets the ceiling for a field everywhere it appears                           | Per-field, applies to all views/portals/contexts |
| **Layer 2: View Contextual Overrides** | `views.permissions` JSONB  | Restricts field access for specific roles/users within a specific Table View | Per-view, per-role/user                          |

**Resolution chain — restrict only, never expand:**

```
1. Field global default (fields.permissions) — sets the ceiling
2. View role restriction (views.permissions.fieldPermissions.roleRestrictions) — can restrict further
3. View individual override (views.permissions.fieldPermissions.individualOverrides) — can restrict or restore up to field ceiling
```

**Examples:**

- `fields.permissions.member_edit = false` → Team Members cannot edit this field in **any** view. A view override cannot grant edit access.
- `fields.permissions.portal_visible = false` → Field is hidden from **all** portals. No portal configuration can make it visible.
- `fields.permissions.member_edit = true` + view restricts field to `read_only` for Team Members → Field is read-only in that specific view, editable in other views.

The portal equivalent follows the same pattern: `fields.permissions.portal_visible/portal_editable` (global) + `portals.settings.editable_fields[]` (contextual grant).

```typescript
interface ViewPermissions {
  // Who can access this Table View
  roles: ('team_member' | 'viewer')[];
  specificUsers: string[];
  excludedUsers: string[];

  // Field-level permissions (two-layer model)
  fieldPermissions: ViewFieldPermissions;
}

interface ViewFieldPermissions {
  // Layer 1: role-level restrictions per table
  // Only restrictions stored — no entry = role default applies
  roleRestrictions: Array<{
    tableId: string;
    role: 'team_member' | 'viewer' | 'manager';
    fieldId: string;
    accessState: 'read_write' | 'read_only' | 'hidden';
  }>;

  // Layer 2: individual user overrides
  // Only overrides stored — no entry = role-level applies
  individualOverrides: Array<{
    tableId: string;
    userId: string;
    fieldId: string;
    accessState: 'read_write' | 'read_only' | 'hidden';
  }>;
}
```

**Why JSONB:** Permission payload per Table View is small (typically <100 restrictions), changes infrequently, loaded as unit. JSONB avoids join overhead and keeps Table View definition self-contained.

**Sandbox/live:** `views.environment` column (`live` | `sandbox`). Post-MVP: permission changes can be staged in sandbox before promotion to live. MVP: always `'live'`. See data-model.md environment column note.

### Portal Field Permissions

For MVP portals (simple Record View shared externally), field visibility and editability are configured directly in the portal configuration on the `portals` table. The portal's field selection and edit toggles ARE the permission definition — no separate structure. Consistent with Principle #4.

> **(Post-MVP):** When full App Designer portals ship, portal field permissions will be stored inline in each block's `data_binding` JSONB in the `app_blocks` table. The App Designer's field selection and edit toggles will serve as the permission definition for custom portal apps.

### Query Filtering

Fields stored as keys in `canonical_data` JSONB (not physical columns), so field-level filtering happens at application layer. Hidden fields stripped from API response — never sent to client.

---

## Permission Resolution at Runtime

Covers Internal Users, Portal Clients, Cross-Link Permission Resolution.
See `cross-linking.md`.

### Internal Users

```
1. Is user a member of this tenant? → Check effective_memberships view (unions tenant_memberships + tenant_relationships). No row: no access.
   → If source = 'agency': user is accessing via agency relationship. Role derived from tenant_relationships.access_level (admin→Admin, builder→Manager, read_only→Viewer).
2. Check effective role:
   → Owner or Admin (direct or agency-admin): return all fields in all workspaces, read-write. Done.
   → Member: continue to workspace-level resolution.
3. Does user have workspace access? → Check workspace_memberships (direct) or board_memberships (cascaded). No: no access.
4. Identify user's workspace role from workspace_memberships.
5. Identify Table View context.
   → No access grant to this view: no access.
6. For each field in the query:
   a. Check fields.permissions (Layer 1 — global ceiling)
      → member_edit = false? Field is read-only, cannot be overridden to read-write.
   b. Check views.permissions.fieldPermissions.roleRestrictions (Layer 2a)
      → Role-level restriction found? Apply (can only restrict further).
   c. Check views.permissions.fieldPermissions.individualOverrides (Layer 2b)
      → User-specific override found? Apply (can restore up to field ceiling, not beyond).
   d. Result: { field_id → read_write | read_only | hidden }
7. Filter response — exclude hidden fields, mark read-only in UI.
```

Full query resolution cascade:

```
User opens Table View
  1. View's base config (fields, sort, filter, group-by)
  2. Table View field_overrides (structural visibility)
  3. Table View recordFilter (additional WHERE clause)
  4. Field permission resolution (role + overrides)
  5. User's active My View overrides (personal filter/sort/group-by)
  6. Execute query → render with resolved config + permissions
```

### Portal Clients

```
1. Identify portal and its Record View configuration.
2. For each field in the portal's Record View layout:
   a. Source table.
   b. Record scoping (portal link = one record for MVP).
   c. Field selection + edit toggles from portal configuration.
   d. Result: scoped record + { field_id → read-only | editable }
3. Render only the scoped record with granted fields.
```

> **(Post-MVP):** Full App Designer portals will support multi-record scoping, per-block data bindings, and client identity–based record filtering across multiple pages.

### Cross-Link Permission Resolution

```
1. Determine target table.
2. Resolve user's field permissions on target table (same resolution above).
3. Get card_fields from Cross-Link definition.
4. Intersect: show only fields BOTH in card_fields AND permitted.
5. Render. Fewer permitted than card → collapse gracefully.
6. Zero permitted fields → minimal indicator (link exists, no data).
```

See `cross-linking.md` > Cross-Link Permission Resolution.

---

## Permission Caching Strategy

Resolved permission set (map of field IDs to access states) is small and stable.

- **Resolved once** per session or Table View context switch.
- **Cached** in Redis: `cache:t:{tenantId}:perm:{viewId}:{userId}` — TTL 300s, LRU evictable.
- **Invalidated** when permissions modified for relevant Table View/table/role/user.
- **Pushed to client** via `permission.updated` real-time event if changed mid-session.

---

## Permission Management Hierarchy

| Action                                             | Who Can Do It                                                          |
| -------------------------------------------------- | ---------------------------------------------------------------------- |
| Manage board memberships                           | Owner or Admin                                                         |
| Restrict Manager field access                      | Admin only                                                             |
| Restrict Team Member field access                  | Manager (within their Table Views) or Admin                            |
| Restrict Viewer field access                       | Manager (within their Table Views) or Admin                            |
| Create Shared View and grant access                | Manager (permitted tables) or Admin                                    |
| Grant/revoke Table View access                     | Table View creator (Manager) or Admin                                  |
| Individual overrides                               | Same role that can restrict (Manager for TM/Viewer, Admin for Manager) |
| Configure portal field visibility                  | Portal creator (Manager) or Admin                                      |
| Create Cross-Link (same Manager both tables)       | That Manager                                                           |
| Create Cross-Link (different Managers, no overlap) | Admin or Owner only                                                    |
| Structural Cross-Link changes                      | Same authority as creation                                             |
| Operational Cross-Link changes                     | Any Manager of either table                                            |

---

## Portal Client Permissions (Summary)

| Aspect           | Internal Users                 | Portal Clients                                        |
| ---------------- | ------------------------------ | ----------------------------------------------------- |
| Default          | All fields visible             | All fields hidden                                     |
| Direction        | Subtract (restrict from full)  | Grant (add from none)                                 |
| Where configured | Table View permission settings | Portal configuration (field selection + edit toggles) |
| Scope            | Per table, per Table View      | Per record (one portal link = one record for MVP)     |
| Record filtering | No record-level filtering      | Scoped to the linked record (MVP)                     |
| Edit capability  | Role-dependent default         | Per-field toggle in portal config                     |

> **(Post-MVP):** Full App Designer portals support per-table, per-page, per-block scoping with client identity–based multi-record filtering.

---

## Key Decisions Summary

| Decision                 | Resolution                                                   |
| ------------------------ | ------------------------------------------------------------ |
| Primary access boundary  | Table View (not Workspace-level)                             |
| Permission granularity   | Field-level (not record-level for internal)                  |
| Internal default         | All fields read-write (TM) or read-only (Viewer), subtract   |
| Portal default           | All fields hidden, explicitly grant                          |
| Permission states        | Three: read-write, read-only, hidden                         |
| Individual overrides     | Bidirectional — further restrict OR restore                  |
| Restriction hierarchy    | Downward only: Admin → Manager → TM/Viewer                   |
| Owner/Admin restrictions | None — always full access                                    |
| Record-level filtering   | Portal clients only                                          |
| Cross-Link permissions   | Target table permissions apply, intersected with card_fields |
| Cross-Link creation      | Manager same-table; Admin/Owner cross-table                  |
| Permission storage       | JSONB on `views` (Shared Views with access control)          |
| UI principle             | Always show actual effective result per user                 |
| No-access table          | Does not appear in navigation                                |

---

## Permission Denial Behavior

Every permission check in the platform follows the same denial pattern. This applies to Server Actions, API endpoints, real-time subscriptions, and portal operations.

### Response Shape

All permission denials use a consistent error structure:

```typescript
interface PermissionDeniedError {
  code: 'PERMISSION_DENIED';
  message: string; // Human-readable: "You don't have access to edit this field"
  details: {
    action: string; // 'read' | 'edit' | 'delete' | 'manage' | 'create'
    resource: string; // 'workspace' | 'table' | 'view' | 'field' | 'record' | 'automation'
    resourceId?: string; // The ID of the resource, if safe to expose
    requiredRole?: string; // Minimum role needed: 'Manager' | 'Admin' | 'Owner'
  };
}
```

**HTTP status:** `403 Forbidden` for API endpoints. Server Actions throw `PermissionDeniedError` caught by the global error boundary.

### UI Behavior on Denial

| Context                                        | Behavior                                                                                                                                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Navigation to restricted workspace**         | Redirect to workspace picker with toast: "You don't have access to this workspace."                                                                                                                                                                               |
| **Table View with hidden fields (role-based)** | Fields simply don't render — no column, no empty cell, no "hidden" indicator. The user's view looks complete.                                                                                                                                                     |
| **Editing a read-only field**                  | Cell renders as read-only (no edit cursor on hover). If user somehow triggers edit (race condition, stale UI): Server Action rejects, field reverts, toast: "This field is read-only for your role."                                                              |
| **Action button user can't perform**           | Button is **visible but disabled** with tooltip: "Requires Manager role" (or equivalent). Exception: destructive actions (delete workspace, transfer ownership) are hidden entirely for non-qualifying roles.                                                     |
| **Bulk action on mixed-permission records**    | Entire bulk action rejected. Toast: "You don't have permission to edit N of the selected records." No partial success.                                                                                                                                            |
| **API endpoint**                               | Returns `403` with `PermissionDeniedError` JSON body. Never returns `404` for permission issues (avoids information leakage — the user knows the resource exists but can't access it). Exception: cross-tenant access returns `404` (see Tenant Isolation below). |
| **Real-time subscription**                     | Server silently drops events for resources the user can't access. No error sent to client. On reconnect, subscription is re-validated against current permissions.                                                                                                |

### Audit Logging of Denials

Permission denials are written to `audit_log` with `action: 'permission_denied'` and the full `PermissionDeniedError.details` in the `metadata` JSONB column. This enables Admins to see "Sarah tried to access Budget field 14 times this week" and decide whether to grant an override.

**Rate limiting on audit:** To prevent audit log flooding from automated/scripted access, permission denial audit entries are deduplicated: same `(user_id, action, resource, resource_id)` within a 5-minute window writes one entry with a `count` field.

---

## Tenant Isolation

Permission checks operate **within** a tenant boundary that is enforced at a lower layer. Every database query includes `tenant_id` via RLS policies (see `CLAUDE.md` § Multi-Tenant Isolation). The permission system assumes tenant isolation is already guaranteed and focuses on intra-tenant role-based access.

**Cross-tenant access attempts** — where a user with access to Tenant A tries to access a resource in Tenant B — are handled at the data layer, not the permission layer:

| Layer                   | Behavior                                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RLS (Postgres)**      | Query returns zero rows. The resource is invisible, not forbidden.                                                                                                                                                  |
| **Server Action / API** | Resource not found in query results → returns `404 Not Found`, never `403`. This prevents enumeration attacks (attacker can't distinguish "exists but forbidden" from "doesn't exist").                             |
| **Audit**               | Cross-tenant access attempts are not logged in the target tenant's audit log (the query never reaches the resource). The requesting tenant's audit log records a normal "not found" — no special cross-tenant flag. |

**Portal tenant isolation:** Portal clients are scoped to a single tenant via `portal_access.tenant_id`. The portal data resolver re-verifies tenant_id on every query. See `portals.md` § Security Invariant.

---

## Phase Implementation

| Phase                         | Permission Work                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation (MVP)**    | Workspace role stored on `workspace_memberships`. Owner/Admin/Manager only (no TM/Viewers yet). All users see all data. Role checked for workspace management operations. Permission denial error shape and audit logging implemented. Auth middleware uses `effective_memberships` view (CP-002 retrofit). |
| **MVP — Core UX**             | Full model: `views.permissions` JSONB with fieldPermissions. Resolution algorithm. Config UI (role grid, individual overrides). Caching (session + Redis). Real-time invalidation. Security tests.                                     |
| **Post-MVP — Portals & Apps** | Portal field permissions via portal configuration on `portals` table. Security tests: cross-client isolation, field leakage.                                                                                                           |
| **Post-MVP**                  | App Designer portal permissions via `app_blocks.data_binding` JSONB. Multi-page, multi-record, client identity scoping.                                                                                                                |

---

## Agency Access Model (CP-002)

Agency members access client tenants via `tenant_relationships` rows, resolved through the `effective_memberships` view. They are NOT added to the client tenant's `tenant_memberships`.

### Access Level Derivation

| `tenant_relationships.access_level` | Synthesized Role | Effective Permissions |
|---|---|---|
| `admin` | Admin-equivalent | Full workspace access in client tenant. Cannot modify tenant ownership or billing. |
| `builder` | Manager-equivalent | Create/manage tables, views, portals, automations within client tenant workspaces. |
| `read_only` | Viewer-equivalent | Read-only access to client tenant workspaces. |

### Agency Access Rules

- Agency members do **not** appear in client tenant membership lists.
- Revoking the `tenant_relationships` row cleanly removes all agency access in one action.
- Audit logs show `[Agency Name] on behalf of [User]` — never raw individual names when `metadata.hide_member_identity = true` (white-label mode).
- Agency members cannot modify client tenant settings, billing, or ownership — even with `admin` access level.
- **Persistent "Acting as Agency" banner:** When an agency member operates inside a client tenant, a shell-level banner shows which agency they represent, which client tenant they are in, and a one-click exit back to their agency tenant. This banner cannot be dismissed.
