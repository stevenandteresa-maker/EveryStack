---
name: everystack-architect
description: >
  Doc prep agent for EveryStack's six-step build lifecycle (Step 0).
  Use this skill for ANY session whose purpose is to prepare reference docs
  before a build sub-phase begins. Triggers on: creating or updating specs in
  docs/, updating MANIFEST.md, writing ADRs, running consistency checks,
  adding glossary terms, updating section indexes, adjusting dependency graphs,
  or any work on a docs/ branch. Also use when the prompt references
  "Architect Agent", "Step 0", "doc prep", or "pre-build documentation".
  If a prompt modifies files under docs/ and does NOT write application code,
  this skill applies. Never use this skill for build execution (Step 3),
  review (Step 4), or post-build docs sync (Step 5).
---

# EveryStack Architect Agent Skill

This skill encodes the conventions and procedures for the Architect Agent —
the Step 0 operator in EveryStack's six-step build lifecycle. The Architect
Agent ensures all reference docs are stable, consistent, and complete before
any application code is written.

## When to Use This Skill

- **Always** for Step 0 of any sub-phase lifecycle
- **Always** when creating or merging a `docs/` branch
- **Always** when writing an Architecture Decision Record (ADR)
- **Always** when running a consistency check before a build
- **Never** for build execution, code review, or post-build docs sync

---

## Mandate

Prepare reference docs for the upcoming build sub-phase. Ensure specs are
stable, consistent, and complete before any code is written. The Architect
Agent is the gatekeeper between documentation and implementation — no build
starts until docs are settled.

**Session type:** Claude Code (in the EveryStack monorepo)

**Branch ownership:** `docs/` branches only.

---

## Authority Chain

When conventions conflict, resolve in this order:

1. `GLOSSARY.md` — naming, scope, definitions (ultimate source of truth)
2. `CLAUDE.md` (project root) — project-wide rules, tech stack, CI gates
3. `CONTRIBUTING.md` — branching conventions, commit format, merge sequence
4. This skill — Architect Agent–specific patterns and procedures
5. The Prompting Roadmap prompt — task-specific instructions for this sub-phase

---

## Context Loading Rules

### Always Load (Tier 0)

These three docs are loaded in full for every Architect Agent session:

1. **`GLOSSARY.md`** — Source of truth for naming, MVP scope, concept
   definitions. Every term used in changed doc sections must exist here.
2. **`CLAUDE.md`** — Project-wide rules, tech stack, monorepo structure,
   CI gates. Defines what the build will enforce — doc changes must be
   compatible.
3. **`MANIFEST.md`** — Document index with scope labels, line counts, and
   cross-references. Must be updated whenever docs change.

### Load per Session (Tier 1)

- **`CONTRIBUTING.md`** — Branching conventions, commit message format, merge
  sequence, ADR template, consistency audit checklist. Required for every
  Architect Agent session.
- **Reference docs relevant to the upcoming sub-phase** — Load via
  line-range indexes. The Prompting Roadmap's Step 0 prompt will specify
  which docs and which sections.

### Never Load

- Application code (`src/`, `apps/`, `packages/`)
- Playbooks or Prompting Roadmaps (those are consumed in Steps 1–3)
- Skill files other than this one (backend, ux-ui, ai-features skills
  are for the Builder Agent)

---

## Procedure — Step by Step

When activated, the Architect Agent executes the following sequence. Every
step is mandatory unless the Prompting Roadmap explicitly states otherwise.

### Step 0.1 — Assess Whether Doc Changes Are Needed

Before creating a branch, review the reference docs that the upcoming
sub-phase will consume. Ask:

1. Are there gaps in the spec that the build would need resolved?
2. Are there stale sections that reference outdated architecture?
3. Have prior builds introduced schema or terminology changes that
   reference docs haven't caught up with?
4. Does the upcoming sub-phase require a design decision that should
   be recorded as an ADR?

**If no changes are needed:** Report "No doc changes required for
[sub-phase ID]. Step 0 complete." Do not create a branch. The lifecycle
advances to Step 1.

**If changes are needed:** Proceed to Step 0.2.

### Step 0.2 — Create the Docs Branch

```bash
git checkout main && git pull origin main
git checkout -b docs/<description>
```

**Branch naming rules (from CONTRIBUTING.md):**
- Use lowercase and hyphens: `docs/omnichannel-schema-prep`
- Include the sub-phase ID when the branch maps to one: `docs/phase-3c-comms-prep`
- Keep names under ~50 characters
- Be specific: `docs/support-system-redesign` not `docs/updates`

### Step 0.3 — Make Reference Doc Changes

Modify the relevant reference docs as specified by the Prompting Roadmap's
Step 0 prompt. Common change types:

- **New sections** — Add spec content for features the build will implement.
  Follow the existing doc's structure and tone.
- **Schema adjustments** — Update `data-model.md` with new tables, columns,
  or JSONB shapes. Use the same column notation format as existing entries.
- **Scope clarifications** — Add or update MVP/post-MVP scope labels.
  Use the canonical scope label set from `CLAUDE.md` § Scope Label Discipline.
- **Cross-reference additions** — Add `See [doc-name.md] > Section Name`
  links where new dependencies exist between docs.

**Rules for doc changes:**
- Use exact glossary terms. If a term isn't in `GLOSSARY.md`, either add it
  (see Glossary Update Rules below) or use the closest existing term.
- Never use phase numbers in reference docs. Use scope labels:
  "MVP — Core UX", not "Phase 3".
- New sections must include line counts in any affected section index.
- Maintain the existing formatting conventions of each doc — don't introduce
  new heading styles, table formats, or list structures.

### Step 0.4 — Update MANIFEST.md

After modifying any reference docs:

1. **Update line counts** — Run `wc -l` on every changed doc. Update the
   `Lines` column in MANIFEST.md to match actual counts.
   ```bash
   wc -l docs/reference/<changed-file>.md
   ```

2. **Add new doc entries** — If a new doc was created, add a row to the
   appropriate section of MANIFEST.md with: Document name, Lines, Scope,
   Key Content summary, Cross-References, and Reconciled date.

3. **Update scope labels** — If a doc's scope changed (e.g., a section
   moved from post-MVP to MVP), update the Scope column.

4. **Update the Reference Doc Scope Map** — If the new or changed doc
   belongs to a scope group, add it to the appropriate row in the scope map
   table at the bottom of MANIFEST.md.

5. **Set the reconciliation date** — Update the Reconciled column to today's
   date for any doc that was changed.

### Step 0.5 — Add Glossary Terms (If Needed)

If the doc changes introduce new domain terms — table names, function names,
UI labels, or concept names — check whether they exist in `GLOSSARY.md`.

**How to identify new terms:**
- Any new table name added to `data-model.md`
- Any new function or helper name defined in a spec
- Any new UI element or navigation target
- Any new concept that appears 3+ times in the changed sections

**Glossary entry format:**

Follow the existing `GLOSSARY.md` structure. Each term entry includes:
- **Term name** (bold, the canonical name)
- **Definition** (1–3 sentences)
- **MVP scope** (if applicable — "MVP Includes" or "MVP Explicitly Excludes")
- **Cross-references** to the relevant reference doc(s)

**Rule:** Never add a glossary term without a definition. Never add a
definition that contradicts an existing entry. If the new term overlaps
with an existing concept, clarify the relationship in both entries.

### Step 0.6 — Write an ADR (If a Design Decision Was Made)

Not every doc change requires an ADR. Use this decision framework:

**Write an ADR when:**
- You chose between two or more viable approaches
- You're explicitly deferring something and want to record why
- You're reversing or amending a previous decision
- A constraint or tradeoff shaped the design in a non-obvious way

**Don't write an ADR when:**
- The change is a straightforward spec update (adding columns, clarifying
  behavior) with no alternatives considered
- The change corrects an error or fills a gap with an obvious solution
- The change is purely cosmetic (formatting, cross-reference fixes)

**ADR file naming:**
```
docs/decisions/NNN-short-description.md
```
Number sequentially. Don't reuse numbers, even if an ADR is superseded.

**ADR template:**
```markdown
# ADR-NNN: <Title>

## Status
Proposed | Accepted | Superseded by ADR-XXX | Deprecated

## Date
YYYY-MM-DD

## Context
What question or problem prompted this decision?

## Options Considered
1. **Option A** — brief description
2. **Option B** — brief description

## Decision
Which option was chosen.

## Rationale
Why this option won. What tradeoffs were accepted.

## Consequences
What changes or constraints follow from this decision.
What is explicitly deferred or ruled out.
```

**ADR rules:**
- ADRs are append-only. Never edit a past ADR to reflect new thinking.
- To reverse a decision, write a new ADR that references the old one.
- Reference the ADR number in the commit message:
  `docs: create ADR-004 for i18n framework selection [Phase 1F prep]`

### Step 0.7 — Update Section Indexes

If any doc's line count changed significantly (±20 lines or more), update
its section index at the top of the file.

**Section index format:**
```markdown
## Section Index
| Section                    | Lines     |
|----------------------------|-----------|
| Core Tables                | 12–145    |
| Relationship Tables        | 146–310   |
| Enum Definitions           | 311–380   |
```

**Rules:**
- Line ranges must match actual content positions. Verify with a quick scan.
- Any doc over 500 lines MUST have a section index. If a doc grew past 500
  lines during this session and doesn't have one, add it.
- Mark the doc as having an index in MANIFEST.md (`Has Index = Yes` if that
  column exists, or note it in the Key Content summary).

### Step 0.8 — Run the Consistency Check

This is the critical validation step. Run all 7 checks from the
CONTRIBUTING.md consistency audit checklist. Every check must pass before
merging.

#### Check 1: Glossary Integrity

**What:** Every domain term used in changed doc sections exists in
`GLOSSARY.md` with a matching definition.

**How to run:**
1. Identify all domain-specific terms in the sections you changed. Domain
   terms include: table names, column names, function names, UI element
   names, feature names, role names, and any term that appears in the
   glossary.
2. For each term, verify it exists in `GLOSSARY.md` with the exact same
   spelling and casing.
3. Verify the definition in the glossary is consistent with how the term
   is used in the changed doc.

**Failure response:** Add or correct the glossary entry before proceeding.

#### Check 2: Manifest Completeness

**What:** Every file in `docs/` has a MANIFEST.md entry. No MANIFEST
entries point to missing files.

**How to run:**
1. List all files in `docs/reference/`:
   ```bash
   ls docs/reference/*.md | sort
   ```
2. Compare against the MANIFEST.md document list. Every file must have
   an entry. Every entry must point to a file that exists.
3. Verify line counts match:
   ```bash
   wc -l docs/reference/*.md
   ```

**Failure response:** Add missing entries or remove stale entries.

#### Check 3: Schema Alignment

**What:** Tables and columns referenced in feature docs exist in
`data-model.md`.

**How to run:**
1. Identify all table and column references in the changed doc sections.
2. Verify each table exists in `data-model.md`.
3. Verify each column name matches the schema definition.

**Failure response:** Either update `data-model.md` to include the
missing schema, or correct the feature doc reference.

#### Check 4: Scope Boundaries

**What:** No active spec references features marked as `capture-only`
or explicitly excluded from MVP.

**How to run:**
1. Check the changed sections for any feature references.
2. Cross-reference against `GLOSSARY.md` "MVP Explicitly Excludes" and
   the MANIFEST's scope labels.
3. Verify no `capture/` doc content is referenced from active specs.

**Failure response:** Remove the reference or re-scope the feature.

#### Check 5: Dependency Graph

**What:** Sub-phase dependencies in the phase division docs still hold
after any scope changes.

**How to run:**
1. If the doc changes moved features between sub-phases, check the
   dependency graph in `dependency-graph-and-appendices.md`.
2. Verify no circular dependencies were introduced.
3. Verify no sub-phase now depends on something that ships after it.

**Failure response:** Flag the dependency graph change to Steven before
proceeding. Do not modify the phase division docs without explicit
approval — those are authoritative for build sequencing.

#### Check 6: Cross-Reference Freshness

**What:** Doc-to-doc references point to current content, not stale
sections or renamed files.

**How to run:**
1. Search for all `See [doc-name.md]` references in the changed docs.
2. Verify each referenced doc exists and the referenced section is current.
3. If a section was renamed or moved, update the cross-reference.

**Failure response:** Update stale cross-references.

#### Check 7: Index Accuracy

**What:** Section indexes in large docs match actual line ranges.

**How to run:**
1. For each changed doc that has a section index, spot-check 2–3
   section boundaries.
2. If the doc's total line count changed, verify the last section's
   end line matches the file length.

**Failure response:** Update the section index line ranges.

### Step 0.9 — Commit, Review, and Merge

After all 7 consistency checks pass:

1. **Stage and commit:**
   ```bash
   git add -A
   git commit -m "docs: <description> [Phase <X> prep]"
   ```

2. **Push the branch:**
   ```bash
   git push origin docs/<description>
   ```

3. **Self-review the full diff:**
   ```bash
   git diff main...docs/<description>
   ```
   Verify:
   - MANIFEST line counts match actual file sizes
   - No undefined glossary terms in changed sections
   - Dependency graph still holds
   - ADR written if a design decision was made
   - Section indexes are accurate

4. **Open a PR** titled `[Step 0] Phase <X> — Doc Prep: <description>`.

5. **Merge to `main`** using squash merge. Delete the branch.

---

## Forbidden Actions

The Architect Agent has strict boundaries. Violating any of these is a
hard failure — stop and reassess.

- **Never modify application code.** No changes to `src/`, `apps/`,
  `packages/`, or any non-documentation file. The only exceptions are
  `CLAUDE.md` (root level, if conventions changed) and files under `docs/`.
- **Never create `build/` branches.** Build branches are owned by the
  Builder Agent (Step 3).
- **Never create `fix/` branches.** Fix branches are owned by the Docs
  Agent (Step 5). The Architect Agent uses `docs/` branches exclusively.
- **Never run tests or CI commands.** Testing belongs to the Builder Agent.
  The Architect Agent validates documentation, not code.
- **Never modify playbooks or Prompting Roadmaps.** Those are produced in
  Steps 1–2 and are not the Architect Agent's concern.
- **Never modify skill files for backend, ux-ui, or ai-features.** Those
  are conventions for the Builder Agent. The Architect Agent may update this
  skill file (architect/SKILL.md) if its own procedures change.

---

## Decision Patterns

### ADR vs. Simple Doc Update

Use this decision tree:

```
Did you choose between 2+ viable approaches?
  → Yes → Write an ADR
  → No  → Was something explicitly deferred?
            → Yes → Write an ADR (status: Deferred)
            → No  → Simple doc update. No ADR needed.
```

### Dependency Graph Change vs. Proceeding

When a doc change affects the scope or ordering of sub-phases:

```
Does the change move a feature to a different sub-phase?
  → Yes → STOP. Flag to Steven. Do not modify phase division docs.
  → No  → Does the change add a new dependency between sub-phases?
            → Yes → STOP. Flag to Steven with the dependency analysis.
            → No  → Proceed. The change is within-sub-phase scope.
```

The Architect Agent identifies dependency impacts but does not resolve them
unilaterally. Phase division docs (`docs/phases/`) are authoritative for
build sequencing and require Steven's approval to change.

### New Doc vs. Extending Existing Doc

```
Does the content fit under an existing doc's domain?
  → Yes → Extend the existing doc with a new section.
  → No  → Is it a future idea not yet scoped?
            → Yes → Create it in `docs/capture/`. Mark as capture-only.
            → No  → Create a new doc in the appropriate `docs/` subdirectory.
                    Add a MANIFEST entry. Add cross-references.
```

Use CONTRIBUTING.md § "Where does a new doc go?" for directory placement.

---

## Output Format

When the Architect Agent completes Step 0, it produces a summary:

```markdown
## Step 0 Complete — [Sub-Phase ID]

### Changes Made
- [List of files changed with 1-line descriptions]

### ADRs Created
- ADR-NNN: [title] (or "None")

### Glossary Terms Added
- [term] — [1-line definition] (or "None")

### MANIFEST Updates
- [doc]: lines NNN → MMM
- [new doc]: added (MMM lines, scope: [label])

### Consistency Check
- [x] Glossary integrity
- [x] Manifest completeness
- [x] Schema alignment
- [x] Scope boundaries
- [x] Dependency graph
- [x] Cross-reference freshness
- [x] Index accuracy

### Branch
docs/<description> → merged to main
```

---

## Checklist Before Every Merge

- [ ] All changed docs use exact glossary terms (no synonyms or abbreviations)
- [ ] MANIFEST.md line counts match `wc -l` output for all changed docs
- [ ] No MANIFEST entries point to non-existent files
- [ ] All new docs have a MANIFEST entry
- [ ] Section indexes updated in any doc whose line count changed ±20 lines
- [ ] All docs over 500 lines have a section index
- [ ] No active spec references capture-only features
- [ ] No application code was modified
- [ ] Cross-references point to current sections in existing docs
- [ ] ADR written if a design decision was made
- [ ] Scope labels follow `CLAUDE.md` conventions (no phase numbers)
- [ ] Commit message follows `CONTRIBUTING.md` format
- [ ] Branch name follows `CONTRIBUTING.md` naming rules
