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

Load these three docs in full for every playbook generation session:

1. `GLOSSARY.md` (~876 lines) — source of truth for naming, scope, definitions
2. `CLAUDE.md` (~461 lines) — project rules, conventions, CI gates
3. `MANIFEST.md` (~259 lines) — doc index, scope map, cross-references

Total: ~1,600 lines (~7,000 tokens). Budget remaining context for reference doc sections.

Also load:
- The phase division file for the target phase (`docs/phases/phase-division-*.md`)
- `playbook-generation-strategy.md` § Phase Definitions and Build Order (for phase tables and dependency graphs)
- `playbook-generation-strategy.md` § Phase-Specific Guidance (for the target phase only)
- This skill file

**Do NOT load** the full strategy doc. The process knowledge is in this skill.

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

### 3. Reference Loading Instructions Per Prompt

Each prompt specifies exactly which reference doc sections to load, using line ranges.

- Use Section Index tables from each reference doc
- Format: `Load context: sync-engine.md lines 69–87 (Field Type Registry), data-model.md lines 30–95 (Core Tables)`
- Never write "see sync-engine.md" without line ranges for docs with indexes
- For docs under ~200 lines without indexes, load whole: `Load context: forms.md (full, 182 lines)`
- Include `GLOSSARY.md (full)` and `CLAUDE.md (full)` in the phase preamble — don't repeat per prompt

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

**Example:**
```
Acceptance Criteria:
- [ ] testTenantIsolation() passes for getRecordsByTable() and getRecordById()
- [ ] createRecord() with valid canonical_data returns the new record with UUIDv7 id
- [ ] createRecord() with invalid field types returns validation error (Zod)
- [ ] canonical_data JSONB is keyed by fields.id, not field name
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
```

### 6. Phase-Level Preamble

Each playbook opens with a context block. Include these five sections:

1. **What Has Been Built** — prior phases and their key outputs (specific files/modules)
2. **What This Phase Delivers** — user-visible outcome when complete
3. **What This Phase Does NOT Build** — explicit scope exclusions
4. **Architecture Patterns for This Phase** — phase-specific conventions
5. **Mandatory Context for All Prompts** — CLAUDE.md auto-loads, GLOSSARY.md on demand, skills to load

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

**Template:**
```markdown
## VERIFY SESSION BOUNDARY (after Prompts X–Y)

**Scope:** Verify all work from Prompts X–Y integrates correctly.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings (if UI changes)
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations
7. Manual verification: [specific thing to check visually or functionally]

**Git:** Commit with message "chore(verify): verify prompts X–Y [Phase X, VP-N]", then push branch to origin.

Fix any failures before proceeding to Prompt Z.
```

**Note:** These are NOT additional prompts. They mark where the Prompting
Roadmap should insert a VERIFY session (fresh Claude Code context with
verify + test-runner skills). The BUILD context runs typecheck + lint
only; the VERIFY context runs the full suite above.

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

### Skills for This Phase
Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — [if backend]
- `docs/skills/ux-ui/SKILL.md` — [if UI work]
- `docs/skills/ai-features/SKILL.md` — [if AI features]
- `docs/skills/phase-context/SKILL.md` — Always.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | [name] | None | ~NNN |
| VP-1 | VERIFY Session Boundary | 1–4 | — |

---

## Prompt 1: [Clear Deliverable Name]

**Depends on:** None (or Prompt X, Y)
**Load context:** [reference doc] lines N–M (Section Name)
**Target files:** packages/shared/db/schema/records.ts, etc.
**Migration required:** Yes / No
**Git:** Commit with message "feat(scope): description [Phase X, Prompt 1]"

### Schema Snapshot
[Compact table/column listing, or "N/A — no schema changes"]

### Task
[Clear, specific implementation instructions with patterns from reference docs]

### Acceptance Criteria
- [ ] Specific testable condition
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Out-of-scope item

---

## VERIFY Session Boundary (after Prompts 1–N)
...
```

---

## Context Management Rules

### The ~800-Line Rule

No single prompt's reference doc loading should exceed ~800 lines. Total context per prompt: ~2,400 lines of specification + implementation headroom.

If a prompt needs >800 lines of reference context:
1. The prompt is too large — split it
2. You're loading unnecessary sections — trim

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

### Quality Indicators

A well-crafted prompt has:
- A deliverable name a non-coder could understand
- A schema snapshot showing exactly what exists and what's being added
- Acceptance criteria where every checkbox is verifiable
- A "Do NOT Build" section proving you thought about scope creep
- Precise reference doc line ranges

A poorly-crafted prompt:
- Tries to do too many things
- Uses vague names ("Set up communications")
- Has vague criteria ("communications work correctly")
- Loads entire reference docs
- Lacks schema snapshots when touching the database

**When in doubt, make it smaller and more precise.**

---

## Quality Checklist

Before delivering a playbook, verify:
- [ ] Phase preamble includes all 5 sections
- [ ] Every prompt has: Depends on, Load context (line ranges), Target files, Schema snapshot (or N/A), Task, Acceptance criteria, Do NOT build, Git instruction
- [ ] No prompt's Load context exceeds ~800 lines
- [ ] VERIFY session boundaries after every 3–5 prompts
- [ ] Dependency graph is a DAG (no circular dependencies)
- [ ] Migration requirements noted on every schema-touching prompt
- [ ] All naming matches `GLOSSARY.md` exactly
- [ ] MVP scope matches `GLOSSARY.md` includes/excludes
- [ ] File paths use monorepo structure from `CLAUDE.md`
- [ ] Test file naming follows `CLAUDE.md` conventions
- [ ] Existing prompt roadmaps in reference docs consulted and adapted
- [ ] Post-MVP features in "Do NOT Build" sections, not accidentally included
