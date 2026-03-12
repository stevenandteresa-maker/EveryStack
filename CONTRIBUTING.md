# CONTRIBUTING.md — EveryStack

> Conventions for branches, commits, and agent workflow.

---

## Branch Prefix Ownership

Each agent owns a branch prefix. Only that agent creates branches with its prefix.

| Prefix   | Owner           | Purpose                          |
|----------|-----------------|----------------------------------|
| `docs/`  | Architect Agent | Step 0 — doc prep                |
| `plan/`  | Planner Agent   | Gate 1 — subdivision & planning  |
| `build/` | Build Agent     | Step 3 — build execution         |
| `fix/`   | Docs Agent      | Step 5 — post-build docs sync    |

---

## Branch Naming

Format: `<prefix><sub-phase-id>-<description>`

### Examples

```
docs/3c-doc-prep            — Step 0 doc prep for sub-phase 3C
plan/3c-subdivision          — Gate 1 subdivision doc for sub-phase 3C
plan/3c-replan               — Gate 3 replanning after review failure
plan/2b-subdivision          — Gate 1 subdivision doc for sub-phase 2B
build/3c-unit-1              — Step 3 build execution for unit 1 of 3C
fix/3c-docs-sync             — Step 5 docs sync after 3C build
```

---

## Commit Message Format

Prefix every commit with the agent's commit tag followed by a colon.

| Prefix    | Owner           | Usage                                      |
|-----------|-----------------|--------------------------------------------|
| `docs:`   | Architect Agent | Doc prep, reference doc updates             |
| `plan:`   | Planner Agent   | Subdivision docs, replanning, TASK-STATUS   |
| `feat:`   | Build Agent     | New features                                |
| `fix:`    | Build Agent     | Bug fixes                                   |
| `refactor:` | Build Agent  | Refactors with no behavior change           |
| `test:`   | Build Agent     | Test-only changes                           |
| `chore:`  | Build Agent     | Tooling, config, dependency updates         |
| `docs:`   | Docs Agent      | MANIFEST, GLOSSARY, post-build doc sync     |

### Examples

```
docs: expand sync-engine.md with conflict resolution spec
plan: 3c subdivision (5 units)
plan: 3c replan — contract revision for Unit 2
plan: 2b subdivision (3 units)
feat: add grid toolbar sort/filter controls
fix: tenant isolation leak in cross-link query
test: add integration tests for outbound sync
chore: bump drizzle-orm to 0.30.x
docs: sync MANIFEST after 3C build
```
