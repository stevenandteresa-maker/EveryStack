---
name: everystack-playbook-gen
description: >
  Playbook generation process for EveryStack's six-step build lifecycle (Step 1).
  Use this skill when producing a playbook document for any sub-phase. Triggers on:
  generating a playbook, decomposing reference docs into prompts, creating atomic
  prompt units, building dependency graphs, or any task labeled "Step 1" or
  "Playbook Generation". Contains the 10 quality characteristics, prompt sizing
  rules, schema snapshot format, acceptance criteria format, dependency graph rules,
  VERIFY session boundary template, file path conventions, and git commit format.
  Never use this skill for build execution (Step 3), review (Step 4), or docs
  sync (Step 5). This skill replaces the process sections of
  playbook-generation-strategy.md — the strategy doc retains phase definitions
  and phase-specific guidance only.
---

# EveryStack Playbook Generation Skill

This skill encodes the repeatable process for producing playbook documents —
the technical build roadmaps that Claude Code executes to build EveryStack.
It is the source of truth for playbook structure, prompt quality, and
decomposition rules. Load this skill in any Claude.ai session whose purpose
is to produce a playbook (Step 1 of the six-step lifecycle).

## When to Use This Skill

- **Always** for Step 1 of any sub-phase lifecycle
- **Always** when decomposing reference docs into atomic prompts
- **Never** for build execution, review, or docs sync
- **Never** in Claude Code sessions — playbooks are authored in Claude.ai

## Authority Chain

When conventions conflict, resolve in this order:
1. `GLOSSARY.md` — naming, scope, definitions
2. `CLAUDE.md` (project root) — project-wide rules, tech stack, CI gates
3. This skill — playbook structure and quality rules
4. `playbook-generation-strategy.md` — phase definitions and phase-specific guidance

---

## Mandatory Context for Playbook Sessions

Load these docs in full for every playbook generation session:

1. `GLOSSARY.md` (~876 lines) — source of truth for naming, scope, definitions
2. `CLAUDE.md` (~461 lines) — project rules, conventions, CI gates
3. `MANIFEST.md` (~259 lines) — doc index, scope map, cross-references

Total: ~1,600 lines (~7,000 tokens). Budget remaining context for reference doc sections.

Also load:
- **The subdivision doc for this sub-phase** (`docs/subdivisions/<sub-phase-id>-subdivision.md`) — this is the primary decomposition guide. It defines the units, their interface contracts, context manifests, and dependency ordering. The playbook decomposes *within* these units, not from scratch.
- The phase division file for the target phase (`docs/phases/phase-division-*.md`)
- `playbook-generation-strategy.md` § Phase Definitions and Build Order (for phase tables and dependency graphs)
- `playbook-generation-strategy.md` § Phase-Specific Guidance (for the target phase only)
- This skill file

**Do NOT load** the full strategy doc. The process knowledge is in this skill.

---

## Subdivision-Aware Decomposition

When a subdivision doc exists for the sub-phase (which it should — the
Planner Agent produces it at Gate 1 before playbook generation begins),
the playbook generation process changes in three ways:

### 1. Units Are the Decomposition Boundary

Do NOT decompose the full sub-phase into prompts from scratch. Instead,
decompose each **unit** from the subdivision doc into prompts independently.
This means:

- Read Unit 1's interface contract, context manifest, and acceptance criteria
- Decompose Unit 1 into prompts (typically 2–5 prompts per unit)
- Then read Unit 2 and decompose it
- And so on through all units

The subdivision doc's dependency graph determines the order of units in the
playbook. Prompts within a unit are sequenced by the playbook author. Prompts
across units follow the unit dependency chain.

### 2. Context Loading Comes from the Context Manifest

Each unit in the subdivision doc carries a context manifest — the exact doc
sections (with line ranges) and source files the Build Agent needs. Use these
manifests as the basis for each prompt's `Load context:` field.

- If the manifest says `data-model.md § Workspaces (lines 142–198)`, that's
  what goes in the prompt's Load context
- If a prompt within a unit needs a subset of the manifest, narrow it further
- Never load context not in the manifest unless you discover a genuine gap
  (in which case, flag it — the Planner should have caught this)

### 3. Interface Contracts Drive Acceptance Criteria

Each unit's acceptance criteria in the subdivision doc become the foundation
for prompt-level acceptance criteria in the playbook. The contract's
**Produces** entries must appear as verifiable acceptance criteria across the
unit's prompts:

- If the contract says `Produces: getWorkspaceById(tenantId, workspaceId): Promise<WorkspaceRecord | null>`, at least one prompt's acceptance criteria must verify that function exists with that signature
- If the contract says `Side Effects: Registers BullMQ queue: workspace-sync`, a prompt must verify that queue registration

Every contract item must be covered by at least one prompt's acceptance
criteria. The Reviewer Agent will verify this.

### When No Subdivision Doc Exists

If no subdivision doc exists (e.g., the sub-phase predates the Planner
process, or is small enough to skip subdivision), fall back to the original
process: decompose the full sub-phase into prompts using the reference doc
map and seam analysis. This is the legacy path and still works — the
subdivision doc just makes it more systematic.

---

## The 10 Quality Characteristics

Every playbook must exhibit all 10. Here is how to implement each one:

### 1. Prompt-Based Atomic Units

Each prompt has one clear deliverable completable in a single Claude Code session.

**Sizing rules:**
- Name the prompt after its deliverable: "Build AirtableAdapter.toCanonical() for text, number, and date fields" — not "Set up the sync layer"
- A prompt producing more than ~3 files or ~400 lines of implementation is too large — split it
- A prompt touching more than 2 monorepo packages is probably too large — split it
- If acceptance criteria need >6 checkboxes, the prompt is too big

**The subdivision test:** "Can I explain in one sentence what this prompt builds?" If the answer requires "and" — split it.

**Good deliverable names:**
- "Create the `records` and `fields` Drizzle schema with tenant isolation and RLS policies"
- "Implement Grid view cell renderer for text, number, date, and status field types"

**Bad deliverable names:**
- "Build the permissions system" (too large)
- "Set up the database" (too vague)

### 2. Dependency Graph

Each prompt declares which prior prompts it depends on, forming a DAG.

- `Depends on: None` for prompts that can start immediately
- `Depends on: 3, 7` means requires outputs of prompts 3 and 7
- Remove false sequential dependencies — only add when output is actually consumed
- Cross-phase: `Depends on: Phase 1 complete` or `Depends on: Phase 2, Prompt 8 (FieldTypeRegistry)`

**Unit-level dependencies:** When a prompt depends on a prior unit's output,
reference the unit's interface contract rather than a specific prompt number
from that unit. Example: `Depends on: Unit 1 complete (produces WorkspaceRecord type)`
This makes cross-unit dependencies explicit and contract-verifiable.

### 3. Reference Loading Instructions Per Prompt

Each prompt specifies exactly which reference doc sections to load, using line ranges.

- Use Section Index tables from each reference doc
- Format: `Load context: sync-engine.md lines 69–87 (Field Type Registry), data-model.md lines 30–95 (Core Tables)`
- Never write "see sync-engine.md" without line ranges for docs with indexes
- For docs under ~200 lines without indexes, load whole: `Load context: forms.md (full, 182 lines)`
- Include `GLOSSARY.md (full)` and `CLAUDE.md (full)` in the phase preamble — don't repeat per prompt

**When a subdivision doc exists:** The unit's context manifest is the starting
point. Each prompt's `Load context` should be a subset of (or equal to) the
manifest. If you find yourself adding context not in the manifest, verify it's
genuinely needed — the Planner curated the manifest to be minimal-but-sufficient.

### 4. Schema Snapshots

Each prompt touching the database includes a compact snapshot of relevant tables/columns.

**Format:**
```
Schema snapshot (from data-model.md lines 40–55):
  records: id (UUIDv7 PK), tenant_id, table_id, canonical_data (JSONB), source_refs (JSONB), created_by, created_at, updated_at
  fields: id (UUIDv7 PK), tenant_id, table_id, name, field_type, config (JSONB), position, environment, created_at
```

- Show only columns this prompt reads or writes
- For new tables, show the full schema to create
- For column additions, show existing + new (marked `-- NEW`)
- Reference exact lines in `data-model.md`

### 5. Test-First Acceptance Criteria

Every prompt ends with specific, testable conditions that define "done."

- Checkbox format: `- [ ] Condition`
- Each condition verifiable by running a test or checking a concrete artifact
- Include specific test function names where possible
- Always include at minimum:
  - One functional test (the feature works)
  - One tenant isolation test (for any data access function)
  - `ESLint and TypeScript compile with zero errors`
- Reference testing rules from `CLAUDE.md` (coverage targets, file naming, factory usage)

**Interface contract criteria:** When a prompt completes a unit's final
deliverable, include acceptance criteria that verify the interface contract's
Produces entries. These are the criteria the Reviewer Agent uses to confirm
the unit fulfilled its contract. Mark them with `[CONTRACT]`:

```
Acceptance Criteria:
- [ ] [CONTRACT] getRecordsByTable() exported from apps/web/src/data/records.ts
- [ ] [CONTRACT] getRecordById() exported with signature (tenantId: string, recordId: string): Promise<Record | null>
- [ ] testTenantIsolation() passes for getRecordsByTable() and getRecordById()
- [ ] createRecord() with valid canonical_data returns the new record with UUIDv7 id
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
```

### 6. Phase-Level Preamble

Each playbook opens with a context block. Include these six sections:

1. **What Has Been Built** — prior phases and their key outputs (specific files/modules)
2. **What This Phase Delivers** — user-visible outcome when complete
3. **What This Phase Does NOT Build** — explicit scope exclusions
4. **Architecture Patterns for This Phase** — phase-specific conventions
5. **Mandatory Context for All Prompts** — CLAUDE.md auto-loads, GLOSSARY.md on demand, skills to load
6. **Subdivision Summary** — list all units from the subdivision doc with
   their names, interface contracts (Produces summary), and dependency
   ordering. This gives the Build Agent the full unit map at a glance.

### 7. File Path Conventions Per Prompt

Each prompt specifies where to create files using the monorepo structure from `CLAUDE.md`.

- Format: `Target files: packages/shared/db/schema/records.ts, packages/shared/db/schema/fields.ts`
- For new directories: `Create directory: packages/shared/sync/adapters/`
- Use naming conventions from `CLAUDE.md`: kebab-case files, PascalCase components, camelCase functions

**Key monorepo paths:**
```
apps/web/src/app/          — Routes and layouts
apps/web/src/components/   — React components
apps/web/src/data/         — Server-side data access
apps/web/src/actions/      — Server Actions
apps/web/src/lib/          — Client utilities
apps/web/e2e/              — Playwright E2E tests
apps/worker/src/jobs/      — BullMQ job processors
apps/realtime/             — Socket.io server
packages/shared/db/schema/ — Drizzle schema definitions
packages/shared/db/migrations/ — Drizzle migration files
packages/shared/sync/adapters/ — Platform adapters
packages/shared/ai/        — AI providers, prompts, tools, eval
packages/shared/testing/   — Shared test utilities and factories
```

### 8. VERIFY Session Boundaries

After every 3–5 prompts, mark a VERIFY session boundary. This tells the
roadmap generator where to insert a BUILD/VERIFY session split.

**Unit boundary alignment rule:** VERIFY session boundaries should align
with unit boundaries whenever possible. If a unit contains 3 prompts, the
VERIFY happens after that unit's final prompt — don't split a unit across
two BUILD/VERIFY cycles unless the unit has more than 5 prompts. When a
unit has 6+ prompts, split within the unit but note which VERIFY is
mid-unit vs. unit-completing:

```markdown
## VERIFY SESSION BOUNDARY (after Prompts X–Y) — Completes Unit N

or

## VERIFY SESSION BOUNDARY (after Prompts X–Y) — Mid-Unit N
```

This alignment means the Reviewer can verify interface contracts at unit
boundaries and the Build Agent starts each unit in a fresh context.

**Template:**
```markdown
## VERIFY SESSION BOUNDARY (after Prompts X–Y) — [Completes Unit N / Mid-Unit N]

**Scope:** Verify all work from Prompts X–Y integrates correctly.
**Unit status:** [Unit N complete — verify contract / Unit N in progress — verify static checks only]

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings (if UI changes)
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations
7. Manual verification: [specific thing to check visually or functionally]

**Interface contract check (unit-completing only):**
Verify these exports exist and match the subdivision doc's contract:
- [ ] [CONTRACT] export 1
- [ ] [CONTRACT] export 2

**State file updates:**
- Update TASK-STATUS.md: Unit N → `passed-review` (if unit-completing)
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts X–Y [Phase X, VP-N]", then push branch to origin.

Fix any failures before proceeding to Prompt Z.
```

### 9. Post-MVP Guardrails Per Prompt (Do NOT Build)

Each prompt lists what NOT to build, preventing scope creep.

- Check `GLOSSARY.md` "MVP Explicitly Excludes" table
- Check the reference doc for (post-MVP) annotations
- List 2–5 specific tempting items

### 10. Migration Awareness

Any prompt modifying the database schema explicitly notes migration requirements.

- State: "This prompt requires a new migration file."
- Reference migration constraints: no ACCESS EXCLUSIVE lock >1s, no migration >30s on staging data
- File naming: `packages/shared/db/migrations/XXXX_descriptive_name.ts`
- State: "Never modify existing migration files — always create a new one."
- For prompts that don't touch schema: "No migration required."

---

## Playbook Document Template

Every playbook follows this structure:

```markdown
# Phase N[X] — [Phase Name]

## Phase Context

### What Has Been Built
[List prior phases and their key deliverables — files, modules, tables that now exist]

### What This Phase Delivers
[User-visible outcome when complete]

### What This Phase Does NOT Build
[Explicit exclusions — things that would be tempting but are post-MVP or later phase]

### Architecture Patterns for This Phase
[Phase-specific conventions, patterns, and constraints]

### Mandatory Context for All Prompts
`CLAUDE.md` is the project root file — Claude Code auto-loads it.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult when naming new things.
`MANIFEST.md` is not needed during build execution.

### Subdivision Summary
This sub-phase is decomposed into [N] units per the subdivision doc
(`docs/subdivisions/<sub-phase-id>-subdivision.md`):

| Unit | Name | Produces | Depends On |
|------|------|----------|------------|
| 1 | [name] | [key exports] | None |
| 2 | [name] | [key exports] | Unit 1 |
| ... | ... | ... | ... |

## PJ Decision Gate

The following prompts require Steven's review before build begins.
Each addresses a spec gap that may need resolution or explicit
confirmation.

| # | Prompt | PJ Concern | Resolution Options |
|---|--------|------------|-------------------|
| N | [name] | [the gap]  | (a) [option] (b) [option] (c) Proceed with builder judgment |

> If no prompts are classified PJ, this table is omitted and replaced
> with: "**PJ Decision Gate:** None — all prompts are D or SH."

### Skills for This Phase
Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — [if backend]
- `docs/skills/ux-ui/SKILL.md` — [if UI work]
- `docs/skills/ai-features/SKILL.md` — [if AI features]
- `docs/skills/phase-context/SKILL.md` — Always.

---

## Section Index

| Prompt | Unit | Deliverable | Depends On | Lines (est.) |
|--------|------|-------------|------------|--------------|
| 1 | 1 | [name] | None | ~NNN |
| 2 | 1 | [name] | 1 | ~NNN |
| VP-1 | — | VERIFY — Completes Unit 1 | 1–2 | — |
| 3 | 2 | [name] | Unit 1 complete | ~NNN |

---

## — Unit 1: [Unit Name] —

### Unit Context
[Big-picture anchor from subdivision doc — 1–2 sentences]

**Interface Contract:**
Produces: [from subdivision doc]
Consumes: [from subdivision doc]

---

## Prompt 1: [Clear Deliverable Name]

**Unit:** 1
**Depends on:** None (or Prompt X, Y)
**Load context:** [from unit's context manifest — reference doc lines]
**Target files:** packages/shared/db/schema/records.ts, etc.
**Migration required:** Yes / No
**Git:** Commit with message "feat(scope): description [Phase X, Prompt 1]"

### Schema Snapshot
[Compact table/column listing, or "N/A — no schema changes"]

### Task
[Clear, specific implementation instructions with patterns from reference docs]

### Acceptance Criteria
- [ ] Specific testable condition
- [ ] [CONTRACT] Export matches interface contract (on unit-final prompts)
- [ ] ESLint and TypeScript compile with zero errors

**RSA Classification:** [D / SH / PJ]
**RSA Rationale:** [1–2 sentences. Reference specific spec sections.]
**Reviewer Focus:** [What the reviewer should focus on given the
classification. For D: "Spec-match check against [doc § section]."
For SH: "Validate [constraint] from [doc § section]." For PJ:
"Evaluate judgment call on [gap]. Steven reviews."]

### Do NOT Build
- Out-of-scope item

---

## Prompt 2: [Clear Deliverable Name]
...

---

## VERIFY Session Boundary (after Prompts 1–2) — Completes Unit 1
...

---

## — Unit 2: [Unit Name] —

### Unit Context
...

## Prompt 3: [Clear Deliverable Name]
**Unit:** 2
**Depends on:** Unit 1 complete (produces [key export])
...
```

---

## Context Management Rules

### The ~800-Line Rule

No single prompt's reference doc loading should exceed ~800 lines. Total context per prompt: ~2,400 lines of specification + implementation headroom.

If a prompt needs >800 lines of reference context:
1. The prompt is too large — split it
2. You're loading unnecessary sections — trim

**With subdivision docs:** This should rarely be an issue. The Planner's
context budget test already ensures each unit's full manifest fits within
~40% of context. If a prompt within a unit needs more than ~800 lines, the
unit itself is probably too large — flag this back to the Planner.

### Section Index Usage

All reference docs 300+ lines have section indexes. Use them aggressively:
- ✅ `sync-engine.md lines 69–87 (Field Type Registry)`
- ❌ `sync-engine.md` (full 1,079-line file)

### Docs Under ~200 Lines

Load whole: `forms.md` (182), `observability.md` (173), `command-bar.md` (163), `settings.md` (113).

### Cross-Phase Context

Don't re-load prior phase reference docs. State what exists as a fact:
> "The `records` table exists with columns: id, tenant_id, table_id, canonical_data..."

---

## Quality-First Mandate

When producing playbooks, the singular priority is quality. Not speed, not conciseness, not minimizing sub-phases.

**Take your time.** Read every relevant reference doc section. Understand the architecture. Trace the data flow. Identify edge cases. Only then decompose.

**Subdivide aggressively.** If a sub-phase still feels too large, split further. There is no upper limit on sub-phases.

**Think about the developer experience.** A precise prompt with clear schema snapshot, specific file paths, and testable acceptance criteria produces production-quality code.

**Think about the founder experience.** Every prompt's deliverable must be explainable in plain English.

**Respect the subdivision doc.** When one exists, it represents planning
work that already identified the right seams, contracts, and context budgets.
The playbook's job is to decompose within units, not to second-guess the
unit boundaries. If a unit boundary seems wrong, flag it — don't silently
reorganize.

### Quality Indicators

A well-crafted prompt has:
- A deliverable name a non-coder could understand
- A schema snapshot showing exactly what exists and what's being added
- Acceptance criteria where every checkbox is verifiable
- A "Do NOT Build" section proving you thought about scope creep
- Precise reference doc line ranges
- A Unit assignment matching the subdivision doc
- [CONTRACT] criteria on unit-final prompts verifying the interface contract

A poorly-crafted prompt:
- Tries to do too many things
- Uses vague names ("Set up communications")
- Has vague criteria ("communications work correctly")
- Loads entire reference docs
- Lacks schema snapshots when touching the database
- Ignores the subdivision doc's unit boundaries
- Loads context not in the unit's manifest without justification

**When in doubt, make it smaller and more precise.**

---

## Quality Checklist

Before delivering a playbook, verify:
- [ ] Phase preamble includes all 6 sections (including Subdivision Summary)
- [ ] Every prompt has: Unit, Depends on, Load context (line ranges), Target files, Schema snapshot (or N/A), Task, Acceptance criteria, Do NOT build, Git instruction
- [ ] Every prompt's Load context is a subset of its unit's context manifest
- [ ] No prompt's Load context exceeds ~800 lines
- [ ] VERIFY session boundaries after every 3–5 prompts
- [ ] VERIFY boundaries align with unit boundaries where possible
- [ ] Every unit's interface contract Produces entries are covered by [CONTRACT] acceptance criteria
- [ ] Unit-completing VERIFY boundaries include interface contract checks
- [ ] Dependency graph is a DAG (no circular dependencies)
- [ ] Cross-unit dependencies reference unit contracts, not arbitrary prompt numbers
- [ ] Migration requirements noted on every schema-touching prompt
- [ ] All naming matches `GLOSSARY.md` exactly
- [ ] MVP scope matches `GLOSSARY.md` includes/excludes
- [ ] File paths use monorepo structure from `CLAUDE.md`
- [ ] Test file naming follows `CLAUDE.md` conventions
- [ ] Existing prompt roadmaps in reference docs consulted and adapted
- [ ] Post-MVP features in "Do NOT Build" sections, not accidentally included
- [ ] State file update instructions included in VERIFY boundaries
- [ ] Every prompt has an RSA classification with rationale
- [ ] All PJ prompts appear in the PJ Decision Gate table
- [ ] PJ Decision Gate includes resolution options for each concern
- [ ] RSA rationale references specific spec sections (not just "the spec")
