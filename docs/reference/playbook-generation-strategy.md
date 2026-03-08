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
| **5** | MVP — AI | 2 (5A–5B) | ~19 | AI data contract implementations (~25 field types), Context Builder, 5 user-facing AI features (Smart Fill, Record Summarization, Document AI Draft, Field & Link Suggestions, Automation Building AI), metering dashboards | `ai-architecture.md`, `ai-data-contract.md`, `ai-metering.md`, `schema-descriptor-service.md` |
| **6** | MVP — API | 2 (6A–6B) | ~15 | Platform API Data API (Record CRUD + filtering + batch), Schema API, File Upload API, SDS endpoint. Provisioning API deferred to post-MVP. | `platform-api.md` |

**Totals: 35 sub-phases, ~346 estimated prompts.**

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

For each phase (or sub-phase), follow this exact sequence:

### Step 0 — Load Mandatory Context (Playbook Generation Session Only)

When generating a playbook (Step 1 — see "Six-Step Lifecycle" above), load these three docs in full:

1. `GLOSSARY.md` (876 lines) — source of truth for naming, scope, definitions
2. `CLAUDE.md` (461 lines) — project rules, conventions, CI gates
3. `MANIFEST.md` (259 lines) — doc index, scope map, cross-references

This consumes ~1,600 lines (~7,000 tokens) of context. Budget the remaining context for reference doc sections.

**Important:** This full loading applies to playbook *generation* only. During build *execution* (Step 3), the context strategy is different — see "Six-Step Lifecycle" above.

### Step 1 — Identify Reference Docs for This Phase

Use the MANIFEST's "Reference Doc Scope Map" to identify which reference docs apply. Cross-reference with the phase table above.

For each reference doc:
- Check if it has a **Section Index** (most 300+ line docs do). If yes, note the line ranges you'll need.
- Determine which sections are relevant to THIS phase vs. later phases. Only load what's needed.
- Check for **(post-MVP)** annotations in cross-references. Do not load post-MVP sections for MVP phases.

### Step 2 — Read the Phase Implementation Notes

Many reference docs contain a "Phase Implementation" section at the end that specifies what ships when. Read these FIRST — they define scope boundaries within the doc.

Key docs with Phase Implementation sections: `sync-engine.md` (lines 1072–1079), `permissions.md` (lines 468–475), `tables-and-views.md` (line 796+), `portals.md` (check index), `communications.md` (check index).

### Step 3 — Read Relevant Reference Doc Sections

Load the relevant sections using line-range indexes. For example, if building the sync engine's conflict resolution UI, load `sync-engine.md` lines 514–772 — not the full 1,079-line file.

**Context budget rule:** No single prompt's "Load context" instructions should exceed ~800 lines of reference doc content. If a prompt needs more, it's too large — split it.

### Step 4 — Decompose Into Atomic Prompts

Transform the reference doc content into right-sized prompt units. Each prompt should be completable in a single Claude Code session. See "Prompt Sizing Rules" below.

### Step 5 — Build the Dependency Graph

Map the "depends on" relationships between prompts. These are a DAG, not a linear sequence. See "Dependency Graph Rules" below.

### Step 6 — Add Integration Checkpoints

Insert an integration checkpoint after every 3–5 prompts. See "Integration Checkpoints" below.

### Step 7 — Write the Playbook

Assemble the playbook document using the template in "Playbook Document Template" below. Then produce the companion Prompting Roadmap (markdown) following the specification in "Prompting Roadmap Specification" below. Both documents must be delivered together — a playbook without a Prompting Roadmap is incomplete.

---

## The 10 Quality Characteristics — Implementation Guide

Each of these must be present in every playbook. Here's exactly how to implement them:

### 1. Prompt-Based Atomic Units

**What this means:** Each prompt has one clear deliverable that Claude Code can complete in a single session.

**How to implement:**
- Name the prompt after its deliverable: "Build the AirtableAdapter.toCanonical() for text, number, and date fields" not "Set up the sync layer"
- A prompt that would produce more than ~3 files or ~400 lines of implementation code is too large. Split it.
- A prompt that touches more than 2 packages in the monorepo is probably too large. Split it.

**Sizing heuristic:** If you can't write the acceptance criteria in ≤6 checkboxes, the prompt is too big.

**What a good prompt deliverable looks like:**
- ✅ "Create the `records` and `fields` Drizzle schema with tenant isolation and RLS policies"
- ✅ "Build the permission resolution algorithm with Redis caching and session-level memoization"
- ✅ "Implement the Grid view cell renderer for text, number, date, and status field types"
- ❌ "Build the permissions system" (too large)
- ❌ "Set up the database" (too vague)
- ❌ "Create the UI" (meaningless)

### 2. Dependency Graph

**What this means:** Each prompt declares which prior prompts it depends on, forming a DAG.

**How to implement:**
- Add a `Depends on:` field to every prompt. Use prompt numbers.
- `Depends on: None` for prompts that can start immediately.
- `Depends on: 3, 7` means this prompt requires the outputs of prompts 3 and 7 but nothing else.
- If prompt 12 depends on prompt 11 only because they're sequential, but 12 doesn't actually use 11's output — remove the dependency.
- Cross-phase dependencies: If a prompt depends on a prior phase's output, state it as: `Depends on: Phase 1 complete` or `Depends on: Phase 2, Prompt 8 (FieldTypeRegistry)`.

### 3. Reference Loading Instructions Per Prompt

**What this means:** Each prompt specifies exactly which reference doc sections to load, using line ranges.

**How to implement:**
- Use the Section Index tables from each reference doc.
- Format: `Load context: sync-engine.md lines 69–87 (Field Type Registry), data-model.md lines 30–95 (Core Tables)`
- Never write "see sync-engine.md" without line ranges for docs with indexes.
- For docs under ~200 lines without indexes (forms.md, observability.md, command-bar.md, settings.md), it's acceptable to load the whole file: `Load context: forms.md (full, 182 lines)`
- Always include `GLOSSARY.md (full)` and `CLAUDE.md (full)` in the phase preamble — don't repeat these per prompt.

### 4. Schema Snapshots

**What this means:** Each prompt that touches the database includes a compact snapshot of the relevant tables/columns.

**How to implement:**
- Pull the relevant table definitions from `data-model.md` and include them inline in the prompt.
- Show only the columns that this prompt reads or writes — not the full table definition.
- If the prompt creates a new table, show the full schema it should create.
- If the prompt adds columns to an existing table, show the existing columns + the new ones (marked with a comment like `-- NEW`).
- Reference the exact lines in `data-model.md` where the schema is defined.

**Example format:**
```
Schema snapshot (from data-model.md lines 40–55):
  records: id (UUIDv7 PK), tenant_id, table_id, canonical_data (JSONB), source_refs (JSONB), created_by, created_at, updated_at
  fields: id (UUIDv7 PK), tenant_id, table_id, name, field_type, config (JSONB), position, environment, created_at
```

### 5. Test-First Acceptance Criteria

**What this means:** Every prompt ends with specific, testable conditions that define "done."

**How to implement:**
- Use checkbox format: `- [ ] Condition`
- Each condition must be verifiable by running a test or checking a concrete artifact.
- Include specific test function names where possible.
- Always include at minimum:
  - One functional test (the feature works)
  - One tenant isolation test (for any data access function)
  - `ESLint and TypeScript compile with zero errors`
- Reference the testing rules from `CLAUDE.md` (coverage targets, file naming, factory usage).

**Example:**
```
Acceptance Criteria:
- [ ] testTenantIsolation() passes for getRecordsByTable() and getRecordById()
- [ ] createRecord() with valid canonical_data returns the new record with UUIDv7 id
- [ ] createRecord() with invalid field types returns validation error (Zod)
- [ ] canonical_data JSONB is keyed by fields.id, not field name
- [ ] RLS policy blocks cross-tenant access (tested with 2 tenants)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
```

### 6. Phase-Level Preamble

**What this means:** Each playbook opens with a context block that orients Claude Code.

**How to implement:** Include these five sections at the top of every playbook:

1. **What has been built** — List prior phases and their key outputs. Reference specific files/modules that exist.
2. **What this phase delivers** — The user-visible outcome when this phase is complete.
3. **What this phase does NOT build** — Explicit scope exclusions. List tempting things Claude Code might over-build.
4. **Architecture patterns for this phase** — Phase-specific conventions (e.g., "All queries in this phase go through `getDbForTenant()`").
5. **Mandatory context** — State that `GLOSSARY.md` and `CLAUDE.md` must be loaded for every prompt in this phase.

### 7. File Path Conventions Per Prompt

**What this means:** Each prompt specifies where to create files in the monorepo.

**How to implement:**
- Use the monorepo structure from `CLAUDE.md` as the canonical directory map.
- Format: `Target files: packages/shared/db/schema/records.ts, packages/shared/db/schema/fields.ts`
- For new directories, explicitly state: `Create directory: packages/shared/sync/adapters/`
- Use the naming conventions from `CLAUDE.md`: kebab-case files, PascalCase components, camelCase functions.

**Key monorepo paths:**
```
apps/web/src/app/          — Routes and layouts
apps/web/src/components/   — React components
apps/web/src/data/         — Server-side data access (queries, mutations)
apps/web/src/actions/      — Server Actions
apps/web/src/lib/          — Client utilities
apps/web/e2e/              — Playwright E2E tests
apps/worker/src/jobs/      — BullMQ job processors
apps/realtime/             — Socket.io server
packages/shared/db/schema/ — Drizzle schema definitions
packages/shared/db/migrations/ — Drizzle migration files
packages/shared/sync/adapters/ — Platform adapters
packages/shared/sync/field-registry.ts — FieldTypeRegistry
packages/shared/ai/        — AI providers, prompts, tools, eval
packages/shared/testing/   — Shared test utilities and factories
```

### 8. Integration Checkpoints

**What this means:** After every 3–5 prompts, include a prompt whose sole job is to verify everything works together.

**How to implement:**
- Name it clearly: `Integration Checkpoint 1 (after Prompts 1–4)`
- The checkpoint runs: full test suite, TypeScript compile, ESLint, and any new E2E tests.
- It verifies no regressions from prior prompts.
- It checks that the CI pre-merge gates would pass.
- It does NOT build new features.

**Template:**
```
## Integration Checkpoint N (after Prompts X–Y)

**Task:** Verify all work from Prompts X–Y integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations
6. Manual verification: [specific thing to check visually or functionally]

**Git:** Commit with message "chore(verify): integration checkpoint N [Phase X, CP-N]", then push branch to origin.

Fix any failures before proceeding to Prompt Z.
```

### 9. Post-MVP Guardrails Per Prompt (Do NOT Build)

**What this means:** Each prompt lists what NOT to build, preventing over-engineering.

**How to implement:**
- Check `GLOSSARY.md` "MVP Explicitly Excludes" table.
- Check the reference doc for (post-MVP) annotations.
- List 2–5 specific things that would be tempting scope creep.

**Example:**
```
Do NOT build:
- Kanban or Calendar view rendering (post-MVP)
- Visual automation canvas or branching logic (post-MVP)
- Formula engine or computed fields (post-MVP)
- App Designer page builder or app types (post-MVP)
- Do NOT add fields to the schema that are only needed post-MVP
```

### 10. Migration Awareness

**What this means:** Any prompt that modifies the database schema explicitly notes migration requirements.

**How to implement:**
- State: "This prompt requires a new migration file."
- Reference the migration constraints from `CLAUDE.md`: no ACCESS EXCLUSIVE lock >1s, no migration >30s on staging data.
- Specify the migration file naming: `packages/shared/db/migrations/XXXX_descriptive_name.ts`
- State: "Never modify existing migration files — always create a new one."
- For prompts that DON'T touch the schema, state: "No migration required."

---

## Playbook Document Template

Every playbook must follow this structure. Copy this template and fill it in for each phase/sub-phase.

```markdown
# Phase N[X] — [Phase Name]

## Phase Context

### What Has Been Built
[List prior phases and their key deliverables — files, modules, tables that now exist]

### What This Phase Delivers
[User-visible outcome when complete]

### What This Phase Does NOT Build
[Explicit exclusions — things that would be tempting but are post-MVP or belong to a later phase]

### Architecture Patterns for This Phase
[Phase-specific conventions, patterns, and constraints]

### Mandatory Context for All Prompts
`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

### Skills for This Phase
Load these skill files before executing any prompt in this phase:
- `docs/skills/backend/SKILL.md` — [if this phase touches DB, sync, APIs, workers, or server-side logic]
- `docs/skills/ux-ui/SKILL.md` — [if this phase builds user-facing components, views, or layouts]
- `docs/skills/ai-features/SKILL.md` — [if this phase builds AI features, AIService integrations, or metering]
- `docs/skills/phase-context/SKILL.md` — Always. Current build state, existing files/modules, active conventions.

[List only the skills relevant to this phase. Every phase includes `phase-context`. Most phases include `backend`. Phases with UI work include `ux-ui`. Phases 5A/5B and any AI-touching prompts include `ai-features`.]

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | [name] | None | ~NNN |
| 2 | [name] | 1 | ~NNN |
| ... | ... | ... | ... |
| CP-1 | Integration Checkpoint 1 | 1–4 | — |
| ... | ... | ... | ... |

---

## Prompt 1: [Clear Deliverable Name]

**Depends on:** None (or Prompt X, Y)
**Load context:** [reference doc] lines N–M (Section Name), [other doc] lines N–M (Section Name)
**Target files:** packages/shared/db/schema/records.ts, etc.
**Migration required:** Yes / No
**Git:** Commit with message "feat(scope): description [Phase X, Prompt 1]"

### Schema Snapshot
[Compact table/column listing from data-model.md, or "N/A — no schema changes"]

### Task
[Clear, specific implementation instructions. Reference the exact patterns from reference docs. Include TypeScript interfaces, Zod schemas, or SQL snippets from the reference docs where they exist.]

### Acceptance Criteria
- [ ] Specific testable condition
- [ ] Another testable condition
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Thing that would be tempting but is out of scope
- Another thing

---

## Prompt 2: [Clear Deliverable Name]
...

## Integration Checkpoint 1 (after Prompts 1–N)
...
```

---

## Context Management Rules

These rules prevent context overflow and ensure Claude Code can work effectively with the large specification set.

### The ~800-Line Rule

No single prompt's reference doc loading should exceed ~800 lines of content. This is in addition to the ~1,600 lines consumed by GLOSSARY.md + CLAUDE.md. The total context per prompt is therefore ~2,400 lines of specification + whatever Claude Code needs for the actual implementation work.

If a prompt would need more than 800 lines of reference context, it means one of two things:
1. The prompt is too large — split it into smaller prompts, each loading a subset.
2. You're loading sections that aren't needed — trim to only the relevant sections.

### Section Index Usage

All reference docs 300+ lines have section indexes. Use them aggressively. The format is:

```
| Section | Lines | Covers |
|---------|-------|--------|
| Core Pattern | 30–46 | Adapter → Canonical JSONB → Adapter flow |
| Field Type Registry | 69–87 | Per-platform transforms, type mapping |
```

When writing a prompt's `Load context`, always use these line ranges:
- ✅ `sync-engine.md lines 69–87 (Field Type Registry)`
- ❌ `sync-engine.md` (the full 1,079-line file)

### Docs Under ~200 Lines

These docs are small enough to load whole: `forms.md` (182), `observability.md` (173), `command-bar.md` (163), `project-management.md` (144), `settings.md` (113). Write: `Load context: forms.md (full, 182 lines)`.

### Cross-Phase Context

When a prompt in Phase 3 needs to reference something built in Phase 1, don't re-load the Phase 1 reference docs. Instead, state what exists as a fact in the prompt:

> "The `records` table exists with columns: id, tenant_id, table_id, canonical_data, source_refs, created_by, created_at, updated_at. The `getDbForTenant()` helper handles read/write routing. RLS policies enforce tenant isolation."

This is more context-efficient than re-loading data-model.md.

### Existing Prompt Roadmaps in Reference Docs

Several reference docs already contain "Claude Code Prompt Roadmaps" with pre-decomposed prompts. **Use these as starting points, not as final playbook prompts.** They were written before the playbook structure was defined and may need:
- Dependency graph fields added
- Line-range loading instructions
- Schema snapshots
- Acceptance criteria formalized
- Scope guards added

Docs with existing roadmaps: `sync-engine.md`, `schema-descriptor-service.md`, `record-templates.md`, `chart-blocks.md`, `booking-scheduling.md`, `duckdb-context-layer-ref.md`, `ai-field-agents-ref.md`, `document-intelligence.md`, `inventory-capabilities.md`, `workspace-map.md`, `personal-notes-capture.md`.

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

### Phase 5: MVP — AI (2 sub-phases, ~19 prompts)

| Sub-Phase | Deliverable | Est. Prompts | Key Risk |
|-----------|-------------|--------------|----------|
| **5A** | AI Data Contract Implementations & Context Builder | 9 | Field type round-trip fidelity (~25 types) |
| **5B** | User-Facing AI Features & Metering Dashboards | 10 | AI feature UX consistency across 5 features |

**Key decisions:** 5A implements `canonicalToAIContext()` and `aiToCanonical()` for all MVP field types, builds the Context Builder with SDS-backed heuristic schema retrieval, and registers the full AI tool suite. 5B builds the 5 user-facing features (Smart Fill, Record Summarization, Document AI Draft, Field & Link Suggestions, Automation Building AI) plus the Admin AI Dashboard and User Usage View.

5A can start in parallel with 4A (no dependency between them). 5B depends on both 5A and 4A (Automation Building AI needs the automation builder).

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

**This is the most important section of the strategy doc.**

When producing playbooks, your singular priority is quality. Not speed. Not conciseness. Not minimizing the number of sub-phases. The goal is to produce the **absolute best prompting roadmap possible** — one where every prompt is precisely scoped, thoroughly thought through, and gives Claude Code the clearest possible instructions to build production-grade software.

### What This Means in Practice

**Take your time.** Before writing a single prompt, read every relevant reference doc section carefully. Understand the architecture. Trace the data flow. Identify the edge cases. Think about what could go wrong. Only then decompose the work.

**Subdivide aggressively.** The phase division documents have already decomposed all 6 MVP phases into 35 sub-phases. This decomposition is authoritative — consult the phase division files for scope boundaries. If during playbook generation a sub-phase still feels too large (e.g., 3E-i Portals at 15 prompts), split it further (e.g., 3E-i-α Portal Auth + 3E-i-β Portal Client Experience). **There is no upper limit on the number of sub-phases.** 100 separate playbook documents is perfectly acceptable if that's what it takes to produce the best quality.

**The subdivision test:** For every prompt you write, ask yourself: "Can I explain in one clear sentence what this prompt builds?" If the answer requires an "and" — "it builds the permission resolution algorithm AND the Redis caching layer AND the session memoization" — it's too big. Split it.

**Think about the developer experience.** Each prompt will be executed by Claude Code, which is effectively the engineering team. A vague prompt produces vague code. A precise prompt with a clear schema snapshot, specific file paths, and testable acceptance criteria produces production-quality code. The extra time spent crafting each prompt pays for itself many times over in reduced debugging and rework.

**Think about the founder experience.** Steven is a non-technical founder. Every prompt needs to make sense to him when he reads the Prompting Roadmap. If a prompt's deliverable can't be explained in plain English, the prompt needs to be reconceived — not just better documented.

### Quality Indicators

A well-crafted playbook prompt should have:
- A deliverable name that a non-coder could understand ("Build the record creation form with field validation" not "Implement CreateRecordMutation with Zod input schema")
- A schema snapshot that shows exactly what exists and what's being added — no ambiguity
- Acceptance criteria where every checkbox is something you can verify by running a command or looking at a screen
- A "Do NOT Build" section that proves you thought about scope creep
- Reference doc line ranges that are precise enough that Claude Code loads only what it needs

A poorly-crafted prompt is one that:
- Tries to do too many things at once
- Uses vague deliverable names ("Set up communications")
- Has acceptance criteria like "communications work correctly"
- Loads entire reference docs instead of targeted sections
- Lacks a schema snapshot when it touches the database

**When in doubt, make it smaller and more precise.**

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

For every playbook document produced in Step 1, you must ALSO produce a companion **Prompting Roadmap** as a markdown file. This is the document Steven actually uses to operate the entire lifecycle. It covers all six steps with paste-ready content at every step — from doc prep through post-build docs sync.

### Who This Is For

Steven is EveryStack's founder. He is not a coder. He uses Claude Code as his engineering team. He needs to know exactly what to paste, when to paste it, what to expect, and what to do next — not just during the build, but for every step of the lifecycle. The Prompting Roadmap is his complete control panel.

### Why Markdown (Not .docx)

The Prompting Roadmap is a markdown file so it can:
- Live in the repo under `docs/playbooks/<sub-phase>/` alongside the playbook
- Be version-controlled and diffed
- Be read by Claude Code directly if needed
- Use clear text labels instead of color-coded backgrounds

### Label System

The Prompting Roadmap uses text labels instead of color-coded backgrounds to distinguish action types. Every paste-ready block is fenced in a markdown code block and prefixed with one of these labels:

| Label | Meaning | Equivalent to |
|-------|---------|---------------|
| `[PASTE INTO CLAUDE]` | Prompt to paste into a Claude.ai session | Gray + Blue in old operator guide |
| `[PASTE INTO CLAUDE CODE]` | Prompt to paste into Claude Code in the terminal | Blue in old operator guide |
| `[GIT COMMAND]` | Git command to run in the terminal | Green in old operator guide |
| `[CHECKPOINT]` | Stop and verify before proceeding | Orange in old operator guide |
| `[DECISION POINT]` | Binary choice with explicit instructions for each path | New — no equivalent |

### Document Structure

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
[2–3 sentences explaining why doc changes are needed before the build.
Example: "Before building the outbound sync pipeline, we need to update
data-model.md with the new sync_metadata JSONB shape and add three new
terms to the glossary. This ensures Claude Code builds against accurate specs."]

### 0.1 — Create the docs branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b docs/<description>
```

### 0.2 — Run the Architect Agent

Open Claude Code in the monorepo. Paste:

[PASTE INTO CLAUDE CODE]
```
<full Architect Agent prompt with specific file paths,
specific changes to make, and specific consistency checks to run>
```

### 0.3 — Review and merge

[CHECKPOINT]
```
Review the diff:
  git diff main...docs/<description>
Look for:
- MANIFEST.md line counts updated for changed docs
- No undefined glossary terms in changed sections
- Dependency graph still holds
- ADR written if a design decision was made
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: <description> [Phase X prep]"
git push origin docs/<description>
```

Open a PR titled "[Step 0] Phase X — Doc Prep: <description>".
Review the diff. Merge to main. Delete the branch.

[DECISION POINT]
```
If no doc changes were needed:
  → Skip directly to Step 1. No branch, no PR.

If doc changes are merged:
  → Proceed to Step 1.
```

---

## STEP 1 — PLAYBOOK GENERATION

[This step's instructions live in the strategy doc and Playbook_Prompts.md.
The roadmap just provides a brief reminder.]

### What This Step Does
"You already have the playbook for this sub-phase — it was produced
before this roadmap. If you're reading this roadmap, Step 1 is complete."

---

## STEP 2 — PROMPTING ROADMAP GENERATION

[Same as Step 1 — this step produced the document you're reading.]

"You're reading the output of Step 2. Proceed to Step 3."

---

## STEP 3 — BUILD EXECUTION (Builder Agent)

### Setup

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b build/<sub-phase>
```

Open Claude Code. Load skills:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work
in this session:
- docs/skills/backend/SKILL.md
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

### PROMPT 1: [Plain-English Name]

**What This Builds:**
[2–3 sentence explanation a non-coder can understand]

**What You'll See When It's Done:**
[Observable outcome — files created, tests passing, UI visible]

**How Long This Typically Takes:** [estimate]

[PASTE INTO CLAUDE CODE]
```
<the full prompt text from the playbook, formatted for pasting>
```

[CHECKPOINT]
```
Look for:
- [specific observable outcomes]
- All tests passing
- No TypeScript or ESLint errors
```

[GIT COMMAND]
```
git add <specific paths>
git commit -m "feat(scope): description [Phase X, Prompt 1]"
```

### PROMPT 2: [Plain-English Name]
...

### INTEGRATION CHECKPOINT 1 (after Prompts 1–N)

[PASTE INTO CLAUDE CODE]
```
Run the full verification suite:
1. pnpm turbo typecheck
2. pnpm turbo lint
3. pnpm turbo test
4. pnpm turbo test -- --coverage
5. [migration check if applicable]
```

[CHECKPOINT]
```
All commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): integration checkpoint 1 [Phase X, CP-1]"
git push origin build/<sub-phase>
```

Review the branch on GitHub before proceeding.

### ... [remaining prompts and checkpoints] ...

### FINAL — Open Pull Request

[GIT COMMAND]
```
git push origin build/<sub-phase>
```

Open a PR titled "[Step 3] Phase X — <Name>".
Description: list all prompts completed and their deliverables.
Review the diff.

[DECISION POINT]
```
If the PR looks good:
  → Merge to main (squash merge). Delete the branch. Proceed to Step 4.

If something looks wrong:
  → Do NOT merge. Paste this into Claude Code:
    "Review the diff for build/<sub-phase>. The following looks wrong: <describe>.
     Fix it and commit."
  → Re-push. Re-review. Then merge.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does
"An independent Claude session reviews the build output against the
playbook's acceptance criteria. It catches anything that was missed."

### 4.1 — Generate the build diff

[GIT COMMAND]
```
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-X-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open a NEW Claude.ai session. Upload:
- The playbook for this sub-phase
- /tmp/phase-X-diff.txt (the build diff)
- CLAUDE.md
- GLOSSARY.md

Paste:

[PASTE INTO CLAUDE]
```
You are the Reviewer Agent for EveryStack Phase [X].

Your mandate: evaluate the build diff against the playbook's acceptance
criteria. Produce a structured pass/fail verdict.

Rules:
- Check every acceptance criterion in every prompt
- Name specific files when reporting failures
- Provide actionable fix instructions for every failure
- Never suggest code changes — only report what's wrong
- Check naming against GLOSSARY.md
- Check conventions against CLAUDE.md

Output format:
  ## Verdict: PASS or FAIL

  ### Prompt 1: [name]
  - [x] Criterion 1 — met
  - [ ] Criterion 2 — NOT MET: [specific finding + fix instruction]
  ...

  ### Overall
  [Summary of findings. If FAIL: prioritized list of fixes needed.]
```

[DECISION POINT]
```
If PASS:
  → Proceed to Step 5.

If FAIL:
  → Open Claude Code in the monorepo.
  → For each failure, paste this:

  [PASTE INTO CLAUDE CODE]
  "The Reviewer Agent found these issues in the Phase [X] build:
   1. [failure description + fix instruction from verdict]
   2. [next failure]
   Fix all of them. Run the full test suite after each fix."

  → After fixes, commit and push:
    git add -A
    git commit -m "fix: address review findings [Phase X]"
    git push origin main

  → Re-run Step 4 from the beginning.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

### What This Step Does
"The build may have changed line counts in reference docs, introduced
new domain terms, or made cross-references stale. This step brings
docs back into alignment."

### 5.1 — Create the fix branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b fix/post-<sub-phase>-docs-sync
```

### 5.2 — Run the Docs Agent

Open Claude Code in the monorepo. Paste:

[PASTE INTO CLAUDE CODE]
```
You are the Docs Agent for EveryStack, running after Phase [X] build.

Your mandate: bring documentation back into alignment with the codebase.

Tasks:
1. Run: wc -l docs/**/*.md
   Compare against MANIFEST.md line counts. Update any that changed.
2. Review GLOSSARY.md. Check if any new domain terms were introduced
   during the build (search the git diff for new type names, table names,
   or concept names). Add definitions for any missing terms.
3. Check cross-references in docs that reference files changed during
   the build. Fix any stale section references or line ranges.
4. Update section indexes in any doc whose line counts changed significantly.

Files changed during this build:
<paste output of: git diff --name-only main~1..main>

Forbidden:
- Do NOT modify any application code
- Do NOT modify any file outside docs/
- Only fix docs — do not add features or refactor
```

### 5.3 — Review and merge

[CHECKPOINT]
```
Review the diff:
  git diff main...fix/post-<sub-phase>-docs-sync
Look for:
- MANIFEST.md line counts match actual file sizes
- No stale cross-references remain
- No new terms missing from GLOSSARY.md
- Section indexes updated where needed
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: post-Phase-X docs sync (MANIFEST, GLOSSARY, cross-refs)"
git push origin fix/post-<sub-phase>-docs-sync
```

Open a PR titled "[Step 5] Phase X — Post-Build Docs Sync".
Review. Merge to main. Delete the branch.

### 5.4 — Tag if milestone

[DECISION POINT]
```
If this sub-phase completes a major phase or milestone:
  → Tag the release:
    git tag -a v0.X.0-semantic-label -m "Phase X complete"
    git push origin v0.X.0-semantic-label

If not a milestone:
  → Skip tagging. Proceed to the next sub-phase's Step 0.
```

---

## NEXT SUB-PHASE

Phase [X] is complete. The next sub-phase is [Y].
Return to Step 0 for Phase [Y] using that sub-phase's Prompting Roadmap.
```

### Plain-English Explanations

Before every `[PASTE INTO CLAUDE CODE]` block in Step 3 (build execution), include:

1. **What This Builds** — One paragraph, no jargon. Example: "This prompt creates the database tables where all your records will be stored. Think of it like setting up the filing cabinets — the actual files (records) will be added later, but the structure needs to exist first."

2. **What You'll See When It's Done** — Observable outcomes. Example: "Claude Code will create two new files in the database schema folder. It will run tests and you should see all green checkmarks. If any test fails, Claude Code will attempt to fix it automatically."

3. **How Long This Typically Takes** — A rough estimate so Steven knows whether to wait or check back. "This prompt usually completes in 2–5 minutes."

### What the Prompting Roadmap is NOT

- It is NOT the playbook (the playbook is the technical document with schema snapshots and line-range references — Claude Code uses the playbook content, but the roadmap wraps it for human consumption across all lifecycle steps)
- It is NOT a tutorial or learning resource
- It is NOT optional — every playbook must have a companion Prompting Roadmap
- It does NOT contain technical details beyond what Steven needs to operate each step

### Prompting Roadmap Quality Standard

The test for a good Prompting Roadmap: Steven should be able to execute the entire sub-phase lifecycle — from doc prep through post-build docs sync — by reading only the roadmap, from top to bottom, doing exactly what each step says. He should never need to open the playbook directly, read a reference doc, or make a judgment call about what to do next. Every decision has been made for him in advance. Every word he needs to type or paste is in a labeled block he can copy. Every decision point has binary instructions with explicit next steps for each path.

### Generating the Prompting Roadmap — Separate Session

The Prompting Roadmap should be generated in its own dedicated session, NOT in the same session as the playbook. Playbook generation is context-intensive (reading reference docs, reasoning about architecture, crafting prompts). The Prompting Roadmap is formatting-intensive (producing a polished markdown runbook with clear labels, decision points, agent prompts, and plain-English explanations across all six lifecycle steps). Combining both in one session means neither gets full attention.

**Prompting Roadmap session inputs (only two):**
1. **This strategy doc** — specifically the "Prompting Roadmap Specification" section, which defines the label system, document structure, explanation requirements, and quality standard.
2. **The completed playbook for that sub-phase** — contains every prompt, git instruction, acceptance criterion, and dependency that the roadmap needs to wrap.

**The Prompting Roadmap session does NOT need:**
- The tarball or any reference docs (all architectural decisions are already resolved in the playbook)
- The Phase Division Map (subdivision decisions are already reflected in the playbook)
- The glossary, CLAUDE.md, or MANIFEST.md (technical context is not needed — the roadmap is translating, not deciding)

This separation means the full context budget goes toward formatting quality — producing clear labels, thoughtful plain-English explanations, accurate time estimates, well-structured decision points, and a document that a non-technical founder can follow without hesitation across all six lifecycle steps.

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

Before delivering a playbook and its Prompting Roadmap, verify all sections. Before merging each step's branch, verify the relevant section.

### Playbook Quality
- [ ] Phase preamble includes all 5 sections (built, delivers, excludes, patterns, mandatory context)
- [ ] Every prompt has: Depends on, Load context (with line ranges), Target files, Schema snapshot (or N/A), Task, Acceptance criteria, Do NOT build, Git instruction
- [ ] No prompt's Load context exceeds ~800 lines of reference doc content
- [ ] Integration checkpoints exist after every 3–5 prompts
- [ ] Dependency graph is a DAG (no circular dependencies)
- [ ] Migration requirements are noted on every schema-touching prompt
- [ ] All naming matches `GLOSSARY.md` exactly — no "Interface" for Table View, no "Builder" for Manager, etc.
- [ ] MVP scope matches `GLOSSARY.md` "MVP Includes" / "MVP Explicitly Excludes"
- [ ] File paths use the monorepo structure from `CLAUDE.md`
- [ ] Test file naming follows `CLAUDE.md` conventions
- [ ] Existing prompt roadmaps in reference docs have been consulted and adapted (not blindly copied)
- [ ] Post-MVP features are listed in "Do NOT Build" sections, not accidentally included in tasks

### Subdivision Quality
- [ ] No sub-phase produces more than ~15 prompts (if it does, split further)
- [ ] Every prompt's deliverable can be stated in one sentence without "and"
- [ ] Every prompt could be completed by Claude Code in a single focused session
- [ ] You (the AI generating this) thought carefully about every prompt — no filler, no lazy "set up the rest" prompts

### Doc Prep Quality (Step 0)
- [ ] MANIFEST.md updated with any new docs, changed line counts, or status changes
- [ ] No undefined terms used in changed doc sections (all terms exist in GLOSSARY.md)
- [ ] Dependency graph still holds after any scope changes
- [ ] ADR written if a design decision was made (using the ADR template)
- [ ] Consistency check passes: glossary terms match usage, no stale cross-references
- [ ] docs/ branch merged to main before build branch is created

### Git Workflow
- [ ] Step 0 uses `docs/<description>` branch (merged before build starts)
- [ ] Step 3 first prompt includes `build/<sub-phase>` branch creation from updated `main`
- [ ] Every prompt includes a Git field with a conventional commit message
- [ ] Every Integration Checkpoint includes push instruction
- [ ] Final checkpoint includes PR instruction
- [ ] Step 5 uses `fix/post-<sub-phase>-docs-sync` branch
- [ ] Branch naming follows CONTRIBUTING.md conventions (lowercase, hyphens, under ~50 chars)

### Prompting Roadmap Quality
- [ ] Covers all six lifecycle steps with paste-ready content
- [ ] Every `[PASTE INTO CLAUDE CODE]` block has a plain-English explanation (What This Builds, What You'll See, How Long)
- [ ] All blocks use correct labels: `[PASTE INTO CLAUDE]`, `[PASTE INTO CLAUDE CODE]`, `[GIT COMMAND]`, `[CHECKPOINT]`, `[DECISION POINT]`
- [ ] Every `[DECISION POINT]` has binary instructions with explicit next steps for each path
- [ ] Architect Agent prompt (Step 0) includes specific file paths and specific changes to make
- [ ] Reviewer Agent prompt (Step 4) references playbook acceptance criteria explicitly
- [ ] Docs Agent prompt (Step 5) includes the list of files changed during the build
- [ ] The roadmap is executable top-to-bottom with zero technical judgment calls
- [ ] A non-coder could follow it without opening any reference doc or the playbook directly

### Review Quality (Step 4)
- [ ] Verdict references specific acceptance criteria from the playbook (not vague "looks good")
- [ ] Every failure names the specific file(s) where the issue exists
- [ ] Every failure provides actionable fix instructions (not just "this is wrong")
- [ ] Naming compliance checked against GLOSSARY.md
- [ ] Convention compliance checked against CLAUDE.md
- [ ] PASS/FAIL verdict is binary — no "partial pass" or "pass with caveats"

### Docs Sync Quality (Step 5)
- [ ] MANIFEST.md line counts match actual file sizes (verified with `wc -l`)
- [ ] No stale cross-references remain in docs that reference changed files
- [ ] No new domain terms missing from GLOSSARY.md
- [ ] Section indexes updated in any doc whose line counts changed significantly
- [ ] fix/ branch merged to main after review

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
