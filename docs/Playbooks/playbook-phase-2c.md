# Phase 2C — Notion Adapter, Error Recovery, Sync Dashboard

## Phase Context

### What Has Been Built

**Phase 1 (MVP — Foundation) is complete and merged to main.** Key outputs relevant to Phase 2C:

- **1A:** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI. ESLint + Prettier.
- **1B:** Drizzle schema for all 52 MVP tables including `base_connections`, `tables`, `fields`, `records`, `synced_field_mappings`, `sync_conflicts`, `sync_failures`, `sync_schema_changes`. `getDbForTenant()` with read/write routing. RLS policies. UUIDv7 primary keys.
- **1C:** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities. `PermissionDeniedError` shape.
- **1D:** Pino structured logging with `AsyncLocalStorage` traceId. Sentry integration. OpenTelemetry basic instrumentation. Security headers middleware.
- **1E:** Vitest workspace config. Playwright E2E setup. Test data factories for all core tables (`createTestTenant()`, `createTestRecord()`, etc.). `testTenantIsolation()` helper. MSW mock setup.
- **1F:** shadcn/ui primitives installed. Tailwind config with three-layer color architecture. DM Sans + JetBrains Mono fonts. Responsive application shell layout with sidebar.
- **1G:** Socket.io server with Clerk JWT auth and Redis adapter. Room join/leave model. BullMQ worker skeleton with queue definitions. StorageClient + R2.
- **1I:** `writeAuditLog()` helper with seven-source attribution. `api_keys` table with SHA-256 hashing. API auth middleware. Token-bucket rate limiting.
- **1J:** CP-001/CP-002 schema migrations. Auth middleware updated to `effective_memberships`. Sidebar navigation tree with tenant switching.

**Phase 2A (FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter) is complete and merged to main.** Key outputs relevant to Phase 2C:

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

**Phase 2B (Synced Data Performance, Outbound Sync, Conflict Resolution) is complete and merged to main.** Key outputs relevant to Phase 2C:

- JSONB expression indexes on `canonical_data` for grid query performance. `createFieldExpressionIndex()` / `dropFieldExpressionIndex()` utilities. `canonicalFieldExpression()` / `canonicalFieldOrderBy()` query helpers.
- `SyncMetadata` type and `sync_metadata` JSONB shape on records with `last_synced_values` per field. `updateLastSyncedValues()`, `getLastSyncedValue()`, `createInitialSyncMetadata()` utilities.
- Outbound sync BullMQ job with `fromCanonical()` and rate-limited platform write.
- Optimistic UI for synced table cell edits with outbound sync enqueue.
- Three-way conflict detection on inbound sync with `sync_conflicts` table population.
- Default last-write-wins resolution and manual resolution mode toggle per synced table.
- Conflict resolution modal UI (single-field and multi-field with bulk actions).
- Grid-level conflict rendering (amber triangle, dashed underline, row badge, toolbar badge).
- Real-time conflict push via Socket.io/Redis pub-sub (`sync.conflict_detected`, `sync.conflict_resolved`).
- Conflict resolution Server Action with optimistic UI, 8-second undo toast, and outbound sync enqueue.
- Role-based conflict visibility. Bulk resolution. Conflict audit trail via `writeAuditLog()`.

### What This Phase Delivers

When Phase 2C is complete, EveryStack can:

1. Sync data bidirectionally from **Notion databases** using the `NotionAdapter` — Notion's hierarchical page/property model is mapped to canonical JSONB shapes via the same `FieldTypeRegistry` pattern established for Airtable.
2. Push down `FilterRule[]` to Notion's native `filter` parameter on database queries for efficient inbound sync.
3. **Adapt polling frequency intelligently** — 30s for actively viewed tables, 5min for open-but-not-visible tables, 30min for inactive workspaces, event-driven via Airtable webhooks where available.
4. **Skip converted tables** during sync dispatch — tables with `sync_status` of `'converted'` or `'converted_finalized'` are excluded from polling; `'converted_dual_write'` writes to shadow only.
5. **Schedule sync jobs by priority** (P0–P3) with rate pressure awareness — P0 outbound/webhook always dispatched, P1–P3 throttled based on remaining platform capacity.
6. **Enforce multi-tenant fairness** — round-robin within priority tiers, per-tenant max 20% platform capacity (P0 exempt).
7. **Track connection health** via `ConnectionHealth` JSONB on `base_connections.health` with 8 error categories, severity classification, and auto-recovery flags.
8. **Display sync status indicators** in the table header — green/yellow/red badges with staleness threshold (2× polling_interval).
9. **Recover from auth expired** — detect 401/403 → mark `auth_required` → red badge → re-auth OAuth flow → immediate catch-up sync.
10. **Recover from partial failures** — populate `sync_failures` table, show Failures tab with retry/skip/edit per record, auto-retry 3× then `requires_manual_resolution`.
11. **Recover from platform unavailable** — exponential backoff (1min→5min→15min→1hr→3hr→6hr), then mark error, manual "Retry Now" resets backoff.
12. **Detect and present schema mismatches** — populate `sync_schema_changes` table, show Schema Changes panel with accept/reject/archive/add actions and downstream impact analysis.
13. **Handle quota exceeded** — partial sync + notification + 4 resolution options (add filter / upgrade / delete records / disable tables).
14. **Notify stakeholders** of sync issues — in-app badge/toast, email for auth expired, escalation tiers for sustained downtime.
15. **Manage sync connections** via a 6-tab Sync Settings Dashboard — Overview, Tables & Filters, Conflicts, Failures, Schema Changes, History with "Sync Now", "Pause Sync", and "Disconnect" controls.
16. **Show synced table tab badges** in the sidebar — 14px platform logo overlay on table icon + sync status indicator icon with 6 health states.

### What This Phase Does NOT Build

- **SmartSuite adapter** (deferred to Phase 3 — Core UX per `sync-engine.md` Phase Implementation)
- **Airtable adapter** (2A — already built)
- **Outbound sync pipeline** (2B — already built; 2C reuses it for Notion outbound)
- **Conflict resolution UI** (2B — already built; 2C's Notion adapter feeds into the existing conflict system)
- **Full grid view architecture** — TanStack Table, cell renderers, inline editing, views (Phase 3). 2C provides sync status overlays consumed by Phase 3.
- **Field groups feature** — named column groups, per-field emphasis, enhanced hide/show panel (Phase 3 Core UX)
- **Board collapse behavior** (Phase 3 — Foundation)
- **Per-field emphasis and conditional cell coloring** (Phase 3 — Core UX)
- **`record_cells` denormalization** — only if JSONB expression indexes fail <200ms targets
- **Kanban, Calendar, or any post-MVP view types**
- **Formula engine or computed fields**
- **App Designer or App Portals**
- **Visual automation canvas**
- **Persistent notification table** — `notifications` table is Post-MVP (Comms & Polish); before that, toast-only for sync notifications

### Architecture Patterns for This Phase

1. **Adapter pattern reuse.** The `NotionAdapter` implements the same `PlatformAdapter` interface as `AirtableAdapter`. It registers field type transforms in the `FieldTypeRegistry` using the same `FieldTransform` interface. Adding Notion = writing a new adapter pair, zero modifications to the sync engine.

2. **Notion's hierarchical model → flat canonical.** Notion databases contain pages, and pages have properties. Notion "properties" map to EveryStack "fields." The adapter translates Notion's page/property model to the same flat `canonical_data` JSONB shape used by Airtable. Notion blocks (rich text content within pages) are not individually synced — only page-level properties are mapped.

3. **Smart polling replaces fixed-interval polling.** The sync scheduler becomes state-aware: it checks table visibility (active vs. background vs. inactive) and adjusts polling intervals accordingly. Airtable webhook listeners (where available) allow event-driven sync, bypassing polling entirely.

4. **Priority-based scheduling with backpressure.** The BullMQ sync dispatcher checks remaining platform rate limit capacity before dispatching jobs. P0 always dispatched; P1–P3 throttled based on capacity thresholds. This prevents rate limit exhaustion by background polling when active user edits need bandwidth.

5. **Error recovery as state machine.** Each `base_connections` row has a `health` JSONB column that tracks `ConnectionHealth`. Error recovery flows transition through states (`active` → `error` → `auth_required` → `active`) with well-defined triggers and resolution paths.

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
| 1 | NotionAdapter.toCanonical() for all MVP field types | None | ~350 |
| 2 | NotionAdapter.fromCanonical(), Notion filter pushdown, OAuth flow, and sync pipeline integration | 1 | ~300 |
| 3 | Smart polling with adaptive intervals and converted table skip logic | None | ~250 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–3) | 1–3 | — |
| 4 | Priority-based job scheduling (P0–P3) and multi-tenant fairness | 3 | ~250 |
| 5 | ConnectionHealth/SyncError types, sync status indicators UI, and staleness threshold | None | ~300 |
| 6 | Auth expired, permission denied, and platform unavailable recovery flows | 5 | ~300 |
| CP-2 | Integration Checkpoint 2 (after Prompts 4–6) | 4–6 | — |
| 7 | Partial failure recovery flow with sync_failures population and Failures tab UI | 5, 6 | ~300 |
| 8 | Schema mismatch recovery flow and schema sync change detection | 5, 6 | ~350 |
| 9 | Quota exceeded recovery flow and sync notification system | 5 | ~250 |
| 10 | Sync settings dashboard (6-tab layout) | 5, 7, 8, 9 | ~350 |
| 11 | Synced table tab badges — platform badge and sync status indicator | 5 | ~200 |
| CP-3 | Final Integration Checkpoint + PR | 7–11 | — |

---

## Prompt 1: NotionAdapter.toCanonical() for All MVP Field Types

**Depends on:** None (Phase 2A + 2B complete — adapter pattern established, FieldTypeRegistry exists)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 30–87 (Core Pattern, Source References, Field Type Registry), `sync-engine.md` lines 93–106 (Sync Setup — Step 2 databases for Notion), `data-model.md` lines 150–200 (Field Type Canonical Shapes)
**Target files:** `packages/shared/sync/adapters/notion-adapter.ts`, `packages/shared/sync/adapters/notion-field-transforms.ts`, `packages/shared/sync/adapters/notion-types.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-2c-notion-error-recovery-dashboard` from `main`. After completing, commit with message `feat(sync): implement NotionAdapter.toCanonical() for all MVP field types [Phase 2C, Prompt 1]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform ('airtable'|'notion'|'smartsuite'), platform_base_id, credentials (JSONB — encrypted), sync_config (JSONB — SyncConfig), sync_status, health (JSONB), last_sync_at, created_at, updated_at
records: id, tenant_id, table_id, canonical_data (JSONB), source_refs (JSONB), sync_metadata (JSONB), created_at, updated_at
fields: id, tenant_id, table_id, name, field_type (VARCHAR), config (JSONB), sort_order, created_at, updated_at
synced_field_mappings: id, tenant_id, field_id, base_connection_id, platform_field_id, platform_field_type, transform_config (JSONB)
```

### Task

Build the `NotionAdapter.toCanonical()` implementation, mapping Notion's page property model to EveryStack's canonical JSONB shape. This is the inbound direction — Notion API response → canonical JSONB.

**1. Create `packages/shared/sync/adapters/notion-types.ts`:**

Define TypeScript types for Notion API responses. The Notion API returns page objects with a `properties` map where each property has a `type` field and type-specific value structure. Key types to model:

```typescript
// Notion property types (from Notion API)
export type NotionPropertyType =
  | 'title' | 'rich_text' | 'number' | 'select' | 'multi_select'
  | 'date' | 'people' | 'files' | 'checkbox' | 'url' | 'email'
  | 'phone_number' | 'formula' | 'relation' | 'rollup'
  | 'created_time' | 'created_by' | 'last_edited_time' | 'last_edited_by'
  | 'status' | 'unique_id';

export interface NotionPage {
  id: string;
  properties: Record<string, NotionProperty>;
  created_time: string;
  last_edited_time: string;
  // ... other page fields
}

export interface NotionProperty {
  id: string;
  type: NotionPropertyType;
  [key: string]: unknown; // Type-specific value
}
```

**2. Create `packages/shared/sync/adapters/notion-field-transforms.ts`:**

Implement per-field-type transform functions following the same pattern as Airtable's transforms. For each Notion property type, implement a `toCanonical()` function that produces the canonical JSONB shape.

Key Notion-to-canonical mappings:

| Notion Property Type | Canonical Field Type | Notes |
|---------------------|---------------------|-------|
| `title` | `text` | Notion title is rich text — extract plain text for canonical value, preserve rich text in `source_refs` |
| `rich_text` | `long_text` | Extract plain text, preserve rich text array in `source_refs` |
| `number` | `number` | Direct mapping |
| `select` | `single_select` | Map Notion option `{id, name, color}` → canonical `{value, source_refs: {notion: {option_id}}}` |
| `multi_select` | `multi_select` | Array of option objects → canonical array with `source_refs` per option |
| `date` | `date` | Notion date has `{start, end, time_zone}` — map to canonical date shape |
| `people` | `user` | Notion user objects → canonical user references |
| `files` | `attachment` | Notion file objects (external URLs or S3 files) → canonical attachment shape |
| `checkbox` | `checkbox` | Direct boolean mapping |
| `url` | `url` | Direct string mapping |
| `email` | `email` | Direct string mapping |
| `phone_number` | `phone` | Direct string mapping |
| `formula` | `formula` | Read-only. `isLossless: false`. Extract computed value. |
| `relation` | `link` | Notion relation IDs → cross-link references. Store Notion page IDs in `source_refs`. |
| `rollup` | `rollup` | Read-only. `isLossless: false`. Extract computed value. |
| `created_time` | `created_time` | Direct ISO 8601 mapping |
| `created_by` | `created_by` | Notion user → canonical user reference |
| `last_edited_time` | `last_edited_time` | Direct ISO 8601 mapping |
| `last_edited_by` | `last_edited_by` | Notion user → canonical user reference |
| `status` | `single_select` | Notion status is effectively a select with groups — map to single_select, preserve group info in `source_refs` |
| `unique_id` | `auto_number` | Read-only counter |

**3. Register all Notion field transforms in the `FieldTypeRegistry`:**

For each mapping above, call `FieldTypeRegistry.register()` with platform `'notion'`, the Notion property type, and the transform pair. Follow the exact registration pattern used for Airtable in Phase 2A.

Mark lossy fields: `formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`, `unique_id` → `isLossless: false`.

**4. Create `packages/shared/sync/adapters/notion-adapter.ts`:**

Implement `NotionAdapter` class implementing the `PlatformAdapter` interface. For `toCanonical()`:
- Accept a Notion page object
- Iterate over its `properties` map
- For each property, look up the registered transform in `FieldTypeRegistry` for `('notion', notionPropertyType)`
- Call the transform's `toCanonical()` to produce the canonical field value
- Assemble the canonical JSONB keyed by EveryStack `fields.id` (looked up via `synced_field_mappings`)
- Populate `source_refs` with Notion-specific identifiers (page ID, property IDs, option IDs)

**5. Handle Notion's rich text model:**

Notion's `title` and `rich_text` properties return arrays of rich text objects with annotations (bold, italic, code, color, links). The canonical `text`/`long_text` types store plain text in `value`. Preserve the full rich text array in `source_refs.notion.rich_text` for lossless round-tripping on `fromCanonical()`.

### Acceptance Criteria

- [ ] `NotionAdapter` class implements the `PlatformAdapter` interface
- [ ] `toCanonical()` correctly transforms all ~20 Notion property types to canonical JSONB shapes
- [ ] Each Notion property type has a corresponding `FieldTypeRegistry.register()` call with platform `'notion'`
- [ ] Lossy fields (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`, `unique_id`) are marked `isLossless: false`
- [ ] `source_refs` correctly preserves Notion-specific identifiers (page IDs, property IDs, option IDs, rich text arrays)
- [ ] Rich text properties extract plain text for `value` and preserve full rich text in `source_refs`
- [ ] `select`/`multi_select`/`status` transforms preserve Notion option IDs in `source_refs` for round-tripping
- [ ] `relation` property maps to cross-link references with Notion page IDs in `source_refs`
- [ ] Unit tests cover all ~20 field type transforms with representative Notion API response fixtures
- [ ] Edge cases tested: null/empty properties, rich text with mixed annotations, dates with/without end dates, empty relations
- [ ] `testTenantIsolation()` passes for any new data access functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- `fromCanonical()` direction (Prompt 2)
- Notion filter pushdown (Prompt 2)
- Notion OAuth flow integration (Prompt 2)
- Notion API client or HTTP layer — use the `@notionhq/client` SDK
- SmartSuite adapter (Phase 3 — Core UX)
- Block-level content sync (Notion blocks within pages are not synced — only page-level properties)

---

## Prompt 2: NotionAdapter.fromCanonical(), Notion Filter Pushdown, OAuth Flow, and Sync Pipeline Integration

**Depends on:** Prompt 1 (NotionAdapter.toCanonical() and field type registrations)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 190–260 (Filter Pushdown, Estimated Record Count), `sync-engine.md` lines 93–106 (Sync Setup steps)
**Target files:** `packages/shared/sync/adapters/notion-adapter.ts` (extend), `packages/shared/sync/adapters/notion-field-transforms.ts` (extend — add `fromCanonical` functions), `packages/shared/sync/adapters/notion-filter.ts`, `apps/web/src/lib/notion-oauth.ts`, `apps/worker/src/jobs/sync-inbound.ts` (extend)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement NotionAdapter.fromCanonical(), filter pushdown, OAuth, and sync pipeline integration [Phase 2C, Prompt 2]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform, platform_base_id, credentials (JSONB — encrypted OAuth token), sync_config (JSONB), sync_status, health (JSONB), last_sync_at
synced_field_mappings: id, tenant_id, field_id, base_connection_id, platform_field_id, platform_field_type, transform_config (JSONB)
```

### Task

Complete the Notion adapter with outbound transforms, filter pushdown, OAuth integration, and full sync pipeline wiring.

**1. Implement `fromCanonical()` for all Notion field types:**

Extend `notion-field-transforms.ts` with `fromCanonical()` for each writable field type. The transform converts canonical JSONB values back to Notion API update format. Notion's update API expects a specific property value shape per type.

Key outbound mappings:
- `text` → `title` rich text array (reconstruct from `source_refs.notion.rich_text` if available, otherwise create plain text rich text object)
- `long_text` → `rich_text` array (same reconstruction logic)
- `number` → `number` value
- `single_select` → `select` object with `{id}` from `source_refs` or `{name}` for new options
- `multi_select` → array of `{id}` or `{name}` objects
- `date` → `{start, end, time_zone}` object
- `checkbox` → boolean
- `url`, `email`, `phone` → string values

Read-only fields (`formula`, `rollup`, `created_time`, `created_by`, `last_edited_time`, `last_edited_by`, `unique_id`) must NOT be included in outbound updates — skip them in `fromCanonical()`.

Register the `fromCanonical` direction for all writable Notion types in the `FieldTypeRegistry`.

**2. Build `packages/shared/sync/adapters/notion-filter.ts`:**

Implement the `FilterRule[]` → Notion filter JSON translator. Notion's database query API accepts a `filter` parameter with compound filters (`and`/`or`) and property-specific filter conditions.

```typescript
export function translateToNotionFilter(
  rules: FilterRule[],
  fieldMappings: SyncedFieldMapping[],
): NotionFilter | undefined
```

Map EveryStack filter operators to Notion filter conditions:
- `equals` → `equals` (text, number, select, checkbox)
- `not_equals` → `does_not_equal`
- `contains` → `contains` (text, rich_text)
- `not_contains` → `does_not_contain`
- `is_empty` → `is_empty: true`
- `is_not_empty` → `is_not_empty: true`
- `greater_than` → `greater_than` (number, date)
- `less_than` → `less_than` (number, date)
- `is_before` → `before` (date)
- `is_after` → `after` (date)

Use `synced_field_mappings` to resolve EveryStack field IDs to Notion property IDs in the filter.

**3. Implement Notion OAuth flow in `apps/web/src/lib/notion-oauth.ts`:**

Follow the same OAuth pattern established for Airtable in Phase 2A:
- Build the Notion OAuth authorization URL with required scopes
- Handle the OAuth callback, exchange code for access token
- Store the encrypted token in `base_connections.credentials`
- Notion OAuth uses `Authorization: Bearer {token}` for all API calls

**4. Integrate Notion into the sync setup wizard:**

Extend the existing 3-step sync setup wizard (built in Phase 2A) to support Notion as a platform option:
- **Step 1 (Authenticate):** Add Notion as a platform choice. Clicking "Connect Notion" triggers the Notion OAuth flow.
- **Step 2 (Select Database):** After Notion auth, fetch the list of databases the integration has access to via `POST /v1/search` with `filter: { property: "object", value: "database" }`. Show database names with page counts.
- **Step 3 (Select Tables & Filters):** Same UI as Airtable — toggle tables on/off, configure filters per table.

**5. Wire NotionAdapter into the inbound sync pipeline:**

Update `apps/worker/src/jobs/sync-inbound.ts` to detect `platform === 'notion'` on the `base_connection` and use `NotionAdapter` instead of `AirtableAdapter`. The sync pipeline is adapter-agnostic after this wiring — it calls `adapter.toCanonical()` regardless of platform.

For Notion inbound sync, use `POST /v1/databases/{id}/query` with pagination (`start_cursor`). Apply filter pushdown from `translateToNotionFilter()`. Process pages in batches matching the existing progressive sync pattern.

**6. Register Notion rate limit:**

Add the Notion rate limit to the `PlatformRateLimits` registry:
```typescript
{ platform: 'notion', limits: [{ scope: 'per_integration', limit: 3, window: 1000 }] }
```

**7. Estimated record count for Notion:**

For the setup wizard's record count display, Notion does not expose a direct count API. Use `page_size=1` on a filtered database query to check if results exist, then fetch with pagination metadata to estimate. Show as "~N records (estimated)" with tilde.

### Acceptance Criteria

- [ ] `fromCanonical()` correctly transforms canonical values back to Notion API update format for all writable field types
- [ ] Read-only fields are skipped in `fromCanonical()` — no outbound writes attempted for formula, rollup, created_time, etc.
- [ ] `translateToNotionFilter()` correctly maps `FilterRule[]` operators to Notion filter conditions
- [ ] Filter translation handles compound rules (multiple conditions combined with `and`)
- [ ] Notion OAuth flow completes end-to-end: authorization URL → callback → token storage in `base_connections.credentials`
- [ ] Sync setup wizard shows Notion as a platform option and lists available databases after authentication
- [ ] Inbound sync pipeline dispatches to `NotionAdapter` when `platform === 'notion'`
- [ ] Notion inbound sync uses `POST /v1/databases/{id}/query` with pagination and filter pushdown
- [ ] Notion rate limit (3 req/s per integration) is registered in the `PlatformRateLimits` registry
- [ ] Record count estimation works for Notion databases
- [ ] `source_refs` round-tripping: `toCanonical()` → `fromCanonical()` preserves Notion identifiers (option IDs, rich text)
- [ ] Integration test: mock Notion API, run full inbound sync, verify canonical_data shape
- [ ] `testTenantIsolation()` passes for any new data access functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Smart polling or adaptive intervals (Prompt 3)
- Priority-based scheduling (Prompt 4)
- Error recovery flows (Prompts 6–9)
- Sync dashboard (Prompt 10)
- SmartSuite adapter (Phase 3 — Core UX)
- Notion block-level content sync

---

## Prompt 3: Smart Polling with Adaptive Intervals and Converted Table Skip Logic

**Depends on:** None (existing sync pipeline from 2A/2B; independent of Notion adapter)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 459–487 (Smart Polling subsection — adaptive intervals, visibility-based scheduling, webhook listeners)
**Target files:** `apps/worker/src/jobs/sync-scheduler.ts` (new or extend), `apps/worker/src/jobs/sync-inbound.ts` (extend — converted table check), `packages/shared/sync/types.ts` (extend — polling states)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement smart polling with adaptive intervals and converted table skip logic [Phase 2C, Prompt 3]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform, sync_status ('active'|'paused'|'error'|'auth_required'|'converted'|'converted_dual_write'|'converted_finalized'), sync_config (JSONB), last_sync_at
```

### Task

Upgrade the sync scheduler from fixed-interval polling to adaptive intervals based on table visibility state, and add converted table skip logic.

**1. Define polling interval tiers:**

```typescript
export const POLLING_INTERVALS = {
  ACTIVE_VIEWING: 30_000,        // 30 seconds — user has this table open
  TAB_OPEN_NOT_VISIBLE: 300_000, // 5 minutes — workspace open but table not active
  WORKSPACE_INACTIVE: 1_800_000, // 30 minutes — workspace not accessed recently
  EVENT_DRIVEN: null,            // Airtable webhooks — no polling, event-triggered
} as const;
```

**2. Build the adaptive scheduler in `apps/worker/src/jobs/sync-scheduler.ts`:**

The scheduler determines the polling interval for each synced table based on its current visibility state:

```typescript
export function getPollingInterval(
  platform: string,
  tableVisibility: TableVisibility,
  hasWebhook: boolean,
): number | null
```

Where `TableVisibility` is derived from real-time connection state:
- `'active'` — at least one connected client has this table's room joined (via Socket.io room `table:{tableId}`)
- `'background'` — at least one connected client in the same workspace, but not viewing this table
- `'inactive'` — no connected clients in the workspace

Query the real-time service (via Redis) to determine current table visibility. The Socket.io Redis adapter tracks room membership.

**3. Implement Airtable webhook registration (where available):**

For Airtable bases, register webhook listeners using the Airtable webhook API. When a webhook fires, enqueue an immediate P0 inbound sync job, bypassing the polling schedule. Fall back to polling if webhook registration fails.

Store webhook configuration in `base_connections.sync_config.webhooks`:
```typescript
interface SyncConfigWebhooks {
  airtable_webhook_id?: string;
  airtable_webhook_cursor?: string;
  webhook_registered_at?: string;
}
```

**4. Add converted table skip logic to the sync dispatcher:**

Before dispatching a sync job for a table, check its parent `base_connection.sync_status`:
- `'converted'` or `'converted_finalized'` → skip entirely (table is now native EveryStack)
- `'converted_dual_write'` → dispatch sync but write to shadow records only (not canonical_data)
- All other active statuses → dispatch normally

**5. Update the BullMQ repeatable job configuration:**

Replace the fixed-interval repeatable job with a dynamic scheduling approach:
- The scheduler runs on a fixed interval (e.g., every 30 seconds)
- Each run evaluates all active base_connections
- For each connection's tables, determine the polling interval based on visibility
- Enqueue a sync job only if enough time has elapsed since `last_sync_at` for that table's current interval
- Track last poll time per table in Redis: `sync:last_poll:{baseConnectionId}:{tableId}`

### Acceptance Criteria

- [ ] `getPollingInterval()` returns correct interval for each visibility state (active: 30s, background: 5m, inactive: 30m)
- [ ] Scheduler queries Socket.io room membership (via Redis) to determine table visibility
- [ ] Converted tables (`sync_status = 'converted'` or `'converted_finalized'`) are skipped entirely — no sync jobs dispatched
- [ ] `converted_dual_write` tables dispatch sync jobs that write to shadow only
- [ ] Scheduler only enqueues sync jobs when enough time has elapsed since last poll for the table's current interval
- [ ] Airtable webhook registration is attempted for Airtable bases; webhook-triggered syncs bypass polling
- [ ] Webhook registration failure falls back gracefully to polling
- [ ] Per-table poll tracking in Redis (`sync:last_poll:{baseConnectionId}:{tableId}`) is updated on each sync dispatch
- [ ] Unit tests cover all visibility state combinations and interval calculations
- [ ] Integration test: mock Socket.io room state, verify scheduler dispatches at correct intervals
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Priority-based scheduling P0–P3 (Prompt 4) — this prompt builds adaptive intervals only; priority tiers are layered on top in Prompt 4
- Multi-tenant fairness (Prompt 4)
- Sync status indicators or dashboard UI (Prompts 5, 10)
- Error recovery flows (Prompts 6–9)

---

## Integration Checkpoint 1 (after Prompts 1–3)

**Task:** Verify all work from Prompts 1–3 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: Notion field type registrations are present in FieldTypeRegistry alongside Airtable registrations — no conflicts between the two adapters' registrations
6. Manual verification: smart polling scheduler correctly transitions between intervals when table visibility changes

**Git:** Commit with message `chore(verify): integration checkpoint 1 — Notion adapter + smart polling [Phase 2C, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 4.

---

## Prompt 4: Priority-Based Job Scheduling (P0–P3) and Multi-Tenant Fairness

**Depends on:** Prompt 3 (smart polling scheduler)
**Skills:** backend, phase-context
**Load context:** `sync-engine.md` lines 504–531 (Priority-Based Scheduling, Multi-Tenant Fairness, Sync Status UI)
**Target files:** `apps/worker/src/jobs/sync-scheduler.ts` (extend), `apps/worker/src/jobs/sync-priority.ts` (new), `packages/shared/sync/types.ts` (extend)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement priority-based job scheduling P0-P3 and multi-tenant fairness [Phase 2C, Prompt 4]`

### Schema Snapshot

N/A — no schema changes. This prompt operates on the BullMQ job layer and Redis rate limit state.

### Task

Layer priority-based scheduling on top of the adaptive polling scheduler (Prompt 3) and enforce multi-tenant fairness.

**1. Define the priority tier system:**

```typescript
export enum SyncPriority {
  P0_CRITICAL = 0,  // Outbound sync (cell edits), webhook-triggered inbound
  P1_ACTIVE = 1,    // Inbound polling for actively viewed tables
  P2_BACKGROUND = 2, // Inbound polling for non-visible tables
  P3_INACTIVE = 3,  // Inbound polling for inactive workspaces
}
```

**2. Build `apps/worker/src/jobs/sync-priority.ts`:**

The priority resolver determines how to handle each sync job based on current platform rate limit capacity:

```typescript
export interface PriorityDecision {
  dispatch: boolean;   // Should this job run now?
  delay?: number;      // If not now, retry after this many ms
  reason?: string;     // For logging
}

export function evaluatePriority(
  priority: SyncPriority,
  capacityPercent: number, // Current remaining capacity as 0–100%
): PriorityDecision
```

Implementation rules:
| Priority | Dispatch Condition | Behavior Under Pressure |
|----------|-------------------|------------------------|
| P0 | Always | Always dispatched. Retry with backoff on rate limit. |
| P1 | Capacity >30% | Dispatched if >30% capacity remains. Delayed if <30%. |
| P2 | Capacity >50% | Dispatched if >50% capacity remains. Skipped if <50%. |
| P3 | Capacity >70% | Dispatched if >70% capacity remains. Skipped if <70%. |

**3. Query remaining rate limit capacity:**

The Redis token-bucket rate limiter (built in 2A) tracks consumed tokens. Build a function to query remaining capacity:

```typescript
export async function getRateLimitCapacity(
  platform: string,
  scopeKey: string, // e.g., base ID or integration ID
): Promise<number> // Returns 0–100 percentage remaining
```

Read the ZSET for the rate limit key, count tokens in the current window, compare against the registered limit.

**4. Implement multi-tenant fairness:**

Within each priority tier, tenants are served round-robin:
- Maintain a per-platform round-robin index in Redis: `sync:rr:{platform}:{priorityTier}`
- Per-tenant poll budget: a single tenant cannot consume more than 20% of a platform's rate limit capacity
- P0 is exempt from the 20% cap (critical user-initiated operations always proceed)
- Plan tier does NOT affect sync freshness — fairness is absolute across all plans

```typescript
export async function getNextTenantForPlatform(
  platform: string,
  priorityTier: SyncPriority,
  eligibleTenants: string[],
): Promise<string | null>
```

**5. Integrate priority into the scheduler:**

Update `sync-scheduler.ts` to:
- Assign a `SyncPriority` to each pending sync job based on its source (outbound edit → P0, active table poll → P1, etc.)
- Before dispatching, call `evaluatePriority()` with the current capacity
- For P1–P3 jobs that are delayed/skipped, log the decision for observability

**6. Wire outbound sync jobs as P0:**

Update the outbound sync job (from 2B) to always use `SyncPriority.P0_CRITICAL` when enqueuing. Webhook-triggered inbound syncs (from Prompt 3) also use P0.

### Acceptance Criteria

- [ ] `SyncPriority` enum defines four tiers (P0–P3)
- [ ] `evaluatePriority()` correctly dispatches/delays/skips based on capacity thresholds (P0: always, P1: >30%, P2: >50%, P3: >70%)
- [ ] `getRateLimitCapacity()` correctly reads remaining capacity from the Redis token bucket ZSET
- [ ] Multi-tenant round-robin dispatches jobs fairly within each priority tier
- [ ] Per-tenant 20% capacity cap enforced for P1–P3 (not P0)
- [ ] Outbound sync jobs (cell edits) are always dispatched as P0
- [ ] Webhook-triggered inbound syncs are dispatched as P0
- [ ] P1–P3 delays/skips are logged via Pino for observability
- [ ] Unit tests cover all priority × capacity combinations
- [ ] Integration test: simulate capacity pressure, verify P0 dispatches while P3 is skipped
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Sync status UI indicators (Prompt 5)
- Error recovery flows (Prompts 6–9)
- Dashboard or management UI (Prompt 10)
- Auto-scaling of rate limits based on plan tier — rate limits are platform-imposed, not plan-based

---

## Prompt 5: ConnectionHealth/SyncError Types, Sync Status Indicators UI, and Staleness Threshold

**Depends on:** None (operates on existing `base_connections.health` JSONB column from 1B schema)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 818–870 (Sync Connection Status Model, Sync Status Indicators), `field-groups.md` lines 312–326 (Sync Status Indicator icon — 6 health states)
**Target files:** `packages/shared/sync/types.ts` (extend — ConnectionHealth, SyncError), `packages/shared/sync/health.ts` (new), `apps/web/src/components/sync/SyncStatusBadge.tsx` (new), `apps/web/src/data/sync-status.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement ConnectionHealth types, sync status indicators, and staleness threshold [Phase 2C, Prompt 5]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform, sync_status, health (JSONB — currently unpopulated), last_sync_at, sync_config (JSONB)
  health JSONB shape to define:
  {
    last_success_at: string | null,
    last_error: SyncError | null,
    consecutive_failures: number,
    next_retry_at: string | null,
    records_synced: number,
    records_failed: number
  }
```

### Task

Define the health tracking types, build a health status derivation utility, and create the sync status badge component.

**1. Define `ConnectionHealth` and `SyncError` types in `packages/shared/sync/types.ts`:**

```typescript
export interface ConnectionHealth {
  last_success_at: string | null;
  last_error: SyncError | null;
  consecutive_failures: number;
  next_retry_at: string | null;
  records_synced: number;
  records_failed: number;
}

export interface SyncError {
  code: SyncErrorCode;
  message: string;
  timestamp: string;
  retryable: boolean;
  details: Record<string, unknown>;
}

export type SyncErrorCode =
  | 'auth_expired'
  | 'rate_limited'
  | 'platform_unavailable'
  | 'schema_mismatch'
  | 'permission_denied'
  | 'partial_failure'
  | 'quota_exceeded'
  | 'unknown';
```

Add a Zod schema for `ConnectionHealth` and `SyncError` to validate JSONB on read.

**2. Build `packages/shared/sync/health.ts`:**

Health status derivation utility:

```typescript
export type SyncHealthState =
  | 'healthy'      // active + recent sync
  | 'syncing'      // sync currently running
  | 'stale'        // active but >2× polling_interval since last sync
  | 'retrying'     // error but retryable, next_retry_at set
  | 'error'        // non-retryable error
  | 'auth_required' // OAuth token expired/revoked
  | 'paused'       // Manager manually paused
  | 'conflicts'    // active but has pending conflicts

export function deriveSyncHealthState(
  syncStatus: string,
  health: ConnectionHealth | null,
  lastSyncAt: Date | null,
  pollingInterval: number,
  pendingConflictCount: number,
  isSyncing: boolean,
): SyncHealthState
```

The staleness threshold is `2 × pollingInterval`. If `lastSyncAt` is older than this, the state becomes `'stale'`.

Also build:
```typescript
export function updateConnectionHealth(
  existing: ConnectionHealth | null,
  event: 'sync_success' | 'sync_error',
  details?: Partial<SyncError>,
): ConnectionHealth
```

This function transitions the health state: on success, reset `consecutive_failures` and clear `last_error`; on error, increment `consecutive_failures` and set `last_error`.

**3. Build `apps/web/src/data/sync-status.ts`:**

Server-side data function to fetch sync status for a table:

```typescript
export async function getSyncStatusForTable(
  tenantId: string,
  tableId: string,
): Promise<SyncStatus>
```

Returns the derived health state, last sync time, pending conflict count, and platform info. Uses `getDbForTenant()`.

**4. Build `apps/web/src/components/sync/SyncStatusBadge.tsx`:**

A React component that renders the sync status indicator in the table header:

| Health State | Badge Text | Color | Behavior |
|-------------|------------|-------|----------|
| `healthy` | "Synced 2 min ago" | `textSecondary` (green dot) | Normal |
| `syncing` | "Syncing..." | `accent` (teal, animated) | Pulsing indicator |
| `stale` | "Last synced 45 min ago" | `warning` (yellow dot) | Tooltip: "Sync may be delayed" |
| `retrying` | "Sync retrying..." | `warning` (yellow, pulsing) | Tooltip shows error + next retry time |
| `error` | "Sync error" | `error` (red) | Click opens sync settings |
| `auth_required` | "Re-authentication required" | `error` (red) | Click navigates to re-auth |
| `paused` | "Sync paused" | `textSecondary` (gray) | Manager paused |
| `conflicts` | "Synced · N conflicts" | `warning` (amber dot) | Click opens conflict resolution |

Use shadcn/ui `Badge` and `Tooltip` primitives. Follow the design system color tokens. Relative time display (e.g., "2 min ago") uses a lightweight relative time formatter — no heavyweight library.

### Acceptance Criteria

- [ ] `ConnectionHealth` and `SyncError` types are exported from `packages/shared/sync/types.ts`
- [ ] Zod schemas validate `ConnectionHealth` and `SyncError` JSONB shapes
- [ ] `deriveSyncHealthState()` correctly derives all 8 health states based on inputs
- [ ] Staleness threshold is calculated as `2 × pollingInterval` — state becomes `'stale'` when exceeded
- [ ] `updateConnectionHealth()` correctly transitions health on success (reset failures) and error (increment failures)
- [ ] `getSyncStatusForTable()` returns correct sync status using `getDbForTenant()`
- [ ] `testTenantIsolation()` passes for `getSyncStatusForTable()`
- [ ] `SyncStatusBadge` renders all 8 health states with correct colors and text
- [ ] Badge click navigates to sync settings for error states
- [ ] Badge click navigates to re-auth flow for `auth_required` state
- [ ] Relative time display shows correct human-readable time (e.g., "2 min ago", "1 hour ago")
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Error recovery flow implementations (Prompts 6–9) — this prompt defines the types and display; recovery logic is separate
- Sync settings dashboard (Prompt 10)
- Synced table sidebar badges (Prompt 11) — this prompt builds the table header badge; sidebar badges are separate
- Notification system (Prompt 9)

---

## Prompt 6: Auth Expired, Permission Denied, and Platform Unavailable Recovery Flows

**Depends on:** Prompt 5 (ConnectionHealth/SyncError types, `updateConnectionHealth()`)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 871–942 (Error Recovery Flows: Auth Expired, Platform Unavailable sections)
**Target files:** `apps/worker/src/jobs/sync-error-handler.ts` (new), `apps/web/src/components/sync/ReauthBanner.tsx` (new), `apps/web/src/actions/sync-reauth.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement auth expired, permission denied, and platform unavailable recovery flows [Phase 2C, Prompt 6]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform, sync_status, health (JSONB — ConnectionHealth), credentials (JSONB — encrypted)
```

### Task

Implement three error recovery flows that handle the most common sync failure scenarios.

**1. Build `apps/worker/src/jobs/sync-error-handler.ts`:**

A centralized error handler invoked by the sync pipeline when a sync attempt fails:

```typescript
export async function handleSyncError(
  baseConnectionId: string,
  error: unknown,
  context: SyncJobContext,
): Promise<void>
```

This function:
- Classifies the error into one of the 8 `SyncErrorCode` categories
- Calls `updateConnectionHealth()` to update `base_connections.health`
- Transitions `sync_status` based on the error type
- Schedules retry (for retryable errors) or marks for manual intervention

Error classification logic:
- HTTP 401/403 from platform API → `auth_expired` or `permission_denied`
- HTTP 429 → `rate_limited` (auto-recovery via backoff)
- HTTP 5xx or timeout → `platform_unavailable`
- Validation errors on individual records → `partial_failure`
- Schema structure changes → `schema_mismatch`

**2. Implement auth expired recovery flow:**

When the sync pipeline receives a 401/403 from the platform API:
1. Set `sync_status = 'auth_required'` on the `base_connection`
2. Set `health.last_error = { code: 'auth_expired', message: '...', retryable: false }`
3. No further sync attempts for this connection until re-authenticated
4. The `SyncStatusBadge` (from Prompt 5) already shows "Re-authentication required" (red) for this state

Build `apps/web/src/components/sync/ReauthBanner.tsx`:
- A red banner displayed at the top of any table synced from the affected connection
- Text: "Your connection to {Platform} has expired. Re-authenticate to resume syncing."
- Button: "[Re-authenticate]" → triggers the OAuth re-auth flow

Build `apps/web/src/actions/sync-reauth.ts`:
- Server Action that handles the re-auth completion callback
- Stores the new OAuth token in `base_connections.credentials`
- Resets `sync_status = 'active'` and clears `health.last_error`
- Enqueues an immediate P0 catch-up sync job to sync all changes since `last_sync_at`

**No data loss:** While auth is expired, local edits accumulate normally. The catch-up sync picks up all changes from both sides using the `last_sync_at` cursor.

**3. Implement permission denied recovery:**

Similar to auth expired, but with a different message:
- Set `health.last_error = { code: 'permission_denied', message: '...', retryable: false }`
- Banner text: "Your {Platform} integration no longer has write access to this base. Ask the {Platform} admin to restore permissions."
- No automatic recovery — requires the user to fix permissions on the platform side, then click "[Retry Now]"

**4. Implement platform unavailable recovery:**

When the platform API returns 5xx or times out:
1. Retry with exponential backoff: 1 min → 5 min → 15 min → 1 hour → 3 hours → 6 hours
2. Track retry state in `health.next_retry_at` and `health.consecutive_failures`
3. During retries: `SyncStatusBadge` shows "Sync retrying... Next attempt in {time}" (yellow, pulsing)
4. After 6 hours of continuous failure (6 retry cycles): set `sync_status = 'error'`
5. Badge shows: "Sync error — {Platform} may be down. [Retry Now] [Pause Sync]"

Build the exponential backoff calculator:
```typescript
const BACKOFF_SCHEDULE = [60_000, 300_000, 900_000, 3_600_000, 10_800_000, 21_600_000]; // 1m, 5m, 15m, 1h, 3h, 6h

export function getBackoffDelay(consecutiveFailures: number): number | null {
  if (consecutiveFailures >= BACKOFF_SCHEDULE.length) return null; // Max retries exceeded
  return BACKOFF_SCHEDULE[consecutiveFailures];
}
```

"Retry Now" resets `consecutive_failures` to 0 and enqueues an immediate sync attempt.
"Pause Sync" sets `sync_status = 'paused'`, stopping all sync activity.

### Acceptance Criteria

- [ ] `handleSyncError()` correctly classifies errors into the 8 `SyncErrorCode` categories
- [ ] Auth expired flow: 401/403 → `sync_status = 'auth_required'`, no further sync attempts
- [ ] `ReauthBanner` displays correct platform name and re-auth button
- [ ] Re-auth completion: new token stored, `sync_status` reset to `'active'`, P0 catch-up sync enqueued
- [ ] Catch-up sync uses `last_sync_at` cursor — no data loss during auth downtime
- [ ] Permission denied flow: appropriate message, manual retry via "[Retry Now]"
- [ ] Platform unavailable flow: exponential backoff with correct schedule (1m, 5m, 15m, 1h, 3h, 6h)
- [ ] `health.next_retry_at` is set correctly during backoff
- [ ] After 6 hours of failures: `sync_status = 'error'`, badge shows error state
- [ ] "Retry Now" resets backoff and enqueues immediate sync
- [ ] "Pause Sync" sets `sync_status = 'paused'`
- [ ] All health transitions use `updateConnectionHealth()` for consistency
- [ ] `testTenantIsolation()` passes for any new data access functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Partial failure recovery (Prompt 7)
- Schema mismatch recovery (Prompt 8)
- Quota exceeded recovery (Prompt 9)
- Notification system (Prompt 9)
- Sync dashboard (Prompt 10)

---

## Integration Checkpoint 2 (after Prompts 4–6)

**Task:** Verify all work from Prompts 4–6 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: priority scheduling correctly dispatches P0 jobs even when capacity is below 30%
6. Manual verification: `SyncStatusBadge` renders correctly for all 8 health states
7. Manual verification: error handler correctly classifies mock 401, 429, and 5xx errors

**Git:** Commit with message `chore(verify): integration checkpoint 2 — priority scheduling + error recovery [Phase 2C, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 7.

---

## Prompt 7: Partial Failure Recovery Flow with sync_failures Population and Failures Tab UI

**Depends on:** Prompt 5 (ConnectionHealth types), Prompt 6 (error handler framework)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 943–1000 (Partial Failure recovery flow, sync_failures table schema, auto-retry policy)
**Target files:** `apps/worker/src/jobs/sync-error-handler.ts` (extend), `packages/shared/sync/sync-failures.ts` (new), `apps/web/src/components/sync/FailuresTab.tsx` (new), `apps/web/src/data/sync-failures.ts` (new), `apps/web/src/actions/sync-failure-actions.ts` (new)
**Migration required:** No — `sync_failures` table already exists from Phase 1B schema.
**Git:** Commit with message `feat(sync): implement partial failure recovery with sync_failures population and Failures tab UI [Phase 2C, Prompt 7]`

### Schema Snapshot

```
sync_failures: id (UUIDv7 PK), tenant_id, base_connection_id, record_id (nullable), direction ('inbound'|'outbound'), error_code ('validation'|'schema_mismatch'|'payload_too_large'|'platform_rejected'|'unknown'), error_message (TEXT), platform_record_id (nullable), payload (JSONB), retry_count (INTEGER), status ('pending'|'retrying'|'resolved'|'skipped'|'requires_manual_resolution'), created_at, resolved_at (nullable), resolved_by (nullable)
```

### Task

Implement the partial failure recovery flow: when some records in a sync batch fail while others succeed, commit the successes and track the failures for resolution.

**1. Update the inbound sync pipeline for partial failure handling:**

In the sync-inbound job, wrap each record's `toCanonical()` and database write in a try/catch. When a record fails:
- Write it to the `sync_failures` table with the error details and the failing payload
- Continue processing remaining records in the batch
- After the batch completes, set `health.records_failed` count and mark sync as `'completed_with_errors'`

The sync pipeline should NOT fail the entire batch because of individual record failures.

**2. Build `packages/shared/sync/sync-failures.ts`:**

Data access functions for the `sync_failures` table:

```typescript
export async function createSyncFailure(tenantId: string, failure: CreateSyncFailureInput): Promise<SyncFailure>
export async function getSyncFailuresForConnection(tenantId: string, baseConnectionId: string): Promise<SyncFailure[]>
export async function retrySyncFailure(tenantId: string, failureId: string): Promise<void>
export async function skipSyncFailure(tenantId: string, failureId: string, resolvedBy: string): Promise<void>
export async function bulkRetrySyncFailures(tenantId: string, baseConnectionId: string): Promise<number>
export async function bulkSkipSyncFailures(tenantId: string, baseConnectionId: string, resolvedBy: string): Promise<number>
```

**3. Implement auto-retry policy:**

Partial failures auto-retry up to 3 times across subsequent sync cycles:
- On each sync cycle, check for `sync_failures` with `status = 'pending'` and `retry_count < 3`
- Re-attempt the failed record using the stored `payload`
- Increment `retry_count` on each attempt
- After 3 failures: set `status = 'requires_manual_resolution'`, stop auto-retrying

**4. Build `apps/web/src/data/sync-failures.ts`:**

Server-side data function:
```typescript
export async function getSyncFailures(tenantId: string, baseConnectionId: string): Promise<SyncFailureWithRecord[]>
```

Joins `sync_failures` with `records` to include record display name. Uses `getDbForTenant()`.

**5. Build `apps/web/src/components/sync/FailuresTab.tsx`:**

The Failures tab in the Sync Settings Dashboard (wired in Prompt 10). Displays a list of failed records with error details and action buttons:

For each failure:
- Record name (linked to open record view)
- Error description (human-readable, no technical codes)
- Action buttons:
  - **[Retry]** — re-enqueues the record for next sync cycle (`retrySyncFailure()`)
  - **[Skip]** — marks failure as resolved, record remains as-is (`skipSyncFailure()`)
  - **[Edit in EveryStack]** — opens record view for manual fix, then retry

Bulk actions at the bottom:
- **[Retry All]** — re-enqueues all pending failures
- **[Skip All]** — marks all as resolved

Use shadcn/ui `Card`, `Button`, `Badge`, and `ScrollArea` primitives.

**6. Retention policy:**

Resolved failures are retained for 30 days (cleanup via a scheduled BullMQ job or manual pruning). Pending failures retained indefinitely.

**7. Build `apps/web/src/actions/sync-failure-actions.ts`:**

Server Actions for retry and skip operations:
```typescript
export async function retrySyncFailureAction(failureId: string): Promise<void>
export async function skipSyncFailureAction(failureId: string): Promise<void>
export async function bulkRetrySyncFailuresAction(baseConnectionId: string): Promise<{ retried: number }>
export async function bulkSkipSyncFailuresAction(baseConnectionId: string): Promise<{ skipped: number }>
```

### Acceptance Criteria

- [ ] Inbound sync pipeline handles individual record failures without failing the entire batch
- [ ] Failed records are written to `sync_failures` with correct error code, message, and payload
- [ ] Successfully synced records in the same batch are committed normally
- [ ] Sync status shows `'completed_with_errors'` when some records fail
- [ ] Auto-retry processes pending failures (retry_count < 3) on subsequent sync cycles
- [ ] After 3 retries, failure status set to `'requires_manual_resolution'`
- [ ] `getSyncFailures()` returns failures with record display names
- [ ] `testTenantIsolation()` passes for `getSyncFailures()`, `retrySyncFailure()`, `skipSyncFailure()`
- [ ] `FailuresTab` renders failure list with error descriptions and action buttons
- [ ] "[Retry]" re-enqueues the specific failure record
- [ ] "[Skip]" marks failure as resolved
- [ ] "[Retry All]" and "[Skip All]" bulk actions work correctly
- [ ] Resolved failures have `resolved_at` timestamp set
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Schema mismatch recovery (Prompt 8) — separate error type with different UX
- Quota exceeded recovery (Prompt 9)
- Full sync settings dashboard layout (Prompt 10) — this prompt builds the Failures tab content; dashboard layout is separate
- "[Map to Field...]" action for schema mismatches within the failures tab (Prompt 8)

---

## Prompt 8: Schema Mismatch Recovery Flow and Schema Sync Change Detection

**Depends on:** Prompt 5 (ConnectionHealth types), Prompt 6 (error handler framework)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 1001–1065 (Schema Mismatch recovery flow, sync_schema_changes table, Schema Sync section, impact analysis)
**Target files:** `packages/shared/sync/schema-change-detector.ts` (new), `packages/shared/sync/sync-schema-changes.ts` (new), `apps/worker/src/jobs/sync-inbound.ts` (extend), `apps/web/src/components/sync/SchemaChangesTab.tsx` (new), `apps/web/src/data/sync-schema-changes.ts` (new), `apps/web/src/actions/sync-schema-actions.ts` (new)
**Migration required:** No — `sync_schema_changes` table already exists from Phase 1B schema.
**Git:** Commit with message `feat(sync): implement schema mismatch recovery and schema sync change detection [Phase 2C, Prompt 8]`

### Schema Snapshot

```
sync_schema_changes: id (UUIDv7 PK), tenant_id, base_connection_id, change_type ('field_type_changed'|'field_deleted'|'field_added'|'field_renamed'), field_id (nullable — null for new fields), platform_field_id, old_schema (JSONB), new_schema (JSONB), impact (JSONB), status ('pending'|'accepted'|'rejected'), created_at, resolved_at (nullable), resolved_by (nullable)
fields: id, tenant_id, table_id, name, field_type, config (JSONB), sort_order
synced_field_mappings: id, tenant_id, field_id, base_connection_id, platform_field_id, platform_field_type
```

### Task

Implement schema change detection during inbound sync and the Schema Changes resolution panel.

**1. Build `packages/shared/sync/schema-change-detector.ts`:**

During each inbound sync, compare the platform's current field schema against the locally stored `synced_field_mappings`:

```typescript
export interface SchemaChange {
  changeType: 'field_type_changed' | 'field_deleted' | 'field_added' | 'field_renamed';
  fieldId: string | null;
  platformFieldId: string;
  oldSchema: Record<string, unknown> | null;
  newSchema: Record<string, unknown> | null;
}

export function detectSchemaChanges(
  localMappings: SyncedFieldMapping[],
  platformFields: PlatformFieldDefinition[],
): SchemaChange[]
```

Detection logic:
- **Field type changed:** A mapped field's platform type differs from `synced_field_mappings.platform_field_type`
- **Field deleted:** A field in `synced_field_mappings` has no matching field on the platform
- **Field added:** A platform field has no matching row in `synced_field_mappings`
- **Field renamed:** A mapped field's name on the platform differs from the local `fields.name` (detected by matching on `platform_field_id`)

**2. Build `packages/shared/sync/sync-schema-changes.ts`:**

Data access functions:

```typescript
export async function createSchemaChange(tenantId: string, change: CreateSchemaChangeInput): Promise<SyncSchemaChange>
export async function getSchemaChangesForConnection(tenantId: string, baseConnectionId: string): Promise<SyncSchemaChange[]>
export async function acceptSchemaChange(tenantId: string, changeId: string, resolvedBy: string): Promise<void>
export async function rejectSchemaChange(tenantId: string, changeId: string, resolvedBy: string): Promise<void>
```

**3. Compute downstream impact analysis:**

Before presenting a schema change to the Manager, compute how many downstream features reference the affected field:

```typescript
export async function computeSchemaChangeImpact(
  tenantId: string,
  fieldId: string,
): Promise<SchemaChangeImpact>

export interface SchemaChangeImpact {
  formulaCount: number;      // Formula fields referencing this field
  automationCount: number;   // Automations with conditions on this field
  portalFieldCount: number;  // Portal data bindings using this field
  crossLinkCount: number;    // Cross-links displaying this field
}
```

Store the computed impact in `sync_schema_changes.impact` JSONB when creating the change record.

**4. Integrate schema change detection into the inbound sync pipeline:**

At the start of each inbound sync cycle, run `detectSchemaChanges()`. If changes are detected:
- Write them to `sync_schema_changes` with `status = 'pending'`
- For `field_type_changed` and `field_deleted`: pause syncing the affected fields (skip them in the current sync) until the Manager resolves
- For `field_added`: continue syncing — the new field data arrives but has no local field definition yet
- Show a banner on the affected table: "Schema change detected on {Platform}. [Review Changes]"

**5. Build `apps/web/src/components/sync/SchemaChangesTab.tsx`:**

The Schema Changes tab content for the Sync Settings Dashboard:

For each pending change, show:

- **Field type changed:** Warning icon. "Field '{name}' type changed: {old_type} → {new_type}. This may affect {N} formula fields and {M} automations." Actions: **[Accept Change]** | **[Reject — Keep Local Type]**
- **Field deleted:** Error icon. "Field '{name}' deleted on {Platform}. This field has {N} records with data. Data preserved locally but will no longer sync." Actions: **[Archive Field]** | **[Delete Field]**
- **Field added:** Success icon. "New field '{name}' ({type}) added on {Platform}." Actions: **[Add to EveryStack]** | **[Ignore]**
- **Field renamed:** Info icon. "Field '{name}' renamed to '{new_name}' on {Platform}." Actions: **[Accept Rename]** | **[Keep Local Name]**

Show the impact analysis below type-changed and deleted field entries.

**6. Implement resolution actions via Server Actions:**

- **Accept Change (type changed):** Update `fields.field_type` and `synced_field_mappings.platform_field_type`. Re-validate existing canonical data. Resume syncing.
- **Reject (type changed):** Keep local type. Mark field as local-only (no longer syncs this field). Add comment to `synced_field_mappings`.
- **Archive Field (deleted):** Soft-archive the field definition — data preserved, field hidden from grid. Remove from `synced_field_mappings`.
- **Delete Field (deleted):** Delete the field definition and clear canonical data for this field across all records.
- **Add to EveryStack (new):** Create a new `fields` row with the detected type, create a `synced_field_mappings` row, and start syncing.
- **Ignore (new):** Mark the schema change as rejected. Field is not synced.
- **Accept Rename:** Update `fields.name` to the new name.
- **Keep Local Name:** Reject the change. Local name preserved.

All resolution actions set `status = 'accepted'|'rejected'`, `resolved_at`, and `resolved_by` on the `sync_schema_changes` row.

**7. Schema sync — field definitions synced separately:**

Deleted external fields are soft-archived (not deleted from EveryStack) to prevent broken cross-links and portal bindings. The `Archive Field` action preserves data while hiding the field from the UI.

### Acceptance Criteria

- [ ] `detectSchemaChanges()` correctly identifies type changes, deletions, additions, and renames
- [ ] Schema changes are written to `sync_schema_changes` with correct `change_type` and schemas
- [ ] Impact analysis computes formula, automation, portal, and cross-link reference counts
- [ ] Affected fields (type changed, deleted) are skipped during sync until Manager resolves
- [ ] New fields continue syncing (data arrives, no local field definition yet)
- [ ] `SchemaChangesTab` renders all 4 change types with correct icons, descriptions, and action buttons
- [ ] "Accept Change" updates field type and resumes syncing
- [ ] "Archive Field" soft-archives the field — data preserved, hidden from grid
- [ ] "Add to EveryStack" creates the field and mapping, starts syncing
- [ ] All resolutions set `resolved_at` and `resolved_by`
- [ ] `testTenantIsolation()` passes for all new data access functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Partial failure recovery (Prompt 7 — separate error type)
- Quota exceeded recovery (Prompt 9)
- Full sync settings dashboard layout (Prompt 10)
- Formula engine or field type migration tooling — schema changes only affect the mapping and metadata

---

## Prompt 9: Quota Exceeded Recovery Flow and Sync Notification System

**Depends on:** Prompt 5 (ConnectionHealth types)
**Skills:** backend, ux-ui, phase-context
**Load context:** `sync-engine.md` lines 1066–1097 (Quota Exceeded recovery flow), `sync-engine.md` lines 880–920 (Notification System for Sync Issues)
**Target files:** `apps/worker/src/jobs/sync-error-handler.ts` (extend), `apps/web/src/components/sync/QuotaExceededPanel.tsx` (new), `packages/shared/sync/sync-notifications.ts` (new), `apps/realtime/src/handlers/sync-notifications.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement quota exceeded recovery flow and sync notification system [Phase 2C, Prompt 9]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform, sync_status, health (JSONB — ConnectionHealth)
tenants: id, plan_tier, record_quota
records: id, tenant_id, table_id, deleted_at (nullable)
```

### Task

Implement the quota exceeded recovery flow and the notification system for all sync issues.

**1. Quota exceeded recovery flow:**

When inbound sync detects the record quota would be exceeded (logic already exists from 2A — `quota:records:{tenantId}` Redis cache), the error handler should:
1. Sync the records that fit (partial sync — up to remaining quota)
2. Set `sync_status = 'error'`, `health.last_error.code = 'quota_exceeded'`
3. Record how many records could not be synced in `health.last_error.details.unsyncedCount`

**2. Build `apps/web/src/components/sync/QuotaExceededPanel.tsx`:**

A panel shown when a Manager clicks the "Record quota reached" badge:

```
┌──────────────────────────────────────────────────┐
│  Warning: Record quota reached                    │
│                                                    │
│  Your workspace has 250,000 of 250,000 records    │
│  (Professional plan limit).                       │
│                                                    │
│  1,200 records from "Tasks" could not be synced.  │
│                                                    │
│  Options:                                          │
│  [Add Sync Filter]  Reduce inbound records        │
│  [Upgrade Plan]     Increase your record quota    │
│  [Delete Records]   Free up space                 │
│  [Disable Tables]   Stop syncing unneeded tables  │
└──────────────────────────────────────────────────┘
```

Actions:
- **[Add Sync Filter]** — navigates to the Tables & Filters tab in sync settings
- **[Upgrade Plan]** — navigates to billing settings
- **[Delete Records]** — navigates to the table with a filter showing oldest/least-used records
- **[Disable Tables]** — navigates to the Tables & Filters tab with table toggles

After the user frees quota (by filtering, deleting, or upgrading), a "[Resume Sync]" button appears that triggers an immediate sync cycle for the skipped records.

**3. Build the sync notification system:**

Implement the notification pipeline for sync issues per the spec:

| Event | Type | Recipients | Timing |
|-------|------|------------|--------|
| Conflict detected (manual mode) | In-app badge + push (toast) | Table Manager(s) | Immediate |
| Auth expired | In-app banner + email via Resend | Workspace Owner + Admins | Immediate |
| 3 consecutive sync failures | In-app toast | Table Manager(s) | After 3rd failure |
| Sync down >1 hour | Email via Resend | Workspace Owner | After 1 hour |
| Sync down >6 hours | Email (escalation) | Workspace Owner + Admins | After 6 hours |
| Partial failure (>10 records) | In-app toast + badge on sync settings | Table Manager(s) | After sync completes |
| Schema mismatch detected | In-app banner on table | Table Manager(s) | Immediate |
| Rate limit sustained (>5 min) | In-app subtle indicator | None (auto-resolves) | — |

**4. Build `packages/shared/sync/sync-notifications.ts`:**

```typescript
export async function sendSyncNotification(
  tenantId: string,
  event: SyncNotificationEvent,
  details: SyncNotificationDetails,
): Promise<void>
```

This function:
- Determines the notification recipients based on event type and workspace roles
- For in-app notifications: publish to Redis channel `t:{tenantId}:user:{userId}:notifications` (same channel the real-time service forwards to connected clients)
- For email notifications: enqueue a BullMQ job that sends via Resend (the email service from 1G)
- In-app notifications use toast-only for now (persistent `notifications` table is Post-MVP — Comms & Polish)

**5. Wire notification triggers into the error handler:**

Update `sync-error-handler.ts` to call `sendSyncNotification()` at the appropriate trigger points:
- On conflict detected (if table is in manual resolution mode)
- On auth expired (immediate)
- On 3rd consecutive failure (`health.consecutive_failures === 3`)
- On sustained downtime (check `health.last_success_at` against 1-hour and 6-hour thresholds via a scheduled BullMQ check job)
- On partial failure with >10 records failed
- On schema mismatch detected

**6. Escalation tier check job:**

Build a scheduled BullMQ job that runs every 15 minutes, checks all active `base_connections` for sustained downtime:
- If `last_success_at` is >1 hour ago and `sync_status !== 'paused'`: send 1-hour email
- If `last_success_at` is >6 hours ago: send escalation email to Owner + Admins

### Acceptance Criteria

- [ ] Quota exceeded: records that fit are synced, remaining are tracked in `health.last_error.details.unsyncedCount`
- [ ] `QuotaExceededPanel` renders current quota, plan limit, and 4 resolution options
- [ ] "[Resume Sync]" triggers an immediate sync cycle after quota is freed
- [ ] Notification system sends in-app toasts for immediate events (conflicts, failures, schema changes)
- [ ] Auth expired triggers email notification to Owner + Admins via Resend
- [ ] 3rd consecutive failure triggers in-app toast to Table Managers
- [ ] Escalation check job runs every 15 minutes and sends emails for >1h and >6h downtime
- [ ] Notifications are published to the correct Redis channel for real-time forwarding
- [ ] Rate-limited events do NOT generate notifications (auto-resolving)
- [ ] `testTenantIsolation()` passes for any new data access functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Persistent `notifications` table — Post-MVP (Comms & Polish). Use toast-only for now.
- Notification preferences UI — Post-MVP
- Push notifications (mobile) — Phase 3H
- Full sync settings dashboard layout (Prompt 10)

---

## Prompt 10: Sync Settings Dashboard (6-Tab Layout)

**Depends on:** Prompt 5 (sync status types), Prompt 7 (FailuresTab), Prompt 8 (SchemaChangesTab), Prompt 9 (QuotaExceededPanel)
**Skills:** ux-ui, backend, phase-context
**Load context:** `sync-engine.md` lines 1035–1070 (Sync Settings Dashboard wireframe, Sync History tab, Tables & Filters tab, Sync Now button)
**Target files:** `apps/web/src/app/(workspace)/[workspaceId]/settings/sync/[baseConnectionId]/page.tsx`, `apps/web/src/components/sync/SyncDashboard.tsx` (new), `apps/web/src/components/sync/OverviewTab.tsx` (new), `apps/web/src/components/sync/TablesFiltersTab.tsx` (new), `apps/web/src/components/sync/ConflictsTab.tsx` (new), `apps/web/src/components/sync/HistoryTab.tsx` (new), `apps/web/src/data/sync-dashboard.ts` (new), `apps/web/src/actions/sync-dashboard-actions.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(sync): implement sync settings dashboard with 6-tab layout [Phase 2C, Prompt 10]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform, platform_base_id, sync_status, health (JSONB), sync_config (JSONB), last_sync_at
sync_conflicts: id, tenant_id, base_connection_id, record_id, field_id, status ('pending'|'resolved_*')
sync_failures: id, tenant_id, base_connection_id, status, created_at
sync_schema_changes: id, tenant_id, base_connection_id, status, created_at
```

### Task

Build the Sync Settings Dashboard — the central management surface for Managers to monitor and manage sync connections.

**1. Build the route and page:**

Create the route at `(workspace)/[workspaceId]/settings/sync/[baseConnectionId]/page.tsx`. This page is accessed via:
- Clicking "Sync Settings" in the table header sync status badge
- Navigating from workspace settings
- Clicking the sync status icon in the sidebar

**2. Build `apps/web/src/components/sync/SyncDashboard.tsx`:**

The dashboard layout with 6 tabs using shadcn/ui `Tabs`:

```
┌──────────────────────────────────────────────────────────────┐
│  Sync Connection: {Platform} → "{Base Name}"                  │
│                                                                │
│  Status: {SyncHealthState}                                    │
│  Last Sync: {relative time} ({record count} records)          │
│  Direction: Bidirectional                                     │
│  Polling Interval: {current interval}                         │
│  Conflicts: {N} pending                                       │
│  Failures: {N} records                                        │
│                                                                │
│  Tabs: [Overview] [Tables & Filters] [Conflicts (N)]          │
│        [Failures (N)] [Schema Changes (N)] [History]          │
│                                                                │
│  [Sync Now] [Pause Sync] [Disconnect]                         │
└──────────────────────────────────────────────────────────────┘
```

Tab badges show pending counts for Conflicts, Failures, and Schema Changes (red badge if >0).

**3. Build `OverviewTab.tsx`:**

Shows the connection summary and a sync history sparkline:
- Connection status, platform, base name, direction
- Last sync time and record count
- Sync history visualization for the last 7 days: a compact bar chart showing sync runs (green = success, yellow = partial, red = failed)
- Average duration and average records per sync

**4. Build `TablesFiltersTab.tsx`:**

Shows all tables from the connected base with management controls:
- Per-table row: table name, enabled/disabled toggle, synced/total record count, filter summary
- Expand arrow to open the full filter builder (reuse the `FilterRule[]` builder from 2A)
- Changes to filters trigger "Save & Re-sync" flow: save new filter config → immediate P0 re-sync → orphan detection for records that no longer match

**5. Build `ConflictsTab.tsx`:**

Shows pending conflicts for this connection. Reuses the conflict resolution modal UI from Phase 2B:
- List of pending conflicts with record name, field name, local value vs remote value
- "[Resolve]" button per conflict → opens the existing conflict resolution modal
- Bulk actions: "[Resolve All: Keep EveryStack]" / "[Resolve All: Keep Remote]"

**6. Wire in existing tabs:**

- **Failures tab:** Import and render `FailuresTab` from Prompt 7
- **Schema Changes tab:** Import and render `SchemaChangesTab` from Prompt 8

**7. Build `HistoryTab.tsx`:**

Table of recent sync runs with columns:
- Timestamp
- Direction (inbound/outbound)
- Records synced / Records failed
- Duration
- Status (success / partial / failed)

Click a sync run row → expand to show detailed log of what changed (records created/updated/deleted counts).

**8. Build dashboard actions:**

- **[Sync Now]:** Enqueues an immediate P0 sync job for this connection. Disabled while a sync is currently running. Shows "Syncing..." with progress.
- **[Pause Sync]:** Sets `sync_status = 'paused'`. Stops all sync activity for this connection.
- **[Resume Sync]:** Resets `sync_status = 'active'`. Enqueues an immediate catch-up sync.
- **[Disconnect]:** Confirmation dialog. Removes the `base_connection` credentials, stops all sync, marks all synced tables as local-only. Does NOT delete synced data.

**9. Build `apps/web/src/data/sync-dashboard.ts`:**

Data functions for the dashboard:
```typescript
export async function getSyncDashboardData(tenantId: string, baseConnectionId: string): Promise<SyncDashboardData>
export async function getSyncHistory(tenantId: string, baseConnectionId: string, days: number): Promise<SyncHistoryEntry[]>
```

### Acceptance Criteria

- [ ] Dashboard route accessible at `/[workspaceId]/settings/sync/[baseConnectionId]`
- [ ] 6 tabs render correctly: Overview, Tables & Filters, Conflicts, Failures, Schema Changes, History
- [ ] Tab badges show pending counts with red indicators for Conflicts, Failures, Schema Changes
- [ ] Overview tab shows connection summary and 7-day sync history sparkline
- [ ] Tables & Filters tab shows per-table toggles and filter configuration with "Save & Re-sync"
- [ ] Conflicts tab lists pending conflicts with resolution actions
- [ ] History tab shows recent sync runs with expandable detail rows
- [ ] "[Sync Now]" enqueues P0 sync job, disabled while syncing
- [ ] "[Pause Sync]" sets `sync_status = 'paused'`, stops all activity
- [ ] "[Disconnect]" removes credentials and marks tables as local-only (with confirmation)
- [ ] `testTenantIsolation()` passes for `getSyncDashboardData()` and `getSyncHistory()`
- [ ] All UI uses shadcn/ui primitives and follows design system tokens
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Real-time dashboard updates (future enhancement — dashboard data refreshes on page load and manual refresh)
- Export sync history as CSV (Post-MVP)
- Multi-connection comparison view (Post-MVP)
- SmartSuite-specific dashboard elements (Phase 3)

---

## Prompt 11: Synced Table Tab Badges — Platform Badge and Sync Status Indicator

**Depends on:** Prompt 5 (sync health state derivation)
**Skills:** ux-ui, phase-context
**Load context:** `field-groups.md` lines 276–326 (Synced Table Tab Badges — platform badge, sync status indicator, 6 health states, click actions, badge + tab color independence)
**Target files:** `apps/web/src/components/sidebar/PlatformBadge.tsx` (new), `apps/web/src/components/sidebar/SyncStatusIcon.tsx` (new), `apps/web/src/components/sidebar/TableTabItem.tsx` (extend)
**Migration required:** No
**Git:** Commit with message `feat(ui): implement synced table tab badges with platform badge and sync status indicator [Phase 2C, Prompt 11]`

### Schema Snapshot

```
base_connections: id, tenant_id, platform ('airtable'|'notion'|'smartsuite'), sync_status, health (JSONB)
tables: id, tenant_id, base_connection_id (nullable — null for native tables)
```

### Task

Add platform badges and sync status indicators to synced table tabs in the sidebar.

**1. Build `apps/web/src/components/sidebar/PlatformBadge.tsx`:**

A 14×14px platform logo overlay rendered at the bottom-right of the table type icon in the sidebar:

```typescript
interface PlatformBadgeProps {
  platform: 'airtable' | 'notion' | 'smartsuite' | null;
}
```

- **Airtable:** Airtable logo mark (simplified for 14px rendering)
- **Notion:** Notion logo mark (black)
- **SmartSuite:** SmartSuite logo mark
- **`null` (native):** No badge rendered — absence of badge = native EveryStack table

Badge has a 1px `contentBg` (#FFFFFF) border to visually separate it from the parent icon. Positioned with a 2px offset (CSS `position: absolute; bottom: -2px; right: -2px`).

Platform logos should be SVG icons for crisp rendering at small sizes. Store in `apps/web/src/components/icons/platforms/`.

**2. Build `apps/web/src/components/sidebar/SyncStatusIcon.tsx`:**

A sync status indicator icon rendered to the right of the table name in the sidebar:

```typescript
interface SyncStatusIconProps {
  healthState: SyncHealthState;
  platform: string;
  lastSyncAt: Date | null;
  pendingConflictCount: number;
}
```

| Status | Icon | Color | Tooltip |
|--------|------|-------|---------|
| Healthy | ⇅ (bidirectional arrows) | `textSecondary` | "Synced with {Platform}. Last sync: {time}" |
| Syncing now | ⇅ (animated rotation) | `accent` (teal) | "Syncing with {Platform}…" |
| Conflicts pending | ⇅ + amber dot | `accent` (amber) | "{N} sync conflicts. Click to resolve." |
| Sync paused | ⇅ (paused bars) | `textSecondary` | "Sync paused. Click to resume." |
| Sync error | ⇅ + ✕ | `error` | "Sync failed: {reason}. Click for details." |
| Converted | — (none) | — | Badge removed after conversion finalized |

Use Lucide React icons for the base sync icon. The amber dot and error X are overlaid using CSS pseudo-elements or small SVG composites.

**Click actions:**
- Clicking the sync status icon opens the Sync Settings Dashboard for that table's connection (navigates to the route from Prompt 10)
- For "Conflicts pending": navigates to the Sync Settings Dashboard, Conflicts tab

**3. Extend `apps/web/src/components/sidebar/TableTabItem.tsx`:**

Update the existing sidebar table tab component to render the platform badge and sync status icon:
- If `table.base_connection_id` is not null → look up the `base_connection` → render `PlatformBadge` and `SyncStatusIcon`
- If `table.base_connection_id` is null → native table, no badge, no sync icon

**4. Badge and tab color independence:**

The platform badge and the table tab color stripe are independent visual channels. A synced Airtable table can have:
- An amber tab color (because it's a finance table, user-chosen) — 3px left-edge stripe
- The Airtable badge (because it's synced from Airtable) — 14px logo overlay

Two pieces of information, two visual treatments, no conflict. The implementation must not couple badge visibility to tab color or vice versa.

### Acceptance Criteria

- [ ] `PlatformBadge` renders correct platform logo at 14×14px with 1px white border
- [ ] Native tables (no `base_connection_id`) render no platform badge
- [ ] `SyncStatusIcon` renders all 6 health states with correct icon, color, and tooltip
- [ ] "Syncing now" state shows animated rotation on the sync icon
- [ ] Click on sync status icon navigates to the Sync Settings Dashboard
- [ ] Click on "Conflicts pending" navigates to Sync Settings → Conflicts tab
- [ ] Converted tables show no sync status icon (badge removed)
- [ ] Platform badge and tab color stripe are visually independent — both can appear simultaneously
- [ ] Platform logos are SVG, crisp at 14px
- [ ] Component renders correctly in the always-dark sidebar (icon colors work on dark background)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Field groups or column groups (Phase 3 — Core UX)
- Board collapse behavior (Phase 3 — Foundation)
- Per-field emphasis or conditional cell coloring (Phase 3 — Core UX)
- SmartSuite platform logo — include the component slot but SmartSuite adapter ships in Phase 3

---

## Final Integration Checkpoint (after Prompts 7–11)

**Task:** Verify all work from Prompts 7–11 integrates correctly and the full Phase 2C is complete.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met for all changed packages:
   - `packages/shared/sync/` ≥ 90% lines, 85% branches
   - `apps/web/src/data/` ≥ 95% lines, 90% branches
   - `apps/web/src/actions/` ≥ 90% lines, 85% branches
   - `apps/worker/src/jobs/` ≥ 85% lines, 80% branches
5. `pnpm turbo check:i18n` — no hardcoded English strings in new UI components
6. Manual verification: Sync Settings Dashboard renders all 6 tabs with correct counts
7. Manual verification: Synced table sidebar badges show platform logo and sync status for synced tables, no badges for native tables
8. Manual verification: Error recovery flows transition health states correctly (mock 401 → auth_required → re-auth → active)
9. Manual verification: NotionAdapter field type transforms produce correct canonical JSONB shapes for all ~20 Notion property types

**Git:** Commit with message `chore(verify): final integration checkpoint — Phase 2C complete [Phase 2C, CP-3]`, then push branch to origin. Open PR to main with title `Phase 2C — Notion Adapter, Error Recovery, Sync Dashboard`.

---

## Phase Complete

When the PR is merged:
- Tag the merge commit: `v0.2.2-phase-2c`
- Delete the feature branch

**What's next:** Phase 3 (MVP — Core UX). The full sync engine is now operational with two platform adapters (Airtable + Notion). Phase 3 builds the grid view, card view, record view, and all user-facing workspace features that consume synced data. The SmartSuite adapter ships as part of Phase 3 — Core UX.
