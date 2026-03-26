# Sync Engine

> **Reconciliation note (2026-02-27):** Aligned with `GLOSSARY.md` (source of truth). Changes: (1) Renamed "Interface record_filters" → "App record_filters" per naming discipline. (2) Renamed "Through Interfaces" / "InterfaceView" → "Through Apps" / "App" (post-MVP App Designer outputs). (3) Tagged Kanban/Calendar/Timeline view references as post-MVP. (4) Tagged approval-workflows and workspace-map cross-references as post-MVP features. (5) Tagged "portal blocks" impact reference as post-MVP. (6) Tagged "Governed Status field transitions" section as post-MVP (Approval Workflows).

> Contextual Transformation Layer, platform adapters, source_refs, performance strategy, rate limit management, and conflict resolution UX.
> Cross-references: `data-model.md`, `accounting-integration.md` (UnifiedAccountingAdapter — transactional entity sync pattern, distinct from tabular sync), `approval-workflows.md` **(post-MVP: Approval Workflows)** (inbound sync status changes that violate transition preconditions create sync conflicts rather than silent reject/accept — reuses conflict resolution UI), `inventory-capabilities.md` (record quota interaction with bulk receiving — Quick Entry rapid scan and warehouse receiving workflows can create high record volumes that interact with quota enforcement point #3), `workspace-map.md` **(post-MVP: Workspace Map)** (SyncSourceNode in topology graph — platform, status, table count, record count; sync_feeds edges from source to tables; sync status changes trigger incremental map updates via real-time events), `field-groups.md` (synced table tab badges — platform badge 14px logo overlay on table type icon in sidebar/nav bar deriving from `base_connections.platform`, sync status indicator icon with 6 health states, badge+tab color independence as parallel visual channels; MVP — Sync delivery alongside sync infrastructure), `bulk-operations.md` (user-initiated bulk operations reuse sync batch condensation pattern — same audit log condensation approach with `record_ids_affected[]` capped at 1,000 and truncation flag; batch real-time event shape mirrors sync event batching)
> Last updated: 2026-02-27 — Glossary reconciliation (naming, MVP scope tags). Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                       | Lines     | Covers                                                                                                 |
| --------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------ |
| Core Pattern                                  | 30–45     | Adapter → Canonical JSONB → Adapter flow, adding new platforms                                         |
| Source References for Lossless Round-Tripping | 47–67     | source_refs map for platform-specific identifiers                                                      |
| Field Type Registry                           | 69–86     | Per-platform transforms, lossy field handling, type mapping                                            |
| Sync Setup & Table Selection                  | 88–418    | OAuth wizard, table selection, sync filters, record quotas, orphan handling                            |
| Synced Data Performance Strategy              | 420–478   | 6-layer performance: progressive sync, JSONB source of truth, read cache, optimistic UI, smart polling |
| External API Rate Limit Management            | 480–533   | Platform rate limits, token bucket, priority scheduling, multi-tenant fairness                         |
| Conflict Resolution UX                        | 535–798   | Detection, manual resolution UI, diff view, grid rendering, mobile conflicts, audit trail              |
| Sync Error Recovery UX                        | 800–1090  | 8 error categories, connection status model, UI indicators, 5 recovery flows, settings dashboard       |
| Schema Sync                                   | 1092–1098 | Schema change detection and handling                                                                   |
| Phase Implementation                          | 1100–1107 | MVP — Sync delivery scope and ordering                                                                 |

---

## Core Pattern

**Adapter → Canonical JSONB → Adapter.** Every external platform has a dedicated adapter that transforms data into EveryStack's canonical JSONB on inbound sync and reverts it on outbound. All features operate exclusively on canonical form — platform-agnostic by design.

```
Airtable API  ──→  AirtableAdapter.toCanonical()  ──→  Canonical JSONB (source of truth)
Notion API    ──→  NotionAdapter.toCanonical()     ──→  Canonical JSONB (source of truth)
SmartSuite API ──→ SmartSuiteAdapter.toCanonical() ──→  Canonical JSONB (source of truth)

Canonical JSONB ──→  AirtableAdapter.fromCanonical()  ──→  Airtable API
Canonical JSONB ──→  NotionAdapter.fromCanonical()     ──→  Notion API
```

Adapters are pairs of pure functions. Adding a new platform = writing a new adapter, not modifying the sync engine.

---

## Source References for Lossless Round-Tripping

Each platform identifies field values differently (Airtable by label string, SmartSuite by option ID, Notion by internal ID). The canonical form preserves all identifiers in a `source_refs` map:

```jsonb
{
  "type": "single_select",
  "value": {
    "id": "es_opt_abc123",
    "label": "In Progress",
    "source_refs": {
      "airtable": "In Progress",
      "smartsuite": "opt_7f3a"
    }
  }
}
```

When syncing outbound, the adapter looks up its platform key in `source_refs`. No data loss, no guessing.

---

## Field Type Registry

Transforms are registered per-platform, per-field-type in `packages/shared/sync/field-registry.ts`:

```typescript
interface FieldTransform {
  toCanonical: (value: unknown, fieldConfig: PlatformFieldConfig) => CanonicalValue;
  fromCanonical: (value: CanonicalValue, fieldConfig: PlatformFieldConfig) => unknown;
  isLossless: boolean;
  supportedOperations: ('read' | 'write' | 'filter' | 'sort')[];
}
```

**Lossy fields:** Some types cannot round-trip (Airtable Lookup fields are server-computed, Notion Rollups are read-only). Marked `isLossless: false`, treated as read-only. UI shows a lock icon on non-writable fields.

**Field type mapping matrix:** Every field type (~40 types) has a defined canonical JSONB shape. Each adapter maps platform-native types to the closest canonical type. See `data-model.md > Field Type Canonical Shapes`.

---

## Sync Setup & Table Selection

When a user connects a base from an external platform, they go through a setup wizard that controls which tables are synced and what records come in.

### Setup Wizard Flow

```
Step 1: Authenticate
  Connect to Airtable / Notion / SmartSuite via OAuth
  → Token stored, platform API accessible

Step 2: Select Base/Database
  Show list of available bases (Airtable) / databases (Notion)
  User picks one → fetch table/database list with record counts

Step 3: Select Tables & Configure Filters
  ┌──────────────────────────────────────────────────────────────────┐
  │  Select tables to sync from "Project Tracker" (Airtable)        │
  │                                                                  │
  │  Your plan: Professional — 206,800 of 250,000 records remaining  │
  │                                                                  │
  │  ┌──┬──────────────────────────┬──────────┬──────────────────┐  │
  │  │✓ │ Table                    │ Records  │ Filter           │  │
  │  ├──┼──────────────────────────┼──────────┼──────────────────┤  │
  │  │☑ │ Projects                 │ 2,450    │ [+ Add Filter]   │  │
  │  │☑ │ Tasks                    │ 18,700   │ Status ≠ Archived│  │
  │  │☐ │ Archived Tasks           │ 45,000   │ —                │  │
  │  │☑ │ Team Members             │ 85       │ [+ Add Filter]   │  │
  │  │☐ │ Audit Log                │ 120,000  │ —                │  │
  │  └──┴──────────────────────────┴──────────┴──────────────────┘  │
  │                                                                  │
  │  Selected: 3 tables — ~15,235 records (estimated after filters) │
  │  Remaining after sync: ~27,965 records                          │
  │                                                                  │
  │  ⚠️ "Tasks" has 18,700 records. Filter reduces to ~8,700.       │
  │     [Edit Filter]                                                │
  │                                                                  │
  │  [Back] [Connect & Start Sync]                                   │
  └──────────────────────────────────────────────────────────────────┘

Step 4: Sync begins
  Progressive sync per selected table (schema → first page → background remainder)
  Sync filter applied at fetch time — filtered-out records never enter EveryStack
```

### Table Selection Model

Each base connection stores its table selection and per-table config in `base_connections.sync_config` (JSONB). Connection-level fields (`platform`, `external_base_id`, `external_base_name`, `oauth_tokens`, `sync_direction`, `sync_status`) are top-level columns on `base_connections` — see `data-model.md`.

```typescript
// Shape of base_connections.sync_config (JSONB)
interface SyncConfig {
  polling_interval_seconds: number; // Default: 300 (5 min)
  tables: SyncTableConfig[]; // Per-table selection and filters
}

interface SyncTableConfig {
  external_table_id: string; // Platform's table/database ID
  external_table_name: string; // Display name from platform
  enabled: boolean; // User toggled this table on/off
  sync_filter: FilterRule[] | null; // Inbound filter — same grammar as view filters
  estimated_record_count: number; // Last known count from platform
  synced_record_count: number; // Actual records synced locally
}
```

**Key design decisions:**

- **Per-table, not per-base.** Each table in a synced base can have its own filter. A user might sync "Projects" unfiltered but filter "Tasks" to only active ones.
- **Same filter grammar as views.** The `FilterRule[]` type is identical to what grid view filters use. The filter builder UI is the same component. Users learn one system.
- **`enabled: boolean` is the toggle.** Tables not selected in the wizard have `enabled: false`. They can be toggled on later from Sync Settings without re-running the wizard.

### Sync Filters

A sync filter is a `FilterRule[]` applied to inbound records. Records that don't match the filter are never synced into EveryStack.

```typescript
// Same FilterRule type used by grid views, portal data_scope, and App record_filters (post-MVP)
interface FilterRule {
  fieldId: string; // EveryStack field ID (mapped from platform field)
  operator: FilterOperator;
  value: unknown; // Type depends on field type
  conjunction: 'and' | 'or';
}

type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'is_empty'
  | 'is_not_empty'
  | 'is_any_of'
  | 'is_none_of'
  | 'is_before'
  | 'is_after'
  | 'is_within'; // Date operators
```

**Setup wizard bootstrapping:** During initial sync setup (Step 3), EveryStack fields don't exist yet — they're created during the first schema sync (Step 4). The filter builder handles this with a two-phase approach:

1. **During wizard (pre-sync):** The filter builder displays platform field names/types fetched from the platform API. Filters are stored temporarily with platform field identifiers (`external_field_id`) rather than ES field IDs.
2. **After schema sync (Step 4):** The first sync creates ES `fields` rows, each with `external_field_id` mapping back to the platform. The system remaps all stored filter `fieldId` values from platform identifiers to the newly created ES field IDs.
3. **Post-setup:** The filter builder uses ES field IDs as normal — same component as grid view filters.

If a platform field referenced in a filter is not synced (e.g., the user deselected it), the filter rule is flagged for review rather than silently dropped.

**Filter scope:** Inbound only. The filter controls what comes IN from the platform. Outbound sync pushes all locally-created records to the platform regardless of filter. This prevents the confusing scenario where a user creates a record in EveryStack and it "doesn't appear" on the external platform because it didn't match a filter that was meant for inbound quota management.

### Platform Filter Pushdown

Where possible, the sync adapter translates `FilterRule[]` into the platform's native filter API to avoid fetching unnecessary data:

| Platform   | Native Filter API                    | Pushdown Support                                                                                                       |
| ---------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Airtable   | `filterByFormula`                    | ✅ Full — most operators map directly. String `contains` uses `FIND()`. Date operators use `IS_BEFORE()`/`IS_AFTER()`. |
| Notion     | `filter` parameter on database query | ✅ Full — Notion's filter JSON maps well to FilterRule.                                                                |
| SmartSuite | `filter` parameter (limited)         | ⚠️ Partial — basic equality and empty checks. Complex filters fall back to local post-filtering.                       |

**Pushdown translation in adapter:**

```typescript
// In AirtableAdapter
function translateFilterToFormula(filters: FilterRule[], fieldMap: Map<string, string>): string {
  // Convert FilterRule[] → Airtable filterByFormula string
  // e.g., AND({Status} != "Archived", {Priority} = "High")
  return (
    filters
      .map((f) => {
        const fieldName = fieldMap.get(f.fieldId);
        switch (f.operator) {
          case 'equals':
            return `{${fieldName}} = "${f.value}"`;
          case 'not_equals':
            return `{${fieldName}} != "${f.value}"`;
          case 'contains':
            return `FIND("${f.value}", {${fieldName}}) > 0`;
          case 'is_empty':
            return `{${fieldName}} = BLANK()`;
          // ... other operators
        }
      })
      .join(filters[0]?.conjunction === 'or' ? ', OR(' : ', AND(') + ')'
  );
}
```

**Fallback post-filtering:** If the adapter can't translate a filter natively, it fetches all records and applies the filter locally after `toCanonical()`. This is slower for large tables. When this happens, the sync setup wizard shows a warning:

```
⚠️ This filter can't be fully applied on SmartSuite's server.
   All 45,000 records will be fetched and filtered locally.
   This may make initial sync slower but won't affect ongoing performance.
```

### Estimated Record Count

During setup, the wizard needs to show how many records will sync after filtering. This estimate is fetched from the platform API:

1. **Unfiltered count:** Most platform APIs expose record count (Airtable list endpoint returns `offset` behavior, Notion returns `has_more` with pagination — count requires full scan or heuristic). For Airtable, use a `maxRecords=0` request to get total. For Notion, use a filtered database query with `page_size=1` to check if results exist, then estimate from pagination.

2. **Filtered count:** Run the filter query against the platform API with a `maxRecords=0` (Airtable) or `page_size=1` (Notion) to get the count or estimate. For platforms without native count, fetch the first page and extrapolate from pagination metadata.

3. **Display:** Show as "~8,700 records (estimated)" with the tilde indicating it's an approximation. Exact count is known after initial sync completes.

### Record Quota Enforcement

Record quotas exist per workspace tier (see root CLAUDE.md > Pricing for canonical values):

| Plan         | Record Quota (Cached Records) | Bases     | Tables per Base |
| ------------ | ----------------------------- | --------- | --------------- |
| Freelancer   | 10,000                        | 3         | 20              |
| Starter      | 50,000                        | 10        | 50              |
| Professional | 250,000                       | 25        | 100             |
| Business     | 1,000,000                     | Unlimited | Unlimited       |
| Enterprise   | Unlimited                     | Unlimited | Unlimited       |

**Quota = all records across all tables in all bases in the workspace** (synced + native). Soft-deleted records don't count. Sync-orphaned records DO count (they're still stored data).

**Enforcement points:**

1. **Sync setup wizard (preventive).** Before confirming sync, compare estimated filtered count against remaining quota. If it would exceed: block "Connect & Start Sync" button, show "This would exceed your record quota by ~12,000 records. Add filters to reduce record count or upgrade your plan." User must either filter down or deselect tables until estimate fits.

2. **Ongoing inbound sync (runtime).** Before inserting each batch of inbound records, check current count against quota:

   ```typescript
   const currentCount = await db
     .select({ count: count() })
     .from(records)
     .where(and(eq(records.tenantId, tenantId), isNull(records.deletedAt)));

   const remainingQuota = planQuota - currentCount;
   if (inboundBatch.length > remainingQuota) {
     // Sync the records that fit
     const accepted = inboundBatch.slice(0, remainingQuota);
     await insertRecords(accepted);

     // Pause sync with quota_exceeded error
     await updateSyncStatus(baseId, {
       sync_status: 'error',
       last_error: {
         code: 'quota_exceeded',
         message: `Record quota reached (${planQuota.toLocaleString()} records). ${inboundBatch.length - remainingQuota} records could not be synced.`,
         retryable: false,
       },
     });

     // Notify workspace owner
     await sendQuotaExceededNotification(tenantId, baseId);
   }
   ```

3. **Record creation (local + portal).** Non-sync record creation (user creates a record, portal form submission) also checks quota before insert. Return typed error `RECORD_QUOTA_EXCEEDED` to the UI.

**Quota caching:** Current record count cached in Redis (`quota:records:{tenantId}`, TTL 60s). Incremented/decremented on record create/delete. Full recount on cache miss. Avoids a COUNT query on every insert.

### Sync Orphaned Records

When a user changes a sync filter such that previously-synced records no longer match, those records become **sync-orphaned** — they exist locally but are no longer receiving updates from the platform.

**Detection:** On each inbound sync cycle, the adapter fetches the full set of record IDs matching the current filter. Records that exist locally (synced from this table) but are NOT in the inbound set are candidates for orphaning. However, the adapter must distinguish between:

- Records that no longer match the filter (→ orphan)
- Records that were deleted on the platform (→ mark as remotely deleted)

The adapter checks: if the record's `platform_record_id` still exists on the platform (via a targeted API call or batch lookup), it's a filter miss → orphan. If the platform returns 404, it was deleted → handle via normal deletion flow.

**Sync metadata on orphaned records:**

```typescript
// On the record's sync_metadata JSONB
interface RecordSyncMetadata {
  platform_record_id: string;
  last_synced_at: string;
  last_synced_value: Record<string, unknown>; // For conflict detection
  sync_status: 'active' | 'orphaned'; // NEW
  orphaned_at: string | null; // When filter excluded it
  orphaned_reason: 'filter_changed' | null;
}
```

**UX when records are orphaned:**

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️ 2,300 records no longer match your sync filter              │
│                                                                  │
│  These records exist in EveryStack but are no longer being       │
│  synced from Airtable. They won't receive updates.              │
│                                                                  │
│  [Delete Orphaned Records]  [Keep as Local-Only]  [Undo Filter] │
└──────────────────────────────────────────────────────────────────┘
```

**Actions:**

- **Delete Orphaned Records:** Soft-deletes all orphaned records. Frees quota. Records go to recycle bin (recoverable for 30 days). Does NOT delete them on the platform.
- **Keep as Local-Only:** Records remain visible and editable but their `sync_status` stays `orphaned`. They no longer receive inbound updates and edits are NOT pushed outbound. A subtle indicator (gray sync icon with strikethrough) appears on these records in the grid.
- **Undo Filter Change:** Reverts the sync filter to the previous value. Re-syncs the records that were about to be orphaned. Only available immediately after a filter change (within the same session).

**Grid indicator for orphaned records:** A muted gray sync icon (⇅ with strikethrough) in the row's status area. Tooltip: "This record is no longer synced — it was excluded by a sync filter change on {date}. Edits here won't sync to {Platform}."

### Cross-Links to Filtered-Out Records

A synced record might contain a cross-link reference to a platform record that exists on the platform but was excluded by the sync filter (never synced into EveryStack).

**Detection:** During inbound sync, the adapter encounters a link field value referencing `platform_record_id = "rec_xyz"`. The cross-link resolver looks up `rec_xyz` in local records. If not found, it's a link to a filtered-out record.

**Storage:** The cross-link field value in canonical_data stores the reference with a `filtered_out` flag:

```jsonb
{
  "type": "cross_link",
  "value": [
    { "record_id": "es_123", "display": "Active Project" },
    {
      "record_id": null,
      "platform_record_id": "rec_xyz",
      "display": "Archived Project",
      "filtered_out": true
    }
  ]
}
```

**Display:** The link appears as a grayed-out chip with a filter icon: `🔗̶ Archived Project`. Tooltip: "This record exists on Airtable but is outside your sync filter." Not clickable (no local record to navigate to). The `display` value is fetched once from the platform during sync and cached in the canonical data — it doesn't update on subsequent syncs since the record isn't being tracked.

**If the filter later expands to include the record:** On the next sync, the record is synced into EveryStack normally. The cross-link resolver finds it locally, removes the `filtered_out` flag, and sets the proper `record_id`. The grayed-out chip becomes a normal clickable link.

### Modifying Sync Filters After Setup

Users can change sync filters post-setup from Sync Settings → Sync Filter tab (per-table):

```
┌──────────────────────────────────────────────────────────────────┐
│  Sync Settings: "Project Tracker" → Tasks                        │
│                                                                  │
│  Tabs: [Overview] [Conflicts (0)] [Failures (2)]                │
│        [Schema Changes (1)] [Sync Filter] [History]              │
│                                                                  │
│  ─── Sync Filter for "Tasks" ───────────────────────────────     │
│                                                                  │
│  Currently syncing: 8,700 of 18,700 records                     │
│                                                                  │
│  Filters:                                                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Status  [is not]  [Archived]                          [×]  │  │
│  │ [+ Add filter]                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Estimated after change: ~8,700 records (no change)              │
│  Record quota: 206,800 of 250,000 remaining                      │
│                                                                  │
│  [Save & Re-sync]  [Cancel]                                      │
└──────────────────────────────────────────────────────────────────┘
```

**"Save & Re-sync" behavior:**

1. Save new filter to `SyncTableConfig.sync_filter`
2. Trigger an immediate sync with the new filter
3. After sync completes, identify orphaned records (see above)
4. Show orphaned records banner if any exist

**Enabling a previously-disabled table:** From the same Sync Settings panel, the user can toggle on a table that was disabled during setup. This triggers a full initial sync for that table, with the option to configure a filter before starting.

---

## Synced Data Performance Strategy

**Core principle: The user never waits for the source platform.** Every interaction hits local Postgres. Sync happens in the background.

### Layer 1 — Progressive Initial Sync

When a user completes the sync setup wizard and clicks "Connect & Start Sync":

1. For each enabled table in `SyncConfig.tables`:
   a. Schema sync first (field definitions only — one API call, sub-second). Render grid with column headers + skeleton shimmer immediately.
   b. Stream first page of records (100–200 rows) **with sync filter applied** and render. Table is now interactive.
   c. Continue syncing remaining filtered records via BullMQ in background. Show subtle progress ("Syncing… 1,247 of ~8,700 records").

2. Sync filter is applied at fetch time — filtered-out records never enter EveryStack, never consume quota.

**Target:** Column headers visible in <2s, first data in <4s, table interactive while remainder syncs.

### Layer 2 — JSONB as Source of Truth (MVP)

Queries run directly against JSONB with expression indexes on commonly sorted/filtered paths. Sufficient for tables up to ~50K records.

### Layer 3 — Denormalized Read Cache (MVP — Core UX, If Needed)

If grid performance degrades on large synced tables (50K+ records), introduce `record_cells` projection table extracting sortable/filterable values into native columns at write time. Always rebuildable from JSONB. Decision trigger: JSONB expression indexes no longer meet <200ms grid query targets.

### Layer 4 — Optimistic UI for Edits

User edits a cell in a synced table:

1. Update JSONB in local Postgres immediately
2. Re-render grid instantly from local data
3. Queue outbound sync to source platform via BullMQ
4. If outbound sync fails (conflict, rate limit, permission), show subtle inline warning

### Layer 5 — Smart Polling & Real-Time Push

| Context                                | Poll Interval             |
| -------------------------------------- | ------------------------- |
| User actively viewing the synced table | 30 seconds                |
| Tab open, table not visible            | 5 minutes                 |
| Workspace not accessed                 | 30 minutes                |
| Webhook available (Airtable)           | Event-driven (no polling) |

All polling uses cursor-based change detection (`modifiedTime > lastSyncTimestamp`). Changed records pushed to connected clients via Redis pub/sub.

**Converted tables are skipped.** Before dispatching any sync job, the scheduler checks `base_connections.sync_status`. If `'converted'` or `'converted_finalized'`, the table is excluded from polling entirely. If `'converted_dual_write'`, syncs write to the shadow table only (see `cross-linking.md` > "Convert to Native Table" Migration).

### Layer 6 — Native Speed Showcase

| Capability              | Synced Table                 | Native Table                  |
| ----------------------- | ---------------------------- | ----------------------------- |
| Field creation          | Requires sync cycle          | Instant                       |
| Cell edits              | Optimistic + background sync | Immediate write               |
| Sort/filter             | Fast (JSONB indexes)         | Fastest                       |
| Cross-base linking      | Full support                 | Full support                  |
| Real-time collaboration | Limited by sync interval     | Live cursor + instant updates |
| Formula computation     | Full support                 | Real-time recalculation       |

---

## External API Rate Limit Management

**Core principle: Never reactive, always proactive.** The sync scheduler knows each platform's rate limits before dispatching jobs. 429 responses should be rare exceptions.

### Platform Rate Limit Registry

Each adapter declares its rate limits as structured configuration:

```typescript
interface PlatformRateLimits {
  platform: 'airtable' | 'notion' | 'smartsuite';
  limits: RateLimit[];
  retryStrategy: RetryStrategy;
}
```

| Platform   | Scope           | Limit    |
| ---------- | --------------- | -------- |
| Airtable   | Per base        | 5 req/s  |
| Airtable   | Per API key     | 50 req/s |
| Notion     | Per integration | 3 req/s  |
| SmartSuite | Per API key     | 10 req/s |

These are configuration, not hardcoded — updated when platforms change limits.

### Token Bucket Rate Limiter

Redis-backed sliding window (`ZSET` per key, scored by timestamp, atomic Lua script). Keyed by `{platform}:{scope_key}`.

### Priority-Based Scheduling

| Priority | Jobs                                                  | Behavior Under Rate Pressure               |
| -------- | ----------------------------------------------------- | ------------------------------------------ |
| **P0**   | Outbound sync (cell edits), webhook-triggered inbound | Always dispatched. Retry with backoff.     |
| **P1**   | Inbound polling for actively viewed tables            | Dispatched if capacity >30%. Delayed <30%. |
| **P2**   | Inbound polling for non-visible tables                | Dispatched if capacity >50%. Skipped <50%. |
| **P3**   | Inbound polling for inactive workspaces               | Dispatched if capacity >70%. Skipped <70%. |

### Multi-Tenant Fairness

Round-robin across tenants within same priority tier. Per-tenant poll budget: max 20% of a platform's capacity. P0 exempt. Plan tier does not affect sync freshness — fairness is absolute.

### Sync Status UI

| State   | Indicator                                                | Shown When                       |
| ------- | -------------------------------------------------------- | -------------------------------- |
| Normal  | "Last synced 30s ago" (green dot)                        | On schedule                      |
| Delayed | "Last synced 3m ago — sync pending" (yellow dot)         | P1 delayed >2× expected interval |
| Stalled | "Last synced 15m ago — platform rate limit" (orange dot) | Multiple cycles skipped          |
| Failed  | "Sync error — tap to retry" (red dot)                    | P0 outbound fails after retries  |

Users never see "429" or technical details.

---

## Conflict Resolution UX

Covers What Causes Conflicts, Detection, Conflict Record Schema, Default Resolution: Last-Write-Wins, Manual Resolution UI, Conflict History.
Touches `last_synced_value`, `sync_metadata`, `canonical_data`, `sync_conflicts`, `tenant_id` tables. See `approval-workflows.md`, `cross-linking.md`.

### What Causes Conflicts

A conflict occurs when the same field in the same record is modified in both EveryStack (local edit or automation) and the external platform between sync cycles. On the next inbound sync, the adapter detects that the platform value differs from what it last wrote.

**Governed Status field transitions (post-MVP: Approval Workflows):** When a Status field has transition enforcement enabled (`approval-workflows.md` > Enforcement Layer), inbound sync status changes that violate preconditions (unsatisfied requirements, pending approval, unauthorized role) create a sync conflict rather than silently rejecting or accepting the value. The conflict appears in the standard conflict resolution UI described below. This ensures Manager visibility and control — the platform never silently drops a status change from an external source.

### Detection

On inbound sync for each record:

1. Compare inbound platform value against `last_synced_value` (stored per-field in `sync_metadata` JSONB on the record)
2. Compare `last_synced_value` against current `canonical_data` value
3. If **both** differ from `last_synced_value`, there's a conflict (both sides changed independently)
4. If only one differs, it's a clean change — apply it

### Conflict Record Schema

When a conflict is detected, it's written to a `sync_conflicts` table:

| Column         | Type                   | Purpose                                                           |
| -------------- | ---------------------- | ----------------------------------------------------------------- |
| `id`           | UUID                   | Primary key                                                       |
| `tenant_id`    | UUID                   |                                                                   |
| `record_id`    | UUID                   | Affected record                                                   |
| `field_id`     | UUID                   | Affected field                                                    |
| `local_value`  | JSONB                  | EveryStack's current canonical value                              |
| `remote_value` | JSONB                  | Platform's incoming value                                         |
| `base_value`   | JSONB                  | Last known synced value (common ancestor)                         |
| `platform`     | VARCHAR                | Which platform (`airtable`, `notion`, etc.)                       |
| `status`       | VARCHAR                | `pending`, `resolved_local`, `resolved_remote`, `resolved_merged` |
| `resolved_by`  | UUID (nullable)        | User who resolved                                                 |
| `created_at`   | TIMESTAMPTZ            |                                                                   |
| `resolved_at`  | TIMESTAMPTZ (nullable) |                                                                   |

### Default Resolution: Last-Write-Wins

By default, inbound sync wins (platform value overwrites local). This is the safest default because most users expect external platforms to be authoritative for synced tables. The overwritten local value is preserved in the conflict record for recovery.

### Manual Resolution UI

Managers can switch a synced table to "manual conflict resolution" mode. When enabled:

**Conflict indicator:** A yellow warning badge appears on the record row in the grid. The cell with the conflict shows a split-value indicator.

**Resolution modal (on click):**

```
┌─────────────────────────────────────────────┐
│  Conflict: "Status" field on "Acme Project" │
│                                             │
│  ┌─────────────┐    ┌─────────────┐        │
│  │ EveryStack  │    │  Airtable   │        │
│  │             │    │             │        │
│  │ "Complete"  │    │ "In Review" │        │
│  │             │    │             │        │
│  │ Changed by  │    │ Changed in  │        │
│  │ Jane (2h ago)│   │ Airtable    │        │
│  │             │    │ (1h ago)    │        │
│  └─────────────┘    └─────────────┘        │
│                                             │
│  Was: "In Progress" (last synced 3h ago)    │
│                                             │
│  [Keep EveryStack] [Keep Airtable] [Edit]  │
└─────────────────────────────────────────────┘
```

**Resolution actions:**

- **Keep EveryStack:** Local value becomes canonical. Outbound sync pushes it to the platform.
- **Keep Airtable/Notion/SmartSuite:** Remote value becomes canonical. Local value discarded.
- **Edit:** Open the field editor with both values visible. User types a merged value. Both local and remote are overwritten.

**Bulk resolution:** When multiple conflicts exist, the conflict list view shows all pending conflicts with "Resolve All: Keep EveryStack" / "Resolve All: Keep Remote" bulk actions.

### Conflict History

Resolved conflicts remain in `sync_conflicts` for 90 days (viewable in the sync settings panel). This provides an audit trail for debugging and trust-building.

### Grid-Level Conflict Rendering

**Cell indicator:** A conflicted cell renders with a diagonal split indicator — a 4px amber triangle in the top-right corner of the cell. The cell value shows the **currently applied value** (remote, since last-write-wins is default). On hover, a tooltip: "Conflict: edited both locally and on {Platform}. Click to resolve."

```
Standard cell:        Conflicted cell:
┌──────────────┐     ┌──────────────◣  ← 4px amber triangle (top-right)
│ In Progress  │     │ In Review    │
└──────────────┘     └──────────────┘
                      Underline: amber dashed 1px (subtle secondary indicator)
```

**Row indicator:** When any cell in a row is conflicted, the row's index column shows a ⚠️ amber badge. In kanban view **(post-MVP)**, the card shows an amber dot on the status field. In calendar/timeline views **(post-MVP)**, the event/bar has an amber left border.

**TanStack Table integration:** Conflict state is a derived column meta property, not a separate column. The grid cell renderer checks `record.conflicts[fieldId]` — a map populated from `sync_conflicts` WHERE `status = 'pending'` AND `record_id = record.id`. This map is fetched alongside the record data in the initial page load and kept in sync via real-time events.

```typescript
// Cell renderer conflict check (simplified)
interface CellMeta {
  conflict?: {
    id: string;           // sync_conflict.id
    localValue: unknown;  // What EveryStack had
    remoteValue: unknown; // What the platform sent
    platform: string;     // 'airtable' | 'notion' | 'smartsuite'
    createdAt: string;
  };
}

// In the TanStack Table column definition:
cell: ({ getValue, row, column }) => {
  const conflict = row.original._conflicts?.[column.id];
  return (
    <CellWrapper conflict={conflict}>
      <FieldRenderer value={getValue()} fieldDef={column.columnDef.meta.fieldDef} />
    </CellWrapper>
  );
};
```

**Conflict count in toolbar:** When conflicts exist on the current table, the grid toolbar shows an amber badge: "⚠️ 3 conflicts". Clicking it opens a filter that shows only conflicted records (filter: `has_pending_conflict = true`). This filter is applied client-side by checking the `_conflicts` map — not a database query — since the conflict metadata is already loaded.

**Multi-field conflicts on same record:** When a record has conflicts on multiple fields (e.g., user edited 5 fields locally, all 5 changed on the platform too), the resolution modal shows all conflicted fields for that record in a scrollable list. Each field has its own Keep/Keep/Edit controls, but there's also a bulk action at the top: "Keep All EveryStack" / "Keep All Remote" for the record.

```
┌─────────────────────────────────────────────────────────┐
│  3 Conflicts on "Acme Project"                          │
│  [Keep All EveryStack] [Keep All Remote]                │
│                                                         │
│  ─── Field: "Status" ──────────────────────────────     │
│  EveryStack: "Complete" (Jane, 2h ago)                  │
│  Airtable:   "In Review" (1h ago)                       │
│  Was: "In Progress"                                     │
│  [Keep ES] [Keep AT] [Edit]                             │
│                                                         │
│  ─── Field: "Priority" ────────────────────────────     │
│  EveryStack: "High" (Jane, 2h ago)                      │
│  Airtable:   "Critical" (1h ago)                        │
│  Was: "Medium"                                          │
│  [Keep ES] [Keep AT] [Edit]                             │
│                                                         │
│  ─── Field: "Due Date" ────────────────────────────     │
│  EveryStack: "2026-03-15" (Jane, 2h ago)                │
│  Airtable:   "2026-03-01" (1h ago)                      │
│  Was: "2026-03-10"                                      │
│  [Keep ES] [Keep AT] [Edit]                             │
└─────────────────────────────────────────────────────────┘
```

### Role Visibility for Conflicts

| Role        | Sees conflict indicators?        | Can resolve? | Notes                                                                                                     |
| ----------- | -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| Owner/Admin | ✅ Always                        | ✅ Yes       | Full resolution UI                                                                                        |
| Manager     | ✅ On permitted bases            | ✅ Yes       | Full resolution UI within their bases                                                                     |
| Team Member | ✅ Indicator visible (amber dot) | ❌ No        | Tooltip: "This field has a sync conflict. A Manager will resolve it." Cell shows currently applied value. |
| Viewer      | ❌ No indicator                  | ❌ No        | Viewers see the resolved/current value only. Conflicts are an internal concern.                           |

**Through Apps (post-MVP: App Designer):** Team Members viewing data through Apps see conflict indicators on conflicted cells (if the field is visible in the App). They cannot click to resolve — the click opens a read-only info panel: "Sync conflict detected. Contact a Manager to resolve." The conflict indicator uses the App's field override — if a field is hidden in the App, its conflict indicator is also hidden.

### Real-Time Conflict Push

When the sync worker detects a conflict:

```
1. Worker writes sync_conflict record to database
2. Worker publishes Redis event:
   Channel: t:{tenantId}:table:{tableId}
   Event: sync.conflict_detected
   Payload: {
     recordId: string,
     fieldId: string,
     conflictId: string,
     localValue: unknown,
     remoteValue: unknown,
     platform: string,
   }

3. Real-time service broadcasts to all clients in the table room
4. Client updates the _conflicts map on the affected record
5. Cell re-renders with conflict indicator (no full page reload)
```

When a Manager resolves a conflict:

```
1. Server Action updates sync_conflict.status = 'resolved_local' | 'resolved_remote' | 'resolved_merged'
2. Server Action updates record.canonical_data with resolved value
3. Emit domain events:
   a. sync.conflict_resolved → all clients viewing the table (removes amber indicator)
   b. record.updated → standard record update pipeline (grid refresh, portal cache invalidation)
4. If resolution = 'resolved_local' (Keep EveryStack):
   - Outbound sync enqueued immediately (P1 priority, not waiting for polling cycle)
   - The resolved value is pushed to the external platform
5. If resolution = 'resolved_remote' or 'resolved_merged':
   - No outbound sync needed for 'resolved_remote' (platform already has correct value)
   - For 'resolved_merged': outbound sync enqueued to push merged value to platform
```

### Optimistic Resolution + Undo

When a Manager clicks "Keep EveryStack" or "Keep Remote":

1. **Optimistic update:** The conflict indicator disappears immediately. The cell shows the chosen value. No loading spinner.
2. **Server Action fires** in the background to persist the resolution.
3. **Undo toast:** A toast appears: "Conflict resolved. [Undo]" — auto-dismisses after 8 seconds.
4. **Undo action:** If clicked within 8 seconds, the Server Action reverts: conflict status → `pending`, canonical_data restored to previous value, outbound sync (if enqueued) cancelled.
5. **After 8 seconds:** Resolution is final. Undo no longer available. Outbound sync (if applicable) proceeds.

**Why 8 seconds:** Aligns with platform undo patterns (Google Docs uses 10s, Gmail uses ~7s). Long enough to catch mistakes, short enough to not delay outbound sync significantly.

**Edit resolution (merged value):** No optimistic update for Edit — the modal stays open until the Manager submits the merged value. After submission, the cell updates immediately (optimistic) and the same undo toast appears.

### Mobile Conflict Resolution

| Element                   | Desktop                                               | Tablet                                   | Mobile                                                                 |
| ------------------------- | ----------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| **Cell indicator**        | 4px amber triangle + dashed underline                 | Same (wider touch target: 12px triangle) | Card view: amber dot next to field label                               |
| **Click to resolve**      | Inline modal next to cell                             | Overlay modal (360px, centered)          | Full-screen bottom sheet (slide up)                                    |
| **Multi-field conflicts** | Scrollable list in modal                              | Same                                     | Bottom sheet with vertical scroll, sticky header with bulk actions     |
| **Bulk resolution**       | Toolbar badge → filter → select all → bulk action bar | Same                                     | Toolbar badge → filter → "Select" mode → floating action bar at bottom |
| **Undo toast**            | Bottom-left toast                                     | Bottom-center toast                      | Bottom-center toast (above bottom nav)                                 |

### Conflict Interaction with Other Features

**Automations:** Conflicts do NOT block automation triggers. If a record update triggers an automation, the automation runs with the currently applied value (remote, since last-write-wins). If a Manager later resolves the conflict by choosing the local value, this may trigger the automation again (if the resolution constitutes a field change that matches the trigger condition). The automation execution log shows the trigger source as `sync_conflict_resolution`.

**Cross-links:** If a conflicted field is a display value in a cross-link, the cross-link shows the currently applied value (remote). Resolution propagates through the standard cross-link display value cascade (see `cross-linking.md`).

**Portals:** Portal fields bound to a conflicted field show the currently applied value. No conflict indicator is visible to portal clients — conflicts are an internal workspace concern. If resolution changes the value, the portal cache is invalidated normally. **(Post-MVP: For App Designer portals with custom blocks, the same principle applies — blocks display the resolved value.)**

**Formulas:** Formula fields that reference a conflicted field compute with the currently applied value. Resolution triggers formula recalculation through the standard dependency cascade.

**Search/tsvector:** The tsvector index uses the currently applied value. Resolution triggers re-indexing if the resolved value differs.

### Conflict Audit Trail

Every conflict resolution writes to the audit log:

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
    previousValue: conflict.localValue, // What was overwritten
    resolvedValue: chosenValue, // What was chosen
    platform: conflict.platform,
  },
  traceId,
});
```

This appears in the record's Activity tab as: "Jane resolved sync conflict on 'Status' — kept EveryStack value 'Complete' (was 'In Review' on Airtable)."

---

## Sync Error Recovery UX

Sync can fail for many reasons beyond field-level conflicts. Each failure type requires different UX feedback and recovery paths.

### Error Categories

| Category                 | Examples                                     | Severity | Auto-Recovery?                                           |
| ------------------------ | -------------------------------------------- | -------- | -------------------------------------------------------- |
| **Conflict**             | Same field edited both sides                 | Low      | Yes (last-write-wins default) or manual                  |
| **Rate Limited**         | Airtable 5 req/s exceeded, Notion 3 req/s    | Low      | Yes (exponential backoff, resume automatically)          |
| **Partial Failure**      | 3 of 500 records fail validation on platform | Medium   | Partial — successful records committed, failures retried |
| **Auth Expired**         | OAuth token expired or revoked               | High     | No — requires re-authentication by Manager               |
| **Platform Unavailable** | Airtable/Notion API 5xx or timeout           | Medium   | Yes (retry with backoff, up to 6 hours)                  |
| **Schema Mismatch**      | Field deleted on platform, or type changed   | High     | No — requires Manager decision                           |
| **Permission Denied**    | API key no longer has write access           | High     | No — requires Manager to fix permissions on platform     |
| **Quota Exceeded**       | EveryStack plan sync limit reached           | High     | No — requires plan upgrade or wait for next cycle        |

### Sync Connection Status Model

Connection status uses two storage locations on `base_connections`:

- **Top-level columns:** `sync_status` (enum — see `data-model.md`), `last_sync_at` (timestamp)
- **`health` JSONB column:** Detailed health metrics, shaped as follows:

```typescript
// Shape of base_connections.health (JSONB)
interface ConnectionHealth {
  last_success_at: string | null; // Last fully successful sync
  last_error: SyncError | null; // Most recent error
  consecutive_failures: number; // Resets on success
  next_retry_at: string | null; // When the next retry is scheduled
  records_synced: number; // Total records in last successful sync
  records_failed: number; // Records that failed in last sync attempt
}

interface SyncError {
  code: string; // 'auth_expired' | 'rate_limited' | 'platform_unavailable' | 'schema_mismatch' | 'permission_denied' | 'partial_failure' | 'quota_exceeded'
  message: string; // Human-readable description
  timestamp: string; // When it occurred
  retryable: boolean; // Can the system retry automatically?
  details: Record<string, unknown>; // Error-specific data (e.g., which records failed, quota remaining)
}
```

### Sync Status Indicators (UI Layer)

**Table header badge:** Every synced table shows its sync status in the table header:

| Status                                  | Badge                                   | Behavior                                                                            |
| --------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `active` + recent sync                  | 🟢 "Synced 2 min ago" (green)           | Normal operation                                                                    |
| `active` + stale (>2× polling interval) | 🟡 "Last synced 45 min ago" (yellow)    | Indicates possible issue — tooltip: "Sync may be delayed. Check connection status." |
| `error` (retryable)                     | 🟡 "Sync retrying..." (yellow, pulsing) | Tooltip shows error and next retry time                                             |
| `error` (non-retryable)                 | 🔴 "Sync error" (red)                   | Click opens sync settings with error detail                                         |
| `auth_required`                         | 🔴 "Re-authentication required" (red)   | Click navigates directly to re-auth flow                                            |
| `paused`                                | ⏸️ "Sync paused" (gray)                 | Manager manually paused                                                             |

**Staleness threshold:** Calculated as `2 × polling_interval`. If polling interval is 5 minutes and last sync was >10 minutes ago, badge turns yellow.

### Notification System for Sync Issues

| Event                           | Notification Type                         | Recipients               | Timing               |
| ------------------------------- | ----------------------------------------- | ------------------------ | -------------------- |
| Conflict detected (manual mode) | In-app badge on table + push notification | Table Manager(s)         | Immediate            |
| Auth expired                    | In-app banner + email                     | Workspace Owner + Admins | Immediate            |
| 3 consecutive sync failures     | In-app toast                              | Table Manager(s)         | After 3rd failure    |
| Sync down >1 hour               | Email                                     | Workspace Owner          | After 1 hour         |
| Sync down >6 hours              | Email (escalation)                        | Workspace Owner + Admins | After 6 hours        |
| Partial failure (>10 records)   | In-app toast + badge on sync settings     | Table Manager(s)         | After sync completes |
| Schema mismatch detected        | In-app banner on table                    | Table Manager(s)         | Immediate            |
| Rate limit sustained (>5 min)   | In-app subtle indicator                   | None (auto-resolves)     | —                    |

**In-app notification channel:** Notifications published to Redis `t:{tenantId}:user:{userId}:notifications`. Real-time service forwards to connected clients. Persistent notifications stored in `notifications` table (Post-MVP — Comms & Polish comms infrastructure; before that, toast-only).

### Error Recovery Flows

#### Auth Expired / Permission Denied

```
1. Sync attempt → OAuth token returns 401/403
2. Mark connection: sync_status = 'auth_required'
3. Show red badge on table header: "Re-authentication required"
4. Manager clicks badge → navigated to Base Settings → Sync Connection
5. "Your connection to Airtable has expired. [Re-authenticate]"
6. Click → OAuth flow → new token stored → sync_status = 'active'
7. Immediate sync triggered to catch up
```

**No data loss:** While auth is expired, no sync runs. Local edits accumulate normally. Once re-authenticated, the next sync picks up all changes from both sides (using `last_synced_at` cursor).

#### Partial Failure

```
1. Inbound sync processes 500 records: 497 succeed, 3 fail
2. Successful records committed normally
3. Failed records written to `sync_failures` table:

sync_failures:
  id, tenant_id, base_connection_id, record_id, direction (inbound|outbound),
  error_code, error_message, platform_record_id,
  payload (JSONB — the data that failed), retry_count,
  created_at, resolved_at (nullable)

4. Sync marked as 'completed_with_errors' (not full 'error')
5. Badge: 🟡 "Synced with 3 errors"
6. Manager clicks → Sync Settings → Failures tab:

┌─────────────────────────────────────────────────────────────┐
│  Sync Failures (3 records)                                  │
│                                                             │
│  Record "Acme Project" — Validation error:                  │
│    Field "Budget" value "TBD" is not a valid number         │
│    on Airtable.                                             │
│    [Retry] [Skip] [Edit in EveryStack]                      │
│                                                             │
│  Record "Beta Launch" — Field "Assignee" not found          │
│    on platform. Field may have been renamed or deleted.     │
│    [Skip] [Map to Field...]                                 │
│                                                             │
│  Record "Q4 Planning" — Record too large (>100KB payload)   │
│    [Skip]                                                   │
│                                                             │
│  [Retry All] [Skip All]                                     │
└─────────────────────────────────────────────────────────────┘

7. "Retry" → re-enqueues the record for next sync cycle
8. "Skip" → marks failure as resolved (record remains as-is locally)
9. "Edit in EveryStack" → opens record view for manual fix, then retry
10. "Map to Field" → opens field mapping UI for schema mismatches
```

**Auto-retry policy:** Partial failures auto-retry up to 3 times across subsequent sync cycles. After 3 failures, the record is marked `requires_manual_resolution` and stops auto-retrying.

#### Platform Unavailable

```
1. Sync attempt → platform API returns 5xx or times out
2. Retry with exponential backoff: 1 min, 5 min, 15 min, 1 hour, 3 hours, 6 hours
3. Badge: 🟡 "Sync retrying... Next attempt in 15 min"
4. After 6 hours of continuous failure → mark sync_status = 'error'
5. Badge: 🔴 "Sync error — [platform] may be down. [Retry Now] [Pause Sync]"
6. "Retry Now" → immediate sync attempt, resets backoff
7. "Pause Sync" → sync_status = 'paused', no further attempts
8. On recovery (successful sync) → reset consecutive_failures, badge → green
```

#### Schema Mismatch

```
1. Inbound sync detects: field "Priority" (select) now has type "number" on platform
2. Or: field "Assignee" no longer exists on platform
3. Write to `sync_schema_changes` for Manager review:

sync_schema_changes:
  id, tenant_id, base_connection_id, change_type (field_type_changed | field_deleted |
    field_added | field_renamed), field_id, platform_field_id,
  old_schema (JSONB), new_schema (JSONB), status (pending | accepted | rejected),
  created_at, resolved_at, resolved_by

4. Banner on table: "Schema change detected on [platform]. [Review Changes]"
5. Manager clicks → Schema Changes panel:

┌──────────────────────────────────────────────────────────────┐
│  Schema Changes from Airtable                                │
│                                                              │
│  ⚠️  Field "Priority" type changed: Select → Number          │
│      This may affect 2 formula fields and 1 automation.      │
│      [Accept Change] [Reject — Keep Local Type]              │
│                                                              │
│  ❌  Field "Old Notes" deleted on Airtable                    │
│      This field has 450 records with data. Data preserved    │
│      locally but will no longer sync.                        │
│      [Archive Field] [Delete Field]                          │
│                                                              │
│  ✅  New field "Deadline" (Date) added on Airtable            │
│      [Add to EveryStack] [Ignore]                            │
└──────────────────────────────────────────────────────────────┘

6. "Accept Change" → update field type, re-validate existing data
7. "Reject" → keep local type, field no longer syncs (marked as local-only)
8. "Archive Field" → soft-archive field definition, data preserved, not visible in grid
9. "Add to EveryStack" → create matching field definition, sync data
```

**Impact analysis:** Before accepting a field type change, show downstream impact: formula fields referencing it, automation conditions using it, portal field bindings (MVP) or App blocks (post-MVP) binding to it, cross-links displaying it.

#### Quota Exceeded

```
1. Inbound sync batch would push workspace over record quota
2. Records that fit are synced normally
3. Remaining records skipped, sync_status = 'error', code = 'quota_exceeded'
4. Badge: 🔴 "Record quota reached"
5. Manager clicks → Sync Settings panel:

┌──────────────────────────────────────────────────────────────┐
│  ⚠️ Record quota reached                                     │
│                                                              │
│  Your workspace has 250,000 of 250,000 records               │
│  (Professional plan limit).                                  │
│                                                              │
│  1,200 records from "Tasks" could not be synced.             │
│                                                              │
│  Options:                                                    │
│  [Add Sync Filter]  Reduce inbound records with filters      │
│  [Upgrade Plan]     Increase your record quota               │
│  [Delete Records]   Free up space by removing old records    │
│  [Disable Tables]   Stop syncing tables you don't need       │
└──────────────────────────────────────────────────────────────┘

6. After user frees quota → click [Resume Sync] to retry
7. Resume triggers immediate sync cycle for skipped records
```

**No silent data loss:** Records that couldn't sync are not quietly dropped. The sync pauses and makes the user decide. Records already on the platform remain there — EveryStack never deletes platform data due to quota constraints.

### Sync Settings Dashboard

Managers access sync status from Base Settings → Sync Connection:

```
┌──────────────────────────────────────────────────────────────┐
│  Sync Connection: Airtable → "Project Tracker" Base          │
│                                                              │
│  Status: 🟢 Active                                           │
│  Last Sync: 3 minutes ago (482 records)                      │
│  Direction: Bidirectional                                    │
│  Polling Interval: 5 minutes                                 │
│  Conflicts: 0 pending                                        │
│  Failures: 2 records (auto-retrying)                         │
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Sync History (last 7 days)                               ││
│  │ ████████████████████████████████████████████████ 168 runs ││
│  │ ██ 2 failures  █ 1 partial                               ││
│  │ Avg duration: 4.2s  |  Avg records: 480                  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  Tabs: [Overview] [Tables & Filters] [Conflicts (0)] [Failures (2)]│
│        [Schema Changes (1)] [History]                        │
│                                                              │
│  [Sync Now] [Pause Sync] [Disconnect]                        │
└──────────────────────────────────────────────────────────────┘
```

**Sync History tab:** Table of recent sync runs with: timestamp, direction, records synced/failed, duration, status (success/partial/failed). Click a run → detailed log of what changed.

**Tables & Filters tab:** Shows all tables from the connected base with toggle switches and per-table sync filter configuration. Same layout as the setup wizard Step 3, but for ongoing management. Each table row shows: name, enabled toggle, synced/total record count, filter summary (or "+ Add Filter"), and an expand arrow to open the full filter builder. Changes to filters trigger "Save & Re-sync" flow (see Sync Setup > Modifying Sync Filters After Setup). Tables can be enabled/disabled without disconnecting the base.

**"Sync Now" button:** Enqueues an immediate P0 (user-initiated) sync job, bypassing the polling schedule. Disabled if sync is currently running. Shows "Syncing..." with progress indicator.

### `sync_failures` Table (MVP — Sync Schema)

| Column               | Type                   | Purpose                                                                                        |
| -------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| `id`                 | UUID                   | Primary key                                                                                    |
| `tenant_id`          | UUID                   | Tenant scope                                                                                   |
| `base_connection_id` | UUID                   | → base_connections.id                                                                          |
| `record_id`          | UUID (nullable)        | Null if failure was record-independent (e.g., auth)                                            |
| `direction`          | VARCHAR                | `'inbound'` or `'outbound'`                                                                    |
| `error_code`         | VARCHAR                | `'validation'`, `'schema_mismatch'`, `'payload_too_large'`, `'platform_rejected'`, `'unknown'` |
| `error_message`      | TEXT                   | Human-readable description                                                                     |
| `platform_record_id` | VARCHAR (nullable)     | External record ID for cross-reference                                                         |
| `payload`            | JSONB                  | The data that failed (for retry)                                                               |
| `retry_count`        | INTEGER                | Auto-incremented on each retry attempt (max 3)                                                 |
| `status`             | VARCHAR                | `'pending'`, `'retrying'`, `'resolved'`, `'skipped'`, `'requires_manual_resolution'`           |
| `created_at`         | TIMESTAMPTZ            |                                                                                                |
| `resolved_at`        | TIMESTAMPTZ (nullable) |                                                                                                |
| `resolved_by`        | UUID (nullable)        | Manager who resolved manually                                                                  |

**Retention:** 30 days for resolved failures. Pending failures retained indefinitely until resolved.

### `sync_schema_changes` Table (MVP — Sync Schema)

| Column               | Type                   | Purpose                                                                                                                     |
| -------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | UUID                   | Primary key                                                                                                                 |
| `tenant_id`          | UUID                   | Tenant scope                                                                                                                |
| `base_connection_id` | UUID                   | → base_connections.id                                                                                                       |
| `change_type`        | VARCHAR                | `'field_type_changed'`, `'field_deleted'`, `'field_added'`, `'field_renamed'`                                               |
| `field_id`           | UUID (nullable)        | EveryStack field (null for new fields)                                                                                      |
| `platform_field_id`  | VARCHAR                | External field identifier                                                                                                   |
| `old_schema`         | JSONB                  | Previous field config                                                                                                       |
| `new_schema`         | JSONB                  | New field config from platform                                                                                              |
| `impact`             | JSONB                  | Computed downstream impact: `{ formulaCount, automationCount, portalFieldCount, appBlockCount (post-MVP), crossLinkCount }` |
| `status`             | VARCHAR                | `'pending'`, `'accepted'`, `'rejected'`                                                                                     |
| `created_at`         | TIMESTAMPTZ            |                                                                                                                             |
| `resolved_at`        | TIMESTAMPTZ (nullable) |                                                                                                                             |
| `resolved_by`        | UUID (nullable)        |                                                                                                                             |

---

## Schema Sync

Field definitions synced separately from record data. Deleted external fields are soft-archived (not deleted from EveryStack) to prevent broken cross-links and portal bindings.

**Webhook listeners:** Where available (Airtable), register for real-time change notifications to reduce polling frequency.

---

## Phase Implementation

| Phase                 | Sync Work                                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| MVP — Sync, Weeks 5–6 | Canonical data model, Airtable adapter, FieldTypeRegistry, progressive initial sync, rate limit registry, Redis token bucket               |
| MVP — Sync, Weeks 6–7 | Grid rendering from JSONB, expression indexes, optimistic UI                                                                               |
| MVP — Sync, Weeks 7–8 | Outbound sync, conflict resolution, Notion adapter, smart polling, priority scheduling, multi-tenant fairness, backpressure sync status UI |
| MVP — Core UX         | SmartSuite adapter                                                                                                                         |
