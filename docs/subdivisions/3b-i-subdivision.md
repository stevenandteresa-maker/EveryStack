# Subdivision Doc: 3B-i — Cross-Linking Engine

## Big-Picture Anchor

Cross-linking is EveryStack's core differentiator — the ability to connect
records across tables, workspaces, and platforms within a tenant. This
sub-phase builds the complete cross-linking system: definition CRUD with
creation constraints and permission enforcement, bidirectional index
maintenance, query-time resolution at three depth levels, display value
cascade infrastructure, and the Link Picker UI for creating and managing
links. It sits atop the grid, views, and field-level permissions built in
3A-i through 3A-iii, and its outputs feed into the Schema Descriptor
Service and Command Bar in 3B-ii, Record Thread in 3C, and document
merge-tag traversal in 3D.

## Section Index

| Section | Summary |
|---------|---------|
| Big-Picture Anchor | Cross-linking as core differentiator; upstream/downstream dependencies |
| Seam Analysis | 5-layer decomposition: types, CRUD, reads, worker, UI |
| Dependency Graph | Unit 1 -> Unit 2 -> Units 3, 4, 5 in parallel |
| Unit 1: Types, Validation & Registry | RelationshipType, CrossLinkFieldValue, Zod schemas, linked_record FieldTypeRegistry entry |
| Unit 2: Cross-Link CRUD & Record Linking | Definition CRUD, linkRecords/unlinkRecords, bidirectional index maintenance |
| Unit 3: Query-Time Resolution & Permissions | L0/L1/L2 resolution levels, card_fields x permission intersection |
| Unit 4: Display Value Cascade | BullMQ cascade processor, content hash skip, backpressure, single-hop rule |
| Unit 5: Link Picker UI | LinkPicker search/recent/selection, inline create, LinkedRecordChip |

### Seam Analysis

The sub-phase touches three layers plus a background worker concern:

1. **Cross-cutting types & validation** — shared types, Zod schemas,
   FieldTypeRegistry registration, and constants needed by all subsequent
   units.
2. **Data/service layer (CRUD)** — server actions for definition and
   record-level link management, index maintenance, constraint validation,
   and permission enforcement.
3. **Data/service layer (reads)** — query-time resolution at L0/L1/L2
   with depth limiting, circuit breaker, and permission intersection.
4. **Worker layer** — BullMQ cascade jobs for display value maintenance,
   concurrency controls, backpressure, index consistency.
5. **UI layer** — Link Picker component for record search, selection,
   and inline creation.

Primary seam: **Data → Service → Worker → UI** layers. Secondary seam:
**CRUD vs. read-only resolution** within the service layer (different
consumers, different performance profiles). The worker layer is separated
because it introduces BullMQ job definitions and Redis infrastructure
independent of the CRUD and resolution paths.

### Scope Exclusions

**Impact Analysis** and **Convert to Native Table** are marked Post-MVP
in `cross-linking.md` per GLOSSARY.md scope labels. They are excluded
from this subdivision despite appearing in the phase division doc's
Includes list. See DECISIONS.md entry 2026-03-13 for rationale.

## Dependency Graph

Covers Unit 1: Cross-Link Types, Validation Schemas & Registry, Unit 2: Cross-Link Definition CRUD & Record Linking, Unit 3: Query-Time Resolution & Permission Intersection, Unit 4: Display Value Cascade & Scalability Infrastructure, Unit 5: Link Picker UI.
Touches `linked_record`, `cross_link_index`, `update_cross_link_display_values`, `max_links_per_record`, `display_value` tables. See `cross-linking.md`.

```
Unit 1: Types, Validation & Registry
  ↓
Unit 2: Cross-Link CRUD & Record Linking
  ↓           ↓           ↓
Unit 3:     Unit 4:     Unit 5:
Query-Time  Display     Link Picker UI
Resolution  Value
& Perms     Cascade
```

- **Units 3, 4, 5 are parallel** — all consume Unit 2 exports, no mutual
  dependencies.
- **Critical path:** Unit 1 → Unit 2 → any of {3, 4, 5} (depth: 3).
- **Parallel opportunities:** After Unit 2 completes, Units 3, 4, and 5
  can proceed concurrently.

---

### Unit 1: Cross-Link Types, Validation Schemas & Registry

**Big-Picture Anchor:** Establishes the shared type vocabulary and
validation layer that every other cross-linking unit imports. Registers
the `linked_record` field type in the FieldTypeRegistry so the sync
engine and grid can handle cross-link field values.

**Produces:**
- `RelationshipType` — type union `'many_to_one' | 'one_to_many'` from `packages/shared/sync/cross-link-types.ts`
- `RELATIONSHIP_TYPES` — const object from `packages/shared/sync/cross-link-types.ts`
- `LinkScopeFilter`, `LinkScopeCondition` — types for scope filter JSONB shape from `packages/shared/sync/cross-link-types.ts`
- `CrossLinkFieldValue`, `LinkedRecordEntry` — types for canonical JSONB field value from `packages/shared/sync/cross-link-types.ts`
- `CROSS_LINK_LIMITS` — constants (`MAX_LINKS_PER_RECORD: 500`, `DEFAULT_LINKS_PER_RECORD: 50`, `MAX_DEFINITIONS_PER_TABLE: 20`, `MAX_DEPTH: 5`, `DEFAULT_DEPTH: 3`, `CIRCUIT_BREAKER_THRESHOLD: 1000`) from `packages/shared/sync/cross-link-types.ts`
- `createCrossLinkSchema` — Zod schema for cross-link definition creation from `packages/shared/sync/cross-link-schemas.ts`
- `updateCrossLinkSchema` — Zod schema for cross-link definition update from `packages/shared/sync/cross-link-schemas.ts`
- `linkScopeFilterSchema` — Zod schema for scope filter validation from `packages/shared/sync/cross-link-schemas.ts`
- `linkRecordsSchema`, `unlinkRecordsSchema` — Zod schemas for link/unlink actions from `packages/shared/sync/cross-link-schemas.ts`
- FieldTypeRegistry registration for `linked_record` on all platforms (canonical → canonical identity transform, with `toCanonical`/`fromCanonical` for the cross-link field value shape) in `packages/shared/sync/cross-link-field-type.ts`
- `extractCrossLinkField(canonicalData, crossLinkId): CrossLinkFieldValue | null` — utility from `packages/shared/sync/cross-link-types.ts`
- `setCrossLinkField(canonicalData, fieldId, value): Record<string, unknown>` — utility from `packages/shared/sync/cross-link-types.ts`

**Consumes:**
- `FieldTypeRegistry` singleton from `packages/shared/sync/field-registry.ts` — for registration
- `CrossLink`, `NewCrossLink`, `CrossLinkIndex`, `NewCrossLinkIndex` from `packages/shared/db/schema/` — existing Drizzle types (not modified)

**Side Effects:** None

**Context Manifest:**
- `cross-linking.md` § Data Model (lines 47–130) — field value shape, card_fields, link_scope_filter
- `cross-linking.md` § Cross-Link + Sync Interaction (lines 289–296) — sync neutrality
- `cross-linking.md` § Creation Constraints (lines 444–456) — limit constants
- `CLAUDE.md` § Field Type Registry (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/sync/field-registry.ts` — FieldTypeRegistry class and singleton
- `packages/shared/sync/types.ts` — FieldTransform interface
- `packages/shared/db/schema/cross-links.ts` — existing Drizzle schema
- `packages/shared/db/schema/cross-link-index.ts` — existing Drizzle schema
- `packages/shared/db/schema/records.ts` — canonicalData shape reference

**Acceptance Criteria:**
- [ ] `RelationshipType`, `LinkScopeFilter`, `CrossLinkFieldValue`, and all constants are exported and importable
- [ ] Zod schemas validate correct inputs and reject invalid inputs (missing required fields, invalid relationship types, scope filter operator validation)
- [ ] `linked_record` field type registered in FieldTypeRegistry for `canonical` platform with identity transform
- [ ] `extractCrossLinkField` returns correct shape from canonical JSONB or null
- [ ] `setCrossLinkField` correctly merges cross-link field value into canonical JSONB
- [ ] All types pass `tsc --noEmit` strict mode
- [ ] Unit tests cover schema validation edge cases (empty card_fields, invalid operators, boundary limit values)

**Estimated Complexity:** Low

---

### Unit 2: Cross-Link Definition CRUD & Record Linking

**Big-Picture Anchor:** The operational core of cross-linking — server
actions for creating, reading, updating, and deleting cross-link
definitions, plus the record-level link/unlink operations that maintain
the `cross_link_index` and canonical JSONB field values. Includes
creation constraint enforcement, cycle detection, and permission checks.

**Produces:**
- `createCrossLinkDefinition(input: CreateCrossLinkInput): Promise<CrossLink>` — server action from `apps/web/src/actions/cross-link-actions.ts`
- `updateCrossLinkDefinition(id: string, input: UpdateCrossLinkInput): Promise<CrossLink>` — server action from `apps/web/src/actions/cross-link-actions.ts`
- `deleteCrossLinkDefinition(id: string): Promise<void>` — server action from `apps/web/src/actions/cross-link-actions.ts`
- `linkRecords(crossLinkId: string, sourceRecordId: string, targetRecordIds: string[]): Promise<void>` — server action from `apps/web/src/actions/cross-link-actions.ts`
- `unlinkRecords(crossLinkId: string, sourceRecordId: string, targetRecordIds: string[]): Promise<void>` — server action from `apps/web/src/actions/cross-link-actions.ts`
- `getCrossLinkDefinition(tenantId: string, crossLinkId: string): Promise<CrossLink | null>` — data function from `apps/web/src/data/cross-links.ts`
- `listCrossLinkDefinitions(tenantId: string, tableId: string): Promise<CrossLink[]>` — data function from `apps/web/src/data/cross-links.ts`
- `getCrossLinksByTarget(tenantId: string, targetTableId: string): Promise<CrossLink[]>` — data function (reverse lookups) from `apps/web/src/data/cross-links.ts`
- `validateLinkTarget(tenantId: string, crossLinkId: string, targetRecordId: string): Promise<{ valid: boolean; reason?: string }>` — scope filter + constraint validation from `apps/web/src/data/cross-links.ts`
- `checkCrossLinkPermission(tenantId: string, userId: string, sourceTableId: string, targetTableId: string, operation: 'create' | 'structural' | 'operational'): Promise<boolean>` — permission check from `apps/web/src/data/cross-links.ts`
- `createTestCrossLinkWithIndex(overrides?)` — factory extension in `packages/shared/testing/factories.ts` (creates definition + index entries + canonical field values for integration tests)

**Consumes:**
- All types and schemas from Unit 1 — validation, constants, canonical field utilities
- `CrossLink`, `NewCrossLink`, `crossLinks`, `crossLinkIndex` from `packages/shared/db/schema/` — Drizzle tables
- `getDbForTenant()` from `packages/shared/db` — tenant-scoped database access
- `checkRole()`, `roleAtLeast()` from `packages/shared/auth/` — role checks for permission enforcement
- `writeAuditLog()` from audit log infrastructure — cross-link mutations
- `createTestCrossLink` from `packages/shared/testing/` — existing factory (extended, not replaced)

**Side Effects:**
- Writes to `cross_link_index` table on link/unlink
- Writes to `records.canonical_data` JSONB on link/unlink (updates the cross-link field value)
- Creates reverse field on target table when `reverseFieldId` is requested during definition creation
- Writes audit log entries for definition create/update/delete and record link/unlink
- Enqueues `update_cross_link_display_values` BullMQ job after link operations (integration point for Unit 4 — enqueue only, processor in Unit 4)

**Context Manifest:**
- `cross-linking.md` § Data Model (lines 47–130) — full data model, index structure, field value shape
- `cross-linking.md` § Cross-Link + Sync Interaction (lines 289–296) — sync neutrality
- `cross-linking.md` § Creation Constraints (lines 444–456) — all constraint rules
- `cross-linking.md` § Cross-Link Creation & Modification Permissions (lines 458–494) — permission model
- `cross-linking.md` § Scalability § Audit Log Condensation (lines 406–411) — audit patterns
- `CLAUDE.md` § Architecture Fundamentals (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/data/cross-links.ts` — existing read functions (extended)
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` — existing tests (extended)
- `apps/web/src/actions/record-actions.ts` — reference for server action pattern
- `packages/shared/auth/check-role.ts` — role checking utilities
- `packages/shared/db/schema/cross-links.ts` — Drizzle schema
- `packages/shared/db/schema/cross-link-index.ts` — Drizzle schema
- `packages/shared/db/schema/fields.ts` — for reverse field creation
- `packages/shared/testing/factories.ts` — existing factories (extended)

**From Prior Units:**
- Unit 1 output: `packages/shared/sync/cross-link-types.ts`
- Unit 1 output: `packages/shared/sync/cross-link-schemas.ts`
- Unit 1 output: `packages/shared/sync/cross-link-field-type.ts`

**Acceptance Criteria:**
- [ ] `createCrossLinkDefinition` creates a definition with validated input, respects `MAX_DEFINITIONS_PER_TABLE` limit, and writes audit log
- [ ] `createCrossLinkDefinition` blocks same-record self-links and enforces tenant boundary (cross-tenant permanently forbidden per CP-002)
- [ ] `createCrossLinkDefinition` enforces permission rules: Manager of both tables for same-base, Admin/Owner for cross-base
- [ ] `updateCrossLinkDefinition` distinguishes structural vs. operational changes per permission rules
- [ ] `deleteCrossLinkDefinition` cascades: removes index entries, clears canonical field values, writes audit log
- [ ] `linkRecords` validates scope filter, respects `max_links_per_record`, writes index entries, updates canonical JSONB, enqueues display value job
- [ ] `unlinkRecords` removes index entries, updates canonical JSONB, enqueues display value job
- [ ] Cycle detection allows cycles but enforces depth limit via `visited` set (existing records can link cyclically — resolved at query time with bounded iteration)
- [ ] Tenant isolation tests pass for all data functions using `testTenantIsolation()`
- [ ] Integration tests cover: create/read/update/delete definition, link/unlink records, constraint violations, permission denials

**Estimated Complexity:** High

---

### Unit 3: Query-Time Resolution & Permission Intersection

**Big-Picture Anchor:** The read path for cross-linked records. Level 0
serves grid cells (zero-cost — reads denormalized display values from
canonical JSONB). Level 1 serves Record View (single IN query for full
linked records). Level 2 serves cross-link traversal features like
merge-tag resolution in document templates. Permission intersection
ensures users only see target record fields they're authorized for.

**Produces:**
- `resolveLinkedRecordsL0(canonicalData: Record<string, unknown>, fieldId: string): CrossLinkFieldValue | null` — L0 grid display value extraction from `apps/web/src/data/cross-link-resolution.ts`
- `resolveLinkedRecordsL1(tenantId: string, recordId: string, crossLinkId: string, opts?: PaginationOpts): Promise<LinkedRecordsResponse>` — L1 single-join resolution from `apps/web/src/data/cross-link-resolution.ts`
- `resolveLinkedRecordsL2(tenantId: string, recordId: string, crossLinkId: string, maxDepth?: number): Promise<LinkedRecordTree>` — L2 bounded traversal from `apps/web/src/data/cross-link-resolution.ts`
- `LinkedRecordTree` — type for multi-level resolution result from `apps/web/src/data/cross-link-resolution.ts`
- `resolveLinkedRecordPermissions(tenantId: string, userId: string, crossLink: CrossLink, targetTableId: string): Promise<string[]>` — returns permitted field IDs (intersection of card_fields and user's target table permissions) from `apps/web/src/data/cross-link-resolution.ts`
- `filterLinkedRecordByPermissions(record: DbRecord, permittedFieldIds: string[]): Partial<DbRecord>` — strips non-permitted fields from linked record canonical data from `apps/web/src/data/cross-link-resolution.ts`

**Consumes:**
- `CrossLinkFieldValue`, `extractCrossLinkField`, `CROSS_LINK_LIMITS` from Unit 1 — types, extraction utility, depth/circuit-breaker constants
- `getCrossLinkDefinition` from Unit 2 — definition lookup for L1/L2
- `getLinkedRecords` from `apps/web/src/data/cross-links.ts` — existing L1 implementation (refactored into this unit or consumed as-is)
- `getFieldPermissions` from `apps/web/src/data/permissions.ts` — target table permission resolution
- `resolveFieldPermission` from `packages/shared/auth/permissions/resolve.ts` — pure permission resolution

**Side Effects:** None (read-only functions)

**Context Manifest:**
- `cross-linking.md` § Query-Time Resolution (lines 132–235) — L0/L1/L2 patterns, depth limiting, permission intersection, performance targets
- `CLAUDE.md` § Architecture Fundamentals (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/data/cross-links.ts` — existing `getLinkedRecords()` and `getLinkedRecordCount()` (consumed or refactored)
- `apps/web/src/data/permissions.ts` — `getFieldPermissions()` for target table permission resolution
- `packages/shared/auth/permissions/resolve.ts` — pure resolution functions
- `packages/shared/auth/permissions/types.ts` — permission types

**From Prior Units:**
- Unit 1 output: `packages/shared/sync/cross-link-types.ts` — types and extraction utility
- Unit 2 output: `apps/web/src/data/cross-links.ts` — `getCrossLinkDefinition()`

**Acceptance Criteria:**
- [ ] L0 resolution extracts display values from canonical JSONB with zero database queries
- [ ] L1 resolution returns full linked records via single IN query, paginated, ordered by index creation time
- [ ] L2 resolution implements iterative bounded traversal with `visited` set for cycle detection
- [ ] L2 circuit breaker stops at >1,000 records at any level and returns truncated result with warning flag
- [ ] Depth limiting enforced: respects per-definition `maxDepth`, hard cap at 5 levels
- [ ] Permission intersection: card_fields intersected with user's target table permissions, only permitted fields returned
- [ ] Zero permitted fields → minimal `{ id, displayValue }` shape returned (graceful degradation)
- [ ] Tenant isolation tests for L1 and L2 resolution
- [ ] Performance: L1 with 20 links <50ms, L2 two-level 20→100 <200ms (integration test assertions)

**Estimated Complexity:** Medium

---

### Unit 4: Display Value Cascade & Scalability Infrastructure

**Big-Picture Anchor:** The write-amplification management layer. When a
target record's display field changes, all source records linking to it
need their cached `display_value` updated. This unit builds the BullMQ
cascade pipeline with content hash optimization, concurrency controls,
single-hop rule, job deduplication, sync backpressure, bulk deletion
cascade, display value ordering, and index consistency checks. This is
the infrastructure that makes cross-linking viable at scale.

**Produces:**
- `CrossLinkCascadeJobData` — job data type extending `BaseJobData` from `packages/shared/queue/types.ts`
- `CrossLinkIndexRebuildJobData` — job data type from `packages/shared/queue/types.ts`
- `QUEUE_NAMES['cross-link']` — new queue name constant from `packages/shared/queue/constants.ts`
- `processCrossLinkCascade(job: Job<CrossLinkCascadeJobData>): Promise<void>` — BullMQ processor from `apps/worker/src/processors/cross-link/cascade.ts`
- `processIndexRebuild(job: Job<CrossLinkIndexRebuildJobData>): Promise<void>` — BullMQ processor from `apps/worker/src/processors/cross-link/index-rebuild.ts`
- `enqueueCascadeJob(tenantId: string, targetRecordId: string, priority: 'high' | 'low'): Promise<void>` — enqueue helper with dedup jobId from `apps/web/src/lib/cross-link-cascade.ts`
- `checkCascadeBackpressure(tenantId: string): Promise<boolean>` — Redis counter check (`q:cascade:depth:{tenantId}`) from `apps/web/src/lib/cross-link-cascade.ts`
- `REALTIME_EVENTS.DISPLAY_VALUE_UPDATED` — real-time event for cascade completion from `apps/realtime/` event definitions
- `scheduleIntegrityCheck(tenantId: string, crossLinkId: string): Promise<void>` — weekly integrity sampling scheduler from `apps/worker/src/processors/cross-link/integrity-check.ts`

**Consumes:**
- `CrossLinkFieldValue`, `extractCrossLinkField`, `setCrossLinkField`, `CROSS_LINK_LIMITS` from Unit 1 — types, utilities, constants
- `crossLinkIndex` Drizzle table from `packages/shared/db/schema/` — index lookups for affected records
- `getDbForTenant()` from `packages/shared/db` — database access
- `BaseJobData`, `QueueJobDataMap` from `packages/shared/queue/types.ts` — job type system
- BullMQ `Worker`, `Job` from `bullmq` — job processing
- Redis client from `packages/shared/redis` — backpressure counter, pub/sub

**Side Effects:**
- Registers `cross-link` BullMQ queue in queue constants
- Updates `QueueJobDataMap` type with new job data types
- Writes to `records.canonical_data` (display value updates in batches)
- Publishes `records.batch_updated` real-time events per affected table
- Reads/writes Redis counter `q:cascade:depth:{tenantId}` for backpressure
- Writes condensed audit log entries for cascade mutations

**Context Manifest:**
- `cross-linking.md` § Display Value Maintenance (lines 268–287) — staleness, refresh triggers, content hash
- `cross-linking.md` § Scalability (lines 298–442) — full scalability section: cascade fan-out, concurrency, single-hop rule, job dedup, backpressure, bulk deletion, ordering, index sizing, write amplification, consistency
- `CLAUDE.md` § Architecture Fundamentals (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/queue/constants.ts` — existing queue names (extended)
- `packages/shared/queue/types.ts` — existing job types (extended)
- `apps/worker/src/queues.ts` — queue initialization pattern
- `apps/worker/src/lib/base-processor.ts` — processor base class
- `apps/worker/src/lib/job-wrapper.ts` — job wrapper utilities
- `apps/worker/src/index.ts` — worker entry point (register new processor)
- `packages/shared/db/schema/cross-link-index.ts` — index table for reverse lookups

**From Prior Units:**
- Unit 1 output: `packages/shared/sync/cross-link-types.ts` — types and utilities
- Unit 2 output: `apps/web/src/actions/cross-link-actions.ts` — enqueue calls (this unit implements the processor those calls target)

**Acceptance Criteria:**
- [ ] `cross-link` queue registered in `QUEUE_NAMES` and `QueueJobDataMap`
- [ ] Cascade processor: reads target record display value, computes content hash, skips cascade if unchanged (~70% skip rate path tested)
- [ ] Cascade processor: batches updates in chunks of 500 with 10ms inter-chunk sleep
- [ ] Cascade processor: publishes one `records.batch_updated` event per affected source table (not per record)
- [ ] Per-tenant cascade concurrency limited to 2 via BullMQ group concurrency
- [ ] Single-hop rule: events with `reason: 'display_value_refresh'` do NOT trigger further cascades
- [ ] Job deduplication: jobId `crosslink:cascade:{tenantId}:{targetRecordId}` prevents duplicate queue entries
- [ ] Sync backpressure: `checkCascadeBackpressure()` returns true when >500 pending jobs for tenant
- [ ] Display value ordering: `_display_updated_at` version stamp prevents stale updates
- [ ] Bulk deletion cascade: soft-delete table → background job clears dead links from canonical data + index in batches of 5,000
- [ ] Index integrity check: samples 100/500/1,000 entries by table size, alerts on >1% drift
- [ ] Unit tests for content hash skip logic, chunking, backpressure threshold, ordering guard

**Estimated Complexity:** High

---

### Unit 5: Link Picker UI

**Big-Picture Anchor:** The user-facing interface for creating and
managing record links. Opens from the Linked Record cell renderer (built
in 3A-i) or from Record View. Provides search, recent links, inline
record creation, and single/multi-link selection modes. Respects scope
filters and card_fields configuration.

**Produces:**
- `LinkPicker` — React component from `apps/web/src/components/cross-links/link-picker.tsx`
- `LinkPickerProvider` — context provider for Link Picker state from `apps/web/src/components/cross-links/link-picker-provider.tsx`
- `useLinkPicker()` — hook for opening/closing Link Picker from `apps/web/src/components/cross-links/use-link-picker.ts`
- `LinkedRecordChip` — display component for linked record pills (enhanced from existing renderer) from `apps/web/src/components/cross-links/linked-record-chip.tsx`
- `LinkPickerSearchResults` — search results list component from `apps/web/src/components/cross-links/link-picker-search-results.tsx`
- `LinkPickerInlineCreate` — inline record creation form from `apps/web/src/components/cross-links/link-picker-inline-create.tsx`
- `searchLinkableRecords(tenantId: string, crossLinkId: string, query: string, opts?: PaginationOpts): Promise<SearchResult[]>` — server function for tsvector search from `apps/web/src/data/cross-links.ts`
- `getRecentLinkedRecords(tenantId: string, crossLinkId: string, userId: string, limit?: number): Promise<DbRecord[]>` — recent links query from `apps/web/src/data/cross-links.ts`

**Consumes:**
- `CrossLinkFieldValue`, `LinkScopeFilter`, `CROSS_LINK_LIMITS` from Unit 1 — types and constants
- `linkRecords`, `unlinkRecords`, `getCrossLinkDefinition` from Unit 2 — CRUD actions and definition lookup
- `resolveLinkedRecordPermissions` from Unit 3 — permission-filtered card_fields for display
- shadcn/ui `Dialog`, `Command` (cmdk), `Input`, `Button`, `ScrollArea` — UI primitives
- Grid cell renderer integration point — existing Linked Record cell renderer opens Link Picker on click

**Side Effects:**
- Calls `linkRecords`/`unlinkRecords` server actions (side effects handled by Unit 2)

**Context Manifest:**
- `cross-linking.md` § Link Picker UX (lines 237–266) — search, recent, inline create, single/multi-link, mobile, card_fields config
- `cross-linking.md` § Data Model § Cross-Link Field Value (lines 94–113) — display value shape for chips
- `CLAUDE.md` § Component Conventions, § Design Philosophy (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `apps/web/src/components/grid/cells/` — existing cell renderers (LinkedRecord renderer integration point)
- `apps/web/src/components/record-view/` — Record View overlay (Link Picker opens from here)
- `apps/web/src/lib/stores/use-grid-store.ts` — grid state (optimistic update integration)
- shadcn/ui component files for Dialog, Command, ScrollArea

**From Prior Units:**
- Unit 1 output: `packages/shared/sync/cross-link-types.ts` — types
- Unit 2 output: `apps/web/src/actions/cross-link-actions.ts` — link/unlink actions
- Unit 2 output: `apps/web/src/data/cross-links.ts` — definition lookup, extended with search/recent
- Unit 3 output: `apps/web/src/data/cross-link-resolution.ts` — permission-filtered display

**Acceptance Criteria:**
- [ ] Link Picker opens from Linked Record cell click and Record View linked field
- [ ] Search uses tsvector prefix matching on target table's display field, paginated to 100 with scroll-to-load
- [ ] Recent section shows last 5 records linked by this user to this definition, above search results, hidden on active search
- [ ] Inline create: "+ New [target table name]" at bottom, compact form with card_fields, creates and links in one action
- [ ] Single-link mode (`many_to_one`): click to select and close, replaces existing link
- [ ] Multi-link mode (`one_to_many`): checkbox accumulation, pills above search, "Done" confirms
- [ ] Scope filter enforced: only matching target records shown in search results
- [ ] card_fields configuration: displays configured fields in search result previews
- [ ] Permission-aware: only shows fields the user has permission to see on target table
- [ ] Keyboard navigation: arrow keys to navigate results, Enter to select, Escape to close
- [ ] Linked record chips show display value with shimmer animation while cascade in-flight
- [ ] i18n: all user-facing strings through next-intl

**Estimated Complexity:** Medium

---

## Cross-Unit Integration Points

1. **Unit 2 → Unit 4 (enqueue):** `linkRecords`/`unlinkRecords` in Unit 2
   enqueue `update_cross_link_display_values` jobs. Unit 2 imports the
   `enqueueCascadeJob` helper from Unit 4. If Unit 4 is not yet built,
   Unit 2 can stub the enqueue as a no-op with a `// TODO: Unit 4` comment.

2. **Unit 2 → Unit 3 (existing data functions):** Unit 3 may refactor or
   extend the existing `getLinkedRecords()` from `cross-links.ts`. The
   existing function (written in 3A-ii) continues to work — Unit 3 adds
   L2 traversal and permission intersection alongside it.

3. **Unit 5 → Units 2 + 3 (actions + resolution):** Link Picker calls
   Unit 2's server actions for link/unlink and Unit 3's permission
   resolution for display filtering. These are import-level dependencies
   with no shared mutable state.

4. **Unit 4 → Real-time service:** Cascade completion publishes
   `records.batch_updated` events. The real-time infrastructure from 1G
   routes these to connected clients. No new real-time event types needed
   beyond the existing `records.batch_updated` pattern.

5. **Unit 1 → FieldTypeRegistry:** The `linked_record` registration
   allows the sync engine adapters to recognize cross-link fields during
   inbound sync without special-casing.

## Context Budget Verification

| Unit | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-------------|-------------|---------------|-------------|--------|
| 1    | 3 sections (~110 lines) | 5 files (~400 lines) | 0 | ~17,000 | Yes |
| 2    | 5 sections (~230 lines) | 8 files (~700 lines) | 3 files (~300 lines) | ~24,500 | Yes |
| 3    | 1 section (~104 lines) | 4 files (~500 lines) | 2 files (~250 lines) | ~20,000 | Yes |
| 4    | 2 sections (~165 lines) | 7 files (~550 lines) | 2 files (~250 lines) | ~21,000 | Yes |
| 5    | 2 sections (~50 lines) | 4 files (~400 lines) | 4 files (~350 lines) | ~19,500 | Yes |

All units well under the ~40% context budget threshold (~80,000 tokens).
Tightest budget: Unit 2 at ~24,500 tokens (~12%).
