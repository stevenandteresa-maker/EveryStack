# Phase 3A-iii — Field-Level Permissions: Model, Resolution & Config UI

## Phase Context

Covers What Has Been Built, What This Phase Delivers, What This Phase Does NOT Build, Architecture Patterns for This Phase, Mandatory Context for All Prompts, Subdivision Summary.
Touches `field_overrides`, `read_write` tables.

### What Has Been Built

**Phase 1 (Foundation):** Monorepo (Turborepo + pnpm), 52-table Drizzle schema with RLS, Clerk auth with tenant resolution, `EffectiveRole` type (`owner|admin|manager|team_member|viewer`), `roleAtLeast()`, `resolveEffectiveRole()`, `checkRole()`, `requireRole()`, `PermissionDeniedError`, `getDbForTenant()`, `testTenantIsolation()`, 20+ test factories, design system (shadcn/ui, Tailwind tokens, DM Sans), Socket.io real-time with `EventPublisher` + Redis pub/sub, BullMQ worker, `writeAuditLog()`, Pino logging, i18n (next-intl).

**Phase 2 (Sync):** FieldTypeRegistry with ~40 field types, canonical JSONB transform layer, Airtable adapter (toCanonical/fromCanonical), Notion adapter, bidirectional sync with conflict resolution, JSONB expression indexes for grid performance.

**Phase 3A-i (Grid View Core):** TanStack Table + TanStack Virtual grid shell, ~16 MVP field type cell renderers with edit modes, `DataGrid`, `GridCell`, `GridHeader`, keyboard navigation, windowed virtualization, column resize/reorder/freeze.

**Phase 3A-ii (View Features):** GridToolbar (sort/filter/group/color/hide-fields/view-switcher), SummaryFooter, BulkActionsToolbar, RecordView overlay (canvas, field renderer, tabs, config picker), CardView (3 layouts), SectionList, CsvImportWizard, field-level presence locking, realtime grid updates, ViewCreateDialog.

**Key existing files this phase consumes:**
- `packages/shared/auth/roles.ts` — `EffectiveRole`, `roleAtLeast()`, `ROLE_HIERARCHY`
- `packages/shared/auth/errors.ts` — `PermissionDeniedError` class
- `packages/shared/auth/check-role.ts` — `resolveEffectiveRole()`, `checkRole()`, `requireRole()`
- `packages/shared/auth/index.ts` — current barrel exports
- `packages/shared/db/schema/views.ts` — `views` table with `permissions` JSONB column (typed as `Record<string, unknown>`)
- `packages/shared/db/schema/fields.ts` — `fields` table with `permissions` JSONB column (typed as `Record<string, unknown>`)
- `apps/web/src/data/views.ts` — `getViewById()`, `getViewsByTable()`
- `apps/web/src/data/fields.ts` — `getFieldsByTable()`, `getFieldById()`
- `packages/shared/realtime/events.ts` — `REALTIME_EVENTS` constants (~25 events)
- `packages/shared/realtime/types.ts` — `PresenceState`, `RoomMember`, payload types
- `packages/shared/realtime/publisher.ts` — `EventPublisher` class, `publishEvent()`
- `apps/web/src/components/grid/DataGrid.tsx` — grid shell (already imports `roleAtLeast`)
- `apps/web/src/components/grid/GridCell.tsx` — cell renderer with `CellRendererProps`
- `apps/web/src/components/grid/GridHeader.tsx` — column headers (already imports `EffectiveRole`)
- `apps/web/src/components/grid/BulkActionsToolbar.tsx` — bulk actions toolbar
- `apps/web/src/actions/record-actions.ts` — `createRecord()`, `updateRecordField()`, `deleteRecord()`
- `apps/web/src/actions/view-actions.ts` — view CRUD, config updates
- `packages/shared/testing/factories.ts` — 20+ entity factories

### What This Phase Delivers

When complete, Admins and Managers can configure exactly which fields Team Members and Viewers see and edit per Table View. Permissions enforce instantly across Grid View, Record View, Card View, and cross-links via a 7-step resolution cascade with Redis caching and real-time invalidation. Hidden fields produce no DOM output. Read-only fields show no edit affordance. The permission configuration UI provides a role × field grid and individual override view.

### What This Phase Does NOT Build

- Portal client permissions (Phase 3E — Portals)
- App Designer portal permissions via `app_blocks.data_binding` (post-MVP)
- Sandbox/live environment permission isolation (post-MVP)
- SAML SSO / SCIM provisioning (post-MVP)
- Record-level permissions for internal users (not in model)
- Cross-link permission resolution (3B-i — depends on this phase)
- Permission-filtered Command Bar / SDS (3B-ii — depends on this phase)

### Architecture Patterns for This Phase

**Two-layer permission model:** Layer 1 = `fields.permissions` JSONB (global ceiling per field). Layer 2 = `views.permissions` JSONB (contextual overrides per view — role restrictions + individual overrides). Resolution chain restricts only, never expands.

**7-step resolution cascade:** (1) Structural filter — field in view's `field_overrides`? (2) Owner/Admin bypass → `read_write`. (3) Base role default. (4) Workspace role default. (5) View context check. (6a) Role restrictions narrow. (6b) Field ceiling check. (6c) Individual overrides restore up to ceiling. (7) Final state.

**Pure resolution engine:** The core resolution logic is a pure function with no I/O — all database/Redis interaction happens in the data layer wrapper. This makes the resolution engine fully unit-testable.

**Redis caching:** `cache:t:{tenantId}:perm:{viewId}:{userId}` with 300s TTL. Invalidation before real-time event publish (ordering guarantee).

**Permission denial pattern:** `PermissionDeniedError` (already exists in `packages/shared/auth/errors.ts`), audit log with 5-min dedup on `(user_id, action, resource, resource_id)`.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult when naming new functions, components, or UI labels.
`MANIFEST.md` is not needed during build execution.

### Subdivision Summary

This sub-phase is decomposed into 6 units per the subdivision doc (`docs/subdivisions/3a-iii-subdivision.md`):

| Unit | Name | Produces | Depends On |
|------|------|----------|------------|
| 1 | Permission Types & Resolution Engine | `FieldPermissionState`, `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride`, `FieldPermissionMap`, `ResolvedPermissionContext`, Zod schemas, `resolveFieldPermission()`, `resolveAllFieldPermissions()` | None |
| 2 | Data Layer — resolveFieldPermissions() + Redis Cache | `getFieldPermissions()`, `invalidatePermissionCache()`, cache key/TTL constants, `createTestViewWithPermissions()` factory | Unit 1 |
| 3 | Action Layer — Permission Enforcement + Audit Logging | `checkFieldPermission()`, `checkFieldPermissions()`, `filterHiddenFields()`, `logPermissionDenial()`, updated `updateRecord`/`bulkUpdateRecords` actions | Unit 2 |
| 4 | Real-Time Invalidation | `PERMISSION_UPDATED` event, `publishPermissionUpdate()`, client handler | Unit 2 |
| 5 | Grid/View Permission-Aware Rendering | `useFieldPermissions()` hook, `PermissionProvider`, updated DataGrid/GridCell/RecordView/CardView/BulkActionsToolbar | Units 1, 2, 4 |
| 6 | Permission Configuration UI | `RoleLevelPermissionGrid`, `IndividualOverrideView`, `PermissionConfigPanel`, `PermissionStateBadge`, permission server actions | Units 1, 2, 4, 5 |

### Skills for This Phase

Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — backend patterns (data access, actions, testing)
- `docs/skills/ux-ui/SKILL.md` — UI patterns (Units 5 and 6)
- `docs/skills/phase-context/SKILL.md` — Always.

---

## Section Index

| Prompt | Unit | Deliverable | Summary | Depends On | Lines (est.) |
|--------|------|-------------|---------|------------|--------------|
| 1 | 1 | Permission types, Zod schemas & barrel exports | FieldPermissionState, ViewPermissions, ViewFieldPermissions types and Zod validation schemas in packages/shared/auth/permissions/ | None | ~250 |
| 2 | 1 | 7-step resolution engine (pure functions) | resolveFieldPermission() and resolveAllFieldPermissions() — deterministic cascade with no I/O | 1 | ~300 |
| VP-1 | — | VERIFY — Completes Unit 1 | Contract verification for all Unit 1 exports; typecheck, lint, coverage gates | 1–2 | — |
| 3 | 2 | Data layer: getFieldPermissions() + Redis cache | I/O wrapper that loads views/fields/role, calls resolution engine, caches in Redis with 300s TTL | Unit 1 complete | ~300 |
| 4 | 2 | Test factory extension + integration tests | createTestViewWithPermissions() factory; round-trip, ceiling, tenant isolation, and cache integration tests | 3 | ~200 |
| VP-2 | — | VERIFY — Completes Unit 2 | Contract verification for getFieldPermissions(), invalidatePermissionCache(), factory | 3–4 | — |
| 5 | 3 | Permission enforcement guards + audit logging | checkFieldPermission(), filterHiddenFields(), logPermissionDenial() with 5-min Redis dedup | Unit 2 complete | ~250 |
| 6 | 3 | Integrate guards into record/bulk actions | Wire permission checks into updateRecordField, bulkUpdateRecords; strip hidden fields from query responses | 5 | ~200 |
| 7 | 4 | Real-time permission invalidation | PERMISSION_UPDATED event, publishPermissionUpdate() with cache-then-publish ordering, client handler | Unit 2 complete | ~200 |
| VP-3 | — | VERIFY — Completes Units 3 + 4 | Contract verification for enforcement guards, audit logging, and real-time events | 5–7 | — |
| 8 | 5 | Permission context provider + hooks | useFieldPermissions() TanStack Query hook, PermissionProvider context, usePermission() convenience hook | Units 1, 2, 4 complete | ~250 |
| 9 | 5 | Permission-aware Grid, Record View & Card View | Hidden fields produce no DOM; read-only cells block edit; bulk toolbar disables per permissions; i18n keys | 8 | ~350 |
| VP-4 | — | VERIFY — Completes Unit 5 | Contract verification for hooks, provider, and permission-aware rendering across all view types | 8–9 | — |
| 10 | 6 | Permission config panel + server actions | RoleLevelPermissionGrid, PermissionStateBadge, updateViewPermissions/updateFieldGlobalPermissions actions | Unit 5 complete | ~400 |
| 11 | 6 | Individual override view + i18n completion | IndividualOverrideView with person selector, effective state display, override toggles; full i18n (en + es) | 10 | ~300 |
| VP-5 | — | VERIFY — Completes Unit 6 (phase complete) | End-to-end pipeline verification: config change through cache invalidation to real-time grid re-render | 10–11 | — |

---

## — Unit 1: Permission Types & Resolution Engine —

### Unit Context

Defines the TypeScript types, Zod schemas, and pure resolution functions that every other unit imports. This is the contract layer — the shapes of permission data structures and the deterministic 7-step resolution algorithm with no I/O.

**Interface Contract:**
- **Produces:** `FieldPermissionState`, `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride`, `FieldPermissionMap`, `ResolvedPermissionContext`, `viewPermissionsSchema`, `fieldPermissionsSchema`, `resolveFieldPermission()`, `resolveAllFieldPermissions()` — all from `packages/shared/auth/permissions/`
- **Consumes:** `EffectiveRole`, `roleAtLeast()` from `packages/shared/auth/roles.ts`; `PermissionDeniedError` from `packages/shared/auth/errors.ts`

---

## Prompt 1: Permission Types, Zod Schemas & Barrel Exports

Builds the FieldPermissionState, ViewPermissions, ViewFieldPermissions, RoleRestriction, IndividualOverride, and ResolvedPermissionContext types plus Zod schemas in `packages/shared/auth/permissions/`. Creates types.ts, schemas.ts, and index.ts barrel. Relates to `permissions.md` Field-Level Permissions and Permission Storage sections.

**Unit:** 1
**Depends on:** None
**Load context:** `permissions.md` lines 121–179 (Field-Level Permissions — 3 states, defaults, two-layer model), `permissions.md` lines 203–274 (Permission Storage — ViewPermissions/ViewFieldPermissions interfaces, JSONB shapes), `permissions.md` lines 43–55 (Core Principles — 5 axioms)
**Target files:** `packages/shared/auth/permissions/types.ts`, `packages/shared/auth/permissions/schemas.ts`, `packages/shared/auth/permissions/index.ts`, `packages/shared/auth/index.ts` (update barrel)
**Migration required:** No
**Git:** Commit with message "feat(permissions): add field permission types and Zod schemas [Phase 3A-iii, Prompt 1]"

### Schema Snapshot

```
views: id (UUIDv7 PK), tenant_id, table_id, name, view_type (VARCHAR), config (JSONB), permissions (JSONB — ViewPermissions), is_shared, publish_state, environment, position, created_by, created_at, updated_at
fields: id (UUIDv7 PK), table_id, tenant_id, name, field_type (VARCHAR), config (JSONB), permissions (JSONB — Layer 1 global defaults), sort_order, environment, created_at, updated_at
```

### Task

Create the `packages/shared/auth/permissions/` directory with the type and schema definitions for the field-level permission model.

**In `types.ts`:**

1. Define `FieldPermissionState` as a type literal: `'read_write' | 'read_only' | 'hidden'`.

2. Define `RoleRestriction` interface matching the `views.permissions.fieldPermissions.roleRestrictions` array element shape from permissions.md § Permission Storage:
   ```typescript
   interface RoleRestriction {
     tableId: string;
     role: 'team_member' | 'viewer' | 'manager';
     fieldId: string;
     accessState: FieldPermissionState;
   }
   ```

3. Define `IndividualOverride` interface matching the `views.permissions.fieldPermissions.individualOverrides` array element shape:
   ```typescript
   interface IndividualOverride {
     tableId: string;
     userId: string;
     fieldId: string;
     accessState: FieldPermissionState;
   }
   ```

4. Define `ViewFieldPermissions` interface:
   ```typescript
   interface ViewFieldPermissions {
     roleRestrictions: RoleRestriction[];
     individualOverrides: IndividualOverride[];
   }
   ```

5. Define `ViewPermissions` interface:
   ```typescript
   interface ViewPermissions {
     roles: ('team_member' | 'viewer')[];
     specificUsers: string[];
     excludedUsers: string[];
     fieldPermissions: ViewFieldPermissions;
   }
   ```

6. Define `FieldPermissionMap` as `Map<string, FieldPermissionState>`.

7. Define `ResolvedPermissionContext` interface — the input for the resolution engine:
   ```typescript
   interface ResolvedPermissionContext {
     userId: string;
     effectiveRole: EffectiveRole;  // from packages/shared/auth/roles.ts
     tableId: string;
     viewId: string;
     fieldIds: string[];            // all field IDs for this table
     viewFieldOverrides: string[];  // field IDs exposed by the Table View's field_overrides
     viewPermissions: ViewPermissions; // from views.permissions JSONB
     fieldPermissions: Record<string, Record<string, unknown>>; // field ID → fields.permissions JSONB
   }
   ```

8. Import `EffectiveRole` from `../roles.ts`. Re-export `PermissionDeniedError` from `../errors.ts` in the permissions barrel.

**In `schemas.ts`:**

1. Create `fieldPermissionStateSchema` — Zod enum for the 3 states.

2. Create `roleRestrictionSchema` — Zod object matching `RoleRestriction`.

3. Create `individualOverrideSchema` — Zod object matching `IndividualOverride`.

4. Create `viewFieldPermissionsSchema` — Zod object matching `ViewFieldPermissions`.

5. Create `viewPermissionsSchema` — Zod object matching `ViewPermissions` with sensible defaults (empty arrays).

6. Create `fieldPermissionsSchema` — Zod object for the `fields.permissions` JSONB shape. Per permissions.md § Permission Storage, this includes global ceiling fields like `member_edit` (boolean), `portal_visible` (boolean), `portal_editable` (boolean). Define the schema with all fields optional (defaults to open):
   ```typescript
   const fieldPermissionsSchema = z.object({
     member_edit: z.boolean().default(true),
     viewer_visible: z.boolean().default(true),
     portal_visible: z.boolean().default(true),
     portal_editable: z.boolean().default(false),
   });
   ```

**In `index.ts`:** Barrel export all types, schemas, and (future) resolution functions.

**Update `packages/shared/auth/index.ts`:** Add re-exports from `./permissions/index.ts`.

### Acceptance Criteria

- [ ] `FieldPermissionState`, `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride`, `FieldPermissionMap`, `ResolvedPermissionContext` types are exported from `packages/shared/auth/permissions/types.ts`
- [ ] `viewPermissionsSchema` validates the ViewPermissions JSONB shape with Zod
- [ ] `fieldPermissionsSchema` validates the `fields.permissions` JSONB shape with Zod
- [ ] All schemas produce correct TypeScript types via `z.infer<>`
- [ ] Schemas handle missing fields gracefully (defaults to open/empty)
- [ ] `PermissionDeniedError` is re-exported from `packages/shared/auth/permissions/index.ts`
- [ ] `packages/shared/auth/index.ts` re-exports all permission types and schemas
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Resolution logic (Prompt 2)
- Data access layer (Unit 2)
- Redis caching (Unit 2)
- UI components (Units 5–6)
- Portal permission types (Phase 3E)

---

## Prompt 2: 7-Step Resolution Engine (Pure Functions)

Implements resolveFieldPermission() and resolveAllFieldPermissions() as zero-I/O pure functions in `packages/shared/auth/permissions/resolve.ts`. Covers the full 7-step cascade: structural filter, owner/admin bypass, base role default, field ceiling, role restriction, individual override, final state. Comprehensive unit tests in resolve.test.ts.

**Unit:** 1
**Depends on:** Prompt 1 (types and schemas)
**Load context:** `permissions.md` lines 278–339 (Permission Resolution at Runtime — 7-step cascade, full resolution), `permissions.md` lines 121–179 (Field-Level Permissions — defaults per role, narrowing semantics)
**Target files:** `packages/shared/auth/permissions/resolve.ts`, `packages/shared/auth/permissions/resolve.test.ts`, `packages/shared/auth/permissions/index.ts` (update barrel)
**Migration required:** No
**Git:** Commit with message "feat(permissions): implement 7-step field permission resolution engine [Phase 3A-iii, Prompt 2]"

### Schema Snapshot

N/A — no schema changes. Pure logic consuming types from Prompt 1.

### Task

Implement the deterministic, pure resolution functions in `packages/shared/auth/permissions/resolve.ts`. These functions have **zero I/O** — no database, no Redis, no imports from `data/` or `actions/`. They receive a `ResolvedPermissionContext` and return permission states.

**`resolveFieldPermission(fieldId: string, context: ResolvedPermissionContext): FieldPermissionState`**

Implement the 7-step cascade from permissions.md § Permission Resolution at Runtime (lines 286–308):

1. **Structural filter:** Is `fieldId` in `context.viewFieldOverrides`? If not → `'hidden'`. This reflects the Table View's `field_overrides` — fields not exposed structurally are invisible regardless of permission settings.

2. **Owner/Admin bypass:** If `roleAtLeast(context.effectiveRole, 'admin')` → return `'read_write'`. Owners and Admins always have full access. Short-circuit here.

3. **Base role default:** Determine the starting state from the user's workspace role:
   - `manager` → `'read_write'`
   - `team_member` → `'read_write'`
   - `viewer` → `'read_only'`

4. **Field global ceiling (Layer 1):** Check `context.fieldPermissions[fieldId]`:
   - If `member_edit === false` and role is `team_member` → narrow to `'read_only'` (cannot be overridden to `read_write`)
   - If `viewer_visible === false` and role is `viewer` → narrow to `'hidden'`
   - The ceiling sets the maximum access level for this field.

5. **Role restriction (Layer 2a):** Find matching entry in `context.viewPermissions.fieldPermissions.roleRestrictions` where `tableId` matches, `role` matches the user's workspace role, and `fieldId` matches. If found, apply `accessState` — but only if it narrows (never expands). Use a helper to compare permission states: `hidden < read_only < read_write`.

6. **Individual override (Layer 2b):** Find matching entry in `context.viewPermissions.fieldPermissions.individualOverrides` where `tableId` matches, `userId` matches, and `fieldId` matches. If found:
   - Can **restrict further** (narrow from current state)
   - Can **restore** up to the field ceiling from step 4 (but never beyond)
   - If the override's `accessState` exceeds the field ceiling, clamp to the ceiling

7. **Return** the final `FieldPermissionState`.

**`resolveAllFieldPermissions(context: ResolvedPermissionContext): FieldPermissionMap`**

Call `resolveFieldPermission()` for each field in `context.fieldIds`. Return a `Map<string, FieldPermissionState>` with all results.

**Helper: `comparePermissionStates(a, b): number`** — Returns negative if a < b, 0 if equal, positive if a > b. Ordering: `hidden` (0) < `read_only` (1) < `read_write` (2).

**Write comprehensive unit tests in `resolve.test.ts`:**

Test all 7 steps with edge cases:
- Field not in view field overrides → hidden
- Owner bypasses all restrictions → read_write
- Admin bypasses all restrictions → read_write
- Team Member default → read_write
- Viewer default → read_only
- Field ceiling `member_edit=false` narrows Team Member to read_only
- Field ceiling `viewer_visible=false` narrows Viewer to hidden
- Role restriction narrows (read_write → read_only)
- Role restriction cannot expand (viewer already read_only, restriction says read_write → stays read_only)
- Individual override further restricts (read_write → hidden)
- Individual override restores (hidden via role restriction → read_only via override, within ceiling)
- Individual override clamped by field ceiling (override says read_write, ceiling says read_only → read_only)
- Combined: role restriction + individual override + field ceiling interaction
- Batch resolution returns complete map
- Same inputs always produce same output (determinism test)
- Empty restrictions/overrides → role defaults apply

### Acceptance Criteria

- [ ] [CONTRACT] `resolveFieldPermission(fieldId, context): FieldPermissionState` exported from `packages/shared/auth/permissions/resolve.ts`
- [ ] [CONTRACT] `resolveAllFieldPermissions(context): FieldPermissionMap` exported from `packages/shared/auth/permissions/resolve.ts`
- [ ] Owner/Admin always returns `read_write` regardless of restrictions (short-circuit at step 2)
- [ ] Fields not exposed by Table View `field_overrides` resolve to `hidden` (step 1 — structural filter)
- [ ] Role-level restrictions can only narrow, never expand (step 5)
- [ ] Individual overrides can restore up to field ceiling but not beyond (step 6)
- [ ] Resolution is deterministic — same inputs always produce same output
- [ ] Unit tests cover all 7 steps with edge cases (≥15 test cases)
- [ ] All types and functions are pure (no I/O, no database, no Redis)
- [ ] Exports registered in `packages/shared/auth/permissions/index.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥90% on `resolve.ts`

### Do NOT Build

- Database queries or Redis caching (Unit 2)
- Server action integration (Unit 3)
- Real-time event handling (Unit 4)
- UI rendering changes (Unit 5)
- Permission configuration UI (Unit 6)

---

## VERIFY Session Boundary (after Prompts 1–2) — Completes Unit 1

**Scope:** Verify all work from Prompts 1–2 integrates correctly.
**Unit status:** Unit 1 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including new resolve.test.ts)
4. `pnpm turbo test -- --coverage` — thresholds met, resolve.ts ≥90%

**Interface contract check:**
- [ ] [CONTRACT] `FieldPermissionState` type exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `ViewPermissions` interface exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `ViewFieldPermissions` interface exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `RoleRestriction` interface exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `IndividualOverride` interface exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `FieldPermissionMap` type exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `ResolvedPermissionContext` interface exported from `packages/shared/auth/permissions/types.ts`
- [ ] [CONTRACT] `viewPermissionsSchema` Zod schema exported from `packages/shared/auth/permissions/schemas.ts`
- [ ] [CONTRACT] `fieldPermissionsSchema` Zod schema exported from `packages/shared/auth/permissions/schemas.ts`
- [ ] [CONTRACT] `resolveFieldPermission(fieldId, context): FieldPermissionState` exported from `packages/shared/auth/permissions/resolve.ts`
- [ ] [CONTRACT] `resolveAllFieldPermissions(context): FieldPermissionMap` exported from `packages/shared/auth/permissions/resolve.ts`
- [ ] [CONTRACT] `PermissionDeniedError` re-exported from `packages/shared/auth/permissions/index.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 1 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 1–2 [Phase 3A-iii, VP-1]", then push branch to origin.

Fix any failures before proceeding to Prompt 3.

---

## — Unit 2: Data Layer — resolveFieldPermissions() + Redis Cache —

### Unit Context

The I/O layer that loads permission data from Postgres, calls the pure resolution engine from Unit 1, and caches resolved permission maps in Redis with 300s TTL. This is the function every server-side consumer calls: `getFieldPermissions(tenantId, viewId, userId)`.

**Interface Contract:**
- **Produces:** `getFieldPermissions()`, `invalidatePermissionCache()`, `PERMISSION_CACHE_KEY_PATTERN`, `PERMISSION_CACHE_TTL`, `createTestViewWithPermissions()` factory
- **Consumes:** `resolveAllFieldPermissions()`, `FieldPermissionMap`, `ResolvedPermissionContext`, `ViewPermissions` from Unit 1; `getViewById()`, `getFieldsByTable()`, `resolveEffectiveRole()`, `getDbForTenant()`

---

## Prompt 3: Data Layer — getFieldPermissions() + Redis Cache

Creates `apps/web/src/data/permissions.ts` with the I/O wrapper that loads view, fields, and role from Postgres, calls the Unit 1 resolution engine, and caches resolved FieldPermissionMap in Redis at `cache:t:{tenantId}:perm:{viewId}:{userId}` with 300s TTL. Also provides invalidatePermissionCache() using Redis SCAN. Relates to `permissions.md` Permission Caching Strategy section.

**Unit:** 2
**Depends on:** Unit 1 complete (produces `resolveAllFieldPermissions()`, `ResolvedPermissionContext`, `ViewPermissions`, Zod schemas)
**Load context:** `permissions.md` lines 343–350 (Permission Caching Strategy — Redis key pattern, TTL, invalidation triggers), `permissions.md` lines 278–339 (Permission Resolution at Runtime — full context for resolution flow)
**Target files:** `apps/web/src/data/permissions.ts`, `apps/web/src/data/permissions.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(permissions): add getFieldPermissions data layer with Redis cache [Phase 3A-iii, Prompt 3]"

### Schema Snapshot

```
views: id, tenant_id, table_id, config (JSONB — includes field_overrides), permissions (JSONB — ViewPermissions), is_shared, created_by
fields: id, table_id, tenant_id, field_type, permissions (JSONB — global ceiling), sort_order
workspace_memberships: id, user_id, tenant_id, workspace_id, role
```

### Task

Create `apps/web/src/data/permissions.ts` with the data access layer for field permissions.

**Constants:**
```typescript
export const PERMISSION_CACHE_KEY_PATTERN = 'cache:t:{tenantId}:perm:{viewId}:{userId}';
export const PERMISSION_CACHE_TTL = 300; // seconds
```

**`getFieldPermissions(tenantId: string, viewId: string, userId: string): Promise<FieldPermissionMap>`**

1. Build the Redis cache key from the pattern (replace placeholders with actual values).
2. Check Redis for cached result. If cache hit, deserialize and return the `FieldPermissionMap` (stored as JSON: `Array<[string, FieldPermissionState]>`).
3. On cache miss:
   a. Load the view via `getViewById(tenantId, viewId)` — gets `permissions` JSONB and `table_id`.
   b. Load fields via `getFieldsByTable(tenantId, view.tableId)` — gets field IDs and `permissions` JSONB for each.
   c. Resolve the user's effective role via `resolveEffectiveRole(userId, tenantId, workspaceId)` (workspace ID comes from the view's table's workspace).
   d. Extract the view's `field_overrides` from `view.config` — these are the structurally visible field IDs.
   e. Build the `ResolvedPermissionContext` from the loaded data.
   f. Call `resolveAllFieldPermissions(context)` from Unit 1.
   g. Serialize the result and cache in Redis with TTL.
   h. Return the `FieldPermissionMap`.

**`invalidatePermissionCache(tenantId: string, viewId: string, userId?: string): Promise<void>`**

- If `userId` is provided: delete the specific cache key.
- If `userId` is omitted: use Redis SCAN with pattern `cache:t:{tenantId}:perm:{viewId}:*` to delete all user caches for that view. Do NOT use `KEYS` (blocks Redis).

**Write unit tests** covering:
- Cache hit returns cached map without DB queries (mock Redis to return cached data, verify DB functions not called)
- Cache miss triggers full resolution flow
- Cache key format is correct
- TTL is set to 300s
- `invalidatePermissionCache` with userId deletes specific key
- `invalidatePermissionCache` without userId scans and deletes all keys for that view
- Owner/Admin bypass is exercised through the resolution engine (no special data-layer logic — the data layer always calls `resolveAllFieldPermissions`)

### Acceptance Criteria

- [ ] `getFieldPermissions()` returns `FieldPermissionMap` for all fields in the view's table
- [ ] Redis cache hit returns cached map without database queries
- [ ] Redis cache miss triggers full resolution (load view, fields, role, resolve, cache)
- [ ] Cache key follows pattern `cache:t:{tenantId}:perm:{viewId}:{userId}`
- [ ] Cache TTL is 300 seconds
- [ ] `invalidatePermissionCache()` deletes specific user cache or all users for a view (SCAN, not KEYS)
- [ ] Owner/Admin bypass is exercised through the resolution engine (no special data-layer logic)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Audit logging on permission checks (Unit 3)
- Real-time invalidation event publishing (Unit 4)
- UI hooks or components (Units 5–6)
- Portal permission caching (Phase 3E)

---

## Prompt 4: Test Factory Extension + Integration Tests

Extends `packages/shared/testing/factories.ts` with createTestViewWithPermissions() and writes integration tests in `apps/web/src/data/permissions.integration.test.ts`. Tests cover full resolution round-trips, individual override ceiling clamping, tenant isolation, and Redis cache behavior.

**Unit:** 2
**Depends on:** Prompt 3 (data layer)
**Load context:** `permissions.md` lines 121–179 (Field-Level Permissions — defaults, two-layer model for test scenarios)
**Target files:** `packages/shared/testing/factories.ts` (extend), `apps/web/src/data/permissions.integration.test.ts`
**Migration required:** No
**Git:** Commit with message "test(permissions): add createTestViewWithPermissions factory and integration tests [Phase 3A-iii, Prompt 4]"

### Schema Snapshot

Same as Prompt 3 — `views`, `fields`, `workspace_memberships`.

### Task

**Extend `packages/shared/testing/factories.ts`:**

Add `createTestViewWithPermissions(overrides?)` factory that creates a view with pre-configured `permissions` JSONB. The factory should:
- Accept optional overrides for `ViewPermissions` shape
- Default to a view with no restrictions (empty `roleRestrictions` and `individualOverrides`)
- Create the parent table and fields if not provided
- Return the created view with its ID

**Write integration tests in `apps/web/src/data/permissions.integration.test.ts`:**

1. **Full resolution round-trip:** Create a view with permissions (role restriction: Team Member → field X read_only), create a Team Member user, call `getFieldPermissions()`, verify field X is `read_only` and other fields are `read_write`.

2. **Individual override restores access:** Create a view where a role restriction hides field Y from Team Members, then add an individual override restoring it to `read_only` for a specific user. Verify the override works.

3. **Field ceiling blocks override:** Set `fields.permissions.member_edit = false` on field Z. Add an individual override attempting to set it to `read_write`. Verify it's clamped to `read_only`.

4. **Tenant isolation test:** Use `testTenantIsolation()` — Tenant A's permissions not accessible from Tenant B's context. Create identical view IDs across two tenants, verify no cross-tenant data leakage.

5. **Cache behavior:** Call `getFieldPermissions()` twice for the same user/view, verify second call returns cached result (spy on DB functions).

### Acceptance Criteria

- [ ] [CONTRACT] `createTestViewWithPermissions(overrides?)` factory exported from `packages/shared/testing/factories.ts`
- [ ] Integration test: full resolution round-trip (create view with permissions, resolve, verify)
- [ ] Integration test: individual override restores access within ceiling
- [ ] Integration test: field ceiling blocks override beyond ceiling
- [ ] `testTenantIsolation()` test: Tenant A's permissions not accessible from Tenant B's context
- [ ] Cache round-trip test verifies second call uses cache
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Action layer enforcement (Unit 3)
- Real-time events (Unit 4)
- UI components (Units 5–6)

---

## VERIFY Session Boundary (after Prompts 3–4) — Completes Unit 2

**Scope:** Verify all work from Prompts 3–4 integrates correctly.
**Unit status:** Unit 2 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including new integration tests)
4. `pnpm turbo test -- --coverage` — thresholds met

**Interface contract check:**
- [ ] [CONTRACT] `getFieldPermissions(tenantId, viewId, userId): Promise<FieldPermissionMap>` exported from `apps/web/src/data/permissions.ts`
- [ ] [CONTRACT] `invalidatePermissionCache(tenantId, viewId, userId?): Promise<void>` exported from `apps/web/src/data/permissions.ts`
- [ ] [CONTRACT] `PERMISSION_CACHE_KEY_PATTERN` constant exported from `apps/web/src/data/permissions.ts`
- [ ] [CONTRACT] `PERMISSION_CACHE_TTL` constant exported from `apps/web/src/data/permissions.ts`
- [ ] [CONTRACT] `createTestViewWithPermissions(overrides?)` factory exported from `packages/shared/testing/factories.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 2 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 3–4 [Phase 3A-iii, VP-2]", then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## — Unit 3: Action Layer — Permission Enforcement + Audit Logging —

### Unit Context

Adds field-level permission checks to server actions that mutate records. When a user attempts to edit a read-only field or access a hidden field, the action rejects with `PermissionDeniedError` and logs the denial to `audit_log`.

**Interface Contract:**
- **Produces:** `checkFieldPermission()`, `checkFieldPermissions()`, `filterHiddenFields()`, `logPermissionDenial()`, updated `updateRecord`/`bulkUpdateRecords` actions
- **Consumes:** `getFieldPermissions()` from Unit 2; `FieldPermissionMap`, `FieldPermissionState`, `PermissionDeniedError` from Unit 1

---

## Prompt 5: Permission Enforcement Guards + Audit Logging

Creates `apps/web/src/lib/auth/field-permissions.ts` with checkFieldPermission(), checkFieldPermissions() (batch all-or-nothing), filterHiddenFields(), and logPermissionDenial() with Redis-based 5-minute dedup. Guards throw PermissionDeniedError and write to audit_log via writeAuditLog(). Relates to `permissions.md` Permission Denial Behavior section.

**Unit:** 3
**Depends on:** Unit 2 complete (produces `getFieldPermissions()`)
**Load context:** `permissions.md` lines 409–457 (Permission Denial Behavior — error shape, UI behavior, audit logging with dedup), `permissions.md` lines 354–369 (Permission Management Hierarchy — who can do what)
**Target files:** `apps/web/src/lib/auth/field-permissions.ts`, `apps/web/src/lib/auth/field-permissions.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(permissions): add field permission enforcement guards with audit logging [Phase 3A-iii, Prompt 5]"

### Schema Snapshot

```
audit_log: id, tenant_id, actor_type, actor_id, actor_label, action, entity_type, entity_id, details (JSONB), trace_id, ip_address, created_at
```

### Task

Create `apps/web/src/lib/auth/field-permissions.ts` with permission enforcement utilities.

**`checkFieldPermission(tenantId: string, viewId: string, userId: string, fieldId: string, requiredState: 'read_write' | 'read_only'): Promise<void>`**

1. Call `getFieldPermissions(tenantId, viewId, userId)` to get the resolved permission map.
2. Get the field's resolved state from the map.
3. If field is `'hidden'` → throw `PermissionDeniedError` with `action: 'read'`, `resource: 'field'`, `resourceId: fieldId`.
4. If field is `'read_only'` and `requiredState` is `'read_write'` → throw `PermissionDeniedError` with `action: 'edit'`, `resource: 'field'`, `resourceId: fieldId`.
5. On denial, call `logPermissionDenial()`.

**`checkFieldPermissions(tenantId: string, viewId: string, userId: string, fieldIds: string[], requiredState: 'read_write' | 'read_only'): Promise<void>`**

Batch check — all-or-nothing semantics. Load the permission map once, check all fields. If any field fails, throw `PermissionDeniedError` with a message indicating the count of denied fields (e.g., "You don't have permission to edit 3 of the selected fields"). Log once with all denied field IDs in details.

**`filterHiddenFields<T extends Record<string, unknown>>(record: T, permissionMap: FieldPermissionMap): T`**

Strip all keys from the record object where the corresponding field ID's permission is `'hidden'`. Return a new object (do not mutate). This is used to filter `canonical_data` before returning to the client.

**`logPermissionDenial(tenantId: string, userId: string, details: { action: string; resource: string; resourceId: string; fieldIds?: string[] }): Promise<void>`**

Write to `audit_log` via `writeAuditLog()` with:
- `actor_type: 'user'`, `actor_id: userId`
- `action: 'permission_denied'`
- `entity_type: details.resource`, `entity_id: details.resourceId`
- `details`: the full details object

**Deduplication:** Before writing, check if an identical `(actor_id, action, entity_type, entity_id)` entry exists within the last 5 minutes. If so, increment a `count` field in the existing entry's `details` JSONB instead of creating a new entry. Use a Redis key `dedup:perm:{tenantId}:{userId}:{resource}:{resourceId}` with 300s TTL for fast dedup checks (avoid querying audit_log on every denial).

**Write unit tests** covering:
- `checkFieldPermission` throws on hidden field access
- `checkFieldPermission` throws on read_only field when write required
- `checkFieldPermission` passes for sufficient permission
- `checkFieldPermissions` rejects entire batch if any field fails
- `checkFieldPermissions` includes count in error message
- `filterHiddenFields` strips hidden field keys
- `filterHiddenFields` preserves read_write and read_only fields
- `logPermissionDenial` writes to audit log
- Dedup: second identical denial within 5 min increments count

### Acceptance Criteria

- [ ] `checkFieldPermission()` throws `PermissionDeniedError` when user lacks required state
- [ ] `checkFieldPermissions()` rejects entire batch if any field fails (all-or-nothing)
- [ ] `checkFieldPermissions()` includes denied count in error message
- [ ] `filterHiddenFields()` strips all hidden field keys from record data
- [ ] `logPermissionDenial()` writes to `audit_log` with `action: 'permission_denied'`
- [ ] Audit dedup: same (userId, action, resource, resourceId) within 5 minutes uses Redis dedup key
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Integration into record actions (Prompt 6)
- Real-time events (Unit 4)
- UI rendering changes (Unit 5)
- Permission config mutations (Unit 6)

---

## Prompt 6: Integrate Permission Guards into Record & Bulk Actions

Wires permission checks into existing updateRecordField, updateRecord, and bulkUpdateRecords server actions in `apps/web/src/actions/record-actions.ts`. Adds filterHiddenFields() to record query responses in `apps/web/src/data/records.ts`. Adds viewId as a required parameter to actions needing permission context.

**Unit:** 3
**Depends on:** Prompt 5 (permission guards)
**Load context:** `permissions.md` lines 409–449 (Permission Denial Behavior — per-context UI behavior for hidden fields, read-only, disabled buttons, bulk actions)
**Target files:** `apps/web/src/actions/record-actions.ts` (update), `apps/web/src/actions/record-actions.test.ts` (update/create)
**Migration required:** No
**Git:** Commit with message "feat(permissions): integrate field permission checks into record actions [Phase 3A-iii, Prompt 6]"

### Schema Snapshot

N/A — no schema changes. Modifying existing server actions.

### Task

Update the existing record mutation actions in `apps/web/src/actions/record-actions.ts` to enforce field-level permissions.

**`updateRecordField` action:**

Before applying the mutation:
1. Extract the `viewId` from the action's context (the view context the user is operating in — add as a required parameter if not already present).
2. Call `checkFieldPermission(tenantId, viewId, userId, fieldId, 'read_write')`.
3. If the check passes, proceed with the existing mutation logic.
4. If it throws, the error propagates to the client via the global error boundary.

**`updateRecord` action (if it exists as a bulk-field update):**

Same pattern — check all fields being updated via `checkFieldPermissions(tenantId, viewId, userId, fieldIds, 'read_write')` before executing.

**`bulkUpdateRecords` action:**

1. Collect all unique field IDs across all records being updated.
2. Call `checkFieldPermissions(tenantId, viewId, userId, fieldIds, 'read_write')`.
3. All-or-nothing: if any field for any record fails, reject the entire batch.
4. On success, proceed with existing bulk update logic.

**Update record query responses:**

In `apps/web/src/data/records.ts` (or wherever records are returned to the client), add a step to call `filterHiddenFields(record.canonical_data, permissionMap)` before returning. Hidden fields are never sent to the client. This requires the `viewId` to be available in the query context.

**Write/update tests:**
- Write attempt on read-only field → `PermissionDeniedError`
- Read attempt on hidden field → field absent from response
- Bulk action with mixed permissions → entire batch rejected with count in error message
- Successful update when permissions are sufficient

### Acceptance Criteria

- [ ] [CONTRACT] `updateRecordField` action checks field permissions before applying mutation
- [ ] [CONTRACT] `bulkUpdateRecords` action checks all target fields for all records before executing
- [ ] Hidden fields are never returned in record query responses (stripped at data layer)
- [ ] Tests: write attempt on read-only field → 403 / PermissionDeniedError
- [ ] Tests: read attempt on hidden field → field absent from response
- [ ] Tests: bulk action with mixed permissions → entire batch rejected with count in error message
- [ ] `viewId` parameter added to actions that require permission context
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on changed files

### Do NOT Build

- Real-time invalidation (Unit 4)
- UI disabled states or visual indicators (Unit 5)
- Permission configuration mutations (Unit 6)
- Portal action permission checks (Phase 3E)

---

## — Unit 4: Real-Time Invalidation —

### Unit Context

When an Admin or Manager changes field permissions on a Table View, connected clients must receive updated permissions immediately. This unit registers the `PERMISSION_UPDATED` event type, publishes it on permission change, busts the Redis cache, and delivers the new permission map to affected clients via Socket.io.

**Interface Contract:**
- **Produces:** `REALTIME_EVENTS.PERMISSION_UPDATED`, `PermissionUpdatedPayload`, `publishPermissionUpdate()`, `handlePermissionUpdated` client handler
- **Consumes:** `invalidatePermissionCache()` from Unit 2; `EventPublisher`, `publishEvent()` from realtime layer

---

## Prompt 7: Real-Time Permission Invalidation

Registers PERMISSION_UPDATED in REALTIME_EVENTS, defines PermissionUpdatedPayload, and creates publishPermissionUpdate() in `apps/web/src/lib/realtime/permission-events.ts`. Cache invalidation completes before event publish (ordering guarantee). Client handler in permission-handlers.ts triggers TanStack Query invalidation for affected users. Relates to `permissions.md` Permission Caching Strategy and `realtime.md` room model.

**Unit:** 4
**Depends on:** Unit 2 complete (produces `invalidatePermissionCache()`)
**Load context:** `permissions.md` lines 343–350 (Permission Caching Strategy — invalidation triggers, `permission.updated` push), `realtime.md` lines 44–90 (Room model — event publishing pattern, channel naming)
**Target files:** `packages/shared/realtime/events.ts` (update), `packages/shared/realtime/types.ts` (update), `apps/web/src/lib/realtime/permission-events.ts`, `apps/web/src/lib/realtime/permission-handlers.ts`, `apps/web/src/lib/realtime/permission-events.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(permissions): add real-time permission invalidation events [Phase 3A-iii, Prompt 7]"

### Schema Snapshot

N/A — no schema changes. Extending real-time event system.

### Task

**Extend `packages/shared/realtime/events.ts`:**

Add `PERMISSION_UPDATED: 'permission.updated'` to the `REALTIME_EVENTS` constant object.

**Extend `packages/shared/realtime/types.ts`:**

Add `PermissionUpdatedPayload` interface:
```typescript
interface PermissionUpdatedPayload {
  tenantId: string;
  viewId: string;
  tableId: string;
  affectedUserIds?: string[]; // undefined = all users on this view
}
```

**Create `apps/web/src/lib/realtime/permission-events.ts`:**

`publishPermissionUpdate(tenantId: string, viewId: string, tableId: string, affectedUserIds?: string[]): Promise<void>`

1. **First:** Call `invalidatePermissionCache(tenantId, viewId)` — bust all user caches for this view (no specific userId since multiple users may be affected).
2. **Then:** Publish the event via `EventPublisher.publish()` on the workspace channel (the view's workspace determines the room). Use the pattern from existing realtime publisher.
3. **Ordering guarantee:** Cache invalidation MUST complete before event publish. Use `await` sequentially, not `Promise.all()`.

**Create `apps/web/src/lib/realtime/permission-handlers.ts`:**

`handlePermissionUpdated(payload: PermissionUpdatedPayload, currentUserId: string): void`

Client-side handler that:
1. Checks if `affectedUserIds` is undefined or includes `currentUserId`.
2. If affected, triggers a TanStack Query invalidation for the permission query key (the `useFieldPermissions` hook from Unit 5 will use this key).
3. The invalidation triggers a re-fetch of `getFieldPermissions()` which will get fresh data (cache was already busted server-side).

**Write tests:**
- `publishPermissionUpdate` calls `invalidatePermissionCache` then publishes event (verify order via spy call ordering)
- Event payload includes correct `tenantId`, `viewId`, `tableId`
- Cache is invalidated before event is published (ordering guarantee)
- Client handler triggers query invalidation when user is affected
- Client handler skips invalidation when user is not in `affectedUserIds`

### Acceptance Criteria

- [ ] [CONTRACT] `PERMISSION_UPDATED` event constant registered in `REALTIME_EVENTS`
- [ ] [CONTRACT] `PermissionUpdatedPayload` includes `tenantId`, `viewId`, `tableId`, and optional `affectedUserIds`
- [ ] [CONTRACT] `publishPermissionUpdate()` exported from `apps/web/src/lib/realtime/permission-events.ts`
- [ ] [CONTRACT] `handlePermissionUpdated` exported from `apps/web/src/lib/realtime/permission-handlers.ts`
- [ ] `publishPermissionUpdate()` calls `invalidatePermissionCache()` then publishes via Redis pub/sub
- [ ] Cache is invalidated before event is published (ordering guarantee verified in test)
- [ ] Client handler triggers permission re-fetch when user is affected
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- UI components that consume the handler (Unit 5)
- Permission config mutations that trigger the event (Unit 6)
- Portal real-time events (Phase 3E)

---

## VERIFY Session Boundary (after Prompts 5–7) — Completes Units 3 + 4

**Scope:** Verify all work from Prompts 5–7 integrates correctly.
**Unit status:** Units 3 and 4 complete — verify contracts.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met

**Interface contract check (Unit 3):**
- [ ] [CONTRACT] `checkFieldPermission()` exported from `apps/web/src/lib/auth/field-permissions.ts`
- [ ] [CONTRACT] `checkFieldPermissions()` exported from `apps/web/src/lib/auth/field-permissions.ts`
- [ ] [CONTRACT] `filterHiddenFields()` exported from `apps/web/src/lib/auth/field-permissions.ts`
- [ ] [CONTRACT] `logPermissionDenial()` exported from `apps/web/src/lib/auth/field-permissions.ts`
- [ ] [CONTRACT] `updateRecordField` action enforces field permissions
- [ ] [CONTRACT] `bulkUpdateRecords` action enforces field permissions

**Interface contract check (Unit 4):**
- [ ] [CONTRACT] `REALTIME_EVENTS.PERMISSION_UPDATED` registered
- [ ] [CONTRACT] `PermissionUpdatedPayload` type exported
- [ ] [CONTRACT] `publishPermissionUpdate()` exported
- [ ] [CONTRACT] `handlePermissionUpdated` handler exported

**State file updates:**
- Update TASK-STATUS.md: Unit 3 → `passed-review`, Unit 4 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 5–7 [Phase 3A-iii, VP-3]", then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## — Unit 5: Grid/View Permission-Aware Rendering —

### Unit Context

Makes Grid View, Record View, and Card View respect the resolved permission map. Hidden fields produce no DOM output. Read-only fields render without edit affordances. Action buttons that require higher permissions are visible but disabled with a tooltip. This is where permissions become visible to end users.

**Interface Contract:**
- **Produces:** `useFieldPermissions(viewId)` hook, `PermissionProvider` context, `usePermission(fieldId)` convenience hook, updated DataGrid/GridCell/RecordView/CardView/BulkActionsToolbar
- **Consumes:** `getFieldPermissions()` from Unit 2; `FieldPermissionMap`, `FieldPermissionState` from Unit 1; `handlePermissionUpdated` from Unit 4

---

## Prompt 8: Permission Context Provider + Hooks

Creates useFieldPermissions() TanStack Query hook and PermissionProvider React context in `apps/web/src/hooks/use-field-permissions.ts` and `apps/web/src/components/permissions/PermissionProvider.tsx`. Provider subscribes to PERMISSION_UPDATED Socket.io events for live re-fetch. usePermission() convenience hook returns hidden as safe default while loading.

**Unit:** 5
**Depends on:** Units 1, 2, 4 complete
**Load context:** `permissions.md` lines 121–179 (Field-Level Permissions — what each state means for rendering), `design-system.md` lines 224–237 (Component Specifications — shadcn/ui patterns)
**Target files:** `apps/web/src/hooks/use-field-permissions.ts`, `apps/web/src/components/permissions/PermissionProvider.tsx`, `apps/web/src/hooks/use-field-permissions.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(permissions): add PermissionProvider context and useFieldPermissions hook [Phase 3A-iii, Prompt 8]"

### Schema Snapshot

N/A — UI layer, no schema changes.

### Task

**Create `apps/web/src/hooks/use-field-permissions.ts`:**

`useFieldPermissions(viewId: string): { permissionMap: FieldPermissionMap; isLoading: boolean }`

1. Use TanStack Query (`useQuery`) to fetch the permission map. The query key should be `['permissions', tenantId, viewId, userId]` — enabling targeted invalidation from the real-time handler.
2. The query function calls a server-side endpoint or server action that returns the serialized `FieldPermissionMap` (since `getFieldPermissions()` is server-only).
3. Set `staleTime: 30_000` (30s — permissions don't change frequently) and `gcTime: 300_000` (5 min — matches Redis TTL).
4. Return `{ permissionMap, isLoading }`.

`usePermission(fieldId: string): FieldPermissionState`

Convenience hook that reads from the nearest `PermissionProvider` context and returns the state for a single field. Returns `'hidden'` if the provider has no data yet (safe default — hide until loaded).

**Create `apps/web/src/components/permissions/PermissionProvider.tsx`:**

React context provider that wraps view-level components. Provides:
- `permissionMap: FieldPermissionMap`
- `isLoading: boolean`
- `getPermission(fieldId: string): FieldPermissionState` helper

The provider internally calls `useFieldPermissions(viewId)` and passes the result through context.

**Real-time subscription:** Inside the provider, subscribe to the `PERMISSION_UPDATED` event via the existing Socket.io client. When received, call `handlePermissionUpdated()` which triggers TanStack Query invalidation → automatic re-fetch → React re-render with new permissions.

**Write tests:**
- `useFieldPermissions` returns loading state then permission map
- `usePermission` returns correct state for a given field
- `usePermission` returns `'hidden'` while loading
- Real-time event triggers re-fetch

### Acceptance Criteria

- [ ] [CONTRACT] `useFieldPermissions(viewId)` hook exported from `apps/web/src/hooks/use-field-permissions.ts`
- [ ] [CONTRACT] `PermissionProvider` exported from `apps/web/src/components/permissions/PermissionProvider.tsx`
- [ ] [CONTRACT] `usePermission(fieldId)` convenience hook exported from `apps/web/src/hooks/use-field-permissions.ts`
- [ ] Hook uses TanStack Query with appropriate staleTime/gcTime
- [ ] Provider subscribes to `PERMISSION_UPDATED` real-time event
- [ ] Real-time event triggers permission re-fetch via query invalidation
- [ ] `usePermission` returns `'hidden'` while loading (safe default)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Grid/RecordView/CardView integration (Prompt 9)
- Permission configuration UI (Unit 6)
- Portal permission context (Phase 3E)

---

## Prompt 9: Permission-Aware Grid, Record View & Card View

Updates DataGrid.tsx, GridCell.tsx, GridHeader.tsx, BulkActionsToolbar.tsx, RecordView, and CardView to consume PermissionProvider. Hidden fields produce no DOM output; read-only fields block edit mode with lock icon. Adds i18n keys for permission-related strings (en + es). Relates to `permissions.md` Permission Denial Behavior and `design-system.md` component patterns.

**Unit:** 5
**Depends on:** Prompt 8 (PermissionProvider + hooks)
**Load context:** `permissions.md` lines 409–449 (Permission Denial Behavior — UI behavior: hidden fields, read-only cells, disabled buttons), `design-system.md` lines 224–237 (Component Specifications — badges, inputs, disabled states)
**Target files:** `apps/web/src/components/grid/DataGrid.tsx` (update), `apps/web/src/components/grid/GridCell.tsx` (update), `apps/web/src/components/grid/GridHeader.tsx` (update), `apps/web/src/components/grid/BulkActionsToolbar.tsx` (update), `apps/web/src/components/record-view/RecordView.tsx` (update or equivalent), `apps/web/src/components/card-view/CardView.tsx` (update or equivalent), `apps/web/messages/en.json` (update), `apps/web/messages/es.json` (update)
**Migration required:** No
**Git:** Commit with message "feat(permissions): add permission-aware rendering to Grid, Record View & Card View [Phase 3A-iii, Prompt 9]"

### Schema Snapshot

N/A — UI changes only.

### Task

**Wrap view-level layouts with `PermissionProvider`:**

In the component that renders Grid/Record/Card views (likely a layout or page component), wrap the view content with `<PermissionProvider viewId={viewId}>`. This makes permission context available to all child components.

**Update `DataGrid.tsx`:**

1. Use `useFieldPermissions(viewId)` or read from `PermissionProvider` context.
2. Filter the column definitions: exclude columns where the field's permission is `'hidden'`. Hidden fields produce **no column, no cell, no empty placeholder** — the user's view looks complete.
3. Pass a `readOnly` prop to `GridCell` for fields with `'read_only'` state.
4. While permissions are loading, show the grid in its current state (don't block render).

**Update `GridCell.tsx`:**

1. Accept a `readOnly?: boolean` prop.
2. When `readOnly` is true:
   - Render the value normally (same display as read-write)
   - No edit cursor on hover (`cursor: default` instead of `cursor: text`)
   - Click does NOT enter edit mode
   - Add a subtle visual indicator: lock icon (🔒) or muted styling (e.g., `opacity-75` or a small lock icon in the cell corner). Follow the existing read-only cell pattern from 3A-i if one exists.

**Update `GridHeader.tsx`:**

Hidden columns are already excluded by DataGrid column filtering. For read-only columns, optionally show a lock icon next to the column name.

**Update `BulkActionsToolbar.tsx`:**

1. When the user selects records and triggers a bulk action, check if the user has `read_write` permission on the target fields.
2. If not, disable the action button and show a tooltip: "You don't have permission to edit these fields" (via i18n key).
3. The edit-field bulk action should only list fields the user can write.

**Update Record View:**

1. Use `PermissionProvider` context.
2. Hidden fields: do not render in the Record View canvas at all.
3. Read-only fields: render value but disable the field editor. Show a lock icon or "Read only" label.

**Update Card View:**

1. Use `PermissionProvider` context.
2. Hidden fields: do not render on the card.
3. Read-only fields: render normally (cards are typically read-only display already).

**Add i18n keys** in `en.json` and `es.json`:
- `permissions.readOnly`: "Read only" / "Solo lectura"
- `permissions.noEditPermission`: "You don't have permission to edit this field" / "No tienes permiso para editar este campo"
- `permissions.requiresRole`: "Requires {role} role" / "Requiere el rol de {role}"
- `permissions.bulkActionDenied`: "You don't have permission to edit {count} of the selected fields" / "No tienes permiso para editar {count} de los campos seleccionados"

### Acceptance Criteria

- [ ] Hidden fields produce no DOM output — no column, no cell, no empty placeholder, no "hidden" indicator
- [ ] Read-only fields render value but show no edit cursor on hover and no edit mode on click
- [ ] Read-only cells have visual indicator (lock icon or muted styling)
- [ ] Disabled action buttons show tooltip via i18n
- [ ] Bulk action toolbar disables actions when user lacks permission on target fields
- [ ] Record View hides hidden fields and marks read-only fields
- [ ] Card View hides hidden fields
- [ ] i18n keys added for all permission-related user-facing strings (en + es)
- [ ] No hardcoded English strings (`pnpm turbo check:i18n`)
- [ ] Component tests: grid renders correct column count with hidden fields filtered
- [ ] Component tests: read-only cell blocks edit interaction
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Permission configuration UI (Unit 6)
- Cross-link permission filtering (3B-i)
- Portal rendering adaptations (Phase 3E)
- Kanban/List/Gantt views (post-MVP)

---

## VERIFY Session Boundary (after Prompts 8–9) — Completes Unit 5

**Scope:** Verify all work from Prompts 8–9 integrates correctly.
**Unit status:** Unit 5 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. Manual verification: open Grid View as Team Member with a role restriction — verify hidden field not visible, read-only field not editable

**Interface contract check:**
- [ ] [CONTRACT] `useFieldPermissions(viewId)` hook exported from `apps/web/src/hooks/use-field-permissions.ts`
- [ ] [CONTRACT] `PermissionProvider` context exported from `apps/web/src/components/permissions/PermissionProvider.tsx`
- [ ] [CONTRACT] `usePermission(fieldId)` hook exported from `apps/web/src/hooks/use-field-permissions.ts`
- [ ] [CONTRACT] DataGrid filters hidden columns from rendered output
- [ ] [CONTRACT] GridCell supports read-only rendering mode
- [ ] [CONTRACT] RecordView hides hidden fields and marks read-only
- [ ] [CONTRACT] CardView hides hidden fields
- [ ] [CONTRACT] BulkActionsToolbar disables actions based on permissions

**State file updates:**
- Update TASK-STATUS.md: Unit 5 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 8–9 [Phase 3A-iii, VP-4]", then push branch to origin.

Fix any failures before proceeding to Prompt 10.

---

## — Unit 6: Permission Configuration UI —

### Unit Context

The admin-facing UI where Admins and Managers configure field permissions per Table View. Two views: (1) Role-Level Configuration — a field × role grid where each cell shows the effective state and click-to-cycle changes it; (2) Individual Override View — select a person, see their effective permissions after all layers, and toggle overrides. This is the last unit because it needs everything upstream.

**Interface Contract:**
- **Produces:** `RoleLevelPermissionGrid`, `IndividualOverrideView`, `PermissionConfigPanel`, `PermissionStateBadge`, `updateViewPermissions()` action, `updateFieldGlobalPermissions()` action, i18n keys
- **Consumes:** Types/schemas from Unit 1; `getFieldPermissions()`, `invalidatePermissionCache()` from Unit 2; `publishPermissionUpdate()` from Unit 4; `PermissionProvider`, `useFieldPermissions()` from Unit 5

---

## Prompt 10: Permission Config Panel + Role-Level Grid + Server Actions

Builds PermissionConfigPanel (tabbed container), RoleLevelPermissionGrid (field x role click-to-cycle matrix), and PermissionStateBadge in `apps/web/src/components/permissions/`. Creates updateViewPermissions() and updateFieldGlobalPermissions() server actions with role hierarchy enforcement, cache invalidation, and real-time event publish. Relates to `permissions.md` Permission Configuration UI and Permission Management Hierarchy sections.

**Unit:** 6
**Depends on:** Unit 5 complete
**Load context:** `permissions.md` lines 183–199 (Permission Configuration UI — role-level grid, individual override view, UX principle), `permissions.md` lines 354–369 (Permission Management Hierarchy — who can configure what), `permissions.md` lines 203–274 (Permission Storage — JSONB shape for mutations), `design-system.md` lines 296–307 (Progressive Disclosure — complexity levels)
**Target files:** `apps/web/src/components/permissions/PermissionConfigPanel.tsx`, `apps/web/src/components/permissions/RoleLevelPermissionGrid.tsx`, `apps/web/src/components/permissions/PermissionStateBadge.tsx`, `apps/web/src/actions/permission-actions.ts`, `apps/web/src/actions/permission-actions.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(permissions): add permission config panel with role-level grid and server actions [Phase 3A-iii, Prompt 10]"

### Schema Snapshot

```
views: id, tenant_id, table_id, permissions (JSONB — ViewPermissions: roles[], specificUsers[], excludedUsers[], fieldPermissions: { roleRestrictions[], individualOverrides[] })
fields: id, tenant_id, table_id, name, field_type, permissions (JSONB — { member_edit, viewer_visible, portal_visible, portal_editable })
```

### Task

**Create `apps/web/src/actions/permission-actions.ts`:**

`updateViewPermissions(tenantId: string, viewId: string, permissions: ViewPermissions): Promise<void>`

1. Validate input with `viewPermissionsSchema` (Zod).
2. Check role: only Manager+ can configure permissions. Use `resolveEffectiveRole()` + `roleAtLeast(role, 'manager')`. Throw `PermissionDeniedError` if insufficient.
3. Additional hierarchy check: Admin can configure Manager restrictions; Manager can only configure Team Member/Viewer restrictions. If a Manager tries to add a restriction for role `'manager'`, throw `PermissionDeniedError`.
4. Update `views.permissions` JSONB via `getDbForTenant('write')`.
5. Call `invalidatePermissionCache(tenantId, viewId)` — bust all user caches.
6. Call `publishPermissionUpdate(tenantId, viewId, tableId)` — notify connected clients.

`updateFieldGlobalPermissions(tenantId: string, fieldId: string, permissions: z.infer<typeof fieldPermissionsSchema>): Promise<void>`

1. Validate input with `fieldPermissionsSchema` (Zod).
2. Check role: only Admin+ can change global field permissions (field ceiling affects ALL views).
3. Update `fields.permissions` JSONB.
4. Invalidate permission caches for ALL views on this field's table (since global ceiling change affects every view). Use the field's `table_id` to find all views, then invalidate each.
5. Publish permission update for each affected view.

**Create `apps/web/src/components/permissions/PermissionStateBadge.tsx`:**

A small visual indicator component for the three permission states:
- `read_write`: green badge / checkmark icon — "Full access" label
- `read_only`: amber/yellow badge / eye icon — "Read only" label
- `hidden`: gray badge / eye-off icon — "Hidden" label

Use shadcn/ui `Badge` component with appropriate variant colors. All labels via i18n.

**Create `apps/web/src/components/permissions/RoleLevelPermissionGrid.tsx`:**

The field × role grid for configuring role-level restrictions.

Props: `viewId: string`, `tableId: string`, `tenantId: string`

1. Load fields for the table via existing data layer.
2. Load current `ViewPermissions` from the view.
3. Render a grid:
   - **Rows:** Field list (field name + type icon, left column)
   - **Columns:** One per applicable role (Team Member, Viewer; Manager column visible only if current user is Admin)
   - **Cells:** `PermissionStateBadge` showing the effective state for that field × role combination
4. **Click-to-cycle:** Clicking a cell cycles the state: `read_write` → `read_only` → `hidden` → `read_write`. Each click updates the `roleRestrictions` array in the local state.
5. **Bulk configuration:** A "Set all" dropdown per role column to set all fields to the same state at once.
6. **Save button:** Calls `updateViewPermissions()` with the modified permissions.
7. **Optimistic update:** Show the new state immediately, revert if save fails.

**Create `apps/web/src/components/permissions/PermissionConfigPanel.tsx`:**

Container component with tab switcher:
- Tab 1: "By Role" → `RoleLevelPermissionGrid`
- Tab 2: "By Person" → `IndividualOverrideView` (Prompt 11)

Use shadcn/ui `Tabs` component. The panel should be accessible from the Table View settings (e.g., a "Permissions" tab in the view settings dialog or a button in the GridToolbar overflow menu). Gate access to Manager+ via `roleAtLeast()`.

**Write tests for server actions:**
- `updateViewPermissions` validates with Zod schema
- `updateViewPermissions` rejects non-Manager users
- Manager cannot configure Manager restrictions (hierarchy check)
- Admin can configure Manager restrictions
- Permission change triggers cache invalidation + real-time event
- `updateFieldGlobalPermissions` rejects non-Admin users
- Global permission change invalidates all affected view caches

### Acceptance Criteria

- [ ] `RoleLevelPermissionGrid` renders field list × role columns (Team Member, Viewer, Manager if Admin)
- [ ] Each cell shows effective state via `PermissionStateBadge`
- [ ] Click-to-cycle changes state: read-write → read-only → hidden → read-write
- [ ] Bulk role configuration (set all fields for a role at once)
- [ ] `updateViewPermissions()` validates input with Zod schema, persists to `views.permissions` JSONB
- [ ] `updateFieldGlobalPermissions()` validates and persists to `fields.permissions` JSONB
- [ ] Both server actions call `invalidatePermissionCache()` + `publishPermissionUpdate()` after save
- [ ] Both server actions check role: only Manager+ can configure permissions
- [ ] Admin can configure Manager restrictions; Manager can configure Team Member/Viewer restrictions only
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new action files

### Do NOT Build

- Individual override view (Prompt 11)
- Portal permission configuration (Phase 3E)
- Sandbox/live permission staging (post-MVP)

---

## Prompt 11: Individual Override View + i18n Completion

Creates IndividualOverrideView in `apps/web/src/components/permissions/IndividualOverrideView.tsx` with person selector combobox, per-field effective permission display, and override toggle that enforces field ceiling clamping. Completes all permission-related i18n keys for config panel, state labels, override indicators, and person selector in en.json and es.json. Relates to `permissions.md` Two-Layer Restriction Model.

**Unit:** 6
**Depends on:** Prompt 10 (PermissionConfigPanel, server actions, PermissionStateBadge)
**Load context:** `permissions.md` lines 183–199 (Permission Configuration UI — individual override view, UX principle: always show actual result), `permissions.md` lines 148–166 (Two-Layer Restriction Model — how overrides work both directions)
**Target files:** `apps/web/src/components/permissions/IndividualOverrideView.tsx`, `apps/web/src/components/permissions/IndividualOverrideView.test.tsx`, `apps/web/messages/en.json` (update), `apps/web/messages/es.json` (update)
**Migration required:** No
**Git:** Commit with message "feat(permissions): add individual override view and complete permission config i18n [Phase 3A-iii, Prompt 11]"

### Schema Snapshot

Same as Prompt 10 — `views.permissions`, `fields.permissions`.

### Task

**Create `apps/web/src/components/permissions/IndividualOverrideView.tsx`:**

Props: `viewId: string`, `tableId: string`, `tenantId: string`

1. **Person selector:** Dropdown/combobox listing workspace members who have access to this Table View. Use the view's `permissions.specificUsers` and workspace members with matching roles. Show name + avatar + role badge.

2. **Effective permissions display:** When a person is selected, show a field list with their **effective** (final resolved) permission per field — the state they actually experience after all layers (role defaults + role restrictions + individual overrides + field ceiling).

3. **Override indicators:** Fields with active individual overrides are visually distinguished:
   - Badge showing "Override" next to the permission state
   - Different background color (e.g., light blue tint) for overridden fields
   - Tooltip showing the role-level state vs. the override state

4. **Override toggle:** Each field has a toggle/dropdown to set an individual override:
   - If no override exists: show the role-level effective state with an "Add override" action
   - If override exists: show the override state with options to change or remove
   - Override can go in both directions (further restrict OR restore)
   - Enforce: override cannot exceed the field ceiling (if field's global `member_edit=false`, cannot set to `read_write`)

5. **UX principle enforcement:** The Admin always sees the **actual effective result** per user. Never show raw restriction data that requires mental computation. Sarah is Team Member, role hides Budget, but she has override restoring it → Admin sees Budget visible for Sarah, marked as override.

6. **Save:** Individual override changes call `updateViewPermissions()` (same action as role grid — updates the `individualOverrides` array in `ViewPermissions`).

**Add remaining i18n keys** to both `en.json` and `es.json`:

Permission config panel:
- `permissions.config.title`: "Field Permissions" / "Permisos de campos"
- `permissions.config.byRole`: "By Role" / "Por rol"
- `permissions.config.byPerson`: "By Person" / "Por persona"
- `permissions.config.setAll`: "Set all" / "Establecer todos"
- `permissions.config.save`: "Save permissions" / "Guardar permisos"
- `permissions.config.saved`: "Permissions saved" / "Permisos guardados"

Permission states:
- `permissions.state.readWrite`: "Full access" / "Acceso completo"
- `permissions.state.readOnly`: "Read only" / "Solo lectura"
- `permissions.state.hidden`: "Hidden" / "Oculto"

Individual overrides:
- `permissions.override.label`: "Override" / "Excepción"
- `permissions.override.add`: "Add override" / "Agregar excepción"
- `permissions.override.remove`: "Remove override" / "Eliminar excepción"
- `permissions.override.roleLevelState`: "Role default: {state}" / "Rol por defecto: {state}"
- `permissions.override.ceilingBlocked`: "Cannot exceed field-level setting" / "No puede exceder la configuración a nivel de campo"

Person selector:
- `permissions.person.select`: "Select a person" / "Seleccionar una persona"
- `permissions.person.noAccess`: "No members have access to this view" / "Ningún miembro tiene acceso a esta vista"

**Write component tests:**
- Person selector lists view members
- Effective permissions display shows resolved state per field
- Override toggle adds override to `individualOverrides`
- Override toggle removes existing override
- Override clamped by field ceiling
- Fields with overrides show visual distinction
- Permission change round-trip: configure → save → reload → verify state

### Acceptance Criteria

- [ ] [CONTRACT] `IndividualOverrideView` exported from `apps/web/src/components/permissions/IndividualOverrideView.tsx`
- [ ] Person selector shows Table View's access roster with name + avatar + role
- [ ] Selected person shows effective permissions (final resolved state after all layers)
- [ ] Fields with active overrides visually distinguished (badge/highlight)
- [ ] Override toggle works both directions (further restrict OR restore)
- [ ] Override clamped by field ceiling — cannot exceed global field permission
- [ ] UX principle enforced: Admin sees actual effective result per user, never mentally computes
- [ ] i18n keys for all config UI strings (en + es)
- [ ] No hardcoded English strings (`pnpm turbo check:i18n`)
- [ ] Tests: permission change round-trip (configure → save → reload → verify state)
- [ ] Tests: role gating — Team Member cannot access permission config
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Portal field configuration (Phase 3E)
- Sandbox/live permission staging (post-MVP)
- SAML SSO / SCIM provisioning integration (post-MVP)

---

## VERIFY Session Boundary (after Prompts 10–11) — Completes Unit 6 (Phase Complete)

**Scope:** Verify all work from Prompts 10–11 integrates correctly. Final verification for Phase 3A-iii.
**Unit status:** Unit 6 complete — verify contract. Phase 3A-iii complete.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. Manual verification: open permission config as Admin — verify role grid renders, click-to-cycle works, individual override view shows effective state
7. Manual verification: end-to-end — configure a restriction, verify affected Team Member's grid hides the field in real-time

**Interface contract check (Unit 6):**
- [ ] [CONTRACT] `RoleLevelPermissionGrid` exported from `apps/web/src/components/permissions/RoleLevelPermissionGrid.tsx`
- [ ] [CONTRACT] `IndividualOverrideView` exported from `apps/web/src/components/permissions/IndividualOverrideView.tsx`
- [ ] [CONTRACT] `PermissionConfigPanel` exported from `apps/web/src/components/permissions/PermissionConfigPanel.tsx`
- [ ] [CONTRACT] `PermissionStateBadge` exported from `apps/web/src/components/permissions/PermissionStateBadge.tsx`
- [ ] [CONTRACT] `updateViewPermissions()` server action exported from `apps/web/src/actions/permission-actions.ts`
- [ ] [CONTRACT] `updateFieldGlobalPermissions()` server action exported from `apps/web/src/actions/permission-actions.ts`

**Cross-unit integration verification:**
- [ ] Permission change in config UI → cache invalidation → real-time event → client re-fetch → grid re-renders (full pipeline)
- [ ] Role restriction in config → Team Member grid hides field
- [ ] Individual override restore → specific user sees field restored
- [ ] Field ceiling blocks config UI from allowing override beyond ceiling

**State file updates:**
- Update TASK-STATUS.md: Unit 6 → `passed-review`
- Update MODIFICATIONS.md: append session block (full phase summary)

**Git:** Commit with message "chore(verify): verify prompts 10–11, phase 3A-iii complete [Phase 3A-iii, VP-5]", then push branch to origin.

Fix any failures before proceeding to Phase 3B-i.
