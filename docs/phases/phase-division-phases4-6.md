# Phases 4, 5, 6 — Sub-Phase Division

## Section Index

| Section | Lines | Summary |
|---------|-------|---------|
| Summary | 15–45 | Sub-phase counts and prompt totals for Automations (2/22), AI (3/31), API (2/15) |
| Key Scope Decisions | 22–45 | Approval modes 1+2 bundled, Automation Building AI deferred, AI feature exclusions, API phase implementation rules |
| Phase 4: MVP -- Automations (4A--4B) | 47–113 | Trigger system + execution engine (4A), action implementations + webhooks + status governance (4B) |
| Phase 5: MVP -- AI (5A--5C) | 47–113 | AI data contract + context builder (5A), user-facing features + metering (5B), runtime skills architecture (5C) |
| Phase 6: MVP -- API (6A--6B) | 47–113 | Data API record CRUD (6A), schema API + file upload + SDS endpoint (6B) |
| Dependency Graph | 284–339 | ASCII DAG of Phases 4--6 with parallel execution potential and critical path |
| Validation Checklist | 341–358 | 12-item verification of scope, exclusions, and reference doc section splits |

## Summary
- Phase 4 sub-phases: 2 (estimated 22 prompts)
- Phase 5 sub-phases: 3 (estimated 31 prompts)
- Phase 6 sub-phases: 2 (estimated 15 prompts)
- Total sub-phases (Phases 4–6): 7
- Total estimated prompts (Phases 4–6): 68

### Key Scope Decisions

**Approval Workflows Modes 1+2 bundled with Phase 4:** Despite the "⚠️ POST-MVP" banner on `approval-workflows.md`, the Phase Implementation section (line 685) explicitly states: "Mode 1+2 MVP — Core UX: Status field `transitions` config enhancement." Modes 1+2 (status transition governance with preconditions and auto-advance, no approval chains) are MVP scope. They were not allocated to any Phase 3 sub-phase. They belong in Phase 4 because status transition enforcement is workflow logic closely related to automations — transitions fire on the same event bus and share the same precondition evaluation patterns.

**Automation Building AI deferred to Phase 5:** The "Describe what you want" NL-to-automation-config feature is listed in `ai-architecture.md` as MVP AI capability `generate_automation`. While it enhances the automation builder, it depends on the full AI data contract (5A) and Context Builder. Phase 4 builds the manual automation builder; Phase 5 adds the AI enhancement on top. This mirrors the AI independence guarantee — automations work fully without AI.

**AI features scope-checked against GLOSSARY and docs:**
- AI Agents: **excluded** (post-MVP per glossary; see `agent-architecture.md` — 650 lines, depends on agent runtime)
- Self-hosted AI: **excluded** (post-MVP per glossary)
- Vector embeddings / semantic search: **excluded** (post-MVP per glossary)
- DuckDB Context Layer: **excluded** (post-MVP per glossary)
- AI Field Agents: **excluded** (post-MVP per glossary; see `ai-field-agents-ref.md` — 1,618 lines, depends on DuckDB + agent runtime)
- Platform Maintenance Agents: **excluded** (post-MVP; see `platform-maintenance-agents.md` — 1,106 lines, depends on `agent-architecture.md` runtime)
- Skill Maintenance Agent: **excluded** (post-MVP per `ai-skills-architecture.md` — depends on agent runtime)
- Workspace Usage Descriptor: **deferred** (late Phase 5 or early post-MVP per `ai-skills-architecture.md` — depends on automations, portals, integrations being built first)
- MCP Server/Client: **excluded** (post-MVP per glossary)
- Provider Evaluation Framework: **excluded** (post-MVP — shadow mode, regression detection)
- Booking automation triggers: **excluded** (booking-scheduling.md ships "Post-MVP — Portals & Apps (Fast-Follow)")

**Visual automation canvas: excluded** from Phase 4. Per `automations.md` line 44: "Visual flow canvas with branching/conditions" is post-MVP. MVP uses a step-by-step list builder. Confirmed by GLOSSARY.md and `dependency-map.md` line 757.

**Platform API Phase Implementation followed strictly:** Per `platform-api.md` §Phase Implementation (lines 1134–1148), MVP — Core UX includes only: Data API, Schema API, File Upload API, API request logging. All other API groups (Provisioning, Automation, AI, Webhook Management, Tenant Management) are post-MVP.

---

## Phase 4: MVP — Automations

Covers 4A — Trigger System, Execution Engine & Builder UI, 4B — Action Implementations, Webhooks, Testing & Status Field Governance.
Touches `automation_runs`, `step_log`, `jsonb_set`, `webhook_endpoints` tables.

### 4A — Trigger System, Execution Engine & Builder UI

**One-sentence scope:** Builds the automation infrastructure with the in-memory trigger registry, 6 trigger types with event detection, the BullMQ execution pipeline with checkpointing and error handling, template resolution engine, data model, and the step-by-step list builder UI.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| automations.md | MVP Scope, Builder Interface, Triggers (6 MVP Types), Execution Model, Template Resolution Engine, Data Model | 29–318, 448–511 | ~342 |

**Total reference lines:** ~342

**Scope Boundaries:**
- **Includes:** Automation CRUD Server Actions (create, update, duplicate, delete, activate/deactivate/pause), `automations` table population with `trigger` JSONB and `steps` JSONB[] columns, `automation_runs` table writes (per-run execution log with `step_log` JSONB), in-memory `TriggerRegistry` with `getMatchingAutomations()` O(1) lookup (eventType → tableId → automationTrigger[]), registry refresh on `automation.changed` pub/sub + 5-minute safety net, 6 trigger types (Record Created, Record Updated, Field Value Changed, Form Submitted, Button Clicked, Scheduled) with config schemas and detection mechanisms, trigger detection at application layer (Server Actions publish domain events to Redis pub/sub `events:{tenantId}`), event flow (domain event → Redis → worker → TriggerRegistry → evaluate conditions → enqueue `automation.execute` BullMQ job), deduplication (5-second debounce window, batch mode for bulk imports, rate cap 100/automation/minute), `AutomationExecutionContext` interface (tenantId, executionId, traceId, triggeringUserId, stepOutputs Map), linear sequential pipeline (step 1 → step 2 → ... → complete → write run log), error handling (3 strategies per step: Stop/Skip & Continue/Retry with max 3 + exponential backoff), timeout policy (30s per step, 5 minutes per run), checkpointing after each step (BullMQ retry resumes from last checkpoint), idempotency keys `{executionId}:{stepIndex}` for external side effects, execution concurrency (1 per automation via BullMQ job group, exception: 4 for manual multi-record mode), re-entrant trigger protection via execution ancestry tracking (`parentExecutionId`, `MAX_CHAIN_DEPTH: 5`), template resolution engine (`{{trigger.record.fields.{fieldId}}}`, `{{step_{id}.output}}`, `{{env.now}}` syntax), type preservation (single reference → raw value, mixed text → string coercion), `AutomationStep` interface (id, type, position, name, actionType, config, errorStrategy, maxRetries), plan limits (automations/month counter via Redis `auto:exec:{tenantId}:{YYYY-MM}`), builder UI full-screen layout (280px left sidebar with Automations list + History tabs, main panel with trigger config + ordered action list), toolbar (back arrow, editable name, status badge, Test Run button, Settings gear, Activate/Deactivate toggle), left sidebar Automations tab (all workspace automations, status dots, Sections for organization), left sidebar History tab (run log scoped to selected automation, click to highlight execution path with per-step status/timing), creation flow (progressive disclosure: name → pick trigger → configure → add steps → configure each → test → activate), step list UX (drag-reorderable, click to expand inline config, one-line summary when collapsed, delete on hover, max 20 steps)
- **Excludes:** 7 action type implementations (4B), webhook architecture (4B), testing/debugging dry run (4B), visual canvas with branching/conditions (post-MVP), condition nodes (post-MVP), lifecycle workflows (post-MVP), Loop action (post-MVP), AI actions (post-MVP — Phase 5), Run Script (post-MVP), Chain automations (post-MVP), recipe library (post-MVP), approval-workflows (4B)
- **Creates schema for:** None (automations, automation_runs defined in 1B)

**Dependencies:**
- **Depends on:** 1A (monorepo), 1B (automations, automation_runs tables), 1C (Clerk auth for workspace-scoped automation ownership), 1D (Pino logging + traceId for execution traces), 1G (BullMQ worker for automation job processing, real-time service for domain event publishing via Redis pub/sub), 1I (writeAuditLog for automation CRUD and execution events), 2A (FieldTypeRegistry — trigger field matching and template value resolution use field type metadata)
- **Unlocks:** 4B (action implementations + webhooks build on top of execution engine), Phase 5 (Automation Building AI enhances the builder UI)
- **Cross-phase deps:** 1A, 1B, 1C, 1D, 1G, 1I, 2A

**Sizing:**
- **Estimated prompts:** 12
- **Complexity:** High
- **Key risk:** Trigger registry memory management — the in-memory registry must reload correctly on worker restart and refresh atomically on CRUD events; stale registries cause missed triggers, while registry refresh storms during bulk automation imports could cause worker instability

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 4B — Action Implementations, Webhooks, Testing & Status Field Governance

**One-sentence scope:** Implements the 7 MVP action types (integrating with email, document, notification, and record subsystems), the full webhook architecture (workspace-level event webhooks, inbound webhook triggers, delivery pipeline with retry and SSRF protection), the dry run testing system, and Status field transition governance (modes 1+2 with preconditions and auto-advance).

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| automations.md | Actions (7 MVP Types), Webhook Architecture, Testing & Debugging | 179–447 | ~269 |
| approval-workflows.md | Status Field Operating Modes, Status Field Config Enhancement (modes 1+2 only) | 38–144 | ~107 |

**Total reference lines:** ~376

**Scope Boundaries:**
- **Includes:** Portal write-backs fire `record.updated` — no separate trigger required for portal-originated edits (CP-001-C confirmatory note). 7 action type implementations: (1) **Send Email** — Resend integration, rich text body with merge tags, attachments from file fields or step output (consumes 3C email infrastructure), (2) **Create Record** — any table in workspace, field values via template syntax, output `recordId` available to subsequent steps, (3) **Update Record** — trigger record or lookup by field value, partial field updates, (4) **Generate Document** — merge record into document template → Gotenberg → PDF → R2 storage, output `fileUrl` (consumes 3D pipeline), (5) **Send Notification** — in-app notification with urgency levels (info/action/critical), recipient selection (record owner, specific users, people field) (consumes 3C notification pipeline), (6) **Adjust Field** — atomic `jsonb_set` arithmetic on number fields via `adjustFieldValue()`, no read-then-write, (7) **Send Webhook** — HTTP POST/PUT/PATCH to external URL with template body, SSRF protection, response capture; workspace-level event webhooks (`webhook_endpoints` table CRUD, 13 subscribable events, payload envelope with HMAC-SHA256 signature, signing secret management), inbound webhook receiving (`POST /api/webhooks/automation/{automationId}/{webhookToken}`, 32-char token auth, HMAC signature verification, 60/min rate limit, 256KB max body, `202 Accepted` response), delivery pipeline (BullMQ `webhook.deliver` job: SSRF check → build payload → HMAC sign → POST → evaluate response → retry on 429/5xx), retry strategy (5 retries: 30s → 2min → 10min → 1hr → 4hr, auto-disable endpoint at 10 consecutive failures), rate limiting (1,000/min per tenant, 100/min per endpoint, bulk condensation for >50 same-type events in 5s), webhook management UI (Settings → Integrations → Webhooks: create endpoint, signing secret, test delivery, delivery log, manual re-send, disable/enable), testing & debugging (dry run: pick record → simulate trigger → animate step results green/red → preview outputs without side effects → "Would execute"/"Would skip" annotations → execution trace with timing), run history (sidebar tab: click run → highlight execution path with per-step status/timing, "Retry from here" on failures), error handling UX (failed automation → pause + push notification + red sidebar badge → fix/retry/skip/disable), automation settings panel (name/description, status, error handling strategy, execution limits, error notification recipients); **Status field transition governance (modes 1+2):** `StatusFieldConfig.transitions` JSONB extension (enabled, mode: open/defined_only, rules[]), `StatusTransitionRule` interface (from_status_id, to_status_id, allowed_roles, allowed_user_field_id, preconditions[]), 5 precondition types (required_fields, checklist_complete, linked_record_status, numeric_threshold, formula — formula is post-MVP but schema slot reserved), Mode 1 (Simple Select: no enforcement), Mode 2 (Gated Transitions: preconditions + auto-advance without human approver, `actor_type: 'system'` audit, record thread system message), precondition panel in Status field dropdown (shows checklist of requirements, auto-verified items pre-checked, unfulfilled items with explanation), transition enforcement at application layer (Server Action validates preconditions before status write)
- **Excludes:** Trigger system and execution engine (4A — already built), builder UI layout (4A — already built), AI actions (post-MVP), visual canvas (post-MVP), Mode 3 approval chains (post-MVP — requires approval_rules, approval_requests, approval_step_instances tables), approval UI surfaces beyond precondition panel (post-MVP), SLA monitoring (post-MVP), escalation (post-MVP), formula precondition evaluation (post-MVP — requires formula engine)
- **Creates schema for:** None (webhook_endpoints, webhook_delivery_log, automations, automation_runs defined in 1B; StatusFieldConfig.transitions is a JSONB extension on existing fields.config)

**Dependencies:**
- **Depends on:** 4A (trigger system + execution engine + builder UI — actions plug into the execution pipeline, webhooks add trigger types and action types), 3C (Send Email action uses Resend email infrastructure, Send Notification action uses notification pipeline), 3D (Generate Document action consumes document template + Gotenberg pipeline), 3E-ii (Form Submitted trigger requires forms to exist), 3A-i (Status field cell renderer — precondition panel attaches to Status field dropdown; FieldTypeRegistry — Adjust Field uses field type metadata), 3A-ii (Record View — automation settings accessible from record context), 1G (BullMQ for webhook delivery jobs, real-time for domain events that trigger webhooks), 1I (writeAuditLog for webhook deliveries and status transitions with `actor_type: 'system'`), 1F (shadcn/ui primitives for webhook management UI, precondition panel, automation settings)
- **Unlocks:** Phase 5 (AI features including Automation Building AI can target the complete automation system), Phase 6 (API mutations trigger automation events via 4A's trigger registry)
- **Cross-phase deps:** 1F, 1G, 1I, 3A-i, 3A-ii, 3C, 3D, 3E-ii

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium-High
- **Key risk:** Action integration breadth — each of the 7 action types integrates with a different subsystem (email, records, documents, notifications, webhooks); missing or incorrect integration for any one action delays the entire sub-phase, and the webhook delivery pipeline requires careful SSRF protection to avoid security vulnerabilities

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

## Phase 5: MVP — AI

Covers 5A — AI Data Contract Implementations & Context Builder, 5B — User-Facing AI Features & Metering Dashboards, 5C — Runtime Skills Architecture.
Touches `cell_renderer`, `schema_version_hash`, `search_records`, `query_tables`, `resolve_cross_links` tables. See `ai-skills-architecture.md`, `agent-architecture.md`.

### 5A — AI Data Contract Implementations & Context Builder

**One-sentence scope:** Implements `canonicalToAIContext()` and `aiToCanonical()` for all MVP field types (~25 types across 8 categories), builds the Context Builder with SDS-backed heuristic schema retrieval, registers the full AI tool suite, and wires the prompt template infrastructure for all MVP AI features.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| ai-data-contract.md | Per-Field-Type Mapping (Categories 1–8 MVP only), Where Each AI Feature Hits This Contract, Integration with Existing Validation, Implementation Notes, Phase Implementation (Core UX row) | 60–221 | ~162 |
| ai-architecture.md | Technical Architecture (Context Builder), Tool Definition Abstraction, Streaming Support, Phase Implementation (Core UX row) | 182–250, 366–376 | ~80 |

**Total reference lines:** ~242

**Scope Boundaries:**
- **Includes:** `canonicalToAIContext()` implementations for all MVP field types — Category 1: text, text_area; Category 2: number, currency, percent, rating, duration, progress, auto_number; Category 3: single_select, multiple_select, status, tag; Category 4: date, date_range, due_date, time, created_at, updated_at; Category 5: people, created_by, updated_by, email, phone, url, address, full_name, social; Category 6: checkbox, button, checklist, signature; Category 7: linked_record, count (lookup/rollup/formula/dependency/sub_items are post-MVP); Category 8: files; `aiToCanonical()` implementations for all writable MVP field types (same categories, excluding read-only: auto_number, button, signature, created_at, updated_at, created_by, updated_by, count, files); round-trip unit tests per field type (`canonical → canonicalToAIContext() → LLM simulation → aiToCanonical() → validate()`); single_select option ID ↔ label resolution (most common AI bug source — dedicated test coverage); `aiToCanonical()` tolerance rules (strip currency symbols, parse natural language dates, fuzzy-match select labels, clamp values to ranges); FieldTypeRegistry registration of both functions alongside existing `validate`, `cell_renderer`, `toTemplateValue`, `toExportValue`; Context Builder implementation (packages schema via SDS `describe_workspace()` + record data via `canonicalToAIContext()` + user intent + conversation history into prompts), heuristic schema retrieval (when workspace exceeds token budget, select tables/fields based on recency, cross-link proximity, and keyword relevance — no vector embeddings in MVP), token budget estimator integration (SDS's `schema_version_hash` + estimated token count to manage context window), full AI tool suite registration (`search_records`, `query_tables`, `resolve_cross_links`, `trigger_commands`, `create_record`, `generate_document`, `get_field_definitions`, `list_tables`), tool handlers consuming `aiToCanonical()` for write operations (`create_record`, `update_record` tool handlers validate AI output through `aiToCanonical() → validate()` pipeline), prompt template files for all MVP AI features (prompt IDs: `command_bar_conversation`, `smart_fill`, `record_summary`, `doc_draft`, `field_suggestion`, `link_suggestion`, `automation_build`), Vercel AI SDK streaming integration for interactive features (Command Bar, doc drafting), BullMQ routing for heavy AI tasks
- **Excludes:** smart_doc field type translation (post-MVP — wiki/knowledge base), formula/lookup/rollup/dependency/sub_items field types (post-MVP), barcode field type (post-MVP — Category 9), DuckDB Context Layer exemption (post-MVP), vector embeddings for semantic schema retrieval (post-MVP), AI Field Agents pipeline (post-MVP), agent context (post-MVP), Provider Evaluation Framework (post-MVP), MCP server/client (post-MVP), self-hosted prompt compiler (post-MVP)
- **Creates schema for:** None (ai_usage_log, ai_credit_ledger defined in 1B; FieldTypeRegistry already exists from 2A)

**Dependencies:**
- **Depends on:** 1H (AIService skeleton, Anthropic adapter, prompt registry structure, capability routing, metering flow — 5A builds on this foundation), 2A (FieldTypeRegistry — `canonicalToAIContext`/`aiToCanonical` registered alongside existing per-field-type entries), 3B-ii (SDS — Context Builder uses `describe_workspace()`, `describe_table()`, `describe_links()` for schema retrieval), 3B-i (cross-linking — Context Builder needs cross-link graph for heuristic selection, `linked_record` field type translation), 1E (test factories for round-trip field type tests)
- **Unlocks:** 5B (all user-facing AI features consume the AI data contract + Context Builder + tool suite)
- **Cross-phase deps:** 1E, 1H, 2A, 3B-i, 3B-ii

**Sizing:**
- **Estimated prompts:** 9
- **Complexity:** Medium-High
- **Key risk:** Field type round-trip fidelity — `aiToCanonical()` must handle messy LLM output for ~25 field types (natural language dates, currency symbols, fuzzy option labels, formatted phone numbers); bugs in any one translation function corrupt data when AI features write to records

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 5B — User-Facing AI Features & Metering Dashboards

**One-sentence scope:** Builds the 5 MVP user-facing AI features (Smart Fill, Record Summarization, Document AI Draft, Field & Link Suggestions, Automation Building AI) with their UI surfaces, prompt templates, and credit costs, plus the Admin AI Dashboard and User AI Usage View.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| ai-metering.md | Workspace Admin AI Dashboard, User-Facing AI Usage View, Admin Controls, Pre-Launch Usage Testing Framework | 214–281 | ~68 |
| ai-architecture.md | AI Capabilities (MVP features list), Streaming Support | 48–60, 234–241 | ~20 |
| ai-data-contract.md | Where Each AI Feature Hits This Contract (MVP rows) | 152–167 | ~16 |

**Total reference lines:** ~104 (plus significant new feature implementation not fully specified in reference docs — AI features defined by capability descriptions in GLOSSARY/ai-architecture.md rather than dedicated feature specs)

**Scope Boundaries:**
- **Includes:** **Smart Fill** — AI generates suggested values for empty fields on a record; UI: "Smart Fill" button in Record View toolbar, fills all empty fields or selected field; uses `canonicalToAIContext()` for record context, `aiToCanonical()` for generated values; user reviews diff preview before accepting; per-field accept/reject; credit cost shown before execution; `standard` capability tier; prompt template `smart_fill`; **Record Summarization** — AI generates a natural language summary of a record; UI: "Summarize" command in Command Bar + Record View header action; streaming text output; uses `canonicalToAIContext()` for all record fields including cross-linked record display values; `fast` capability tier; prompt template `record_summary`; **Document AI Draft** — AI drafts prose content for document template sections; UI: `/draft` slash command in TipTap environment 2 editor; streaming text inserted at cursor; uses `canonicalToAIContext()` for record context; `standard` capability tier; prompt template `doc_draft`; **Field & Link Suggestions** — AI suggests field types when creating new fields and suggests cross-link targets between tables; UI: "AI Suggest" button in Create Field dialog + Create Cross-Link dialog; uses SDS `describe_workspace()` for schema context; output is schema metadata (field type + config suggestions, link target table + relationship type), not canonical field values; `fast` capability tier; prompt templates `field_suggestion`, `link_suggestion`; **Automation Building AI** — natural language to automation config; UI: "Describe what you want" text input at top of automation builder, AI generates trigger + steps config, user reviews and edits before activating; uses SDS for table/field context; `standard` capability tier (upgrades to `advanced` for complex automations); prompt template `automation_build`; AI independence guarantee for all features (core workflows function without AI — Smart Fill disabled when credits exhausted, automation builder reverts to manual-only, Command Bar falls back to fuzzy text, doc editor disables AI slash commands); credit cost preview before execution for all features; **Admin AI Dashboard** — Settings → AI Usage (Owner/Admin only): workspace budget card (progress bar, color-coded, estimated days remaining, month-over-month comparison), per-user breakdown table (credits used, % of total, calls, avg credits/call, top feature), per-feature breakdown table (credits used, % budget, total calls, avg cost/call, avg tokens/call), admin controls (optional per-user daily caps, per-role caps, temporary allowance increase), usage alerts (80% → admin email, 95% → email + in-app banner, 100% → all-user notification, >30% by single user in 24h → admin alert), CSV usage export (full ai_usage_log for billing period, filterable); **User AI Usage View** — personal usage: own credits this period, workspace budget progress bar (no per-user breakdown), most-used features, daily cap remaining (if active); users never see: other users' consumption, dollar costs, model names
- **Excludes:** AI Agents (post-MVP), AI Field Agents (post-MVP), formula AI assistance (post-MVP), Communication Drafting (post-MVP — Comms & Polish), Document Review (post-MVP), cross-base analysis via DuckDB (post-MVP), guide mode (post-MVP), App Generation AI (post-MVP — App Designer is post-MVP), Smart Doc AI content blocks (post-MVP), Live Chat AI Responses (post-MVP), Document Intelligence AI operations (post-MVP), internal cost monitoring / platform admin dashboard (operational, not user-facing), reconciliation & integrity jobs (operational), agent session metering (post-MVP)
- **Creates schema for:** None (ai_usage_log, ai_credit_ledger defined in 1B; workspace settings.ai_config is a JSONB extension on existing column)

**Dependencies:**
- **Depends on:** 5A (AI data contract implementations + Context Builder + tool suite — all features consume these), 4A (Automation Building AI targets the automation builder UI built in 4A), 3D (Document AI Draft inserts into TipTap environment 2 editor built in 3D), 3B-ii (SDS + Command Bar — Field & Link Suggestions + Record Summarization surface through Command Bar; SDS provides schema for all features), 3A-ii (Record View — Smart Fill button in Record View toolbar, Record Summarization in header), 1H (AIService — all features route through AIService with capability tiers), 1F (shadcn/ui primitives for AI Dashboard charts, usage tables, budget cards)
- **Unlocks:** Phase 6 (API mutations + schema queries benefit from AI-enhanced data; AI features complete the MVP user experience)
- **Cross-phase deps:** 1F, 1H, 3A-ii, 3B-ii, 3D, 4A

**Sizing:**
- **Estimated prompts:** 10
- **Complexity:** Medium
- **Key risk:** AI feature UX consistency — 5 distinct AI features must share a consistent interaction pattern (credit cost preview → execute → streaming output → user review → accept/reject/regenerate); inconsistent patterns across features create a disjointed experience and the "Automation Building AI" is the most complex (NL → structured automation config with multiple steps)

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 5C — Runtime Skills Architecture

**One-sentence scope:** Builds the runtime AI skills system from `ai-skills-architecture.md` MVP-scoped items: Context Builder skill integration, skill-aware intent classification, Prompt Registry `requiredSkills` field, 7 internal platform skill documents, `skill_context` JSONB column on `ai_usage_log`, eval framework extension for skill-enriched prompts, and the token budget allocator.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| ai-skills-architecture.md | Tier 1 Platform Skills (7 skill definitions), Feature Skill Registry, Token Budget Allocator, Skill-Aware Intent Classification, What This Changes (Phase 5 work items), Implementation Sequence | 80–214, 250–320, 500–599, 640–653 | ~310 |
| ai-architecture.md | Context Builder, Prompt Registry | 182–250 | ~70 |

**Total reference lines:** ~380

**Scope Boundaries:**
- **Includes:** Context Builder skill integration (skill documents loaded alongside schema context based on intent classification), intent classifier enhancement (classifies user intent → selects relevant platform skills → loads skill context into prompt), Prompt Registry `requiredSkills` field (prompt templates declare which skills they need), 7 internal platform skill documents (automation-builder.md at 1,200/500/250 tokens across 3 condensation levels, portal-builder.md at 800/350/200, document-templates.md at 700/300/150, report-charts.md at 900/400/200, record-management.md at 1,000/450/200, communication.md at 600/250/120, command-bar.md at 500/200/100), `skill_context` JSONB column on `ai_usage_log` (tracks which skills were loaded per AI call for analytics), eval framework extension (test that skill-enriched prompts maintain ≥95% schema compliance), token budget allocator (manages combined schema + skill context within model token limits, 3-level condensation)
- **Excludes:** Skill Maintenance Agent (post-MVP — depends on agent runtime from `agent-architecture.md`), Workspace Usage Descriptor / Tier 2 skills (late Phase 5 or post-MVP — depends on automations, portals, integrations being fully built), MCP integration skills (post-MVP), Skill Performance dashboard (late Phase 5 or post-MVP), first integration skill (post-MVP), Behavioral skills / Tier 3 (post-MVP)
- **Creates schema for:** `skill_context` JSONB column addition to `ai_usage_log` (migration); `requiredSkills` field on prompt registry entries (code-level, no migration needed — prompt templates are code files)

**Dependencies:**
- **Depends on:** 5A (Context Builder — skills integrate into the context assembly pipeline), 5B (AI features must exist so skills can enhance them; prompt templates from 5B gain `requiredSkills` field), 1H (AIService skeleton, prompt registry infrastructure)
- **Unlocks:** Post-MVP skills evolution (Workspace Usage Descriptor, Skill Maintenance Agent, MCP integration skills)
- **Cross-phase deps:** 1H, 5A, 5B

**Sizing:**
- **Estimated prompts:** 12
- **Complexity:** Medium
- **Key risk:** Token budget management — 7 platform skills at varying sizes (500–1,200 tokens each at full level) must fit within model context alongside schema context and user data; the 3-level condensation system must degrade gracefully without losing critical operational knowledge

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

## Phase 6: MVP — API

Covers 6A — Data API: Record CRUD, Filtering & Batch Operations, 6B — Schema API, File Upload API & SDS Endpoint.
Touches `total_count`, `include_cross_links`, `template_id`, `actor_label`, `api_request_log` tables.

### 6A — Data API: Record CRUD, Filtering & Batch Operations

**One-sentence scope:** Builds the Platform API Data endpoints with Record CRUD (list, get, create, batch create, update, delete), the filter/sort query syntax, cursor-based pagination, field permission enforcement on API responses, API request logging, and integration with automation triggers and real-time events on mutations.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| platform-api.md | Data API (full section), Audit Integration | 257–459 | ~203 |

**Total reference lines:** ~203

**Scope Boundaries:**
- **Includes:** `GET /api/v1/tables/{tableId}/records` — List Records with query parameters (filter, sort, fields, page_size, cursor, include_cross_links), cursor-based pagination (no offset pagination), `total_count` approximate for >10K records via EXPLAIN estimate, field values in canonical format keyed by Field ID; filter syntax (14 operators: eq, neq, gt, gte, lt, lte, contains, not_contains, is_empty, is_not_empty, in, has_any, has_all, linked_to; comma-separated AND logic); `GET /api/v1/tables/{tableId}/records/{recordId}` — Get Record with `fields` and `include_cross_links` parameters; `POST /api/v1/tables/{tableId}/records` — Create Record (Zod validation per field type, required field enforcement, cross-link field accepts record ID array, record quota check, optional `template_id` for Record Template application); `POST /api/v1/tables/{tableId}/records/batch` — Batch Create (max 100, all-or-nothing, per-record error details on failure); `PATCH /api/v1/tables/{tableId}/records/{recordId}` — Update Record (partial update, only changed fields); `DELETE /api/v1/tables/{tableId}/records/{recordId}` — Delete Record (soft delete, 204 No Content); mutation side effects on all write endpoints (audit log with `actor_type: 'api_key'` + `actor_label` from `X-Actor-Label` header, automation triggers fire for matching automations via 4A's trigger registry, real-time event published to `table:{tableId}` room, outbound webhooks delivered to subscribed endpoints via 4B's delivery pipeline); cross-link data at Level 0 only (IDs + display field) when `include_cross_links: true`; field permission enforcement (API key scope + field-level permissions from 3A-iii filter which fields appear in responses and which fields accept writes); API request logging (`api_request_log` table: method, path, status_code, duration_ms, request_size, response_size, monthly partition, 30-day retention); response format consistent with platform-api.md error codes (VALIDATION_ERROR, INVALID_FILTER, INVALID_SORT, NOT_FOUND, RECORD_QUOTA_EXCEEDED, etc.)
- **Excludes:** Schema API endpoints (6B), File Upload API (6B), Provisioning API (post-MVP — Portals & Apps), Automation API with API key auth (post-MVP — Documents; inbound webhook trigger already in 4B), AI API (post-MVP — Automations), Webhook Management API (post-MVP — Documents), Tenant Management API (post-MVP — Automations), SDK generation (post-MVP), batch provisioning (post-MVP), OR logic in filters (future `filter_json` parameter), optimistic concurrency via `If-Match` header (documented but not required for MVP)
- **Creates schema for:** None (api_request_log defined in 1B)

**Dependencies:**
- **Depends on:** 1I (API key auth middleware, rate limiting, structured error format — all built in Phase 1), 1B (records, tables, fields, api_request_log schema), 2A (FieldTypeRegistry — canonical data formatting for API responses), 3A-iii (field-level permissions — API respects field visibility per API key scope + field permissions), 3B-i (cross-linking — `include_cross_links` parameter queries `cross_link_index`), 4A (automation trigger registry — API mutations fire triggers), 4B (outbound webhook delivery — API mutations trigger webhook events)
- **Unlocks:** 6B (Schema API + File Upload complement the Data API for a complete external API surface)
- **Cross-phase deps:** 1B, 1I, 2A, 3A-iii, 3B-i, 4A, 4B

**Sizing:**
- **Estimated prompts:** 9
- **Complexity:** Medium
- **Key risk:** Filter syntax parsing — the structured expression syntax must handle all 14 operators across all field types correctly, including edge cases (null handling, empty string vs. absent field, multi-select `has_any`/`has_all` semantics); incorrect filter behavior causes data leaks or silent data exclusion for API consumers

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

### 6B — Schema API, File Upload API & SDS Endpoint

**One-sentence scope:** Builds the read-only Schema API endpoints (List Workspaces, List Tables, Get Table Schema, List Cross-Links, SDS endpoint), the File Upload API with presigned URL flow, and completes the Platform API MVP surface.

**Reference Doc Map:**
| Doc | Sections | Line Range | Est. Lines |
|-----|----------|------------|------------|
| platform-api.md | Schema API, File Upload API | 460–603, 1050–1089 | ~184 |

**Total reference lines:** ~184

**Scope Boundaries:**
- **Includes:** `GET /api/v1/workspaces` — List Workspaces (all workspaces in tenant, with board association); `GET /api/v1/workspaces/{workspaceId}/tables` — List Tables (name, table_type, field_count, record_count); `GET /api/v1/tables/{tableId}/schema` — Get Table Schema (full field definitions with id, name, field_type, is_primary, required, config JSONB; cross-link definitions with relationship metadata); `GET /api/v1/cross-links` — List Cross-Links (tenant-scoped, optional `table_id` filter); `GET /api/v1/schema/describe` — SDS Endpoint (exposes existing SDS `describe_workspace()` / `describe_table()` output for external AI consumers, optional `workspace_id` and `table_id` query parameters); `POST /api/v1/files/upload-url` — Get Presigned Upload URL (accepts filename, content_type, size; returns presigned S3/R2 URL + file_key + expiry; caller uploads directly to storage then references file_key in Record update); file processing pipeline (virus scanning via ClamAV, image thumbnails, MIME verification) runs asynchronously after Record update; Schema API scope enforcement (`schema:read` scope required, field definitions filtered by API key's accessible fields); SDS endpoint scope (returns same permission-filtered output as internal SDS — respects API key scope for field visibility); all Schema API endpoints are read-only (no mutations, no audit log entries for reads); response shapes consistent with platform-api.md specifications
- **Excludes:** Provisioning API create endpoints (post-MVP — Portals & Apps), schema mutations via API (post-MVP — requires `schema:write` scope endpoints), Webhook Management API (post-MVP), Automation management endpoints (post-MVP), AI API (post-MVP), Tenant Management API (post-MVP), API documentation site (post-MVP), SDK generation (post-MVP)
- **Creates schema for:** None

**Dependencies:**
- **Depends on:** 1I (API key auth middleware, rate limiting — same infrastructure as 6A), 3B-ii (SDS — SDS endpoint exposes the existing Schema Descriptor Service), 3B-i (cross-linking — List Cross-Links endpoint queries `cross_links` table, Get Table Schema includes cross-link definitions), 1G (StorageClient — File Upload API uses presigned URL generation from existing R2 implementation), 1B (workspaces, tables, fields, cross_links schema), 3A-iii (field-level permissions — Schema API filters field definitions by visibility)
- **Unlocks:** External integrations (vertical frontends, third-party tools, MCP clients can discover schema and upload files — completes the MVP API surface alongside 6A's Data API)
- **Cross-phase deps:** 1B, 1G, 1I, 3A-iii, 3B-i, 3B-ii

**Sizing:**
- **Estimated prompts:** 6
- **Complexity:** Medium-Low
- **Key risk:** SDS endpoint scope leakage — the SDS output includes table/field metadata that must be filtered by the API key's scope and field permissions; incorrect filtering could expose schema information (field names, types, options) that the API consumer shouldn't see

**Existing Roadmaps:**
- No existing roadmaps for this sub-phase's docs

---

## Dependency Graph

```
Phase 1 (Foundation)
 ├── 1A, 1B, 1C, 1D, 1E, 1F, 1G, 1H, 1I
 │
Phase 2 (Sync)
 ├── 2A (FieldTypeRegistry + Airtable)
 │
Phase 3 — First Half (3A–3D)
 ├── 3A-i → 3A-ii → 3A-iii → 3B-i → 3B-ii
 ├── 3C, 3D
 │
Phase 3 — Second Half (3E–3H)
 ├── 3E-i, 3E-ii, 3F-i, 3F-ii, 3F-iii, 3G, 3H-i, 3H-ii
 │
Phase 4 — Automations
 │
 ├── 4A (Trigger System + Execution Engine + Builder UI)
 │    │    depends on: 1A, 1B, 1C, 1D, 1G, 1I, 2A
 │    │
 │    └── 4B (Actions + Webhooks + Testing + Status Transitions)
 │         depends on: 4A, 3A-i, 3A-ii, 3C, 3D, 3E-ii, 1F, 1G, 1I
 │
Phase 5 — AI
 │
 ├── 5A (AI Data Contract + Context Builder)
 │    │    depends on: 1E, 1H, 2A, 3B-i, 3B-ii
 │    │
 │    └── 5B (User-Facing AI Features + Metering Dashboards)
 │    │    depends on: 5A, 4A, 3A-ii, 3B-ii, 3D, 1F, 1H
 │    │
 │    └── 5C (Runtime Skills Architecture)
 │         depends on: 5A, 5B, 1H
 │
Phase 6 — API
 │
 ├── 6A (Data API)
 │    │    depends on: 1B, 1I, 2A, 3A-iii, 3B-i, 4A, 4B
 │    │
 │    └── 6B (Schema API + File Upload)
 │         depends on: 1B, 1G, 1I, 3A-iii, 3B-i, 3B-ii
```

**Parallel execution potential:**
- Phases 4 and 5 can proceed in parallel after Phase 3 completes: 4A and 5A have no direct dependencies on each other.
- 5B depends on both 5A and 4A (Automation Building AI needs the automation builder), so it cannot start until both complete.
- 5C depends on 5A and 5B (skills enhance existing AI features), so it runs after 5B completes.
- Phase 6 depends on Phase 4 (API mutations fire automation triggers), so 6A must wait for 4A+4B.
- 6A and 6B can proceed in parallel (6B has no dependency on 6A).
- 5C and 6A/6B can proceed in parallel (no dependencies between them).

**Critical path:** 4A → 4B → 6A (for automation trigger integration on API mutations)
**Parallel path:** 5A → 5B → 5C (can overlap with 4B, 6A, and 6B)

---

## Validation Checklist

- [x] Every sub-phase passes the one-sentence test (no "and" — verified: each describes one coherent deliverable)
- [x] No sub-phase exceeds 15 estimated prompts (max: 4A at 12)
- [x] No sub-phase needs 5+ reference docs (max: 2 docs in 4B, 5A, 5B)
- [x] AI Agents excluded from all Phase 5 sub-phases (verified: explicitly in 5A and 5B "Excludes")
- [x] Visual automation canvas excluded from all Phase 4 sub-phases (verified: explicitly in 4A and 4B "Excludes")
- [x] Self-hosted AI excluded (verified: explicitly in 5A "Excludes")
- [x] Dependencies reference specific sub-phase numbers from Phases 1–3 (1A through 1I, 2A, 3A-i through 3H-ii — not "Phase 1" generically)
- [x] No post-MVP features in any "Includes" (verified: Kanban, formula engine, AI Agents, App Designer, visual canvas, DuckDB, vector embeddings, MCP, self-hosted AI, booking triggers, approval Mode 3, Provisioning API, AI API, Automation API, Webhook Management API, Tenant Management API all excluded)
- [x] Report total sub-phase count: 6
- [x] Report total prompt estimate: 56 (12 + 10 + 9 + 10 + 9 + 6)
- [x] automations.md sections split cleanly: triggers + execution + builder + data model → 4A; actions + webhooks + testing → 4B
- [x] approval-workflows.md modes 1+2 (lines 38–144) correctly assigned to 4B; Mode 3 and all approval tables excluded as post-MVP
- [x] ai-data-contract.md Core UX portions (field type implementations) assigned to 5A; post-MVP field types (smart_doc, formula, dependency, sub_items, lookup, rollup, barcode) excluded
- [x] ai-metering.md dashboard sections (214–281) assigned to 5B; Foundation metering flow (already in 1H), reconciliation/internal monitoring (operational) excluded
- [x] platform-api.md Phase Implementation respected: Data API + Schema API + File Upload API = MVP Core UX; Provisioning/Automation/AI/Webhook/Tenant APIs = post-MVP
- [x] Booking-scheduling.md confirmed post-MVP — no automation triggers from booking in any Phase 4 sub-phase
