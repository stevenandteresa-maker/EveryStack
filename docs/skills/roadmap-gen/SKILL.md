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

---

## Document Structure

The Prompting Roadmap follows the six-step lifecycle. Every step has paste-ready content. No step requires technical judgment from Steven.

```markdown
# Phase [X] — [Name] — Prompting Roadmap

## Overview
- Sub-phase: [ID and name]
- Playbook: [filename]
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

## STEP 3 — BUILD EXECUTION (Builder Agent)

### Setup

[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b build/<sub-phase>

Open Claude Code. Load skills:

[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/builder/SKILL.md
- docs/skills/phase-context/SKILL.md
- [additional relevant skills]

### PROMPT 1: [Plain-English Name]

**What This Builds:**
[2–3 sentence explanation a non-coder can understand]

**What You'll See When It's Done:**
[Observable outcome — files created, tests passing, UI visible]

[PASTE INTO CLAUDE CODE]
<full prompt text from the playbook>

[CHECKPOINT]
Look for:
- [specific observable outcomes]
- All tests passing
- No TypeScript or ESLint errors

[GIT COMMAND]
git add <specific paths>
git commit -m "feat(scope): description [Phase X, Prompt 1]"

### INTEGRATION CHECKPOINT 1 (after Prompts 1–N)

[PASTE INTO CLAUDE CODE]
Run the full verification suite:
1. pnpm turbo typecheck
2. pnpm turbo lint
3. pnpm turbo test
4. pnpm turbo test -- --coverage

[CHECKPOINT]
All commands must pass with zero errors.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."

[GIT COMMAND]
git add -A
git commit -m "chore(verify): integration checkpoint 1 [Phase X, CP-1]"
git push origin build/<sub-phase>

### FINAL — Open Pull Request

[GIT COMMAND]
git push origin build/<sub-phase>

Open PR titled "[Step 3] Phase X — <Name>".
List all prompts completed and their deliverables.

[DECISION POINT]
If PR looks good: → Merge (squash). Delete branch. Proceed to Step 4.
If something wrong: → Do NOT merge. Paste fix instructions into Claude Code.

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does
"An independent Claude session reviews the build against acceptance criteria."

### 4.1 — Generate the build diff

[GIT COMMAND]
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-X-diff.txt

### 4.2 — Run the Reviewer Agent

Open NEW Claude.ai session. Upload: playbook, diff, CLAUDE.md, GLOSSARY.md.

[PASTE INTO CLAUDE]
You are the Reviewer Agent for EveryStack Phase [X].
<full reviewer prompt with rules and output format>

[DECISION POINT]
If PASS: → Proceed to Step 5.
If FAIL: → Paste fix instructions into Claude Code. Re-run review.

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

### What This Step Does
"Bring docs back into alignment after the build."

### 5.1 — Create the fix branch

[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b fix/post-<sub-phase>-docs-sync

### 5.2 — Run the Docs Agent

[PASTE INTO CLAUDE CODE]
You are the Docs Agent for EveryStack, running after Phase [X].
<full docs agent prompt with tasks and constraints>

### 5.3 — Review and merge

[CHECKPOINT]
Review diff. Look for:
- MANIFEST line counts match actual file sizes
- No stale cross-references
- No new terms missing from GLOSSARY

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

The test for a good Prompting Roadmap: Steven should be able to execute the entire sub-phase lifecycle — from doc prep through post-build docs sync — by reading only the roadmap, top to bottom. He should never need to open the playbook, read a reference doc, or make a judgment call. Every decision has been made in advance. Every word he needs to paste is in a labeled block. Every decision point has binary instructions.
