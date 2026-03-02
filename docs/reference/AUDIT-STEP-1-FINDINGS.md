# Audit Step 1 — Anchor Verification: GLOSSARY.md

**Date:** 2026-03-01  
**Source file:** `GLOSSARY.md` (866 lines)  
**Goal:** Confirm GLOSSARY.md is internally consistent before using it to judge everything else.

---

## Summary

GLOSSARY.md is in **good shape overall** — definitions are clear, the hierarchy is well-documented, and the "Do NOT Use" table has solid coverage. However, there are **3 Moderate issues** that will cause cascading ambiguity across the doc set if left unresolved, and **7 Low issues** that are worth cleaning up to prevent confusion during the Claude Code build.

**Verdict:** Fix the 3 Moderate issues before proceeding to Step 2. The Low issues can be batched.

---

## Findings Table

| # | Line(s) | Issue | Severity | Suggested Fix |
|---|---------|-------|----------|---------------|
| 1 | 48 | **Concept map ambiguity: "post-MVP for most types."** The App Designer entry in the concept map says "separate full-screen tool — post-MVP for most types." The qualifier "for most types" implies some App Designer types might ship in MVP. This contradicts line 459 ("The App Designer is **post-MVP**") and line 665 ("App Designer (visual page builder) \| Post-MVP"). | **Moderate** | Change line 48 to: `App Designer (separate full-screen tool — post-MVP)`. Remove "for most types." The MVP surfaces (Quick Portals, Quick Forms) use the Record View layout engine, not the App Designer — this is already correctly stated on line 459. |
| 2 | 155–156, 671 | **Gallery view missing from MVP Explicitly Excludes list.** Line 156 lists Gallery as a post-MVP view type. Line 671 excludes "Kanban, Gantt, Calendar, List views" from MVP but omits Gallery. Every post-MVP view type should appear in the excludes list for completeness. | **Moderate** | Add Gallery to the excludes list on line 671: `"Kanban, Gantt, Calendar, List, Gallery views \| Post-MVP (Kanban soon after MVP)"` |
| 3 | 129–138, 155–156, 671, 679 | **table_type MVP scope is ambiguous.** The table_type table (lines 129–138) lists five types: `table`, `projects`, `calendar`, `documents`, `wiki`. Each non-standard type shows "Grid for MVP" as a fallback, implying these table_types exist at MVP with Grid as the default. However, "Wiki / Knowledge Base" is in the MVP Excludes (line 679), and there are no explicit statements about which table_type enum values ship in MVP. Similarly, `calendar` is ambiguous since "Booking / Scheduling" is excluded. | **Moderate** | Add a clear statement after line 139 stating which `table_type` values are MVP. Suggested: "**MVP table_types:** `table` and `projects`. Post-MVP: `calendar`, `documents`, `wiki`. All table_types use Grid view at MVP regardless." Then update the table to show only MVP types with Grid defaults, and move the rest to a "Post-MVP table_types" sub-table. Alternatively, if all five types DO ship at MVP (just with Grid defaults), say so explicitly and reconcile with the "Wiki / Knowledge Base" exclusion on line 679. |
| 4 | 137, 155–156 | **Smart Doc is an undefined view type.** Line 137 references "Smart Doc" as the default view for the `wiki` table_type, but Smart Doc does not appear in either the MVP view types (line 155: Grid, Card) or the post-MVP view types (line 156: Kanban, List, Gantt, Calendar, Gallery). | **Low** | Either add "Smart Doc" to the post-MVP view types list on line 156, or clarify that Smart Doc is not a view_type but a separate feature that wiki tables default to. If it belongs in the view_type enum, add it. |
| 5 | 503–505 | **Record Thread defined twice.** Defined fully at lines 188–196, then again at lines 503–505 with "See definition above under Workspace Level." Duplicate section headers could confuse automated doc parsing or Claude Code context scanning. | **Low** | Remove the ### Record Thread heading under Communications (line 503) and replace with a single inline note: "**Record Thread** — see Workspace Level definition above." Or consolidate to a single location with a cross-ref from the other. |
| 6 | 558, 646–659 | **Boards labeled "MVP scope" but absent from MVP Includes table.** The hierarchy example on line 558 says "Board: 'Client Work' (optional grouping — MVP scope)". But the MVP Includes table (lines 646–659) never mentions Boards. Boards should appear in the MVP Includes for consistency. | **Low** | Add Boards to the MVP Includes table under Foundation or Core UX: `"Boards (optional workspace grouping — permission convenience)"`. |
| 7 | 690–699 | **"base" (meaning workspace) not in the "Do NOT Use" table.** Line 118 notes workspaces are "analogous to 'bases' in Airtable" which is helpful context. But "base" used as a synonym for workspace in doc body text would confuse Claude Code. This is a known slip-in term (the audit plan itself identifies it). | **Low** | Add to the "Do NOT Use" table: `"base" (when meaning workspace) → **Workspace** — "Base" refers to external platform containers (Airtable bases). EveryStack containers are Workspaces.` |
| 8 | 753 | **`sections` table has no formal definition.** The DB Entity Quick Reference lists `sections` (line 753) with a parenthetical "(sidebar grouping)" but there is no ### Section definition in the Definitions sections. What is a Section? How does it relate to Tables in the sidebar? | **Low** | Add a brief definition in the Workspace Level definitions section: "### Section — An optional grouping of tables within a workspace sidebar. Sections are visual organizers — they don't affect permissions or data access. Tables can be dragged between sections or left ungrouped." Or similar, based on the actual intended behavior. |
| 9 | 716 | **`tables.environment` column undefined.** The DB Entity Quick Reference lists `environment` as a column on the `tables` table, but no definition or enum values are provided anywhere in GLOSSARY.md. What values can `environment` take? What does it control? | **Low** | Define the column. If it means `'production' \| 'sandbox'` or `'synced' \| 'native'`, state that explicitly. If it's legacy/unused, remove it from the Quick Reference. |
| 10 | 714–715 | **Inconsistent primary key strategy.** `tenant_memberships` (line 714) has an `id` surrogate key. `workspace_memberships` (line 715) uses a composite key (`user_id, tenant_id, workspace_id`) with no `id`. This isn't wrong, but the inconsistency is undocumented and could confuse Claude Code when generating migration schemas. | **Low** | Either add `id` to `workspace_memberships` for consistency, or add a brief note explaining the design choice: "workspace_memberships uses a composite primary key (user_id + workspace_id) because a user can only hold one role per workspace." |

---

## Resolution Priority

1. **Fix Issue #3 first** (table_type MVP scope) — this has the widest blast radius across other docs that reference table_types.
2. **Fix Issue #1** (concept map App Designer wording) — quick one-line edit, eliminates a common misreading.
3. **Fix Issue #2** (Gallery in excludes) — quick addition to the excludes table.
4. **Batch fix Issues #4–10** — these are all Low severity and can be done together.

---

## How to Apply Fixes

All fixes are in `GLOSSARY.md` only. No other files need changes for Step 1.

### Fix #1 — Line 48
**Find:** `├── App Designer (separate full-screen tool — post-MVP for most types)`  
**Replace with:** `├── App Designer (separate full-screen tool — post-MVP)`

### Fix #2 — Line 671
**Find:** `| Kanban, Gantt, Calendar, List views | Post-MVP (Kanban soon after MVP) |`  
**Replace with:** `| Kanban, Gantt, Calendar, List, Gallery views | Post-MVP (Kanban soon after MVP) |`

### Fix #3 — After line 139
**Insert after line 139** (after "Any view type is available on any table type."):

```
**MVP table_types:** `table`, `projects`. Both use Grid as the default view at MVP.

**Post-MVP table_types:** `calendar`, `documents`, `wiki`. These ship when their default view types (Calendar, Gallery, Smart Doc) become available. Until then, users who need calendar or document tables use the `table` type with appropriate fields.
```

If the intent is that ALL five table_types ship at MVP (with Grid fallback), instead insert:

```
**MVP availability:** All five table_types are available at MVP. Types whose preferred default view is post-MVP (calendar, documents, wiki) fall back to Grid view. The table_type still appears in the "new table" picker and sets appropriate field suggestions.
```

Then reconcile line 679 ("Wiki / Knowledge Base" exclusion) — either remove it from excludes or clarify that the exclusion refers to the Smart Doc view, not the table_type.

### Fix #4 — Line 156
**Find:** `**View types (post-MVP):** Kanban, List, Gantt, Calendar, Gallery.`  
**Replace with:** `**View types (post-MVP):** Kanban, List, Gantt, Calendar, Gallery, Smart Doc.`

### Fix #5 — Lines 503–505
**Find the section:**
```
### Record Thread

See definition above under Workspace Level. Record-scoped communication (comments, @mentions, activity) tied to a specific record. Opens alongside Record View.
```
**Replace with:**
```
**Record Thread** — See definition under Workspace Level above.
```

### Fix #6 — In the MVP Includes table (after line 651)
Add to the Foundation row or create a new row:
```
| **Organization** | Boards (optional workspace grouping), workspace/table CRUD, sidebar navigation |
```

### Fix #7 — In the "Do NOT Use" table (after line 699)
Add row:
```
| "base" (as synonym for workspace) | **Workspace** | "Base" refers to an external platform container (e.g., Airtable base). EveryStack's container is a Workspace. |
```

### Fix #8 — After line 575 (Workspace Technical definition)
Add:
```
### Section

An optional visual grouping of tables within a workspace's sidebar. Sections allow users to organize tables into named groups (e.g., "Client Data," "Operations"). Sections are presentational only — they do not affect permissions or data access. Tables can be ungrouped.
```

### Fix #9 — Line 716
Either define the column inline:
```
| Table | `tables` | id, tenant_id, workspace_id, name, table_type, tab_color, environment (synced\|native), created_by, created_at, updated_at |
```
Or remove `environment` if it's not needed and rely on the presence/absence of a `base_connection_id` relationship to determine sync status.

### Fix #10 — After line 715
Add a note:
```
*Note: `workspace_memberships` uses a composite primary key (`user_id` + `workspace_id`) — one role per user per workspace. No surrogate `id` column.*
```
