# Task Status

Checklist of subdivision units per sub-phase. Provides orientation for
every agent session — each session starts by reading this file to know
what's done, what's in progress, and what's blocked.

## How to Use This File

**Who writes:** Planner (creates initial checklist when subdivision docs
are produced), Build Agent (updates status during Step 3), Reviewer Agent
(updates status after Step 4 verdict), Docs Agent (marks docs-synced
after Step 5).
**Who reads:** All agents at session start.
**When to update:** At every status transition — when a unit moves from
pending to in-progress, from in-progress to review, from review to
passed/failed, and from passed to docs-synced.

### Status Values

| Status | Meaning | Set By |
|---|---|---|
| `pending` | Not yet started | Planner |
| `in-progress` | Build session active | Build Agent |
| `passed-review` | Review verdict: PASS | Reviewer Agent |
| `failed-review` | Review verdict: FAIL (needs retry) | Reviewer Agent |
| `blocked` | Waiting on a dependency or decision | Any agent |
| `docs-synced` | Step 5 complete, fully done | Docs Agent |

### Sub-Phase Block Format

```
## [Sub-Phase ID] — [Sub-Phase Name]

**Started:** YYYY-MM-DD
**Completed:** YYYY-MM-DD (or "In progress")

### Subdivision Units

- [ ] **Unit 1: [Name]** — `pending`
  - Produces: [interface contract — what this unit outputs]
  - Consumes: [what it needs from prior units, or "None — first unit"]
  - Branch: (filled when build starts)
  - Notes: (optional)

- [x] **Unit 2: [Name]** — `docs-synced`
  - Produces: [interface contract]
  - Consumes: Unit 1 outputs
  - Branch: `build/3a-unit-2-name`
  - Notes: Completed 2025-01-15

- [ ] **Unit 3: [Name]** — `blocked`
  - Produces: [interface contract]
  - Consumes: Unit 2 outputs
  - Branch:
  - Notes: Blocked on DECISIONS.md entry re: [topic]
```

### Completion Criteria

A sub-phase is complete when ALL units show `docs-synced` status.

### Handling Failed Reviews

When a unit moves to `failed-review`:

1. The Reviewer Agent adds the failure reason in Notes.
2. The Planner assesses whether sibling or downstream units need
   context adjustments (replanning).
3. The unit returns to `in-progress` when the Build Agent retries.
4. If a failure affects downstream units, those move to `blocked`
   with a note referencing the failed unit.

---

## Active Sub-Phases

### 3B-i — Cross-Linking Engine

**Started:** 2026-03-13
**Completed:** In progress

#### Subdivision Units

- [x] **Unit 1: Cross-Link Types, Validation Schemas & Registry** — `passed-review`
  - Produces: `RelationshipType`, `LinkScopeFilter`, `CrossLinkFieldValue`, `CROSS_LINK_LIMITS` types/constants; `createCrossLinkSchema`, `updateCrossLinkSchema`, `linkScopeFilterSchema` Zod schemas; `linked_record` FieldTypeRegistry registration; `extractCrossLinkField()`, `setCrossLinkField()` utilities — all from `packages/shared/sync/cross-link-*.ts`
  - Consumes: None — first unit. Uses existing `FieldTypeRegistry`, Drizzle schema types
  - Branch: `build/3b-i-cross-linking`
  - Notes:

- [ ] **Unit 2: Cross-Link Definition CRUD & Record Linking** — `in-progress`
  - Produces: `createCrossLinkDefinition`, `updateCrossLinkDefinition`, `deleteCrossLinkDefinition`, `linkRecords`, `unlinkRecords` server actions; `getCrossLinkDefinition`, `listCrossLinkDefinitions`, `getCrossLinksByTarget`, `validateLinkTarget`, `checkCrossLinkPermission` data functions; `createTestCrossLinkWithIndex` factory
  - Consumes: Unit 1 types, schemas, utilities
  - Branch:
  - Notes:

- [ ] **Unit 3: Query-Time Resolution & Permission Intersection** — `pending`
  - Produces: `resolveLinkedRecordsL0`, `resolveLinkedRecordsL1`, `resolveLinkedRecordsL2` resolution functions; `LinkedRecordTree` type; `resolveLinkedRecordPermissions`, `filterLinkedRecordByPermissions` permission functions — from `apps/web/src/data/cross-link-resolution.ts`
  - Consumes: Unit 1 types + utilities, Unit 2 `getCrossLinkDefinition()`
  - Branch:
  - Notes: Parallel with Units 4 and 5

- [ ] **Unit 4: Display Value Cascade & Scalability Infrastructure** — `pending`
  - Produces: `cross-link` BullMQ queue + job types; `processCrossLinkCascade`, `processIndexRebuild` processors; `enqueueCascadeJob`, `checkCascadeBackpressure` helpers; `scheduleIntegrityCheck` — from `apps/worker/src/processors/cross-link/`
  - Consumes: Unit 1 types + utilities, Unit 2 cross-link index data
  - Branch:
  - Notes: Parallel with Units 3 and 5

- [ ] **Unit 5: Link Picker UI** — `pending`
  - Produces: `LinkPicker`, `LinkPickerProvider`, `LinkedRecordChip`, `LinkPickerSearchResults`, `LinkPickerInlineCreate` components; `useLinkPicker` hook; `searchLinkableRecords`, `getRecentLinkedRecords` data functions — from `apps/web/src/components/cross-links/`
  - Consumes: Unit 1 types, Unit 2 CRUD actions, Unit 3 permission resolution
  - Branch:
  - Notes: Parallel with Units 3 and 4

---

## Completed Sub-Phases

### 3A-iii — Field-Level Permissions: Model, Resolution & Config UI

**Started:** 2026-03-12
**Completed:** 2026-03-13
**Docs synced:** 2026-03-13

#### Subdivision Units

- [x] **Unit 1: Permission Types & Resolution Engine** — `docs-synced`
  - Produces: `FieldPermissionState`, `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride`, `FieldPermissionMap`, `ResolvedPermissionContext` types; `viewPermissionsSchema`, `fieldPermissionsSchema` Zod schemas; `resolveFieldPermission()`, `resolveAllFieldPermissions()` pure functions — all from `packages/shared/auth/permissions/`
  - Consumes: None — first unit. Uses existing `EffectiveRole`, `roleAtLeast()` from `packages/shared/auth/`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 2: Data Layer — resolveFieldPermissions() + Redis Cache** — `docs-synced`
  - Produces: `getFieldPermissions()`, `invalidatePermissionCache()`, `PERMISSION_CACHE_KEY_PATTERN`, `PERMISSION_CACHE_TTL` from `apps/web/src/data/permissions.ts`; `createTestViewWithPermissions()` factory
  - Consumes: Unit 1 types + resolution functions
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 3: Action Layer — Permission Enforcement + Audit Logging** — `docs-synced`
  - Produces: `checkFieldPermission()`, `checkFieldPermissions()`, `filterHiddenFields()`, `logPermissionDenial()` from `apps/web/src/lib/auth/field-permissions.ts`; updated `updateRecord`, `bulkUpdateRecords` server actions
  - Consumes: Unit 1 types, Unit 2 `getFieldPermissions()`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 4: Real-Time Invalidation** — `docs-synced`
  - Produces: `REALTIME_EVENTS.PERMISSION_UPDATED`, `PermissionUpdatedPayload`, `publishPermissionUpdate()`, `handlePermissionUpdated` client handler
  - Consumes: Unit 2 `invalidatePermissionCache()`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 5: Grid/View Permission-Aware Rendering** — `docs-synced`
  - Produces: `useFieldPermissions()` hook, `PermissionProvider` context, `usePermission()` hook; updated `DataGrid`, `GridCell`, `RecordView`, `CardView`, `BulkActionsToolbar` with permission filtering
  - Consumes: Unit 1 types, Unit 2 `getFieldPermissions()`, Unit 4 `handlePermissionUpdated`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 6: Permission Configuration UI** — `docs-synced`
  - Produces: `RoleLevelPermissionGrid`, `IndividualOverrideView`, `PermissionConfigPanel`, `PermissionStateBadge` components; `updateViewPermissions()`, `updateFieldGlobalPermissions()` server actions
  - Consumes: Unit 1 types + schemas, Unit 2 data access + cache, Unit 4 `publishPermissionUpdate()`, Unit 5 `PermissionProvider`
  - Branch: `build/3a-iii-field-permissions`
