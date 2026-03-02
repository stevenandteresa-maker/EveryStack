# EveryStack — Cross-Base Linking Engine

> **Reference doc.** EveryStack's core differentiator. Data model, query-time resolution, permission resolution at link boundaries, cross-link creation/modification permissions, cascade engineering (concurrency, single-hop rule, job dedup, sync backpressure), impact analysis, performance, depth limiting, "Convert to Native Table" migration path.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (cross_links, cross_link_index schema), `permissions.md` (field-level permissions, cross-link permission resolution), `tables-and-views.md` (inline sub-table display for linked records), `sync-engine.md` (bidirectional sync interaction with cross-links)
> Last updated: 2026-02-28 — Tenant-scoped cross-links (not workspace-scoped). Removed many_to_many. Schema aligned with data-model.md (card_fields, environment, updated_at).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                        | Lines   | Covers                                                                          |
| ---------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| What Cross-Linking Is                          | 31–46   | Core concept, platform-agnostic relationships, differentiator                   |
| Data Model                                     | 47–130  | cross_links table, cross_link_index, field type, card_fields, link_scope_filter |
| Query-Time Resolution                          | 131–230 | Level 0–2 resolution, JOIN patterns, depth limits                               |
| Link Picker UX                                 | 231–261 | Record search, create-new, multi-select, recent links                           |
| Display Value Maintenance                      | 262–282 | Cached display values, staleness detection, refresh triggers                    |
| Cross-Link + Sync Interaction                  | 283–291 | How cross-links interact with synced tables                                     |
| Scalability                                    | 292–434 | Tiered integrity sampling, batch processing, index optimization                 |
| Creation Constraints                           | 435–448 | Link limits, depth limits, cycle detection                                      |
| Cross-Link Creation & Modification Permissions | 449–483 | Who can create/edit/delete cross-links                                          |
| Impact Analysis                                | 484–518 | 3-tier consequence model, cascade visualization                                 |
| "Convert to Native Table" Migration            | 519–567 | Converting linked external data to native EveryStack table                      |
| Post-MVP Cross-Link Features                   | 568–573 | Rollups, multi-hop traversal, cascade engineering                               |

---

## What Cross-Linking Is

A cross-link connects a field in one table to records in another table — potentially in a different workspace, synced from a different platform. A row in the Projects table (synced from Airtable in Workspace A) can have a "Client" field that links to a record in the Contacts table (synced from SmartSuite in Workspace B). The user sees a clickable reference; EveryStack resolves it at query time from canonical JSONB.

**Why this is the moat:** Once a user has built cross-links between tables synced from different platforms, they cannot replicate that topology in either platform alone. Every portal, automation, and doc template that references a cross-link deepens the lock-in.

### Progressive Disclosure

| Level        | User Experience                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **L1 (80%)** | Create linked record field, pick target table, link records via picker. Display values show automatically. Same-workspace linking feels like Airtable. |
| **L2 (15%)** | Cross-workspace linking (different workspaces, potentially different sync sources). Scope filters. Relationship types. Reverse field config.           |
| **L3 (5%)**  | Display value cascade config, impact analysis modals, integrity sampling, bulk deletion cascades.                                                      |

---

## Data Model

### `cross_links` Table

| Column                    | Type             | Purpose                                                                                                         |
| ------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `id`                      | UUID             | Primary key                                                                                                     |
| `tenant_id`               | UUID             | Tenant scope — cross-links are tenant-scoped, tables in any workspace can link to tables in any other workspace |
| `name`                    | VARCHAR          | User-facing name (e.g., "Project → Client")                                                                     |
| `source_table_id`         | UUID             | Table that "has" the link field                                                                                 |
| `source_field_id`         | UUID             | Link field on source table                                                                                      |
| `target_table_id`         | UUID             | Table being linked to                                                                                           |
| `target_display_field_id` | UUID             | Which target field shows as display value                                                                       |
| `relationship_type`       | VARCHAR          | `many_to_one`, `one_to_many`                                                                                    |
| `reverse_field_id`        | UUID (nullable)  | Auto-created reverse field on target table                                                                      |
| `link_scope_filter`       | JSONB (nullable) | Filter constraining linkable target records                                                                     |
| `card_fields`             | JSONB            | Ordered field IDs to display in chips/previews. Default: display field only.                                    |
| `max_links_per_record`    | INTEGER          | Default 50, hard cap 500                                                                                        |
| `max_depth`               | INTEGER          | Max resolution depth (default 3)                                                                                |
| `created_by`              | UUID             |                                                                                                                 |
| `environment`             | VARCHAR          | `'live'` (default) \| `'sandbox'`. MVP: always `'live'`.                                                        |
| `created_at`              | TIMESTAMPTZ      |                                                                                                                 |
| `updated_at`              | TIMESTAMPTZ      |                                                                                                                 |

### Link Scope Filters

Every cross-link definition can include a scope filter constraining which target records appear in the link picker and are valid targets. **Primary mechanism for controlling fan-out.**

```jsonb
{
  "conditions": [
    { "field_id": "uuid", "operator": "in", "value": ["Active", "Pending"] }
  ],
  "logic": "and"
}
```

**Operators:** `eq`, `neq`, `in`, `not_in`, `contains`, `is_empty`, `is_not_empty`. Same evaluation engine as view filters.

**Where enforced:**

1. **Link picker UI:** Only matching records shown.
2. **API validation:** Invalid targets rejected on create/modify.
3. **Sync inbound:** Non-matching links flagged with `scope_mismatch: true` (not silently dropped).

**Scale guidance:** Cross-link to table with >10K records → setup wizard recommends adding scope filter.

### Cross-Link Field Value (in canonical JSONB)

```jsonb
{
  "type": "cross_link",
  "value": {
    "linked_records": [
      {
        "record_id": "uuid-of-target",
        "table_id": "uuid-of-target-table",
        "display_value": "Acme Corp",
        "_display_updated_at": "2026-02-12T10:30:00Z"
      }
    ],
    "cross_link_id": "uuid-of-definition"
  }
}
```

**`display_value` is denormalized.** Cached copy of target's display field, updated on change. Avoids join on grid render. Staleness bounded by sync interval (synced) or real-time (native).

### `cross_link_index` Table (Bidirectional Lookup)

| Column             | Type        | Purpose                 |
| ------------------ | ----------- | ----------------------- |
| `tenant_id`        | UUID        |                         |
| `cross_link_id`    | UUID        | Definition              |
| `source_record_id` | UUID        | Record holding the link |
| `source_table_id`  | UUID        | For cascade grouping    |
| `target_record_id` | UUID        | Record being linked to  |
| `created_at`       | TIMESTAMPTZ |                         |

**Indexes:** Composite on `(tenant_id, target_record_id, cross_link_id)` for reverse lookups. Composite on `(tenant_id, source_record_id, cross_link_id)` for forward lookups.

This is a **derived index** — rebuildable from `canonical_data`. Exists for query performance, not source of truth.

---

## Query-Time Resolution

### Level 0 — Grid View (No Join)

Grid reads denormalized `display_value` from `canonical_data`. **No join, no second query.** Grid treats it like text with a clickable chip.

**Performance:** Identical to any field. Cross-link cost is zero at render time — paid at write time via denormalization.

### Level 1 — Record View (Single Join)

When user clicks a linked record chip or opens Record View:

```
1. Read source record's cross_link field → get target record_ids
2. SELECT * FROM records WHERE tenant_id = $1 AND id = ANY($target_ids)
3. Return full target records for linked records panel
```

**Performance:** Single `IN` query. Fast for typical counts (1–20 links).

### Level 2 — Cross-Link Traversal (Bounded)

For features traversing links (e.g., "Client's Projects' Invoices"):

**Implementation: Iterative, not recursive SQL.** Application-layer bounded iteration:

```typescript
async function resolveLinkedRecords(
  tenantId: string,
  recordId: string,
  crossLinkId: string,
  maxDepth: number = 3,
): Promise<LinkedRecordTree> {
  let currentLevel = [recordId];
  const visited = new Set<string>([recordId]); // Cycle detection
  const tree: LinkedRecordTree = { root: recordId, levels: [] };

  for (let depth = 0; depth < maxDepth; depth++) {
    if (currentLevel.length === 0) break;
    const records = await dbRead
      .select()
      .from(recordsTable)
      .where(
        and(
          eq(recordsTable.tenantId, tenantId),
          inArray(recordsTable.id, currentLevel),
          isNull(recordsTable.deletedAt),
        ),
      );

    const nextLevel: string[] = [];
    for (const record of records) {
      const linkField = extractCrossLinkField(record.canonicalData, crossLinkId);
      if (linkField) {
        for (const linked of linkField.linked_records) {
          if (!visited.has(linked.record_id)) {
            visited.add(linked.record_id);
            nextLevel.push(linked.record_id);
          }
        }
      }
    }
    tree.levels.push({ depth, records });
    currentLevel = nextLevel;
  }
  return tree;
}
```

**Why not recursive SQL:** Recursive CTEs across JSONB are fragile. Iterative gives: explicit depth control, per-level batching, caching, clear profiling.

### Depth Limiting

- **Default: 3 levels.** Configurable per definition.
- **Hard cap: 5 levels.**
- **Circuit breaker:** >1,000 records at any level → stop, return truncated with warning.

### Cross-Link Permission Resolution

User's field permissions on the **target table** govern what they see — not source permissions. See `permissions.md`.

```
1. Determine target table of cross-link
2. Resolve user's field permissions on target table
3. Load card_fields from cross-link definition
4. Intersect: show only fields BOTH in card_fields AND permitted
5. Render card. If permitted < card fields, collapse gracefully
6. Zero permitted fields → minimal "Linked record" label
```

**Card fields are display preference, not permission.** Card is ceiling of what _could_ appear; permissions determine what _does_ appear.

**Permission resolution uses cached permission set** — no additional DB queries.

### Performance at Scale

| Scenario                        | Query Pattern                 | Expected     |
| ------------------------------- | ----------------------------- | ------------ |
| Grid with cross-link (50K rows) | Read display_value from JSONB | Same as text |
| Record View with 20 links       | Single IN query               | <50ms        |
| 2-level traversal, 20→100       | Two batch queries             | <200ms       |
| 3-level, 20→100→500             | Three batch queries           | <500ms       |

---

## Link Picker UX

### Search

tsvector prefix matching on target table's display field. Results paginated to 100 with scroll-to-load.

### Recent Section

Last 5 records linked by this user to this definition. Above search results. Disappears on active search.

### Inline Create

"+ New [target table name]" at bottom. Compact form with `card_fields`. Creates and links in one action.

### Single vs Multi-Link

- **Single-link** (`many_to_one`, `max_links: 1`): Click to select and close. Replace on change.
- **Multi-link** (`one_to_many`): Checkbox accumulation. Pills above search. "Done" confirms.

### Mobile

Bottom sheet: search, recent, results with card previews, inline create.

### `card_fields` Configuration

Configured during cross-link creation after picking target table. Step: "Which fields to show in previews?" Checkbox list. Recommend 3–5 fields. Stored as JSONB array of field IDs.

Used by: link picker, Record View linked records panel, permission resolution intersection.

---

## Display Value Maintenance

When target record's display field changes, all source records linking to it need `display_value` updated. **Background maintenance task.**

```
Target record updated
  → Check cross_link_index for entries
  → YES: Enqueue BullMQ job: update_cross_link_display_values
    → Read new display value
    → Batch-update source records' canonical_data
    → Publish real-time event per affected table
```

**Staleness window:** Typically <10s for native, sync interval + job time for synced. Acceptable — user sees correct value on click-through.

**Staleness signal:** Shimmer animation on in-flight chips (amber = processing). Resolves on cascade completion.

**Optimization:** Content hash on display value. If unchanged, skip cascade entirely (~70% of cases).

---

## Cross-Link + Sync Interaction

Cross-links work identically for synced and native tables — they operate on canonical JSONB. Sync engine is invisible to linking engine.

- **Synced → Synced:** Both tables in canonical form. Links in canonical overlay.
- **Synced → Native:** Identical. Linking engine doesn't know or care about source.

---

## Scalability

Cross-linking is the most write-amplifying feature. A single change can cascade to display value updates, index writes, and search vector recalculations.

### Display Value Cascade Fan-Out

**Mitigation at source:** `link_scope_filter` limits fan-out. 500K-record table filtered to Active (~5K) = 100× reduction.

**Batched cascade execution:**

```typescript
async function updateDisplayValues(targetRecordId: string, tenantId: string) {
  const newDisplayValue = await getDisplayValue(tenantId, targetRecordId);
  const oldHash = await getDisplayValueHash(tenantId, targetRecordId);
  if (hashString(newDisplayValue) === oldHash) return; // ~70% skip

  const affectedLinks = await db.select().from(crossLinkIndex)
    .where(and(eq(crossLinkIndex.tenantId, tenantId),
               eq(crossLinkIndex.targetRecordId, targetRecordId)));

  for (const chunk of chunks(affectedLinks, 500)) {
    await db.transaction(async (tx) => {
      for (const link of chunk) {
        await updateCanonicalDisplayValue(tx, { ... });
      }
    });
    await sleep(10); // Yield between chunks
  }

  // ONE batched event per affected table
  const tableIds = [...new Set(affectedLinks.map(l => l.sourceTableId))];
  for (const tableId of tableIds) {
    await publishToRedis(`t:${tenantId}:table:${tableId}`, {
      event: 'records.batch_updated',
      payload: { reason: 'display_value_refresh', count: affectedLinks.length },
    });
  }
}
```

**Fan-out limits:**

| Source Records | Strategy                           | Duration        |
| -------------- | ---------------------------------- | --------------- |
| ≤100           | Single transaction                 | ~50ms           |
| 100–10K        | Chunked async BullMQ               | Seconds         |
| 10K–100K       | Chunked, low priority, 100ms delay | Minutes         |
| >100K          | Admin alerted, background          | Tens of minutes |

### Cascade Concurrency Controls

**Per-tenant cascade concurrency: 2.** BullMQ group concurrency keyed on `tenantId`. Prevents lock-thrashing on overlapping source rows.

**Priority levels:**

| Trigger Source        | Priority   | Rationale                      |
| --------------------- | ---------- | ------------------------------ |
| User edit in UI       | `high` (1) | Immediate propagation expected |
| Sync batch            | `low` (10) | Background                     |
| Bulk deletion cleanup | `low` (10) | Background                     |

**Adaptive chunk delay:** 10ms default, increases to 50–100ms under lock contention.

### Single-Hop Cascade Rule

Cascades are **explicitly single-hop.** Display value cascade does NOT trigger further cascades. Events with `reason: 'display_value_refresh'` are ignored by the cascade trigger. Only `user_edit` and `sync_inbound` events trigger cascades.

**Known constraint:** Multi-hop display dependencies (A→B→C each using cross-link as display field) correct on next direct update or daily refresh. Documented and acceptable for MVP.

### Cascade Job Deduplication

**BullMQ jobId:** `crosslink:cascade:{tenantId}:{targetRecordId}`. Same target in queue = silently deduplicated. Eliminates 50%+ of cascade work during sync storms.

### Sync Backpressure

Before each sync poll, check cascade queue depth. If >500 pending jobs for tenant, skip this poll. Sync catches up next cycle.

**Implementation:** Redis counter `q:cascade:depth:{tenantId}`, single GET check.

### Bulk Deletion Cascade

```
Step 1: Soft-delete table immediately (single UPDATE)
  → Reverse lookups stop instantly (deleted_at IS NULL filter)
  → Chips show "(deleted)" badge

Step 2: Background job batches of 5,000
  → Update source records' canonical_data to remove dead links
  → Delete index entries
  → 50ms sleep between batches

Step 3: One real-time event per affected source table
```

### Display Value Update Ordering

**`_display_updated_at` version stamp.** Updates only apply if incoming timestamp is newer:

```sql
UPDATE records SET canonical_data = jsonb_set(...)
WHERE id = $source_record_id AND tenant_id = $tenant_id
  AND (_display_updated_at) < $target_updated_at;
```

Stale updates become no-ops. No locks — optimistic version check.

### Audit Log Condensation for Cascades

- **User action:** One audit entry with `record_ids` array.
- **System cascade:** One condensed entry per batch with `triggered_by` linking to user action.
- **No per-record entries** for cascade mutations.

### Cross-Link Index Sizing

| Tenant Size | Cross-Links | Records | Avg Links | Index Rows |
| ----------- | ----------- | ------- | --------- | ---------- |
| Small       | 3–5         | 500     | 3         | ~1,500     |
| Medium      | 10–20       | 10K     | 5         | ~50K       |
| Large       | 30–50       | 100K    | 8         | ~800K      |
| Enterprise  | 50–100      | 500K    | 10        | ~5M        |

Decision point: partition by `tenant_id` if >100M rows.

### Write Amplification During Sync

500-record sync batch × 10 links each:

- 500 canonical writes
- 5,000 index writes (diff-only — unchanged links = zero writes)
- 5,000 cascade checks (content hash eliminates ~70%)
- 500 search vector updates

All cascades deferred to BullMQ after sync commits.

### Index Consistency & Rebuild

**Weekly integrity check:** Samples per cross-link (100/500/1,000 by table size). >1% drift → full rebuild + admin alert.

**Event-driven checks:** Failed/timed-out cascade jobs trigger immediate integrity check.

**Rebuild:** Delete index entries for definition, scan source records in 1K batches, rebuild from canonical_data. 100K records ≈ 30s.

---

## Creation Constraints

| Constraint                  | Limit                                        | Rationale                                     |
| --------------------------- | -------------------------------------------- | --------------------------------------------- |
| Self-links (same table)     | Allowed                                      | Common: "Parent Task" linking to another task |
| Same-record links           | Blocked                                      | Validated at server                           |
| Max links per record        | `max_links_per_record` (default 50, cap 500) | Prevents unbounded fan-out                    |
| Max definitions per table   | 20                                           | Prevents complexity explosion                 |
| Cycle detection             | Allowed with depth limit                     | `visited` set in resolver                     |
| Bidirectional auto-creation | Optional                                     | Manager chooses during setup                  |
| Synced table as source      | Allowed                                      | Links in canonical overlay, not synced back   |

---

## Cross-Link Creation & Modification Permissions

Cross-links create mutual dependencies between tables. Creator must have authority over **both sides**.

### Creation Permissions

| Scenario                         | Who Can Create          |
| -------------------------------- | ----------------------- |
| Same Manager manages both tables | That Manager            |
| Different Managers with overlap  | The overlapping Manager |
| Different Managers, no overlap   | Admin or Owner only     |

### Structural vs Operational Changes

**Structural (topology-altering) — same authority as creation:**

- Change target table, relationship type, delete definition, remove reverse field

**Operational (tuning) — Manager of either table:**

- Adjust scope filter, change display field, rename, edit card_fields, adjust max_links

### Reverse Field Rules

- **Allowed from reverse side:** Rename, change icon, edit description.
- **Not allowed from reverse side:** Relationship type, scope filter, card_fields changes. Managed from source only.
- **Deletion:** Only through cross-link deletion flow from source.

### Cross-Boundary Deletion

When Manager lacks authority over both tables:

1. Notification to Admin/Owner with Approve/Reject buttons
2. Approve triggers deletion with full impact
3. Reject notifies requester

---

## Impact Analysis

### Three Tiers

**Tier 1 — Structural (high consequence):** Delete definition, delete target table, change target/relationship. Can break portals, automations, doc templates.

**Tier 2 — Data cascade (medium):** Edit target display field, bulk-edit targets, delete linked records. Propagate widely but don't break structure.

**Tier 3 — Link operations (low):** Add/remove links. Everyday. Inline context only.

### Impact Computation

```typescript
interface CrossLinkImpactAnalysis {
  affectedSourceRecords: number;
  affectedSourceTables: Array<{ tableId: string; tableName: string; recordCount: number }>;
  portals: Array<{ portalId: string; portalName: string }>;
  automations: Array<{ automationId: string; automationName: string }>;
  docTemplates: Array<{ templateId: string; templateName: string }>;
  estimatedCascadeRecords: number;
  estimatedCascadeDuration: 'seconds' | 'under_a_minute' | 'minutes' | 'tens_of_minutes';
  hasHighFanOut: boolean;
}
```

### UX by Tier

**Tier 1:** Modal with dependency list (affected portals, automations, templates with links). Confirmation requires typing cross-link name. Progress indicator during cleanup.

**Tier 2:** Lightweight banner: "Saving this will update ~2,400 linked records. May take 30 seconds." No blocking.

**Tier 3:** Inline context in link picker: scope filter indicator, record count, links used ("18 of 50").

---

## "Convert to Native Table" Migration

Migration path from synced companion to native EveryStack table. **Major, irreversible operation.**

### Pre-Conversion Impact

System computes and shows: record count, field count, cross-link count, portal bindings, automations, doc templates referencing this table, estimated duration.

### Worker Job Sequence

```
Step 1: Acquire advisory lock for table
Step 2: Snapshot sync state (if dual-write enabled)
Step 3: Deactivate sync (point of no return)
Step 4: Migrate field definitions (remove read-only, preserve provenance)
Step 5: Migrate records (batched 1K, strip source_refs, add provenance)
Step 6: Verify derived data (cross_link_index, search_vectors unchanged)
Step 7: Audit log
Step 8: Real-time notification to connected clients
Step 9: Release lock
```

**Steps 3–5 are NOT in single transaction** — large tables cause connection pool starvation. Step 3 commits immediately, steps 4–5 run in batches.

### Performance

| Records | Duration |
| ------- | -------- |
| 1K      | <1s      |
| 10K     | ~3s      |
| 50K     | ~12s     |
| 100K    | ~25s     |
| 500K    | ~2min    |

### Dual-Write Verification (Optional)

7-day period where sync continues to shadow table. Admin can view diff. Finalize or revert.

### UI Flow

1. Table settings → "Convert to Native Table" (synced tables only)
2. Impact analysis dialog
3. Optional dual-write toggle
4. Type workspace name to confirm
5. Progress bar during conversion
6. Completion: table header changes to "Native"

---

## Post-MVP Cross-Link Features

- **Rollup fields** — aggregate values from linked records (sum, count, avg, min, max)
- **Lookup fields** — pull specific field values from linked records
- **Formula fields** referencing cross-link values
- AI-assisted impact summaries (natural language narration of Tier 1 consequences)
