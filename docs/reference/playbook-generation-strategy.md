# EveryStack — Playbook Generation Strategy

> **Purpose:** This document is a meta-instruction set. Give it to Claude alongside the EveryStack reference docs. Claude will use it to produce one phase playbook at a time — the build roadmap for each phase of EveryStack's development.
>
> **This document does NOT build EveryStack.** It tells Claude how to produce the documents that will — and defines the full lifecycle those documents move through, from doc prep to post-build sync.

---

## What You Are Building

You are producing **two documents per sub-phase**, then guiding them through a **six-step lifecycle**:

1. **A playbook** (markdown) — a technical build roadmap containing atomic prompt units that a Claude Code instance can execute sequentially to build that sub-phase of EveryStack. This is the engineering document. Produced in Step 1.

2. **A Prompting Roadmap** (markdown) — a lifecycle-spanning runbook that tells Steven (a non-technical founder) exactly what to paste, when to paste it, what to expect at each step, and what to do next — covering doc prep, build execution, review, and docs sync. This is the operations document. Produced in Step 2 using only the strategy doc and the completed playbook as inputs.

The reference docs you have been given contain the complete EveryStack specification: 63 reference docs, a glossary (source of truth), a manifest (document index with scope map), and a root CLAUDE.md (project-wide rules and conventions).

Your job is to **transform** these reference specs into **actionable build instructions** — not to summarize them, not to reorganize them, but to decompose them into right-sized implementation prompts with explicit dependencies, context loading instructions, acceptance criteria, and scope guards.

---

## Six-Step Lifecycle — Know Which Step You're In

Every sub-phase moves through six steps. Each step has a dedicated agent, a specific context load, defined inputs and outputs, and clear boundaries. Never conflate steps. The six steps are:

| Step | Name | Agent | Session Type | Branch Prefix |
|------|------|-------|-------------|---------------|
| 0 | Doc Prep | Architect Agent | Claude Code | `docs/` |
| 1 | Playbook Generation | — (Steven + Claude) | Claude.ai | — |
| 2 | Prompting Roadmap Generation | — (Steven + Claude) | Claude.ai | — |
| 3 | Build Execution | Builder Agent | Claude Code | `build/` |
| 4 | Review | Reviewer Agent | Claude.ai | — |
| 5 | Post-Build Docs Sync | Docs Agent | Claude Code | `fix/` |

### Step 0 — Doc Prep (Architect Agent in Claude Code)

**Purpose:** Ensure all reference docs are stable, consistent, and up to date before the build begins. Docs change on their own branch and merge first — the build never starts against stale specs.

**Input:** The Architect Agent prompt from the Prompting Roadmap (or from the prior sub-phase's roadmap for the first run), Tier 0 docs (GLOSSARY.md, CLAUDE.md, MANIFEST.md), and relevant Tier 1 reference docs.

**Output:** A merged `docs/<description>` branch containing any spec changes, MANIFEST updates, new ADRs, and a passing consistency check.

**What happens:**
1. Create a `docs/<description>` branch from `main`.
2. Make all reference doc changes needed for the upcoming build (new sections, schema adjustments, scope clarifications).
3. Update MANIFEST.md (new docs, changed line counts, status changes).
4. Write an ADR if a design decision was made (using `docs/decisions/NNN-short-description.md` and the ADR template).
5. Run a consistency check: glossary terms match usage, MANIFEST is current, dependency graph holds, no stale cross-references.
6. Commit, push, self-review the diff, merge to `main`.

**If no doc changes are needed:** The Architect Agent confirms "no doc changes required" and Step 0 completes with no branch created. Skip to Step 1.

### Step 1 — Playbook Generation (Steven + Claude in Claude.ai)

**Who:** Steven working with Claude in a Claude.ai session.

**Input:** The reference docs + this strategy document + the Phase Division files (`docs/phases/phase-division-*.md` + `dependency-graph-and-appendices.md`).

**Output:** A playbook document (markdown) — the technical prompting roadmap with all 10 quality characteristics.

**Context strategy:** Load GLOSSARY.md, CLAUDE.md, and MANIFEST.md in full (~1,600 lines). Then load relevant reference doc sections via line-range indexes. Heavy reading, light writing.

This session produces the playbook. It consumes reference docs and transforms them into structured prompts. The full glossary load is justified here because you're authoring prompts that must use exact naming from the glossary.

**This step is identical to the current Session A-1.** No changes to how playbook generation works.

### Step 2 — Prompting Roadmap Generation (Steven + Claude in Claude.ai)

**Who:** Steven working with Claude in a SEPARATE session from playbook generation.

**Input:** This strategy document (for the Prompting Roadmap Specification section) + the completed playbook for that sub-phase.

**Output:** A Prompting Roadmap (markdown) — a lifecycle-spanning runbook covering all six steps with paste-ready content at every step.

**Context strategy:** No reference docs, no glossary, no manifest. The only inputs are the strategy doc and the playbook. All architectural decisions have already been resolved. Claude's full context budget goes toward producing clear prompts, decision points, and checkpoint instructions across all six lifecycle steps.

This session translates the playbook into a non-technical operator's runbook covering the entire lifecycle — not just the build phase. It does not make architectural decisions — it wraps existing decisions in a human-friendly format with paste-ready prompts for every agent.

### Step 3 — Build Execution (Builder Agent in Claude Code)

**Who:** Steven pasting prompts from the Prompting Roadmap into Claude Code in the monorepo.

**Input:** One playbook prompt at a time (via the Prompting Roadmap's build section) + the codebase as it exists.

**Output:** Working code, tests, and migrations committed to git on a `build/<sub-phase>` branch.

**Context strategy:**
- `CLAUDE.md` → Already the project root file. Claude Code auto-loads it from the monorepo root. Costs zero extra effort — this is how Claude Code is designed to work.
- `MANIFEST.md` → **Not needed.** It was consumed during playbook generation. Claude Code never sees it.
- `GLOSSARY.md` → **Available but not pre-loaded.** The playbook prompt already uses correct terminology. Claude Code only consults the glossary if it needs to verify a name for something new. Instruction in the playbook preamble: "GLOSSARY.md is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, or UI labels."
- The playbook prompt itself → ~100–200 lines including schema snapshot, task, acceptance criteria, file paths, and scope guards.
- Reference doc sections cited in the prompt's `Load context` field → ~200–800 lines.

**Total context consumed at prompt start: ~15K (system) + ~2K (CLAUDE.md) + ~1K–4K (prompt + reference sections) ≈ 18K–21K of 200K tokens (~10%).** This leaves ~180K tokens for Claude Code to read source files, write code, run tests, debug, and iterate. That's a generous budget.

**This step is identical to the current Session B / operator guide execution.** The Builder Agent follows the Prompting Roadmap's build section the same way it currently follows the operator guide.

### Step 4 — Review (Reviewer Agent in Claude.ai)

**Purpose:** Verify the build output against the playbook's acceptance criteria. The Reviewer Agent never modifies code or docs — it only reports.

**Input:** The Reviewer Agent prompt from the Prompting Roadmap, the playbook, the build diff (copy-pasted or attached), CLAUDE.md, and GLOSSARY.md.

**Output:** A pass/fail verdict with specific findings.

**What happens:**
1. Steven opens a new Claude.ai session.
2. Pastes the Reviewer Agent prompt from the Prompting Roadmap.
3. Uploads the playbook + the build diff (from `git diff main...build/<sub-phase>`) + CLAUDE.md + GLOSSARY.md.
4. Claude produces a verdict:
   - **PASS** → Proceed to Step 5.
   - **FAIL** → The verdict names specific files, specific acceptance criteria that failed, and provides actionable fix instructions. Steven pastes the fix prompt into Claude Code, re-runs the review.

### Step 5 — Post-Build Docs Sync (Docs Agent in Claude Code)

**Purpose:** Bring docs back into alignment with what was actually built. Line counts shift, new terms appear, cross-references may go stale. The Docs Agent fixes all of this.

**Input:** The Docs Agent prompt from the Prompting Roadmap, MANIFEST.md, GLOSSARY.md, and the list of files changed during the build.

**Output:** A merged `fix/post-<sub-phase>-docs-sync` branch containing updated MANIFEST line counts, new GLOSSARY entries, and fixed cross-references.

**What happens:**
1. Create a `fix/post-<sub-phase>-docs-sync` branch from `main` (which now includes the merged build).
2. Update MANIFEST.md line counts for any docs whose line counts changed.
3. Check GLOSSARY.md for new domain terms introduced during the build — add definitions if missing.
4. Verify no stale cross-references exist in docs that reference changed files.
5. Commit, push, merge to `main`.

### Why This Six-Step Lifecycle Matters

The three-session model (playbook → operator guide → build) left gaps: docs drifted out of sync after builds, review was informal, and there was no structured way to prepare docs before a build. The six-step lifecycle closes every gap:

- **Step 0** ensures the build starts against stable, consistent docs.
- **Steps 1–2** remain focused on their strengths: architectural precision and formatting quality.
- **Step 3** executes the build with full context headroom.
- **Step 4** catches regressions and unmet acceptance criteria before merging.
- **Step 5** prevents the slow drift that causes consistency audit marathons.

---

## Agent Definitions

Four agents operate across the six-step lifecycle. Each has a strict mandate, a defined context load, a specific output, and hard boundaries on what it is forbidden to do.

### Architect Agent (Step 0)

| Property | Value |
|----------|-------|
| **Mandate** | Prepare reference docs for the upcoming build. Ensure specs are stable, consistent, and complete before any code is written. |
| **Session type** | Claude Code |
| **Loaded context** | Tier 0: GLOSSARY.md, CLAUDE.md, MANIFEST.md (always). Tier 1: Reference docs relevant to the upcoming sub-phase (loaded via line-range indexes). CONTRIBUTING.md (for branching and commit conventions). ADR-TEMPLATE.md (if a decision needs recording). |
| **Output** | A merged `docs/<description>` branch on `main`. May contain: updated reference doc sections, new MANIFEST entries, updated line counts, new ADRs, consistency check confirmation. |
| **Forbidden actions** | Never modifies application code (`src/`, `apps/`, `packages/`). Never creates `build/` branches. Never runs tests or CI. Only touches files under `docs/`. |
| **Branch ownership** | `docs/` branches only. |

### Builder Agent (Step 3)

| Property | Value |
|----------|-------|
| **Mandate** | Execute the playbook prompts to produce working, tested code. This is the existing Claude Code instance — no changes to how it operates. |
| **Session type** | Claude Code |
| **Loaded context** | CLAUDE.md (auto-loaded from monorepo root). Per-prompt: the playbook prompt text + reference doc sections cited in the prompt's `Load context` field. GLOSSARY.md available on demand. Skill files as specified in the playbook preamble. |
| **Output** | Working code, tests, and migrations committed to a `build/<sub-phase>` branch. |
| **Forbidden actions** | Never modifies reference docs under `docs/` (except skill files if a prompt explicitly instructs it). Never creates `docs/` or `fix/` branches. |
| **Branch ownership** | `build/` branches only. |

### Reviewer Agent (Step 4)

| Property | Value |
|----------|-------|
| **Mandate** | Evaluate the build output against the playbook's acceptance criteria. Produce a structured pass/fail verdict. Never fix anything — only report. |
| **Session type** | Claude.ai |
| **Loaded context** | The playbook for this sub-phase. The build diff (`git diff main...build/<sub-phase>`). CLAUDE.md (for convention compliance). GLOSSARY.md (for naming compliance). |
| **Output** | A verdict document containing: overall PASS or FAIL, per-prompt acceptance criteria evaluation (checked/unchecked), specific file references for any failures, actionable fix instructions for each failure. |
| **Forbidden actions** | Never modifies code. Never modifies docs. Never runs commands. Never creates branches. Only reads and reports. |
| **Branch ownership** | None. |

### Docs Agent (Step 5)

| Property | Value |
|----------|-------|
| **Mandate** | Bring documentation back into alignment with the codebase after a build. Update MANIFEST line counts, add missing GLOSSARY terms, fix stale cross-references. |
| **Session type** | Claude Code |
| **Loaded context** | MANIFEST.md (full). GLOSSARY.md (full). The list of files changed during the build (from `git diff --name-only main~1...main` after the build branch merges). Any reference docs that contain cross-references to changed files. |
| **Output** | A merged `fix/post-<sub-phase>-docs-sync` branch on `main`. Contains: updated MANIFEST line counts, new GLOSSARY entries, fixed cross-references. |
| **Forbidden actions** | Never modifies application code. Never creates `build/` or `docs/` branches. Only touches files under `docs/`. |
| **Branch ownership** | `fix/` branches only. |

---

## The Authority Hierarchy

Whenever information conflicts, resolve it in this order:

1. **`GLOSSARY.md`** — Ultimate source of truth. Naming, MVP scope, concept definitions. If any other doc contradicts the glossary, the glossary wins. Load this in full for every playbook session.
2. **`CLAUDE.md`** (root) — Project-wide rules: tech stack, code conventions, CI gates, testing rules, error handling patterns, CockroachDB safeguards, design philosophy. Load this in full for every playbook session.
3. **`MANIFEST.md`** — Document index with scope labels, cross-references, and the Reference Doc Scope Map. Use this to identify which reference docs are relevant to each phase.
4. **Reference docs** (`*.md`) — Domain-specific specs. These define architecture, schemas, and behavior. Load relevant sections via line-range indexes per prompt.
5. **This strategy doc** — Governs how playbooks are structured. Does not override architectural decisions in reference docs.

---

## Phase Definitions and Build Order

The MANIFEST's "Reference Doc Scope Map" (bottom of MANIFEST.md) defines the canonical phase groupings. The MVP phases must be built in order. Post-MVP phases can be sequenced more flexibly but have some dependency constraints.

### MVP Phases (build in this order)

| Phase | Name | Sub-phases | Est. Prompts | Core Deliverable | Reference Docs |
|-------|------|------------|--------------|-----------------|----------------|
| **1** | MVP — Foundation | 10 (1A–1J) | ~86 | Monorepo, auth, DB schema (52 tables), design system, AIService skeleton, permissions (roles only), file upload pipeline, real-time scaffold, background worker, CI gates, Platform API auth + rate limiting, CP-001/CP-002 migration + multi-tenant nav shell | `data-model.md`, `database-scaling.md`, `design-system.md`, `observability.md`, `testing.md`, `ai-architecture.md`, `ai-data-contract.md`, `ai-metering.md`, `compliance.md`, `files.md`, `permissions.md`, `cockroachdb-readiness.md`, `platform-api.md`, `vertical-architecture.md`, `audit-log.md`, `realtime.md`, `navigation.md` |
| **2** | MVP — Sync | 3 (2A–2C) | ~36 | Sync engine, FieldTypeRegistry, Airtable adapter, bidirectional sync with conflict resolution, Notion adapter, error recovery, sync dashboard. SmartSuite adapter deferred to Phase 3 Core UX. | `sync-engine.md`, `database-scaling.md` (JSONB indexes), `field-groups.md` (synced table tab badges) |
| **3** | MVP — Core UX | 16 (3A-i–3H-ii) | ~168 | Grid/Card views, Record View, field-level permissions, cross-linking, SDS + Command Bar, communications, documents, portals, forms, field groups, bulk ops, record templates, settings, audit log UI, My Office, mobile | `permissions.md`, `cross-linking.md`, `tables-and-views.md`, `mobile.md`, `mobile-navigation-rewrite.md`, `my-office.md`, `command-bar.md`, `communications.md`, `email.md`, `audit-log.md`, `settings.md`, `forms.md`, `schema-descriptor-service.md`, `field-groups.md`, `bulk-operations.md`, `record-templates.md`, `smart-docs.md`, `portals.md` |
| **4** | MVP — Automations | 2 (4A–4B) | ~22 | Trigger system + execution engine (6 triggers), 7 action implementations, webhooks (inbound + outbound), dry run testing, status field governance (modes 1+2) | `automations.md`, `approval-workflows.md` (modes 1+2 only) |
| **5** | MVP — AI | 3 (5A–5C) | ~31 | AI data contract implementations (~25 field types), Context Builder, 5 user-facing AI features (Smart Fill, Record Summarization, Document AI Draft, Field & Link Suggestions, Automation Building AI), metering dashboards, Runtime Skills Architecture (skill loader, 7 platform skills, token budget allocator, skill-aware intent classification, eval integration) | `ai-architecture.md`, `ai-data-contract.md`, `ai-metering.md`, `schema-descriptor-service.md`, `ai-skills-architecture.md` |
| **6** | MVP — API | 2 (6A–6B) | ~15 | Platform API Data API (Record CRUD + filtering + batch), Schema API, File Upload API, SDS endpoint. Provisioning API deferred to post-MVP. | `platform-api.md` |

**Totals: 36 sub-phases, ~358 estimated prompts.**

### Sub-Phase Requirement — Subdivide Until Quality Is Maximized

**Default assumption: subdivide.** Any phase with more than ~8 reference docs, or that would produce more than ~15 prompts, MUST be split into sub-phases. But don't stop at the minimum viable split — keep subdividing until each sub-phase is small enough that you can think deeply about every prompt in it.

**The guiding principle:** A smaller, more focused playbook with 8 expertly crafted prompts is worth more than a large playbook with 25 prompts where the later ones get progressively less thought. Context fatigue is real — for the AI generating the playbook AND for the human executing it. Keep sub-phases tight.

> **Note:** All 6 MVP phases have been fully decomposed into 35 sub-phases in the phase division documents (`docs/phases/`). The tables below reflect the actual decomposition. When generating a playbook for any sub-phase, consult the corresponding phase division file for the authoritative scope boundaries, dependency map, reference doc line ranges, and sizing estimates.

**Phase 3 (MVP — Core UX) is the clearest example.** It references ~20 docs and covers the entire user-facing workspace. It has been decomposed into 16 sub-phases across two halves:

**Phase 3 — First Half (3A–3D): 7 sub-phases, ~82 prompts**

| Sub-Phase | Deliverable | Est. Prompts | Primary Docs |
|-----------|-------------|--------------|--------------|
| **3A-i — Grid View Core** | TanStack Table + Virtual grid shell, ~16 MVP field type cell renderers, inline editing, keyboard navigation | 12 | `tables-and-views.md` (27–365) |
| **3A-ii — View Features, Record View, Card View & Data Import** | Selection, grouping, sorting, filtering, summary footer, My Views / Shared Views, multi-user collaboration, Record View overlay, Card View, Sections, Inline Sub-Table, CSV import | 13 | `tables-and-views.md` (366–842) |
| **3A-iii — Field-Level Permissions** | 3-state field visibility, two-layer restriction storage, 7-step runtime resolution, permission config UI, Redis caching | 10 | `permissions.md` (90–448) |
| **3B-i — Cross-Linking Engine** | `cross_links` / `cross_link_index` data layer, query-time resolution L0–L2, Link Picker UX, display value maintenance, Convert to Native Table | 12 | `cross-linking.md` (31–567) |
| **3B-ii — Schema Descriptor Service & Command Bar** | SDS `describe_workspace()` / `describe_table()` / `describe_links()`, 2-tier caching, Command Bar with 4 search channels (fuzzy, navigation, slash commands, AI) | 10 | `schema-descriptor-service.md` (45–237), `command-bar.md` (full) |
| **3C — Record Thread, DMs, Notifications & System Email** | Two-thread Record Thread (internal + client via `thread_type`), DMs, Chat Editor (TipTap env 1), notification pipeline, presence, system email via Resend, thread tab lenses, in-thread search | 15 | `communications.md` (29–440), `email.md` (10–49) |
| **3D — Document Templates & PDF Generation** | TipTap env 2 Smart Doc editor, merge-tag field tokens, Gotenberg PDF pipeline, template CRUD, template mapper UI | 10 | `smart-docs.md` (49–229, 331–414) |

**Phase 3 — Second Half (3E–3H): 9 sub-phases, ~86 prompts**

| Sub-Phase | Deliverable | Est. Prompts | Primary Docs |
|-----------|-------------|--------------|--------------|
| **3E-i — Quick Portals** | Portal CRUD, dual auth (magic link + password), session management, record scoping, three-tier caching, client thread messaging, multi-record list view, GDPR endpoints, portal admin panel | 15 | `portals.md` (45–461) |
| **3E-ii — Quick Forms** | Form CRUD, Record View–based field canvas, Turnstile spam protection, submission pipeline, standalone URL routing, embed snippet generation | 7 | `forms.md` (full) |
| **3F-i — Field Groups, Per-Field Emphasis & Enhanced Hide/Show Panel** | Named colored column groups, per-field bold/accent emphasis, group collapse, conditional cell color cascade, enhanced hide/show panel | 10 | `field-groups.md` (35–275, 393–569) |
| **3F-ii — Bulk Operations** | Selection model, bulk action toolbar, batch Server Action pattern, multi-cell paste, progress tracking, undo/redo | 8 | `bulk-operations.md` (50–228, 270–532) |
| **3F-iii — Record Templates** | Template CRUD, template picker, view-scoped templates, dynamic tokens, template preview, mobile template support | 8 | `record-templates.md` (46–215, 264–437, 803–837) |
| **3G-i — Settings Page & Audit Log UI** | Settings page (9 sections), Record Activity tab, Workspace Audit Log page | 11 | `settings.md` (full), `audit-log.md` (152–180) |
| **3G-ii — My Office, Personal Notes & Quick Panel Expansion** | My Office widget grid, Quick Panel expansion, Calendar Feed API, Personal Notes (simplified MVP — text-only `user_notes` scratchpad across 4 surfaces) | 12 | `my-office.md` (full) |
| **3H-i — Mobile Feature Adaptation** | Mobile Record View, Card View, grid, input optimization, mobile forms, gestures | 11 | `mobile.md` (58–191, 276–384, 739–822), `mobile-navigation-rewrite.md` (164–306, 225–236, 361–374) |
| **3H-ii — Mobile Infrastructure** | Two-layer bottom bar, offline architecture, PWA, notification routing, deep linking | 14 | `mobile.md` (100–140, 440–641, 901–1213), `mobile-navigation-rewrite.md` (52–163, 237–267, 375–550) |

**Sub-phase naming convention:** Use Roman numeral suffixes for second-level splits: 3A-i, 3A-ii. If a third level is ever needed: 3A-i-α. But if you need a third level, reconsider whether the phase boundaries make sense.

**All phases have been decomposed.** The full phase division documents are in `docs/phases/` and contain detailed scope boundaries, dependency maps, reference doc line ranges, sizing, and validation checklists for all 35 sub-phases across Phases 1–6. See: `phase-division-phase1.md` (10 sub-phases), `phase-division-phase2.md` (3 sub-phases), `phase-division-phase3-part1.md` (7 sub-phases), `phase-division-phase3-part2.md` (9 sub-phases), `phase-division-phases4-6.md` (6 sub-phases), `dependency-graph-and-appendices.md` (master graph, critical path, parallel tracks, reference doc loading summary, post-MVP exclusion checklist, cross-cutting concerns registry).

### Post-MVP Phase Order (suggested, adjustable)

Post-MVP phases are listed in MANIFEST.md. When you reach them, apply the same decomposition logic — if a phase references more than ~8 reference docs or would produce more than ~25 prompts, split it into sub-phases.

---

## How to Produce a Playbook

> **Process extracted to skill:** The full playbook production process — mandatory context loading, 7-step sequence, context budget rules, and the playbook document template — is in `docs/skills/playbook-gen/SKILL.md`. Load that skill for any playbook generation session.
>
> This section retains only a brief summary. The skill is authoritative on process.

---

## The 10 Quality Characteristics

> **Full implementation guide extracted to:** `docs/skills/playbook-gen/SKILL.md` § "The 10 Quality Characteristics"
>
> Every playbook must exhibit all 10. The skill file contains detailed how-to-implement instructions, examples, and templates for each.

The 10 characteristics (summary):

1. **Prompt-Based Atomic Units** — one deliverable per prompt, ≤6 acceptance criteria, ≤3 files or ~400 lines
2. **Dependency Graph** — DAG with `Depends on:` field per prompt
3. **Reference Loading Instructions** — line-range references per prompt, ~800-line budget
4. **Schema Snapshots** — inline table/column listing from data-model.md
5. **Test-First Acceptance Criteria** — checkbox format, always includes tenant isolation + compilation check
6. **Phase-Level Preamble** — 5 sections: built, delivers, excludes, patterns, mandatory context
7. **File Path Conventions** — monorepo paths per prompt
8. **Integration Checkpoints** — verification-only prompt every 3–5 prompts
9. **Post-MVP Guardrails** — "Do NOT Build" section per prompt
10. **Migration Awareness** — explicit migration requirements per prompt

---

## Playbook Document Template

> **Full template extracted to:** `docs/skills/playbook-gen/SKILL.md` § "Playbook Document Template"
>
> The template includes: phase preamble (5 sections), section index table, per-prompt structure (depends on, load context, target files, schema snapshot, task, acceptance criteria, do NOT build, git), and integration checkpoint format.

---

## Context Management Rules

> **Full rules extracted to:** `docs/skills/playbook-gen/SKILL.md` § "Context Management Rules"

**Key rules (summary):**
- **~800-line rule:** No prompt's reference doc loading exceeds ~800 lines
- **Section indexes:** Use line ranges from section index tables, never load full large docs
- **Small docs (<200 lines):** Load whole: forms.md, observability.md, command-bar.md, settings.md
- **Cross-phase context:** State what exists as a fact, don't re-load prior phase docs
- **Existing roadmaps in reference docs:** Use as starting points, not final prompts (need dependency graphs, line ranges, schema snapshots, acceptance criteria added). Docs with roadmaps: sync-engine.md, schema-descriptor-service.md, record-templates.md, chart-blocks.md, booking-scheduling.md, duckdb-context-layer-ref.md, ai-field-agents-ref.md, document-intelligence.md, inventory-capabilities.md, workspace-map.md, personal-notes-capture.md.

---

## Phase-Specific Guidance

### Phase 1: MVP — Foundation (10 sub-phases, ~86 prompts)

This is the largest foundational phase and the most critical to get right. Everything else builds on it.

**Sub-phase decomposition (final — from `phase-division-phase1.md`):**

| Sub-Phase | Deliverable | Est. Prompts | Key Risk |
|-----------|-------------|--------------|----------|
| **1A** | Monorepo, CI Pipeline, Dev Environment | 8 | Turborepo + pnpm workspace resolution |
| **1B** | Database Schema (52 tables), Connection Pooling, Tenant Routing | 13 | FK dependency ordering across 52 tables |
| **1C** | Authentication, Tenant Isolation, Workspace Roles | 5 | Clerk webhook reliability |
| **1D** | Observability, Security Hardening | 7 | OTel auto-instrumentation latency |
| **1E** | Testing Infrastructure | 8 | Factory type safety vs schema changes |
| **1F** | Design System Foundation | 8 | CSS custom property naming conflicts |
| **1G** | Runtime Services: Real-Time, Worker, File Upload | 9 | Socket.io + Clerk JWT handshake timing |
| **1H** | AI Service Layer | 10 | Anthropic SDK type leakage |
| **1I** | Audit Log Helper, Platform API Auth Skeleton | 8 | API key timing attack prevention |
| **1J** | CP Migration, Multi-Tenant Auth & Navigation Shell | 11 | Clerk `setActive()` tenant-switching consistency |

**Dependency graph:**
```
1A → 1B → {1C, 1D, 1E, 1F} → {1G, 1H, 1I} → 1J
```
After 1B: 1C/1D/1E/1F in parallel. After 1C+1D: 1G/1H/1I in parallel. 1J depends on 1A+1B+1C+1F and can run in parallel with 1I.

**Schema strategy:** 1B creates Drizzle schema for ALL 52 MVP tables — not just Foundation tables. Every subsequent phase assumes these tables exist. 1J adds `tenant_relationships` table + `effective_memberships` view as a CP-002 migration (total: 52 tables + 1 view after 1J).

**What to include from `permissions.md`:** Only workspace role storage on `workspace_memberships` (lines 59–86) in 1C. Full permission model ships in 3A-iii.

**What to include from `compliance.md`:** RLS policies (198–217) → 1B; security headers, encryption, PII, webhooks → 1D. Not GDPR rights or SOC 2.

**What to include from `platform-api.md`:** Only `api_keys` table, auth middleware, rate limiting, error format → 1I. Not Data API or Provisioning endpoints.

### Phase 2: MVP — Sync (3 sub-phases, ~36 prompts)

Sequential execution: 2A → 2B → 2C. No parallelism within Phase 2.

| Sub-Phase | Deliverable | Est. Prompts | Key Risk |
|-----------|-------------|--------------|----------|
| **2A** | FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter | 13 | ~40 field type JSONB shape design |
| **2B** | Synced Data Performance, Outbound Sync, Conflict Resolution | 12 | Conflict detection race conditions |
| **2C** | Notion Adapter, Error Recovery, Sync Dashboard | 11 | Notion hierarchical data model mismatch |

**Key decisions:** SmartSuite adapter deferred to Phase 3 Core UX (per `sync-engine.md` Phase Implementation). FieldTypeRegistry bundled with 2A (not a standalone sub-phase — only 19 lines of registry code, tightly coupled to adapters).

### Phase 3: MVP — Core UX (16 sub-phases, ~168 prompts)

**This phase is split into two halves with 16 sub-phases total.** Each sub-phase gets its own playbook document. See the Phase 3 tables in the "Sub-Phase Requirement" section above for the full decomposition.

**Critical path through Phase 3:**
```
3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii → 3F-i → 3H-i → 3H-ii
```

**Parallel execution after 3A-iii completes:** 3B-i, 3C, and 3D can proceed in parallel (no direct dependencies between them). 3B-ii depends on 3B-i.

**Parallel execution after 3B-ii completes:** 3F-i, 3G-i, 3G-ii, 5A, and 6B can all run in parallel.

**Key dependency graph:**
```
Phase 3 — First Half:
3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii
                      → 3C (parallel with 3B-i after 3A-ii)
                      → 3D (after 3A-iii + 3B-i)

Phase 3 — Second Half:
3A-iii + 3C → 3E-i (Portals)
3A-i + 3A-ii → 3E-ii (Forms, parallel with 3E-i)
3B-ii → 3F-i (Field Groups)
3B-i → 3F-ii (Bulk Ops, parallel with 3F-i)
3A-iii → 3F-iii (Record Templates, parallel with 3F-ii)
3C + 3B-ii → 3G-i (Settings/Audit)
3C + 3B-ii → 3G-ii (My Office/Notes, parallel with 3G-i)
3F-i + 3F-ii + 3F-iii + 3E-ii → 3H-i (Mobile Features)
3H-i + 3G-i + 3G-ii → 3H-ii (Mobile Infrastructure)
```

### Phase 4: MVP — Automations (2 sub-phases, ~22 prompts)

| Sub-Phase | Deliverable | Est. Prompts | Key Risk |
|-----------|-------------|--------------|----------|
| **4A** | Trigger System, Execution Engine & Builder UI | 12 | Trigger registry memory management |
| **4B** | Action Implementations, Webhooks, Testing & Status Field Governance | 10 | Action integration breadth + SSRF protection |

**Key decisions:** Visual automation canvas excluded (post-MVP). Status field transition governance modes 1+2 bundled with 4B (workflow logic related to automations). Automation Building AI deferred to Phase 5. `approval-workflows.md` modes 1+2 (lines 38–144) assigned to 4B; Mode 3 approval chains are post-MVP.

4A can start as early as step 6 (after 2A completes), but 4B is gated on 3D (document generation action) and 3C (email/notification actions).

### Phase 5: MVP — AI (3 sub-phases, ~31 prompts)

| Sub-Phase | Deliverable | Est. Prompts | Key Risk |
|-----------|-------------|--------------|----------|
| **5A** | AI Data Contract Implementations & Context Builder | 9 | Field type round-trip fidelity (~25 types) |
| **5B** | User-Facing AI Features & Metering Dashboards | 10 | AI feature UX consistency across 5 features |
| **5C** | Runtime Skills Architecture | 12 | Skill-context token budget management across 7 platform skills |

**Key decisions:** 5A implements `canonicalToAIContext()` and `aiToCanonical()` for all MVP field types, builds the Context Builder with SDS-backed heuristic schema retrieval, and registers the full AI tool suite. 5B builds the 5 user-facing features (Smart Fill, Record Summarization, Document AI Draft, Field & Link Suggestions, Automation Building AI) plus the Admin AI Dashboard and User Usage View. 5C builds the runtime skills architecture from `ai-skills-architecture.md`: Context Builder skill integration, intent classifier enhancement, Prompt Registry `requiredSkills` field, 7 platform skill documents (automation-builder, portal-builder, document-templates, report-charts, record-management, communication, command-bar), `skill_context` JSONB column on `ai_usage_log`, eval framework extension, and token budget allocator.

5A can start in parallel with 4A (no dependency between them). 5B depends on both 5A and 4A (Automation Building AI needs the automation builder). 5C depends on 5A (Context Builder) and 5B (AI features must exist before skills enhance them). Late Phase 5 / early post-MVP items from `ai-skills-architecture.md` (Workspace Usage Descriptor, first integration skill, Skill Performance dashboard) are deferred to post-MVP unless time permits.

**Post-MVP AI guardrails:** The following docs define post-MVP AI scope and must NOT be built during Phase 5: `agent-architecture.md` (AI agent runtime — 650 lines), `platform-maintenance-agents.md` (platform-level autonomous agents — 1,106 lines), `ai-field-agents-ref.md` (LLM-powered computed fields — 1,618 lines). These depend on the agent runtime and DuckDB Context Layer. Only `ai-skills-architecture.md` MVP-scoped items (Tier 1 skills + Context Builder integration) are in Phase 5; the Skill Maintenance Agent from that doc is post-MVP.

### Phase 6: MVP — API (2 sub-phases, ~15 prompts)

| Sub-Phase | Deliverable | Est. Prompts | Key Risk |
|-----------|-------------|--------------|----------|
| **6A** | Data API: Record CRUD, Filtering & Batch Operations | 9 | Filter syntax parsing across 14 operators |
| **6B** | Schema API, File Upload API & SDS Endpoint | 6 | SDS endpoint scope leakage |

**Key decisions:** Per `platform-api.md` Phase Implementation, MVP includes only: Data API, Schema API, File Upload API, API request logging. All other API groups (Provisioning, Automation, AI, Webhook Management, Tenant Management) are post-MVP. 6A and 6B can proceed in parallel (6B has no dependency on 6A). 6A depends on 4B (API mutations fire automation triggers).

---

## Handling Cross-Cutting Concerns

Some concerns span multiple phases. Here's how to handle them:

### Tenant Isolation
- Built once in Phase 1 (RLS policies, `getDbForTenant()`, `testTenantIsolation()` helper).
- Every subsequent prompt that creates a data access function MUST include a tenant isolation acceptance criterion.
- Never re-explain the pattern — just reference it: "Use `getDbForTenant()` and write a `testTenantIsolation()` test."

### Design System
- Component primitives built in Phase 1.
- Every subsequent UI prompt should reference design-system.md for the relevant pattern (colors, spacing, component).
- Keep design-system.md line-range references compact — most prompts only need one section.

### Error Handling
- Default patterns defined in `CLAUDE.md` (Error Handling section).
- Domain-specific overrides in each reference doc (e.g., `permissions.md` § Permission Denial Behavior, `portals.md` § Auth Failure Paths).
- Prompt-level instruction: "Follow the default error handling from CLAUDE.md. Override with [specific doc section] for [specific case]."

### Mobile
- Phase 3H builds the mobile shell, but mobile considerations apply throughout.
- For non-mobile prompts: "Ensure components use responsive Tailwind classes. Mobile-specific layout ships in Phase 3H."
- Don't build mobile UI in non-mobile prompts, but don't build desktop-only patterns that would need to be ripped out later.

### CockroachDB Safeguards
- 5 safeguards active from Phase 1 (defined in `CLAUDE.md` § CockroachDB Readiness).
- Include in Phase 1 preamble. In subsequent phases, include as a one-liner: "CockroachDB safeguards remain active (UUIDv7, no PG-specific syntax, no advisory locks)."

---

## Quality-First Mandate

> **Full quality guide extracted to:** `docs/skills/playbook-gen/SKILL.md` § "Quality-First Mandate" and "Quality Checklist"

**The singular priority when producing playbooks is quality.** Not speed, not conciseness, not minimizing sub-phases. Take your time. Read every relevant reference doc section. Understand the architecture. Only then decompose.

**Key quality indicators:** deliverable name a non-coder understands, precise schema snapshot, verifiable acceptance criteria, "Do NOT Build" section, precise line ranges. When in doubt, make it smaller and more precise.

---

## Git Workflow

Every sub-phase's lifecycle involves up to three branches, created and merged in a strict order. This section aligns with `CONTRIBUTING.md` — see that file for the full branching model, commit message format, and tagging conventions.

### The Three-Branch Sequence Per Sub-Phase

```
1. docs/<description>           ← Step 0 (Architect Agent)
2. build/<sub-phase>            ← Step 3 (Builder Agent)
3. fix/post-<sub-phase>-docs-sync ← Step 5 (Docs Agent)
```

**The merge order is mandatory. Do not skip steps.**

```
Step 0:
  1. Create  docs/<description>  branch from main
  2. Make all reference doc changes for the upcoming build
  3. Run consistency check (glossary, MANIFEST, dependency graph, cross-refs)
  4. Commit, push, self-review the full diff
  5. Merge docs branch to main

Step 3:
  6. Create  build/<sub-phase>  branch from the NOW-UPDATED main
  7. Execute build prompts against stable docs
  8. Final integration checkpoint passes
  9. Open PR, review, merge build branch to main

Step 5:
  10. Create  fix/post-<sub-phase>-docs-sync  branch from main
  11. Update MANIFEST line counts, add GLOSSARY terms, fix cross-refs
  12. Commit, push, merge fix branch to main
  13. Tag if milestone
```

**Why this order matters:** Build prompts reference docs on `main`. If docs aren't settled before the build branch starts, you'll build against stale or half-finished specs. Steps 1–5 ensure docs are stable. Step 6 guarantees the build sees the right versions. Steps 10–12 ensure docs stay in sync after code changes.

### Branch Naming

| Prefix | Purpose | Agent | Example |
|--------|---------|-------|---------|
| `docs/` | Documentation changes only | Architect Agent | `docs/phase-3g-notes-mvp` |
| `build/` | Code implementation | Builder Agent | `build/3g-ii-notes-surfaces` |
| `fix/` | Post-build docs sync | Docs Agent | `fix/post-3g-ii-docs-sync` |
| `explore/` | Throwaway experiments, not for merge | — | `explore/duckdb-perf-test` |

**Naming rules (from CONTRIBUTING.md):**
- Use lowercase and hyphens: `docs/omnichannel-schema-prep`
- Include the sub-phase ID when the branch maps to one: `build/3g-ii-notes-surfaces`
- Keep names under ~50 characters
- Be specific: `docs/support-system-redesign` not `docs/updates`

### Commit Cadence

**One commit per prompt.** After each prompt's acceptance criteria pass, Claude Code commits with a conventional commit message.

Commit message format (from CONTRIBUTING.md):
```
<area>: <what changed>

Optional body explaining WHY if the "what" isn't self-explanatory.
```

Area prefixes: `docs`, `schema`, `feat`, `fix`, `refactor`, `test`, `chore`, `audit`.

**Build prompt commit examples:**
```
feat(db): create records and fields schema with RLS policies [Phase 1B, Prompt 3]

- records table with canonical_data JSONB, source_refs JSONB
- fields table with config JSONB, position ordering
- RLS policies enforcing tenant isolation on both tables
- testTenantIsolation() passing for both tables
```

```
feat(sync): implement AirtableAdapter.toCanonical() for core field types [Phase 2, Prompt 4]

- Text, number, date, single-select, multi-select transforms
- FieldTypeRegistry entries for all 5 types
- 95% branch coverage on adapter transforms
```

**Integration Checkpoint commits** use a distinct prefix:
```
chore(verify): integration checkpoint 1 — all tests pass [Phase 1B, CP-1]
```

**Doc prep commits (Step 0):**
```
docs: update data-model.md with polymorphic thread_participants [Phase 3C prep]
docs: create ADR-004 for i18n framework selection [Phase 1F prep]
```

**Docs sync commits (Step 5):**
```
docs: update MANIFEST line counts after Phase 2B build
docs: add 3 new GLOSSARY terms from Phase 2B (sync_metadata, last_synced_value, outbound_queue)
```

### Push Cadence

**Push at every Integration Checkpoint.** Not after every commit — that would be noisy. The rhythm is:
1. Prompt 1 → commit locally
2. Prompt 2 → commit locally
3. Prompt 3 → commit locally
4. Integration Checkpoint 1 → commit, then **push** the branch
5. Prompt 4 → commit locally
6. ...and so on

This means you (Steven) can review the remote branch state after every checkpoint — roughly every 3–5 prompts.

### Pull Request and Merge

**One PR per branch.** When a branch is ready to merge:

1. Push the branch if not already pushed.
2. Open a PR from the branch to `main`.
3. PR title format: `[Step N] Phase XX — Description` (e.g., `[Step 0] Phase 3C — Docs Prep`, `[Step 3] Phase 2B — Outbound Sync & Conflicts`).
4. PR description: List all changes/prompts completed and their deliverables.
5. Review the PR (or have Claude review it in a separate session).
6. Merge to `main` using **squash merge** to keep main's history clean.
7. Tag if milestone (see CONTRIBUTING.md § Tagging and Releases).
8. Delete the branch.

### Hotfix Pattern

If you discover an issue during a build that requires a fix to prior code:

1. Stash or commit current work on the build branch.
2. Branch from `main`: `fix/<description>`
3. Fix the issue, write a test for it.
4. PR, review, merge to `main`.
5. Rebase your build branch onto the updated `main`: `git rebase main`
6. Continue the build.

### Git Instructions in Playbook Prompts

Every playbook prompt must include a `Git:` field. Examples:

- **First prompt in a build phase:** `Git: Create and checkout branch build/phase-1b-database from main`
- **Normal prompt:** `Git: Commit with message "feat(db): create records and fields schema with RLS policies [Phase 1B, Prompt 3]"`
- **Integration Checkpoint:** `Git: Commit with message "chore(verify): integration checkpoint 1 [Phase 1B, CP-1]", then push branch to origin`
- **Final checkpoint:** `Git: Commit, push, then open PR to main with title "[Step 3] Phase 1B — Database Schema & Core Tables"`

---

## Prompting Roadmap Specification

> **Full specification extracted to:** `docs/skills/roadmap-gen/SKILL.md`
>
> The skill contains: label system (`[PASTE INTO CLAUDE CODE]`, `[GIT COMMAND]`, `[CHECKPOINT]`, `[DECISION POINT]`), complete 6-step document structure template, plain-English explanation format ("What This Builds" / "What You'll See"), quality standard, and session input rules.

**Key rules (summary):**
- Every playbook must have a companion Prompting Roadmap (markdown)
- Generated in a separate Claude.ai session from the playbook (different context needs)
- Session inputs: only the `roadmap-gen` skill + the completed playbook
- Covers all 6 lifecycle steps with paste-ready content
- Steven should be able to execute top-to-bottom with zero technical judgment calls

---

## Workflow — Putting It All Together

### Before Your First Sub-Phase

1. Confirm the reference doc tarball is current and all docs have section indexes.
2. Confirm CONTRIBUTING.md is in the repo root (it defines branching and commit conventions).
3. Confirm ADR-TEMPLATE.md is at `docs/decisions/ADR-TEMPLATE.md`.
4. Confirm the phase division files exist in `docs/phases/`.

### The Six-Step Cycle (repeat for every sub-phase)

#### Step 0 — Doc Prep

1. **Check whether doc changes are needed.** Review the reference docs that the upcoming sub-phase will consume. Are there gaps, stale sections, or undocumented decisions?
2. **If yes:** Open Claude Code. Follow the Prompting Roadmap's Step 0 section — create a `docs/` branch, make changes, run consistency check, merge to `main`.
3. **If no:** Skip to Step 1. Note "no doc changes required" and move on.

#### Step 1 — Produce the Playbook

4. **Start a Claude.ai session.**
5. **Upload the reference docs + this strategy doc + the Phase Division files.**
6. **Request one sub-phase at a time:** "Produce the playbook for Phase 2B: Synced Data Performance, Outbound Sync, Conflict Resolution."
7. **Claude produces the playbook** (markdown) — the technical prompting roadmap with all 10 quality characteristics.
8. **Review the playbook.** Check that prompts are right-sized, dependencies make sense, acceptance criteria are testable, and scope guards are present.
9. **Iterate if needed.** If a prompt is too large, ask Claude to split it. Quality is the priority — take as many passes as needed.

#### Step 2 — Produce the Prompting Roadmap

10. **Start a NEW Claude.ai session** (separate from the playbook generation session).
11. **Upload this strategy doc + the completed playbook for that sub-phase.**
12. **Request the Prompting Roadmap:** "Produce the Prompting Roadmap (markdown) for Phase 2B using this playbook and the Prompting Roadmap Specification in the strategy doc."
13. **Claude produces the Prompting Roadmap** — the lifecycle-spanning runbook with paste-ready content for all six steps.
14. **Review the roadmap.** Check that every step has paste-ready content, all labels are present, decision points have binary instructions, and the roadmap is executable top-to-bottom without technical judgment calls.

#### Step 3 — Execute the Build

15. **Open your terminal.** Navigate to the EveryStack monorepo.
16. **Open Claude Code** (in VS Code or terminal).
17. **Open the Prompting Roadmap** side by side — this is your script.
18. **Follow the roadmap's Step 3 section top to bottom:**
    - Read the explanation block to understand what's coming.
    - Copy the `[PASTE INTO CLAUDE CODE]` block and paste it into Claude Code.
    - Wait for Claude Code to complete the work.
    - Verify using the `[CHECKPOINT]` instructions.
    - Copy the `[GIT COMMAND]` block and run it to commit.
    - Move to the next prompt.
19. **At Integration Checkpoints:** Push the branch, review the diff on GitHub, and confirm everything looks right before proceeding.
20. **At sub-phase end:** Open the PR, review, merge to main.

#### Step 4 — Review the Build

21. **Generate the build diff** following the roadmap's Step 4 section.
22. **Open a NEW Claude.ai session.**
23. **Upload the playbook + diff + CLAUDE.md + GLOSSARY.md.**
24. **Paste the Reviewer Agent prompt** from the roadmap.
25. **Read the verdict.**
26. **If PASS:** Proceed to Step 5.
27. **If FAIL:** Follow the roadmap's fix instructions — paste the fix prompt into Claude Code, commit fixes, re-run the review.

#### Step 5 — Sync the Docs

28. **Follow the roadmap's Step 5 section.** Create the `fix/` branch, run the Docs Agent, review, merge.
29. **Tag if milestone.**

#### Next Sub-Phase — Repeat the Cycle

30. **Move to the next sub-phase's Step 0.** If a Prompting Roadmap already exists for it, open it. If not, start from Step 1 for that sub-phase.

**Critical rule:** Don't request all playbooks at once. Each playbook depends on knowing exactly what the prior phases produced. Generate them sequentially as you complete each phase. The playbook for Phase 3 will be better if Claude knows the exact state of the codebase after Phases 1 and 2.

---

## Quality Checklist for Each Sub-Phase

> **Detailed checklists extracted to the relevant skills:**
> - Playbook quality + subdivision quality → `docs/skills/playbook-gen/SKILL.md` § "Quality Checklist"
> - Prompting Roadmap quality → `docs/skills/roadmap-gen/SKILL.md` § "Quality Standard"
> - Review quality → `docs/skills/reviewer/SKILL.md`
> - Docs sync quality → `docs/skills/docs-sync/SKILL.md`
> - Git workflow checklist → `docs/skills/builder/SKILL.md` § "Branch Rules"
>
> The master checklist here is a summary. The skills contain the full detail.

### Summary Checklist
- [ ] Playbook has all 10 quality characteristics (see `playbook-gen` skill)
- [ ] Prompting Roadmap covers all 6 steps with paste-ready content (see `roadmap-gen` skill)
- [ ] Doc prep: MANIFEST updated, no stale terms, consistency check passes
- [ ] Git: correct branch prefixes (`docs/`, `build/`, `fix/`), conventional commits
- [ ] Review: specific acceptance criteria verdicts, actionable fix instructions
- [ ] Docs sync: MANIFEST line counts match, no stale cross-refs, no missing glossary terms

---

## Playbook_Prompts.md Absorption Note

The current `Playbook_Prompts.md` file serves as a master script with three types of content per sub-phase:

1. **Files to upload** — the exact file list for each Session A-1.
2. **Pass A-1 prompt** — the opening message to paste for playbook generation.
3. **Cumulative build summaries** — what has been built so far, updated after each sub-phase.

Under the six-step lifecycle, this content is handled as follows:

- **Files to upload and A-1 prompts** remain in the phase-specific guidance section of this strategy doc (the Phase 1–6 tables and decomposition details already specify which reference docs are relevant per sub-phase). `Playbook_Prompts.md` can continue to exist as a slim standalone convenience file listing just the per-sub-phase file lists and opening prompts — it is not deprecated, but it is no longer the only place this information lives.

- **Cumulative build summaries** remain in `Playbook_Prompts.md`. These are updated after each build with actual deliverables and carried forward into subsequent prompts. This is operational state that changes with every sub-phase — it belongs in a living document, not in this strategy doc.

- **The A-2 prompt** is now standardized in the Prompting Roadmap Specification above. It is the same for every sub-phase, just as the current A-2 prompt in `Playbook_Prompts.md` is already the same every time. The standard prompt is: "Produce the Prompting Roadmap (markdown) for Phase [X] using this playbook and the Prompting Roadmap Specification in the strategy doc. Cover all six lifecycle steps with paste-ready content. Use the label system defined in the specification. Include Architect Agent, Reviewer Agent, and Docs Agent prompts. Include decision points with binary instructions."

---

## Glossary of Strategy-Specific Terms

| Term | Meaning |
|------|---------|
| **Playbook** | A sub-phase-level build roadmap document containing atomic prompts — the technical document Claude Code consumes |
| **Prompting Roadmap** | A companion markdown file covering all six lifecycle steps with paste-ready content — the operations document Steven follows |
| **Six-Step Lifecycle** | The full cycle per sub-phase: Doc Prep → Playbook Generation → Roadmap Generation → Build Execution → Review → Docs Sync |
| **Architect Agent** | Step 0 agent. Prepares docs before the build. Only modifies files under `docs/`. Owns `docs/` branches. Runs in Claude Code. |
| **Builder Agent** | Step 3 agent. The existing Claude Code instance that executes playbook prompts to produce code. Owns `build/` branches. |
| **Reviewer Agent** | Step 4 agent. Evaluates build output against playbook acceptance criteria. Never modifies anything. Runs in Claude.ai. |
| **Docs Agent** | Step 5 agent. Syncs docs after a build. Only modifies files under `docs/`. Owns `fix/` branches. Runs in Claude Code. |
| **Step 1** | Playbook generation — Claude reads reference docs and produces the playbook (identical to former Session A-1) |
| **Step 2** | Prompting Roadmap generation — Claude reads the playbook and produces the lifecycle-spanning roadmap (replaces former Session A-2) |
| **Step 3** | Build execution — Steven pastes prompts from the roadmap into Claude Code, which writes code (identical to former Session B) |
| **Prompt** | A single, self-contained implementation unit within a playbook |
| **Sub-phase** | A division of a large phase into smaller playbook-sized units (e.g., 3A, 3A-i) |
| **Integration checkpoint** | A verification-only prompt that runs the test suite and pushes to the remote branch |
| **Scope guard** | A "Do NOT Build" section preventing over-engineering |
| **Schema snapshot** | An inline listing of relevant table/column definitions |
| **Section index** | A line-range table at the top of a reference doc enabling selective loading |
| **Context budget** | The ~800-line limit on reference doc content per prompt |
| **Phase preamble** | The orientation block at the top of each playbook |
| **DAG** | Directed Acyclic Graph — the prompt dependency structure |
| **Conventional commit** | Commit message format: `<area>: <what changed> [Phase X, Prompt N]` |
| **Decision point** | A binary fork in the roadmap with explicit instructions for each path |
| **ADR** | Architecture Decision Record — documents a design decision, its rationale, and consequences |
| **Consistency check** | Verification that glossary terms, MANIFEST entries, dependency graph, and cross-references are all in sync |
