# Step 7 — Hierarchy & Entity Relationships: Findings

**Auditor:** Claude  
**Date:** 2026-03-01  
**Input tarball:** `everystack-post-step6-fixed.tar.gz`  
**Docs scanned:** 70 files  
**Canonical hierarchy source:** `GLOSSARY.md` lines 33–62

---

## Canonical Hierarchy (from GLOSSARY.md)

```
Tenant (organization — billing, identity, RLS boundary)
├── Boards (optional grouping of workspaces — permission convenience)
└── Workspaces (multi-platform table containers)
    ├── Tables (synced or native)
    │   ├── Table Views (Grid, Card — MVP; Kanban, List, etc. — post-MVP)
    │   │   └── My Views / Shared Views
    │   ├── Record View (overlay — configurable field canvas)
    │   │   └── Record Thread
    │   ├── Cross-Links (relationships across tables/workspaces/platforms)
    │   └── Fields (typed data columns)
    ├── Portals (externally-shared Record View)
    ├── Forms (Record View layout for creating records)
    ├── Automations (trigger → action flows)
    └── Documents (merge-tag templates → PDF)
```

---

## Summary

| Check | Scanned | Findings | Fixed | Informational |
|-------|---------|----------|-------|---------------|
| 1. Missing levels | All docs | 0 | — | — |
| 2. Extra levels | All docs | 2 (1 root cause) | 3 | 0 |
| 3. Wrong nesting | All docs | 0 | — | — |
| 4. Naming consistency | All docs | 2 (same root cause) | 2 | 2 |
| 5. Permissions alignment | `permissions.md` vs hierarchy | 0 | — | 1 |
| **Totals** | | **4 issues (7 locations)** | **5** | **3** |

---

## Findings

### Finding 1 — "Base" used as hierarchy level instead of "Base Connection grouping" (FIXED)

**Root cause:** Several docs use "Base" as a standalone hierarchy label between Board/Workspace and Table. GLOSSARY defines `Base Connection` as "a configured connection to an external platform base/workspace" — it's a sync concept, not a hierarchy level. The canonical ownership hierarchy is Tenant → Board → Workspace → Table.

| # | File | Line(s) | What It Said | Fix Applied | GLOSSARY Standard |
|---|------|---------|-------------|-------------|-------------------|
| 1 | `field-groups.md` | 363 | Warning note referenced "Board → Base → Table hierarchy" | Rewritten to clarify Base Connection = UI grouping, not hierarchy level | Tenant → Board → Workspace → Table |
| 2 | `field-groups.md` | 370 | Diagram annotation: "← Base (collapsible via Sections)" | → "← Base Connection grouping (collapsible via Sections)" | Base Connection = sync concept |
| 3 | `field-groups.md` | 376 | Diagram annotation: "← Base" | → "← Base Connection grouping" | Base Connection = sync concept |
| 4 | `workspace-map.md` | 216 | TypeScript: `base_id: string; // Parent base` | → `base_connection_id: string; // Parent base connection` | `base_connections` table in data-model.md |
| 5 | `workspace-map.md` | 1580 | "addEdges for parent base" | → "addEdges for parent base connection" | Base Connection terminology |

### Finding 2 — SDS uses `base_id` shorthand (INFORMATIONAL — no fix)

`schema-descriptor-service.md` lines 92, 133, 290 use `base_id` in JSON output structure. Line 83 already explains: "In SDS output, `bases` refers to connected external platform bases (Airtable bases, SmartSuite workspaces, Notion databases) — these correspond to **Base Connection** entities in the DB (`base_connections` table)."

**No fix applied.** This is an intentional API contract choice — shorter keys for LLM token efficiency. The mapping is explicitly documented.

### Finding 3 — `gaps/tables-views-boundaries.md` uses historical `base_id` (INFORMATIONAL — no fix)

Line 296 references `base_id` in a historical schema. This doc is marked SUPERSEDED and not used for new work.

### Finding 4 — Form permissions not in `permissions.md` (INFORMATIONAL — not a gap)

`permissions.md` does not cover Quick Form access control. However, `forms.md` lines 17, 124, 147–148 document the access model: public or link-gated (no workspace membership required). Form submission intentionally bypasses the workspace role system — anyone with the URL can submit. Created records inherit normal table permissions. This is by design, not an omission.

---

## Checks with Zero Findings

### Check 1 — Missing Levels ✅

No doc skips hierarchy levels. Every doc that describes the Tenant→Table path includes Workspaces.

### Check 3 — Wrong Nesting ✅

No doc reverses parent-child relationships. Tables are always inside Workspaces, Fields inside Tables, Views inside Tables.

### Check 5 — Permissions Alignment ✅

Every hierarchy level with permissions is covered in `permissions.md`:

| Level | Coverage in `permissions.md` |
|-------|------------------------------|
| Tenant | RLS boundary, `tenant_id` on every query |
| Board | Board membership cascade (line 264) |
| Workspace | `workspace_memberships` with 5 roles |
| Table View | Access boundary for Team Members/Viewers |
| Field | Three-state per user: read-write, read-only, hidden |
| Record | View filters + field-level controls |
| Portal | Covered via portal auth model (magic link / password) |
| Form | Intentionally public/link-gated — see `forms.md` |

---

## Files Modified

| File | Changes |
|------|---------|
| `field-groups.md` | Lines 363, 370, 376: "Base" hierarchy label → "Base Connection grouping". Warning note rewritten. |
| `workspace-map.md` | Lines 216, 1580: `base_id` → `base_connection_id`, "parent base" → "parent base connection". |
