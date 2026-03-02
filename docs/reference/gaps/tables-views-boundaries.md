# Table View vs My View — Boundary Definitions

> **📋 Reconciliation Note (2026-02-27):** Reconciled with `GLOSSARY.md` (source of truth).
> **Changes made:**
>
> - Renamed "View" → **Table View** throughout (glossary term)
> - Renamed "Saved View" → **My View** throughout (glossary term)
> - Renamed "Base" → **Workspace** throughout (glossary term)
> - Renamed "Interface" concept → marked as **post-MVP / superseded**. The glossary eliminates the separate "Interface" entity; **Table Views are the access boundary** for Team Members and Viewers, with field permissions controlling visibility per role per Table View
> - Removed `form` from view type enum — glossary defines Form as a separate entity (Record View layout for creating records), not a Table View type
> - Tagged Kanban, Gallery, Calendar, Timeline as **post-MVP** view types — only Grid + Card are MVP per glossary
> - Updated cross-references to use glossary terms
> - Replaced "Base" scoping with "Workspace" scoping throughout

> **⚠️ SUPERSEDED (2026-02-13, updated 2026-02-27).** The "Interface" architecture in this document has been superseded by `GLOSSARY.md` (source of truth) and `tables-and-views.md`. The glossary eliminates the separate "Interface" entity entirely — **Table Views are the permission boundary**, with Shared Views (Manager-created) and My Views (user-created). Field visibility is controlled per role per Table View. This gap doc's 3-layer model (Table View → Interface → My View) is no longer the canonical architecture. **Do not use this doc's schemas for new work.** Consult `GLOSSARY.md` and `tables-and-views.md` for the current architecture.
>
> **Original merge target:** `tables-and-views.md` — merge effectively completed by the evolved architecture in that doc.

---

## The Concepts (Glossary-Aligned)

EveryStack's current architecture (per `GLOSSARY.md`) defines **two** primary concepts for data presentation, not three. The original "Interface" layer has been absorbed into the Table View's permission model.

### 1. Table View (Configured Data Presentation)

A **Table View** is a configured way of looking at a table's records. Table Views define which records are visible (filters), how they're ordered (sorts), how they're grouped, and which fields are shown.

**Key properties:**

- Belongs to exactly one table
- **Shared Views:** Created by Manager+ roles. Visible to all workspace members with access. Define the default experience for a table.
- Multiple Table Views per table (e.g., "All Projects" grid view, "By Status" card view)
- Field visibility, order, width, and sort/filter/group config stored per-view
- **Table Views are the access boundary** for Team Members and Viewers — they see only the views they've been given access to, with only the fields that have been made visible to their role

**Table View types (MVP):** Grid, Card.
**Table View types (post-MVP):** Kanban, List, Gantt, Calendar, Gallery.

> **Note:** Form is NOT a Table View type. Per the glossary, a Form is a separate entity — a Record View layout configured for data input that creates new records. See `GLOSSARY.md` → Form.

**Data model:**

```typescript
interface TableView {
  id: string;
  tenantId: string;
  tableId: string; // Always belongs to one table
  name: string;
  viewType: ViewType; // grid | card (MVP) — kanban | list | gantt | calendar | gallery (post-MVP)
  config: ViewConfig; // Field visibility, widths, sort, filter, group-by
  publishState: 'live' | 'draft'; // Authoring workflow — orthogonal to environment (sandbox)
  environment: 'live' | 'sandbox'; // Standard sandbox isolation (post-MVP, always 'live' in MVP)
  position: number; // Order within the table's view list
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**Who sees Table Views:** Manager+ roles see all Table Views (structural access). Team Members and Viewers see only the Shared Views they've been given access to, with field visibility controlled per role.

### 2. My View (User Customization)

A **My View** is a personal filter/sort/group configuration created by any user on top of a Shared View. Only visible to the creator.

**Key properties:**

- Created by any user with access to the underlying Shared View
- **Personal by default:** Only visible to the creator
- Stored as a delta from the base Table View config (not a full copy)
- Does NOT change field visibility or record permissions — only sort, filter, group-by, and column order
- Not a definition-level object — no `publish_state` column, not part of draft/live workflow

**Data model:**

```typescript
interface PersonalView {
  id: string;
  tenantId: string;
  userId: string; // Owner — personal to this user
  viewId: string; // Base Table View this customizes
  name: string;
  config: PersonalViewConfig; // Only sort, filter, group-by overrides
  isDefault: boolean; // User's default view when opening this table
  createdAt: Date;
  updatedAt: Date;
}

interface PersonalViewConfig {
  filters: FilterRule[]; // User's personal filters (additive to Table View filters)
  sortRules: SortRule[]; // Override Table View's sort
  groupBy: GroupByRule | null; // Override Table View's group-by
  columnOrder: string[]; // Personal column reorder (within visible columns only)
  // NOTE: No field visibility changes — that's Table View-level + role permissions, not user-level
}
```

**Who creates My Views:** Any user who can access the Shared View. Team Members save personal views like "My Tasks" (filtered to assignee = me) or "Overdue Items" (filtered to due date < today).

### ~~3. Interface (Permission-Controlled Data Surface)~~ — POST-MVP / SUPERSEDED

> **⚠️ POST-MVP / SUPERSEDED:** The glossary eliminates the separate "Interface" entity. The permission boundary is now the Table View itself, with field permissions controlled per role per Table View. The Interface concept described below is retained for historical context only. If a future post-MVP iteration reintroduces a separate permission layer, it would be built in the **App Designer** (post-MVP) as an **App**, not as an "Interface."

An **Interface** was originally conceived as a curated, permission-controlled presentation of one or more Table Views, designed for consumption by Team Members and Viewers. This architecture has been superseded.

**Original key properties (historical — do not implement):**

- Created by Managers at **table level** (single table, single view) or **workspace level** (multi-table, multiple views)
- Had its own permission model: which roles and specific users could access the Interface
- Could restrict which fields were visible (subset of the underlying Table View's fields)
- Could restrict which records were visible (additional filter on top of the Table View's filter)
- Could allow or disallow record creation, editing, deletion per-Interface
- Team Members saw Interfaces, not raw tables or Table Views

**Why superseded:** The glossary simplifies this. Table Views themselves serve as the permission boundary. Shared Views (Manager-created) control what Team Members see. Field Permissions (per role per Table View) control field visibility. This eliminates an entire database entity and simplifies the query resolution chain.

**Original data model (historical — do not implement):**

```typescript
// SUPERSEDED — retained for historical context only
interface Interface {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  icon: string;
  scope: 'table' | 'workspace'; // Was 'base', renamed to 'workspace' per glossary
  workspaceId: string; // Was baseId — glossary uses Workspace, not Base
  tableId: string | null;
  views: InterfaceView[];
  permissions: InterfacePermissions;
  customizable: boolean;
  publishState: 'live' | 'draft'; // Authoring workflow (renamed from environment to avoid sandbox collision)
  position: number;
  sectionId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

interface InterfaceView {
  viewId: string;
  label: string;
  fieldOverrides: FieldOverride[];
  recordFilter: FilterRule | null;
  allowCreate: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  position: number;
}

interface InterfacePermissions {
  roles: ('team_member' | 'viewer')[];
  specificUsers: string[];
  excludedUsers: string[];
}
```

---

## Hierarchy and Data Flow

### Current Architecture (per Glossary)

```
Workspace
  └── Table
        └── Table View (Shared View — Manager-defined, with field permissions per role)
              └── My View (user customization — sort/filter/group only)
```

**Query resolution order (current):**

```
User opens Shared View
  1. Start with Table View's base config (fields, sort, filter, group-by)
  2. Apply role-based field permissions (hide fields, set read-only per role)
  3. Apply user's active My View overrides (personal filter/sort/group-by)
  4. Execute query against data layer
  5. Render with final resolved config
```

Each layer narrows or customizes. No layer can EXPAND access beyond what the layer above grants. A My View cannot show fields hidden by the Table View's role permissions.

### ~~Original Architecture (Superseded)~~ — POST-MVP / HISTORICAL

> **⚠️ POST-MVP / SUPERSEDED**

```
Workspace (was "Base")
  └── Table
        └── Table View (Manager-defined display mode)
              └── Interface (Permission boundary exposing the Table View)  ← SUPERSEDED
                    └── My View (was "Saved View" — user customization)
```

---

## Common Confusion Points

| Question                                                    | Answer                                                                                                                                |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Can a Team Member create a Table View?                      | **No.** Table Views (Shared Views) are structural — only Managers+. Team Members create My Views (personal filter/sort).              |
| Can a Table View span multiple tables?                      | **No.** Each Table View belongs to exactly one table. Cross-table data is accessed via Cross-Links within a Table View's record data. |
| Does creating a My View duplicate the data?                 | **No.** It stores a config delta. The same underlying query runs with additional filter/sort params.                                  |
| Can a Manager see Team Member My Views?                     | **No.** My Views are personal. Managers can see and edit Shared Views (Table Views).                                                  |
| Can a Table View have fields that don't exist on the table? | **No.** Table Views expose a subset of the table's fields. Computed/virtual columns come from formula fields on the table (post-MVP). |
| What happens when a Table View is deleted?                  | My Views referencing that Table View are deleted (cascade).                                                                           |
| ~~Can an Interface span multiple tables?~~                  | **Superseded.** The Interface concept has been removed. Table Views are per-table.                                                    |

---

## Database Schema

### `views` Table (Current — per Glossary)

Per `GLOSSARY.md` DB Entity Quick Reference, the `views` table stores Table View configurations:

| Column          | Type        | Purpose                                                                                                         |
| --------------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `id`            | UUID        | Primary key                                                                                                     |
| `tenant_id`     | UUID        | Tenant scope                                                                                                    |
| `table_id`      | UUID        | Parent table                                                                                                    |
| `name`          | VARCHAR     | Display name (e.g., "All Projects", "By Status")                                                                |
| `view_type`     | VARCHAR     | `'grid'`, `'card'` (MVP) — `'kanban'`, `'list'`, `'gantt'`, `'calendar'`, `'gallery'` (post-MVP)                |
| `config`        | JSONB       | Field visibility, widths, sort rules, filter rules, group-by, etc.                                              |
| `publish_state` | VARCHAR     | `'live'` or `'draft'` — authoring workflow (renamed from `environment` to avoid collision with sandbox concept) |
| `position`      | INTEGER     | Order within the table's view tabs                                                                              |
| `created_by`    | UUID        |                                                                                                                 |
| `created_at`    | TIMESTAMPTZ |                                                                                                                 |
| `updated_at`    | TIMESTAMPTZ |                                                                                                                 |

**Indexes:** `(tenant_id, table_id, environment)` for listing Table Views per table.

**MVP behavior:** When a table is created, a default grid Table View named "All Records" is auto-created with all fields visible, no filters, no sort.

### `ViewConfig` JSONB Shape

```typescript
interface ViewConfig {
  fields: ViewFieldConfig[]; // Ordered list of field visibility/width
  filters: FilterRule[]; // Table View-level filter rules
  sortRules: SortRule[]; // Sort rules
  groupBy: GroupByRule | null; // Group-by rule
  rowHeight: 'compact' | 'normal' | 'tall';
  // Post-MVP view-type-specific config:
  kanbanColumnFieldId?: string; // Kanban (post-MVP): which field defines columns
  kanbanStackFieldIds?: string[]; // Kanban (post-MVP): additional stack-by fields
  calendarDateFieldId?: string; // Calendar (post-MVP): which field maps to dates
  calendarEndDateFieldId?: string; // Calendar (post-MVP): optional end-date for ranges
  galleryImageFieldId?: string; // Gallery (post-MVP): which attachment field is the cover image
  galleryCoverFit?: 'cover' | 'contain';
  timelineStartFieldId?: string; // Timeline/Gantt (post-MVP): start date field
  timelineEndFieldId?: string; // Timeline/Gantt (post-MVP): end date field
  timelineGroupFieldId?: string; // Timeline/Gantt (post-MVP): grouping field (swimlanes)
}

interface ViewFieldConfig {
  fieldId: string;
  visible: boolean;
  width: number; // Pixels (grid only, default 150)
  position: number; // Column order
}

interface FilterRule {
  fieldId: string;
  operator: FilterOperator; // eq, neq, contains, gt, lt, in, not_in, is_empty, is_not_empty, etc.
  value: unknown;
  conjunction: 'and' | 'or'; // How this rule combines with the previous
}

interface SortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
}

interface GroupByRule {
  fieldId: string;
  direction: 'asc' | 'desc';
  collapsed: boolean; // Groups start collapsed
}
```

### ~~`interfaces` Table~~ — POST-MVP / SUPERSEDED

> **⚠️ POST-MVP / SUPERSEDED:** The `interfaces` and `interface_views` tables from the original architecture are not part of the glossary's canonical schema. The permission boundary is handled by the Table View + Field Permissions model. Retained below for historical reference only.

<details>
<summary>Historical schema (do not implement)</summary>

| Column          | Type            | Purpose                                                                                                         |
| --------------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`            | UUID            | Primary key                                                                                                     |
| `tenant_id`     | UUID            | Tenant scope                                                                                                    |
| `name`          | VARCHAR         | Display name                                                                                                    |
| `description`   | TEXT (nullable) |                                                                                                                 |
| `icon`          | VARCHAR         | Emoji or icon identifier                                                                                        |
| `scope`         | VARCHAR         | `'table'` or `'workspace'`                                                                                      |
| `workspace_id`  | UUID            | Parent workspace (was `base_id`)                                                                                |
| `table_id`      | UUID (nullable) | Set if `scope = 'table'`                                                                                        |
| `permissions`   | JSONB           | `InterfacePermissions`                                                                                          |
| `customizable`  | BOOLEAN         | Default true                                                                                                    |
| `publish_state` | VARCHAR         | `'live'` or `'draft'` — authoring workflow (renamed from `environment` to avoid collision with sandbox concept) |
| `position`      | INTEGER         | Order in sidebar                                                                                                |
| `section_id`    | UUID (nullable) | Sidebar section grouping                                                                                        |
| `created_by`    | UUID            |                                                                                                                 |
| `created_at`    | TIMESTAMPTZ     |                                                                                                                 |
| `updated_at`    | TIMESTAMPTZ     |                                                                                                                 |

</details>

### ~~`interface_views` Table~~ — POST-MVP / SUPERSEDED

<details>
<summary>Historical schema (do not implement)</summary>

| Column            | Type             | Purpose                            |
| ----------------- | ---------------- | ---------------------------------- |
| `id`              | UUID             | Primary key                        |
| `tenant_id`       | UUID             |                                    |
| `interface_id`    | UUID             | Parent Interface                   |
| `view_id`         | UUID             | Underlying Table View              |
| `label`           | VARCHAR          | Display name within this Interface |
| `field_overrides` | JSONB            | `FieldOverride[]`                  |
| `record_filter`   | JSONB (nullable) | Additional filter                  |
| `allow_create`    | BOOLEAN          | Default false                      |
| `allow_edit`      | BOOLEAN          | Default true                       |
| `allow_delete`    | BOOLEAN          | Default false                      |
| `position`        | INTEGER          | Order within Interface's view tabs |

</details>

### My View Storage (per Glossary)

Per `GLOSSARY.md`, My Views are user-level customizations. Consult `data-model.md` for the exact table name in the canonical schema.

| Column       | Type        | Purpose                                                                    |
| ------------ | ----------- | -------------------------------------------------------------------------- |
| `id`         | UUID        | Primary key                                                                |
| `tenant_id`  | UUID        |                                                                            |
| `user_id`    | UUID        | Owner — personal to this user                                              |
| `view_id`    | UUID        | Base Table View this customizes                                            |
| `name`       | VARCHAR     | User's label (e.g., "My Tasks")                                            |
| `config`     | JSONB       | `PersonalViewConfig` — only sort, filter, group-by, column order overrides |
| `is_default` | BOOLEAN     | User's default when opening this Table View                                |
| `created_at` | TIMESTAMPTZ |                                                                            |
| `updated_at` | TIMESTAMPTZ |                                                                            |

**Indexes:** `(tenant_id, user_id, view_id)` for fast lookup.

**No `publish_state` column.** My Views are personal customization, not part of the draft/live workflow.

---

## Permission Enforcement

### Role Visibility Matrix (per Glossary)

| Content                  | Owner    | Admin    | Manager  | Team Member                  | Viewer                   |
| ------------------------ | -------- | -------- | -------- | ---------------------------- | ------------------------ |
| Tables (structural)      | ✅       | ✅       | ✅       | ❌                           | ❌                       |
| Table Views (structural) | ✅       | ✅       | ✅       | Via Shared Views only        | Via Shared Views only    |
| My Views                 | Own only | Own only | Own only | Own only                     | Own only                 |
| Field definitions        | ✅       | ✅       | ✅       | ❌                           | ❌                       |
| Records (via Table View) | ✅       | ✅       | ✅       | ✅ (filtered by Shared View) | ✅ (read-only, filtered) |

**Key principle (per Glossary):** Table Views are the access boundary for Team Members and Viewers. They see only the views they've been given access to, with only the fields that have been made visible to their role.

### Data Layer Enforcement

Permission checks happen at the data layer (`apps/web/src/data/`), not in components or Server Actions.

```typescript
// apps/web/src/data/views.ts
export async function getAccessibleTableViews(tableId: string): Promise<TableView[]> {
  const tenantId = await getTenantId();
  const { userId, role } = await getCurrentUser();
  const dbConn = getDbForTenant(tenantId, 'read');

  // Managers+ see all Table Views
  if (['owner', 'admin', 'manager'].includes(role)) {
    return dbConn
      .select()
      .from(views)
      .where(
        and(
          eq(views.tenantId, tenantId),
          eq(views.tableId, tableId),
          eq(views.environment, 'live'),
        ),
      );
  }

  // Team Members / Viewers: see only Shared Views they have access to
  // Field visibility is resolved per role at render time
  return dbConn
    .select()
    .from(views)
    .where(
      and(
        eq(views.tenantId, tenantId),
        eq(views.tableId, tableId),
        eq(views.environment, 'live'),
        // Role-based access filtering per Table View permissions
      ),
    );
}
```

### Record-Level Filtering via Table View

When a Team Member queries records through a Shared View, the data layer stacks filters:

```typescript
export async function getRecordsForTableView(viewId: string): Promise<Record[]> {
  const tenantId = await getTenantId();
  const { userId, role } = await getCurrentUser();
  const dbConn = getDbForTenant(tenantId, 'read');

  // 1. Load Table View
  const tableView = await getTableView(tenantId, viewId);

  // 2. Stack filters: Table View filter + My View filter
  const viewFilters = (tableView.config as ViewConfig).filters;
  const personalView = await getActivePersonalView(tenantId, userId, tableView.id);
  const personalFilters = personalView ? (personalView.config as PersonalViewConfig).filters : [];

  const combinedFilters = [...viewFilters, ...personalFilters]; // AND-combined

  // 3. Build query with combined filters + role-based field permissions
  return buildFilteredRecordQuery(dbConn, tenantId, tableView.tableId, combinedFilters);
}
```

### Write Permission Enforcement

Before any record mutation via a Table View, check the user's role-based permissions. Field-level permissions (read-write, read-only, hidden) are resolved per user per Table View. Violations return a typed error (`TABLE_VIEW_WRITE_DENIED`) that the UI renders as a toast.

Viewers NEVER get write access, regardless of Table View settings.

---

## Sidebar Rendering

The workspace sidebar is **role-dependent**:

### Manager+ Sidebar

```
Workspace Name
├── My Office
├── Section: "Projects" (collapsible)
│   ├── 📋 Projects (table — expandable to show Table Views)
│   │   ├── All Tasks (Table View — Grid)
│   │   ├── By Status (Table View — Card)
│   │   └── [+ New Table View]
│   └── 📋 CRM
│       ├── Contacts
│       └── Deals
├── [+ New Section]
└── ⚙️ Workspace Settings
```

Managers see tables → Table Views (structural hierarchy). They navigate via the full sidebar.

### Team Member / Viewer Sidebar

```
Workspace Name
├── My Office
├── Section: "Projects"
│   ├── 📋 Sprint Board (Shared View)
│   └── 📊 Sales Pipeline (Shared View)
├── Section: "Reports"
│   └── 📈 Weekly Overview (Shared View)
└── ⚙️ Personal Settings (not Workspace Settings)
```

Team Members see ONLY Shared Views they have permission to access, organized into sections. No raw tables, no field definitions. This provides a clean, curated experience where Managers control what Team Members see.

### Sidebar Data Fetching

```typescript
// apps/web/src/data/sidebar.ts
export async function getSidebarData(): Promise<SidebarData> {
  const tenantId = await getTenantId();
  const { userId, role } = await getCurrentUser();

  const sections = await getSections(tenantId, userId);

  if (['owner', 'admin', 'manager'].includes(role)) {
    const tables = await getTables(tenantId);
    const tableViews = await getAllTableViews(tenantId);
    return { sections, tables, tableViews, showStructural: true };
  }

  const sharedViews = await getAccessibleSharedViews(tenantId, userId, role);
  return { sections, sharedViews, tables: [], tableViews: [], showStructural: false };
}
```

---

## Portals vs Table Views

Both are data surfaces, but for fundamentally different audiences:

| Aspect            | Table View (Shared View)                                                        | Portal                                                                        |
| ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Audience**      | Internal workspace members (Team Members, Viewers)                              | External clients (no workspace account)                                       |
| **Auth**          | Clerk session (workspace membership)                                            | Portal client auth (magic link or email+password, see `GLOSSARY.md` → Portal) |
| **Navigation**    | In-app sidebar                                                                  | Standalone URL (`portal.everystack.app/{slug}`)                               |
| **Data scope**    | Table View filter + role-based field permissions + My View                      | Portal scoping: one portal link = one record (MVP)                            |
| **Write access**  | Role-based field permissions (read-write, read-only, hidden per field per role) | Default read-only; Manager can selectively make specific fields editable      |
| **Customization** | My Views (personal filters)                                                     | None — portal clients see the published layout                                |
| **Real-time**     | Live grid updates via real-time service                                         | No real-time — portal pages are request-based                                 |
| **Design**        | Workspace design system (Three-Layer Color Architecture)                        | Customizable portal theme (brand colors, logo)                                |

**Key architectural principle:** Table Views and Portals both read from the same `records` table through the same data layer. The permission enforcement is different (workspace role vs portal auth), but the query path converges. A record that's visible via a Table View and also via a Portal is the same record — one source of truth.

---

## Deletion Cascades & Edge Cases

| Event                           | Behavior                                                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Table View deleted**          | My Views referencing it are deleted (cascade).                                                                                                                                                            |
| **Field deleted**               | Removed from `ViewConfig.fields`. Any `FilterRule`, `SortRule`, or `GroupByRule` referencing it is removed. My Views with filters on that field: filters removed. All cleanup is background (BullMQ job). |
| **Table deleted**               | All Table Views for the table deleted. All Portals and Forms connected to the table are affected (see `GLOSSARY.md` → Portal, Form).                                                                      |
| **User removed from workspace** | All their My Views deleted. No impact on Table Views (those belong to the workspace).                                                                                                                     |

---

## Real-Time Behavior

| Event                                                                | Effect                                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manager publishes Table View changes** (draft → live)              | All Team Members viewing this Shared View receive a real-time event `view.config_updated`. The client reloads Table View config (field visibility, sort, filter). My View overrides are re-applied on top. |
| **Manager edits Table View config** (sort, filter, field visibility) | All users with open grid/card for this Table View receive `view.config_updated`. Client reloads config and re-queries data.                                                                                |
| **Record modified**                                                  | Standard real-time record update. Both Manager (viewing raw table) and Team Member (viewing through Shared View) see the update. Role-based field permissions determine which cells are visible.           |
| **Manager adds a field**                                             | Table View configs are NOT auto-updated (new fields default to `visible: false`). Manager explicitly shows the field in the desired Table Views. This prevents accidental data exposure.                   |

---

## Phase Implementation

| Phase               | Work                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation    | `views` table in schema. Default grid Table View auto-created on table creation. `ViewConfig` JSONB with field visibility, sort, filter, group-by. No My Views yet. All users see tables directly (Manager-only workspace in MVP — Foundation). |
| MVP — Core UX (MVP) | Shared Views with role-based access. Field Permissions per role per Table View. My View creation/management. Query resolution cascade (Table View → My View). Grid + Card view types. Real-time `view.config_updated` events.                   |
| Post-MVP            | Additional Table View types (Kanban, List, Gantt, Calendar, Gallery). App Designer for custom spatial layouts.                                                                                                                                  |
