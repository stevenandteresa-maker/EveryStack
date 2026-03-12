---
name: everystack-roadmap-gen
description: >
  Prompting Roadmap generation for EveryStack's six-step build lifecycle (Step 2).
  Use this skill when producing a Prompting Roadmap document for any sub-phase.
  Triggers on: generating a prompting roadmap, creating an operator runbook,
  formatting build prompts for a non-technical founder, or any task labeled
  "Step 2" or "Prompting Roadmap Generation". Contains the label system,
  6-step document structure template, "What This Builds"/"What You'll See"
  format, decision point format, and PR/merge instructions. Never use this
  skill for playbook generation (Step 1), build execution (Step 3), or
  review (Step 4). This skill replaces the Prompting Roadmap Specification
  section of playbook-generation-strategy.md.
---

# EveryStack Prompting Roadmap Generation Skill

This skill encodes the repeatable process for producing Prompting Roadmaps —
the lifecycle-spanning runbooks that Steven (a non-technical founder) uses to
operate the entire build lifecycle. Load this skill in any Claude.ai session
whose purpose is to produce a Prompting Roadmap (Step 2 of the lifecycle).

## When to Use This Skill

- **Always** for Step 2 of any sub-phase lifecycle
- **Always** when formatting a playbook into an operator-friendly runbook
- **Never** for playbook generation, build execution, review, or docs sync
- **Never** in Claude Code sessions — roadmaps are authored in Claude.ai

## Session Inputs (Only Two)

1. **This skill file** — defines structure, labels, and quality standard
2. **The completed playbook for that sub-phase** — contains every prompt, git instruction, acceptance criterion, and dependency

**The session does NOT need:**
- Reference docs (architectural decisions already resolved in the playbook)
- Phase Division files (subdivision already reflected in the playbook)
- GLOSSARY.md, CLAUDE.md, or MANIFEST.md (technical context not needed)

This separation means the full context budget goes toward formatting quality.

---

## Label System

Every paste-ready block is fenced in a markdown code block and prefixed with one of these labels:

| Label | Meaning |
|-------|---------|
| `[PASTE INTO CLAUDE]` | Prompt to paste into a Claude.ai session |
| `[PASTE INTO CLAUDE CODE]` | Prompt to paste into Claude Code in the terminal |
| `[GIT COMMAND]` | Git command to run in the terminal |
| `[CHECKPOINT]` | Stop and verify before proceeding |
| `[DECISION POINT]` | Binary choice with explicit instructions for each path |
| `[STATE UPDATE]` | Update a state file (TASK-STATUS.md or MODIFICATIONS.md) |

---

## Document Structure

The Prompting Roadmap follows the six-step lifecycle. Every step has paste-ready content. No step requires technical judgment from Steven.

```markdown
# Phase [X] — [Name] — Prompting Roadmap

## Overview
- Sub-phase: [ID and name]
- Playbook: [filename]
- Subdivision doc: [filename — if applicable]
- Units: [count and names from subdivision doc]
- Estimated duration: [rough total for all 6 steps]
- Prior sub-phase: [what was just completed]

---

## STEP 0 — DOC PREP (Architect Agent)

### What This Step Does
[2–3 sentences: why doc changes are needed before the build]

### 0.1 — Create the docs branch

[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b docs/<description>

### 0.2 — Run the Architect Agent

[PASTE INTO CLAUDE CODE]
<full Architect Agent prompt with specific file paths,
changes, and consistency checks>

### 0.3 — Review and merge

[CHECKPOINT]
Review the diff. Look for:
- MANIFEST line counts updated
- No undefined glossary terms
- Dependency graph holds
- ADR written if needed

[GIT COMMAND]
git add -A && git commit -m "docs: <description> [Phase X prep]"
git push origin docs/<description>

Open PR titled "[Step 0] Phase X — Doc Prep: <description>".
Review. Merge. Delete branch.

[DECISION POINT]
If no doc changes needed: → Skip to Step 3.
If doc changes merged: → Proceed to Step 3.

---

## STEP 1 — PLAYBOOK GENERATION
"You already have the playbook — Step 1 is complete."

---

## STEP 2 — PROMPTING ROADMAP GENERATION
"You're reading the output of Step 2. Proceed to Step 3."

---

## STEP 3 — BUILD + VERIFY EXECUTION

Step 3 alternates between BUILD sessions and VERIFY sessions in separate
Claude Code contexts. BUILD contexts are focused on writing code with full
playbook/reference context. VERIFY contexts are focused on running tests
and fixing failures with full testing knowledge. This keeps each context
lean and within budget.

This sub-phase is organized into [N] units. Each unit represents a
coherent slice of the build with defined inputs and outputs. You'll see
unit headers marking where each unit starts and what it produces.

### Setup

[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b build/<sub-phase>

[STATE UPDATE]
Open TASK-STATUS.md. Find the [sub-phase] section.
All units should show `pending`. No changes needed yet.

---

### ═══ UNIT 1: [Unit Name] ═══

**What This Unit Builds:**
[2–3 sentence plain-English explanation of what this unit produces and
why it matters. Written for a non-technical founder.]

**What Comes Out of It:**
[Plain-English version of the interface contract — "When this unit is
done, the following things exist and work: ..."]

**What It Needs from Prior Work:**
[Plain-English version of Consumes — "This unit uses [things] that
were built in [prior phase/unit]" or "Nothing — this is the first unit."]

---

### BUILD SESSION A — Unit 1, Prompts 1–N

[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 1 to `in-progress`.
Add branch name: `build/<sub-phase>`.

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
Read these skill files and keep their conventions in mind for all work
in this session:
- docs/skills/builder/SKILL.md
- docs/skills/phase-context/SKILL.md
- [additional domain skills as needed: ux-ui, backend, ai-features]

#### PROMPT 1: [Plain-English Name]

**What This Builds:**
[2–3 sentence explanation a non-coder can understand]

**What You'll See When It's Done:**
[Observable outcome — files created, typecheck + lint passing]

**How Long This Typically Takes:** [rough estimate]

[PASTE INTO CLAUDE CODE]
<full prompt text from the playbook>

[CHECKPOINT]
Look for:
- [specific observable outcomes]
- TypeScript compiles with zero errors
- ESLint passes with zero errors

[GIT COMMAND]
git add <specific paths>
git commit -m "feat(scope): description [Phase X, Prompt 1]"

#### PROMPT 2: [Plain-English Name]
... (same format as Prompt 1)

---

### VERIFY SESSION A — Unit 1, Prompts 1–N — Completes Unit 1

**What This Step Does:**
"This runs the full test suite against everything Unit 1 built. It also
checks that Unit 1 produced everything it promised (its interface contract)."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Prompts 1–N (Unit 1):
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings [if UI changes]
4. Unit tests: pnpm turbo test
5. Integration tests (Docker required): pnpm turbo test
6. Coverage: pnpm turbo test -- --coverage — thresholds met
7. [Manual verification items for these prompts]

Interface contract verification (Unit 1):
- [ ] [CONTRACT] [export 1 exists at expected path]
- [ ] [CONTRACT] [export 2 exists at expected path]

Fix any failures. Commit fixes.

[CHECKPOINT]
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix using verify skill knowledge.
If still failing: paste "The [check] is failing with [error]. Fix it."

[GIT COMMAND]
git add -A
git commit -m "chore(verify): verify prompts 1–N, unit 1 complete [Phase X, VP-1]"
git push origin build/<sub-phase>

[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 1 to `passed-review`.
Open MODIFICATIONS.md. Add a session block for this BUILD/VERIFY cycle:

```
## Session A — [Sub-Phase] — build/<sub-phase>

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 1–N (Unit 1)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- [any new tables/columns, or "None"]

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### ═══ UNIT 2: [Unit Name] ═══

**What This Unit Builds:**
[Plain-English explanation]

**What Comes Out of It:**
[Plain-English interface contract]

**What It Needs from Prior Work:**
"This unit uses [exports] from Unit 1, which you just built."

---

### BUILD SESSION B — Unit 2, Prompts N+1–M
... (same format as BUILD SESSION A, fresh Claude Code context)

[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 2 to `in-progress`.

### VERIFY SESSION B — Unit 2, Prompts N+1–M — Completes Unit 2
... (same format as VERIFY SESSION A, fresh Claude Code context)

---

### FINAL — Open Pull Request

[GIT COMMAND]
git push origin build/<sub-phase>

Open PR titled "[Step 3] Phase X — <Name>".
List all units completed and their deliverables:
- Unit 1: [name] — [key outputs]
- Unit 2: [name] — [key outputs]
- ...

[DECISION POINT]
If PR looks good: → Merge (squash). Delete branch. Proceed to Step 4.
If something wrong: → Do NOT merge. Paste fix instructions into Claude Code.

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does
"An independent Claude session reviews the build against acceptance criteria
and verifies that every unit's interface contract was fulfilled."

### 4.1 — Generate the build diff

[GIT COMMAND]
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-X-diff.txt

### 4.2 — Run the Reviewer Agent

Open NEW Claude.ai session. Upload: playbook, subdivision doc, diff,
CLAUDE.md, GLOSSARY.md.

[PASTE INTO CLAUDE]
You are the Reviewer Agent for EveryStack Phase [X].
<full reviewer prompt with rules and output format>

[DECISION POINT]
If PASS: → Proceed to Step 5.
If FAIL: → Paste fix instructions into Claude Code. Re-run review.

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

### What This Step Does
"Bring docs back into alignment after the build. The Docs Agent reads
MODIFICATIONS.md to know exactly what changed."

### 5.1 — Create the fix branch

[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b fix/post-<sub-phase>-docs-sync

### 5.2 — Run the Docs Agent

[PASTE INTO CLAUDE CODE]
You are the Docs Agent for EveryStack, running after Phase [X].
<full docs agent prompt with tasks and constraints>

MODIFICATIONS.md has session blocks for this sub-phase's builds.
Use those as your primary input for what changed.

### 5.3 — Review and merge

[CHECKPOINT]
Review diff. Look for:
- MANIFEST line counts match actual file sizes
- No stale cross-references
- No new terms missing from GLOSSARY
- MODIFICATIONS.md sessions archived
- TASK-STATUS.md units show `docs-synced`

[GIT COMMAND]
git add -A
git commit -m "docs: post-Phase-X docs sync (MANIFEST, GLOSSARY, cross-refs)"
git push origin fix/post-<sub-phase>-docs-sync

Open PR. Review. Merge. Delete branch.

### 5.4 — Tag if milestone

[DECISION POINT]
If milestone: → git tag -a v0.X.0-label -m "Phase X complete"
If not: → Skip. Proceed to next sub-phase.

---

## NEXT SUB-PHASE
Phase [X] is complete. Next: [Y].
Return to Step 0 for Phase [Y].
```

---

## BUILD/VERIFY Session Grouping Rules

Step 3 alternates between BUILD and VERIFY sessions. Use these rules
to determine how many prompts go in each BUILD session:

### Sizing a BUILD session

- **Target: 3–5 prompts per BUILD session.** This is the sweet spot for
  context budget — enough prompts to make progress, not so many that the
  context gets bloated with accumulated code changes.
- **Never exceed 6 prompts** in a single BUILD session.
- **Prefer unit-aligned sessions.** When a unit has 2–5 prompts, put the
  entire unit in a single BUILD session. When a unit has 6+ prompts, split
  it into two BUILD sessions but keep both within the same unit.
- **Group by dependency.** Prompts that depend on each other should be in
  the same BUILD session so the builder can reference prior output.
- **Group by domain.** Prompts touching the same files/domain area work
  better together (shared context, fewer re-reads).

### Sizing a VERIFY session

- **One VERIFY session per BUILD session.** Every BUILD session is followed
  by exactly one VERIFY session covering the same prompt range.
- **VERIFY sessions are lighter** — they only run checks and fix failures.
  They typically finish faster than BUILD sessions.
- **Unit-completing VERIFY sessions include contract checks.** When a
  VERIFY session completes the final prompt of a unit, it includes the
  interface contract verification items from the playbook.

### Session naming convention

Use lettered pairs aligned with units in the roadmap:
- BUILD SESSION A (Unit 1) → VERIFY SESSION A (Completes Unit 1)
- BUILD SESSION B (Unit 2) → VERIFY SESSION B (Completes Unit 2)
- BUILD SESSION C (Unit 3, first half) → VERIFY SESSION C (Mid-Unit 3)
- BUILD SESSION D (Unit 3, second half) → VERIFY SESSION D (Completes Unit 3)

### Integration Checkpoints → VERIFY Sessions

The old "Integration Checkpoint" pattern is replaced by VERIFY sessions.
Every VERIFY session IS an integration checkpoint. The VERIFY session
commits fixes and pushes — this is the push point.

### Small sub-phases (≤5 prompts)

For sub-phases with 5 or fewer prompts, use a single BUILD/VERIFY pair.
No need for multiple sessions.

---

## Unit Headers

Before each unit's first BUILD session, include a unit header block. This
gives Steven orientation — he can see the unit structure of the sub-phase
and understand what each chunk of work accomplishes.

**Unit header format:**
```markdown
### ═══ UNIT N: [Unit Name] ═══

**What This Unit Builds:**
[2–3 sentence plain-English explanation]

**What Comes Out of It:**
[Plain-English interface contract — no code jargon]

**What It Needs from Prior Work:**
[Dependencies in plain English]
```

**Rules for unit headers:**
- Use the ═══ border to make unit transitions visually unmissable
- Write at a non-technical level — Steven should understand what's
  being built without knowing TypeScript
- Include the interface contract in plain English, not code signatures.
  Example: "When done, the system can look up any record by its ID and
  knows which workspace it belongs to" — not "Produces getRecordById():
  Promise<Record | null>"
- If units can run in parallel, note it: "Units 3 and 4 can be built
  in either order — they don't depend on each other."

---

## State File Updates

The roadmap includes `[STATE UPDATE]` labels at specific points to keep
the three state files (TASK-STATUS.md, MODIFICATIONS.md, DECISIONS.md)
current. Steven executes these as part of the workflow.

### When to Include State Updates

| Moment | State File | Update |
|--------|-----------|--------|
| Start of a unit's first BUILD session | TASK-STATUS.md | Unit → `in-progress`, add branch name |
| End of each VERIFY session | MODIFICATIONS.md | Append session block with files changed |
| End of unit-completing VERIFY session | TASK-STATUS.md | Unit → `passed-review` |
| When a tactical decision is made | DECISIONS.md | Append decision entry |
| During Step 5 (Docs Sync) | MODIFICATIONS.md | Archive completed sessions |
| During Step 5 (Docs Sync) | TASK-STATUS.md | Units → `docs-synced` |

### State Update Format in Roadmap

```markdown
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit N to `in-progress`.
Add branch name: `build/<sub-phase>`.
```

Keep state updates brief and specific. Steven should be able to make the
edit in under 30 seconds. For MODIFICATIONS.md session blocks, provide a
template he can fill in based on what Claude Code reported.

---

## Plain-English Explanations

Before every `[PASTE INTO CLAUDE CODE]` block in Step 3, include:

1. **What This Builds** — one paragraph, no jargon
   > "This prompt creates the database tables where all your records will be stored. Think of it like setting up the filing cabinets — the actual files come later."

2. **What You'll See When It's Done** — observable outcomes
   > "Claude Code will create two new files. You should see all green checkmarks when tests run."

3. **How Long This Typically Takes** — rough estimate so Steven knows whether to wait

---

## What the Prompting Roadmap is NOT

- Not the playbook (the playbook is the technical doc — the roadmap wraps it for human consumption)
- Not a tutorial or learning resource
- Not optional — every playbook must have a companion roadmap
- Does not contain technical details beyond what Steven needs to operate

---

## Quality Standard

The test for a good Prompting Roadmap: Steven should be able to execute the entire sub-phase lifecycle — from doc prep through post-build docs sync — by reading only the roadmap, top to bottom. He should never need to open the playbook, read a reference doc, or make a judgment call. Every decision has been made in advance. Every word he needs to paste is in a labeled block. Every decision point has binary instructions. Every state file update tells him exactly what to change and where.

The unit structure should be visible and comprehensible — Steven should be
able to glance at the roadmap and say "this sub-phase has 4 units, I'm
currently on Unit 2, and Units 3 and 4 can run in parallel after this."
