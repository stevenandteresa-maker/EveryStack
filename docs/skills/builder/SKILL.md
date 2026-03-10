---
name: everystack-builder
description: >
  Build execution process for EveryStack's six-step build lifecycle (Step 3).
  Use this skill when executing playbook prompts in Claude Code. Triggers on:
  building features from a playbook, executing build prompts, running verification
  checks (typecheck/lint/test), committing build work, or any task labeled
  "Step 3" or "Builder Agent". Contains how to load prompt context, the
  verification check sequence (typecheck→lint→test), failure handling patterns,
  commit cadence, and push rules. Load this skill at the start of every build
  session in Claude Code. Never use this skill for playbook generation (Step 1),
  roadmap generation (Step 2), review (Step 4), or docs sync (Step 5).
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

Execute playbook prompts to produce working, tested code. Follow the prompt's
instructions precisely. Verify after each prompt. Commit with conventional
messages. Push at integration checkpoints.

**Session type:** Claude Code
**Branch ownership:** `build/` branches only

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

**Context budget:** ~15K (system) + ~2K (CLAUDE.md) + ~1K–4K (prompt + reference sections) ≈ 18K–21K of 200K tokens (~10%). This leaves ~180K tokens for reading source, writing code, running tests, and debugging.

---

## Per-Prompt Execution Process

For each playbook prompt pasted into Claude Code:

### 1. Read the Prompt

Parse the prompt for:
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

### 4. Verify

After implementation, run the verification sequence:

```bash
# Step 1: TypeScript compilation (catches type errors)
pnpm turbo typecheck

# Step 2: Linting (catches style violations)
pnpm turbo lint

# Step 3: Tests (catches functional regressions)
pnpm turbo test
```

**All three must pass before considering the prompt complete.**

### 5. Check Acceptance Criteria

Walk through every acceptance criterion in the prompt. For each:
- If it's a test: verify the test exists and passes
- If it's a coverage target: run `pnpm turbo test -- --coverage` and check
- If it's a build check: verify compilation succeeds

### 6. Commit

After all checks pass, commit with the message specified in the prompt's `Git` field.

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

### Test Failures

1. Read the test output carefully — identify the failing assertion
2. Determine if the failure is in the test or the implementation
3. Fix the root cause (prefer fixing implementation over fixing tests)
4. Re-run the specific failing test first, then the full suite
5. Do NOT delete or skip failing tests

### Repeated Failures

If the same check fails 3+ times:
1. Step back and reconsider the approach
2. Re-read the reference doc sections for the correct pattern
3. Check if a prior prompt's output is in an unexpected state
4. If blocked, describe the issue clearly — do not brute-force

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

**Push at every Integration Checkpoint.** Not after every commit.

Rhythm:
1. Prompt 1 → commit locally
2. Prompt 2 → commit locally
3. Prompt 3 → commit locally
4. Integration Checkpoint 1 → commit, then **push**
5. Prompt 4 → commit locally
6. ...repeat

---

## Integration Checkpoint Process

At each integration checkpoint:

```bash
# Full verification suite
pnpm turbo typecheck        # zero errors
pnpm turbo lint              # zero errors
pnpm turbo test              # all pass
pnpm turbo test -- --coverage  # thresholds met

# If migrations were added:
pnpm turbo db:migrate:check  # no lock violations
```

Commit: `chore(verify): integration checkpoint N [Phase X, CP-N]`
Then push: `git push origin build/<sub-phase>`

**Fix any failures before proceeding to the next prompt.**

---

## Branch Rules

- **Create:** `build/<sub-phase>` from `main` at session start
- **Commit:** After each prompt
- **Push:** At integration checkpoints
- **PR:** At sub-phase end — title format: `[Step 3] Phase X — <Name>`
- **Merge:** Squash merge to main. Delete the branch.

**Forbidden:**
- Never modify reference docs under `docs/` (except skill files if explicitly instructed)
- Never create `docs/` or `fix/` branches
- Never push to main directly

---

## Handling Cross-Phase References

When a prompt references something from a prior phase, do NOT re-load prior phase reference docs. The playbook prompt already states what exists. Trust the prompt's "What Has Been Built" and schema snapshots.

If you need to verify something exists in the codebase, read the actual source file — don't consult reference docs.
