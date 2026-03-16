---
name: everystack-buildprep
description: >
  Build preparation prompt generator for EveryStack's six-step build lifecycle.
  Produces a markdown file containing copy-paste-ready prompts for Step 0
  (Doc Prep), Gate 1 (Subdivision Planning), Step 1 (Playbook Generation),
  and Step 2 (Prompting Roadmap Generation) — with full branching instructions
  between each step. Use this skill whenever Steven says "prepare prompts for
  subphase X", "buildprep for X", "load buildprep", "prepare the build prep
  for phase X", or any request to generate the pre-build prompt sequence for
  a sub-phase. Also triggers on: "generate lifecycle prompts", "set up the
  planning sequence", or "prepare the planning pipeline for subphase X".
  The output is a single markdown file with fenced code blocks that can be
  copied directly into Claude Code or Claude.ai sessions. Step 2 produces
  a .docx prompting roadmap saved to the user's Downloads folder.
---

# EveryStack Build Prep Skill

This skill generates the complete pre-build prompt sequence for any
EveryStack sub-phase. It produces a single markdown document containing
four discrete, copy-paste-ready prompts — one for each planning step —
wrapped in branching instructions so the operator can execute them
top-to-bottom without judgment calls.

## When to Use This Skill

- **Always** when the user asks to prepare prompts for a sub-phase
- **Always** when the user says "buildprep" or "build prep"
- **Always** when the user says "prepare the planning pipeline"
- **Never** for build execution (Step 3), review (Step 4), or docs sync (Step 5)

---

## Required Input

The user provides one thing: a **sub-phase identifier** (e.g., `3B-i`,
`3C`, `2A`, `3A-iii`).

From that identifier, derive:

| Variable | How to Derive |
|----------|---------------|
| `{SUBPHASE}` | The identifier as given (e.g., `3B-i`) |
| `{SUBPHASE_LOWER}` | Lowercase with hyphens (e.g., `3b-i`) |
| `{PHASE_NUMBER}` | The major phase number (e.g., `3`) |
| `{PHASE_DIVISION_DOC}` | Look up in `docs/phases/` — match the phase number to the correct `phase-division-*.md` file |
| `{SUBPHASE_NAME}` | Extract from the phase division doc's entry for this sub-phase |

---

## Procedure

### 1. Resolve the Sub-Phase

Before generating any prompts:

1. Search `docs/phases/` for the phase division doc that covers this
   sub-phase. Phase division docs follow the pattern
   `phase-division-phase{N}*.md` (e.g., `phase-division-phase3-part1.md`).
2. Find the sub-phase's entry in that doc. Extract:
   - The sub-phase's full name
   - Its dependencies (what it depends on)
   - Its "Includes" scope
   - The reference docs it consumes
3. If the sub-phase identifier doesn't match any entry, STOP and ask
   the user to verify.

### 2. Generate the Markdown File

Create a markdown file at:
`/mnt/user-data/outputs/buildprep-{SUBPHASE_LOWER}.md`

The file follows the exact template below. Every `{VARIABLE}` must be
replaced with the resolved values. Every fenced code block is a
copy-paste target.

### 3. Present the File

Use `present_files` to deliver the markdown file to the user.

---

## Output Template

The markdown file MUST follow this structure exactly. Do not add,
remove, or reorder sections.

````markdown
# Build Prep — Phase {SUBPHASE} ({SUBPHASE_NAME})

> Generated for sub-phase **{SUBPHASE}** from `{PHASE_DIVISION_DOC}`.
> Execute these prompts top-to-bottom. Each fenced block is copy-paste-ready.
> Steps 0 and Gate 1 run in **Claude Code**. Steps 1 and 2 run in **Claude.ai**.

---

## 1. CREATE THE DOCS BRANCH (Step 0 setup)

Run in your terminal:

```
git checkout main && git pull origin main
git checkout -b docs/phase-{SUBPHASE_LOWER}-prep
```

---

## 2. STEP 0 — DOC PREP (Architect Agent)

Open **Claude Code** in the monorepo. Paste:

```
You are the Architect Agent for EveryStack, preparing docs for Phase {SUBPHASE} ({SUBPHASE_NAME}).

Read this skill file first:
- docs/skills/architect/SKILL.md

Load these docs in full:
- docs/reference/GLOSSARY.md
- CLAUDE.md
- docs/reference/MANIFEST.md
- CONTRIBUTING.md

Your mandate: ensure all reference docs consumed by Phase {SUBPHASE} are stable, consistent, and up to date before the build begins.

Tasks:
1. Read the phase division doc at {PHASE_DIVISION_DOC} — find the entry for sub-phase {SUBPHASE} and identify which reference docs and sections it consumes.
2. Read those reference doc sections. Check for:
   - Gaps in the spec that the build would need resolved
   - Stale sections referencing outdated architecture
   - Schema or terminology changes from prior builds that docs haven't caught up with
3. Verify all terms used in those sections exist in GLOSSARY.md.
4. Run the full 7-check consistency audit from CONTRIBUTING.md:
   - Glossary integrity
   - Manifest completeness
   - Schema alignment
   - Scope boundaries
   - Dependency graph
   - Cross-reference freshness
   - Index accuracy
5. Update MANIFEST.md if any line counts changed.
6. If a design decision was made, write an ADR in docs/decisions/.

If no doc changes are needed, report "No doc changes required for {SUBPHASE}. Step 0 complete." and do NOT create any commits.

If changes were made:
  git add -A
  git commit -m "docs: phase {SUBPHASE_LOWER} doc prep [{SUBPHASE_NAME}]"
```

---

## 3. MERGE THE DOCS BRANCH

After Step 0 completes, run in your terminal:

```
git push origin docs/phase-{SUBPHASE_LOWER}-prep
```

Review the diff:

```
git diff main...docs/phase-{SUBPHASE_LOWER}-prep
```

Verify:
- MANIFEST line counts match actual file sizes
- No undefined glossary terms
- Dependency graph still holds
- ADR written if a design decision was made

Then merge:

```
git checkout main && git pull origin main
git merge docs/phase-{SUBPHASE_LOWER}-prep --squash
git commit -m "docs: phase {SUBPHASE_LOWER} doc prep [{SUBPHASE_NAME}]"
git push origin main
git branch -d docs/phase-{SUBPHASE_LOWER}-prep
```

> **If no doc changes were needed in Step 0**, skip the merge and proceed directly to the next section.

---

## 4. CREATE THE PLAN BRANCH (Gate 1 setup)

Run in your terminal:

```
git checkout main && git pull origin main
git checkout -b plan/{SUBPHASE_LOWER}-subdivision
```

---

## 5. GATE 1 — SUBDIVISION PLANNING (Planner Agent)

Open **Claude Code** in the monorepo. Paste:

```
You are the Planner Agent for EveryStack, producing the subdivision doc for Phase {SUBPHASE} ({SUBPHASE_NAME}).

Read this skill file first:
- docs/skills/planner/SKILL.md

Load these docs in full:
- docs/reference/GLOSSARY.md
- CLAUDE.md
- docs/reference/MANIFEST.md
- docs/reference/SUBDIVISION-STRATEGY.md
- TASK-STATUS.md
- CONTRIBUTING.md

Load per-session context:
- {PHASE_DIVISION_DOC} — find the entry for sub-phase {SUBPHASE}
- DECISIONS.md — check for prior decisions affecting this sub-phase
{REFERENCE_DOC_LINES}

Your mandate: decompose sub-phase {SUBPHASE} into tightly scoped build units with explicit interface contracts and curated context manifests.

Follow the Gate 1 procedure from the planner skill exactly:
1. Assess the sub-phase scope from the phase division doc
2. Identify seams using SUBDIVISION-STRATEGY.md heuristics (data→service→UI layers, CRUD boundaries, tenant isolation, cross-cutting concerns)
3. For each unit, write:
   - Interface contract (Produces / Consumes / Side Effects)
   - Context manifest (doc sections with line ranges, source files)
   - Acceptance criteria
4. Build the dependency graph between units
5. Classify each unit's Reasoning Surface:
   - D (Deterministic Path): spec fully determines the output
   - SH (Structured Handoff): spec says WHAT, builder decides HOW
   - PJ (Pure Judgment): spec has a genuine gap
   Write a 1–2 sentence rationale for each classification
   referencing specific spec sections.
6. If any unit is classified PJ, list the PJ concerns in a
   summary at the end of the subdivision doc for Steven to
   review before Step 1 begins.
7. Run the context budget verification (no unit exceeds ~40% context)
8. Update TASK-STATUS.md with one entry per unit (all `pending`)
9. Update MANIFEST.md with the new subdivision doc entry

Save the subdivision doc to: docs/subdivisions/{SUBPHASE_LOWER}-subdivision.md

When complete:
  git add -A
  git commit -m "plan: {SUBPHASE_LOWER} subdivision (N units)"
```

---

## 6. MERGE THE PLAN BRANCH

After Gate 1 completes, run in your terminal:

```
git push origin plan/{SUBPHASE_LOWER}-subdivision
```

Review the diff:

```
git diff main...plan/{SUBPHASE_LOWER}-subdivision
```

Verify:
- Every unit has a complete interface contract (Produces + Consumes + Side Effects)
- Every unit has a context manifest with doc sections and line ranges
- Context Budget Verification table filled in for every unit
- No unit exceeds ~40% context budget estimate
- Dependency graph has no circular dependencies
- First unit has no unit-to-unit Consumes dependencies
- TASK-STATUS.md updated with one entry per unit
- MANIFEST.md entry added for the subdivision doc
- Every unit has an RSA classification (D, SH, or PJ) with rationale
- PJ units have their concerns summarized at the end of the doc
- All terms match GLOSSARY.md exactly

Then merge:

```
git checkout main && git pull origin main
git merge plan/{SUBPHASE_LOWER}-subdivision --squash
git commit -m "plan: {SUBPHASE_LOWER} subdivision"
git push origin main
git branch -d plan/{SUBPHASE_LOWER}-subdivision
```

---

## 7. STEP 1 — PLAYBOOK GENERATION

Open a **new Claude.ai conversation**. Paste:

```
You are generating the playbook for EveryStack Phase {SUBPHASE} ({SUBPHASE_NAME}).

Read this skill file first:
- docs/skills/playbook-gen/SKILL.md

Load these docs in full:
- docs/reference/GLOSSARY.md
- CLAUDE.md
- docs/reference/MANIFEST.md

Load per-session context:
- docs/subdivisions/{SUBPHASE_LOWER}-subdivision.md — this is your primary decomposition guide
- {PHASE_DIVISION_DOC} — for phase context and dependencies
- docs/reference/playbook-generation-strategy.md § Phase Definitions and Build Order
- docs/reference/playbook-generation-strategy.md § Phase-Specific Guidance (Phase {PHASE_NUMBER} only)

Your mandate: produce a complete playbook for sub-phase {SUBPHASE} following the subdivision doc's unit structure.

Rules:
- Decompose WITHIN units from the subdivision doc, not from scratch
- Use each unit's context manifest for the prompt's "Load context" field
- Use each unit's interface contracts to drive acceptance criteria
- Every contract Produces entry must appear as a verifiable acceptance criterion
- Follow the Playbook Document Template from the playbook-gen skill exactly
- Include VERIFY session boundaries after each unit
- Carry forward each unit's RSA classification to prompt-level
  classifications. A prompt within a D unit is D. A prompt within
  an SH unit is SH unless a specific prompt is D. A prompt within
  a PJ unit inherits PJ unless the PJ concern doesn't apply to it.
  Include RSA Classification, RSA Rationale, and Reviewer Focus on
  every prompt in the playbook.
- Produce a PJ Decision Gate table in the phase preamble listing all
  PJ prompts for Steven's review before build.

Save the playbook to: docs/Playbooks/{PLAYBOOK_FILENAME}

When the playbook is complete, present it for review.
```

After review, save the playbook file to the repo:

```
git checkout main && git pull origin main
git add docs/Playbooks/{PLAYBOOK_FILENAME}
git commit -m "playbook: phase {SUBPHASE_LOWER} ({SUBPHASE_NAME})"
git push origin main
```

---

## 8. STEP 2 — PROMPTING ROADMAP GENERATION

Open a **new Claude.ai conversation**. Paste:

```
You are generating the Prompting Roadmap for EveryStack Phase {SUBPHASE} ({SUBPHASE_NAME}).

Read this skill file first:
- docs/skills/roadmap-gen/SKILL.md

Load the completed playbook:
- docs/Playbooks/{PLAYBOOK_FILENAME}

Your mandate: transform the playbook into a complete operator runbook that Steven (a non-technical founder) can execute top-to-bottom without judgment calls.

Rules:
- Follow the Document Structure template from the roadmap-gen skill exactly
- Use the label system: [PASTE INTO CLAUDE CODE], [GIT COMMAND], [CHECKPOINT], [DECISION POINT], [STATE UPDATE]
- Include plain-English "What This Builds" / "What You'll See" / "How Long" before every build prompt
- Include state file updates at the correct lifecycle moments
- Steps 0, 1, and 2 in the roadmap should note they are already complete (since this roadmap was produced after them)
- Step 3 onward should have full paste-ready content

Produce this as a .docx Word document. Save it to: /mnt/user-data/outputs/prompting-roadmap-phase-{SUBPHASE_LOWER}.docx

Also save a markdown copy to: docs/Playbooks/Phase {PHASE_NUMBER}/prompting-roadmap-phase-{SUBPHASE_LOWER}.md
```

After the roadmap is generated, commit the markdown copy:

```
git checkout main && git pull origin main
git add "docs/Playbooks/Phase {PHASE_NUMBER}/prompting-roadmap-phase-{SUBPHASE_LOWER}.md"
git commit -m "roadmap: phase {SUBPHASE_LOWER} prompting roadmap ({SUBPHASE_NAME})"
git push origin main
```

---

## Done

All four planning steps are complete for Phase {SUBPHASE}:

| Step | Output | Location |
|------|--------|----------|
| Step 0 | Doc fixes (if any) | Merged to main |
| Gate 1 | Subdivision doc | `docs/subdivisions/{SUBPHASE_LOWER}-subdivision.md` |
| Step 1 | Playbook | `docs/Playbooks/{PLAYBOOK_FILENAME}` |
| Step 2 | Prompting Roadmap (.docx) | Downloads folder |
| Step 2 | Prompting Roadmap (.md) | `docs/Playbooks/Phase {PHASE_NUMBER}/prompting-roadmap-phase-{SUBPHASE_LOWER}.md` |

You are now ready to execute Step 3 (Build) using the Prompting Roadmap.
````

---

## Variable Resolution Rules

When generating the output file, resolve these variables:

| Variable | Rule |
|----------|------|
| `{SUBPHASE}` | Exactly as the user provided (e.g., `3B-i`) |
| `{SUBPHASE_LOWER}` | Lowercase, hyphens (e.g., `3b-i`) |
| `{SUBPHASE_NAME}` | Full name from the phase division doc entry |
| `{PHASE_NUMBER}` | Major phase number extracted from the identifier |
| `{PHASE_DIVISION_DOC}` | Full path to the matching phase division file in `docs/phases/` |
| `{PLAYBOOK_FILENAME}` | `playbook-phase-{SUBPHASE_LOWER}.md` |
| `{REFERENCE_DOC_LINES}` | Extract from the phase division doc — list each reference doc the sub-phase consumes, formatted as `- docs/reference/{doc}.md — for {reason}`, one per line. Only include docs explicitly mentioned in the sub-phase's entry. |

### Phase Division Doc Lookup

Search `docs/phases/` for files matching the phase number:

| Phase | Likely file(s) |
|-------|----------------|
| 1 | `phase-division-phase1.md` or split into parts |
| 2 | `phase-division-phase2.md` or split into parts |
| 3 | `phase-division-phase3-part1.md`, `phase-division-phase3-part2.md` |
| 4+ | Follow the same pattern |

If multiple part files exist, search each for the sub-phase identifier.

---

## Quality Checks Before Delivering

Before presenting the file to the user, verify:

- [ ] All `{VARIABLE}` placeholders have been replaced — no raw braces remain
- [ ] The phase division doc path resolves to an actual file
- [ ] The sub-phase name matches what's in the phase division doc
- [ ] Reference doc list in the Gate 1 prompt is specific to this sub-phase
- [ ] Git branch names are consistent throughout the document
- [ ] Playbook filename is consistent between Step 1 and Step 2
- [ ] The markdown renders correctly with distinct, copyable code fences
