# Convention Updates for Planner Agent

> **Instructions:** These are the additional convention changes needed
> to support the Planner Agent. Apply these to the relevant files.

---

## CONTRIBUTING.md Additions

Covers Branch Prefix Table (add `plan/` row), Branch Naming Examples (add to existing examples), Commit Message Format (add `plan:` prefix).

### Branch Prefix Table (add `plan/` row)

Add a new row to the branch prefix ownership table:

| Prefix   | Owner          | Purpose                              |
|----------|----------------|--------------------------------------|
| `docs/`  | Architect Agent | Step 0 — doc prep                   |
| `plan/`  | Planner Agent   | Gate 1 — subdivision & planning     |
| `build/` | Build Agent     | Step 3 — build execution            |
| `fix/`   | Docs Agent      | Step 5 — post-build docs sync       |

### Branch Naming Examples (add to existing examples)

```
plan/3c-subdivision       — Gate 1 subdivision doc for sub-phase 3C
plan/3c-replan            — Gate 3 replanning after review failure
plan/2b-subdivision       — Gate 1 subdivision doc for sub-phase 2B
```

### Commit Message Format (add `plan:` prefix)

```
plan: 3c subdivision (5 units)
plan: 3c replan — contract revision for Unit 2
plan: 2b subdivision (3 units)
```

---

## CLAUDE.md Additions

Covers Monorepo Structure (add docs/subdivisions/), Agent Roster (add Planner), Updated Lifecycle Sequence.

### Monorepo Structure (add docs/subdivisions/)

Add to the directory layout:

```
docs/
  reference/        — feature specs, data model, design system
  decisions/        — ADRs (Architecture Decision Records)
  phases/           — phase division docs
  capture/          — future ideas, not yet scoped
  subdivisions/     — subdivision docs produced by Planner Agent (Gate 1)
```

### Agent Roster (add Planner)

If CLAUDE.md has an agent roster section, add:

| Agent     | Lifecycle Position        | Branch Prefix | Primary Output                |
|-----------|---------------------------|---------------|-------------------------------|
| Architect | Step 0 — Doc Prep         | `docs/`       | Reference doc updates, ADRs   |
| Planner   | Gate 1 — Subdivision      | `plan/`       | Subdivision docs, TASK-STATUS |
| Builder   | Step 3 — Build            | `build/`      | Application code              |
| Reviewer  | Step 4 — Review           | (none)        | Pass/fail verdicts            |
| Docs      | Step 5 — Docs Sync        | `fix/`        | MANIFEST, GLOSSARY updates    |

### Updated Lifecycle Sequence

The full lifecycle with planning gates:

```
Step 0: Doc Prep (Architect Agent)
  ↓
Gate 1: Subdivision Planning (Planner Agent)  ← NEW
  ↓
Step 1: Playbook Generation
  ↓
Step 2: Prompting Roadmap Generation
  ↓
Gate 2: Pre-Build Context Curation (Planner Agent)  ← NEW
  ↓
Step 3: Build Execution (Build Agent)
  ↓
Step 4: Review (Reviewer Agent)
  ↓ (if FAIL → Gate 3: Replanning by Planner Agent)  ← NEW
  ↓ (if PASS)
Step 5: Docs Sync (Docs Agent)
  ↓
Gate 4: Phase Boundary Summary (Planner Agent)  ← NEW
```

---

## MANIFEST.md Additions

Add entries for:

| Document | Lines | Scope | Key Content |
|----------|-------|-------|-------------|
| SUBDIVISION-STRATEGY.md | [count] | Process | Decomposition principles, seam heuristics, contract notation, context budget, template |
| DECISIONS.md | [count] | Process | Running tactical decisions log |
| MODIFICATIONS.md | [count] | Process | Per-session build changelog |
| TASK-STATUS.md | [count] | Process | Unit checklist and status tracking |

Subdivision docs will be added to MANIFEST as they're created:

| Document | Lines | Scope | Key Content |
|----------|-------|-------|-------------|
| subdivisions/3c-subdivision.md | [count] | [sub-phase scope] | Subdivision: N units, [brief] |
