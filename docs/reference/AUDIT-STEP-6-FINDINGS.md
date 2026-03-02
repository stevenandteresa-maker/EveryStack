# Step 6 — Scope & Roadmap Alignment: Findings

**Auditor:** Claude  
**Date:** 2026-03-01  
**Input tarball:** `everystack-post-step5-fixed.tar.gz`  
**Docs scanned:** 69 files  
**Canonical scope source:** `GLOSSARY.md` §MVP Scope Summary + §MVP Explicitly Excludes, `CLAUDE.md` §Scope Labels

---

## Summary

| Check                                | Scanned            | Findings                        | Fixed  | Decision Required |
| ------------------------------------ | ------------------ | ------------------------------- | ------ | ----------------- |
| 1. Scope conflicts (doc vs GLOSSARY) | All docs           | 3 root conflicts (12 locations) | 12     | 0                 |
| 2. Internal scope contradictions     | All docs           | 2                               | 2      | 0                 |
| 3. Missing scope labels              | All docs           | 0                               | —      | —                 |
| 4. Scope label format                | All docs           | 0                               | —      | —                 |
| 5. Dependency ordering               | All roadmap tables | 1                               | 1      | 0                 |
| **Totals**                           |                    | **6 issues (15 locations)**     | **15** | **0**             |

**All findings resolved.** Decisions applied:

- Kanban View: stays post-MVP → `chart-blocks.md` NumberCard retagged, `mobile.md` Kanban row moved
- Calendar View: stays post-MVP → `booking-scheduling.md`, `meetings.md`, `mobile.md` rows retagged
- File Embeddings: scope split in GLOSSARY → embedding generation MVP, semantic search UX post-MVP

---

## Canonical Scope Labels (from CLAUDE.md)

**MVP:** MVP — Foundation, MVP — Sync, MVP — Core UX, MVP — AI, MVP — API

**Post-MVP:** Post-MVP — Portals & Apps, Post-MVP — Documents, Post-MVP — Automations, Post-MVP — Comms & Polish, Post-MVP — Verticals & Advanced, Post-MVP — Custom Apps, Post-MVP — Self-Hosted AI

---

## Findings

### Finding 1 — Kanban View: 6 docs say MVP, GLOSSARY says Post-MVP

**GLOSSARY.md:678:** `Kanban, Gantt, Calendar, List, Gallery views | Post-MVP (Kanban soon after MVP)`

**data-model.md:53:** `view_type (VARCHAR: grid|card — MVP; kanban|list|gantt|calendar|gallery|smart_doc — reserved post-MVP)`

| File              | Line(s) | What It Says                                                             | Issue              |
| ----------------- | ------- | ------------------------------------------------------------------------ | ------------------ |
| `chart-blocks.md` | 912     | "NumberCard.tsx ships in MVP — Core UX as part of Kanban view"           | Tags Kanban as MVP |
| `chart-blocks.md` | 943     | Roadmap: "MVP — Core UX \| NumberCard.tsx...Used in Kanban view"         | Tags Kanban as MVP |
| `chart-blocks.md` | 949     | Section header: "MVP — Core UX Scope (Minimal — Ships with Kanban View)" | Tags Kanban as MVP |
| `chart-blocks.md` | 1011    | "shipping with Kanban view in MVP — Core UX"                             | Tags Kanban as MVP |
| `chart-blocks.md` | 1122    | "Kanban view computes aggregate values locally...MVP — Core UX"          | Tags Kanban as MVP |
| `mobile.md`       | 1207    | Roadmap: "MVP — Core UX \| **Kanban view** on mobile"                    | Tags Kanban as MVP |

**Note:** `mobile.md` reconciliation note (line 7) says "Tagged post-MVP features per glossary: Kanban View, Calendar View" — but the roadmap table at line 1207 still lists them under MVP — Core UX. The reconciler flagged the conflict but didn't resolve it in the table.

**Note:** `chart-blocks.md` has NO acknowledgment that Kanban is post-MVP. Its entire MVP scope section is premised on Kanban existing.

**Decision needed:** Should Kanban move into MVP — Core UX (update GLOSSARY), or should `chart-blocks.md` retag NumberCard as post-MVP?

---

### Finding 2 — Calendar View: 3 docs say MVP, GLOSSARY says Post-MVP

**GLOSSARY.md:678:** (same row as Kanban — Calendar views are Post-MVP)

| File                    | Line(s) | What It Says                                                                              | Issue                     |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------- | ------------------------- |
| `booking-scheduling.md` | 1090    | Roadmap: "MVP — Core UX \| Calendar View architecture (day/week/month grid rendering...)" | Tags Calendar View as MVP |
| `meetings.md`           | 600     | Roadmap: "MVP — Core UX \| Calendar View with Schedule mode"                              | Tags Calendar View as MVP |
| `mobile.md`             | 1207    | Roadmap: "MVP — Core UX \| **Calendar view** (month/week/day)"                            | Tags Calendar View as MVP |

**Internal contradiction in `booking-scheduling.md`:** The banner at line 3 says "Calendar View (day/week/month) is also post-MVP per GLOSSARY" — but the roadmap table at line 1090 uses "MVP — Core UX" for Calendar View architecture.

**Internal contradiction in `meetings.md`:** The banner at line 5 says "do not build the Meetings feature set until post-MVP" — but the roadmap table at line 600 uses "MVP — Core UX" for meeting capabilities including Calendar View.

**Decision needed:** Should Calendar View move into MVP — Core UX (update GLOSSARY), or should these docs retag Calendar View rows as post-MVP?

---

### Finding 3 — Vector Embeddings: doc says MVP, GLOSSARY says Post-MVP

**GLOSSARY.md:685:** `Vector embeddings / semantic search | Post-MVP`

| File                       | Line(s) | What It Says                                                                                             | Issue                  |
| -------------------------- | ------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| `document-intelligence.md` | 63      | "file.embed_content ← Vector embedding of extracted text (MVP — Core UX)"                                | Tags embeddings as MVP |
| `document-intelligence.md` | 693     | Roadmap: "MVP — Core UX \| **Activate content embeddings:** file.embed_content job generates embeddings" | Tags embeddings as MVP |

**Internal contradiction in `document-intelligence.md`:** Line 28 section index says "semantic search explicitly post-MVP per glossary" and line 470 says "Post-MVP — vector embeddings / semantic search explicitly listed as post-MVP in glossary" — but lines 63 and 693 tag `file.embed_content` as MVP — Core UX.

**Decision needed:** Should file content embeddings move into MVP — Core UX (update GLOSSARY to separate file embeddings from full semantic search), or should `document-intelligence.md` retag embed_content as post-MVP?

---

### Finding 4 — meetings.md: Post-MVP banner contradicts MVP roadmap labels

Already captured under Finding 2, but noting as a standalone internal contradiction:

- **Line 5:** "⚠️ POST-MVP FEATURE... do not build the Meetings feature set until post-MVP"
- **Line 600:** "**MVP — Core UX** | meeting_table_config overlay. Auto-created fields..."

The roadmap table appears to use MVP scope labels as _relative_ sequencing within the post-MVP build (i.e., "this is the first thing to build when we get to meetings"). But Claude Code reads "MVP — Core UX" literally.

---

### Finding 5 — chart-blocks.md NumberCard depends on post-MVP Kanban

`chart-blocks.md:943` roadmap row: "**MVP — Core UX** | NumberCard.tsx component. | **Depends On:** Kanban view, design system"

If Kanban stays post-MVP, NumberCard cannot ship in MVP — Core UX because its only consumer doesn't exist yet. The component itself is standalone (no Kanban dependency in code), but without Kanban there's no place to render it.

**Decision needed:** Same as Finding 1 — if Kanban moves to MVP, this resolves. If Kanban stays post-MVP, NumberCard's scope label should change to match.

---

## Checks with Zero Findings

### Check 2 — Internal Scope Contradictions ✅ (beyond the 2 noted above)

No docs assign conflicting scopes to the same feature in different sections, other than the GLOSSARY-vs-roadmap conflicts already captured in Findings 1–3.

### Check 3 — Missing Scope Labels ✅

Every reference doc has scope assignments. Checked:

- `design-system.md` — Cross-cutting concern, uses inline "(post-MVP)" tags on individual features rather than a roadmap table. Appropriate for a horizontal doc.
- `command-bar.md` — Has "Slash Command Catalog (MVP)" section and post-MVP deferred list.
- `cross-linking.md` — Core MVP feature. Post-MVP section clearly labeled.
- `tables-and-views.md` — Has "(post-MVP; Grid for MVP)" tags on non-MVP view types.
- `smart-docs.md` — Banner clearly separates MVP Document Templates from post-MVP Smart Doc.
- `gaps/portals-client-auth.md` — Merged doc, content in `app-designer.md`.

### Check 4 — Scope Label Format ✅

All scope labels use canonical format. Two "v2" hits are false positives:

- `platform-api.md:208` — API version bump ("version bump to `v2`"), not a scope label
- `vector-embeddings.md:100` — ML model name (`all-MiniLM-L6-v2`), not a scope label

No "Phase 2", "Future", "v2", or freeform scope labels found.

---

## Decision Summary

Three scope questions for you to decide. Each has two resolution paths:

| #   | Feature         | Option A: Move to MVP                                                      | Option B: Keep Post-MVP                                                                   |
| --- | --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | Kanban View     | Update GLOSSARY:678. Fix `chart-blocks.md` dependency chain.               | Retag `chart-blocks.md` NumberCard + `mobile.md` Kanban as post-MVP.                      |
| 2   | Calendar View   | Update GLOSSARY:678.                                                       | Retag `booking-scheduling.md`, `meetings.md`, `mobile.md` Calendar View rows as post-MVP. |
| 3   | File Embeddings | Update GLOSSARY:685 to separate file embeddings from full semantic search. | Retag `document-intelligence.md` embed_content as post-MVP.                               |

Once you decide, I can apply the fixes in either direction.

---

## Files Modified

| File                    | Changes                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chart-blocks.md`       | Lines 7, 912, 943, 949–960, 1009, 1103, 1120: Retagged NumberCard as Post-MVP — Portals & Apps (ships with Kanban). ProgressChart stays MVP — Core UX.                                                              |
| `mobile.md`             | Line 1207: Moved Kanban view + Calendar view from MVP — Core UX row to new Post-MVP — Portals & Apps (View Types) row.                                                                                              |
| `booking-scheduling.md` | Line 1090: Retagged Calendar View architecture row from MVP — Core UX to Post-MVP — Portals & Apps (Calendar View).                                                                                                 |
| `meetings.md`           | Lines 600–606: Retagged roadmap from MVP — Core UX to Post-MVP — Portals & Apps (Meetings Foundation). Section header updated.                                                                                      |
| `GLOSSARY.md`           | Line 685: Split vector embeddings scope — file content embedding generation ships MVP — Core UX; semantic search UX is post-MVP.                                                                                    |
| `MANIFEST.md`           | Updated `chart-blocks.md` line count (1448→1446) and scope description. Updated `mobile.md` line count (1231→1232). Moved `meetings.md` from MVP — Core UX to Post-MVP — Portals & Apps in Reference Doc Scope Map. |

## Verification Commands

```bash
tar xzf everystack-post-step6-fixed.tar.gz

# Verify no "MVP — Core UX" + "Kanban" outside reconciliation notes
grep -rn "MVP.*Core.*Kanban\|Kanban.*MVP.*Core" *.md gaps/*.md | grep -v AUDIT | grep -v session-log | grep -v "[Rr]econciliation"

# Verify no "MVP — Core UX" Calendar View outside reconciliation notes
grep -rn "MVP.*Core.*Calendar View\|Calendar View.*MVP.*Core" *.md gaps/*.md | grep -v AUDIT | grep -v session-log | grep -v "[Rr]econciliation"

# Verify GLOSSARY file embeddings split
grep "Vector embeddings" GLOSSARY.md

# Verify meetings.md no longer in MVP scope map
grep "MVP — Core UX" MANIFEST.md | grep -v meetings
```
