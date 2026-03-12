---
name: everystack-builder
description: >
  Build execution process for EveryStack's six-step build lifecycle (Step 3).
  Use this skill when executing playbook prompts in Claude Code BUILD contexts.
  Triggers on: building features from a playbook, executing build prompts,
  running static checks (typecheck/lint), committing build work, or any task
  labeled "Step 3" or "Builder Agent". Contains how to load prompt context,
  the static check sequence (typecheck→lint), failure handling patterns,
  commit cadence, push rules, and MODIFICATIONS.md session logging. Load this
  skill at the start of every BUILD session. Tests and coverage are handled
  by the verify skill in a separate VERIFY context. Never use this skill for
  playbook generation (Step 1), roadmap generation (Step 2), review (Step 4),
  or docs sync (Step 5).
---

# EveryStack Builder Skill

This skill encodes the build execution process for Claude Code sessions.
It is the source of truth for how build prompts are executed, verified, and
committed. Load this skill at the start of every Step 3 (Build Execution)
session alongside the `phase-context` skill and any domain-specific skills
specified in the playbook preamble.

## When to Use This Skill

- **Always** for Step 3 of any sub-phase lifecycle
- **Always** when executing playbook prompts in Claude Code
- **Never** for playbook generation, roadmap generation, review, or docs sync

## Mandate

Execute playbook prompts to produce working code. Follow the prompt's
instructions precisely. After each prompt, run typecheck + lint only.
Commit with conventional messages. After all prompts in the BUILD session
are complete, log the session to MODIFICATIONS.md. Tests run in a separate
VERIFY context.

**Session type:** Claude Code (BUILD context)
**Branch ownership:** `build/` branches only
**Scope boundary:** This skill covers building, static checks, and session
logging only. Testing, coverage, and Docker-dependent verification belong
to the verify skill, run in a separate VERIFY context.

---

## Context Loading at Session Start

When a build session begins:

1. **CLAUDE.md** — auto-loaded from monorepo root (zero effort)
2. **This skill** (`docs/skills/builder/SKILL.md`) — build process rules
3. **Phase-context skill** (`docs/skills/phase-context/SKILL.md`) — current build state
4. **Domain skills** as specified in the playbook preamble:
   - `docs/skills/backend/SKILL.md` — if backend work
   - `docs/skills/ux-ui/SKILL.md` — if UI work
   - `docs/skills/ai-features/SKILL.md` — if AI work

**Do NOT load:**
- MANIFEST.md (consumed during playbook generation, not needed during build)
- GLOSSARY.md (available on demand at `docs/reference/GLOSSARY.md` — consult when naming new things)
- The full playbook document (each prompt is pasted individually)
- Subdivision docs (the playbook already encodes unit boundaries and context manifests — the builder doesn't need to read the subdivision doc directly)

**Context budget:** ~15K (system) + ~2K (CLAUDE.md) + ~1K–4K (prompt + reference sections) ≈ 18K–21K of 200K tokens (~10%). This leaves ~180K tokens for reading source, writing code, and fixing static check failures.

---

## Per-Prompt Execution Process

For each playbook prompt pasted into Claude Code:

### 1. Read the Prompt

Parse the prompt for:
- **Unit:** Which unit this prompt belongs to (from the playbook)
- **Load context:** Read the specified reference doc sections (line ranges)
- **Target files:** Note where files will be created/modified
- **Schema snapshot:** Understand the database state
- **Depends on:** Verify prior prompt outputs exist
- **Migration required:** Note if a migration file is needed

### 2. Load Reference Context

Read the reference doc sections specified in the prompt's `Load context` field.
Do NOT load entire reference docs — only the line ranges specified.
Do NOT load docs not listed in the prompt.

### 3. Build

Implement the prompt's Task section. Follow these rules:
- Use patterns from the loaded reference doc sections
- Follow all conventions from CLAUDE.md and loaded skills
- Create files at the paths specified in `Target files`
- If the prompt says "No migration required," do not create a migration
- If the prompt says "Migration required," create a new migration file — never modify existing ones

### 4. Static Checks (BUILD context only)

After implementation, run static checks:

```bash
# Step 1: TypeScript compilation (catches type errors)
pnpm turbo typecheck

# Step 2: Linting (catches style violations)
pnpm turbo lint
```

**Both must pass before considering the prompt complete.**

Do NOT run tests in the BUILD context. Tests, coverage, and integration
verification happen in a separate VERIFY context (see verify skill).
This keeps the BUILD context focused on code generation with maximum
context budget available for playbook content and reference docs.

### 5. Check Static Acceptance Criteria

Walk through the prompt's acceptance criteria that can be verified statically:
- Files created at the specified paths
- TypeScript compiles with zero errors
- ESLint passes with zero errors
- No hardcoded English strings (visual check)
- [CONTRACT] criteria: if this is the unit's final prompt, verify contract
  exports exist at the specified paths

Test-related criteria (test existence, coverage targets, tenant isolation)
are verified in the VERIFY context.

### 6. Commit

After static checks pass, commit with the message specified in the prompt's `Git` field.

### 7. Track Changes (running log during session)

As you complete each prompt, keep a running mental note of:
- Files created (with one-line descriptions)
- Files modified (with one-line descriptions of what changed)
- Files deleted (with reason)
- Schema changes (new tables, columns, migrations)
- New domain terms introduced (new table names, function names, component
  names, UI labels that aren't yet in GLOSSARY.md)

These feed into the MODIFICATIONS.md session block at the end of the
BUILD session.

---

## Session Logging — MODIFICATIONS.md

**At the end of every BUILD session** (after all prompts for this session
are committed), append a session block to MODIFICATIONS.md. This is the
bridge to the Reviewer (Step 4) and Docs Agent (Step 5).

**When to write:** After the last prompt's commit, before ending the session.
The Prompting Roadmap will include a `[STATE UPDATE]` label reminding
Steven to verify this was done, but the builder should do it proactively.

**Session block format:**

```markdown
## [Session ID] — [Sub-phase ID] — build/[branch-name]

**Date:** YYYY-MM-DD
**Status:** built
**Unit(s):** [Unit number(s) this session covered]
**Prompt(s):** [Prompt numbers executed]

### Files Created
- `path/to/new-file.ts` — [1-line description]

### Files Modified
- `path/to/existing-file.ts` — [1-line description of what changed]

### Files Deleted
- `path/to/removed-file.ts` — [1-line reason]

### Schema Changes
- Added table: `table_name` — [1-line description]
- Added column: `table_name.column_name` — [type, purpose]
- Migration: `XXXX_descriptive_name.ts`

### New Domain Terms Introduced
- `TermName` — [brief definition, for Docs Agent to check against GLOSSARY.md]

### Notes
[Anything the VERIFY session, Reviewer, or Docs Agent needs to know.
Tactical decisions made during implementation that should be logged to
DECISIONS.md. Optional.]
```

**Rules:**
- One session block per BUILD session (not per prompt)
- List every file, even if it seems obvious — the Docs Agent uses this
  to avoid grepping the diff
- For schema changes, list both the Drizzle schema file and the migration file
- For new domain terms, provide enough definition that the Docs Agent can
  write a GLOSSARY.md entry without re-reading the code
- Set Status to `built` — it changes to `passed-review` after the VERIFY
  session and `docs-synced` after Step 5

---

## Failure Handling

### TypeScript Errors

1. Read the error messages
2. Fix the type errors in the affected files
3. Re-run `pnpm turbo typecheck`
4. If the fix introduces new errors, address those too
5. Do NOT use `@ts-ignore` or `any` to suppress errors

### Lint Errors

1. Read the ESLint output
2. Fix violations (no `console.log`, no `any`, no hardcoded English strings)
3. Re-run `pnpm turbo lint`
4. Do NOT use `eslint-disable` comments unless the rule is genuinely inapplicable

### Repeated Failures

If the same static check fails 3+ times:
1. Step back and reconsider the approach
2. Re-read the reference doc sections for the correct pattern
3. Check if a prior prompt's output is in an unexpected state
4. If blocked, describe the issue clearly — do not brute-force
5. Log the issue in the session's MODIFICATIONS.md Notes section

### Test Failures (VERIFY context only)

Test failures are handled in the VERIFY context using the verify skill.
If a VERIFY session reports back that tests fail due to implementation
issues, those fixes happen in a new BUILD context or inline in the
VERIFY context — whichever is more practical.

---

## Commit Cadence

**One commit per prompt.** After each prompt's acceptance criteria pass.

**Commit message format:**
```
<area>: <what changed> [Phase X, Prompt N]

Optional body explaining WHY.
```

**Area prefixes:** `docs`, `schema`, `feat`, `fix`, `refactor`, `test`, `chore`, `audit`

**Examples:**
```
feat(db): create records and fields schema with RLS policies [Phase 1B, Prompt 3]
feat(sync): implement AirtableAdapter.toCanonical() for core field types [Phase 2, Prompt 4]
```

---

## Push Cadence

**Push at the end of every VERIFY session.** Not after every BUILD commit.

Rhythm:
1. BUILD session: Prompt 1 → commit, Prompt 2 → commit, Prompt 3 → commit → log to MODIFICATIONS.md
2. VERIFY session: run tests, fix failures, commit fixes, **push**
3. BUILD session: Prompt 4 → commit, Prompt 5 → commit → log to MODIFICATIONS.md
4. VERIFY session: run tests, fix failures, commit fixes, **push**
5. ...repeat

---

## BUILD/VERIFY Session Boundary

The BUILD context does NOT run tests. It builds code and runs static checks.
After a group of BUILD prompts, Steven opens a fresh VERIFY context that:

1. Loads verify + test-runner skills (not builder/playbook)
2. Runs the full verification suite (typecheck, lint, i18n, tests, coverage)
3. If unit-completing: verifies interface contract items
4. Fixes any failures
5. Commits fixes and pushes
6. Updates TASK-STATUS.md and MODIFICATIONS.md

This replaces the old "Integration Checkpoint" pattern. The verification
work is identical, but it happens in a dedicated context with full testing
knowledge instead of competing with playbook content for context budget.

---

## Branch Rules

- **Create:** `build/<sub-phase>` from `main` at session start
- **Commit:** After each prompt (in BUILD context)
- **Log:** MODIFICATIONS.md session block at end of BUILD session
- **Push:** At the end of each VERIFY session
- **PR:** At sub-phase end — title format: `[Step 3] Phase X — <Name>`
- **Merge:** Squash merge to main. Delete the branch.

**Forbidden:**
- Never modify reference docs under `docs/` (except skill files if explicitly instructed)
- Never create `docs/`, `plan/`, or `fix/` branches
- Never push to main directly

---

## Handling Cross-Phase References

When a prompt references something from a prior phase, do NOT re-load prior phase reference docs. The playbook prompt already states what exists. Trust the prompt's "What Has Been Built" and schema snapshots.

If you need to verify something exists in the codebase, read the actual source file — don't consult reference docs.

---

## Handling Unit Boundaries

When the playbook marks a prompt as the first in a new unit, note the unit
transition. The prompt will include the unit's interface contract summary
from the playbook's Unit Context section. This tells you what the unit
must produce by its final prompt.

When the playbook marks a prompt as the last in a unit, pay special
attention to [CONTRACT] acceptance criteria — these are the exports and
side effects that downstream units depend on. Verify they exist before
committing.
