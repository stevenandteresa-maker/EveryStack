# Modifications Manifest

Per-session changelog of files created, modified, and deleted during builds.
This file bridges the Build Agent (Step 3) and Docs Agent (Step 5) — it
replaces the need to reconstruct changes from `git diff` after the fact.

## How to Use This File

**Who writes:** Build Agent (Step 3), at the end of each build session.
**Who reads:** Reviewer Agent (Step 4) to cross-check the diff, Docs Agent
(Step 5) to drive MANIFEST updates and glossary scans, Planner to assess
completed work.
**When to write:** After each build session completes (whether it passes
review or not). Append a new session block.
**When to reset:** After Step 5 (Docs Sync) merges, the Docs Agent moves
completed session blocks to an archive section at the bottom. The active
section always shows only unsynced sessions.

### Session Block Format

```
## [Session ID] — [Sub-phase ID] — [Branch Name]

**Date:** YYYY-MM-DD
**Status:** built | passed-review | failed-review | docs-synced
**Prompt(s):** [Which playbook prompt(s) this session executed]

### Files Created
- `path/to/new-file.ts` — [1-line description of what it is]

### Files Modified
- `path/to/existing-file.ts` — [1-line description of what changed]

### Files Deleted
- `path/to/removed-file.ts` — [1-line reason for removal]

### Schema Changes
- Added table: `table_name` — [1-line description]
- Added column: `table_name.column_name` — [type, purpose]
- Modified column: `table_name.column_name` — [what changed]

### New Domain Terms Introduced
- `TermName` — [brief definition, for Docs Agent to add to GLOSSARY.md]

### Notes
[Any context the Docs Agent or next session needs. Optional.]
```

### Status Transitions

```
built → passed-review → docs-synced (happy path)
built → failed-review → built (retry after fixes)
```

---

## Active Sessions

<!-- Build Agent appends new session blocks here. -->

---

## Archive

<!-- Docs Agent moves completed (docs-synced) session blocks here
     during Step 5, newest first. This keeps the active section
     focused on unsynced work. -->
