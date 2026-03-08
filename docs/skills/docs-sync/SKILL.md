---
name: everystack-docs-sync
description: >
  Post-build documentation sync agent for EveryStack's six-step build lifecycle
  (Step 5). Use this skill for ANY session whose purpose is to bring
  documentation back into alignment with the codebase after a build. Triggers
  on: updating MANIFEST.md line counts, adding new GLOSSARY.md terms from
  a build, fixing stale cross-references, updating section indexes after line
  count changes, or any work on a fix/post-*-docs-sync branch. Also use when
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
- **Never** for doc prep (use the Architect Agent skill)
- **Never** for build execution or code review

---

## Mandate

Bring documentation back into alignment with the codebase after a build.
Update MANIFEST.md line counts, check GLOSSARY.md for new terms introduced
in the build, verify cross-references, and update section indexes if files
grew past 500 lines. The Docs Agent is the final step in each sub-phase
lifecycle — it ensures the next sub-phase starts with accurate docs.

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

3. **The list of files changed during the build** — Obtained from:
   ```bash
   git diff --name-only main~1..main
   ```
   This is the Docs Agent's primary input. It tells the agent which docs
   might have stale cross-references and which code files might have
   introduced new domain terms.

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

Identify what changed during the build:

```bash
git diff --name-only main~1..main
```

Categorize the changed files:

- **Docs changed** — Any files under `docs/` that were modified during
  the build (uncommon but possible if a build prompt touched a skill file
  or convention doc).
- **Schema files changed** — Files in `packages/shared/db/schema/` —
  these may introduce new table names.
- **Data access files changed** — Files in `apps/web/src/data/` or
  `packages/shared/` — these may introduce new function names.
- **Component files changed** — Files in `apps/web/src/components/` —
  these may introduce new component names and UI labels.
- **Migration files changed** — Files in `packages/shared/db/migrations/`
  — these may introduce new tables or columns.

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

### Step 5.4 — Check GLOSSARY.md for New Terms

Scan the build's changed files for new domain terms that aren't yet
in the glossary.

**How to identify new terms:**

Search the diff for new names in these categories:

1. **New table names** — Grep migration files and schema files for
   new table definitions:
   ```bash
   git diff main~1..main -- 'packages/shared/db/schema/*.ts' \
     'packages/shared/db/migrations/*.ts' | grep -E "^\+" | grep -iE "table\(|pgTable\("
   ```

2. **New function/helper names** — Grep data access files for new
   exported functions:
   ```bash
   git diff main~1..main -- 'apps/web/src/data/*.ts' \
     'packages/shared/**/*.ts' | grep -E "^\+export (async )?function"
   ```

3. **New component names** — Grep component files for new exports:
   ```bash
   git diff main~1..main -- 'apps/web/src/components/**/*.tsx' \
     | grep -E "^\+export (default )?(function|const)"
   ```

4. **New UI labels** — Grep translation files for new keys:
   ```bash
   git diff main~1..main -- 'apps/web/messages/*.json' | grep "^\+"
   ```

5. **New concept names** — Any term that appears 3+ times in the diff
   and is used as a domain concept (not just a variable name).

**For each new term found:**

1. Check whether it already exists in `GLOSSARY.md`.
2. If it does: verify the existing definition is still accurate.
3. If it doesn't: add a glossary entry.

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

### Step 5.7 — Commit, Review, and Merge

After completing all checks and updates:

1. **Stage and commit:**
   ```bash
   git add -A
   git commit -m "docs: post-<sub-phase> docs sync (MANIFEST, GLOSSARY, cross-refs)"
   ```

   Use area prefix `docs` and include the sub-phase identifier. Examples:
   ```
   docs: post-3c docs sync (MANIFEST, GLOSSARY, cross-refs)
   docs: post-2b docs sync (MANIFEST line counts, 3 new glossary terms)
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
   - No application code was modified

4. **Open a PR** titled `[Step 5] Phase <X> — Post-Build Docs Sync`.

5. **Merge to `main`** using squash merge. Delete the branch.

### Step 5.8 — Tag If Milestone

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
  touches files under `docs/`.
- **Never modify the playbook.** Playbooks are historical records of
  what was planned. They are never updated after the build.
- **Never create `build/` branches.** Build branches are owned by the
  Builder Agent (Step 3).
- **Never create `docs/` branches.** Doc prep branches are owned by the
  Architect Agent (Step 0). The Docs Agent uses `fix/` branches
  exclusively.
- **Never change scope labels in MANIFEST.md.** Scope changes are
  architectural decisions that belong to the Architect Agent.
- **Never rewrite reference doc content.** The Docs Agent fixes
  metadata (line counts, indexes, cross-references, glossary entries)
  — it does not author new spec content. If a gap in spec content is
  discovered, note it for the next sub-phase's Step 0.
- **Never add features or refactor code.** Even if a code improvement
  is obvious, the Docs Agent's mandate is documentation only.

---

## Edge Cases

### No Doc Changes Needed

If the build didn't change any doc line counts, didn't introduce new
terms, and all cross-references are current:

1. Still create the `fix/` branch.
2. Run all checks to confirm nothing changed.
3. Commit with message: `docs: post-<sub-phase> docs sync (no changes needed)`
4. Merge the empty (or near-empty) branch. This confirms the sync step
   was executed, not skipped.

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
- **[term]** — [1-line definition]
(or "No new terms")

### Cross-Reference Fixes
- [doc] > [section]: updated line range NN–MM → PP–QQ
- [doc] > [reference]: removed stale reference to [deleted section]
(or "No stale cross-references")

### Section Index Updates
- [doc]: index updated (lines shifted by ±NN)
- [doc]: new index created (doc crossed 500-line threshold)
(or "No index changes needed")

### Branch
fix/post-<sub-phase>-docs-sync → merged to main

### Milestone Tag
v0.X.0-semantic-label (or "Not a milestone — no tag")
```

---

## Checklist Before Every Merge

- [ ] MANIFEST.md line counts match actual `wc -l` output for ALL docs
      (not just changed ones — verify the full list)
- [ ] No MANIFEST entries point to non-existent files
- [ ] All new docs have a MANIFEST entry with complete metadata
- [ ] Every new domain term from the build has a GLOSSARY.md entry
- [ ] No stale cross-references remain in docs that reference changed files
- [ ] Section indexes updated in any doc whose line count changed ±20 lines
- [ ] All docs over 500 lines have a section index
- [ ] No application code was modified
- [ ] Commit message follows `CONTRIBUTING.md` format with `docs:` prefix
- [ ] Branch named `fix/post-<sub-phase>-docs-sync` exactly
- [ ] Self-reviewed the full diff before opening PR
