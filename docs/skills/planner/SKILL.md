---
name: everystack-planner
description: >
  Decomposition and context planning agent for EveryStack's build lifecycle.
  Sits between Step 0 (Doc Prep) and Step 1 (Playbook Gen) as the planning
  gate. Use this skill for ANY session whose purpose is to break a sub-phase
  into subdivision units, write interface contracts, curate context manifests,
  or populate TASK-STATUS.md. Triggers on: producing subdivision docs, defining
  what each build unit produces and consumes, specifying which doc sections and
  source files a build prompt needs, assessing whether a failed review affects
  downstream units, or any work on a plan/ branch. Also use when the prompt
  references "Planner Agent", "subdivision", "context manifest", "interface
  contract", "decomposition", or "context budget". If a prompt produces a
  subdivision doc or updates TASK-STATUS.md with unit definitions, this skill
  applies. Never use this skill for doc prep (Step 0), build execution
  (Step 3), review (Step 4), or post-build docs sync (Step 5).
---

# EveryStack Planner Agent Skill

This skill encodes the conventions and procedures for the Planner Agent —
the planning gate operator in EveryStack's build lifecycle. The Planner
Agent sits between Doc Prep (Step 0) and Playbook Generation (Step 1),
ensuring that every sub-phase is decomposed into tightly scoped units
with explicit interface contracts and curated context before any playbook
is written.

The Planner is the most important agent in the lifecycle. Build quality
is determined by planning quality — better input context beats better
reasoning.

## When to Use This Skill

- **Always** for pre-subdivision planning (Gate 1 in the lifecycle)
- **Always** when creating or merging a `plan/` branch
- **Always** when writing interface contracts between build units
- **Always** when curating context manifests for build prompts
- **Always** when populating TASK-STATUS.md with unit checklists
- **Always** when replanning after a review failure (Gate 3)
- **Always** when producing a phase boundary completion summary (Gate 4)
- **Never** for doc prep, build execution, code review, or docs sync

---

## Mandate

Decompose sub-phases into tightly scoped build units. Define what each
unit produces and consumes. Curate the minimum-but-sufficient context
for each unit's build prompts. Populate TASK-STATUS.md so every agent
session starts with clear orientation. The Planner Agent is the quality
gate between documentation and playbook generation — no playbook is
written until decomposition is settled.

**Session type:** Claude Code (in the EveryStack monorepo)

**Branch ownership:** `plan/` branches only.

---

## Authority Chain

When conventions conflict, resolve in this order:

1. `GLOSSARY.md` — naming, scope, definitions (ultimate source of truth)
2. `CLAUDE.md` (project root) — project-wide rules, tech stack, CI gates
3. `SUBDIVISION-STRATEGY.md` — decomposition principles, seam heuristics,
   contract notation, context budget rules
4. `CONTRIBUTING.md` — branching conventions, commit format, merge sequence
5. This skill — Planner Agent–specific patterns and procedures
6. The Prompting Roadmap prompt — task-specific instructions for this
   sub-phase

---

## Context Loading Rules

### Always Load (Tier 0)

These docs are loaded in full for every Planner Agent session:

1. **`GLOSSARY.md`** — Source of truth for naming and scope. Every term
   used in subdivision docs and interface contracts must exist here.
2. **`CLAUDE.md`** — Project-wide rules, monorepo structure, conventions.
   Needed to verify that context manifests reference valid file paths
   and that interface contracts use correct patterns.
3. **`MANIFEST.md`** — Document index with line counts and section
   indexes. Essential for writing accurate context manifests with
   line ranges.
4. **`SUBDIVISION-STRATEGY.md`** — Decomposition principles. Read in
   full before producing any subdivision doc.
5. **`TASK-STATUS.md`** — Current state of all units across sub-phases.
   Read at session start for orientation.

### Load per Session (Tier 1)

- **`CONTRIBUTING.md`** — Branching conventions, commit format.
- **The playbook for this sub-phase** (if it exists already) — When
  decomposing a sub-phase that already has a playbook, the playbook's
  acceptance criteria feed into per-unit criteria scoping.
- **Reference docs relevant to the sub-phase** — Load via line-range
  indexes. The Prompting Roadmap's planning prompt will specify which
  docs and sections. These are needed to identify seams and write
  accurate interface contracts.
- **Phase division doc for this sub-phase** — To understand dependencies
  on prior and subsequent sub-phases.
- **`DECISIONS.md`** — To check for prior decisions that affect
  decomposition choices.
- **`MODIFICATIONS.md`** — If replanning after a failure, read active
  sessions to understand what was built.

### Never Load

- Application code (the Planner reads file paths and type signatures
  from docs, not from source files directly — exception: when verifying
  that a context manifest's source file references are valid)
- Skill files other than this one (the Planner doesn't need build,
  review, or docs sync conventions)
- Prompting Roadmaps from other sub-phases

---

## Procedure — Step by Step

The Planner Agent operates at four gates in the lifecycle. The primary
gate (Gate 1) is the full decomposition procedure. Gates 2–4 are
shorter, focused interventions.

---

### Gate 1: Pre-Subdivision Planning

Run after Step 0 completes and before Step 1 (Playbook Generation)
begins. This is the Planner's primary operation.

#### 1.1 — Assess the Sub-Phase

Before creating a branch, review the sub-phase's scope:

1. Read the phase division doc entry for this sub-phase.
2. Read the reference doc sections that define the features being built.
3. Check TASK-STATUS.md for any blocked or failed units from prior
   attempts.
4. Check DECISIONS.md for prior decisions affecting this sub-phase.

**Key questions:**
- What are the major functional areas in this sub-phase?
- What layers of the stack does this sub-phase touch?
  (schema, data access, UI, workers, real-time)
- Are there existing code patterns this sub-phase should follow?
- What will downstream sub-phases consume from this one?

#### 1.2 — Create the Plan Branch

```bash
git checkout main && git pull origin main
git checkout -b plan/<sub-phase-id>-subdivision
```

**Branch naming rules:**
- Always use the pattern `plan/<sub-phase-id>-subdivision`
- Example: `plan/3c-subdivision`, `plan/2b-subdivision`
- For replanning: `plan/<sub-phase-id>-replan`
- Keep names under ~50 characters

#### 1.3 — Identify Seams

Apply the seam heuristics from SUBDIVISION-STRATEGY.md in priority
order:

1. **Data → Service → UI layers** — Does this sub-phase touch multiple
   layers? If so, this is almost always the primary seam.
2. **CRUD boundaries** — Within a layer, are there distinct Create/Read/
   Update/Delete operations that can be built independently?
3. **Tenant isolation boundaries** — Does a unit introduce tenant-scoped
   tables? Keep schema + isolation tests together.
4. **Cross-cutting concerns** — Are there shared types, error codes, or
   translation keys that multiple units need? Consider making these
   Unit 1.

**Anti-pattern check:** Verify you are NOT splitting by:
- File count ("first 5 files, next 5 files")
- Estimated effort ("about one session each")
- Tests from implementation (always keep together)
- Schema from migration (always keep together)

Document your seam analysis in the subdivision doc's intro section.

#### 1.4 — Write Interface Contracts

For each identified unit, define the interface contract using the
notation from SUBDIVISION-STRATEGY.md:

```markdown
**Produces:**
- `ExportName` — [type/function/component] from `path/to/file.ts`
- `FunctionName(param: Type): ReturnType` — [brief purpose]

**Consumes:**
- `ExportName` from Unit N — [how it's used]

**Side Effects:**
- [migration, route, queue registration, etc.] — or "None"
```

**Contract quality checks:**
- Can a downstream unit write `import { X } from '...'` against this
  contract? If not, add the missing export path or signature.
- Can the Reviewer Agent mechanically verify every contract item exists
  in a diff? If not, make it more specific.
- Are there any "might also add" items? Remove them. Contracts are
  commitments, not aspirations.

#### 1.5 — Curate Context Manifests

For each unit, specify the exact context the Build Agent will need:

1. **Doc sections** — Use document name and line ranges from section
   indexes in MANIFEST.md. Verify line ranges are current.
2. **Source files** — Existing codebase files the Build Agent will read
   (not write). Only files the unit will directly import from or
   reference.
3. **Prior unit outputs** — Files produced by upstream units that this
   unit will consume.

**Apply the context budget test:** Estimate the token count for each
unit's full context load (doc sections + source files + prior outputs +
CLAUDE.md + GLOSSARY.md). If it exceeds ~40% of a Claude Code context
window, find a seam within the unit and split it further. Never solve a
budget failure by trimming context.

Record the budget estimate in the subdivision doc's Context Budget
Verification table.

#### 1.6 — Define Acceptance Criteria per Unit

If a playbook already exists for this sub-phase, scope its acceptance
criteria to individual units. Each criterion should appear in exactly
one unit — never duplicated across units.

If no playbook exists yet (because the Planner runs before playbook
generation), write preliminary acceptance criteria scoped to each unit.
These will be refined when the playbook is generated at the subdivision
level.

**Rules:**
- Every criterion must be independently verifiable from the unit's diff
- Every criterion must relate to the unit's interface contract or
  internal quality
- Never include criteria about downstream behavior ("when Unit 3 is
  built, this should...")

#### 1.7 — Build the Dependency Graph

Document the dependency ordering between units:

1. Draw the dependency graph using ASCII notation from
   SUBDIVISION-STRATEGY.md.
2. Identify parallel units (same upstream dependency, no mutual
   dependency).
3. Identify the critical path (longest dependency chain).
4. Verify: no circular dependencies, first unit has no unit-to-unit
   dependencies, and every unit's Consumes entries match an upstream
   unit's Produces entries.

#### 1.8 — Populate TASK-STATUS.md

Add a new sub-phase block to TASK-STATUS.md with:

- The sub-phase ID and name
- Started date (today)
- One entry per unit with: name, `pending` status, Produces summary,
  Consumes summary, empty Branch field, empty Notes field

This block becomes the orientation document for every subsequent agent
session in this sub-phase.

#### 1.9 — Write the Subdivision Doc

Assemble all the above into a subdivision doc following the template
in SUBDIVISION-STRATEGY.md. Save it to:

```
docs/subdivisions/<sub-phase-id>-subdivision.md
```

Create the `docs/subdivisions/` directory if it doesn't exist.

#### 1.10 — Update MANIFEST.md

Add an entry for the new subdivision doc:

```
| <sub-phase-id>-subdivision.md | NNN | [scope] | Subdivision: N units, ... | ... | YYYY-MM-DD |
```

Update MANIFEST line counts for any other docs modified during this
session.

#### 1.11 — Commit, Review, and Merge

After completing the subdivision doc:

1. **Stage and commit:**
   ```bash
   git add -A
   git commit -m "plan: <sub-phase-id> subdivision (N units)"
   ```

2. **Push the branch:**
   ```bash
   git push origin plan/<sub-phase-id>-subdivision
   ```

3. **Self-review the full diff:**
   ```bash
   git diff main...plan/<sub-phase-id>-subdivision
   ```
   Verify:
   - Every unit has a complete interface contract (Produces + Consumes)
   - Every unit has a context manifest with line ranges
   - Context Budget Verification table is filled in with estimates
   - Dependency graph has no circular dependencies
   - TASK-STATUS.md has a matching entry for every unit
   - MANIFEST.md entry added for the subdivision doc
   - All terms match GLOSSARY.md exactly

4. **Open a PR** titled `[Plan] <Sub-Phase ID> — Subdivision: N units`.

5. **Merge to `main`** using squash merge. Delete the branch.

---

### Gate 2: Pre-Build Context Curation

Run between Step 2 (Prompting Roadmap) and Step 3 (Build). This gate
is lighter than Gate 1 — it annotates the Prompting Roadmap with
context manifests, not produces a new doc.

#### Procedure

1. For each prompt in the Prompting Roadmap, verify the context
   manifest from the subdivision doc is still accurate:
   - Have line ranges shifted since the subdivision doc was written?
   - Have prior unit builds created files not anticipated in the
     manifest?
   - Have DECISIONS.md entries changed what context is needed?

2. Annotate each prompt in the Prompting Roadmap with its final
   context manifest. Format:

   ```markdown
   **Context for this prompt:**
   - Load: [doc] § [section] (lines NN–MM)
   - Load: [source file path]
   - Load: [prior unit output path]
   - Do NOT load: [anything else]
   ```

3. Commit the annotated Prompting Roadmap on the existing branch.

---

### Gate 3: Post-Failure Replanning

Run when a Review (Step 4) verdict is FAIL. The Planner assesses
whether the failure is isolated or cascading before the Build Agent
retries.

#### Procedure

1. Read the review verdict to understand the failure.
2. Read MODIFICATIONS.md to understand what was attempted.
3. Classify the failure:

   **Isolated failure:** The unit failed its own acceptance criteria
   but its interface contract can still be fulfilled as specified.
   - Action: Update TASK-STATUS.md to `failed-review` with notes.
   - The Build Agent retries with the same context manifest.

   **Contract-breaking failure:** The unit's interface contract cannot
   be met as specified (e.g., a type shape needs to change, a function
   signature needs different parameters).
   - Action: Update TASK-STATUS.md to `failed-review`.
   - Mark downstream units that consume the broken contract as
     `blocked` in TASK-STATUS.md.
   - Revise the subdivision doc's contract for this unit.
   - Assess whether downstream unit contracts need revision.
   - Create a `plan/<sub-phase-id>-replan` branch for the revisions.

   **Cascading failure (spec gap):** The failure reveals that the
   reference docs or spec are incomplete or incorrect.
   - Action: Update TASK-STATUS.md to `blocked` for this unit and
     all downstream units.
   - Log the spec gap in DECISIONS.md.
   - Escalate to Steven — this requires returning to Step 0.

4. Write a replanning note in DECISIONS.md documenting the failure
   classification and actions taken.

---

### Gate 4: Phase Boundary Summary

Run after the Docs Agent completes Step 5 for the final unit in a
sub-phase. This gate closes out the sub-phase and prepares for the
next one.

#### Procedure

1. Verify all units in TASK-STATUS.md show `docs-synced`.
2. Move the sub-phase block to the Completed Sub-Phases section.
3. Review DECISIONS.md entries from this sub-phase:
   - Flag any that should be promoted to a full ADR.
   - Flag any that affect the next sub-phase's decomposition.
4. Propose CLAUDE.md updates if conventions evolved during the build.
5. Produce a completion summary (see Output Format below).
6. Identify spec gaps discovered during build that need Step 0 attention
   in the next sub-phase.

---

## Output Formats

### Gate 1 Output: Subdivision Doc

The primary output is the subdivision doc itself, saved to
`docs/subdivisions/<sub-phase-id>-subdivision.md`. Follow the template
in SUBDIVISION-STRATEGY.md exactly.

Additionally, produce a session summary:

```markdown
## Planning Complete — [Sub-Phase ID]

### Subdivision Summary
- **Units:** [count]
- **Critical path:** Unit 1 → Unit N → Unit M ([depth] deep)
- **Parallel opportunities:** Units [X, Y] can run concurrently
- **Highest complexity unit:** Unit [N] — [reason]

### Artifacts Created/Updated
- docs/subdivisions/<sub-phase-id>-subdivision.md (new, NNN lines)
- TASK-STATUS.md — [count] units added
- MANIFEST.md — new entry added

### Context Budget
- All units pass the 40% context budget test: [Yes/No]
- Tightest budget: Unit [N] at ~XX,XXX tokens estimated

### Decisions Made
- [Any tactical decisions logged to DECISIONS.md]

### Branch
plan/<sub-phase-id>-subdivision → merged to main
```

### Gate 3 Output: Replanning Note

```markdown
## Replanning — [Sub-Phase ID] Unit [N]

### Failure Classification
[Isolated / Contract-breaking / Cascading]

### Review Verdict Summary
[1–2 sentence summary of what failed and why]

### Actions Taken
- TASK-STATUS.md: Unit [N] → `failed-review`
- [If contract-breaking: list downstream units blocked]
- [If cascading: escalation note]

### Contract Revisions
- [List any contract changes, or "None — isolated failure"]

### Retry Context
- [Any changes to the context manifest for the retry]
```

### Gate 4 Output: Completion Summary

```markdown
## Sub-Phase Complete — [Sub-Phase ID]

### Unit Results
| Unit | Status | Review Attempts | Notes |
|------|--------|-----------------|-------|
| 1    | docs-synced | 1          |       |
| 2    | docs-synced | 2          | Failed first review: [reason] |
| ...  | ...    | ...             | ...   |

### Decisions to Promote to ADRs
- [DECISIONS.md entry date + title] — [reason it warrants an ADR]
(or "None")

### Proposed CLAUDE.md Updates
- [Convention change] — [reason]
(or "None")

### Spec Gaps for Next Step 0
- [Gap description] — [which reference doc needs updating]
(or "None")

### Metrics
- Total units: [N]
- First-pass review rate: [X/N] passed on first attempt
- Replanning events: [count]
- Calendar duration: [start date] → [end date]
```

---

## Forbidden Actions

The Planner Agent has strict boundaries. Violating any of these is a
hard failure — stop and reassess.

- **Never modify application code.** No changes to `src/`, `apps/`,
  `packages/`, or any non-documentation file. The Planner works with
  docs, subdivision docs, TASK-STATUS.md, DECISIONS.md, and
  MANIFEST.md only.
- **Never create `build/` branches.** Build branches are owned by the
  Build Agent (Step 3).
- **Never create `fix/` branches.** Fix branches are owned by the Docs
  Agent (Step 5).
- **Never create `docs/` branches.** Doc prep branches are owned by the
  Architect Agent (Step 0). The Planner uses `plan/` branches
  exclusively.
- **Never modify reference docs.** Specs, schemas, and feature docs
  live under the Architect Agent's authority. If the Planner discovers
  a spec gap, log it to DECISIONS.md and flag for Step 0 — do not fix
  it directly.
- **Never modify playbooks after they're generated.** Playbooks are
  historical records. If the playbook's criteria don't fit the
  subdivision, the Planner scopes criteria to units — it doesn't
  rewrite the playbook.
- **Never run tests or CI commands.** Testing belongs to the Build
  Agent. The Planner reads doc sections and file paths — it does not
  execute code.
- **Never write build prompts.** Build prompts live in the Prompting
  Roadmap (Steps 1–2). The Planner annotates prompts with context
  manifests but does not author the prompts themselves.
- **Never modify GLOSSARY.md.** Glossary changes are owned by the
  Architect Agent (Step 0) and Docs Agent (Step 5). If a new term is
  needed for the subdivision doc, flag it for the Architect.
- **Never skip the context budget test.** Every unit must have an
  estimated token budget in the Context Budget Verification table. A
  unit that "probably fits" is not acceptable — estimate it.

---

## Decision Patterns

### How Many Units?

```
Does the sub-phase touch only one stack layer?
  → Likely 2–3 units (CRUD split or concern split within the layer)
Does the sub-phase touch two layers (e.g., data + service)?
  → Likely 3–4 units (one per layer + possible cross-cutting unit)
Does the sub-phase touch three layers (data + service + UI)?
  → Likely 4–6 units (one per layer + possible CRUD splits + integration)
Does the sub-phase introduce a new system (sync engine, real-time, AI)?
  → Likely 5–8 units (system has its own internal decomposition)
```

These are starting points, not rules. Let the seam analysis and context
budget test determine the actual count.

### Shared Types: Separate Unit or Not?

```
Are the shared types derived from a schema (Drizzle infer types)?
  → Fold into the data/schema unit — they're a natural byproduct
Are the shared types custom (not schema-derived)?
  → How many downstream units consume them?
    → 1 unit → Fold into that unit
    → 2+ units → Make them Unit 1 (cross-cutting concern)
```

### When to Replan vs. Retry

```
Did the review fail on acceptance criteria only?
  → Retry with same plan (isolated failure)
Did the review fail because a type/function shape is wrong?
  → Replan — the interface contract needs revision
Did the review fail because the spec is incomplete?
  → Escalate — return to Step 0
```

---

## Checklist Before Every Merge

### Gate 1 (Subdivision Doc)

- [ ] Every unit has a complete interface contract (Produces + Consumes + Side Effects)
- [ ] Every Produces entry includes the export name and file path
- [ ] Every Consumes entry references a specific upstream unit's Produces entry
- [ ] Every unit has a context manifest with doc sections (name + line ranges)
- [ ] Line ranges in context manifests match current MANIFEST.md/section indexes
- [ ] Context Budget Verification table filled in for every unit
- [ ] No unit exceeds ~40% context budget estimate
- [ ] Dependency graph has no circular dependencies
- [ ] First unit has no unit-to-unit Consumes dependencies
- [ ] Parallel opportunities identified where they exist
- [ ] TASK-STATUS.md updated with one entry per unit (all `pending`)
- [ ] MANIFEST.md entry added for the subdivision doc
- [ ] All terms match GLOSSARY.md exactly
- [ ] No application code was modified
- [ ] Branch named `plan/<sub-phase-id>-subdivision` exactly
- [ ] Commit message follows format: `plan: <sub-phase-id> subdivision (N units)`

### Gate 3 (Replanning)

- [ ] Failure classified as isolated, contract-breaking, or cascading
- [ ] TASK-STATUS.md updated with correct status for failed and affected units
- [ ] DECISIONS.md entry written documenting the failure and response
- [ ] If contract-breaking: downstream units marked as `blocked`
- [ ] If contract-breaking: revised contracts written in subdivision doc
- [ ] If cascading: escalation flagged to Steven
- [ ] No application code was modified

### Gate 4 (Phase Boundary)

- [ ] All units show `docs-synced` in TASK-STATUS.md
- [ ] Sub-phase block moved to Completed Sub-Phases section
- [ ] DECISIONS.md entries reviewed for ADR promotion
- [ ] CLAUDE.md update proposals documented (if any)
- [ ] Spec gaps documented for next Step 0 (if any)
- [ ] Completion summary produced with all metrics
