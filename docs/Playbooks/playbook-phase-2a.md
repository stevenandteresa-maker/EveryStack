# Phase 2A — FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter

## Phase Context

### What Has Been Built

**Phase 1 (MVP — Foundation) is complete and merged to main.** Key outputs relevant to Phase 2A:

- **1A:** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI. ESLint + Prettier.
- **1B:** Drizzle schema for all 52 MVP tables including `base_connections`, `tables`, `fields`, `records`, `synced_field_mappings`, `sync_conflicts`, `sync_failures`, `sync_schema_changes`. `getDbForTenant()` with read/write routing. RLS policies. UUIDv7 primary keys.
- **1C:** Clerk integration with webhook handler. Tenant middleware. Five workspace roles on `workspace_memberships`. Permission check utilities.
- **1D:** Pino structured logging with `AsyncLocalStorage` traceId. Sentry integration. OpenTelemetry.
- **1E:** Vitest workspace config. Playwright E2E setup. Test data factories for all core tables (`createTestTenant()`, `createTestRecord()`, etc.). `testTenantIsolation()` helper. MSW mock setup.
- **1F:** shadcn/ui primitives. Tailwind config with three-layer color architecture. Application shell layout with sidebar.
- **1G:** Socket.io server with Clerk JWT auth and Redis adapter. BullMQ worker skeleton with queue definitions. StorageClient + R2.
- **1I:** `writeAuditLog()` helper. `api_keys` table with SHA-256 hashing. API auth middleware. Token-bucket rate limiting.
- **1J:** CP-001/CP-002 schema migrations. Auth middleware updated to `effective_memberships`. Sidebar navigation tree with tenant switching.

### What This Phase Delivers

When Phase 2A is complete, EveryStack can:

1. Connect to an Airtable base via OAuth and sync data into the canonical JSONB format.
2. Transform all ~40 MVP field types between Airtable's format and EveryStack's canonical format via the FieldTypeRegistry — losslessly where possible, with clear lossy marking where not.
3. Present a 3-step sync setup wizard (authenticate → select base → select tables with filters) that respects record quotas and translates filters into Airtable's `filterByFormula` for server-side pushdown.
4. Perform progressive initial sync: schema first (column headers visible in <2s), first page of records (interactive in <4s), then background sync of remainder via BullMQ with a progress indicator.
5. Proactively manage Airtable API rate limits via a Redis token-bucket rate limiter.
6. Detect sync-orphaned records when filters change and present clear UX choices (delete / keep as local-only / undo filter change).
7. Handle cross-links to records excluded by sync filters with a `filtered_out` flag and appropriate display.

### What This Phase Does NOT Build

- **JSONB expression indexes** for grid query performance (2B)
- **Outbound sync pipeline** — the `fromCanonical()` transforms exist but the BullMQ pipeline pushing edits to Airtable ships in 2B
- **Conflict detection or resolution** — three-way merge, `sync_conflicts` population, conflict resolution UI (2B)
- **Notion adapter** (2C)
- **SmartSuite adapter** (Phase 3 — Core UX)
- **Priority-based scheduling** P0–P3 or multi-tenant fairness (2C)
- **Sync settings dashboard** — the 6-tab management panel (2C)
- **Error recovery flows** — auth expired, partial failure, platform unavailable, schema mismatch, quota exceeded recovery UX (2C)
- **Schema sync change detection** — `sync_schema_changes` population and review UI (2C)
- **Grid cell rendering** — cell renderers for each field type (Phase 3)
- **Kanban, Calendar, or any post-MVP view types**
- **Formula engine or computed fields**
- **App Designer or App Portals**

### Architecture Patterns for This Phase

1. **Adapter → Canonical JSONB → Adapter.** All platform data is transformed into canonical JSONB keyed by `fields.id`. The adapter is a pair of pure functions (`toCanonical`/`fromCanonical`). Features never see platform-native formats.

2. **FieldTypeRegistry, not switch statements.** Every field type transform is registered per-platform, per-field-type. To transform a value, look it up in the registry. Never write `switch (fieldType)`.

3. **Source references for lossless round-tripping.** The canonical form preserves platform-specific identifiers in a `source_refs` map so that `fromCanonical()` can reconstruct the exact platform representation.

4. **Proactive rate limiting.** The sync scheduler knows each platform's rate limits before dispatching jobs. 429 responses should be rare exceptions, not the primary throttling mechanism.

5. **Progressive sync.** Users never wait for the full sync to complete before interacting. Schema loads first, then the first page, then the background remainder. BullMQ handles the pipeline.

6. **CockroachDB safeguards remain active:** UUIDv7 for all PKs, no PG-specific syntax in application queries, explicit transaction boundaries via `getDbForTenant()`, no advisory locks (use Redis-based locks), hash partitioning compatible schemas.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | FieldTransform interface, FieldTypeRegistry singleton, canonical value type system | None | ~250 |
| 2 | Airtable adapter scaffold with text & number category transforms (9 types) | 1 | ~300 |
| 3 | Airtable adapter — selection & date category transforms (10 types) | 2 | ~300 |
| 4 | Airtable adapter — people, contact & boolean category transforms (13 types) | 3 | ~350 |
| CP-1 | Integration Checkpoint 1 | 1–4 | — |
| 5 | Airtable adapter — files, relational, smart doc & lossy field handling (5 types + lossy markers) | 4 | ~250 |
| 6 | Platform rate limit registry & Redis token-bucket rate limiter | None | ~200 |
| 7 | FilterRule grammar, Airtable filter pushdown & SyncConfig types | 1 | ~250 |
| 8 | Record quota enforcement with Redis quota cache | None | ~200 |
| CP-2 | Integration Checkpoint 2 | 5–8 | — |
| 9 | Airtable OAuth flow & base connection token storage | None | ~250 |
| 10 | Sync setup wizard UI (3-step) with two-phase filter bootstrapping | 7, 8, 9 | ~350 |
| 11 | Progressive initial sync BullMQ pipeline with synced_field_mappings population | CP-1, 6, 10 | ~300 |
| CP-3 | Integration Checkpoint 3 | 9–11 | — |
| 12 | Sync orphan detection, orphan UX & cross-links to filtered-out records | 11 | ~300 |
| 13 | Post-setup sync filter modification with save-and-re-sync flow | 10, 12 | ~200 |
| CP-4 | Final Integration Checkpoint + PR | 12–13 | — |

---

## Prompt 1: FieldTransform Interface, FieldTypeRegistry Singleton & Canonical Value Type System

**Depends on:** None (Phase 1 complete)
**Load context:** `sync-engine.md` lines 30–86 (Core Pattern, Source References, Field Type Registry), `data-model.md` lines 270–314 (Field Definition Structure, canonical_data shape), `data-model.md` lines 348–471 (Field Type Taxonomy — all 8 categories + deferred types)
**Target files:** `packages/shared/sync/types.ts`, `packages/shared/sync/field-registry.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-2a-fieldtyperegistry-airtable` from `main`. After completing, commit with message `feat(sync): FieldTransform interface, FieldTypeRegistry singleton and canonical value types [Phase 2A, Prompt 1]`

### Schema Snapshot

```
records: tenant_id (PK), id (PK, UUIDv7), table_id, canonical_data (JSONB — keyed by fields.id), sync_metadata (JSONB), search_vector (tsvector), deleted_at, created_by, updated_by, created_at, updated_at

fields: id (UUIDv7 PK), table_id, tenant_id, name, field_type (VARCHAR), field_sub_type (nullable), is_primary, is_system, required, unique, read_only, config (JSONB), display (JSONB), permissions (JSONB), default_value (JSONB nullable), description (TEXT nullable), sort_order (INTEGER), external_field_id (nullable), environment, created_at, updated_at
```

### Task

Build the foundational type system and registry for the sync engine's canonical transform layer.

**1. Canonical Value Types (`packages/shared/sync/types.ts`):**

Define TypeScript types for every MVP field type's canonical JSONB shape. Each field type stores its value in `records.canonical_data` keyed by the field's UUID. The types must cover all 8 MVP categories from `data-model.md`:

- **Category 1 — Text:** `text` (string), `text_area` (string), `smart_doc` (TipTap JSON or ref)
- **Category 2 — Number:** `number`, `currency`, `percent`, `rating`, `duration`, `progress`, `auto_number` (all numeric)
- **Category 3 — Selection:** `single_select` (option ID string with source_refs), `multiple_select` (option ID array), `status` (option ID with category), `tag` (tag value array)
- **Category 4 — Date:** `date` (ISO 8601), `date_range` ({start, end}), `due_date` (ISO 8601), `time` (HH:MM string), `created_at` (ISO 8601), `updated_at` (ISO 8601)
- **Category 5 — People & Contact:** `people` (user ID array), `created_by`/`updated_by` (user ID), `email` (string), `phone` (object or array), `url` (string), `address` (structured JSONB), `full_name` (structured JSONB), `social` (platform→url map)
- **Category 6 — Boolean & Interactive:** `checkbox` (boolean), `button` (null — no stored value), `checklist` (array of items), `signature` (structured JSONB)
- **Category 7 — Relational:** `linked_record` (record ID array with optional `filtered_out` flag for cross-links to filtered-out records)
- **Category 8 — Files:** `files` (array of file objects)
- **Category 9 — Identification:** `barcode` (string)

Define a `CanonicalValue` discriminated union type covering all field types. Each variant should include a `type` field matching the field type key.

Also define:

```typescript
interface RecordSyncMetadata {
  platform_record_id: string;
  last_synced_at: string;
  last_synced_value: Record<string, unknown>;
  sync_status: 'active' | 'orphaned';
  orphaned_at: string | null;
  orphaned_reason: 'filter_changed' | null;
}
```

And the source_refs pattern type:

```typescript
interface SourceRefs {
  airtable?: string | Record<string, unknown>;
  notion?: string | Record<string, unknown>;
  smartsuite?: string | Record<string, unknown>;
}
```

**2. FieldTransform Interface & FieldTypeRegistry (`packages/shared/sync/field-registry.ts`):**

Define the `FieldTransform` interface exactly as specified in `sync-engine.md`:

```typescript
interface FieldTransform {
  toCanonical: (value: unknown, fieldConfig: PlatformFieldConfig) => CanonicalValue;
  fromCanonical: (value: CanonicalValue, fieldConfig: PlatformFieldConfig) => unknown;
  isLossless: boolean;
  supportedOperations: ('read' | 'write' | 'filter' | 'sort')[];
}
```

Define `PlatformFieldConfig` as a type that carries platform-specific field metadata (field name, field type, options, etc.) — generic enough for all three platforms.

Build `FieldTypeRegistry` as a singleton class with methods:
- `register(platform: string, fieldType: string, transform: FieldTransform): void`
- `get(platform: string, fieldType: string): FieldTransform | undefined`
- `has(platform: string, fieldType: string): boolean`
- `getAllForPlatform(platform: string): Map<string, FieldTransform>`
- `getSupportedFieldTypes(platform: string): string[]`

The registry must throw a descriptive error if code attempts to look up an unregistered platform/field-type combination. The error message should include the platform and field type that was requested.

Export the singleton instance as `fieldTypeRegistry`.

### Acceptance Criteria

- [ ] `CanonicalValue` union type covers all ~40 MVP field types from data-model.md with correct storage shapes
- [ ] `FieldTypeRegistry.register()` stores transforms and `get()` retrieves them by platform + field type
- [ ] `FieldTypeRegistry.get()` for an unregistered type throws a descriptive error (not returns undefined silently)
- [ ] `RecordSyncMetadata` type matches the shape from sync-engine.md (sync_status, orphaned_at, orphaned_reason)
- [ ] Unit tests verify registry register/get/has/getAllForPlatform with mock transforms
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual per-field-type transforms for any platform (those are Prompts 2–5)
- Cell renderers, cell editors, or any UI rendering logic (Phase 3)
- Filter operators per field type (Prompt 7)
- AI data contract types (`canonicalToAIContext`) — Phase 5

---

## Prompt 2: Airtable Adapter Scaffold with Text & Number Category Transforms

**Depends on:** Prompt 1
**Load context:** `sync-engine.md` lines 30–66 (Core Pattern, Source References), `data-model.md` lines 352–370 (Text & Number field type taxonomy)
**Target files:** `packages/shared/sync/adapters/types.ts`, `packages/shared/sync/adapters/airtable/index.ts`, `packages/shared/sync/adapters/airtable/transforms.ts` (or `text-transforms.ts` + `number-transforms.ts`)
**Migration required:** No
**Git:** Commit with message `feat(sync): Airtable adapter scaffold with text and number field type transforms [Phase 2A, Prompt 2]`

### Schema Snapshot

N/A — no schema changes. Uses existing `fields` and `records` tables.

### Task

Build the Airtable adapter class and implement `toCanonical()`/`fromCanonical()` transforms for text and number category field types.

**1. PlatformAdapter Interface (`packages/shared/sync/adapters/types.ts`):**

Define the base `PlatformAdapter` interface that all platform adapters implement:

```typescript
interface PlatformAdapter {
  platform: 'airtable' | 'notion' | 'smartsuite';
  toCanonical(record: unknown, fieldMappings: FieldMapping[]): Record<string, CanonicalValue>;
  fromCanonical(canonicalData: Record<string, CanonicalValue>, fieldMappings: FieldMapping[]): unknown;
}

interface FieldMapping {
  fieldId: string;        // EveryStack field UUID
  externalFieldId: string;  // Platform field ID
  fieldType: string;      // EveryStack field type key
  externalFieldType: string; // Platform-native field type
  config: Record<string, unknown>; // Field config from fields.config JSONB
}
```

**2. AirtableAdapter Class (`packages/shared/sync/adapters/airtable/index.ts`):**

Scaffold the `AirtableAdapter` implementing `PlatformAdapter`. The `toCanonical()` method iterates over field mappings, retrieves the appropriate `FieldTransform` from the `FieldTypeRegistry`, and calls `transform.toCanonical()` for each field. Same pattern for `fromCanonical()`. If a field type has no registered transform, log a warning and skip the field (don't crash the entire record).

**3. Text Category Transforms (3 types):**

Register transforms for `text`, `text_area`, `smart_doc`:

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `text` | Single line text | String passthrough | String passthrough | Yes |
| `text_area` | Long text | String passthrough (strip Airtable markdown if raw requested) | String passthrough | Yes |
| `smart_doc` | Rich text | Convert Airtable Markdown to TipTap JSON structure | Convert TipTap JSON to Airtable Markdown | No (formatting differences) |

**4. Number Category Transforms (7 types):**

Register transforms for `number`, `currency`, `percent`, `rating`, `duration`, `progress`, `auto_number`:

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `number` | Number | Number passthrough | Number passthrough | Yes |
| `currency` | Currency | Number value (Airtable stores as number with currency format in field config) | Number value | Yes |
| `percent` | Percent | Airtable stores as decimal (0.75) → store as decimal in canonical | Decimal passthrough | Yes |
| `rating` | Rating | Integer passthrough | Integer passthrough | Yes |
| `duration` | Duration | Airtable stores in seconds → convert to minutes for canonical | Minutes → seconds | Yes |
| `progress` | Percent (mapped) | Number 0–100 passthrough | Passthrough | Yes |
| `auto_number` | Auto number | Integer passthrough (read-only) | N/A (read-only) | Yes |

Each transform function must handle `null`/`undefined` input gracefully (return `null` canonical value — field has no data).

Register all transforms with `fieldTypeRegistry.register('airtable', fieldType, transform)`.

### Acceptance Criteria

- [ ] `AirtableAdapter.toCanonical()` transforms a mock Airtable record with text and number fields into correct canonical JSONB shape
- [ ] `AirtableAdapter.fromCanonical()` reverses canonical values back to Airtable format for text and number fields
- [ ] `smart_doc` transform converts Airtable Markdown to a TipTap-compatible JSON structure
- [ ] `duration` transform correctly converts Airtable seconds to canonical minutes and back
- [ ] Null/undefined input values produce null canonical values without throwing
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Selection, date, people, or any other field category transforms (Prompts 3–5)
- Airtable API client or HTTP calls (Prompt 9)
- Grid cell renderers for text or number fields (Phase 3)
- AI data contract formatting (`toTemplateValue`, `toExportValue`) (Phase 5)

---

## Prompt 3: Airtable Adapter — Selection & Date Category Transforms

**Depends on:** Prompt 2
**Load context:** `sync-engine.md` lines 47–66 (Source References — critical for selection types), `data-model.md` lines 372–402 (Selection & Date field type taxonomy)
**Target files:** `packages/shared/sync/adapters/airtable/transforms.ts` (extend existing)
**Migration required:** No
**Git:** Commit with message `feat(sync): Airtable selection and date field type transforms with source_refs [Phase 2A, Prompt 3]`

### Schema Snapshot

N/A — no schema changes.

### Task

Implement `toCanonical()`/`fromCanonical()` transforms for selection and date category field types and register them with the `FieldTypeRegistry`.

**1. Selection Category Transforms (4 types):**

These are the most complex transforms because they require `source_refs` for lossless round-tripping. Airtable identifies select options by label string, while EveryStack uses internal option IDs.

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `single_select` | Single select | Map Airtable label → ES option ID, store label in `source_refs.airtable` | Look up `source_refs.airtable` to get original label | Yes (with source_refs) |
| `multiple_select` | Multiple select | Map each label → option ID array, store labels in source_refs | Reverse map using source_refs | Yes (with source_refs) |
| `status` | Single select (mapped) | Same as single_select + map to status category if config provides categories | Reverse map | Yes (with source_refs) |
| `tag` | Multiple select (mapped) | Store tag values as string array | Passthrough | Yes |

**Source refs pattern for selections:**

```typescript
// Canonical form for single_select
{
  type: "single_select",
  value: {
    id: "es_opt_abc123",          // EveryStack option ID
    label: "In Progress",
    source_refs: {
      airtable: "In Progress"     // Airtable identifies by label
    }
  }
}
```

When `toCanonical()` encounters a select value, it must:
1. Look up the label in the field's config options to find the matching ES option ID
2. If no matching option exists (new value added on Airtable), create a placeholder with a generated ID and flag for schema sync review
3. Preserve the Airtable label string in `source_refs.airtable`

When `fromCanonical()` reverses, it reads `source_refs.airtable` to recover the original label.

**2. Date Category Transforms (6 types):**

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `date` | Date / DateTime | Parse Airtable ISO string, normalize timezone per field config | Format back to ISO string | Yes |
| `date_range` | Two date fields (mapped) | Combine start/end into `{start, end}` object | Split back | Yes |
| `due_date` | Date (mapped) | ISO string passthrough with due date semantics | ISO string | Yes |
| `time` | Time field | Extract HH:MM from Airtable's datetime | Format time string | Yes |
| `created_at` | Created time (system) | ISO string passthrough (read-only) | N/A (read-only) | Yes |
| `updated_at` | Last modified time (system) | ISO string passthrough (read-only) | N/A (read-only) | Yes |

Date transforms must handle Airtable's timezone behavior: Airtable stores dates as UTC or with a configured timezone. The transform normalizes to the workspace timezone per the field's config.

### Acceptance Criteria

- [ ] `single_select` transform preserves Airtable label in `source_refs.airtable` and maps to ES option ID
- [ ] `fromCanonical()` for selection types reconstructs the Airtable label from `source_refs.airtable`
- [ ] Unrecognized select values (new option on Airtable) are handled gracefully with a generated option ID
- [ ] Date transforms correctly handle both date-only and datetime Airtable values
- [ ] System fields (`created_at`, `updated_at`) are marked as read-only (`supportedOperations: ['read']`)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Status field transition governance (Phase 4 — Automations)
- Airtable webhook listener for real-time change detection (2C)
- Date range picker UI or date formatting UI (Phase 3)
- Kanban view columns from status categories (post-MVP)

---

## Prompt 4: Airtable Adapter — People, Contact & Boolean Category Transforms

**Depends on:** Prompt 3
**Load context:** `data-model.md` lines 404–436 (People & Contact, Boolean & Interactive field type taxonomy)
**Target files:** `packages/shared/sync/adapters/airtable/transforms.ts` (extend existing)
**Migration required:** No
**Git:** Commit with message `feat(sync): Airtable people, contact and boolean field type transforms [Phase 2A, Prompt 4]`

### Schema Snapshot

N/A — no schema changes.

### Task

Implement `toCanonical()`/`fromCanonical()` transforms for people & contact and boolean & interactive category field types.

**1. People & Contact Category Transforms (9 types):**

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `people` | Collaborator | Map Airtable collaborator objects `{id, email, name}` → user ID array. Store Airtable collaborator ID in `source_refs.airtable` | Look up `source_refs.airtable` to reconstruct collaborator reference | Partial (Airtable collaborator ↔ ES user mapping required) |
| `created_by` | Created by (system) | Map collaborator → user ID (read-only) | N/A | Yes |
| `updated_by` | Last modified by (system) | Map collaborator → user ID (read-only) | N/A | Yes |
| `email` | Email | String passthrough | String passthrough | Yes |
| `phone` | Phone number | String → structured `{number, type}` object | Extract number string | Yes |
| `url` | URL | String passthrough | String passthrough | Yes |
| `address` | Single line text (mapped) | Parse address string into structured JSONB `{street, city, state, postal_code, country}` where possible | Concatenate structured parts back to string | No (parsing is heuristic) |
| `full_name` | Single line text (mapped) | Parse name string into `{first, last}` where possible | Concatenate parts | No (parsing is heuristic) |
| `social` | URL (mapped) | Detect platform from URL domain, store as `{platform: url}` | Extract URL | Yes |

**Collaborator mapping note:** Airtable collaborators are identified by Airtable-internal IDs, not email. The transform stores the Airtable collaborator object in `source_refs.airtable`. Mapping to EveryStack user IDs happens at a higher level (sync job), not in the pure transform function. The transform preserves the raw collaborator data for later resolution.

**2. Boolean & Interactive Category Transforms (4 types):**

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `checkbox` | Checkbox | Boolean passthrough (`true`/`false`, Airtable returns `undefined` for unchecked → map to `false`) | Boolean passthrough | Yes |
| `button` | Button | N/A (button has no stored value, `null` in canonical) | N/A | N/A |
| `checklist` | N/A (no Airtable equivalent) | N/A — EveryStack-only field type, no Airtable mapping | N/A | N/A |
| `signature` | N/A (no Airtable equivalent) | N/A — EveryStack-only field type, no Airtable mapping | N/A | N/A |

For field types with no Airtable equivalent (`checklist`, `signature`), do NOT register a transform. The FieldTypeRegistry will not have an entry for `('airtable', 'checklist')` — this is correct behavior. These types only exist on native EveryStack tables.

### Acceptance Criteria

- [ ] `people` transform preserves Airtable collaborator data in `source_refs.airtable` for later user mapping
- [ ] `checkbox` transform maps Airtable's `undefined` (unchecked) to `false` in canonical form
- [ ] `phone` transform converts Airtable's string phone number to the structured `{number, type}` canonical shape
- [ ] EveryStack-only types (`checklist`, `signature`) are NOT registered for the Airtable platform
- [ ] All transforms handle null/undefined input gracefully
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- User mapping logic (Airtable collaborator ID → EveryStack user ID) — that is a sync job concern, not a pure transform
- Google Places autocomplete for address fields (Phase 3 UI)
- Phone number action buttons (call, SMS, WhatsApp) — Phase 3 UI
- People assignment notifications — Phase 3 communications

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all work from Prompts 1–4 integrates correctly. The FieldTypeRegistry should have transforms registered for 26+ Airtable field types across text, number, selection, date, people/contact, and boolean categories.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test --filter=@everystack/sync` — all pass
4. `pnpm turbo test -- --coverage --filter=@everystack/sync` — coverage ≥80% on new files in `packages/shared/sync/`
5. Manual verification: Import `fieldTypeRegistry` and confirm `fieldTypeRegistry.getSupportedFieldTypes('airtable')` returns all registered type keys

**Git:** Commit with message `chore(verify): integration checkpoint 1 — FieldTypeRegistry and Airtable core transforms [Phase 2A, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Airtable Adapter — Files, Relational, Smart Doc & Lossy Field Handling

**Depends on:** Prompt 4
**Load context:** `sync-engine.md` lines 354–379 (Cross-Links to Filtered-Out Records), `data-model.md` lines 437–464 (Relational, Files, Identification taxonomy)
**Target files:** `packages/shared/sync/adapters/airtable/transforms.ts` (extend existing)
**Migration required:** No
**Git:** Commit with message `feat(sync): Airtable files, relational and barcode transforms with lossy field handling [Phase 2A, Prompt 5]`

### Schema Snapshot

N/A — no schema changes.

### Task

Complete the Airtable adapter transform coverage with files, relational, identification types, and explicit lossy field handling.

**1. Files Category Transform (1 type):**

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `files` | Attachment | Map Airtable attachment array `[{id, url, filename, size, type, thumbnails}]` → canonical `[{url, filename, file_type, size, thumbnail_url}]`. Store Airtable attachment ID in source_refs per file | Reconstruct Airtable attachment format from canonical | Partial (thumbnail URLs may differ) |

**2. Relational Category Transform (1 type):**

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `linked_record` | Linked record | Map Airtable record IDs array → canonical `[{record_id, display, filtered_out?}]`. For each linked ID: look up local record by `sync_metadata.platform_record_id`. If found → set `record_id` to ES ID. If not found → set `record_id: null`, `platform_record_id` to the Airtable ID, `filtered_out: true` | Extract ES record IDs, resolve back to Airtable record IDs via source_refs | Yes |

**Cross-links to filtered-out records:** When a linked record references a platform record that was excluded by the sync filter and never synced into EveryStack, the canonical value stores:

```jsonb
{
  "record_id": null,
  "platform_record_id": "rec_xyz",
  "display": "Archived Project",
  "filtered_out": true
}
```

The `display` value is fetched from the platform API once during sync and cached. It does not update on subsequent syncs. If the filter later expands to include the record, the sync pipeline replaces the `filtered_out` entry with a proper `record_id`.

**3. Identification Category Transform (1 type):**

| ES Type | Airtable Type | toCanonical | fromCanonical | Lossless |
|---------|--------------|-------------|---------------|----------|
| `barcode` | Barcode | Extract `{text}` from Airtable barcode object → string | Wrap string in `{text}` object | Yes |

**4. Lossy Field Handling:**

Register read-only stub transforms for field types that Airtable computes server-side and cannot be written back:

| ES Type | Airtable Type | Behavior |
|---------|--------------|----------|
| `lookup` | Lookup | `isLossless: false`, `supportedOperations: ['read']`. `toCanonical()` stores the computed value as-is. `fromCanonical()` is a no-op (never synced outbound). |
| `rollup` | Rollup | Same as lookup |
| `formula` | Formula | Same as lookup |
| `count` | Count | Same as lookup |

These are post-MVP field types in EveryStack but they exist in Airtable tables. The adapter must handle them gracefully: sync the computed values inbound (read-only) but never attempt to write them back. The UI should show a lock icon on these fields (Phase 3 responsibility — this prompt just sets `isLossless: false` and `supportedOperations: ['read']`).

### Acceptance Criteria

- [ ] `files` transform maps Airtable attachments to canonical file array shape with URLs, filenames, and thumbnails
- [ ] `linked_record` transform sets `filtered_out: true` for referenced records not found in local database
- [ ] Lossy fields (lookup, rollup, formula, count) are registered with `isLossless: false` and `supportedOperations: ['read']`
- [ ] `fromCanonical()` for lossy fields is a no-op that does not attempt to construct an outbound value
- [ ] `barcode` transform correctly unwraps/wraps Airtable's `{text}` object format
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- File upload or presigned URL generation for synced attachments (files are URL references, not re-uploaded)
- Cross-link resolution logic beyond the `filtered_out` flag (cross-link engine is Phase 3B)
- Formula engine or computed field evaluation (post-MVP)
- Barcode scanning UI or camera integration (post-MVP mobile)

---

## Prompt 6: Platform Rate Limit Registry & Redis Token-Bucket Rate Limiter

**Depends on:** None (independent infrastructure)
**Load context:** `sync-engine.md` lines 480–507 (External API Rate Limit Management — Platform Rate Limit Registry, Token Bucket Rate Limiter)
**Target files:** `packages/shared/sync/rate-limiter.ts`, `packages/shared/sync/adapters/types.ts` (add `PlatformRateLimits` to existing)
**Migration required:** No
**Git:** Commit with message `feat(sync): platform rate limit registry and Redis token-bucket rate limiter [Phase 2A, Prompt 6]`

### Schema Snapshot

N/A — no schema changes. Uses Redis only.

### Task

Build the proactive rate limiting infrastructure that the sync scheduler uses before dispatching API calls.

**1. PlatformRateLimits Configuration Interface:**

Add to `packages/shared/sync/adapters/types.ts`:

```typescript
interface PlatformRateLimits {
  platform: 'airtable' | 'notion' | 'smartsuite';
  limits: RateLimit[];
  retryStrategy: RetryStrategy;
}

interface RateLimit {
  scope: string;        // e.g., 'per_base', 'per_api_key', 'per_integration'
  maxRequests: number;  // e.g., 5
  windowSeconds: number; // e.g., 1
}

interface RetryStrategy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}
```

Register Airtable's rate limits as configuration:

| Scope | Limit |
|-------|-------|
| Per base | 5 req/s |
| Per API key | 50 req/s |

These are configuration values, not hardcoded — stored so they can be updated when platforms change limits.

**2. Redis Token-Bucket Rate Limiter (`packages/shared/sync/rate-limiter.ts`):**

Implement a sliding-window token bucket using Redis `ZSET` scored by timestamp with an atomic Lua script. Key format: `ratelimit:{platform}:{scope_key}` (e.g., `ratelimit:airtable:base:app123abc`).

The Lua script must atomically:
1. Remove expired entries from the ZSET (score < current_time - window_seconds)
2. Count remaining entries
3. If count < maxRequests: add new entry, return `{ allowed: true, remaining: maxRequests - count - 1 }`
4. If count >= maxRequests: return `{ allowed: false, retryAfterMs: time_until_oldest_entry_expires }`

Expose a clean TypeScript API:

```typescript
class RateLimiter {
  async checkLimit(platform: string, scopeKey: string): Promise<RateLimitResult>;
  async waitForCapacity(platform: string, scopeKey: string, timeoutMs?: number): Promise<void>;
  registerPlatformLimits(config: PlatformRateLimits): void;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number | null;
}
```

`waitForCapacity()` polls `checkLimit()` with exponential backoff until capacity is available or timeout exceeded.

Export a singleton `rateLimiter` instance.

### Acceptance Criteria

- [ ] `rateLimiter.checkLimit('airtable', 'base:app123')` returns `{ allowed: true }` when under the 5 req/s limit
- [ ] After 5 rapid calls, the 6th returns `{ allowed: false, retryAfterMs: <positive number> }`
- [ ] Lua script atomically cleans expired entries and checks/adds in a single Redis round-trip
- [ ] `waitForCapacity()` blocks until capacity opens and resolves (tested with short window)
- [ ] Airtable rate limits (5/s per base, 50/s per API key) are registered as configuration
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Priority-based scheduling (P0–P3) — that ships in 2C
- Multi-tenant fairness round-robin — that ships in 2C
- Rate limit dashboard or metrics UI (2C sync settings dashboard)
- Notion or SmartSuite rate limit registration (2C and Phase 3 respectively)

---

## Prompt 7: FilterRule Grammar, Airtable Filter Pushdown & SyncConfig Types

**Depends on:** Prompt 1 (uses field type keys from canonical types)
**Load context:** `sync-engine.md` lines 133–245 (Table Selection Model, Sync Filters, Platform Filter Pushdown)
**Target files:** `packages/shared/sync/types.ts` (add FilterRule, SyncConfig), `packages/shared/sync/adapters/airtable/filter-pushdown.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): FilterRule grammar, SyncConfig types and Airtable filter pushdown [Phase 2A, Prompt 7]`

### Schema Snapshot

```
base_connections: ..., sync_config (JSONB — see SyncConfig shape below), ...
```

### Task

Define the shared filter grammar used by sync filters, grid view filters, portal data scopes, and build the Airtable-specific filter pushdown translator.

**1. FilterRule Types (add to `packages/shared/sync/types.ts`):**

```typescript
interface FilterRule {
  fieldId: string;
  operator: FilterOperator;
  value: unknown;
  conjunction: 'and' | 'or';
}

type FilterOperator =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'greater_than' | 'less_than'
  | 'greater_equal' | 'less_equal'
  | 'is_empty' | 'is_not_empty'
  | 'is_any_of' | 'is_none_of'
  | 'is_before' | 'is_after' | 'is_within';
```

**2. SyncConfig and SyncTableConfig Types:**

```typescript
interface SyncConfig {
  polling_interval_seconds: number;  // Default: 300 (5 min)
  tables: SyncTableConfig[];
}

interface SyncTableConfig {
  external_table_id: string;
  external_table_name: string;
  enabled: boolean;
  sync_filter: FilterRule[] | null;
  estimated_record_count: number;
  synced_record_count: number;
}
```

Add Zod schemas for both types for validation.

**3. Airtable Filter Pushdown (`packages/shared/sync/adapters/airtable/filter-pushdown.ts`):**

Implement `translateFilterToFormula(filters: FilterRule[], fieldMap: Map<string, string>): string` that converts `FilterRule[]` into Airtable's `filterByFormula` string.

Operator mapping:

| FilterOperator | Airtable Formula |
|----------------|-----------------|
| `equals` | `{FieldName} = "value"` |
| `not_equals` | `{FieldName} != "value"` |
| `contains` | `FIND("value", {FieldName}) > 0` |
| `not_contains` | `FIND("value", {FieldName}) = 0` |
| `greater_than` | `{FieldName} > value` |
| `less_than` | `{FieldName} < value` |
| `is_empty` | `{FieldName} = BLANK()` |
| `is_not_empty` | `{FieldName} != BLANK()` |
| `is_any_of` | `OR({FieldName} = "v1", {FieldName} = "v2", ...)` |
| `is_none_of` | `AND({FieldName} != "v1", {FieldName} != "v2", ...)` |
| `is_before` | `IS_BEFORE({FieldName}, "date")` |
| `is_after` | `IS_AFTER({FieldName}, "date")` |

The `fieldMap` parameter maps EveryStack field IDs to Airtable field names (needed because `filterByFormula` uses field names, not IDs).

Handle conjunction: combine with `AND(...)` or `OR(...)` wrapper.

For any operator that cannot be translated (none expected for Airtable, but defensively), return `null` from the per-operator translator and log a warning. The caller applies those rules as post-fetch local filtering.

Also implement `applyLocalFilters(records: unknown[], filters: FilterRule[], fieldMap: Map<string, string>): unknown[]` for fallback post-filtering when pushdown is partial.

### Acceptance Criteria

- [ ] `translateFilterToFormula()` correctly generates Airtable `filterByFormula` strings for all 14 operators
- [ ] Conjunction handling wraps rules with `AND(...)` or `OR(...)` as appropriate
- [ ] `SyncConfig` and `SyncTableConfig` Zod schemas validate correct shapes and reject invalid input
- [ ] `applyLocalFilters()` filters records locally for operators that can't be pushed down
- [ ] FilterRule type is exported and reusable by grid view filters (Phase 3)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Grid view filter UI component (Phase 3)
- Notion or SmartSuite filter pushdown (2C, Phase 3)
- View-level filter persistence (Phase 3)
- Portal `data_scope` filter application (Phase 3E)

---

## Prompt 8: Record Quota Enforcement with Redis Quota Cache

**Depends on:** None (standalone utility)
**Load context:** `sync-engine.md` lines 257–306 (Record Quota Enforcement)
**Target files:** `packages/shared/sync/quota.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): record quota enforcement with Redis quota cache [Phase 2A, Prompt 8]`

### Schema Snapshot

```
records: tenant_id, id, table_id, ..., deleted_at, ...
```

Quota = all records across all tables in all bases in the tenant (synced + native). Soft-deleted records don't count. Sync-orphaned records DO count.

### Task

Build the record quota enforcement utility with three enforcement points and a Redis quota cache.

**1. Plan Quota Configuration:**

```typescript
const PLAN_QUOTAS: Record<string, number> = {
  freelancer: 10_000,
  starter: 50_000,
  professional: 250_000,
  business: 1_000_000,
  enterprise: Infinity,
};
```

**2. Quota Check Function:**

```typescript
async function checkRecordQuota(tenantId: string): Promise<QuotaResult>;

interface QuotaResult {
  currentCount: number;
  planQuota: number;
  remaining: number;
  exceeded: boolean;
}
```

This function:
1. Checks Redis cache first (`quota:records:{tenantId}`, TTL 60s)
2. On cache miss: runs `SELECT COUNT(*) FROM records WHERE tenant_id = $1 AND deleted_at IS NULL` via `getDbForTenant()`
3. Caches the result in Redis
4. Returns the quota comparison

**3. Enforcement Point 1 — Sync Setup Wizard (Preventive):**

```typescript
async function canSyncRecords(tenantId: string, estimatedCount: number): Promise<{
  allowed: boolean;
  remaining: number;
  overageCount: number;
}>;
```

Called before confirming sync in the setup wizard. If `estimatedCount > remaining`, returns `allowed: false` with the overage count.

**4. Enforcement Point 2 — Runtime Batch Check:**

```typescript
async function enforceQuotaOnBatch(
  tenantId: string,
  batchSize: number
): Promise<{ acceptedCount: number; quotaExceeded: boolean }>;
```

Called before inserting each batch of inbound records. If batch would exceed quota, returns the number of records that can fit. The caller inserts only that many and pauses sync.

**5. Enforcement Point 3 — Single Record Creation:**

```typescript
async function canCreateRecord(tenantId: string): Promise<boolean>;
```

Called before local record creation (user creates record, portal form submission). Returns false if quota is at limit.

**6. Quota Cache Maintenance:**

- `incrementQuotaCache(tenantId: string, delta: number)` — called after record insert
- `decrementQuotaCache(tenantId: string, delta: number)` — called after record delete
- `invalidateQuotaCache(tenantId: string)` — force recount on next check

Use `getDbForTenant()` for all database queries. Write a `testTenantIsolation()` test for the quota count query.

### Acceptance Criteria

- [ ] `checkRecordQuota()` returns correct counts with Redis cache hit (no DB query on cache hit)
- [ ] `canSyncRecords()` blocks sync setup when estimated count exceeds remaining quota
- [ ] `enforceQuotaOnBatch()` returns partial acceptance when batch would exceed quota
- [ ] `canCreateRecord()` returns false when tenant is at quota limit
- [ ] `testTenantIsolation()` passes — quota counts are tenant-scoped (Tenant A's records don't affect Tenant B's quota)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Quota exceeded recovery UX (2C error recovery flows)
- Plan upgrade flow or billing integration
- Quota warning notifications or emails (2C)
- Bulk operation quota checks (Phase 3F)

---

## Integration Checkpoint 2 (after Prompts 5–8)

**Task:** Verify all work from Prompts 5–8 integrates correctly. All ~40 Airtable field type transforms should be registered, rate limiter operational, FilterRule grammar defined, and quota enforcement working.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test --filter=@everystack/sync` — all pass
4. `pnpm turbo test -- --coverage --filter=@everystack/sync` — coverage ≥80% on new files, `packages/shared/sync/` at ≥90% lines
5. Manual verification: `fieldTypeRegistry.getSupportedFieldTypes('airtable')` returns 30+ field type keys (including lossy types)
6. Manual verification: Rate limiter Lua script loads without Redis errors

**Git:** Commit with message `chore(verify): integration checkpoint 2 — complete Airtable transforms, rate limiter, filters, quota [Phase 2A, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 9.

---

## Prompt 9: Airtable OAuth Flow & Base Connection Token Storage

**Depends on:** None (independent of transforms)
**Load context:** `sync-engine.md` lines 88–102 (Setup Wizard Flow — Steps 1 & 2), `data-model.md` line 78 (base_connections table)
**Target files:** `packages/shared/sync/adapters/airtable/oauth.ts`, `apps/web/src/actions/sync-connections.ts`, `apps/web/src/data/sync-connections.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): Airtable OAuth flow with token storage on base_connections [Phase 2A, Prompt 9]`

### Schema Snapshot

```
base_connections: id (UUIDv7 PK), tenant_id, platform ('airtable'|'notion'|'smartsuite'), external_base_id, external_base_name, oauth_tokens (JSONB — encrypted), sync_config (JSONB), sync_direction ('inbound_only'|'bidirectional'), conflict_resolution (VARCHAR DEFAULT 'last_write_wins'), last_sync_at, sync_status ('active'|'paused'|'error'|'auth_required'|...), health (JSONB), created_by, created_at, updated_at
```

### Task

Implement the Airtable OAuth 2.0 flow for connecting a base and the server-side logic for managing connection records.

**1. Airtable OAuth Helper (`packages/shared/sync/adapters/airtable/oauth.ts`):**

Implement the Airtable OAuth 2.0 PKCE flow:
- `getAirtableAuthUrl(state: string, codeChallenge: string): string` — constructs the authorization URL
- `exchangeCodeForTokens(code: string, codeVerifier: string): Promise<AirtableTokens>` — exchanges auth code for access/refresh tokens
- `refreshAirtableToken(refreshToken: string): Promise<AirtableTokens>` — refreshes an expired token
- `listAirtableBases(accessToken: string): Promise<AirtableBase[]>` — fetches available bases using the token

```typescript
interface AirtableTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string;     // ISO 8601
  scope: string;
}

interface AirtableBase {
  id: string;             // e.g., "appXXXXXXX"
  name: string;
  permissionLevel: string;
}
```

Store tokens encrypted in `base_connections.oauth_tokens` JSONB. Use the encryption utilities from Phase 1D.

**2. Server Actions (`apps/web/src/actions/sync-connections.ts`):**

- `initiateAirtableConnection()` — generates PKCE code verifier/challenge, stores in session, returns auth URL
- `completeAirtableConnection(code: string)` — exchanges code, creates `base_connections` row with tokens, returns connection ID
- `listBasesForConnection(connectionId: string)` — fetches bases from Airtable API using stored token
- `selectBaseForConnection(connectionId: string, baseId: string, baseName: string)` — updates `base_connections.external_base_id` and `external_base_name`

**3. Data Access (`apps/web/src/data/sync-connections.ts`):**

- `getConnectionsForTenant(tenantId: string)` — list all base_connections for the tenant
- `getConnectionById(tenantId: string, connectionId: string)` — get single connection

Use `getDbForTenant()` for all queries. Both data functions need `testTenantIsolation()` tests.

### Acceptance Criteria

- [ ] `getAirtableAuthUrl()` generates a valid Airtable OAuth 2.0 PKCE authorization URL
- [ ] `exchangeCodeForTokens()` returns tokens and the tokens are stored encrypted in `base_connections.oauth_tokens`
- [ ] `listAirtableBases()` fetches and returns available bases from the Airtable API
- [ ] `testTenantIsolation()` passes for both `getConnectionsForTenant()` and `getConnectionById()`
- [ ] Token refresh logic handles expired tokens and updates the stored tokens
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Notion or SmartSuite OAuth flows (2C, Phase 3)
- Re-authentication recovery flow for expired tokens (2C error recovery)
- Connection health monitoring or status indicators (2C)
- API key authentication (alternative to OAuth) — not needed for Airtable

---

## Prompt 10: Sync Setup Wizard UI (3-Step) with Two-Phase Filter Bootstrapping

**Depends on:** Prompts 7, 8, 9
**Load context:** `sync-engine.md` lines 88–255 (Setup Wizard Flow, Table Selection, Sync Filters, Filter Pushdown, Estimated Record Count)
**Target files:** `apps/web/src/components/sync/SyncSetupWizard.tsx`, `apps/web/src/components/sync/SyncFilterBuilder.tsx`, `apps/web/src/actions/sync-setup.ts`, `apps/web/src/data/sync-setup.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): 3-step sync setup wizard with filter builder and quota check [Phase 2A, Prompt 10]`

### Schema Snapshot

```
base_connections: ..., sync_config (JSONB — SyncConfig shape), ...
fields: ..., external_field_id (nullable), ...
```

### Task

Build the 3-step sync setup wizard that guides users through connecting, selecting tables, configuring filters, and initiating sync.

**1. Step 1 — Authenticate:**
Display the Airtable OAuth button (uses `initiateAirtableConnection()` from Prompt 9). After successful OAuth callback, show the connected state with the Airtable user's info.

**2. Step 2 — Select Base:**
Show the list of available bases fetched from `listBasesForConnection()`. User picks one. On selection, fetch the table list with record counts from the Airtable API (`listTablesInBase(connectionId, baseId)`).

Implement `listTablesInBase()` server action that calls the Airtable metadata API to get tables with their fields and approximate record counts.

**3. Step 3 — Select Tables & Configure Filters:**
Build the table selection UI as specified in `sync-engine.md` lines 103–127:

- Checkbox list of tables with table name, record count, and filter column
- Per-table filter builder (reusable `SyncFilterBuilder` component)
- Quota display: "Selected: N tables — ~X records (estimated after filters) / Remaining after sync: ~Y records"
- Warning for large tables: "Tasks has 18,700 records. Filter reduces to ~8,700. [Edit Filter]"
- Block "Connect & Start Sync" button if estimated count exceeds remaining quota (uses `canSyncRecords()` from Prompt 8)

**4. SyncFilterBuilder Component (`apps/web/src/components/sync/SyncFilterBuilder.tsx`):**

Build a shared filter builder component that renders `FilterRule[]`. This same component will be reused by grid view filters in Phase 3.

For the sync setup wizard specifically, implement **two-phase filter bootstrapping**:

1. **During wizard (pre-sync):** EveryStack fields don't exist yet. The filter builder displays platform field names/types fetched from the Airtable metadata API. Filter rules are stored temporarily with `external_field_id` rather than ES field IDs.
2. **After schema sync (Prompt 11):** The first sync creates ES `fields` rows with `external_field_id` mapping. The system remaps all stored filter `fieldId` values from platform identifiers to the newly created ES field IDs.

The filter builder needs props for both modes:
- Platform mode: receives platform field metadata (name, type) from the API
- ES mode: receives ES field definitions from the database (used post-setup)

**5. Estimated Record Count:**

Implement `fetchEstimatedRecordCount(connectionId: string, baseId: string, tableId: string, filters?: FilterRule[]): Promise<number>`:
- Unfiltered: Use Airtable API with `maxRecords=0` to get total count
- Filtered: Run the filter query via the API with `maxRecords=0` to get filtered count
- Display as "~8,700 records (estimated)" with tilde

**6. Start Sync:**

"Connect & Start Sync" button saves the `SyncConfig` to `base_connections.sync_config` and enqueues the initial sync job (Prompt 11).

Use shadcn/ui components for the wizard steps (Dialog or full-page layout), form elements, checkboxes, buttons. Follow the design system from Phase 1F.

### Acceptance Criteria

- [ ] 3-step wizard renders with working navigation (Back/Next) between steps
- [ ] Step 3 shows tables with checkboxes, record counts, and per-table filter configuration
- [ ] "Connect & Start Sync" button is disabled when estimated record count exceeds remaining quota
- [ ] SyncFilterBuilder renders FilterRule rows with field selector, operator selector, and value input
- [ ] Two-phase filter bootstrapping uses platform field IDs during wizard, ready for remapping post-sync
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Sync settings dashboard for post-setup management (2C)
- Notion or SmartSuite wizard variants (2C, Phase 3)
- Advanced filter builder features like nested groups (post-MVP)
- Dark mode or mobile layout adaptation for the wizard (Phase 3H)

---

## Prompt 11: Progressive Initial Sync BullMQ Pipeline with synced_field_mappings

**Depends on:** CP-1 (all transforms ready), Prompt 6 (rate limiter), Prompt 10 (wizard triggers sync)
**Load context:** `sync-engine.md` lines 420–435 (Layer 1 — Progressive Initial Sync), `data-model.md` line 108 (synced_field_mappings table)
**Target files:** `apps/worker/src/jobs/sync/initial-sync.ts`, `apps/worker/src/jobs/sync/schema-sync.ts`, `packages/shared/sync/adapters/airtable/api-client.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): progressive initial sync via BullMQ with schema-first loading [Phase 2A, Prompt 11]`

### Schema Snapshot

```
base_connections: ..., sync_config (JSONB), sync_status, last_sync_at, health (JSONB), ...
tables: id, workspace_id, tenant_id, name, table_type, ...
fields: id, table_id, tenant_id, name, field_type, config (JSONB), external_field_id, ...
records: tenant_id, id, table_id, canonical_data (JSONB), sync_metadata (JSONB), ...
synced_field_mappings: id, tenant_id, base_connection_id, table_id, field_id, external_field_id, external_field_type, status ('active'|'type_mismatch'|'disconnected'), created_at
```

### Task

Build the progressive initial sync pipeline that runs after the setup wizard completes. This is a BullMQ job that syncs data in stages for the best user experience.

**1. Airtable API Client (`packages/shared/sync/adapters/airtable/api-client.ts`):**

Build a thin API client for the Airtable REST API:
- `listRecords(baseId, tableId, options: { filterByFormula?, sort?, pageSize?, offset? }): Promise<{ records, offset? }>`
- `getRecord(baseId, tableId, recordId): Promise<AirtableRecord>`
- `listFields(baseId, tableId): Promise<AirtableField[]>`

The client uses the `rateLimiter.waitForCapacity()` from Prompt 6 before every API call. Tokens are decrypted from `base_connections.oauth_tokens`.

**2. Schema Sync Job (`apps/worker/src/jobs/sync/schema-sync.ts`):**

For each enabled table in `SyncConfig.tables`:

a. Fetch field definitions from Airtable API (one API call, sub-second)
b. Create ES `tables` row if not exists (with `tenant_id`, workspace association)
c. Create ES `fields` rows for each Airtable field, mapping Airtable field types to ES field types via the FieldTypeRegistry
d. Create `synced_field_mappings` rows linking ES fields to external fields
e. **Remap sync filter field IDs:** Replace temporary platform field IDs in `SyncConfig.tables[].sync_filter` with the newly created ES field IDs
f. Emit real-time event to client: schema ready, render grid headers with skeleton rows

**3. Progressive Record Sync Job (`apps/worker/src/jobs/sync/initial-sync.ts`):**

For each enabled table (after schema sync):

a. Build the `filterByFormula` string using `translateFilterToFormula()` from Prompt 7
b. Fetch first page of records (100–200 rows) from Airtable with filter applied
c. Transform each record via `AirtableAdapter.toCanonical()` using the field mappings
d. Insert records into `records` table with `canonical_data` and `sync_metadata` (including `platform_record_id`, `last_synced_at`, `sync_status: 'active'`)
e. Increment quota cache via `incrementQuotaCache()`
f. Emit real-time event: first page ready, table is interactive
g. Continue fetching remaining pages in background with progress updates
h. Use `rateLimiter.waitForCapacity()` before each API page fetch
i. Check quota before each batch insert via `enforceQuotaOnBatch()`
j. On completion: update `base_connections.sync_status = 'active'`, `last_sync_at = now()`, `health.records_synced = totalCount`
k. Emit real-time event: sync complete

**Progress indicator:** Emit `sync.progress` events via Socket.io: `{ tableId, syncedCount, estimatedTotal, phase: 'schema' | 'records' }`. The client renders "Syncing... 1,247 of ~8,700 records" in a subtle progress indicator.

**Target performance:**
- Column headers visible in <2s after sync starts
- First data in <4s
- Table interactive while remainder syncs in background

### Acceptance Criteria

- [ ] Schema sync creates ES `tables`, `fields`, and `synced_field_mappings` rows from Airtable metadata
- [ ] Sync filter field IDs are remapped from platform IDs to ES field IDs after schema sync
- [ ] First page of records is available within 4 seconds of sync initiation (with mock API)
- [ ] Progressive sync emits real-time `sync.progress` events with record counts
- [ ] Record quota is enforced per-batch during sync (partial sync on quota hit)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Outbound sync (pushing local edits to Airtable) — that's 2B
- Conflict detection on inbound sync — 2B
- Schema change detection (field type changed, field deleted) — 2C
- Adaptive polling intervals or smart polling — 2C
- Error recovery flows (auth expired, platform unavailable) — 2C

---

## Integration Checkpoint 3 (after Prompts 9–11)

**Task:** Verify all work from Prompts 9–11 integrates correctly. The full inbound sync pipeline should work end-to-end: OAuth → select base → select tables → progressive sync with transforms.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (full monorepo test suite)
4. `pnpm turbo test -- --coverage` — coverage thresholds met:
   - `packages/shared/sync/` ≥ 90% lines, 85% branches
   - `apps/web/src/data/` ≥ 95% lines, 90% branches (for new data functions)
   - `apps/web/src/actions/` ≥ 90% lines, 85% branches (for new actions)
   - `apps/worker/src/jobs/` ≥ 85% lines, 80% branches (for sync jobs)
5. If possible with local Docker Compose: Run the sync wizard against a test Airtable base and verify records appear in the database with correct canonical_data shapes

**Git:** Commit with message `chore(verify): integration checkpoint 3 — end-to-end inbound sync pipeline [Phase 2A, CP-3]`, then push branch to origin.

Fix any failures before proceeding to Prompt 12.

---

## Prompt 12: Sync Orphan Detection, Orphan UX & Cross-Links to Filtered-Out Records

**Depends on:** Prompt 11 (sync pipeline must exist)
**Load context:** `sync-engine.md` lines 308–379 (Sync Orphaned Records, Cross-Links to Filtered-Out Records)
**Target files:** `apps/worker/src/jobs/sync/orphan-detection.ts`, `apps/web/src/components/sync/OrphanBanner.tsx`, `apps/web/src/actions/sync-orphans.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): sync orphan detection with UX and cross-link filtered_out handling [Phase 2A, Prompt 12]`

### Schema Snapshot

```
records: ..., sync_metadata (JSONB — includes RecordSyncMetadata with sync_status: 'active' | 'orphaned'), ...
```

### Task

Build the sync orphan detection system that identifies records excluded by filter changes and provides clear user choices.

**1. Orphan Detection Logic (`apps/worker/src/jobs/sync/orphan-detection.ts`):**

After each inbound sync cycle with an updated filter:

a. Fetch the full set of record IDs matching the current filter from the platform API
b. Compare against locally synced records for this table (where `sync_metadata.sync_status = 'active'`)
c. Records that exist locally but are NOT in the inbound set are orphan candidates
d. For each candidate: check if the record still exists on the platform (via targeted API call)
   - If exists on platform but not in filter results → it's filter-orphaned. Set `sync_metadata.sync_status = 'orphaned'`, `sync_metadata.orphaned_at = now()`, `sync_metadata.orphaned_reason = 'filter_changed'`
   - If not found on platform (404) → it was deleted on the platform. Handle via normal deletion flow (soft-delete locally)
e. If any records were orphaned, emit a real-time event: `sync.records_orphaned` with `{ tableId, orphanedCount }`

**2. Orphan Banner Component (`apps/web/src/components/sync/OrphanBanner.tsx`):**

Display when `sync.records_orphaned` event is received:

```
⚠️ 2,300 records no longer match your sync filter

These records exist in EveryStack but are no longer being
synced from Airtable. They won't receive updates.

[Delete Orphaned Records]  [Keep as Local-Only]  [Undo Filter Change]
```

**3. Orphan Resolution Actions (`apps/web/src/actions/sync-orphans.ts`):**

Three server actions:

- `deleteOrphanedRecords(tenantId, tableId)` — Soft-deletes all records where `sync_metadata.sync_status = 'orphaned'` for this table. Decrements quota cache. Records go to recycle bin (recoverable 30 days). Does NOT delete them on the platform.

- `keepOrphanedRecordsAsLocal(tenantId, tableId)` — No change to `sync_status` (stays `orphaned`). Records remain visible and editable but no longer sync. Close the banner.

- `undoFilterChange(tenantId, tableId, connectionId)` — Reverts `SyncConfig` filter to the previous value (store previous filter in a temporary `previous_sync_filter` field before saving new filter). Trigger immediate re-sync. Reset orphaned records back to `sync_status: 'active'`.

**4. Grid Indicator for Orphaned Records:**

Orphaned records show a muted gray sync icon (⇅ with strikethrough) in the row. Tooltip: "This record is no longer synced — it was excluded by a sync filter change on {date}. Edits here won't sync to {Platform}."

Implement as a CSS class and icon component that the grid renderer can use (Phase 3 will integrate it into the actual grid row rendering).

**5. Cross-Link Filtered-Out Display:**

The `filtered_out` flag was already handled in Prompt 5's `linked_record` transform. In this prompt, add a display component for grayed-out filtered-out link chips:

- Grayed-out chip with filter icon: "🔗̶ Archived Project"
- Tooltip: "This record exists on Airtable but is outside your sync filter."
- Not clickable (no local record to navigate to)

This is a pure display component — Phase 3B will integrate it into the cross-link cell renderer.

### Acceptance Criteria

- [ ] Orphan detection correctly distinguishes between filter-orphaned records and platform-deleted records
- [ ] Orphaned records have `sync_metadata.sync_status = 'orphaned'` with `orphaned_at` timestamp
- [ ] `deleteOrphanedRecords()` soft-deletes orphaned records and decrements quota cache
- [ ] `undoFilterChange()` reverts the filter and resets orphaned records to `active`
- [ ] OrphanBanner component renders with all three action buttons
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Grid row rendering for the orphan indicator (Phase 3 grid view)
- Cross-link cell renderer integration (Phase 3B)
- Bulk orphan management across multiple tables (2C sync dashboard)
- Orphan notification emails or push notifications (2C)

---

## Prompt 13: Post-Setup Sync Filter Modification with Save-and-Re-Sync Flow

**Depends on:** Prompts 10, 12
**Load context:** `sync-engine.md` lines 381–416 (Modifying Sync Filters After Setup)
**Target files:** `apps/web/src/components/sync/SyncFilterEditor.tsx`, `apps/web/src/actions/sync-filters.ts`
**Migration required:** No
**Git:** Commit with message `feat(sync): post-setup sync filter modification with save-and-re-sync [Phase 2A, Prompt 13]`

### Schema Snapshot

```
base_connections: ..., sync_config (JSONB — SyncConfig with per-table SyncTableConfig), ...
```

### Task

Build the UI and server logic for modifying sync filters after initial setup.

**1. Sync Filter Editor Component (`apps/web/src/components/sync/SyncFilterEditor.tsx`):**

A panel for editing the sync filter on a per-table basis, as specified in `sync-engine.md` lines 386–406:

- Shows current sync status: "Currently syncing: 8,700 of 18,700 records"
- Renders the current `FilterRule[]` using the `SyncFilterBuilder` component from Prompt 10 (in ES field ID mode — post-setup)
- Shows "Estimated after change: ~X records" (re-fetches estimate on filter change)
- Shows "Record quota: X of Y remaining"
- Two buttons: "Save & Re-sync" and "Cancel"

This component is a standalone panel that will be embedded in the Sync Settings dashboard in 2C. For now, it can be accessed from a temporary route or as a direct component.

**2. Save & Re-Sync Server Action (`apps/web/src/actions/sync-filters.ts`):**

`updateSyncFilter(tenantId, connectionId, tableId, newFilter: FilterRule[])`:

1. Read current `SyncConfig` from `base_connections.sync_config`
2. Store current filter as `previous_sync_filter` on the `SyncTableConfig` (for undo support in orphan UX)
3. Update `SyncTableConfig.sync_filter` with the new filter
4. Save updated `SyncConfig` to database
5. Enqueue an immediate sync job with the new filter (P0 priority — user-initiated)
6. Return success. The sync job will:
   - Fetch records matching the new filter
   - Identify orphaned records (via Prompt 12 logic)
   - Show orphan banner if any records were orphaned

**3. Enable Previously-Disabled Table:**

`enableSyncTable(tenantId, connectionId, tableId)`:

1. Set `SyncTableConfig.enabled = true`
2. Optionally accept a `FilterRule[]` to apply before syncing
3. Trigger a full initial sync for that table (reuse Prompt 11's progressive sync pipeline)
4. The user can configure a filter before starting via the `SyncFilterEditor`

**4. Disable Table:**

`disableSyncTable(tenantId, connectionId, tableId)`:

1. Set `SyncTableConfig.enabled = false`
2. Existing synced records remain in the database (NOT deleted)
3. Sync stops for this table — no further inbound or outbound sync
4. Records can still be viewed and edited locally

### Acceptance Criteria

- [ ] `SyncFilterEditor` displays current filter, allows modification, and shows estimated record counts
- [ ] "Save & Re-sync" saves new filter, stores previous filter for undo, and enqueues sync job
- [ ] `enableSyncTable()` triggers a full initial sync for a previously disabled table
- [ ] `disableSyncTable()` stops sync without deleting existing records
- [ ] Quota remaining is displayed and sync is blocked if new filter would exceed quota
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Full Sync Settings dashboard with 6 tabs (2C)
- Sync history or sync run log (2C)
- "Disconnect" or "Pause Sync" controls (2C)
- "Sync Now" manual trigger button (2C)

---

## Integration Checkpoint 4 — Final (after Prompts 12–13)

**Task:** Final verification for Phase 2A. The complete inbound sync pipeline should work: OAuth → wizard → progressive sync → filter modification → orphan handling.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass (full monorepo)
5. `pnpm turbo test -- --coverage` — all coverage thresholds met:
   - `packages/shared/sync/` ≥ 90% lines, 85% branches
   - `apps/web/src/data/` ≥ 95% lines, 90% branches
   - `apps/web/src/actions/` ≥ 90% lines, 85% branches
   - `apps/worker/src/jobs/` ≥ 85% lines, 80% branches
6. `pnpm turbo test:coverage-check` — all thresholds pass
7. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations
8. Manual verification: Import `fieldTypeRegistry` and verify `fieldTypeRegistry.getSupportedFieldTypes('airtable')` returns all ~37 registered field type keys

**Git:** Commit with message `chore(verify): final integration checkpoint — Phase 2A complete [Phase 2A, CP-4]`, then push branch to origin. Open PR to main with title `Phase 2A — FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter`.

---

## Phase 2A Complete — What's Next

**Merge to main** via squash merge. Tag: `v0.2.0-phase-2a`.

**Phase 2B** (Synced Data Performance, Outbound Sync, Conflict Resolution) can now begin. It depends on:
- All Airtable field type transforms in the FieldTypeRegistry (this phase)
- Canonical data present in the database from initial sync (this phase)
- Rate limit infrastructure (this phase)

**Phase 2C** (Notion Adapter, Error Recovery, Sync Dashboard) follows 2B.
