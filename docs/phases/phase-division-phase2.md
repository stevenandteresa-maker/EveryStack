# Phase 2: MVP — Sync — Sub-Phase Division

## Summary
- Sub-phases: 3
- Estimated total prompts: 36
- Phase 1 dependencies: 1A (monorepo/CI), 1B (database schema), 1C (auth/roles), 1D (observability), 1E (testing), 1F (design system), 1G (BullMQ worker + real-time scaffold), 1I (audit log helper)

### Key Subdivision Decision: FieldTypeRegistry

The FieldTypeRegistry does **not** get its own sub-phase. Analysis of `sync-engine.md` shows the registry (lines 69–87, only 19 lines) is tightly coupled to the adapter layer — the `FieldTransform` interface defines `toCanonical`/`fromCanonical` per-platform per-field-type, and the registry lives in `packages/shared/sync/field-registry.ts` alongside the adapters. The registry is populated *as part of* building each adapter, not independently. It belongs with the first adapter (Airtable) in 2A, where both the pattern and initial registrations are proven together.

### SmartSuite Adapter Deferral

Per `sync-engine.md` Phase Implementation (line 1079): "MVP — Core UX: SmartSuite adapter." SmartSuite is explicitly deferred to Phase 3, not Phase 2. Phase 2 ships Airtable (2A) and Notion (2C) — two adapters are sufficient to validate the multi-platform pattern.

---

## Sub-Phases

### 2A — FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter

**One-sentence scope:** Builds the FieldTypeRegistry with canonical JSONB shapes for all MVP field types, the Airtable adapter pair, the sync setup wizard, progressive initial sync via BullMQ, and the rate limit infrastructure.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| sync-engine.md | Core Pattern, Source References, Field Type Registry, Sync Setup & Table Selection, Performance Strategy (Layer 1 only), External API Rate Limit Management (registry + token bucket) | 30–416, 459–513 | ~449 |

**Total reference lines:** ~449

**Scope Boundaries:**
- **Includes:** `FieldTransform` interface (`toCanonical`, `fromCanonical`, `isLossless`, `supportedOperations`), `FieldTypeRegistry` singleton in `packages/shared/sync/field-registry.ts`, canonical JSONB shapes for ~40 MVP field types (text, number, date, checkbox, single_select, multi_select, attachment, user, link, formula, lookup, rollup, etc.), `source_refs` map pattern for lossless round-tripping (per-platform identifiers preserved in canonical form), `toCanonical()`/`fromCanonical()` core framework, `AirtableAdapter` full implementation (per-field-type transforms both directions), lossy field marking (`isLossless: false` for Lookup, Rollup — treated as read-only with lock icon), Airtable OAuth flow + token storage on `base_connections`, sync setup wizard UI (3-step: authenticate → select base → select tables + configure filters), `SyncConfig`/`SyncTableConfig` JSONB shape on `base_connections.sync_config`, `FilterRule[]` grammar (shared with grid view filters), two-phase filter bootstrapping (platform field IDs during wizard → remap to ES field IDs after schema sync), platform filter pushdown for Airtable (`filterByFormula` translation), estimated record count fetching, progressive initial sync BullMQ pipeline (schema first → first page interactive → background remainder with progress indicator), record quota enforcement (setup wizard preventive check + runtime batch check + Redis quota cache at `quota:records:{tenantId}`), `PlatformRateLimits` config interface + Airtable rate limit registration (5 req/s per base, 50 req/s per API key), Redis token-bucket rate limiter (ZSET per key, scored by timestamp, atomic Lua script), sync orphan detection + orphan UX (delete orphaned / keep as local-only / undo filter change), `RecordSyncMetadata` JSONB shape (`sync_status: 'active' | 'orphaned'`), cross-links to filtered-out records (`filtered_out` flag in canonical_data), modifying sync filters after setup (save & re-sync flow)
- **Excludes:** JSONB expression indexes (2B), outbound sync (2B), conflict detection/resolution (2B), Notion adapter (2C), SmartSuite adapter (Phase 3 — Core UX), priority-based scheduling P0–P3 (2C), multi-tenant fairness (2C), sync settings dashboard (2C), error recovery flows (2C), grid cell rendering (Phase 3), schema sync change detection (2C)
- **Creates schema for:** None (all tables defined in Phase 1B — `base_connections`, `tables`, `fields`, `records`, `synced_field_mappings` already exist)

**Dependencies:**
- **Depends on:** 1A (monorepo + Docker Compose), 1B (base_connections, tables, fields, records schemas), 1C (Clerk auth for tenant context + OAuth token storage), 1D (Pino logging + traceId for sync jobs), 1E (test factories + `testTenantIsolation()` for sync testing), 1G (BullMQ worker skeleton for sync job processing)
- **Unlocks:** 2B (canonical data present in DB for grid reading + outbound sync), 2C (adapter pattern established for Notion), Phase 3 (FieldTypeRegistry consumed by all cell renderers and field type operations)
- **Cross-phase deps:** 1A, 1B, 1C, 1D, 1E, 1G

**Sizing:**
- **Estimated prompts:** 13
- **Complexity:** High
- **Key risk:** Field type canonical shape design — getting the ~40 field type JSONB shapes right affects every downstream feature (cell renderers, forms, portals, AI data contract); changes later require data migration

**Existing Roadmaps:**
- sync-engine.md Phase Implementation (line 1076): "MVP — Sync, Weeks 5–6: Canonical data model, Airtable adapter, FieldTypeRegistry, progressive initial sync, rate limit registry, Redis token bucket"

---

### 2B — Synced Data Performance, Outbound Sync, Conflict Resolution

**One-sentence scope:** Delivers bidirectional sync by adding JSONB expression indexes for grid query performance, the outbound sync pipeline with optimistic UI, and the full conflict detection-resolution system with grid rendering and real-time push.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| sync-engine.md | Synced Data Performance Strategy (Layers 2–6), Conflict Resolution UX (full section) | 417–458, 514–772 | ~300 |
| database-scaling.md | JSONB Expression Indexes | 486–498 | ~13 |

**Total reference lines:** ~313

**Scope Boundaries:**
- **Includes:** JSONB expression indexes on `canonical_data` for frequently sorted/filtered field paths (`CREATE INDEX CONCURRENTLY` on JSONB path expressions), `record_cells` decision point documentation (trigger: JSONB indexes fail <200ms at 50K+ records), optimistic UI for synced table cell edits (local JSONB update → instant grid re-render → queue outbound), outbound sync BullMQ job (read canonical_data → `fromCanonical()` via Airtable adapter → platform API write), three-way conflict detection on inbound sync (compare inbound platform value vs `last_synced_value` vs current `canonical_data`), `sync_conflicts` table population, default last-write-wins resolution (inbound wins, local value preserved in conflict record for recovery), manual conflict resolution mode toggle per synced table, manual resolution modal UI (single-field: Keep EveryStack / Keep Remote / Edit merged; multi-field: scrollable list with per-field and bulk actions), grid-level conflict rendering (4px amber triangle in cell top-right, dashed amber underline, row index amber badge ⚠️, toolbar conflict count badge with click-to-filter), role visibility rules (Owner/Admin/Manager: full resolution UI; Team Member: sees amber indicator + tooltip, cannot resolve; Viewer: no indicator), real-time conflict push (worker writes conflict → Redis pub/sub `t:{tenantId}:table:{tableId}` → `sync.conflict_detected` event → client updates `_conflicts` map → cell re-renders without page reload), conflict resolution Server Action (update `sync_conflicts.status` + update `records.canonical_data` + emit `sync.conflict_resolved` + `record.updated` events), optimistic resolution with 8-second undo toast (revert: conflict status → pending, canonical_data restored, outbound sync cancelled), outbound sync auto-enqueue on "Keep EveryStack" or merged resolution (P1 priority), bulk conflict resolution ("Resolve All: Keep EveryStack" / "Resolve All: Keep Remote"), mobile conflict resolution (tablet: 360px centered overlay; phone: full-screen bottom sheet), conflict audit trail via `writeAuditLog()` (actor: user, action: `sync_conflict.resolved`), conflict interaction rules (automations run on currently applied value, cross-links show applied value, portals see resolved value with no conflict indicator, formulas recompute on resolution, tsvector re-indexes on resolution)
- **Excludes:** Smart polling / adaptive intervals (2C), priority-based job scheduling (2C), multi-tenant fairness (2C), Notion adapter (2C), sync error recovery flows (2C), sync settings dashboard (2C), schema change detection (2C), full grid view architecture with all view types (Phase 3 — 2B provides conflict overlays and JSONB performance layer), `record_cells` denormalization (Core UX optimization, if needed)
- **Creates schema for:** None (sync_conflicts defined in Phase 1B)

**Dependencies:**
- **Depends on:** 2A (FieldTypeRegistry, Airtable adapter, canonical data present in DB, rate limit infrastructure), 1F (shadcn/ui Dialog, Toast, Badge, Tooltip for conflict resolution UI), 1G (real-time service for conflict push events, BullMQ for outbound sync jobs), 1I (`writeAuditLog()` helper for conflict audit trail)
- **Unlocks:** 2C (conflict resolution system available for Notion adapter, outbound sync pipeline reusable), Phase 3 (grid views use conflict indicators, outbound sync available for all cell edits)
- **Cross-phase deps:** 1F, 1G, 1I

**Sizing:**
- **Estimated prompts:** 12
- **Complexity:** High
- **Key risk:** Conflict detection race conditions — timing windows between outbound sync dispatch and next inbound poll can create phantom conflicts if the outbound write hasn't propagated to the platform before the inbound poll reads

**Existing Roadmaps:**
- sync-engine.md Phase Implementation (lines 1077–1078): "MVP — Sync, Weeks 6–7: Grid rendering from JSONB, expression indexes, optimistic UI" and "MVP — Sync, Weeks 7–8: Outbound sync, conflict resolution"

---

### 2C — Notion Adapter, Error Recovery, Sync Dashboard

**One-sentence scope:** Completes the sync engine with the Notion adapter, smart polling with priority-based scheduling, all error recovery flows, the sync settings dashboard, and synced table tab badges.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| sync-engine.md | External API Rate Limit Management (Priority Scheduling + Multi-Tenant Fairness + Sync Status UI subsections), Sync Error Recovery UX, Schema Sync, Phase Implementation | 488–513, 773–1079 | ~332 |
| field-groups.md | Synced Table Tab Badges | 276–326 | ~51 |

**Total reference lines:** ~383

**Scope Boundaries:**
- **Includes:** `NotionAdapter` full implementation (`toCanonical`/`fromCanonical` per field type — Notion pages/databases/blocks model mapped to canonical shapes), Notion filter pushdown (Notion's `filter` parameter maps well to `FilterRule[]`), Notion rate limit registration (3 req/s per integration), smart polling with adaptive intervals (30s active viewing → 5min tab open but not visible → 30min workspace not accessed → event-driven with Airtable webhooks), converted table skip logic (check `base_connections.sync_status` before dispatching — `'converted'`/`'converted_finalized'` excluded, `'converted_dual_write'` writes to shadow only), priority-based scheduling (P0: outbound/webhook-triggered always dispatched; P1: active table polling dispatched >30% capacity; P2: non-visible table polling >50%; P3: inactive workspace polling >70%), multi-tenant fairness (round-robin within priority tier, per-tenant max 20% platform capacity, P0 exempt, plan tier does not affect freshness), 8 error categories with severity + auto-recovery classification (conflict/rate-limited/partial-failure/auth-expired/platform-unavailable/schema-mismatch/permission-denied/quota-exceeded), `ConnectionHealth`/`SyncError` types on `base_connections.health` JSONB, sync status indicators UI (table header badges: 🟢 active + recent / 🟡 stale/retrying / 🔴 error/auth-required / ⏸️ paused), staleness threshold (2× polling_interval), notification system for sync issues (in-app badge + push for conflicts, email for auth expired, escalation tiers for sustained downtime), auth expired recovery flow (detect 401/403 → mark `auth_required` → red badge → re-auth OAuth flow → immediate catch-up sync), partial failure recovery flow (`sync_failures` table population, Failures tab with retry/skip/edit-in-EveryStack per record, auto-retry 3× then `requires_manual_resolution`), platform unavailable recovery (exponential backoff: 1min → 5min → 15min → 1hr → 3hr → 6hr, then mark error, manual "Retry Now" resets backoff, "Pause Sync" option), schema mismatch recovery flow (`sync_schema_changes` table population, Schema Changes panel with accept/reject/archive/add actions, downstream impact analysis showing formula/automation/portal/cross-link counts), quota exceeded recovery flow (partial sync + notification + 4 resolution options: add filter / upgrade / delete records / disable tables), schema sync (field definitions synced separately, deleted external fields soft-archived), sync settings dashboard (6-tab layout: Overview + Tables & Filters + Conflicts + Failures + Schema Changes + History, "Sync Now" P0 button, "Pause Sync" / "Disconnect" controls, sync history table with per-run details), synced table platform badge (14×14px logo overlay at bottom-right of table type icon, 1px `contentBg` border, per-platform: Airtable/Notion logos, native = no badge), sync status indicator icon (6 health states: healthy/syncing/conflicts/paused/error/converted with colored icon + tooltip), badge + tab color independence (two independent visual channels)
- **Excludes:** SmartSuite adapter (deferred to Phase 3 — Core UX per sync-engine.md Phase Implementation), Airtable adapter (2A), outbound sync pipeline (2B), conflict resolution UI (2B), field groups feature (Core UX), board collapse behavior (Foundation), per-field emphasis and conditional cell coloring (Core UX), enhanced hide/show panel (Core UX)
- **Creates schema for:** None (sync_failures, sync_schema_changes defined in Phase 1B)

**Dependencies:**
- **Depends on:** 2A (adapter pattern established, FieldTypeRegistry with Airtable registrations, rate limit infrastructure with token bucket), 2B (outbound sync pipeline reused for Notion outbound, conflict resolution system available for Notion conflicts), 1F (shadcn/ui primitives for dashboard UI + badge components), 1G (BullMQ for sync scheduling jobs, real-time for sync status push to connected clients)
- **Unlocks:** Phase 3 (full sync operational with 2 platform adapters — grid/card views can display synced data, SmartSuite adapter ships in Core UX as third adapter)
- **Cross-phase deps:** 1F, 1G

**Sizing:**
- **Estimated prompts:** 11
- **Complexity:** Medium-High
- **Key risk:** Notion API model mismatch — Notion's hierarchical data model (pages contain blocks, databases contain pages with properties) differs fundamentally from Airtable's flat table model, making the adapter transformation layer significantly more complex than Airtable's

**Existing Roadmaps:**
- sync-engine.md Phase Implementation (line 1078): "MVP — Sync, Weeks 7–8: Notion adapter, smart polling, priority scheduling, multi-tenant fairness, backpressure sync status UI"

---

## Dependency Graph

```
Phase 1 (Foundation)
 ├── 1A (Monorepo/CI) ─────────────┐
 ├── 1B (Database) ────────────────┤
 ├── 1C (Auth/Roles) ─────────────┤
 ├── 1D (Observability) ──────────┤
 ├── 1E (Testing) ────────────────┤
 ├── 1F (Design System) ──────────┤
 ├── 1G (Real-time/Worker/Files) ─┤
 └── 1I (Audit/API Auth) ─────────┤
                                    │
                                    ▼
              2A (FieldTypeRegistry + Airtable Adapter)
               │
               ├── 2B (Performance + Outbound + Conflicts)
               │    │
               │    └── 2C (Notion + Error Recovery + Dashboard)
               │
               └─────── All unlock Phase 3 (Core UX)
```

**Sequential execution:** 2A → 2B → 2C. No parallelism within Phase 2 — each sub-phase depends on the previous. However, Phase 2 as a whole can begin as soon as the Phase 1 dependencies are met (1A through 1G + 1I), which can overlap with 1H (AI Service) and remaining 1F work since those aren't Phase 2 dependencies.

---

## Validation Checklist

- [x] Every sub-phase passes the one-sentence test (no "and" — verified)
- [x] No sub-phase exceeds 15 estimated prompts (max: 2A at 13)
- [x] No sub-phase needs 5+ reference docs (max: 2 docs in 2B and 2C)
- [x] Dependencies reference specific Phase 1 sub-phase numbers (1A, 1B, 1C, 1D, 1E, 1F, 1G, 1I — not just "Phase 1")
- [x] FieldTypeRegistry accounted for in 2A (registry + ~40 field type registrations + canonical JSONB shapes)
- [x] No post-MVP features in any "Includes" (verified: no Kanban, no formula engine, no App Designer, no SmartSuite adapter which is Core UX, no approval workflow conflict handling, no vector embeddings)
- [x] SmartSuite adapter correctly deferred to Phase 3 (Core UX) per sync-engine.md Phase Implementation
- [x] Total sub-phase count: 3
- [x] Total prompt estimate: 36 (13 + 12 + 11)
- [x] sync-engine.md sections split cleanly: Core Pattern + Source Refs + Registry + Setup + Progressive Sync + Rate Limit Infrastructure → 2A; Performance Layers 2–6 + Conflict Resolution → 2B; Priority Scheduling + Error Recovery + Schema Sync + Dashboard → 2C
- [x] database-scaling.md JSONB Expression Indexes section (486–498) assigned to 2B (grid query performance)
- [x] field-groups.md Synced Table Tab Badges section (276–326) assigned to 2C (sync dashboard); remaining field-groups sections correctly excluded (Core UX)
