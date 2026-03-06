# Phase 2B — Synced Data Performance, Outbound Sync, Conflict Resolution

## Phase Context

### What Has Been Built

**Phase 1 (MVP — Foundation) is complete and merged to main.** Key outputs relevant to Phase 2B:

- **1A:** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI. ESLint + Prettier.
- **1B:** Drizzle schema for all 52 MVP tables including `base_connections`, `tables`, `fields`, `records`, `synced_field_mappings`, `sync_conflicts`, `sync_failures`, `sync_schema_changes`. `getDbForTenant()` with read/write routing. RLS policies. UUIDv7 primary keys.
- **1C:** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities. `PermissionDeniedError` shape.
- **1D:** Pino structured logging with `AsyncLocalStorage` traceId. Sentry integration. OpenTelemetry basic instrumentation. Security headers middleware.
- **1E:** Vitest workspace config. Playwright E2E setup. Test data factories for all core tables (`createTestTenant()`, `createTestRecord()`, etc.). `testTenantIsolation()` helper. MSW mock setup.
- **1F:** shadcn/ui primitives installed. Tailwind config with three-layer color architecture. DM Sans + JetBrains Mono fonts. Responsive application shell layout with sidebar.
- **1G:** Socket.io server with Clerk JWT auth and Redis adapter. Room join/leave model. BullMQ worker skeleton with queue definitions. StorageClient + R2.
- **1I:** `writeAuditLog()` helper with seven-source attribution. `api_keys` table with SHA-256 hashing. API auth middleware. Token-bucket rate limiting.
- **1J:** CP-001/CP-002 schema migrations. Auth middleware updated to `effective_memberships`. Sidebar navigation tree with tenant switching.

**Phase 2A (FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter) is complete and merged to main.** Key outputs relevant to Phase 2B:

- `FieldTransform` interface with `toCanonical`/`fromCanonical`/`isLossless`/`supportedOperations` per field type.
- `FieldTypeRegistry` singleton in `packages/shared/sync/field-registry.ts` with ~40 MVP field type registrations for Airtable.
- `AirtableAdapter` full implementation — `toCanonical()` and `fromCanonical()` for all MVP field types.
- Canonical value type system in `packages/shared/sync/types.ts`.
- Lossy field marking (`isLossless: false` for Lookup, Rollup, Formula — read-only with lock icon).
- `source_refs` map pattern for lossless round-tripping.
- Airtable OAuth flow + token storage on `base_connections`.
- Sync setup wizard UI (3-step: authenticate → select base → select tables with filters).
- `SyncConfig`/`SyncTableConfig` JSONB shape on `base_connections.sync_config`.
- `FilterRule[]` grammar (shared with grid view filters) + Airtable filter pushdown (`filterByFormula`).
- Progressive initial sync BullMQ pipeline (schema → first page → background remainder with progress indicator).
- Record quota enforcement (setup wizard preventive check + runtime batch check + Redis quota cache at `quota:records:{tenantId}`).
- `PlatformRateLimits` config interface + Airtable rate limit registration (5 req/s per base, 50 req/s per API key).
- Redis token-bucket rate limiter (ZSET per key, scored by timestamp, atomic Lua script).
- Sync orphan detection + orphan UX. Cross-links to filtered-out records (`filtered_out` flag).
- `synced_field_mappings` populated during initial sync.

### What This Phase Delivers

When Phase 2B is complete, EveryStack can:

1. Query synced data with JSONB expression indexes on frequently sorted/filtered field paths, achieving <200ms grid query targets on tables up to 50K records.
2. Edit any cell in a synced table with optimistic UI — the local JSONB updates instantly, the grid re-renders immediately, and an outbound sync BullMQ job pushes the change to the source platform using `fromCanonical()`.
3. Detect conflicts on inbound sync using three-way comparison (inbound platform value vs `last_synced_value` vs current `canonical_data`) and populate the `sync_conflicts` table.
4. Apply last-write-wins as the default resolution strategy (inbound wins, local value preserved in conflict record for recovery).
5. Allow Managers to toggle manual conflict resolution mode per synced table.
6. Present a full conflict resolution modal UI: single-field (Keep EveryStack / Keep Remote / Edit merged) and multi-field (scrollable list with per-field and bulk actions).
7. Render conflict indicators in the grid: 4px amber triangle in cell top-right, dashed amber underline, row index amber badge, toolbar conflict count badge with click-to-filter.
8. Enforce role-based conflict visibility: Owner/Admin/Manager see full resolution UI; Team Member sees amber indicator + tooltip but cannot resolve; Viewer sees no indicator.
9. Push conflict events in real-time via Socket.io/Redis pub-sub (`sync.conflict_detected`, `sync.conflict_resolved`) so cells re-render without page reload.
10. Provide optimistic conflict resolution with an 8-second undo toast.
11. Auto-enqueue outbound sync on "Keep EveryStack" or merged resolution (P1 priority).
12. Support bulk conflict resolution ("Resolve All: Keep EveryStack" / "Resolve All: Keep Remote").
13. Write conflict resolution events to the audit log via `writeAuditLog()`.

### What This Phase Does NOT Build

- **Smart polling / adaptive intervals** (2C) — no 30s→5m→30min→event-driven logic
- **Priority-based job scheduling** P0–P3 or multi-tenant fairness (2C)
- **Notion adapter** (2C)
- **Sync error recovery flows** — auth expired, partial failure, platform unavailable, schema mismatch, quota exceeded recovery UX (2C)
- **Sync settings dashboard** — the 6-tab management panel (2C)
- **Schema change detection** — `sync_schema_changes` population and review UI (2C)
- **Full grid view architecture** — TanStack Table setup, cell renderers, inline editing, views (Phase 3). 2B provides conflict overlays and the JSONB performance layer consumed by Phase 3.
- **`record_cells` denormalization** — Core UX optimization, only if JSONB expression indexes fail <200ms targets. Documented as a decision point.
- **Kanban, Calendar, or any post-MVP view types**
- **Formula engine or computed fields**
- **App Designer or App Portals**
- **Visual automation canvas**
- **Governed Status field transitions** (post-MVP: Approval Workflows)
- **Mobile conflict resolution** — responsive tablet/phone layouts for the conflict modal (Phase 3H builds mobile feature adaptation; 2B ensures desktop-first conflict UI is semantically ready for responsive extension)

### Architecture Patterns for This Phase

1. **JSONB expression indexes, not denormalization.** Grid queries run against `canonical_data` JSONB with expression indexes on commonly sorted/filtered paths. Sufficient for tables up to ~50K records. The `record_cells` denormalization is a documented decision point for later, not a Phase 2B deliverable.

2. **Optimistic UI → Queue → Outbound sync.** Cell edits update local JSONB immediately, re-render the grid from local data, then queue a BullMQ outbound sync job. Failures show inline warnings.

3. **Three-way conflict detection.** Inbound sync compares: (a) inbound platform value vs (b) `last_synced_value` (stored in `sync_metadata` JSONB per-field) vs (c) current `canonical_data`. Both (a) and (c) diverging from (b) = conflict. Only one diverging = clean change.

4. **Last-write-wins default, manual override per table.** The safest default. Managers can switch a synced table to manual resolution mode. Conflict records always created for recovery regardless of mode.

5. **Conflict state as derived cell meta.** Conflict data is a `_conflicts` map on each record, fetched alongside record data and updated via real-time events. Not a separate TanStack Table column.

6. **CockroachDB safeguards remain active:** UUIDv7 for all PKs, no PG-specific syntax in application queries, explicit transaction boundaries via `getDbForTenant()`, no advisory locks (use Redis-based locks), hash partitioning compatible schemas.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

### Skills for This Phase

Load these skill files before executing any prompt in this phase:
- `docs/skills/backend/SKILL.md` — Database patterns, sync engine conventions, BullMQ job patterns, Redis usage, testing patterns
- `docs/skills/ux-ui/SKILL.md` — Color architecture, component conventions, responsive patterns, accessibility
- `docs/skills/phase-context/SKILL.md` — Current build state, existing files/modules, active conventions

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | JSONB expression indexes on canonical_data for frequently sorted/filtered paths | None | ~200 |
| 2 | sync_metadata JSONB shape and last_synced_value tracking on records | None | ~200 |
| 3 | Outbound sync BullMQ job with fromCanonical() and rate-limited platform write | 2 | ~300 |
| 4 | Optimistic UI for synced table cell edits with outbound sync enqueue | 3 | ~250 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–4) | 1–4 | — |
| 5 | Three-way conflict detection on inbound sync with sync_conflicts population | 2 | ~300 |
| 6 | Default last-write-wins resolution and manual resolution mode toggle | 5 | ~200 |
| 7 | Conflict resolution modal UI — single-field and multi-field with bulk actions | 6 | ~350 |
| 8 | Grid-level conflict rendering — cell indicators, row badges, toolbar conflict badge | 5 | ~300 |
| CP-2 | Integration Checkpoint 2 (after Prompts 5–8) | 5–8 | — |
| 9 | Real-time conflict push via Socket.io/Redis and client-side _conflicts map updates | 5, 8 | ~250 |
| 10 | Conflict resolution Server Action with optimistic UI, undo toast, and outbound sync enqueue | 6, 7, 9 | ~300 |
| 11 | Role-based conflict visibility, bulk resolution, conflict audit trail, and feature interaction rules | 8, 10 | ~250 |
| CP-3 | Final Integration Checkpoint + PR | 9–11 | — |

---

## Prompt 1: JSONB Expression Indexes on canonical_data

**Depends on:** None (Phase 2A complete — canonical data present in DB)
**Skills:** backend, phase-context
**Load context:** `database-scaling.md` lines 486–498 (JSONB Expression Indexes), `sync-engine.md` lines 437–443 (Performance Strategy Layers 2–3)
**Target files:** `packages/shared/db/migrations/XXXX_jsonb_expression_indexes.ts`, `packages/shared/db/index-utils.ts`
**Migration required:** Yes — `CREATE INDEX CONCURRENTLY` (no ACCESS EXCLUSIVE lock). Migration must NOT be inside a transaction (CONCURRENTLY requires no wrapping transaction).
**Git:** Create and checkout branch `feat/phase-2b-outbound-sync-conflicts` from `main`. After completing, commit with message `feat(db): add JSONB expression indexes on canonical_data for grid query performance [Phase 2B, Prompt 1]`

### Schema Snapshot

```
records: id (UUIDv7 PK), tenant_id, table_id, canonical_data (JSONB — keyed by fields.id), sync_metadata (JSONB), search_vector (tsvector), deleted_at, created_by, updated_by, created_at, updated_at

fields: id (UUIDv7 PK), table_id, tenant_id, name, field_type (VARCHAR), is_primary, sort_order (INTEGER), config (JSONB), created_at, updated_at
```

### Task

Build the JSONB expression index infrastructure for grid query performance on synced tables.

**1. Create a migration for expression indexes on `canonical_data`.**

Expression indexes on JSONB paths provide column-level query performance without denormalization. The pattern:

```sql
CREATE INDEX CONCURRENTLY idx_records_field_{fieldId_short} ON records USING btree (
  tenant_id, (canonical_data->'fields'->'{field_id}'->>'value')
) WHERE canonical_data->'fields'->'{field_id}' IS NOT NULL;
```

For MVP, create expression indexes for the most common sort/filter patterns. Since field IDs are dynamic (per-tenant), build a **utility function** that generates and executes `CREATE INDEX CONCURRENTLY` statements for specified field paths. This utility will be called:
- Manually by admins to index hot fields
- Automatically in a future phase when query pattern analysis is available

**2. Build `packages/shared/db/index-utils.ts`:**

```typescript
export async function createFieldExpressionIndex(
  tenantId: string,
  tableId: string,
  fieldId: string,
  fieldType: string,
): Promise<void>
```

This function:
- Generates a deterministic index name: `idx_rec_{short_hash(tenantId, tableId, fieldId)}`
- Determines the appropriate JSONB path expression based on field type (e.g., text fields use `->>'value'`, number fields use a cast to numeric for sort correctness)
- Executes `CREATE INDEX CONCURRENTLY IF NOT EXISTS` via raw SQL (this is one of the rare cases where raw SQL is acceptable — Drizzle does not support `CREATE INDEX CONCURRENTLY` or expression indexes)
- Logs index creation via Pino

Also build the complementary:
```typescript
export async function dropFieldExpressionIndex(
  tenantId: string,
  tableId: string,
  fieldId: string,
): Promise<void>
```

**3. Build `packages/shared/db/query-helpers.ts` (or extend existing):**

Add a helper that constructs Drizzle `WHERE` and `ORDER BY` clauses using JSONB path expressions that match the expression index patterns. This ensures queries written later (Phase 3 grid) automatically benefit from the indexes.

```typescript
export function canonicalFieldExpression(fieldId: string, fieldType: string): SQL
export function canonicalFieldOrderBy(fieldId: string, fieldType: string, direction: 'asc' | 'desc'): SQL
```

**4. Document the `record_cells` decision point:**

Add a code comment in `index-utils.ts` referencing the decision point from `database-scaling.md`: "If expression indexes cannot meet <200ms grid query targets on 50K+ record tables, introduce the `record_cells` denormalized read cache (see data-model.md)."

### Acceptance Criteria

- [ ] `createFieldExpressionIndex()` generates and executes a valid `CREATE INDEX CONCURRENTLY` statement
- [ ] `dropFieldExpressionIndex()` drops the matching index
- [ ] Index names are deterministic and do not exceed PostgreSQL's 63-character limit
- [ ] `canonicalFieldExpression()` returns correct SQL for text, number, date, single_select, and checkbox field types
- [ ] `canonicalFieldOrderBy()` returns correct SQL with proper type casting (numeric for numbers, text for text)
- [ ] Unit tests cover all 5 field type expressions with round-trip query validation
- [ ] Integration test creates an index on a test table and verifies `EXPLAIN` shows index scan for a matching query
- [ ] `testTenantIsolation()` passes — expression index queries still respect `tenant_id` scoping
- [ ] Raw SQL usage is limited to index DDL and JSONB path expressions — all other queries use Drizzle
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Automatic index suggestion based on query patterns (future — mentioned in `database-scaling.md` as "future: automatic index suggestion based on query patterns observed via OpenTelemetry")
- `record_cells` denormalized read cache (only if expression indexes prove insufficient — decision point documented, not implemented)
- Grid view queries or cell renderers (Phase 3)
- Per-tenant index management UI

---

## Prompt 2: sync_metadata JSONB Shape and last_synced_value Tracking

**Depends on:** None (Phase 2A complete)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 543–549 (Conflict Detection — three-way comparison), `data-model.md` lines 104–112 (Sync tables), `sync-engine.md` lines 30–65 (Core Pattern, Source References)
**Target files:** `packages/shared/sync/types.ts` (extend), `packages/shared/sync/sync-metadata.ts`, `apps/worker/src/jobs/sync-inbound.ts` (extend)
**Migration required:** No — `sync_metadata` JSONB column already exists on `records` from Phase 1B. This prompt defines the shape and populates it.
**Git:** Commit with message `feat(sync): define sync_metadata JSONB shape and last_synced_value tracking [Phase 2B, Prompt 2]`

### Schema Snapshot

```
records.sync_metadata (JSONB — currently unpopulated):
  Shape to define:
  {
    last_synced_at: ISO 8601 timestamp,
    last_synced_values: {
      [fieldId: string]: {
        value: CanonicalFieldValue,  // The canonical value at last successful sync
        synced_at: ISO 8601 timestamp
      }
    },
    sync_status: 'active' | 'orphaned',
    sync_direction: 'inbound' | 'outbound' | 'both'
  }
```

### Task

Define the `sync_metadata` JSONB shape and integrate it into the inbound sync pipeline so that every synced record tracks its `last_synced_values` per field — the "base value" needed for three-way conflict detection.

**1. Define `SyncMetadata` type in `packages/shared/sync/types.ts`:**

```typescript
export interface SyncMetadata {
  last_synced_at: string; // ISO 8601
  last_synced_values: Record<string, {
    value: CanonicalFieldValue;
    synced_at: string; // ISO 8601
  }>;
  sync_status: 'active' | 'orphaned';
  sync_direction: 'inbound' | 'outbound' | 'both';
}
```

**2. Build `packages/shared/sync/sync-metadata.ts`:**

Utility functions for working with sync_metadata:

- `updateLastSyncedValues(existingMetadata: SyncMetadata, updatedFieldIds: string[], canonicalData: CanonicalData): SyncMetadata` — Updates the `last_synced_values` map for the specified fields with their current canonical values and timestamps.
- `getLastSyncedValue(metadata: SyncMetadata, fieldId: string): CanonicalFieldValue | undefined` — Retrieves the last synced value for a specific field.
- `createInitialSyncMetadata(canonicalData: CanonicalData, fieldIds: string[]): SyncMetadata` — Creates the initial sync_metadata for a freshly synced record, setting all fields' last_synced_values to their current canonical values.

**3. Update the inbound sync pipeline (`apps/worker/src/jobs/sync-inbound.ts`):**

After each successful inbound sync batch, update `records.sync_metadata` with the newly synced values:
- For new records: call `createInitialSyncMetadata()` and write to the record.
- For updated records: call `updateLastSyncedValues()` for the changed fields.

This must happen in the same transaction as the canonical_data write to ensure consistency between the two JSONB columns.

**4. Add a Zod schema for `SyncMetadata`** to validate the JSONB shape on read.

### Acceptance Criteria

- [ ] `SyncMetadata` type is exported from `packages/shared/sync/types.ts`
- [ ] `createInitialSyncMetadata()` correctly populates all synced field values with timestamps
- [ ] `updateLastSyncedValues()` updates only specified fields, preserves others
- [ ] `getLastSyncedValue()` returns the correct value or undefined for non-synced fields
- [ ] Inbound sync pipeline writes `sync_metadata` to new records during initial sync
- [ ] Inbound sync pipeline updates `sync_metadata` for changed fields during incremental sync
- [ ] `sync_metadata` update and `canonical_data` update occur in the same database transaction
- [ ] Zod schema validates the `SyncMetadata` JSONB shape
- [ ] `testTenantIsolation()` passes for any new data access functions
- [ ] Unit tests cover all utility functions with edge cases (empty metadata, partial updates, missing fields)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Conflict detection logic (Prompt 5)
- Outbound sync pipeline (Prompt 3)
- `sync_metadata` for native (non-synced) tables — only synced records get this metadata
- Field-level sync history or versioning beyond `last_synced_values`

---

## Prompt 3: Outbound Sync BullMQ Job with fromCanonical() and Rate-Limited Platform Write

**Depends on:** Prompt 2 (sync_metadata tracking — outbound sync must update `last_synced_values` after successful platform write)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 446–453 (Layer 4 — Optimistic UI for Edits), `sync-engine.md` lines 30–43 (Core Pattern — Adapter.fromCanonical()), `data-model.md` lines 649–660 (Outbound sync flow)
**Target files:** `apps/worker/src/jobs/sync-outbound.ts`, `packages/shared/sync/outbound.ts`, `packages/shared/sync/types.ts` (extend with outbound types)
**Migration required:** No
**Git:** Commit with message `feat(sync): outbound sync BullMQ job with fromCanonical() and rate-limited platform write [Phase 2B, Prompt 3]`

### Schema Snapshot

```
records: id (UUIDv7 PK), tenant_id, table_id, canonical_data (JSONB), sync_metadata (JSONB — includes last_synced_values), source_refs (JSONB)
base_connections: id, tenant_id, platform, access_token (encrypted), sync_config (JSONB), health (JSONB)
synced_field_mappings: id, tenant_id, base_connection_id, table_id, field_id, external_field_id, external_field_type, status
```

### Task

Build the outbound sync pipeline that pushes EveryStack edits to the source platform via BullMQ.

**1. Define outbound sync types in `packages/shared/sync/types.ts`:**

```typescript
export interface OutboundSyncJob {
  tenantId: string;
  recordId: string;
  tableId: string;
  baseConnectionId: string;
  changedFieldIds: string[];  // Which fields were edited
  editedBy: string;           // User ID who made the edit
  priority: number;           // 0 = P0 (highest), 1 = P1, etc.
}

export interface OutboundSyncResult {
  success: boolean;
  recordId: string;
  syncedFieldIds: string[];
  failedFieldIds?: string[];
  error?: { code: string; message: string };
}
```

**2. Build `packages/shared/sync/outbound.ts`:**

Core outbound sync logic:

```typescript
export async function executeOutboundSync(job: OutboundSyncJob): Promise<OutboundSyncResult>
```

This function:
1. Reads the record's current `canonical_data` and `source_refs` from the database.
2. For each changed field, looks up the `synced_field_mapping` to get `external_field_id` and `external_field_type`.
3. Calls the adapter's `fromCanonical()` (via FieldTypeRegistry) to transform each changed field back to platform-native format.
4. Acquires a rate limit token from the Redis token-bucket rate limiter (built in Phase 2A).
5. Calls the platform API to update the record (Airtable: `PATCH /v0/{baseId}/{tableIdOrName}/{recordId}`).
6. On success: updates `sync_metadata.last_synced_values` for the changed fields (same transaction as step 7).
7. On success: updates `records.sync_metadata.last_synced_at`.
8. On failure: returns `OutboundSyncResult` with error details. Does NOT retry here — retries are handled by BullMQ.

**3. Build `apps/worker/src/jobs/sync-outbound.ts`:**

BullMQ job processor:
- Registers queue `sync:outbound` (or extends the existing sync queue with a named processor).
- Processes `OutboundSyncJob` payloads by calling `executeOutboundSync()`.
- Configures BullMQ retry: 3 attempts with exponential backoff (1min, 5min, 15min).
- On final failure (3 retries exhausted): update `records.sync_metadata.sync_status` to flag the issue. Log via Pino + Sentry.

**4. Build the enqueue helper:**

```typescript
export async function enqueueOutboundSync(
  tenantId: string,
  recordId: string,
  tableId: string,
  changedFieldIds: string[],
  editedBy: string,
  priority?: number,
): Promise<void>
```

This is the function that Server Actions and other code will call to trigger an outbound sync. It:
- Looks up the `base_connection` for the table to determine if it's a synced table.
- If not synced, returns immediately (no-op for native tables).
- If synced, adds a BullMQ job to the `sync:outbound` queue.
- Deduplicates: if an outbound sync job for the same `recordId` is already in the queue, merge the `changedFieldIds` rather than creating a duplicate job.

**5. Skip computed fields:**

Per CLAUDE.md: "Never sync computed fields back to platforms — Lookup, Rollup, Formula, Count are read-only." Check `field.read_only` or field type in the isLossless registry. If a changed field is computed/read-only, skip it in the outbound payload.

### Acceptance Criteria

- [ ] `executeOutboundSync()` transforms changed fields via `fromCanonical()` and writes to the platform API
- [ ] Rate limit token acquired before platform API call (uses Redis token-bucket from Phase 2A)
- [ ] `sync_metadata.last_synced_values` updated for changed fields on successful outbound sync
- [ ] Computed fields (Lookup, Rollup, Formula, Count) are excluded from outbound payloads
- [ ] BullMQ job processor handles retries with exponential backoff (3 attempts)
- [ ] `enqueueOutboundSync()` deduplicates jobs for the same record (merges changedFieldIds)
- [ ] `enqueueOutboundSync()` is a no-op for native (non-synced) tables
- [ ] Unit tests cover: successful sync, rate limit wait, platform API error, computed field skip, deduplication
- [ ] Integration test with MSW mock verifies end-to-end outbound flow
- [ ] `testTenantIsolation()` passes for any new data access functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥85% on `packages/shared/sync/outbound.ts`

### Do NOT Build

- Optimistic UI for cell edits (Prompt 4 — this prompt builds the backend pipeline only)
- Conflict detection on outbound failures (Prompt 5)
- Priority-based scheduling P0–P3 (Phase 2C)
- Multi-tenant fairness or capacity-based dispatch (Phase 2C)
- Notion or SmartSuite outbound — only Airtable for now (adapter pattern is platform-agnostic, Notion added in 2C)

---

## Prompt 4: Optimistic UI for Synced Table Cell Edits with Outbound Sync Enqueue

**Depends on:** Prompt 3 (outbound sync pipeline — `enqueueOutboundSync()` must exist)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 446–453 (Layer 4 — Optimistic UI for Edits), `data-model.md` lines 649–660 (Outbound sync flow)
**Target files:** `apps/web/src/actions/sync-edit.ts`, `apps/web/src/data/records.ts` (extend)
**Migration required:** No
**Git:** Commit with message `feat(sync): optimistic UI for synced table cell edits with outbound sync enqueue [Phase 2B, Prompt 4]`

### Schema Snapshot

```
records: id (UUIDv7 PK), tenant_id, table_id, canonical_data (JSONB), sync_metadata (JSONB), updated_by, updated_at
base_connections: id, tenant_id, platform, sync_config (JSONB)
```

### Task

Build the Server Action for editing a cell in a synced table with optimistic local update and background outbound sync.

**1. Build `apps/web/src/actions/sync-edit.ts`:**

Create a Server Action `updateSyncedRecordField` that:

1. Validates input via Zod: `{ recordId, fieldId, newValue, tableId }`.
2. Verifies the field is editable (not computed, not read-only per `fields.read_only` or `isLossless: false`).
3. Updates `records.canonical_data` in PostgreSQL immediately via `getDbForTenant(tenantId, 'write')`:
   - Set `canonical_data->'fields'->{fieldId}` to the new canonical value.
   - Set `updated_by` and `updated_at`.
4. Updates `records.search_vector` via `buildSearchVector()` in the same transaction (search vector must stay in sync with canonical data — see `database-scaling.md` tsvector strategy).
5. Calls `enqueueOutboundSync()` to queue the platform write.
6. Returns the updated record immediately (for optimistic UI — the client renders the new value without waiting for the platform write).

**2. Handle outbound sync failure feedback:**

Build a helper function `getOutboundSyncStatus(recordId: string, fieldId: string)` in `apps/web/src/data/records.ts` that checks whether the most recent outbound sync for a field succeeded or failed. This will be used by the grid to show subtle inline warnings on fields where outbound sync failed.

The status check queries the BullMQ job state (completed vs failed) for the most recent `sync:outbound` job matching the record. Return: `'synced' | 'pending' | 'failed'`.

**3. Validate computed field protection:**

If the user attempts to edit a computed field (Lookup, Rollup, Formula, Count), the Server Action should return a validation error: `{ code: 'VALIDATION_FAILED', message: 'This field is synced from {platform} and cannot be edited.' }`.

### Acceptance Criteria

- [ ] `updateSyncedRecordField` updates `canonical_data` locally and returns the updated record immediately
- [ ] `search_vector` is updated in the same transaction as `canonical_data`
- [ ] `enqueueOutboundSync()` is called after local update
- [ ] Computed fields (Lookup, Rollup, Formula, Count) return a validation error when edit is attempted
- [ ] `getOutboundSyncStatus()` correctly reports `synced`, `pending`, or `failed`
- [ ] Zod validation rejects malformed input
- [ ] `testTenantIsolation()` passes for `updateSyncedRecordField` — cannot edit records in another tenant
- [ ] Unit tests cover: successful edit, computed field rejection, invalid input
- [ ] Integration test verifies local update + outbound job enqueued (MSW mock for Airtable API)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥90% on `apps/web/src/actions/sync-edit.ts`

### Do NOT Build

- Cell renderer UI or inline editing component (Phase 3 — Grid View Core)
- Client-side optimistic state management with Zustand/TanStack Query (Phase 3)
- Conflict detection on outbound failure (Prompt 5)
- Real-time push of edit events to other clients (Prompt 9 covers conflict push; record.updated events are part of Phase 3 real-time grid)

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all work from Prompts 1–4 integrates correctly.

**Skills:** backend, phase-context

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations (Prompt 1's CONCURRENTLY index migration must pass)
6. Manual verification:
   - Confirm `createFieldExpressionIndex()` can create an index on a test field and `EXPLAIN` shows index scan
   - Confirm inbound sync writes `sync_metadata.last_synced_values` to records
   - Confirm `updateSyncedRecordField()` updates canonical_data and enqueues outbound sync job
   - Confirm outbound sync job processes and calls the Airtable API (via MSW mock)

**Git:** Commit with message `chore(verify): integration checkpoint 1 — JSONB indexes, sync_metadata, outbound sync [Phase 2B, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Three-Way Conflict Detection on Inbound Sync with sync_conflicts Population

**Depends on:** Prompt 2 (sync_metadata with `last_synced_values` — the "base value" for three-way comparison)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 535–570 (Conflict Detection, Conflict Record Schema)
**Target files:** `packages/shared/sync/conflict-detection.ts`, `apps/worker/src/jobs/sync-inbound.ts` (extend), `packages/shared/sync/types.ts` (extend)
**Migration required:** No — `sync_conflicts` table already exists from Phase 1B.
**Git:** Commit with message `feat(sync): three-way conflict detection on inbound sync with sync_conflicts population [Phase 2B, Prompt 5]`

### Schema Snapshot

```
sync_conflicts: id (UUID PK), tenant_id, record_id, field_id, local_value (JSONB), remote_value (JSONB), base_value (JSONB), platform (VARCHAR), status (VARCHAR: pending|resolved_local|resolved_remote|resolved_merged), resolved_by (UUID nullable), created_at, resolved_at (nullable)

records.sync_metadata.last_synced_values: {
  [fieldId]: { value: CanonicalFieldValue, synced_at: string }
}

records.canonical_data: { fields: { [fieldId]: CanonicalFieldValue } }
```

### Task

Build the three-way conflict detection algorithm and integrate it into the inbound sync pipeline.

**1. Build `packages/shared/sync/conflict-detection.ts`:**

```typescript
export interface ConflictDetectionResult {
  conflicts: DetectedConflict[];
  cleanChanges: CleanChange[];
  unchanged: string[]; // fieldIds with no change
}

export interface DetectedConflict {
  fieldId: string;
  localValue: CanonicalFieldValue;   // Current canonical_data value
  remoteValue: CanonicalFieldValue;  // Inbound platform value (after toCanonical)
  baseValue: CanonicalFieldValue;    // last_synced_value
}

export interface CleanChange {
  fieldId: string;
  newValue: CanonicalFieldValue;
  source: 'remote' | 'local'; // Who changed it
}
```

```typescript
export function detectConflicts(
  currentCanonical: CanonicalData,
  inboundCanonical: CanonicalData,
  syncMetadata: SyncMetadata,
  syncedFieldIds: string[],
): ConflictDetectionResult
```

The three-way comparison per field:
1. Get `baseValue` from `syncMetadata.last_synced_values[fieldId].value`
2. Get `localValue` from `currentCanonical.fields[fieldId]`
3. Get `remoteValue` from `inboundCanonical.fields[fieldId]`
4. Compare using deep equality (JSON.stringify or a proper deep-equal utility):
   - `localValue === baseValue` AND `remoteValue !== baseValue` → **clean remote change** (apply it)
   - `localValue !== baseValue` AND `remoteValue === baseValue` → **clean local change** (keep it, no action)
   - `localValue !== baseValue` AND `remoteValue !== baseValue` AND `localValue !== remoteValue` → **CONFLICT**
   - Both changed to the same value → **convergent change** (no conflict, treat as clean)
   - All three equal → **unchanged**

**2. Integrate into inbound sync pipeline (`apps/worker/src/jobs/sync-inbound.ts`):**

Extend the existing inbound sync job to:
1. For each record in the inbound batch, call `detectConflicts()`.
2. For clean remote changes: apply them to `canonical_data` and update `sync_metadata.last_synced_values`.
3. For conflicts: write a `sync_conflicts` record per conflicted field (using the schema above).
4. For clean local changes: no action (local value preserved, not overwritten).

**3. Build conflict record writer:**

```typescript
export async function writeConflictRecords(
  tx: Transaction,
  tenantId: string,
  recordId: string,
  conflicts: DetectedConflict[],
  platform: string,
): Promise<string[]> // Returns conflict IDs
```

This writes one `sync_conflicts` row per conflicted field with `status: 'pending'`.

**4. Handle edge cases:**

- If `sync_metadata` is null or `last_synced_values` is empty for a field (first sync after Phase 2B deployment for records that were synced in 2A without this tracking), treat the inbound value as a clean remote change (no base for comparison → can't detect conflict).
- If the record doesn't exist locally (new record from platform), create it normally — no conflict possible.
- Null/undefined values: treat null and undefined as equivalent in comparisons.

### Acceptance Criteria

- [ ] `detectConflicts()` correctly identifies conflicts, clean changes, and unchanged fields using three-way comparison
- [ ] Convergent changes (both sides changed to same value) are NOT flagged as conflicts
- [ ] `sync_conflicts` records are written for each conflicted field with correct `local_value`, `remote_value`, `base_value`
- [ ] Clean remote changes are applied to `canonical_data` and `sync_metadata` is updated
- [ ] Clean local changes are preserved — inbound sync does not overwrite them
- [ ] Edge case: records without `sync_metadata` treat inbound values as clean changes
- [ ] `writeConflictRecords()` uses the existing `sync_conflicts` table from Phase 1B
- [ ] `testTenantIsolation()` passes — conflict records respect tenant_id scoping
- [ ] Unit tests cover: all 5 comparison outcomes, null value handling, convergent change, missing sync_metadata
- [ ] Integration test verifies end-to-end: inbound sync with mixed conflicts and clean changes
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥90% on `packages/shared/sync/conflict-detection.ts`

### Do NOT Build

- Conflict resolution UI or Server Action (Prompts 6–7, 10)
- Grid conflict rendering (Prompt 8)
- Real-time conflict push (Prompt 9)
- Default last-write-wins auto-resolution (Prompt 6)
- Governed Status field transition enforcement (post-MVP: Approval Workflows)

---

## Prompt 6: Default Last-Write-Wins Resolution and Manual Resolution Mode Toggle

**Depends on:** Prompt 5 (conflict detection and `sync_conflicts` population)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 571–608 (Default Resolution: Last-Write-Wins, Manual Resolution UI — resolution actions only)
**Target files:** `packages/shared/sync/conflict-resolution.ts`, `apps/web/src/actions/sync-settings.ts`, `apps/web/src/data/sync-settings.ts`
**Migration required:** No — `base_connections.sync_config` JSONB already exists (Phase 1B/2A). A new key `manual_conflict_resolution` is added to the JSONB.
**Git:** Commit with message `feat(sync): default last-write-wins resolution and manual resolution mode toggle [Phase 2B, Prompt 6]`

### Schema Snapshot

```
sync_conflicts: id, tenant_id, record_id, field_id, local_value, remote_value, base_value, platform, status, resolved_by, created_at, resolved_at
base_connections.sync_config (JSONB — extend with):
  {
    ...existing,
    manual_conflict_resolution: boolean  // NEW — default: false
  }
```

### Task

Build the default conflict resolution strategy and the toggle for manual mode.

**1. Build `packages/shared/sync/conflict-resolution.ts`:**

**Default behavior (last-write-wins):** When `manual_conflict_resolution` is `false` (the default), the inbound sync pipeline auto-resolves conflicts immediately after detection:

```typescript
export async function applyLastWriteWins(
  tx: Transaction,
  tenantId: string,
  recordId: string,
  conflicts: DetectedConflict[],
  platform: string,
): Promise<void>
```

This function:
1. For each conflict: applies the remote (platform) value to `canonical_data` (inbound wins).
2. Creates `sync_conflicts` records with `status: 'resolved_remote'` (NOT `pending`) — preserving the overwritten local value for recovery.
3. Updates `sync_metadata.last_synced_values` with the remote values.
4. Logs via Pino: "Auto-resolved {count} conflicts via last-write-wins for record {recordId}".

**Manual mode:** When `manual_conflict_resolution` is `true`:
- Conflicts are written with `status: 'pending'` (as in Prompt 5).
- The inbound value is NOT applied to `canonical_data` — the local value is preserved until a Manager resolves.
- The `sync_metadata.last_synced_values` is NOT updated for conflicted fields (to preserve the base for future comparisons).

**2. Update the inbound sync pipeline:**

After `detectConflicts()`, check the table's `base_connections.sync_config.manual_conflict_resolution`:
- If `false` or missing: call `applyLastWriteWins()` — conflicts are auto-resolved.
- If `true`: write `sync_conflicts` with `status: 'pending'` and preserve local `canonical_data`.

**3. Build the toggle:**

Server Action `toggleManualConflictResolution` in `apps/web/src/actions/sync-settings.ts`:
- Input: `{ baseConnectionId, tableId, enabled: boolean }`
- Permission check: Owner, Admin, or Manager on the workspace.
- Updates `base_connections.sync_config` JSONB to set `manual_conflict_resolution`.
- Returns the updated setting.

Data function `getConflictResolutionMode` in `apps/web/src/data/sync-settings.ts`:
- Returns the current `manual_conflict_resolution` setting for a table's connection.

### Acceptance Criteria

- [ ] Default behavior (last-write-wins): conflicts are auto-resolved with remote value applied to `canonical_data`
- [ ] Auto-resolved conflicts are recorded in `sync_conflicts` with `status: 'resolved_remote'`
- [ ] Overwritten local values are preserved in `sync_conflicts.local_value` for recovery
- [ ] Manual mode: conflicts written with `status: 'pending'`, local `canonical_data` preserved unchanged
- [ ] `toggleManualConflictResolution` updates `sync_config` JSONB and requires Manager+ permission
- [ ] `getConflictResolutionMode` returns the correct mode for a given table/connection
- [ ] `testTenantIsolation()` passes for `toggleManualConflictResolution` and `getConflictResolutionMode`
- [ ] Unit tests cover: last-write-wins flow, manual mode flow, toggle with permission check
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥90% on `packages/shared/sync/conflict-resolution.ts`

### Do NOT Build

- Conflict resolution modal UI (Prompt 7)
- Grid conflict rendering (Prompt 8)
- "Keep EveryStack" or "Edit merged" resolution actions (Prompt 10)
- Bulk conflict resolution (Prompt 11)
- Recovery of auto-resolved conflicts via UI (the values are preserved in sync_conflicts for manual recovery if needed, but no UI ships in this prompt)

---

## Prompt 7: Conflict Resolution Modal UI — Single-Field and Multi-Field with Bulk Actions

**Depends on:** Prompt 6 (conflict resolution types and mode toggle)
**Skills:** ux-ui, backend, phase-context
**Load context:** `sync-engine.md` lines 575–681 (Manual Resolution UI — full section including ASCII wireframes for single-field and multi-field modals), `sync-engine.md` lines 603–608 (Resolution actions)
**Target files:** `apps/web/src/components/sync/ConflictResolutionModal.tsx`, `apps/web/src/components/sync/ConflictFieldRow.tsx`, `apps/web/src/components/sync/ConflictResolutionActions.tsx`
**Migration required:** No
**Git:** Commit with message `feat(sync): conflict resolution modal UI with single-field and multi-field support [Phase 2B, Prompt 7]`

### Schema Snapshot

```
sync_conflicts: id, tenant_id, record_id, field_id, local_value (JSONB), remote_value (JSONB), base_value (JSONB), platform (VARCHAR), status (pending|resolved_local|resolved_remote|resolved_merged), resolved_by, created_at, resolved_at
```

### Task

Build the conflict resolution modal UI that Managers use to resolve sync conflicts.

**1. Build `ConflictResolutionModal.tsx`:**

A shadcn/ui Dialog-based modal that receives a record's pending conflicts and displays them for resolution. Two modes based on conflict count:

**Single-field conflict (1 conflicted field on the record):**
```
┌─────────────────────────────────────────────┐
│  Conflict: "{fieldName}" on "{recordTitle}" │
│                                             │
│  ┌─────────────┐    ┌─────────────┐        │
│  │ EveryStack  │    │  {Platform}  │        │
│  │ "{localVal}"│    │ "{remoteVal}"│        │
│  │ Changed by  │    │ Changed in  │        │
│  │ {user} ({t})│    │ {platform}  │        │
│  │             │    │ ({time})    │        │
│  └─────────────┘    └─────────────┘        │
│                                             │
│  Was: "{baseVal}" (last synced {time})      │
│                                             │
│  [Keep EveryStack] [Keep {Platform}] [Edit] │
└─────────────────────────────────────────────┘
```

**Multi-field conflict (2+ conflicted fields on same record):**
```
┌─────────────────────────────────────────────────────────┐
│  {count} Conflicts on "{recordTitle}"                    │
│  [Keep All EveryStack] [Keep All {Platform}]            │
│                                                         │
│  ─── Field: "{fieldName1}" ──────────────────────       │
│  EveryStack: "{localVal}" ({user}, {time})              │
│  {Platform}: "{remoteVal}" ({time})                     │
│  Was: "{baseVal}"                                       │
│  [Keep ES] [Keep {Plat}] [Edit]                         │
│                                                         │
│  ─── Field: "{fieldName2}" ──────────────────────       │
│  ...                                                    │
└─────────────────────────────────────────────────────────┘
```

The modal body is scrollable when multiple conflicts exist. Each field row is independently resolvable.

**2. Build `ConflictFieldRow.tsx`:**

A reusable component for a single field's conflict display within the modal:
- Shows field name, local value, remote value, and base value.
- Shows who changed the local value (user name + relative time) and when the remote change arrived.
- Three action buttons: "Keep EveryStack", "Keep {Platform}", "Edit".
- "Edit" opens an inline field editor (using the same field editor component that the grid will use in Phase 3 — for now, a basic text input that accepts a merged value).
- Once resolved, the row shows a green checkmark and the chosen value.

**3. Build `ConflictResolutionActions.tsx`:**

The bulk action bar for multi-field conflicts:
- "Keep All EveryStack" — resolves all pending conflicts on this record as `resolved_local`.
- "Keep All {Platform}" — resolves all pending conflicts on this record as `resolved_remote`.
- Disabled when all conflicts on the record are already resolved.

**4. Use all text through i18n:**

All user-facing strings must use `useTranslations('SyncConflicts')`. Add keys to `messages/en.json`:
- `conflictTitle`, `conflictsCount`, `keepEveryStack`, `keepPlatform`, `edit`, `keepAllEveryStack`, `keepAllPlatform`, `wasValue`, `changedBy`, `changedIn`, `lastSynced`, `resolved`

**5. Render field values correctly:**

Use the FieldTypeRegistry to render conflict values in their appropriate display format (not raw JSON). For example, a `single_select` conflict should show the label, not the option ID. A date should show a formatted date string. Use a `ConflictValueDisplay` helper that calls the registry's display formatter.

### Acceptance Criteria

- [ ] Single-field modal renders correctly with local value, remote value, base value, and action buttons
- [ ] Multi-field modal renders a scrollable list with per-field rows and bulk action bar
- [ ] "Keep EveryStack", "Keep {Platform}", and "Edit" buttons are present on each field row
- [ ] Bulk "Keep All" buttons resolve all pending conflicts on the record
- [ ] Field values render using FieldTypeRegistry display formatters (not raw JSON)
- [ ] All user-facing text uses i18n (`useTranslations('SyncConflicts')`)
- [ ] Modal uses shadcn/ui Dialog with correct styling (DM Sans font, 4px spacing multiples)
- [ ] Touch targets meet 44×44px minimum (WCAG 2.5.8)
- [ ] Component test renders the modal with mock conflict data and verifies action buttons
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new component files

### Do NOT Build

- The Server Action that persists resolution decisions (Prompt 10)
- Grid-level conflict indicators (Prompt 8)
- Real-time conflict push (Prompt 9)
- Mobile-specific conflict layout (Phase 3H)
- Optimistic resolution with undo toast (Prompt 10)
- Field editor for "Edit" resolution — use a basic text/value input for now; Phase 3's field editors will replace this

---

## Prompt 8: Grid-Level Conflict Rendering — Cell Indicators, Row Badges, Toolbar Conflict Badge

**Depends on:** Prompt 5 (conflict detection — `sync_conflicts` table populated with pending conflicts)
**Skills:** ux-ui, phase-context
**Load context:** `sync-engine.md` lines 615–655 (Grid-Level Conflict Rendering — cell indicator, row indicator, TanStack Table integration, conflict count in toolbar, multi-field conflicts)
**Target files:** `apps/web/src/components/sync/CellConflictIndicator.tsx`, `apps/web/src/components/sync/ConflictToolbarBadge.tsx`, `apps/web/src/data/sync-conflicts.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): grid-level conflict rendering with cell indicators, row badges, and toolbar badge [Phase 2B, Prompt 8]`

### Schema Snapshot

```
sync_conflicts: id, tenant_id, record_id, field_id, local_value (JSONB), remote_value (JSONB), base_value (JSONB), platform, status (pending|resolved_*), created_at
```

### Task

Build the visual conflict indicators for the grid and the data layer to populate the `_conflicts` map on records.

**1. Build `apps/web/src/data/sync-conflicts.ts`:**

Data functions for loading conflict state:

```typescript
export async function getPendingConflictsForTable(
  tenantId: string,
  tableId: string,
): Promise<Record<string, Record<string, ConflictMeta>>>
// Returns: { [recordId]: { [fieldId]: ConflictMeta } }

export async function getPendingConflictCount(
  tenantId: string,
  tableId: string,
): Promise<number>
```

`ConflictMeta` type:
```typescript
export interface ConflictMeta {
  id: string;           // sync_conflict.id
  localValue: unknown;
  remoteValue: unknown;
  platform: string;
  createdAt: string;
}
```

These queries join `sync_conflicts` (status = 'pending') with `records` (where `records.table_id = tableId`). The result is structured as a nested map: `recordId → fieldId → ConflictMeta`.

This map is intended to be merged into record data as `record._conflicts` for the grid cell renderer to check.

**2. Build `CellConflictIndicator.tsx`:**

A component that overlays conflict visual indicators on a grid cell:

```
Standard cell:        Conflicted cell:
┌──────────────┐     ┌──────────────◣  ← 4px amber triangle (top-right)
│ In Progress  │     │ In Review    │
└──────────────┘     └──────────────┘
                      Underline: amber dashed 1px
```

- Renders a 4px amber (`--amber-500`) triangle in the top-right corner via CSS (`:after` pseudo-element or an absolutely-positioned SVG).
- Renders a 1px amber dashed underline on the cell text (subtle secondary indicator).
- On hover: shows a shadcn/ui Tooltip — "Conflict: edited both locally and on {Platform}. Click to resolve."
- On click: opens the `ConflictResolutionModal` for this record.
- The indicator is rendered conditionally based on `record._conflicts?.[fieldId]` being present.

**3. Build row-level indicator:**

When any cell in a row is conflicted, the row's index column (row number area) shows an amber ⚠️ badge. Build a `RowConflictBadge` component:
- Checks if `Object.keys(record._conflicts || {}).length > 0`.
- Renders a small amber badge with ⚠️ icon in the row number column area.
- On click: opens the ConflictResolutionModal for the record (showing all conflicts).

**4. Build `ConflictToolbarBadge.tsx`:**

A toolbar component that shows the total count of conflicted records in the current table:

- Renders as: `⚠️ {count} conflicts` in amber text.
- Clicking it applies a client-side filter that shows only records with `_conflicts` entries.
- Hidden when conflict count is 0.

**5. Build the `CellWrapper` integration point:**

Export a `CellWrapper` component that the Phase 3 grid cell renderer can wrap around each cell:

```typescript
export function CellWrapper({
  conflict,
  children,
  onResolveClick,
}: {
  conflict?: ConflictMeta;
  children: React.ReactNode;
  onResolveClick?: () => void;
}) {
  return (
    <div className="relative">
      {children}
      {conflict && <CellConflictIndicator conflict={conflict} onClick={onResolveClick} />}
    </div>
  );
}
```

Phase 3's TanStack Table column definitions will use this wrapper (per the pattern in `sync-engine.md` lines 631–651).

### Acceptance Criteria

- [ ] `getPendingConflictsForTable()` returns a `recordId → fieldId → ConflictMeta` map for all pending conflicts
- [ ] `getPendingConflictCount()` returns the total count of records with pending conflicts
- [ ] `CellConflictIndicator` renders a 4px amber triangle (top-right) and dashed amber underline
- [ ] Tooltip on hover shows conflict description with platform name
- [ ] Click on indicator opens `ConflictResolutionModal` for the record
- [ ] `RowConflictBadge` shows ⚠️ amber badge on rows with any conflicted cell
- [ ] `ConflictToolbarBadge` shows count and clicking filters to conflicted records only
- [ ] Badge hidden when no conflicts exist
- [ ] `CellWrapper` is exported for Phase 3 grid integration
- [ ] All text uses i18n (`useTranslations('SyncConflicts')`)
- [ ] `testTenantIsolation()` passes for conflict data queries
- [ ] Component tests verify rendering with and without conflict data
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Full TanStack Table grid setup (Phase 3)
- Cell renderers for each field type (Phase 3)
- Real-time conflict push (Prompt 9)
- Conflict resolution Server Action (Prompt 10)
- Mobile-specific conflict indicators (Phase 3H)

---

## Integration Checkpoint 2 (after Prompts 5–8)

**Task:** Verify all work from Prompts 5–8 integrates correctly with the outbound sync infrastructure from Prompts 1–4.

**Skills:** backend, phase-context

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification:
   - Confirm three-way conflict detection correctly identifies conflicts vs clean changes in integration test
   - Confirm last-write-wins auto-resolution applies remote values and preserves local in `sync_conflicts`
   - Confirm manual mode preserves local `canonical_data` when conflicts detected
   - Confirm `ConflictResolutionModal` renders correctly with mock conflict data (single-field and multi-field)
   - Confirm `CellConflictIndicator` renders amber triangle and tooltip
   - Confirm `ConflictToolbarBadge` shows count and hides when zero

**Git:** Commit with message `chore(verify): integration checkpoint 2 — conflict detection, resolution mode, UI components [Phase 2B, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 9.

---

## Prompt 9: Real-Time Conflict Push via Socket.io/Redis and Client-Side _conflicts Map Updates

**Depends on:** Prompt 5 (conflict detection writes sync_conflicts), Prompt 8 (_conflicts map structure on records)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 694–715 (Real-Time Conflict Push — detection flow), `sync-engine.md` lines 717–731 (Resolution flow real-time events)
**Target files:** `apps/worker/src/jobs/sync-inbound.ts` (extend — emit event after conflict write), `apps/realtime/src/events/sync-events.ts`, `apps/web/src/lib/sync-conflict-store.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): real-time conflict push via Socket.io/Redis with client-side _conflicts map [Phase 2B, Prompt 9]`

### Schema Snapshot

N/A — no schema changes. Uses existing Socket.io/Redis infrastructure from Phase 1G.

### Task

Build the real-time event pipeline for conflict detection and resolution so grid cells update without page reload.

**1. Define sync conflict events in `apps/realtime/src/events/sync-events.ts`:**

Two events on the table room channel (`t:{tenantId}:table:{tableId}`):

```typescript
export interface SyncConflictDetectedEvent {
  type: 'sync.conflict_detected';
  recordId: string;
  fieldId: string;
  conflictId: string;
  localValue: unknown;
  remoteValue: unknown;
  platform: string;
}

export interface SyncConflictResolvedEvent {
  type: 'sync.conflict_resolved';
  recordId: string;
  fieldId: string;
  conflictId: string;
  resolvedValue: unknown;
  resolution: 'resolved_local' | 'resolved_remote' | 'resolved_merged';
}
```

**2. Emit `sync.conflict_detected` from the inbound sync worker:**

After `writeConflictRecords()` (Prompt 5), publish a Redis event per conflict:

```
Channel: t:{tenantId}:table:{tableId}
Event: sync.conflict_detected
Payload: { recordId, fieldId, conflictId, localValue, remoteValue, platform }
```

The real-time service (Socket.io) broadcasts this to all clients joined in the table room.

**3. Build client-side conflict store (`apps/web/src/lib/sync-conflict-store.ts`):**

A lightweight Zustand store (or module-scoped state) that manages the `_conflicts` map for the currently viewed table:

```typescript
interface ConflictStore {
  conflicts: Record<string, Record<string, ConflictMeta>>; // recordId → fieldId → meta
  setInitialConflicts: (data: Record<string, Record<string, ConflictMeta>>) => void;
  addConflict: (recordId: string, fieldId: string, meta: ConflictMeta) => void;
  removeConflict: (recordId: string, fieldId: string) => void;
  getConflictsForRecord: (recordId: string) => Record<string, ConflictMeta> | undefined;
  conflictCount: () => number;
}
```

**4. Wire Socket.io event listeners:**

When the client joins a table room (existing room join from Phase 1G), listen for sync conflict events:

- `sync.conflict_detected` → call `addConflict()` on the store → triggers re-render of affected cells via `CellConflictIndicator`.
- `sync.conflict_resolved` → call `removeConflict()` on the store → amber indicator disappears.

**5. Initialize conflict store on table load:**

When a user navigates to a synced table, fetch initial conflicts via `getPendingConflictsForTable()` (Prompt 8) and call `setInitialConflicts()`. This populates the `_conflicts` map that grid cells read from.

### Acceptance Criteria

- [ ] `sync.conflict_detected` event emitted via Redis pub-sub after conflict records are written
- [ ] `sync.conflict_resolved` event emitted after conflict resolution (event definition only — emission wired in Prompt 10)
- [ ] Socket.io broadcasts both events to all clients in the table room
- [ ] Client conflict store (`ConflictStore`) correctly adds and removes conflicts
- [ ] `addConflict()` triggers cell re-render (conflict indicator appears) without page reload
- [ ] `removeConflict()` triggers cell re-render (conflict indicator disappears) without page reload
- [ ] Initial conflicts loaded from `getPendingConflictsForTable()` on table navigation
- [ ] Unit tests cover store operations: add, remove, initialize, count
- [ ] Integration test verifies Socket.io event delivery from worker to client (use test Socket.io client)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Conflict resolution Server Action (Prompt 10 — this prompt only wires the event pipeline)
- The `record.updated` standard event pipeline for non-conflict grid updates (Phase 3)
- Room management or authentication changes (existing Phase 1G infrastructure)
- Push notifications for conflicts (Phase 2C — notification system)

---

## Prompt 10: Conflict Resolution Server Action with Optimistic UI, Undo Toast, and Outbound Sync Enqueue

**Depends on:** Prompt 6 (resolution types), Prompt 7 (modal UI), Prompt 9 (real-time conflict events)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 603–608 (Resolution actions), lines 717–745 (Resolution flow events + Optimistic Resolution + Undo)
**Target files:** `apps/web/src/actions/sync-conflict-resolve.ts`, `apps/web/src/components/sync/ConflictResolutionModal.tsx` (extend with action wiring + undo toast), `apps/web/src/components/sync/UndoResolveToast.tsx`
**Migration required:** No
**Git:** Commit with message `feat(sync): conflict resolution Server Action with optimistic UI, undo toast, and outbound sync [Phase 2B, Prompt 10]`

### Schema Snapshot

```
sync_conflicts: id, tenant_id, record_id, field_id, local_value, remote_value, base_value, platform, status, resolved_by, created_at, resolved_at
records: canonical_data (JSONB), sync_metadata (JSONB), updated_by, updated_at
```

### Task

Build the Server Action that persists conflict resolution decisions, the optimistic UI behavior, and the undo mechanism.

**1. Build `apps/web/src/actions/sync-conflict-resolve.ts`:**

```typescript
export async function resolveConflict(input: {
  conflictId: string;
  resolution: 'resolved_local' | 'resolved_remote' | 'resolved_merged';
  mergedValue?: unknown; // Required only for 'resolved_merged'
}): Promise<{ success: boolean; undoToken: string }>
```

This Server Action:
1. Validates input via Zod. Verifies the conflict exists and `status === 'pending'`.
2. Permission check: caller must be Owner, Admin, or Manager on the workspace.
3. In a single database transaction:
   a. Updates `sync_conflicts.status` to the resolution value.
   b. Sets `sync_conflicts.resolved_by` to the current user ID.
   c. Sets `sync_conflicts.resolved_at` to now.
   d. Updates `records.canonical_data` with the resolved value:
      - `resolved_local`: canonical_data already has the correct value (local was preserved). No change needed.
      - `resolved_remote`: set canonical_data field to `remote_value`.
      - `resolved_merged`: set canonical_data field to `mergedValue`.
   e. Updates `records.search_vector` via `buildSearchVector()`.
   f. Updates `records.sync_metadata.last_synced_values` for the resolved field.
4. Emits `sync.conflict_resolved` event via Redis pub-sub (channel: `t:{tenantId}:table:{tableId}`).
5. Emits `record.updated` event for standard record update pipeline.
6. If resolution is `resolved_local` or `resolved_merged`: calls `enqueueOutboundSync()` to push the chosen value to the platform (P1 priority, not waiting for polling cycle).
7. If resolution is `resolved_remote`: no outbound sync needed (platform already has the correct value).
8. Generates a unique `undoToken` (UUIDv7) and caches the previous state in Redis with an 8-second TTL: `undo:conflict:{undoToken}` → `{ conflictId, previousCanonicalValue, previousStatus, previousSyncMetadata }`.
9. Returns `{ success: true, undoToken }`.

**2. Build the undo action:**

```typescript
export async function undoConflictResolution(undoToken: string): Promise<{ success: boolean }>
```

If the Redis key `undo:conflict:{undoToken}` still exists (within 8 seconds):
1. Reverts `sync_conflicts.status` to `pending`.
2. Restores `records.canonical_data` to the previous value.
3. Cancels the outbound sync job if one was enqueued (by job ID stored in Redis).
4. Emits `sync.conflict_detected` event (re-shows the conflict indicator).
5. Deletes the Redis key.

If the key has expired (>8 seconds): returns `{ success: false }`.

**3. Build `UndoResolveToast.tsx`:**

A toast component using shadcn/ui Toast:
- Shows: "Conflict resolved. [Undo]"
- Auto-dismisses after 8 seconds.
- "Undo" button calls `undoConflictResolution(undoToken)`.
- If undo succeeds: toast updates to "Resolution undone."
- If undo fails (expired): toast updates to "Undo no longer available."

**4. Wire the modal to the Server Action:**

Update `ConflictResolutionModal.tsx`:
- "Keep EveryStack" button: calls `resolveConflict({ conflictId, resolution: 'resolved_local' })`.
- "Keep {Platform}" button: calls `resolveConflict({ conflictId, resolution: 'resolved_remote' })`.
- "Edit" button: opens inline editor, on submit calls `resolveConflict({ conflictId, resolution: 'resolved_merged', mergedValue })`.
- On resolution success: conflict indicator disappears immediately (optimistic — via `removeConflict()` on the conflict store). Show `UndoResolveToast`.

### Acceptance Criteria

- [ ] `resolveConflict()` updates `sync_conflicts`, `canonical_data`, `search_vector`, and `sync_metadata` in a single transaction
- [ ] Permission check: only Owner/Admin/Manager can resolve (Team Member and Viewer rejected with 403)
- [ ] `resolved_local` and `resolved_merged` trigger `enqueueOutboundSync()` with P1 priority
- [ ] `resolved_remote` does NOT trigger outbound sync
- [ ] `sync.conflict_resolved` event emitted via Redis pub-sub after resolution
- [ ] `record.updated` event emitted after resolution
- [ ] Undo works within 8-second window: conflict restored to `pending`, canonical_data reverted, outbound sync cancelled
- [ ] Undo fails gracefully after 8 seconds (Redis TTL expired)
- [ ] `UndoResolveToast` renders and auto-dismisses after 8 seconds
- [ ] Modal buttons are wired to Server Action and conflict indicator disappears optimistically
- [ ] `testTenantIsolation()` passes for `resolveConflict` — cannot resolve conflicts in another tenant
- [ ] Unit tests cover: all 3 resolution types, undo within window, undo after expiry, permission denial
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥90% on `apps/web/src/actions/sync-conflict-resolve.ts`

### Do NOT Build

- Bulk conflict resolution (Prompt 11)
- Role-based visibility rules for the conflict indicators (Prompt 11)
- Audit log write for conflict resolution (Prompt 11)
- Conflict interaction with other features (automations, cross-links, portals, formulas, tsvector) — Prompt 11

---

## Prompt 11: Role-Based Conflict Visibility, Bulk Resolution, Conflict Audit Trail, and Feature Interaction Rules

**Depends on:** Prompt 8 (grid conflict rendering), Prompt 10 (resolution Server Action)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 683–693 (Role Visibility for Conflicts), lines 609 (Bulk resolution), lines 757–793 (Conflict Interaction with Other Features, Conflict Audit Trail)
**Target files:** `apps/web/src/components/sync/CellConflictIndicator.tsx` (extend), `apps/web/src/actions/sync-conflict-resolve.ts` (extend with bulk action), `apps/web/src/components/sync/ConflictResolutionModal.tsx` (extend), `packages/shared/sync/conflict-interactions.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): role-based conflict visibility, bulk resolution, audit trail, and feature interaction rules [Phase 2B, Prompt 11]`

### Schema Snapshot

N/A — no new tables. Uses existing `sync_conflicts`, `audit_log`, and workspace role infrastructure.

### Task

Complete the conflict system with role enforcement, bulk actions, audit logging, and documented interaction rules.

**1. Role-based conflict visibility:**

| Role | Sees conflict indicators? | Can resolve? | Behavior |
|------|---------------------------|--------------|----------|
| Owner/Admin | Yes (always) | Yes | Full resolution UI |
| Manager | Yes (on permitted bases) | Yes | Full resolution UI within their bases |
| Team Member | Yes (amber indicator visible) | No | Tooltip: "This field has a sync conflict. A Manager will resolve it." Cell shows currently applied value. Click does NOT open resolution modal. |
| Viewer | No indicator | No | Viewers see the resolved/current value only. No visual indication of conflicts. |

Update `CellConflictIndicator.tsx`:
- Accept a `userRole` prop (or read from auth context).
- For Team Member: render amber indicator but on click show a read-only tooltip, not the resolution modal.
- For Viewer: do not render the indicator at all.

Update `ConflictToolbarBadge.tsx`:
- Hidden for Viewers.
- For Team Members: shows count but clicking shows a read-only message ("Conflicts are resolved by Managers.").

**2. Bulk conflict resolution:**

Add a bulk resolution Server Action:

```typescript
export async function bulkResolveConflicts(input: {
  recordId: string;
  resolution: 'resolved_local' | 'resolved_remote';
}): Promise<{ success: boolean; resolvedCount: number }>
```

This resolves ALL pending conflicts on a single record with the chosen strategy. Used by the "Keep All EveryStack" / "Keep All {Platform}" buttons in the multi-field modal.

Also build a table-level bulk resolution (for the toolbar badge click → filter → select all → bulk action):

```typescript
export async function bulkResolveTableConflicts(input: {
  tableId: string;
  resolution: 'resolved_local' | 'resolved_remote';
}): Promise<{ success: boolean; resolvedCount: number }>
```

Both actions:
- Iterate through all pending conflicts and call the same resolution logic as `resolveConflict()`.
- Batch the outbound sync enqueue calls (if `resolved_local`).
- Emit `sync.conflict_resolved` events for each resolved conflict.
- Return the count of resolved conflicts.
- Generate a single undo token that can undo the entire batch (Redis key stores array of previous states, 8-second TTL).

**3. Conflict audit trail:**

After every conflict resolution (including bulk), write to the audit log via `writeAuditLog()`:

```typescript
await writeAuditLog(tx, {
  tenantId,
  actorType: 'user',
  actorId: managerId,
  action: 'sync_conflict.resolved',
  entityType: 'record',
  entityId: recordId,
  details: {
    conflictId,
    fieldId,
    resolution: 'resolved_local' | 'resolved_remote' | 'resolved_merged',
    previousValue: conflict.localValue,
    resolvedValue: chosenValue,
    platform: conflict.platform,
  },
  traceId,
});
```

This appears in the record's Activity tab as: "{User} resolved sync conflict on '{fieldName}' — kept EveryStack value '{value}' (was '{remoteValue}' on {Platform})."

Update `resolveConflict()` and `bulkResolveConflicts()` to include this `writeAuditLog()` call in the same transaction.

**4. Feature interaction rules (`packages/shared/sync/conflict-interactions.ts`):**

Document and implement the interaction rules as utility functions and code comments:

- **Automations:** Conflicts do NOT block automation triggers. Automations run with the currently applied value. Resolution may re-trigger if it constitutes a field change matching the trigger condition. Document with a code comment.
- **Cross-links:** Conflicted display values show the currently applied value. Resolution propagates through standard cascade. Document with a code comment.
- **Portals:** No conflict indicator visible to portal clients. Resolution invalidates portal cache normally. Document with a code comment.
- **Formulas:** Compute with currently applied value. Resolution triggers recalculation. Document with a code comment.
- **Search/tsvector:** Uses currently applied value. Resolution triggers re-indexing if value differs. Already handled in `resolveConflict()` via `buildSearchVector()`.

Export a function:
```typescript
export function shouldRecomputeOnResolution(fieldId: string, tableFields: FieldDefinition[]): {
  formulaFields: string[];
  crossLinkFields: string[];
  requiresTsvectorUpdate: boolean;
}
```

This is a preparatory utility for Phase 3 integration — it identifies which downstream fields need recalculation when a conflict is resolved.

### Acceptance Criteria

- [ ] Owner/Admin/Manager see full conflict indicators and can open resolution modal
- [ ] Team Member sees amber indicator but CANNOT open resolution modal — shows read-only tooltip
- [ ] Viewer sees NO conflict indicators
- [ ] `bulkResolveConflicts()` resolves all pending conflicts on a record in one call
- [ ] `bulkResolveTableConflicts()` resolves all pending conflicts in a table
- [ ] Bulk resolution generates a single undo token for the batch
- [ ] `writeAuditLog()` called for every conflict resolution with correct details
- [ ] Audit trail message format matches spec: "{User} resolved sync conflict on '{fieldName}'..."
- [ ] `shouldRecomputeOnResolution()` correctly identifies downstream formula and cross-link fields
- [ ] `testTenantIsolation()` passes for all new data functions and Server Actions
- [ ] Unit tests cover: each role's visibility behavior, bulk resolve, audit log write, feature interaction utility
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on all new/modified files

### Do NOT Build

- Automation trigger integration (Phase 4 — automations don't exist yet)
- Cross-link display value cascade (Phase 3B — cross-linking)
- Portal cache invalidation (Phase 3E — portals)
- Formula recalculation (post-MVP — formula engine)
- Mobile conflict resolution layout (Phase 3H)
- App Designer conflict indicator visibility (post-MVP)

---

## Integration Checkpoint 3 — Final (after Prompts 9–11)

**Task:** Verify all Phase 2B work integrates correctly and the full conflict system works end-to-end.

**Skills:** backend, ux-ui, phase-context

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met for all paths:
   - `packages/shared/sync/` ≥ 90% lines, 85% branches
   - `apps/web/src/actions/` ≥ 90% lines, 85% branches
   - `apps/worker/src/jobs/` ≥ 85% lines, 80% branches
5. `pnpm turbo check:i18n` — no hardcoded English strings in new components
6. Manual verification:
   - **End-to-end conflict flow:** Simulate inbound sync with conflicting values → verify `sync_conflicts` created → verify real-time event arrives on client → verify amber indicator renders → open resolution modal → resolve as "Keep EveryStack" → verify outbound sync enqueued → verify amber indicator disappears → verify undo toast appears → verify undo works within 8 seconds
   - **Role visibility:** Verify Team Member sees indicator but cannot resolve; Viewer sees no indicator
   - **Bulk resolution:** Resolve multiple conflicts on a record via "Keep All EveryStack" → verify all resolved + single undo token
   - **Audit trail:** Verify conflict resolution entries appear in audit log with correct format
   - **Expression indexes:** Verify `EXPLAIN` shows index scan for a query using `canonicalFieldExpression()`

**Git:** Commit with message `chore(verify): final integration checkpoint — complete Phase 2B verification [Phase 2B, CP-3]`, push branch to origin, then open PR to main with title `Phase 2B — Synced Data Performance, Outbound Sync, Conflict Resolution`.
