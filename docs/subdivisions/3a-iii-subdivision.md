# Subdivision Doc: 3A-iii — Field-Level Permissions: Model, Resolution & Config UI

## Big-Picture Anchor

Sub-phase 3A-iii implements the full field-level permission model that
makes EveryStack's Table View–based access control real. Prior phases
built the grid (3A-i), view features and Record View (3A-ii), and
workspace roles (1C). This sub-phase adds the permission layer on top:
three-state field visibility (read-write / read-only / hidden), the
two-layer restriction model (role-level + individual overrides), the
7-step resolution algorithm, Redis caching, real-time invalidation, and
the permission configuration UI. When complete, Admins and Managers can
configure exactly which fields Team Members and Viewers see and edit per
Table View — and those permissions enforce instantly across Grid View,
Record View, Card View, and cross-links. This unlocks 3B-i (cross-link
permission resolution), 3B-ii (permission-filtered Command Bar), 3C
(thread visibility), 3D (document merge tag filtering), and the entire
portal/forms layer in Phase 3's second half.

## Section Index

| Section | Summary |
|---------|---------|
| Big-Picture Anchor | Phase position, upstream/downstream dependencies, what field-level permissions unlock |
| Dependency Graph | Unit dependency flow: 1 (types) -> 2 (data) -> 3+4 (parallel: enforcement, real-time) -> 5 (rendering) -> 6 (config UI) |
| Unit 1: Permission Types & Resolution Engine | Pure types, Zod schemas, and resolveFieldPermission() 7-step cascade with no I/O |
| Unit 2: Data Layer | getFieldPermissions() I/O wrapper with Redis caching, invalidatePermissionCache() |
| Unit 3: Action Layer Enforcement | checkFieldPermission(), filterHiddenFields(), audit logging with dedup |
| Unit 4: Real-Time Invalidation | PERMISSION_UPDATED event, publishPermissionUpdate(), client-side handler |
| Unit 5: Grid/View Permission-Aware Rendering | useFieldPermissions() hook, PermissionProvider, updated grid/record/card view components |
| Unit 6: Permission Configuration UI | RoleLevelPermissionGrid, IndividualOverrideView, PermissionConfigPanel, server actions |

## Dependency Graph

Covers Unit 1: Permission Types & Resolution Engine, Unit 2: Data Layer — resolveFieldPermissions() + Redis Cache, Unit 3: Action Layer — Permission Enforcement + Audit Logging, Unit 4: Real-Time Invalidation, Unit 5: Grid/View Permission-Aware Rendering, Unit 6: Permission Configuration UI.
Touches `read_write`, `field_overrides`, `audit_log`, `canonical_data` tables. See `permissions.md`, `realtime.md`, `design-system.md`.

```
Unit 1: Permission Types & Resolution Engine (pure logic)
  ↓
Unit 2: Data Layer — resolveFieldPermissions() + Redis Cache
  ↓                  ↓
Unit 3: Action       Unit 4: Real-Time
Layer Enforcement    Invalidation
  ↓                  ↓
  └──────┬───────────┘
         ↓
Unit 5: Grid/View Permission-Aware Rendering
         ↓
Unit 6: Permission Configuration UI
```

**Critical path:** Unit 1 → Unit 2 → Unit 5 → Unit 6 (4 deep)
**Parallel opportunities:** Units 3 and 4 (both consume Unit 2, independent of each other)

---

### Unit 1: Permission Types & Resolution Engine

**Big-Picture Anchor:** Defines the TypeScript types, Zod schemas, and
pure resolution functions that every other unit imports. This is the
contract layer — the shapes of `ViewPermissions`, `ViewFieldPermissions`,
`FieldPermissionState`, and the `resolveFieldPermission()` pure function
that implements the 7-step cascade as a deterministic, testable function
with no I/O.

**Produces:**
- `FieldPermissionState` — type literal `'read_write' | 'read_only' | 'hidden'` from `packages/shared/auth/permissions/types.ts`
- `ViewPermissions` — interface from `packages/shared/auth/permissions/types.ts`
- `ViewFieldPermissions` — interface from `packages/shared/auth/permissions/types.ts`
- `RoleRestriction` — interface (tableId, role, fieldId, accessState) from `packages/shared/auth/permissions/types.ts`
- `IndividualOverride` — interface (tableId, userId, fieldId, accessState) from `packages/shared/auth/permissions/types.ts`
- `FieldPermissionMap` — type `Map<string, FieldPermissionState>` from `packages/shared/auth/permissions/types.ts`
- `ResolvedPermissionContext` — interface (userId, effectiveRole, tableId, viewId, fieldIds) from `packages/shared/auth/permissions/types.ts`
- `viewPermissionsSchema` — Zod schema for validating `ViewPermissions` JSONB from `packages/shared/auth/permissions/schemas.ts`
- `fieldPermissionsSchema` — Zod schema for validating `fields.permissions` JSONB from `packages/shared/auth/permissions/schemas.ts`
- `resolveFieldPermission(fieldId, context): FieldPermissionState` — pure function implementing the 7-step cascade from `packages/shared/auth/permissions/resolve.ts`
- `resolveAllFieldPermissions(context): FieldPermissionMap` — batch resolver from `packages/shared/auth/permissions/resolve.ts`
- `PermissionDeniedError` re-export — already exists in `packages/shared/auth/errors.ts`, re-exported from permissions index

**Consumes:**
- `EffectiveRole` from `packages/shared/auth/roles.ts` — used in resolution context
- `roleAtLeast()` from `packages/shared/auth/roles.ts` — used in resolution logic (Owner/Admin bypass)
- `PermissionDeniedError` from `packages/shared/auth/errors.ts` — re-exported, not duplicated

**Side Effects:** None — pure types, schemas, and functions with no I/O.

**Context Manifest:**
- `permissions.md` § Field-Level Permissions (lines 121–179) — 3 states, defaults, two-layer model, resolution order
- `permissions.md` § Permission Storage (JSONB) (lines 203–274) — `ViewPermissions`/`ViewFieldPermissions` interfaces, fields.permissions shape
- `permissions.md` § Permission Resolution at Runtime (lines 278–339) — 7-step cascade
- `permissions.md` § Core Principles (lines 43–55) — 5 axioms
- `CLAUDE.md` § Code Conventions (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/auth/roles.ts` — `EffectiveRole`, `roleAtLeast()`, `ROLE_HIERARCHY`
- `packages/shared/auth/errors.ts` — `PermissionDeniedError` class
- `packages/shared/auth/index.ts` — current exports to extend
- `packages/shared/db/schema/views.ts` — `permissions` JSONB column shape reference
- `packages/shared/db/schema/fields.ts` — `permissions` JSONB column shape reference

**Acceptance Criteria:**
- [ ] `FieldPermissionState`, `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride` types exported
- [ ] `viewPermissionsSchema` Zod schema validates the JSONB shape from permissions.md § Permission Storage
- [ ] `fieldPermissionsSchema` Zod schema validates `fields.permissions` JSONB
- [ ] `resolveFieldPermission()` implements the 7-step cascade exactly as specified in permissions.md § Permission Resolution at Runtime (lines 286–308)
- [ ] Owner/Admin always returns `read_write` regardless of restrictions (short-circuit at step 2)
- [ ] `resolveAllFieldPermissions()` returns a complete `FieldPermissionMap` for all fields in a table
- [ ] Fields not exposed by Table View `field_overrides` resolve to `hidden` (step 1 — structural filter)
- [ ] Role-level restrictions can only narrow, never expand (step 6a)
- [ ] Individual overrides can restore up to field ceiling but not beyond (step 6c)
- [ ] Resolution is deterministic — same inputs always produce same output
- [ ] Unit tests cover all 7 steps with edge cases: no restrictions, role-only, individual-only, bidirectional override, field ceiling blocking override
- [ ] All types and functions are pure (no I/O, no database, no Redis)
- [ ] Exports registered in `packages/shared/auth/index.ts`

**Estimated Complexity:** Medium — many types but the resolution logic is well-specified in the reference doc. The main challenge is faithfully implementing the 7-step cascade with correct narrowing semantics.

---

### Unit 2: Data Layer — resolveFieldPermissions() + Redis Cache

**Big-Picture Anchor:** The I/O layer that loads permission data from
Postgres, calls the pure resolution engine from Unit 1, and caches
resolved permission maps in Redis with 300s TTL. This is the function
that every server-side consumer calls: `getFieldPermissions(tenantId,
viewId, userId)`. It returns the cached `FieldPermissionMap` or resolves
fresh, caches, and returns.

**Produces:**
- `getFieldPermissions(tenantId, viewId, userId): Promise<FieldPermissionMap>` — data access function from `apps/web/src/data/permissions.ts`
- `invalidatePermissionCache(tenantId, viewId, userId?): Promise<void>` — cache invalidation from `apps/web/src/data/permissions.ts`
- `PERMISSION_CACHE_KEY_PATTERN` — `cache:t:{tenantId}:perm:{viewId}:{userId}` constant from `apps/web/src/data/permissions.ts`
- `PERMISSION_CACHE_TTL` — 300 seconds constant from `apps/web/src/data/permissions.ts`
- `createTestViewWithPermissions(overrides?)` — test factory extension from `packages/shared/testing/factories.ts`

**Consumes:**
- `resolveAllFieldPermissions()`, `FieldPermissionMap`, `ResolvedPermissionContext`, `ViewPermissions` from Unit 1 — resolution engine
- `getViewById()` from `apps/web/src/data/views.ts` — loads view with permissions JSONB
- `getFieldsByTable()` from `apps/web/src/data/fields.ts` — loads field definitions with permissions JSONB
- `resolveEffectiveRole()` from `packages/shared/auth/check-role.ts` — resolves user's workspace role
- `getDbForTenant()` from `packages/shared/db` — tenant-scoped database access

**Side Effects:** None (no migrations — `views.permissions` and `fields.permissions` JSONB columns already exist in schema).

**Context Manifest:**
- `permissions.md` § Permission Caching Strategy (lines 343–350) — Redis key pattern, TTL, invalidation triggers
- `permissions.md` § Permission Resolution at Runtime (lines 278–339) — full resolution cascade for context
- `CLAUDE.md` § Testing Rules (always loaded) — tenant isolation test requirement
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/data/views.ts` — existing view data access functions
- `apps/web/src/data/fields.ts` — existing field data access functions
- `packages/shared/auth/check-role.ts` — `resolveEffectiveRole()` for role lookup
- `packages/shared/testing/factories.ts` — factory pattern reference for extension

**From Prior Units:**
- Unit 1 output: `packages/shared/auth/permissions/types.ts`
- Unit 1 output: `packages/shared/auth/permissions/schemas.ts`
- Unit 1 output: `packages/shared/auth/permissions/resolve.ts`

**Acceptance Criteria:**
- [ ] `getFieldPermissions()` returns `FieldPermissionMap` for all fields in the view's table
- [ ] Redis cache hit returns cached map without database queries
- [ ] Redis cache miss triggers full resolution (load view, fields, role, resolve, cache)
- [ ] Cache key follows pattern `cache:t:{tenantId}:perm:{viewId}:{userId}`
- [ ] Cache TTL is 300 seconds
- [ ] `invalidatePermissionCache()` deletes specific user cache or all users for a view (wildcard)
- [ ] `testTenantIsolation()` test: Tenant A's permissions not accessible from Tenant B's context
- [ ] Integration test: full resolution round-trip (create view with permissions, resolve, verify)
- [ ] `createTestViewWithPermissions()` factory creates views with pre-configured permission JSONB
- [ ] Owner/Admin bypass is exercised through the resolution engine (no special data-layer logic)

**Estimated Complexity:** Medium — standard data access pattern with Redis caching. The resolution logic is delegated to Unit 1's pure functions.

---

### Unit 3: Action Layer — Permission Enforcement + Audit Logging

**Big-Picture Anchor:** Adds field-level permission checks to server
actions that mutate records. When a user attempts to edit a read-only
field or access a hidden field, the action rejects with
`PermissionDeniedError` and logs the denial to `audit_log`. This unit
also adds the `checkFieldPermission()` guard used by record actions,
view actions, and bulk actions.

**Produces:**
- `checkFieldPermission(tenantId, viewId, userId, fieldId, requiredState): Promise<void>` — throws `PermissionDeniedError` if insufficient from `apps/web/src/lib/auth/field-permissions.ts`
- `checkFieldPermissions(tenantId, viewId, userId, fieldIds, requiredState): Promise<void>` — batch check from `apps/web/src/lib/auth/field-permissions.ts`
- `filterHiddenFields(record, permissionMap): FilteredRecord` — strips hidden fields from record data from `apps/web/src/lib/auth/field-permissions.ts`
- `logPermissionDenial(tenantId, userId, details): Promise<void>` — audit log writer with 5-min dedup from `apps/web/src/lib/auth/field-permissions.ts`
- Updated `updateRecord` server action — permission check before field mutation in `apps/web/src/actions/record-actions.ts`
- Updated `bulkUpdateRecords` server action — all-or-nothing permission check in `apps/web/src/actions/record-actions.ts`

**Consumes:**
- `getFieldPermissions()` from Unit 2 — loads resolved permission map
- `FieldPermissionMap`, `FieldPermissionState`, `PermissionDeniedError` from Unit 1 — types and error class
- `writeAuditLog()` from `@everystack/shared/db` — audit logging

**Side Effects:** None (uses existing `audit_log` table — no migration needed).

**Context Manifest:**
- `permissions.md` § Permission Denial Behavior (lines 409–457) — error shape, UI behavior, audit logging with dedup
- `permissions.md` § Permission Management Hierarchy (lines 354–369) — who can do what
- `CLAUDE.md` § Error Handling (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/actions/record-actions.ts` — existing record mutation actions to extend
- `apps/web/src/actions/view-actions.ts` — existing view actions (for permission config mutations in Unit 6)
- `packages/shared/auth/errors.ts` — `PermissionDeniedError` class

**From Prior Units:**
- Unit 1 output: `packages/shared/auth/permissions/types.ts`
- Unit 2 output: `apps/web/src/data/permissions.ts`

**Acceptance Criteria:**
- [ ] `checkFieldPermission()` throws `PermissionDeniedError` when user lacks required state
- [ ] `checkFieldPermissions()` rejects entire batch if any field fails (all-or-nothing)
- [ ] `filterHiddenFields()` strips all hidden field keys from `canonical_data` JSONB
- [ ] `logPermissionDenial()` writes to `audit_log` with `action: 'permission_denied'` and full details
- [ ] Audit dedup: same (userId, action, resource, resourceId) within 5 minutes writes one entry with `count`
- [ ] `updateRecord` action checks field permissions before applying mutation
- [ ] `bulkUpdateRecords` action checks all target fields for all records before executing
- [ ] Hidden fields are never returned in record query responses (stripped at data layer)
- [ ] Tests: write attempt on read-only field → 403, read attempt on hidden field → field absent from response
- [ ] Tests: bulk action with mixed permissions → entire batch rejected with count in error message

**Estimated Complexity:** Medium — well-defined error patterns from CLAUDE.md. The dedup logic for audit logging is the most nuanced piece.

---

### Unit 4: Real-Time Invalidation

**Big-Picture Anchor:** When an Admin or Manager changes field
permissions on a Table View, connected clients must receive updated
permissions immediately — stale permission caches are a security
vulnerability. This unit registers the `PERMISSION_UPDATED` event type,
publishes it when permissions change, busts the Redis cache, and
delivers the new permission map to affected clients via Socket.io.

**Produces:**
- `REALTIME_EVENTS.PERMISSION_UPDATED` — event constant from `packages/shared/realtime/events.ts`
- `PermissionUpdatedPayload` — event payload type from `packages/shared/realtime/types.ts`
- `publishPermissionUpdate(tenantId, viewId, affectedUserIds?): Promise<void>` — from `apps/web/src/lib/realtime/permission-events.ts`
- `handlePermissionUpdated` — client-side event handler that refreshes local permission state from `apps/web/src/lib/realtime/permission-handlers.ts`

**Consumes:**
- `invalidatePermissionCache()` from Unit 2 — busts Redis cache before publishing event
- `EventPublisher`, `publishEvent()` from `packages/shared/realtime/publisher.ts` — Redis pub/sub
- `REALTIME_EVENTS` from `packages/shared/realtime/events.ts` — existing event constants to extend

**Side Effects:**
- Registers new event type `PERMISSION_UPDATED` in shared realtime events
- Adds client-side event subscription in view context

**Context Manifest:**
- `permissions.md` § Permission Caching Strategy (lines 343–350) — invalidation triggers, `permission.updated` push
- `realtime.md` § Room model + event bus (lines 30–90) — event publishing pattern
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/realtime/events.ts` — existing event constants to extend
- `packages/shared/realtime/types.ts` — existing payload types to extend
- `packages/shared/realtime/publisher.ts` — `publishEvent()` pattern reference
- `apps/realtime/src/subscribers/redis-event-subscriber.ts` — subscriber pattern reference

**From Prior Units:**
- Unit 2 output: `apps/web/src/data/permissions.ts` — `invalidatePermissionCache()`

**Acceptance Criteria:**
- [ ] `PERMISSION_UPDATED` event constant registered in `REALTIME_EVENTS`
- [ ] `PermissionUpdatedPayload` includes `tenantId`, `viewId`, `tableId`, and optional `affectedUserIds`
- [ ] `publishPermissionUpdate()` calls `invalidatePermissionCache()` then publishes via Redis pub/sub
- [ ] Client handler receives event and triggers permission re-fetch (via `getFieldPermissions()`)
- [ ] Event is scoped to the correct room (workspace-level or view-level)
- [ ] Tests: permission change triggers event delivery to connected mock client
- [ ] Tests: cache is invalidated before event is published (ordering guarantee)

**Estimated Complexity:** Low-Medium — follows established real-time event patterns from 1G. The main risk is ensuring cache invalidation happens before the event publish (ordering).

---

### Unit 5: Grid/View Permission-Aware Rendering

**Big-Picture Anchor:** Makes Grid View, Record View, and Card View
respect the resolved permission map. Hidden fields are not rendered
(no column, no cell, no "hidden" indicator). Read-only fields render
without edit affordances (no edit cursor, disabled input). Action
buttons that require higher permissions are visible but disabled with
a tooltip. This is where permissions become visible to end users.

**Produces:**
- `useFieldPermissions(viewId)` — React hook returning `FieldPermissionMap` from `apps/web/src/hooks/use-field-permissions.ts`
- `PermissionProvider` — React context provider wrapping view components from `apps/web/src/components/permissions/PermissionProvider.tsx`
- `usePermission(fieldId)` — convenience hook returning single field's state from `apps/web/src/hooks/use-field-permissions.ts`
- Updated `DataGrid` — filters hidden columns, marks read-only cells from `apps/web/src/components/grid/DataGrid.tsx`
- Updated `GridCell` — read-only rendering mode (no edit cursor, visual indicator) from `apps/web/src/components/grid/GridCell.tsx`
- Updated `RecordView` — hides hidden fields, marks read-only from `apps/web/src/components/record-view/RecordView.tsx` (or equivalent)
- Updated `CardView` — hides hidden fields from `apps/web/src/components/card-view/CardView.tsx` (or equivalent)
- Updated `BulkActionsToolbar` — disabled state with permission tooltip from `apps/web/src/components/grid/BulkActionsToolbar.tsx`
- i18n keys for permission-related messages in `apps/web/messages/en.json` and `apps/web/messages/es.json`

**Consumes:**
- `getFieldPermissions()` from Unit 2 — server-side permission loading for SSR/initial data
- `FieldPermissionMap`, `FieldPermissionState` from Unit 1 — types
- `handlePermissionUpdated` from Unit 4 — real-time permission refresh
- Existing grid components from 3A-i/3A-ii — `DataGrid`, `GridCell`, `GridHeader`, `RecordView`, `CardView`, `BulkActionsToolbar`

**Side Effects:** None — UI changes only.

**Context Manifest:**
- `permissions.md` § Permission Denial Behavior (lines 409–449) — UI behavior per context (hidden fields, read-only, disabled buttons)
- `permissions.md` § Field-Level Permissions (lines 121–179) — what each state means for rendering
- `design-system.md` § Component Conventions (lines 100–160) — shadcn/ui patterns, touch targets, loading states
- `CLAUDE.md` § Component Conventions + TypeScript Rules (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/components/grid/DataGrid.tsx` — grid shell to extend with permission filtering
- `apps/web/src/components/grid/GridCell.tsx` — cell renderer to add read-only mode
- `apps/web/src/components/grid/GridHeader.tsx` — column header (hide restricted columns)
- `apps/web/src/components/grid/BulkActionsToolbar.tsx` — bulk action permission gating
- `apps/web/src/components/record-view/` — Record View components (or equivalent path)
- `apps/web/src/components/card-view/` — Card View components (or equivalent path)
- `apps/web/messages/en.json` — existing i18n keys

**From Prior Units:**
- Unit 1 output: `packages/shared/auth/permissions/types.ts`
- Unit 2 output: `apps/web/src/data/permissions.ts`
- Unit 4 output: `apps/web/src/lib/realtime/permission-handlers.ts`

**Acceptance Criteria:**
- [ ] `useFieldPermissions(viewId)` hook loads permission map and subscribes to real-time updates
- [ ] `PermissionProvider` wraps view-level components and provides permission context
- [ ] Hidden fields produce no DOM output — no column, no cell, no empty placeholder, no "hidden" indicator
- [ ] Read-only fields render value but show no edit cursor on hover and no edit mode on click
- [ ] Read-only cells have visual indicator (lock icon or muted styling per design-system.md)
- [ ] Disabled action buttons show tooltip: "Requires Manager role" (or equivalent, via i18n)
- [ ] Bulk action toolbar disables actions when user lacks permission on any selected record's fields
- [ ] Record View hides hidden fields and marks read-only fields
- [ ] Card View hides hidden fields
- [ ] i18n keys added for all permission-related user-facing strings (en + es)
- [ ] No hardcoded English strings (check:i18n gate)
- [ ] Component tests: grid renders correct column count with hidden fields filtered
- [ ] Component tests: read-only cell blocks edit interaction

**Estimated Complexity:** High — touches multiple existing components across Grid, Record View, and Card View. Requires careful integration with existing rendering logic without breaking current functionality.

---

### Unit 6: Permission Configuration UI

**Big-Picture Anchor:** The admin-facing UI where Admins and Managers
configure field permissions per Table View. Two views: (1) Role-Level
Configuration — a field × role grid where each cell shows the effective
state and click-to-cycle changes it; (2) Individual Override View —
select a person, see their effective permissions after all layers, and
toggle overrides. This is the last unit because it needs everything
upstream: types, resolution, data access, real-time, and rendering
patterns.

**Produces:**
- `RoleLevelPermissionGrid` — component from `apps/web/src/components/permissions/RoleLevelPermissionGrid.tsx`
- `IndividualOverrideView` — component from `apps/web/src/components/permissions/IndividualOverrideView.tsx`
- `PermissionConfigPanel` — container component (tab switcher between role/individual views) from `apps/web/src/components/permissions/PermissionConfigPanel.tsx`
- `PermissionStateBadge` — visual indicator component (read-write / read-only / hidden) from `apps/web/src/components/permissions/PermissionStateBadge.tsx`
- `updateViewPermissions(tenantId, viewId, permissions)` — server action from `apps/web/src/actions/permission-actions.ts`
- `updateFieldGlobalPermissions(tenantId, fieldId, permissions)` — server action from `apps/web/src/actions/permission-actions.ts`
- i18n keys for permission config UI in `apps/web/messages/en.json` and `apps/web/messages/es.json`

**Consumes:**
- `getFieldPermissions()` from Unit 2 — loads current state for display
- `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride`, `FieldPermissionState` from Unit 1 — types for state management
- `viewPermissionsSchema`, `fieldPermissionsSchema` from Unit 1 — input validation
- `invalidatePermissionCache()` from Unit 2 — cache busting after save
- `publishPermissionUpdate()` from Unit 4 — real-time notification after save
- `PermissionProvider`, `useFieldPermissions()` from Unit 5 — permission context for preview
- `checkRole()`, `requireRole()` from `packages/shared/auth` — gate config access to Manager+

**Side Effects:**
- Adds route or panel for permission configuration (within Table View settings)

**Context Manifest:**
- `permissions.md` § Permission Configuration UI (lines 183–199) — role-level grid, individual override view, UX principle
- `permissions.md` § Permission Management Hierarchy (lines 354–369) — who can configure what
- `permissions.md` § Two-Layer Restriction Model (lines 148–166) — how overrides work both directions
- `permissions.md` § Permission Storage (JSONB) (lines 203–274) — JSONB shape for mutations
- `design-system.md` § Component Conventions (lines 100–160) — shadcn/ui, progressive disclosure
- `CLAUDE.md` § Design Philosophy (always loaded) — progressive disclosure levels
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/actions/view-actions.ts` — existing view mutation patterns
- `apps/web/src/components/grid/ViewSwitcher.tsx` — entry point for view settings
- `apps/web/messages/en.json` — existing i18n keys

**From Prior Units:**
- Unit 1 output: `packages/shared/auth/permissions/types.ts`, `schemas.ts`
- Unit 2 output: `apps/web/src/data/permissions.ts`
- Unit 4 output: `apps/web/src/lib/realtime/permission-events.ts`
- Unit 5 output: `apps/web/src/components/permissions/PermissionProvider.tsx`, `apps/web/src/hooks/use-field-permissions.ts`

**Acceptance Criteria:**
- [ ] `RoleLevelPermissionGrid` renders field list × role columns (Team Member, Viewer, Manager if Admin)
- [ ] Each cell shows effective state (read-write / read-only / hidden) via `PermissionStateBadge`
- [ ] Click-to-cycle changes state: read-write → read-only → hidden → read-write
- [ ] Bulk role configuration (set all fields for a role at once)
- [ ] `IndividualOverrideView` shows person selector from Table View's access roster
- [ ] Selected person shows effective permissions (final resolved state)
- [ ] Fields with active overrides visually distinguished (badge/highlight)
- [ ] Override toggle works both directions (further restrict OR restore)
- [ ] `updateViewPermissions()` validates input with Zod schema, persists to `views.permissions` JSONB
- [ ] `updateFieldGlobalPermissions()` validates and persists to `fields.permissions` JSONB
- [ ] Both server actions call `invalidatePermissionCache()` + `publishPermissionUpdate()` after save
- [ ] Both server actions check role: only Manager+ can configure permissions
- [ ] Admin can configure Manager restrictions; Manager can configure Team Member/Viewer restrictions
- [ ] i18n keys for all config UI strings (en + es)
- [ ] UX principle enforced: Admin always sees actual effective result per user, never mentally computes
- [ ] Tests: permission change round-trip (configure → save → reload → verify state)
- [ ] Tests: role gating — Team Member cannot access permission config

**Estimated Complexity:** High — the most UI-intensive unit. The
role × field grid with click-to-cycle and the individual override view
with effective-permission display are complex interactive components.
Progressive disclosure (permissions are an advanced feature) must be
handled carefully.

---

## Cross-Unit Integration Points

These are the specific points where units interact — the Reviewer Agent
should verify these compose correctly after all units are built:

1. **Unit 1 → Unit 2:** `resolveAllFieldPermissions()` is called inside
   `getFieldPermissions()`. The `ResolvedPermissionContext` must be
   constructed from database results (view, fields, role) before calling
   the pure function.

2. **Unit 2 → Unit 3:** `getFieldPermissions()` is the data source for
   `checkFieldPermission()`. The action layer never resolves permissions
   directly — it always goes through the cached data layer.

3. **Unit 2 → Unit 4:** `invalidatePermissionCache()` must be called
   before `publishPermissionUpdate()` in every mutation path. The event
   tells clients to re-fetch, so the cache must be cleared first or
   they'll get stale data.

4. **Unit 4 → Unit 5:** The `handlePermissionUpdated` client handler
   must trigger `useFieldPermissions()` hook to re-fetch. The hook should
   use TanStack Query's invalidation mechanism so the re-fetch is
   deduped across components.

5. **Unit 5 → Unit 6:** The `PermissionProvider` context wraps both the
   data view (Grid/Record/Card) and the config UI. The config UI uses
   the same provider to show "preview" of what users will see.

6. **Unit 6 → Units 2+4:** Permission config save actions must call
   both `invalidatePermissionCache()` and `publishPermissionUpdate()` in
   sequence. This is the write path that triggers the real-time flow.

7. **Unit 1 types used everywhere:** `FieldPermissionState`,
   `FieldPermissionMap`, and `ViewPermissions` are imported by Units
   2–6. Any type shape change in Unit 1 cascades to all downstream
   units.

## Context Budget Verification

| Unit | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-------------|-------------|---------------|-------------|--------|
| 1    | 4 sections (~200 lines) | 5 files (~300 lines) | 0 | ~8,000 | Yes |
| 2    | 2 sections (~80 lines) | 4 files (~400 lines) | 3 files (~250 lines) | ~11,000 | Yes |
| 3    | 2 sections (~90 lines) | 3 files (~400 lines) | 2 files (~200 lines) | ~10,000 | Yes |
| 4    | 2 sections (~70 lines) | 4 files (~300 lines) | 1 file (~100 lines) | ~7,000 | Yes |
| 5    | 3 sections (~130 lines) | 7 files (~700 lines) | 3 files (~300 lines) | ~16,000 | Yes |
| 6    | 4 sections (~180 lines) | 3 files (~300 lines) | 5 files (~500 lines) | ~14,000 | Yes |

All units pass the ~40% context budget test. Unit 5 is the tightest at
~16,000 tokens estimated (well under the ~40,000 token budget). CLAUDE.md
(~5,000 tokens) and GLOSSARY.md (~5,000 tokens) are always loaded,
bringing the heaviest unit to ~26,000 tokens — safely within budget.
