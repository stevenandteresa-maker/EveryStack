---
name: everystack-docs-sync
description: >
  Post-build documentation sync agent for EveryStack's six-step build lifecycle
  (Step 5). Use this skill for ANY session whose purpose is to bring
  documentation back into alignment with the codebase after a build. Triggers
  on: updating MANIFEST.md line counts, adding new GLOSSARY.md terms from
  a build, fixing stale cross-references, updating section indexes after line
  count changes, archiving MODIFICATIONS.md sessions, updating TASK-STATUS.md
  to docs-synced, or any work on a fix/post-*-docs-sync branch. Also use when
  the prompt references "Docs Agent", "Step 5", "docs sync", or "post-build
  documentation". If a prompt updates docs/ files based on what changed during
  a build and does NOT write application code, this skill applies. Never use
  this skill for doc prep (Step 0), build execution (Step 3), or review
  (Step 4).
---

# EveryStack Docs Agent Skill

This skill encodes the conventions and procedures for the Docs Agent —
the Step 5 operator in EveryStack's six-step build lifecycle. The Docs
Agent brings documentation back into alignment with the codebase after
a build completes. It prevents the slow drift that causes consistency
audit marathons.

## When to Use This Skill

- **Always** for Step 5 of any sub-phase lifecycle
- **Always** when creating or merging a `fix/post-*-docs-sync` branch
- **Always** when updating MANIFEST line counts after a build
- **Always** when scanning for new glossary terms introduced by a build
- **Always** when archiving state file sessions after a build
- **Never** for doc prep (use the Architect Agent skill)
- **Never** for build execution or code review

---

## Mandate

Bring documentation back into alignment with the codebase after a build.
Update MANIFEST.md line counts, check GLOSSARY.md for new terms introduced
in the build, verify cross-references, update section indexes, and archive
completed state file sessions. The Docs Agent is the final step in each
sub-phase lifecycle — it ensures the next sub-phase starts with accurate
docs and clean state files.

**Session type:** Claude Code (in the EveryStack monorepo)

**Branch ownership:** `fix/` branches only (specifically
`fix/post-<sub-phase>-docs-sync`).

---

## Authority Chain

When conventions conflict, resolve in this order:

1. `GLOSSARY.md` — naming, scope, definitions (ultimate source of truth)
2. `CLAUDE.md` (project root) — project-wide rules
3. `CONTRIBUTING.md` — branching conventions, commit format
4. This skill — Docs Agent–specific patterns and procedures
5. The Prompting Roadmap prompt — task-specific instructions for this sub-phase

---

## Context Loading Rules

### Always Load

1. **`MANIFEST.md`** (full) — The Docs Agent's primary working document.
   Every line count, scope label, and cross-reference field must be verified
   against the actual file state after the build.

2. **`GLOSSARY.md`** (full) — Must be checked for completeness. Any new
   domain terms introduced during the build need definitions here.

3. **`MODIFICATIONS.md`** (active sessions section) — The Docs Agent's
   primary input for understanding what changed during the build. Read
   the active session blocks to get: files created/modified/deleted,
   schema changes, and new domain terms introduced. This replaces the
   need to reconstruct changes from `git diff`.

4. **`TASK-STATUS.md`** — To update unit statuses to `docs-synced` and
   move completed sub-phases to the archive section.

### Load on Demand

- **Any reference doc that contains cross-references to files changed
  during the build** — If `data-model.md` was modified, load any doc
  that cross-references `data-model.md` to verify its references are
  still current.

### Never Load

- Application code for the purpose of understanding it (the Docs Agent
  only reads code file names, table names, function names, and component
  names — not implementation details)
- Playbooks or Prompting Roadmaps
- Subdivision docs (the Docs Agent doesn't need unit/contract context —
  it works from MODIFICATIONS.md and the actual file state)
- Skill files other than this one

---

## Procedure — Step by Step

When activated, the Docs Agent executes the following sequence. Every
step is mandatory.

### Step 5.1 — Create the Fix Branch

```bash
git checkout main && git pull origin main
git checkout -b fix/post-<sub-phase>-docs-sync
```

**Branch naming:**
- Always use the pattern `fix/post-<sub-phase>-docs-sync`
- Example: `fix/post-3c-docs-sync`, `fix/post-2b-docs-sync`
- Keep the sub-phase ID lowercase with hyphens

### Step 5.2 — Gather the Build Change List

**Primary source: MODIFICATIONS.md.** Read the active session blocks for
this sub-phase's build. These list every file created, modified, and
deleted, plus schema changes and new domain terms. This is faster and
more reliable than reconstructing from `git diff`.

**Verification source: `git diff`.** After reading MODIFICATIONS.md,
cross-check against the actual diff to catch anything the builder missed:

```bash
git diff --name-only main~1..main
```

Compare the diff's file list against the MODIFICATIONS.md session blocks.
If files appear in the diff but not in MODIFICATIONS.md, add them to your
working change list and note the discrepancy (the builder should improve
their logging discipline).

**Categorize the changes** (from MODIFICATIONS.md + diff verification):

- **Docs changed** — Any files under `docs/` that were modified during
  the build (uncommon but possible if a build prompt touched a skill file
  or convention doc).
- **Schema files changed** — Files in `packages/shared/db/schema/` —
  check MODIFICATIONS.md "Schema Changes" section for new table names.
- **Data access files changed** — Files in `apps/web/src/data/` or
  `packages/shared/` — check for new function names.
- **Component files changed** — Files in `apps/web/src/components/` —
  check for new component names and UI labels.
- **Migration files changed** — Files in `packages/shared/db/migrations/`
  — check for new tables or columns.

### Step 5.3 — Update MANIFEST.md Line Counts

This is the most common Docs Agent task. Builds frequently change doc
line counts (especially if the build touched skill files or if Step 0
made doc changes that shifted line counts).

**How to count lines:**

```bash
wc -l docs/reference/*.md
```

For each doc listed in MANIFEST.md:

1. Compare the MANIFEST's `Lines` column value to the actual `wc -l` output.
2. If they differ, update the MANIFEST entry to the actual count.
3. If the difference is significant (±20 lines or more), note this doc
   for section index verification in Step 5.6.

**MANIFEST update rules:**

- **Lines column:** Always the exact output of `wc -l`. No rounding,
  no estimates.
- **Has Index column** (if present): Set to `Yes` if the doc has a
  `## Section Index` table at the top. Set to `No` if it doesn't.
  If a doc just crossed the 500-line threshold, flag it for index
  creation in Step 5.6.
- **Scope column:** Do not change scope labels during docs sync. Scope
  changes are the Architect Agent's responsibility (Step 0).
- **Reconciled column:** Update to today's date for any doc whose
  MANIFEST entry was modified.
- **Key Content column:** Do not rewrite summaries during docs sync
  unless the build fundamentally changed what a doc covers (rare).
  If needed, make minimal updates only.
- **Cross-References column:** Update if the build introduced new
  doc-to-doc dependencies or if a referenced doc was renamed.

**Also update MANIFEST entries for state files and subdivision docs:**
- Check line counts for DECISIONS.md, MODIFICATIONS.md, TASK-STATUS.md
- Check line counts for any subdivision docs in `docs/subdivisions/`
- Update if changed.

### Step 5.4 — Check GLOSSARY.md for New Terms

**Primary source: MODIFICATIONS.md "New Domain Terms Introduced" sections.**
The builder has already identified new terms during the build. For each
term listed:

1. Check whether it already exists in `GLOSSARY.md`.
2. If it does: verify the existing definition is still accurate.
3. If it doesn't: add a glossary entry using the builder's provided
   definition as a starting point. Refine if needed.

**Verification source: diff scan.** After processing MODIFICATIONS.md
terms, scan the diff for terms the builder may have missed. Focus on:

1. **New table names** — Grep migration files and schema files:
   ```bash
   git diff main~1..main -- 'packages/shared/db/schema/*.ts' \
     'packages/shared/db/migrations/*.ts' | grep -E "^\+" | grep -iE "table\(|pgTable\("
   ```

2. **New exported function names** — Grep data access files:
   ```bash
   git diff main~1..main -- 'apps/web/src/data/*.ts' \
     'packages/shared/**/*.ts' | grep -E "^\+export (async )?function"
   ```

3. **New component names** — Grep component files:
   ```bash
   git diff main~1..main -- 'apps/web/src/components/**/*.tsx' \
     | grep -E "^\+export (default )?(function|const)"
   ```

4. **New translation keys** — Grep translation files:
   ```bash
   git diff main~1..main -- 'apps/web/messages/*.json' | grep "^\+"
   ```

5. **New concept names** — Any term that appears 3+ times in the diff
   and is used as a domain concept (not just a variable name).

**For each new term found in the diff but not in MODIFICATIONS.md:**
Add the glossary entry and note the gap for the builder's awareness.

**Glossary entry format:**

Follow the existing structure in `GLOSSARY.md`. Each entry must include:
- **Term name** (bold, canonical casing)
- **Definition** (1–3 sentences, clear and self-contained)
- **MVP scope** (if relevant — "MVP Includes" or "MVP Explicitly Excludes")
- **Cross-reference** to the relevant reference doc

**Rules for glossary additions:**
- Never add a term without a definition.
- Never add a definition that contradicts an existing entry.
- If unsure whether something qualifies as a domain term, err toward
  inclusion — it's easier to remove a redundant entry than to discover
  a missing one during a consistency audit.
- Use the same formatting and style as existing entries. Don't introduce
  new conventions.

### Step 5.5 — Verify Cross-References

Check all docs that reference files changed during the build.

**How to find affected docs:**

1. From the change list (Step 5.2), identify which reference docs were
   modified or are referenced by the changed files.
2. For each affected reference doc, search for `See [doc-name.md]`
   cross-reference patterns:
   ```bash
   grep -rn "See \[" docs/reference/ | grep "<changed-doc-name>"
   ```
3. Verify each cross-reference:
   - Does the referenced doc still exist at the stated path?
   - Does the referenced section still exist with that name?
   - If line ranges are cited, do they still point to the correct content?

**Fix stale cross-references by:**
- Updating the section name if it was renamed
- Updating line ranges if content shifted
- Removing the reference if the referenced content was deleted
- Adding `_(post-MVP)_` annotation if the reference now points to
  post-MVP content

### Step 5.6 — Update Section Indexes

Check any doc whose line count changed significantly (±20 lines) during
the build or during this docs sync session.

**When to update a section index:**

- The doc's total line count changed by ±20 lines or more
- A new section was added to the doc
- Sections were reordered within the doc
- The doc crossed the 500-line threshold and needs a new section index

**How to update:**

1. Open the doc and locate the `## Section Index` table.
2. For each section listed, verify the start and end line numbers:
   ```bash
   grep -n "^## " docs/reference/<doc-name>.md
   ```
3. Update line ranges to match actual positions.
4. If a new section was added, add a row to the index table.
5. If a section was removed, remove its row.

**When to create a new section index:**

If a doc grew past 500 lines and doesn't have a section index, create
one at the top of the file:

```markdown
## Section Index
| Section                    | Lines     |
|----------------------------|-----------|
| [First Section]            | NN–MM     |
| [Second Section]           | MM–PP     |
| ...                        | ...       |
```

Mark the doc as having an index in MANIFEST.md.

### Step 5.7 — Archive State File Sessions

After completing all documentation updates, archive the completed build
sessions in the state files.

**MODIFICATIONS.md:**

1. Find all session blocks in the "Active Sessions" section that belong
   to this sub-phase.
2. Update their Status from `passed-review` to `docs-synced`.
3. Move them to the "Archive" section (newest first within archive).
4. The Active Sessions section should be empty for this sub-phase after
   this step.

**TASK-STATUS.md:**

1. Find the sub-phase block in the "Active Sub-Phases" section.
2. Update all unit entries from `passed-review` to `docs-synced`.
3. Check the checkbox for each unit (change `- [ ]` to `- [x]`).
4. If ALL units in the sub-phase are now `docs-synced`:
   - Update the sub-phase's "Completed" date to today
   - Move the entire sub-phase block to "Completed Sub-Phases"

**DECISIONS.md:**

1. Review any entries from this sub-phase's build sessions.
2. No changes needed — DECISIONS.md entries are permanent. But note in
   the commit message if any entries should be considered for ADR
   promotion (this feeds the Planner's Gate 4 review).

### Step 5.8 — Commit, Review, and Merge

After completing all checks, updates, and state file archiving:

1. **Stage and commit:**
   ```bash
   git add -A
   git commit -m "docs: post-<sub-phase> docs sync (MANIFEST, GLOSSARY, cross-refs, state files)"
   ```

   Use area prefix `docs` and include the sub-phase identifier. Examples:
   ```
   docs: post-3c docs sync (MANIFEST, GLOSSARY, cross-refs, state files)
   docs: post-2b docs sync (MANIFEST line counts, 3 new glossary terms, state archive)
   ```

2. **Push the branch:**
   ```bash
   git push origin fix/post-<sub-phase>-docs-sync
   ```

3. **Self-review the diff:**
   ```bash
   git diff main...fix/post-<sub-phase>-docs-sync
   ```
   Verify:
   - MANIFEST line counts match actual `wc -l` output
   - No stale cross-references remain
   - No new domain terms missing from GLOSSARY.md
   - Section indexes updated where needed
   - MODIFICATIONS.md active sessions archived
   - TASK-STATUS.md units show `docs-synced`
   - No application code was modified

4. **Open a PR** titled `[Step 5] Phase <X> — Post-Build Docs Sync`.

5. **Merge to `main`** using squash merge. Delete the branch.

### Step 5.9 — Tag If Milestone

After merging the docs sync branch, check whether this sub-phase
completes a major phase or milestone.

**Tag when:**
- All sub-phases in a major phase are complete
- A significant architectural pivot is finalized
- You want a snapshot you might need to return to

**Tag format:**
```bash
git tag -a v<major>.<minor>.<patch>-<semantic-label> -m "<description>"
git push origin v<major>.<minor>.<patch>-<semantic-label>
```

Examples:
```
v0.1.0-phase1-complete
v0.2.0-core-ux-mvp
v0.2.1-post-audit-clean
```

**If not a milestone:** Skip tagging. Proceed to the next sub-phase's
Step 0.

---

## Forbidden Actions

The Docs Agent has strict boundaries. Violating any of these is a hard
failure.

- **Never modify application code.** No changes to `src/`, `apps/`,
  `packages/`, or any non-documentation file. The Docs Agent only
  touches files under `docs/` and the repo-root state files
  (DECISIONS.md, MODIFICATIONS.md, TASK-STATUS.md).
- **Never modify the playbook.** Playbooks are historical records of
  what was planned. They are never updated after the build.
- **Never modify subdivision docs.** Subdivision docs are historical
  records of the decomposition plan. They are never updated after the
  build. If a gap is discovered, note it for the next Step 0.
- **Never create `build/` branches.** Build branches are owned by the
  Build Agent (Step 3).
- **Never create `docs/` branches.** Doc prep branches are owned by the
  Architect Agent (Step 0). The Docs Agent uses `fix/` branches
  exclusively.
- **Never create `plan/` branches.** Planning branches are owned by the
  Planner Agent (Gate 1).
- **Never change scope labels in MANIFEST.md.** Scope changes are
  architectural decisions that belong to the Architect Agent.
- **Never rewrite reference doc content.** The Docs Agent fixes
  metadata (line counts, indexes, cross-references, glossary entries)
  — it does not author new spec content. If a gap in spec content is
  discovered, note it for the next sub-phase's Step 0.
- **Never add features or refactor code.** Even if a code improvement
  is obvious, the Docs Agent's mandate is documentation only.
- **Never delete DECISIONS.md entries.** Decision entries are permanent.
  The Docs Agent may note entries for ADR promotion but never removes them.

---

## Edge Cases

### No Doc Changes Needed

If the build didn't change any doc line counts, didn't introduce new
terms, and all cross-references are current:

1. Still create the `fix/` branch.
2. Run all checks to confirm nothing changed.
3. Still archive state file sessions (Step 5.7) — this always applies.
4. Commit with message: `docs: post-<sub-phase> docs sync (state files only, no doc changes)`
5. Merge the branch. This confirms the sync step was executed, not skipped.

### Build Modified a Reference Doc Directly

Occasionally, a build prompt will modify a file under `docs/` (usually
a skill file or convention doc). In this case:

1. The line count for that doc will definitely need updating in MANIFEST.
2. Check whether the change introduced terms that need glossary entries.
3. Check whether other docs cross-reference the changed doc — their
   references may now be stale.

### Large Line Count Shifts

If a doc's line count changed by more than 100 lines, this likely means
major content was added or removed. In addition to updating the section
index:

1. Verify the MANIFEST "Key Content" summary is still accurate.
2. Verify cross-references from other docs point to sections that
   still exist.
3. Note the change prominently in the commit message.

### New Doc Created During Build

If the build created a new doc under `docs/`:

1. Add a full MANIFEST entry (Document, Lines, Scope, Key Content,
   Cross-References, Reconciled date).
2. Add it to the Reference Doc Scope Map if it belongs to a scope group.
3. Check if it introduces terms that need glossary entries.
4. If it's over 500 lines, add a section index.

### MODIFICATIONS.md Incomplete or Missing

If MODIFICATIONS.md doesn't have session blocks for this sub-phase (e.g.,
the build predates the state file system), fall back to the original
process: reconstruct changes entirely from `git diff`:

```bash
git diff --name-only main~1..main
```

Categorize and process as before. Note the gap and encourage the builder
to maintain MODIFICATIONS.md going forward.

### State Files Don't Exist Yet

If TASK-STATUS.md or MODIFICATIONS.md don't exist in the repo (e.g.,
this is the first build after adopting the new process), skip Step 5.7.
Note in the commit message: "State files not yet adopted — skipping
archive step."

---

## Output Format

When the Docs Agent completes Step 5, it produces a summary:

```markdown
## Step 5 Complete — [Sub-Phase ID]

### MANIFEST Updates
- [doc]: lines NNN → MMM
- [doc]: lines unchanged
- [new doc]: added (MMM lines, scope: [label])
(or "No line count changes")

### GLOSSARY Additions
- **[term]** — [1-line definition] (source: MODIFICATIONS.md / diff scan)
(or "No new terms")

### Cross-Reference Fixes
- [doc] > [section]: updated line range NN–MM → PP–QQ
- [doc] > [reference]: removed stale reference to [deleted section]
(or "No stale cross-references")

### Section Index Updates
- [doc]: index updated (lines shifted by ±NN)
- [doc]: new index created (doc crossed 500-line threshold)
(or "No index changes needed")

### State File Updates
- MODIFICATIONS.md: [N] session(s) archived
- TASK-STATUS.md: [N] unit(s) → `docs-synced`
- TASK-STATUS.md: Sub-phase [moved to completed / still active]
- DECISIONS.md: [N] entries reviewed ([M] flagged for ADR promotion / none)

### MODIFICATIONS.md Completeness
- [x] All files in diff accounted for in MODIFICATIONS.md
(or: "[ ] [N] files in diff not listed in MODIFICATIONS.md — added to change list manually")

### Branch
fix/post-<sub-phase>-docs-sync → merged to main

### Milestone Tag
v0.X.0-semantic-label (or "Not a milestone — no tag")
```

---

## Checklist Before Every Merge

- [ ] MANIFEST.md line counts match actual `wc -l` output for ALL docs
      (not just changed ones — verify the full list)
- [ ] MANIFEST.md entries exist for state files and subdivision docs
- [ ] No MANIFEST entries point to non-existent files
- [ ] All new docs have a MANIFEST entry with complete metadata
- [ ] Every new domain term from the build has a GLOSSARY.md entry
- [ ] MODIFICATIONS.md terms cross-checked against diff scan
- [ ] No stale cross-references remain in docs that reference changed files
- [ ] Section indexes updated in any doc whose line count changed ±20 lines
- [ ] All docs over 500 lines have a section index
- [ ] MODIFICATIONS.md active sessions archived for this sub-phase
- [ ] TASK-STATUS.md units updated to `docs-synced`
- [ ] TASK-STATUS.md sub-phase moved to completed (if all units done)
- [ ] DECISIONS.md entries reviewed for ADR promotion candidates
- [ ] No application code was modified
- [ ] Commit message follows `CONTRIBUTING.md` format with `docs:` prefix
- [ ] Branch named `fix/post-<sub-phase>-docs-sync` exactly
- [ ] Self-reviewed the full diff before opening PR
