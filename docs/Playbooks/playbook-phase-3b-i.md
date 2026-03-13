# Phase 3B-i — Cross-Linking Engine

## Phase Context

### What Has Been Built

**Phase 1 (Foundation):** Monorepo (Turborepo + pnpm), 52-table Drizzle schema with RLS, Clerk auth with tenant resolution, `EffectiveRole` type (`owner|admin|manager|team_member|viewer`), `roleAtLeast()`, `resolveEffectiveRole()`, `checkRole()`, `requireRole()`, `PermissionDeniedError`, `getDbForTenant()`, `testTenantIsolation()`, 20+ test factories, design system (shadcn/ui, Tailwind tokens, DM Sans), Socket.io real-time with `EventPublisher` + Redis pub/sub, BullMQ worker with `BaseProcessor` + `jobWrapper`, `writeAuditLog()`, Pino logging, i18n (next-intl), `QUEUE_NAMES` constants, `QueueJobDataMap` type system.

**Phase 2 (Sync):** FieldTypeRegistry with ~40 field types, canonical JSONB transform layer, Airtable adapter (toCanonical/fromCanonical), Notion adapter, bidirectional sync with conflict resolution, JSONB expression indexes for grid performance, sync scheduler + inbound/outbound processors.

**Phase 3A-i (Grid View Core):** TanStack Table + TanStack Virtual grid shell, ~16 MVP field type cell renderers with edit modes (including Linked Record pill renderer), `DataGrid`, `GridCell`, `GridHeader`, keyboard navigation, windowed virtualization, column resize/reorder/freeze.

**Phase 3A-ii (View Features):** GridToolbar, SummaryFooter, BulkActionsToolbar, RecordView overlay (canvas, field renderer, tabs, config picker), CardView (3 layouts), SectionList, CsvImportWizard, field-level presence locking, realtime grid updates, ViewCreateDialog, InlineSubTable for Linked Record fields.

**Phase 3A-iii (Field-Level Permissions):** Permission types + resolution engine (`packages/shared/auth/permissions/`), data layer with Redis cache (`getFieldPermissions()`, `invalidatePermissionCache()`), action enforcement + audit logging (`checkFieldPermission()`), realtime invalidation (`PERMISSION_UPDATED` event), permission-aware Grid/RecordView/CardView rendering (`PermissionProvider`, `useFieldPermissions()`), Permission Config Panel.

**Key existing files this phase consumes:**
- `packages/shared/sync/field-registry.ts` — FieldTypeRegistry class and singleton
- `packages/shared/sync/types.ts` — `FieldTransform` interface
- `packages/shared/db/schema/cross-links.ts` — `crossLinks` Drizzle table, `CrossLink`, `NewCrossLink` types
- `packages/shared/db/schema/cross-link-index.ts` — `crossLinkIndex` Drizzle table, `CrossLinkIndex`, `NewCrossLinkIndex` types
- `packages/shared/db/schema/records.ts` — `records` table, `DbRecord` type, `canonicalData` JSONB
- `packages/shared/db/schema/fields.ts` — `fields` table, `Field` type
- `apps/web/src/data/cross-links.ts` — `getLinkedRecords()`, `getLinkedRecordCount()`, `LinkedRecordsResponse`
- `apps/web/src/actions/record-actions.ts` — server action pattern reference
- `packages/shared/auth/check-role.ts` — `resolveEffectiveRole()`, `checkRole()`, `requireRole()`
- `packages/shared/auth/permissions/resolve.ts` — `resolveFieldPermission()`, `resolveAllFieldPermissions()`
- `apps/web/src/data/permissions.ts` — `getFieldPermissions()`
- `packages/shared/queue/constants.ts` — `QUEUE_NAMES`
- `packages/shared/queue/types.ts` — `BaseJobData`, `QueueJobDataMap`
- `apps/worker/src/lib/base-processor.ts` — `BaseProcessor` class
- `apps/worker/src/queues.ts` — queue initialization
- `packages/shared/realtime/events.ts` — `REALTIME_EVENTS` constants
- `packages/shared/testing/factories.ts` — 20+ entity factories

### What This Phase Delivers

When complete, users can create cross-link definitions connecting any two tables within their tenant — across workspaces and platforms. Records can be linked and unlinked via a Link Picker with search, recent links, and inline record creation. Grid cells show denormalized display values (L0, zero-cost). Record View resolves full linked records (L1, single IN query). Document templates can traverse cross-links (L2, bounded iterative). Display values cascade automatically when target records change, with content hash optimization, batched processing, backpressure, and job deduplication. All operations enforce field-level permissions on target table fields via card_fields intersection.

### What This Phase Does NOT Build

- Impact Analysis — 3-tier consequence model, cascade visualization (Post-MVP — Core UX per GLOSSARY.md)
- Convert to Native Table — synced → native migration (Post-MVP — Core UX per GLOSSARY.md)
- Rollup fields across cross-links (Post-MVP — requires formula engine)
- Lookup fields from linked records (Post-MVP — requires formula engine)
- Multi-hop cascade propagation (Post-MVP — MVP uses single-hop rule)
- Workspace Map visualization (Post-MVP — Verticals & Advanced)
- AI-assisted impact summaries (Post-MVP)

### Architecture Patterns for This Phase

**Cross-link field value shape:** Stored in `records.canonical_data` keyed by `fields.id`, with `{ type: "cross_link", value: { linked_records: [...], cross_link_id: "uuid" } }`. Display values are denormalized — paid at write time, free at read time.

**Resolution levels:** L0 = grid (JSONB read, zero queries), L1 = Record View (single IN query), L2 = bounded iterative traversal (cycle-safe via visited set).

**Cascade architecture:** BullMQ job with content hash optimization (~70% skip rate). Single-hop rule — cascade events do NOT trigger further cascades. Per-tenant concurrency of 2. Batched in chunks of 500 with 10ms inter-chunk yield.

**Permission intersection:** `card_fields` (display preference ceiling) intersected with user's target table field permissions. Zero permitted fields → minimal `{ id, displayValue }` shape.

**Cross-tenant permanently forbidden (CP-002):** Three-layer enforcement — DB FK constraints, API validation, Link Picker scope. Never surface workspaces outside current tenant context.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult when naming new functions, components, or UI labels.
`MANIFEST.md` is not needed during build execution.

### Subdivision Summary

This sub-phase is decomposed into 5 units per the subdivision doc (`docs/subdivisions/3b-i-subdivision.md`):

| Unit | Name | Produces | Depends On |
|------|------|----------|------------|
| 1 | Cross-Link Types, Validation Schemas & Registry | `RelationshipType`, `RELATIONSHIP_TYPES`, `LinkScopeFilter`, `CrossLinkFieldValue`, `LinkedRecordEntry`, `CROSS_LINK_LIMITS`, Zod schemas (`createCrossLinkSchema`, `updateCrossLinkSchema`, `linkScopeFilterSchema`, `linkRecordsSchema`, `unlinkRecordsSchema`), `linked_record` FieldTypeRegistry registration, `extractCrossLinkField()`, `setCrossLinkField()` | None |
| 2 | Cross-Link Definition CRUD & Record Linking | `createCrossLinkDefinition()`, `updateCrossLinkDefinition()`, `deleteCrossLinkDefinition()`, `linkRecords()`, `unlinkRecords()`, `getCrossLinkDefinition()`, `listCrossLinkDefinitions()`, `getCrossLinksByTarget()`, `validateLinkTarget()`, `checkCrossLinkPermission()`, `createTestCrossLinkWithIndex()` factory | Unit 1 |
| 3 | Query-Time Resolution & Permission Intersection | `resolveLinkedRecordsL0()`, `resolveLinkedRecordsL1()`, `resolveLinkedRecordsL2()`, `LinkedRecordTree`, `resolveLinkedRecordPermissions()`, `filterLinkedRecordByPermissions()` | Unit 2 |
| 4 | Display Value Cascade & Scalability Infrastructure | `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData`, `QUEUE_NAMES['cross-link']`, `processCrossLinkCascade()`, `processIndexRebuild()`, `enqueueCascadeJob()`, `checkCascadeBackpressure()`, `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED`, `scheduleIntegrityCheck()` | Unit 2 |
| 5 | Link Picker UI | `LinkPicker`, `LinkPickerProvider`, `useLinkPicker()`, `LinkedRecordChip`, `LinkPickerSearchResults`, `LinkPickerInlineCreate`, `searchLinkableRecords()`, `getRecentLinkedRecords()` | Units 2, 3 |

### Skills for This Phase

Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — backend patterns (data access, actions, testing)
- `docs/skills/ux-ui/SKILL.md` — UI patterns (Unit 5)
- `docs/skills/phase-context/SKILL.md` — Always.

---

## Section Index

| Prompt | Unit | Deliverable | Depends On | Lines (est.) |
|--------|------|-------------|------------|--------------|
| 1 | 1 | Cross-link types, constants & canonical field value utilities | None | ~200 |
| 2 | 1 | Zod validation schemas & FieldTypeRegistry registration | 1 | ~200 |
| VP-1 | — | VERIFY — Completes Unit 1 | 1–2 | — |
| 3 | 2 | Cross-link data functions (read) + permission checks | Unit 1 complete | ~300 |
| 4 | 2 | Cross-link definition CRUD server actions | 3 | ~350 |
| 5 | 2 | Record link/unlink actions + index maintenance | 4 | ~350 |
| 6 | 2 | Test factory extension + integration tests | 5 | ~250 |
| VP-2 | — | VERIFY — Completes Unit 2 | 3–6 | — |
| 7 | 3 | L0/L1 resolution + permission intersection | Unit 2 complete | ~300 |
| 8 | 3 | L2 bounded traversal + circuit breaker | 7 | ~250 |
| VP-3 | — | VERIFY — Completes Unit 3 | 7–8 | — |
| 9 | 4 | Queue registration + cascade processor | Unit 2 complete | ~350 |
| 10 | 4 | Backpressure, dedup, integrity check & bulk deletion | 9 | ~300 |
| VP-4 | — | VERIFY — Completes Unit 4 | 9–10 | — |
| 11 | 5 | Link Picker core: search, recent, selection modes | Units 2, 3 complete | ~350 |
| 12 | 5 | Inline create, LinkedRecordChip, grid/RecordView integration | 11 | ~300 |
| VP-5 | — | VERIFY — Completes Unit 5 (phase complete) | 11–12 | — |

---

## — Unit 1: Cross-Link Types, Validation Schemas & Registry —

### Unit Context

Establishes the shared type vocabulary and validation layer that every other cross-linking unit imports. Registers the `linked_record` field type in the FieldTypeRegistry so the sync engine and grid can handle cross-link field values. This is the foundation layer — pure types, constants, Zod schemas, and a registry entry. No database I/O.

**Interface Contract:**
- **Produces:** `RelationshipType`, `RELATIONSHIP_TYPES`, `LinkScopeFilter`, `LinkScopeCondition`, `CrossLinkFieldValue`, `LinkedRecordEntry`, `CROSS_LINK_LIMITS`, `createCrossLinkSchema`, `updateCrossLinkSchema`, `linkScopeFilterSchema`, `linkRecordsSchema`, `unlinkRecordsSchema`, `linked_record` FieldTypeRegistry registration, `extractCrossLinkField()`, `setCrossLinkField()` — all from `packages/shared/sync/`
- **Consumes:** `FieldTypeRegistry` singleton from `packages/shared/sync/field-registry.ts`; `CrossLink`, `NewCrossLink`, `CrossLinkIndex`, `NewCrossLinkIndex` from `packages/shared/db/schema/`

---

## Prompt 1: Cross-Link Types, Constants & Canonical Field Value Utilities

**Unit:** 1
**Depends on:** None
**Load context:** `cross-linking.md` lines 47–130 (Data Model — cross_links table, cross_link_index, field value shape, card_fields, link_scope_filter), `cross-linking.md` lines 444–456 (Creation Constraints — limit constants)
**Target files:** `packages/shared/sync/cross-link-types.ts` (new)
**Migration required:** No

### Schema Snapshot

```
cross_links: id (UUID PK), tenant_id, name, source_table_id, source_field_id, target_table_id, target_display_field_id, relationship_type (VARCHAR), reverse_field_id (nullable), link_scope_filter (JSONB), card_fields (JSONB), max_links_per_record (INT default 50), max_depth (INT default 3), environment, created_by, created_at, updated_at
cross_link_index: tenant_id + cross_link_id + source_record_id + target_record_id (composite PK), source_table_id, created_at
```

### Task

Create `packages/shared/sync/cross-link-types.ts` with:

1. **`RelationshipType`** — type union `'many_to_one' | 'one_to_many'`.

2. **`RELATIONSHIP_TYPES`** — const object `{ MANY_TO_ONE: 'many_to_one', ONE_TO_MANY: 'one_to_many' } as const`.

3. **`LinkScopeCondition`** — type for a single scope filter condition: `{ field_id: string; operator: 'eq' | 'neq' | 'in' | 'not_in' | 'contains' | 'is_empty' | 'is_not_empty'; value?: unknown }`.

4. **`LinkScopeFilter`** — type for the scope filter JSONB shape: `{ conditions: LinkScopeCondition[]; logic: 'and' | 'or' }`.

5. **`LinkedRecordEntry`** — type for a single linked record in the canonical field value: `{ record_id: string; table_id: string; display_value: string; _display_updated_at: string }`.

6. **`CrossLinkFieldValue`** — type for the complete cross-link field value in canonical JSONB: `{ type: 'cross_link'; value: { linked_records: LinkedRecordEntry[]; cross_link_id: string } }`.

7. **`CROSS_LINK_LIMITS`** — const object with:
   - `MAX_LINKS_PER_RECORD: 500`
   - `DEFAULT_LINKS_PER_RECORD: 50`
   - `MAX_DEFINITIONS_PER_TABLE: 20`
   - `MAX_DEPTH: 5`
   - `DEFAULT_DEPTH: 3`
   - `CIRCUIT_BREAKER_THRESHOLD: 1000`

8. **`extractCrossLinkField(canonicalData: Record<string, unknown>, fieldId: string): CrossLinkFieldValue | null`** — utility that safely extracts and type-narrows a cross-link field value from canonical JSONB. Returns `null` if the field doesn't exist or isn't a cross-link type.

9. **`setCrossLinkField(canonicalData: Record<string, unknown>, fieldId: string, value: CrossLinkFieldValue): Record<string, unknown>`** — utility that returns a new canonical data object with the cross-link field value set. Does not mutate the input.

Export everything. Write unit tests in `packages/shared/sync/__tests__/cross-link-types.test.ts` covering:
- `extractCrossLinkField` returns correct shape from valid canonical JSONB
- `extractCrossLinkField` returns `null` for missing field, wrong type, malformed data
- `setCrossLinkField` merges correctly without mutating input
- `setCrossLinkField` overwrites existing cross-link field value

### Acceptance Criteria

- [ ] `RelationshipType`, `RELATIONSHIP_TYPES`, `LinkScopeFilter`, `LinkScopeCondition`, `CrossLinkFieldValue`, `LinkedRecordEntry`, `CROSS_LINK_LIMITS` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] `extractCrossLinkField` returns correct `CrossLinkFieldValue` from valid canonical JSONB or `null` for invalid/missing
- [ ] `setCrossLinkField` returns new object with merged field value, does not mutate input
- [ ] Unit tests pass for extraction and mutation edge cases
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Zod validation schemas (Prompt 2)
- FieldTypeRegistry registration (Prompt 2)
- Database queries or server actions
- Impact Analysis types (Post-MVP)

**Git:** Commit with message `feat(cross-link): add cross-link types, constants and canonical field utilities [Phase 3B-i, Prompt 1]`

---

## Prompt 2: Zod Validation Schemas & FieldTypeRegistry Registration

**Unit:** 1
**Depends on:** Prompt 1
**Load context:** `cross-linking.md` lines 47–130 (Data Model — link_scope_filter, card_fields), `cross-linking.md` lines 289–296 (Cross-Link + Sync Interaction — sync neutrality)
**Target files:** `packages/shared/sync/cross-link-schemas.ts` (new), `packages/shared/sync/cross-link-field-type.ts` (new)
**Migration required:** No

### Schema Snapshot

N/A — no schema changes. Reference existing `cross_links` columns for Zod validation targets.

### Task

**Part A: Zod Schemas** — Create `packages/shared/sync/cross-link-schemas.ts`:

1. **`linkScopeConditionSchema`** — validates a single scope filter condition. `operator` must be one of `eq|neq|in|not_in|contains|is_empty|is_not_empty`. `value` is optional (not required for `is_empty`/`is_not_empty`).

2. **`linkScopeFilterSchema`** — validates the full scope filter: `{ conditions: linkScopeConditionSchema[], logic: 'and' | 'or' }`. Conditions array can be empty (no filter).

3. **`createCrossLinkSchema`** — validates creation input:
   - `name` (string, 1–255 chars)
   - `sourceTableId` (uuid)
   - `sourceFieldId` (uuid)
   - `targetTableId` (uuid)
   - `targetDisplayFieldId` (uuid)
   - `relationshipType` (enum: `many_to_one | one_to_many`)
   - `reverseFieldId` (uuid, optional)
   - `linkScopeFilter` (optional, uses `linkScopeFilterSchema`)
   - `cardFields` (array of uuid strings, optional, default `[]`)
   - `maxLinksPerRecord` (integer, min 1, max `CROSS_LINK_LIMITS.MAX_LINKS_PER_RECORD`, optional, default `CROSS_LINK_LIMITS.DEFAULT_LINKS_PER_RECORD`)
   - `maxDepth` (integer, min 1, max `CROSS_LINK_LIMITS.MAX_DEPTH`, optional, default `CROSS_LINK_LIMITS.DEFAULT_DEPTH`)

4. **`updateCrossLinkSchema`** — validates update input. All fields optional except at least one must be provided. Same constraints as create for each field.

5. **`linkRecordsSchema`** — validates: `{ crossLinkId: uuid, sourceRecordId: uuid, targetRecordIds: uuid[] (1–500 items) }`.

6. **`unlinkRecordsSchema`** — validates: `{ crossLinkId: uuid, sourceRecordId: uuid, targetRecordIds: uuid[] (1–500 items) }`.

**Part B: FieldTypeRegistry Registration** — Create `packages/shared/sync/cross-link-field-type.ts`:

Register the `linked_record` field type in FieldTypeRegistry for the `canonical` platform with identity transform (canonical → canonical, no conversion needed since cross-links are EveryStack-native, not platform-synced). The `toCanonical` and `fromCanonical` transforms should validate the `CrossLinkFieldValue` shape and pass through.

Import and call the registration at module load so it auto-registers when imported.

**Tests:** Write unit tests in `packages/shared/sync/__tests__/cross-link-schemas.test.ts`:
- `createCrossLinkSchema` accepts valid input, rejects missing required fields, rejects invalid relationship types
- `linkScopeFilterSchema` validates correct operators, rejects invalid operators
- `linkRecordsSchema` rejects empty `targetRecordIds`, rejects >500 items
- `updateCrossLinkSchema` rejects when no fields provided
- Boundary values: `maxLinksPerRecord` at 0, 1, 500, 501; `maxDepth` at 0, 1, 5, 6

Write unit tests in `packages/shared/sync/__tests__/cross-link-field-type.test.ts`:
- `linked_record` field type registered in FieldTypeRegistry for `canonical` platform
- Identity transform: `toCanonical` passes through valid `CrossLinkFieldValue`
- `toCanonical` returns null/empty for invalid shapes

### Acceptance Criteria

- [ ] [CONTRACT] `createCrossLinkSchema` exported from `packages/shared/sync/cross-link-schemas.ts`
- [ ] [CONTRACT] `updateCrossLinkSchema` exported from `packages/shared/sync/cross-link-schemas.ts`
- [ ] [CONTRACT] `linkScopeFilterSchema` exported from `packages/shared/sync/cross-link-schemas.ts`
- [ ] [CONTRACT] `linkRecordsSchema`, `unlinkRecordsSchema` exported from `packages/shared/sync/cross-link-schemas.ts`
- [ ] [CONTRACT] `linked_record` field type registered in FieldTypeRegistry for `canonical` platform in `packages/shared/sync/cross-link-field-type.ts`
- [ ] Zod schemas validate correct inputs and reject invalid inputs (missing required fields, invalid relationship types, scope filter operator validation)
- [ ] Boundary tests pass for limit values (maxLinksPerRecord, maxDepth, targetRecordIds length)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Database queries or server actions (Unit 2)
- Platform-specific `linked_record` adapters for Airtable/Notion (cross-links are EveryStack-native)
- Impact Analysis schemas (Post-MVP)
- Convert to Native Table schemas (Post-MVP)

**Git:** Commit with message `feat(cross-link): add Zod schemas and FieldTypeRegistry registration for linked_record [Phase 3B-i, Prompt 2]`

---

## VERIFY Session Boundary (after Prompts 1–2) — Completes Unit 1

**Scope:** Verify all work from Prompts 1–2 integrates correctly.
**Unit status:** Unit 1 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: import `extractCrossLinkField`, `setCrossLinkField`, `createCrossLinkSchema`, `CROSS_LINK_LIMITS` from respective modules in a scratch file to confirm exports resolve

**Interface contract check:**
- [ ] [CONTRACT] `RelationshipType`, `RELATIONSHIP_TYPES` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `LinkScopeFilter`, `LinkScopeCondition` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `CrossLinkFieldValue`, `LinkedRecordEntry` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `CROSS_LINK_LIMITS` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `extractCrossLinkField`, `setCrossLinkField` exported from `packages/shared/sync/cross-link-types.ts`
- [ ] [CONTRACT] `createCrossLinkSchema`, `updateCrossLinkSchema`, `linkScopeFilterSchema`, `linkRecordsSchema`, `unlinkRecordsSchema` exported from `packages/shared/sync/cross-link-schemas.ts`
- [ ] [CONTRACT] `linked_record` field type registered in FieldTypeRegistry for `canonical` platform

**State file updates:**
- Update TASK-STATUS.md: Unit 1 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 1–2 [Phase 3B-i, VP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 3.

---

## — Unit 2: Cross-Link Definition CRUD & Record Linking —

### Unit Context

The operational core of cross-linking — server actions for creating, reading, updating, and deleting cross-link definitions, plus record-level link/unlink operations that maintain the `cross_link_index` and canonical JSONB field values. Includes creation constraint enforcement, permission checks, and audit logging. This unit touches both the data layer (`/data`) and action layer (`/actions`).

**Interface Contract:**
- **Produces:** `createCrossLinkDefinition()`, `updateCrossLinkDefinition()`, `deleteCrossLinkDefinition()`, `linkRecords()`, `unlinkRecords()` (server actions from `apps/web/src/actions/cross-link-actions.ts`); `getCrossLinkDefinition()`, `listCrossLinkDefinitions()`, `getCrossLinksByTarget()`, `validateLinkTarget()`, `checkCrossLinkPermission()` (data functions from `apps/web/src/data/cross-links.ts`); `createTestCrossLinkWithIndex()` (factory from `packages/shared/testing/factories.ts`)
- **Consumes:** All types and schemas from Unit 1; Drizzle tables from `packages/shared/db/schema/`; `getDbForTenant()`, `checkRole()`, `roleAtLeast()`, `writeAuditLog()`

---

## Prompt 3: Cross-Link Data Functions (Read) + Permission Checks

**Unit:** 2
**Depends on:** Unit 1 complete
**Load context:** `cross-linking.md` lines 47–130 (Data Model), `cross-linking.md` lines 444–456 (Creation Constraints), `cross-linking.md` lines 458–494 (Cross-Link Creation & Modification Permissions)
**Target files:** `apps/web/src/data/cross-links.ts` (extend existing)
**Migration required:** No

### Schema Snapshot

```
cross_links: id (UUID PK), tenant_id, name, source_table_id, source_field_id, target_table_id, target_display_field_id, relationship_type, reverse_field_id (nullable), link_scope_filter (JSONB), card_fields (JSONB), max_links_per_record (INT), max_depth (INT), environment, created_by, created_at, updated_at
cross_link_index: (tenant_id, cross_link_id, source_record_id, target_record_id) composite PK, source_table_id, created_at
```

### Task

Extend `apps/web/src/data/cross-links.ts` with these new data functions (keep existing `getLinkedRecords()` and `getLinkedRecordCount()` untouched):

1. **`getCrossLinkDefinition(tenantId: string, crossLinkId: string): Promise<CrossLink | null>`** — fetch a single cross-link definition by ID, tenant-scoped.

2. **`listCrossLinkDefinitions(tenantId: string, tableId: string): Promise<CrossLink[]>`** — list all cross-link definitions where `source_table_id = tableId`, ordered by `created_at`.

3. **`getCrossLinksByTarget(tenantId: string, targetTableId: string): Promise<CrossLink[]>`** — reverse lookup: all definitions pointing at `targetTableId`.

4. **`validateLinkTarget(tenantId: string, crossLinkId: string, targetRecordId: string): Promise<{ valid: boolean; reason?: string }>`** — validates:
   - Target record exists and belongs to correct target table
   - Target record is not archived/deleted
   - Scope filter passes (evaluate `link_scope_filter` conditions against target record's canonical data)
   - Same-record self-link blocked (compare source_record_id if provided)
   - Link count under `max_links_per_record` limit

5. **`checkCrossLinkPermission(tenantId: string, userId: string, sourceTableId: string, targetTableId: string, operation: 'create' | 'structural' | 'operational'): Promise<boolean>`** — permission check per cross-linking.md § Permissions:
   - `create` / `structural`: Must be Manager of both tables (same base), or Admin/Owner (cross-base)
   - `operational`: Must be Manager of either table
   - Uses `resolveEffectiveRole()` on both source and target table workspaces

Import `CROSS_LINK_LIMITS`, scope filter types, and validation utilities from Unit 1.

Write integration tests in `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extend existing):
- `getCrossLinkDefinition` returns correct definition, returns null for wrong tenant
- `listCrossLinkDefinitions` returns only definitions for specified table
- `getCrossLinksByTarget` returns reverse lookups correctly
- `validateLinkTarget` rejects archived records, scope filter violations, same-record self-links
- `checkCrossLinkPermission` enforces Manager/Admin/Owner rules per operation type
- `testTenantIsolation()` for all new data functions

### Acceptance Criteria

- [ ] [CONTRACT] `getCrossLinkDefinition(tenantId, crossLinkId)` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `listCrossLinkDefinitions(tenantId, tableId)` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `getCrossLinksByTarget(tenantId, targetTableId)` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `validateLinkTarget(tenantId, crossLinkId, targetRecordId)` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `checkCrossLinkPermission(tenantId, userId, sourceTableId, targetTableId, operation)` exported from `apps/web/src/data/cross-links.ts`
- [ ] Tenant isolation tests pass for all new data functions
- [ ] Permission check enforces Manager-of-both / Admin rules per operation type
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Server actions for CRUD (Prompt 4)
- Record linking/unlinking (Prompt 5)
- Display value cascade enqueue (Prompt 5 stubs, Unit 4 implements)
- Impact Analysis computation (Post-MVP)

**Git:** Commit with message `feat(cross-link): add data functions for definitions, validation and permission checks [Phase 3B-i, Prompt 3]`

---

## Prompt 4: Cross-Link Definition CRUD Server Actions

**Unit:** 2
**Depends on:** Prompt 3
**Load context:** `cross-linking.md` lines 47–130 (Data Model), `cross-linking.md` lines 444–456 (Creation Constraints), `cross-linking.md` lines 458–494 (Permissions), `cross-linking.md` lines 406–411 (Audit Log Condensation)
**Target files:** `apps/web/src/actions/cross-link-actions.ts` (new)
**Migration required:** No

### Schema Snapshot

```
cross_links: id (UUID PK), tenant_id, name, source_table_id, source_field_id, target_table_id, target_display_field_id, relationship_type, reverse_field_id (nullable), link_scope_filter (JSONB), card_fields (JSONB), max_links_per_record, max_depth, environment, created_by, created_at, updated_at
fields: id (UUID PK), tenant_id, table_id, name, field_type, config (JSONB), sort_order, environment, created_at
```

### Task

Create `apps/web/src/actions/cross-link-actions.ts` with definition CRUD server actions following the pattern in `apps/web/src/actions/record-actions.ts`:

1. **`createCrossLinkDefinition(input: z.infer<typeof createCrossLinkSchema>): Promise<CrossLink>`**
   - Validate input with `createCrossLinkSchema`
   - Check tenant boundary: both `sourceTableId` and `targetTableId` belong to calling user's tenant
   - Block same-record self-links: `sourceTableId === targetTableId && sourceFieldId === targetFieldId` is allowed (same-table self-links are allowed), but the same record cannot link to itself (enforced at link time, not definition time)
   - Enforce `MAX_DEFINITIONS_PER_TABLE` limit: count existing definitions for source table
   - Check permission via `checkCrossLinkPermission(tenantId, userId, sourceTableId, targetTableId, 'create')`
   - Create reverse field on target table if `reverseFieldId` requested: insert a new field with `field_type: 'linked_record'` on the target table, reference back to source
   - Insert `cross_links` row
   - Write audit log: `action: 'cross_link.created'`
   - Return the created `CrossLink`

2. **`updateCrossLinkDefinition(id: string, input: z.infer<typeof updateCrossLinkSchema>): Promise<CrossLink>`**
   - Validate input with `updateCrossLinkSchema`
   - Fetch existing definition, verify tenant ownership
   - Determine if change is structural or operational per cross-linking.md § Structural vs Operational:
     - Structural: `targetTableId`, `relationshipType`, `reverseFieldId` changes → requires `structural` permission
     - Operational: `name`, `linkScopeFilter`, `targetDisplayFieldId`, `cardFields`, `maxLinksPerRecord`, `maxDepth` changes → requires `operational` permission
   - Check appropriate permission
   - Update the row
   - Write audit log: `action: 'cross_link.updated'` with `changes` detail
   - Return updated `CrossLink`

3. **`deleteCrossLinkDefinition(id: string): Promise<void>`**
   - Fetch definition, verify tenant ownership
   - Check `structural` permission
   - Delete all `cross_link_index` entries for this definition (cascade handled by FK `onDelete: 'cascade'` on schema)
   - Clear canonical field values: update all source records' `canonical_data` to remove the cross-link field value for `sourceFieldId`
   - If `reverseFieldId` exists, delete the reverse field
   - Delete the `cross_links` row
   - Write audit log: `action: 'cross_link.deleted'`

All actions extract `tenantId` and `userId` from Clerk session context (same pattern as `record-actions.ts`).

Write unit tests in `apps/web/src/actions/__tests__/cross-link-actions.test.ts`:
- Create succeeds with valid input, creates reverse field when requested
- Create blocked by `MAX_DEFINITIONS_PER_TABLE` limit
- Create blocked by permission denial (non-Manager on both tables)
- Update distinguishes structural vs operational permission checks
- Delete cascades: removes index entries, clears canonical field values, removes reverse field

### Acceptance Criteria

- [ ] [CONTRACT] `createCrossLinkDefinition(input)` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `updateCrossLinkDefinition(id, input)` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `deleteCrossLinkDefinition(id)` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] `createCrossLinkDefinition` respects `MAX_DEFINITIONS_PER_TABLE` limit and writes audit log
- [ ] `createCrossLinkDefinition` enforces permission rules: Manager of both tables for same-base, Admin/Owner for cross-base
- [ ] `updateCrossLinkDefinition` distinguishes structural vs. operational changes per permission rules
- [ ] `deleteCrossLinkDefinition` cascades: removes index entries, clears canonical field values, writes audit log
- [ ] All actions validate tenant boundary (cross-tenant permanently forbidden per CP-002)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Record linking/unlinking (Prompt 5)
- Display value cascade on delete (Unit 4)
- Cross-boundary deletion approval workflow (Post-MVP — notification to Admin/Owner)
- Impact Analysis modal on delete (Post-MVP)

**Git:** Commit with message `feat(cross-link): add cross-link definition CRUD server actions [Phase 3B-i, Prompt 4]`

---

## Prompt 5: Record Link/Unlink Actions + Index Maintenance

**Unit:** 2
**Depends on:** Prompt 4
**Load context:** `cross-linking.md` lines 47–130 (Data Model — cross_link_index, field value shape), `cross-linking.md` lines 444–456 (Creation Constraints — max links, cycle detection)
**Target files:** `apps/web/src/actions/cross-link-actions.ts` (extend), `apps/web/src/lib/cross-link-cascade.ts` (new — stub)
**Migration required:** No

### Schema Snapshot

```
cross_link_index: (tenant_id, cross_link_id, source_record_id, target_record_id) composite PK, source_table_id, created_at
records: id (UUID PK), tenant_id, table_id, canonical_data (JSONB), archived_at, created_at, updated_at
```

### Task

Add to `apps/web/src/actions/cross-link-actions.ts`:

1. **`linkRecords(input: z.infer<typeof linkRecordsSchema>): Promise<void>`**
   - Validate input with `linkRecordsSchema`
   - Fetch the cross-link definition, verify tenant ownership
   - For each target record ID:
     - Validate via `validateLinkTarget()` (scope filter, existence, not same record)
     - Check current link count against `max_links_per_record`
   - Insert `cross_link_index` entries (one per target record). Use batch insert for efficiency. Skip duplicates (ON CONFLICT DO NOTHING on composite PK).
   - Update source record's `canonical_data` using `setCrossLinkField()`:
     - Read existing cross-link field value (or initialize empty)
     - Append new `LinkedRecordEntry` items (with `display_value` fetched from target record's display field, `_display_updated_at` set to now)
     - Write updated canonical data back
   - Enqueue display value cascade job (stub for now — create `apps/web/src/lib/cross-link-cascade.ts` with `enqueueCascadeJob()` as a no-op stub with `// TODO: Unit 4 — implement cascade processor`)
   - Write audit log: `action: 'cross_link.records_linked'` with `record_ids` array (condensed per audit patterns)

2. **`unlinkRecords(input: z.infer<typeof unlinkRecordsSchema>): Promise<void>`**
   - Validate input
   - Delete `cross_link_index` entries for the specified pairs
   - Update source record's `canonical_data`: remove unlinked entries from `linked_records` array
   - Enqueue display value cascade job (stub)
   - Write audit log: `action: 'cross_link.records_unlinked'`

**Cycle detection note:** Cycles are allowed at the definition and linking level. Detection happens at query time in the resolver (Unit 3) via `visited` set with bounded iteration. No cycle blocking at link time.

Create `apps/web/src/lib/cross-link-cascade.ts` as a stub module:
```typescript
export async function enqueueCascadeJob(
  tenantId: string,
  targetRecordId: string,
  priority: 'high' | 'low',
): Promise<void> {
  // TODO: Unit 4 — implement BullMQ cascade processor
}
```

Write integration tests:
- `linkRecords` creates index entries and updates canonical JSONB correctly
- `linkRecords` respects `max_links_per_record` limit
- `linkRecords` rejects invalid targets (archived, wrong table, scope filter violation)
- `linkRecords` skips duplicate links (ON CONFLICT DO NOTHING)
- `unlinkRecords` removes index entries and updates canonical JSONB
- Link/unlink audit log entries created

### Acceptance Criteria

- [ ] [CONTRACT] `linkRecords(input)` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `unlinkRecords(input)` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] `linkRecords` validates scope filter, respects `max_links_per_record`, writes index entries, updates canonical JSONB
- [ ] `unlinkRecords` removes index entries, updates canonical JSONB
- [ ] Cycle detection allows cycles (not blocked at link time — bounded at query time)
- [ ] Audit log entries use condensed pattern: one entry with `record_ids` array
- [ ] `enqueueCascadeJob` stub exists in `apps/web/src/lib/cross-link-cascade.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Cascade processor implementation (Unit 4)
- Link Picker UI (Unit 5)
- Bulk deletion cascade (Unit 4)
- Display value ordering guard (Unit 4)

**Git:** Commit with message `feat(cross-link): add record link/unlink actions with index maintenance [Phase 3B-i, Prompt 5]`

---

## Prompt 6: Test Factory Extension + Integration Tests

**Unit:** 2
**Depends on:** Prompt 5
**Load context:** `cross-linking.md` lines 47–130 (Data Model — for test fixture shapes)
**Target files:** `packages/shared/testing/factories.ts` (extend), `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extend)
**Migration required:** No

### Schema Snapshot

N/A — no schema changes.

### Task

1. **Extend `packages/shared/testing/factories.ts`** with `createTestCrossLinkWithIndex(overrides?)`:
   - Creates a complete cross-link test fixture: cross-link definition + source/target records + index entries + canonical field values on source records
   - Accepts overrides for definition fields, record count, links per record
   - Returns `{ crossLink, sourceRecords, targetRecords, indexEntries }`
   - Uses existing `createTestCrossLink` and `createTestRecord` factories internally

2. **Comprehensive integration tests** — extend `apps/web/src/data/__tests__/cross-links.integration.test.ts`:
   - End-to-end: create definition → link records → verify index entries → verify canonical JSONB → unlink → verify cleanup
   - `getCrossLinkDefinition` tenant isolation via `testTenantIsolation()`
   - `listCrossLinkDefinitions` returns only definitions for specified table
   - `getCrossLinksByTarget` returns correct reverse lookups
   - `validateLinkTarget` comprehensive edge cases: archived record, wrong table, scope filter with multiple conditions, at-limit link count
   - Permission tests: Manager creates same-base link (passes), Team Member denied (fails), Admin creates cross-base link (passes)
   - Create definition → delete definition → verify index entries cascaded, canonical data cleaned
   - Link records → verify display values populated from target record's display field
   - Max definitions per table enforcement

### Acceptance Criteria

- [ ] [CONTRACT] `createTestCrossLinkWithIndex(overrides?)` exported from `packages/shared/testing/factories.ts`
- [ ] Integration tests cover full lifecycle: create → link → read → unlink → delete
- [ ] Tenant isolation tests pass for `getCrossLinkDefinition`, `listCrossLinkDefinitions`, `getCrossLinksByTarget`
- [ ] Permission integration tests verify Manager/Admin role enforcement
- [ ] Constraint tests verify `MAX_DEFINITIONS_PER_TABLE`, `max_links_per_record` limits
- [ ] All tests use factories, not raw inserts
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on changed files

### Do NOT Build

- Resolution functions (Unit 3)
- Cascade processor (Unit 4)
- UI components (Unit 5)
- Performance benchmarks (documented thresholds, not tested here)

**Git:** Commit with message `test(cross-link): add cross-link factory and comprehensive integration tests [Phase 3B-i, Prompt 6]`

---

## VERIFY Session Boundary (after Prompts 3–6) — Completes Unit 2

**Scope:** Verify all work from Prompts 3–6 integrates correctly.
**Unit status:** Unit 2 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: call `createCrossLinkDefinition` with test data to confirm round-trip CRUD works

**Interface contract check:**
- [ ] [CONTRACT] `createCrossLinkDefinition()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `updateCrossLinkDefinition()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `deleteCrossLinkDefinition()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `linkRecords()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `unlinkRecords()` exported from `apps/web/src/actions/cross-link-actions.ts`
- [ ] [CONTRACT] `getCrossLinkDefinition()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `listCrossLinkDefinitions()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `getCrossLinksByTarget()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `validateLinkTarget()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `checkCrossLinkPermission()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `createTestCrossLinkWithIndex()` exported from `packages/shared/testing/factories.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 2 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 3–6 [Phase 3B-i, VP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 7.

---

## — Unit 3: Query-Time Resolution & Permission Intersection —

### Unit Context

The read path for cross-linked records. Level 0 serves grid cells (zero-cost — reads denormalized display values from canonical JSONB). Level 1 serves Record View (single IN query for full linked records). Level 2 serves cross-link traversal features like merge-tag resolution in document templates. Permission intersection ensures users only see target record fields they're authorized for.

**Interface Contract:**
- **Produces:** `resolveLinkedRecordsL0()`, `resolveLinkedRecordsL1()`, `resolveLinkedRecordsL2()`, `LinkedRecordTree`, `resolveLinkedRecordPermissions()`, `filterLinkedRecordByPermissions()` — all from `apps/web/src/data/cross-link-resolution.ts`
- **Consumes:** `CrossLinkFieldValue`, `extractCrossLinkField`, `CROSS_LINK_LIMITS` from Unit 1; `getCrossLinkDefinition` from Unit 2; `getFieldPermissions` from `apps/web/src/data/permissions.ts`

---

## Prompt 7: L0/L1 Resolution + Permission Intersection

**Unit:** 3
**Depends on:** Unit 2 complete
**Load context:** `cross-linking.md` lines 132–235 (Query-Time Resolution — L0/L1/L2 patterns, depth limiting, permission intersection, performance targets)
**Target files:** `apps/web/src/data/cross-link-resolution.ts` (new)
**Migration required:** No

### Schema Snapshot

```
records: id (UUID PK), tenant_id, table_id, canonical_data (JSONB), archived_at
cross_link_index: (tenant_id, cross_link_id, source_record_id, target_record_id) composite PK, source_table_id, created_at
cross_links: id, tenant_id, source_field_id, target_table_id, target_display_field_id, card_fields (JSONB), max_depth
```

### Task

Create `apps/web/src/data/cross-link-resolution.ts`:

1. **`resolveLinkedRecordsL0(canonicalData: Record<string, unknown>, fieldId: string): CrossLinkFieldValue | null`**
   - Pure extraction from canonical JSONB — delegates to `extractCrossLinkField()` from Unit 1
   - Zero database queries. This is what the grid calls for display value rendering.

2. **`resolveLinkedRecordsL1(tenantId: string, recordId: string, crossLinkId: string, opts?: { limit?: number; offset?: number }): Promise<LinkedRecordsResponse>`**
   - Fetch linked record IDs from `cross_link_index` WHERE `source_record_id = recordId AND cross_link_id = crossLinkId`
   - Single `IN` query for full target records
   - Paginate: default limit 100, offset 0
   - Order by `cross_link_index.created_at` ASC
   - Return `LinkedRecordsResponse` (reuse existing type from `cross-links.ts` or extend)

3. **`resolveLinkedRecordPermissions(tenantId: string, userId: string, crossLink: CrossLink, targetTableId: string): Promise<string[]>`**
   - Load `card_fields` from cross-link definition (display preference ceiling)
   - Resolve user's field permissions on target table via `getFieldPermissions()`
   - Intersect: return only field IDs that are BOTH in `card_fields` AND the user has at least `read_only` permission for
   - If `card_fields` is empty, use all non-hidden fields from target table

4. **`filterLinkedRecordByPermissions(record: DbRecord, permittedFieldIds: string[]): Partial<DbRecord>`**
   - Strip canonical_data entries for fields not in `permittedFieldIds`
   - If `permittedFieldIds` is empty (zero permitted), return minimal shape: `{ id, canonicalData: {} }` — caller renders as "Linked record" label

5. **`LinkedRecordsResponse` type** — extend or reuse existing from `cross-links.ts`. Ensure it includes `totalCount` for pagination UI.

Write integration tests in `apps/web/src/data/__tests__/cross-link-resolution.integration.test.ts`:
- L0: extracts display values from canonical JSONB with zero database queries
- L1: returns full linked records via single IN query, paginated, ordered by creation time
- Permission intersection: card_fields intersected with user's target table permissions
- Zero permitted fields → minimal shape returned
- Tenant isolation for L1

### Acceptance Criteria

- [ ] [CONTRACT] `resolveLinkedRecordsL0(canonicalData, fieldId)` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordsL1(tenantId, recordId, crossLinkId, opts?)` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordPermissions(tenantId, userId, crossLink, targetTableId)` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `filterLinkedRecordByPermissions(record, permittedFieldIds)` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] L0 resolution extracts display values from canonical JSONB with zero database queries
- [ ] L1 resolution returns full linked records via single IN query, paginated, ordered by index creation time
- [ ] Permission intersection: card_fields intersected with user's target table permissions, only permitted fields returned
- [ ] Zero permitted fields → minimal `{ id, canonicalData: {} }` shape returned (graceful degradation)
- [ ] Tenant isolation tests for L1 resolution
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- L2 traversal (Prompt 8)
- Circuit breaker (Prompt 8)
- Display value cascade (Unit 4)
- Link Picker UI (Unit 5)

**Git:** Commit with message `feat(cross-link): add L0/L1 resolution and permission intersection [Phase 3B-i, Prompt 7]`

---

## Prompt 8: L2 Bounded Traversal + Circuit Breaker

**Unit:** 3
**Depends on:** Prompt 7
**Load context:** `cross-linking.md` lines 152–207 (L2 Resolution, Depth Limiting, Circuit Breaker — code sample, depth limits, performance targets)
**Target files:** `apps/web/src/data/cross-link-resolution.ts` (extend)
**Migration required:** No

### Schema Snapshot

Same as Prompt 7.

### Task

Add to `apps/web/src/data/cross-link-resolution.ts`:

1. **`LinkedRecordTree`** type:
   ```typescript
   interface LinkedRecordTree {
     root: string; // root record ID
     levels: Array<{
       depth: number;
       records: DbRecord[];
     }>;
     truncated: boolean; // true if circuit breaker triggered
     truncationReason?: 'circuit_breaker' | 'max_depth';
   }
   ```

2. **`resolveLinkedRecordsL2(tenantId: string, recordId: string, crossLinkId: string, maxDepth?: number): Promise<LinkedRecordTree>`**
   - Implement iterative bounded traversal following the pattern in cross-linking.md lines 158–198
   - Use `visited` Set for cycle detection (cycles allowed but each record visited once)
   - Per-definition `maxDepth` respected, hard cap at `CROSS_LINK_LIMITS.MAX_DEPTH` (5)
   - If `maxDepth` not provided, use the cross-link definition's `maxDepth` field
   - **Circuit breaker:** If any level contains > `CROSS_LINK_LIMITS.CIRCUIT_BREAKER_THRESHOLD` (1000) records, stop traversal immediately, return truncated result with `truncated: true` and `truncationReason: 'circuit_breaker'`
   - Apply permission intersection at each level via `resolveLinkedRecordPermissions()` + `filterLinkedRecordByPermissions()`

Write integration tests:
- L2 resolution implements iterative bounded traversal with visited set for cycle detection
- L2 stops at maxDepth (default from definition, hard cap at 5)
- Circuit breaker triggers at >1000 records at any level, returns truncated result with warning flag
- Cycle detection: create A→B→C→A cycle, verify no infinite loop, each record appears once
- Permission intersection applied at each traversal level
- Performance assertion: L1 with 20 links <50ms (integration test timing check)
- Performance assertion: L2 two-level 20→100 <200ms (integration test timing check)

### Acceptance Criteria

- [ ] [CONTRACT] `resolveLinkedRecordsL2(tenantId, recordId, crossLinkId, maxDepth?)` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `LinkedRecordTree` type exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] L2 resolution implements iterative bounded traversal with `visited` set for cycle detection
- [ ] L2 circuit breaker stops at >1,000 records at any level and returns truncated result with warning flag
- [ ] Depth limiting enforced: respects per-definition `maxDepth`, hard cap at 5 levels
- [ ] Performance: L1 with 20 links <50ms, L2 two-level 20→100 <200ms (integration test assertions)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Multi-hop cascade propagation (Post-MVP)
- Deep link traversal beyond 5 levels (Post-MVP)
- Rollups across cross-links (Post-MVP)
- DuckDB-backed traversal (Post-MVP)

**Git:** Commit with message `feat(cross-link): add L2 bounded traversal with circuit breaker [Phase 3B-i, Prompt 8]`

---

## VERIFY Session Boundary (after Prompts 7–8) — Completes Unit 3

**Scope:** Verify all work from Prompts 7–8 integrates correctly.
**Unit status:** Unit 3 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: in integration test, create cross-link with 3-level chain, call `resolveLinkedRecordsL2`, confirm tree structure

**Interface contract check:**
- [ ] [CONTRACT] `resolveLinkedRecordsL0()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordsL1()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordsL2()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `LinkedRecordTree` type exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `resolveLinkedRecordPermissions()` exported from `apps/web/src/data/cross-link-resolution.ts`
- [ ] [CONTRACT] `filterLinkedRecordByPermissions()` exported from `apps/web/src/data/cross-link-resolution.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 3 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 7–8 [Phase 3B-i, VP-3]`, then push branch to origin.

Fix any failures before proceeding to Prompt 9.

---

## — Unit 4: Display Value Cascade & Scalability Infrastructure —

### Unit Context

The write-amplification management layer. When a target record's display field changes, all source records linking to it need their cached `display_value` updated. This unit builds the BullMQ cascade pipeline with content hash optimization, concurrency controls, single-hop rule, job deduplication, sync backpressure, bulk deletion cascade, display value ordering, and index consistency checks. This is the infrastructure that makes cross-linking viable at scale.

**Interface Contract:**
- **Produces:** `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData`, `QUEUE_NAMES['cross-link']`, `processCrossLinkCascade()`, `processIndexRebuild()`, `enqueueCascadeJob()`, `checkCascadeBackpressure()`, `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED`, `scheduleIntegrityCheck()` — from queue types, worker processors, and web lib
- **Consumes:** `CrossLinkFieldValue`, `extractCrossLinkField`, `setCrossLinkField`, `CROSS_LINK_LIMITS` from Unit 1; `crossLinkIndex` Drizzle table; `getDbForTenant()`; BullMQ `Worker`, `Job`; Redis client

---

## Prompt 9: Queue Registration + Cascade Processor

**Unit:** 4
**Depends on:** Unit 2 complete
**Load context:** `cross-linking.md` lines 268–287 (Display Value Maintenance — staleness, refresh triggers, content hash), `cross-linking.md` lines 298–368 (Scalability — cascade fan-out, batched execution, concurrency controls, single-hop rule)
**Target files:** `packages/shared/queue/constants.ts` (extend), `packages/shared/queue/types.ts` (extend), `apps/worker/src/processors/cross-link/cascade.ts` (new), `apps/worker/src/queues.ts` (extend), `apps/web/src/lib/cross-link-cascade.ts` (replace stub)
**Migration required:** No

### Schema Snapshot

```
cross_link_index: (tenant_id, cross_link_id, source_record_id, target_record_id) composite PK, source_table_id, created_at
records: id (UUID PK), tenant_id, table_id, canonical_data (JSONB), updated_at
```

### Task

1. **Queue registration** — extend `packages/shared/queue/constants.ts`:
   - Add `'cross-link'` to `QUEUE_NAMES`

2. **Job data types** — extend `packages/shared/queue/types.ts`:
   - `CrossLinkCascadeJobData` extending `BaseJobData`: `{ tenantId, targetRecordId, priority: 'high' | 'low', reason: 'user_edit' | 'sync_inbound' | 'bulk_delete' }`
   - `CrossLinkIndexRebuildJobData` extending `BaseJobData`: `{ tenantId, crossLinkId }`
   - Update `QueueJobDataMap` with new types

3. **Cascade processor** — create `apps/worker/src/processors/cross-link/cascade.ts`:
   - `processCrossLinkCascade(job: Job<CrossLinkCascadeJobData>): Promise<void>`
   - Read target record's current display value from the display field in canonical_data
   - Compute content hash (simple string hash). Compare with stored hash. If unchanged, skip cascade (~70% skip path). Log skip.
   - If changed: query `cross_link_index` for all entries WHERE `target_record_id = job.data.targetRecordId`
   - Batch update in chunks of 500:
     - For each chunk, update source records' `canonical_data` to set new display value
     - Use `_display_updated_at` version stamp: only apply if incoming timestamp is newer (prevents stale updates)
     - 10ms sleep between chunks (`await new Promise(r => setTimeout(r, 10))`)
   - After all chunks: publish ONE `records.batch_updated` event per affected source table (not per record) via `EventPublisher`
   - **Single-hop rule:** If `job.data.reason === 'display_value_refresh'`, return immediately without processing. Only `user_edit` and `sync_inbound` trigger cascades.
   - Write condensed audit log entry: one entry per batch with `triggered_by` linking to original action

4. **Per-tenant concurrency** — configure in `apps/worker/src/queues.ts`:
   - Register `cross-link` queue with BullMQ group concurrency of 2 keyed on `tenantId`

5. **Replace cascade stub** — update `apps/web/src/lib/cross-link-cascade.ts`:
   - `enqueueCascadeJob(tenantId, targetRecordId, priority)`: enqueue to `cross-link` queue with BullMQ jobId `crosslink:cascade:{tenantId}:{targetRecordId}` for deduplication
   - Priority mapping: `high` → 1, `low` → 10

Write unit tests in `apps/worker/src/processors/cross-link/__tests__/cascade.test.ts`:
- Content hash skip: unchanged display value → no updates, skip logged
- Content hash changed: updates source records' canonical data in batches of 500
- Single-hop rule: `reason: 'display_value_refresh'` → immediate return, no processing
- `_display_updated_at` ordering: stale update becomes no-op
- One `records.batch_updated` event per affected source table (not per record)
- Job deduplication: same jobId → silently deduplicated

### Acceptance Criteria

- [ ] [CONTRACT] `QUEUE_NAMES['cross-link']` registered in `packages/shared/queue/constants.ts`
- [ ] [CONTRACT] `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData` exported from `packages/shared/queue/types.ts`
- [ ] [CONTRACT] `processCrossLinkCascade(job)` exported from `apps/worker/src/processors/cross-link/cascade.ts`
- [ ] [CONTRACT] `enqueueCascadeJob(tenantId, targetRecordId, priority)` exported from `apps/web/src/lib/cross-link-cascade.ts` (stub replaced with real implementation)
- [ ] Cascade processor: reads target record display value, computes content hash, skips cascade if unchanged (~70% skip rate path tested)
- [ ] Cascade processor: batches updates in chunks of 500 with 10ms inter-chunk sleep
- [ ] Cascade processor: publishes one `records.batch_updated` event per affected source table (not per record)
- [ ] Per-tenant cascade concurrency limited to 2 via BullMQ group concurrency
- [ ] Single-hop rule: events with `reason: 'display_value_refresh'` do NOT trigger further cascades
- [ ] Job deduplication: jobId `crosslink:cascade:{tenantId}:{targetRecordId}` prevents duplicate queue entries
- [ ] Display value ordering: `_display_updated_at` version stamp prevents stale updates
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Backpressure check (Prompt 10)
- Index integrity check (Prompt 10)
- Bulk deletion cascade (Prompt 10)
- Multi-hop cascade propagation (Post-MVP)
- Cascade visualization UI (Post-MVP)

**Git:** Commit with message `feat(cross-link): add display value cascade processor with content hash, batching and single-hop rule [Phase 3B-i, Prompt 9]`

---

## Prompt 10: Backpressure, Dedup, Integrity Check & Bulk Deletion

**Unit:** 4
**Depends on:** Prompt 9
**Load context:** `cross-linking.md` lines 369–442 (Scalability — job dedup, sync backpressure, bulk deletion cascade, display value ordering, index sizing, write amplification, index consistency & rebuild)
**Target files:** `apps/web/src/lib/cross-link-cascade.ts` (extend), `apps/worker/src/processors/cross-link/index-rebuild.ts` (new), `apps/worker/src/processors/cross-link/integrity-check.ts` (new), `packages/shared/realtime/events.ts` (extend)
**Migration required:** No

### Schema Snapshot

Same as Prompt 9.

### Task

1. **Backpressure check** — extend `apps/web/src/lib/cross-link-cascade.ts`:
   - `checkCascadeBackpressure(tenantId: string): Promise<boolean>` — reads Redis counter `q:cascade:depth:{tenantId}`. Returns `true` if >500 pending jobs for tenant. Used by sync scheduler to skip polls when cascade queue is congested.
   - Increment counter on enqueue, decrement on job completion (add hooks to cascade processor)

2. **Bulk deletion cascade** — add to cascade processor or as separate handler:
   - When a table is soft-deleted, enqueue a `bulk_delete` cascade job
   - Processor: batch 5,000 entries at a time, clear dead links from source records' canonical data + remove index entries, 50ms sleep between batches
   - Publish one `records.batch_updated` event per affected source table after all batches

3. **Index rebuild processor** — create `apps/worker/src/processors/cross-link/index-rebuild.ts`:
   - `processIndexRebuild(job: Job<CrossLinkIndexRebuildJobData>): Promise<void>`
   - Delete all index entries for the definition
   - Scan source records in batches of 1,000
   - Rebuild index from `canonical_data` cross-link field values
   - Log completion with record/entry counts

4. **Integrity check scheduler** — create `apps/worker/src/processors/cross-link/integrity-check.ts`:
   - `scheduleIntegrityCheck(tenantId: string, crossLinkId: string): Promise<void>`
   - Samples 100/500/1,000 entries by table size
   - Compares index entries against canonical data
   - If >1% drift detected → enqueue full rebuild + log alert
   - Event-driven: failed/timed-out cascade jobs trigger immediate integrity check

5. **Real-time event** — extend `packages/shared/realtime/events.ts`:
   - Add `DISPLAY_VALUE_UPDATED` to `REALTIME_EVENTS`

6. **Worker entry point** — update `apps/worker/src/index.ts`:
   - Register cross-link cascade processor and index rebuild processor

Write unit tests:
- `checkCascadeBackpressure` returns true when >500 pending jobs
- Bulk deletion: clears dead links in batches of 5,000, 50ms inter-batch delay
- Index rebuild: deletes and recreates index from canonical data
- Integrity check: detects >1% drift, triggers rebuild
- `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED` exists

### Acceptance Criteria

- [ ] [CONTRACT] `checkCascadeBackpressure(tenantId)` exported from `apps/web/src/lib/cross-link-cascade.ts`
- [ ] [CONTRACT] `processIndexRebuild(job)` exported from `apps/worker/src/processors/cross-link/index-rebuild.ts`
- [ ] [CONTRACT] `scheduleIntegrityCheck(tenantId, crossLinkId)` exported from `apps/worker/src/processors/cross-link/integrity-check.ts`
- [ ] [CONTRACT] `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED` exists in `packages/shared/realtime/events.ts`
- [ ] Sync backpressure: `checkCascadeBackpressure()` returns true when >500 pending jobs for tenant
- [ ] Bulk deletion cascade: soft-delete table → background job clears dead links from canonical data + index in batches of 5,000
- [ ] Index integrity check: samples 100/500/1,000 entries by table size, alerts on >1% drift
- [ ] Worker entry point registers cross-link processors
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Cascade visualization UI (Post-MVP)
- Multi-hop cascade propagation (Post-MVP)
- Adaptive chunk delay tuning (nice-to-have, not required for MVP)
- Partition strategy for >100M rows (Post-MVP scale)

**Git:** Commit with message `feat(cross-link): add backpressure, bulk deletion cascade, integrity check and index rebuild [Phase 3B-i, Prompt 10]`

---

## VERIFY Session Boundary (after Prompts 9–10) — Completes Unit 4

**Scope:** Verify all work from Prompts 9–10 integrates correctly.
**Unit status:** Unit 4 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: verify `enqueueCascadeJob` is no longer a stub — check that import from `cross-link-cascade.ts` connects to real BullMQ queue

**Interface contract check:**
- [ ] [CONTRACT] `QUEUE_NAMES['cross-link']` in `packages/shared/queue/constants.ts`
- [ ] [CONTRACT] `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData` in `packages/shared/queue/types.ts`
- [ ] [CONTRACT] `processCrossLinkCascade()` in `apps/worker/src/processors/cross-link/cascade.ts`
- [ ] [CONTRACT] `processIndexRebuild()` in `apps/worker/src/processors/cross-link/index-rebuild.ts`
- [ ] [CONTRACT] `enqueueCascadeJob()` in `apps/web/src/lib/cross-link-cascade.ts`
- [ ] [CONTRACT] `checkCascadeBackpressure()` in `apps/web/src/lib/cross-link-cascade.ts`
- [ ] [CONTRACT] `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED` in `packages/shared/realtime/events.ts`
- [ ] [CONTRACT] `scheduleIntegrityCheck()` in `apps/worker/src/processors/cross-link/integrity-check.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 4 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 9–10 [Phase 3B-i, VP-4]`, then push branch to origin.

Fix any failures before proceeding to Prompt 11.

---

## — Unit 5: Link Picker UI —

### Unit Context

The user-facing interface for creating and managing record links. Opens from the Linked Record cell renderer (built in 3A-i) or from Record View. Provides search, recent links, inline record creation, and single/multi-link selection modes. Respects scope filters and card_fields configuration. This is the only UI unit in the phase — all prior units are backend/infrastructure.

**Interface Contract:**
- **Produces:** `LinkPicker`, `LinkPickerProvider`, `useLinkPicker()`, `LinkedRecordChip`, `LinkPickerSearchResults`, `LinkPickerInlineCreate`, `searchLinkableRecords()`, `getRecentLinkedRecords()` — from `apps/web/src/components/cross-links/` and `apps/web/src/data/cross-links.ts`
- **Consumes:** `CrossLinkFieldValue`, `LinkScopeFilter`, `CROSS_LINK_LIMITS` from Unit 1; `linkRecords`, `unlinkRecords`, `getCrossLinkDefinition` from Unit 2; `resolveLinkedRecordPermissions` from Unit 3; shadcn/ui `Dialog`, `Command`, `Input`, `Button`, `ScrollArea`

---

## Prompt 11: Link Picker Core: Search, Recent & Selection Modes

**Unit:** 5
**Depends on:** Units 2, 3 complete
**Load context:** `cross-linking.md` lines 237–266 (Link Picker UX — search, recent, inline create, single/multi-link, mobile, card_fields config), `cross-linking.md` lines 94–113 (Cross-Link Field Value — display value shape for chips)
**Target files:** `apps/web/src/components/cross-links/link-picker.tsx` (new), `apps/web/src/components/cross-links/link-picker-provider.tsx` (new), `apps/web/src/components/cross-links/use-link-picker.ts` (new), `apps/web/src/components/cross-links/link-picker-search-results.tsx` (new), `apps/web/src/data/cross-links.ts` (extend — add search/recent functions)
**Migration required:** No

### Schema Snapshot

```
cross_links: id, tenant_id, name, source_table_id, source_field_id, target_table_id, target_display_field_id, relationship_type, link_scope_filter (JSONB), card_fields (JSONB), max_links_per_record
records: id, tenant_id, table_id, canonical_data (JSONB), archived_at
```

### Task

1. **Data functions** — extend `apps/web/src/data/cross-links.ts`:
   - `searchLinkableRecords(tenantId: string, crossLinkId: string, query: string, opts?: { limit?: number; offset?: number }): Promise<SearchResult[]>` — tsvector prefix matching on target table's display field. Apply scope filter from cross-link definition. Paginate to 100 with offset. Return `{ record: DbRecord; displayValue: string }[]`.
   - `getRecentLinkedRecords(tenantId: string, crossLinkId: string, userId: string, limit?: number): Promise<DbRecord[]>` — last N records (default 5) linked by this user to this definition, ordered by `cross_link_index.created_at` DESC. Filter by `created_by` if available, otherwise by most recent index entries.

2. **LinkPickerProvider** — `apps/web/src/components/cross-links/link-picker-provider.tsx`:
   - Context provider managing Link Picker state: `isOpen`, `crossLinkId`, `sourceRecordId`, `mode` (`single` or `multi`), `selectedIds` (Set for multi-mode accumulation)
   - Derives mode from relationship type: `many_to_one` → single, `one_to_many` → multi

3. **useLinkPicker hook** — `apps/web/src/components/cross-links/use-link-picker.ts`:
   - `open(crossLinkId, sourceRecordId)` — opens Link Picker for a specific cross-link and source record
   - `close()` — closes and resets state
   - `select(targetRecordId)` — in single mode: calls `linkRecords` and closes; in multi mode: toggles in `selectedIds`
   - `confirm()` — in multi mode: calls `linkRecords` with all `selectedIds`, then closes
   - `remove(targetRecordId)` — calls `unlinkRecords` for the specified record

4. **LinkPicker** — `apps/web/src/components/cross-links/link-picker.tsx`:
   - Uses shadcn/ui `Dialog` as overlay container
   - Uses shadcn/ui `Command` (cmdk) for search input with keyboard navigation
   - Layout: search input at top, recent section (when no active search), search results below
   - **Single-link mode** (`many_to_one`): click to select and close, replaces existing link
   - **Multi-link mode** (`one_to_many`): checkbox accumulation, selected pills displayed above search, "Done" button confirms
   - Keyboard navigation: arrow keys to navigate results, Enter to select, Escape to close
   - Scope filter enforced: `searchLinkableRecords` already applies scope filter server-side

5. **LinkPickerSearchResults** — `apps/web/src/components/cross-links/link-picker-search-results.tsx`:
   - Renders search results with card_fields configuration (displays configured fields in previews)
   - Permission-aware: filters displayed fields via `resolveLinkedRecordPermissions()` from Unit 3
   - Uses `ScrollArea` for scrollable results with scroll-to-load pagination

All user-facing strings through `next-intl` i18n.

### Acceptance Criteria

- [ ] [CONTRACT] `searchLinkableRecords(tenantId, crossLinkId, query, opts?)` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `getRecentLinkedRecords(tenantId, crossLinkId, userId, limit?)` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `LinkPicker` exported from `apps/web/src/components/cross-links/link-picker.tsx`
- [ ] [CONTRACT] `LinkPickerProvider` exported from `apps/web/src/components/cross-links/link-picker-provider.tsx`
- [ ] [CONTRACT] `useLinkPicker()` exported from `apps/web/src/components/cross-links/use-link-picker.ts`
- [ ] [CONTRACT] `LinkPickerSearchResults` exported from `apps/web/src/components/cross-links/link-picker-search-results.tsx`
- [ ] Search uses tsvector prefix matching on target table's display field, paginated to 100 with scroll-to-load
- [ ] Recent section shows last 5 records linked by this user, above search results, hidden on active search
- [ ] Single-link mode: click to select and close, replaces existing link
- [ ] Multi-link mode: checkbox accumulation, pills above search, "Done" confirms
- [ ] Scope filter enforced: only matching target records shown in search results
- [ ] card_fields configuration: displays configured fields in search result previews
- [ ] Permission-aware: only shows fields the user has permission to see on target table
- [ ] Keyboard navigation: arrow keys, Enter to select, Escape to close
- [ ] i18n: all user-facing strings through next-intl
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Inline record creation form (Prompt 12)
- LinkedRecordChip enhanced component (Prompt 12)
- Grid/RecordView integration (Prompt 12)
- Mobile bottom sheet variant (Post-MVP or deferred to 3H-i)

**Git:** Commit with message `feat(cross-link): add Link Picker with search, recent links and selection modes [Phase 3B-i, Prompt 11]`

---

## Prompt 12: Inline Create, LinkedRecordChip & Grid/RecordView Integration

**Unit:** 5
**Depends on:** Prompt 11
**Load context:** `cross-linking.md` lines 237–266 (Link Picker UX — inline create, card_fields config), `cross-linking.md` lines 94–113 (Cross-Link Field Value — display value shape for chips)
**Target files:** `apps/web/src/components/cross-links/link-picker-inline-create.tsx` (new), `apps/web/src/components/cross-links/linked-record-chip.tsx` (new), `apps/web/src/components/grid/cells/` (extend Linked Record cell renderer), `apps/web/src/components/record-view/` (extend Record View)
**Migration required:** No

### Schema Snapshot

N/A — no schema changes.

### Task

1. **LinkPickerInlineCreate** — `apps/web/src/components/cross-links/link-picker-inline-create.tsx`:
   - "+ New [target table name]" button at bottom of Link Picker
   - Compact form showing card_fields from the cross-link definition
   - Creates a new record on the target table AND links it to the source record in one action
   - Uses `createRecord` action (from record-actions) + `linkRecords` action (from cross-link-actions)
   - Form validates required fields before submission
   - On success: closes inline create, adds new record to results, auto-selects it

2. **LinkedRecordChip** — `apps/web/src/components/cross-links/linked-record-chip.tsx`:
   - Enhanced display component for linked record pills (replaces/extends existing renderer)
   - Shows `display_value` text with clickable behavior (opens Record View of target record)
   - **Shimmer animation** while cascade in-flight: amber shimmer when `_display_updated_at` is stale (compare with source record's `updated_at` or a real-time cascade-in-progress signal)
   - Remove button (x) for unlinking in edit mode
   - Truncation: long display values truncated with ellipsis
   - Tooltip on hover showing full display value

3. **Grid cell integration** — update existing Linked Record cell renderer in `apps/web/src/components/grid/cells/`:
   - On cell click: open Link Picker via `useLinkPicker().open(crossLinkId, recordId)`
   - Display linked record chips using `LinkedRecordChip` component
   - Wrap cell content with `LinkPickerProvider`

4. **Record View integration** — update Record View linked field rendering:
   - Linked record fields in Record View open Link Picker on click
   - Display linked records as `LinkedRecordChip` list with add/remove capability

All user-facing strings through `next-intl` i18n.

Write component tests in `apps/web/src/components/cross-links/__tests__/`:
- `LinkPickerInlineCreate.test.tsx`: renders form with card_fields, creates and links record
- `LinkedRecordChip.test.tsx`: renders display value, shows remove button in edit mode, shimmer animation state
- Integration: Linked Record cell click opens Link Picker

### Acceptance Criteria

- [ ] [CONTRACT] `LinkPickerInlineCreate` exported from `apps/web/src/components/cross-links/link-picker-inline-create.tsx`
- [ ] [CONTRACT] `LinkedRecordChip` exported from `apps/web/src/components/cross-links/linked-record-chip.tsx`
- [ ] Link Picker opens from Linked Record cell click and Record View linked field
- [ ] Inline create: "+ New [target table name]" at bottom, compact form with card_fields, creates and links in one action
- [ ] Linked record chips show display value with shimmer animation while cascade in-flight
- [ ] LinkedRecordChip: clickable to open target record, remove button for unlinking, truncation with tooltip
- [ ] i18n: all user-facing strings through next-intl
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Mobile bottom sheet variant (3H-i Mobile Feature Adaptation)
- Drag-and-drop reordering of linked records (Post-MVP)
- Inline Sub-Table within Link Picker (already exists from 3A-ii, not modified here)
- Workspace Map visualization from Link Picker (Post-MVP)

**Git:** Commit with message `feat(cross-link): add inline create, LinkedRecordChip and grid/RecordView integration [Phase 3B-i, Prompt 12]`

---

## VERIFY Session Boundary (after Prompts 11–12) — Completes Unit 5 (phase complete)

**Scope:** Verify all work from Prompts 11–12 integrates correctly. Final verification for the entire phase.
**Unit status:** Unit 5 complete — verify contract. Phase 3B-i complete.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. Manual verification: start dev server, navigate to a grid with a Linked Record field, click the cell, verify Link Picker opens with search and recent sections

**Interface contract check:**
- [ ] [CONTRACT] `LinkPicker` exported from `apps/web/src/components/cross-links/link-picker.tsx`
- [ ] [CONTRACT] `LinkPickerProvider` exported from `apps/web/src/components/cross-links/link-picker-provider.tsx`
- [ ] [CONTRACT] `useLinkPicker()` exported from `apps/web/src/components/cross-links/use-link-picker.ts`
- [ ] [CONTRACT] `LinkedRecordChip` exported from `apps/web/src/components/cross-links/linked-record-chip.tsx`
- [ ] [CONTRACT] `LinkPickerSearchResults` exported from `apps/web/src/components/cross-links/link-picker-search-results.tsx`
- [ ] [CONTRACT] `LinkPickerInlineCreate` exported from `apps/web/src/components/cross-links/link-picker-inline-create.tsx`
- [ ] [CONTRACT] `searchLinkableRecords()` exported from `apps/web/src/data/cross-links.ts`
- [ ] [CONTRACT] `getRecentLinkedRecords()` exported from `apps/web/src/data/cross-links.ts`

**Full phase integration check:**
- [ ] End-to-end: create cross-link definition → link records → see display values in grid (L0) → open Record View and see full linked records (L1) → verify Link Picker search works → unlink → verify cleanup
- [ ] Display value cascade: update a target record's display field → verify cascade processor updates source records' canonical data → verify grid reflects new display value
- [ ] Permission intersection: user with limited target table permissions sees only permitted card_fields in Link Picker results

**State file updates:**
- Update TASK-STATUS.md: Unit 5 → `passed-review`
- Update MODIFICATIONS.md: append session block
- Update TASK-STATUS.md: Phase 3B-i → all units `passed-review`

**Git:** Commit with message `chore(verify): verify prompts 11–12 [Phase 3B-i, VP-5]`, then push branch to origin.

Fix any failures before proceeding to docs sync.
