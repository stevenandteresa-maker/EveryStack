# Platform Maintenance Agents — Architecture, Skills & Prioritization

> **Reference doc (Tier 3). Post-MVP scope — depends on agent runtime from `agent-architecture.md`.**
> Platform-level autonomous agents for security, operational health, business intelligence, and self-maintaining AI quality. Extends `agent-architecture.md` (user-facing agent runtime) with a second execution mode for platform-scoped agents that operate across tenants on behalf of the platform owner.
> Cross-references: `agent-architecture.md` (AgentSession, AgentScope, execution runtime, approval model, safety framework), `ai-skills-architecture.md` (three-tier skill model, Skill Maintenance Agent, skill improvement pipeline), `ai-architecture.md` (provider adapters, capability tiers, prompt caching, Context Builder), `ai-metering.md` (credit system, cost model, Batch API, per-tenant margin tracking), `ai-data-contract.md` (canonicalToAIContext pipeline), `observability.md` (Pino, Sentry, OpenTelemetry — signal sources for Ops Intelligence Agent), `compliance.md` (RLS policies, PII handling, breach notification, session management, API security), `sync-engine.md` (connection health, failure taxonomy, rate limits — signal sources for Sync Health Agent), `automations.md` (execution engine, run logs — signal sources for Automation Health Agent), `data-model.md` (audit_log seven-source attribution, ai_usage_log, base_connections, sync_failures, automation_runs), `settings.md` (Platform Owner Console — approval and reporting surface for all platform agents)
> Implements: `packages/shared/ai/CLAUDE.md` (agent rules), `apps/worker/CLAUDE.md` (agent execution queue)
> External influence: Janakiram MSV, "The case for running AI agents on Markdown files instead of MCP servers" (The New Stack, 2026-03-06) — standalone test principle (§12), MCP schema suppression pattern (§13), operator skills pre-agent pattern (§14)
> Last updated: 2026-03-09 — Added standalone test principle, MCP schema suppression strategy, and pre-agent operator skills pattern (§§12–14). Initial architecture: full agent catalog (14 agents), shared runtime, skill strategy, prioritization, cost model.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| 1. The Problem | 35–43 | Why platform maintenance can't stay manual as tenant count grows |
| 2. User-Facing vs Platform Agents | 45–86 | Fundamental split, execution model differences, scope differences |
| 3. The 14-Agent Catalog | 88–277 | Three categories, all agents defined with scope, signals, and cadence |
| 4. Shared Agent Runtime | 279–396 | Execution loop, tool registry, observability — shared across both agent types |
| 5. Platform Agent Extensions | 398–494 | PlatformAgentSession, PlatformAgentScope, approval model, scheduling |
| 6. Skill Strategy for Platform Agents | 496–637 | Three-tier skill model applied to maintenance, skill catalog, cost implications |
| 7. Inter-Agent Communication | 639–688 | Shared operational context, findings table, indirect coordination |
| 8. Cost Model | 690–771 | Prompt caching, tier routing, Batch API, per-cycle cost estimates |
| 9. Prioritized Build Order | 773–858 | Five tiers, sequenced by survival risk and data availability |
| 10. Data Model Additions | 860–928 | New tables, schema changes, Redis patterns |
| 11. Key Architectural Decisions | 930–989 | Decisions to settle before implementation begins |
| 12. The Standalone Test | 991–1028 | Formal skill quality gate: every skill must work without tool access |
| 13. MCP Schema Suppression | 1030–1089 | Skill-aware context loading that avoids redundant MCP tool schema bloat |
| 14. Pre-Agent Operator Skills | 1091–1145 | Near-term value: platform operator playbooks usable with Claude Code before agent runtime ships |

---

## 1. The Problem

EveryStack is a multi-tenant SaaS platform with a solo founder. As tenant count grows, so does the operational surface: sync connections that break silently, security patterns that need monitoring, AI skills that degrade, automations that fail, tenants that churn without warning, and unit economics that shift. Every hour spent on manual operational review is an hour not spent building features.

The platform already has the raw signals for all of this — `audit_log`, `ai_usage_log`, `base_connections`, `sync_failures`, `automation_runs`, `portal_sessions`, `workspace_memberships`, and more. What's missing is an autonomous layer that watches these signals continuously, detects patterns a human would catch during a manual review, and surfaces findings in the Platform Owner Console so the platform owner can act on them in 30–60 minutes per week instead of 4–6 hours.

User-facing agents (specced in `agent-architecture.md`) solve a different problem — they help workspace users accomplish tasks within their workspace. Platform maintenance agents solve the operational problem of running the business itself.

---

## 2. User-Facing vs Platform Agents

Covers The Fundamental Split, Why This Distinction Matters, Shared Infrastructure (identical for both types).
Touches `tenant_id`, `delegating_user_id`, `portal_sessions`, `allowed_tables`, `agent_sessions` tables. See `agent-architecture.md`.

### The Fundamental Split

User-facing agents and platform maintenance agents share infrastructure but have fundamentally different execution models.

**User-facing agents** (from `agent-architecture.md`):
- Triggered by a user within a workspace
- Scoped to one tenant via `tenant_id` and one user's permissions via `delegating_user_id`
- Permission model: user permissions ∩ AgentScope constraints
- Approval model: five-tier risk (read → low → medium → high → structural)
- Cadence: on-demand, interactive
- Goal: accomplish a task the user requested

**Platform maintenance agents** (this document):
- Triggered by schedule (cron) or platform events
- Scoped to the entire platform — read across all tenants
- Permission model: platform owner authority with narrow write constraints
- Approval model: auto-execute reads, recommend actions, auto-execute safe writes (session cleanup)
- Cadence: scheduled (weekly, daily, hourly, or continuous depending on agent)
- Goal: detect problems, surface findings, recommend actions

### Why This Distinction Matters

A Security Agent monitoring portal auth failures needs to read `portal_sessions` across every tenant — no single `tenant_id` scope applies. A Tenant Success Agent scoring churn risk needs `workspace_memberships.last_accessed_at` for every tenant simultaneously. The user-facing `AgentScope` model with `allowed_tables` filtered through one user's RBAC doesn't work for these use cases.

The runtime infrastructure — execution loop, BullMQ queue, checkpointing, circuit breakers, observability — is shared. The identity model, scope model, approval model, and scheduling model are different.

### Shared Infrastructure (identical for both types)

- BullMQ `agent.execute` job processor with plan → act → observe → re-plan loop
- Checkpointing after each step for crash recovery
- Circuit breakers: 3 consecutive errors → pause, no-progress detection, timeout enforcement
- `AgentTraceStep` observability with reasoning, action, result, and cost tracking
- Debugging replay UI in Platform Owner Console
- `agent_sessions` table for execution tracking
- Dynamic capability tier escalation within a single run

---

## 3. The 14-Agent Catalog

Covers Category A — Platform Maintenance (keeping the lights on), Category B — Platform Security (protecting the platform), Category C — Business Operations (running the business).
Touches `ai_usage_log`, `base_connections`, `sync_failures`, `sync_conflicts`, `sync_schema_changes` tables. See `ai-skills-architecture.md`.

### Category A — Platform Maintenance (keeping the lights on)

**A1. Skill Maintenance Agent**

Already fully specced in `ai-skills-architecture.md` §10. Reads `ai_usage_log` (anonymized), detects skill degradation patterns (regeneration rate spikes, failure pattern clustering), drafts updated skill sections, validates via eval suite, packages updates for human approval. Runs weekly. For integration skills, additionally investigates drift by running exploratory MCP tool calls against live integrations.

Scope: Read `ai_usage_log`, eval results, current skill documents, reference docs. Write draft skill updates. Cannot deploy skills, modify AI pipeline code, or access user workspace data.

**A2. Sync Health Agent**

Monitors sync connection health across all tenants. Detects systemic patterns (platform-wide rate limit changes, provider API degradation) versus per-tenant issues (stale OAuth tokens, misconfigured field mappings). Auto-adjusts retry scheduling and batch sizes within safe bounds. Escalates systemic issues to platform owner. Produces weekly sync health digest.

Signal sources: `base_connections` (status, health JSONB, last_sync_at), `sync_failures` (error_code distribution, retry_count patterns), `sync_conflicts` (volume trends), `sync_schema_changes` (pending changes aging without resolution).

Scope: Read all sync-related tables across tenants. Write retry/scheduling parameter adjustments only. Cannot delete data, modify field mappings, or resolve conflicts (those are user decisions).

Cadence: Continuous monitoring with hourly aggregation. Immediate escalation for critical failures (>30% of connections in error state).

**A3. Data Integrity Agent**

Runs scheduled scans for data consistency issues. Detects orphaned `cross_link_index` entries (target record deleted), stale `search_vector` content on records, field type mismatches between `fields.field_type` and actual `canonical_data` JSONB shapes, and records with malformed JSONB.

Scope: Read `records`, `fields`, `cross_links`, `cross_link_index`. Write only to derived/index data (rebuild search vectors, clean orphaned index entries). Never modifies `canonical_data` or `fields` definitions.

Cadence: Weekly, off-peak hours.

**A4. Automation Health Agent**

Identifies automations with high failure rates (misconfiguration vs transient errors), detects automations that haven't fired despite being "active" (possibly orphaned after schema changes), spots chain depth or rate limit patterns. Surfaces findings per-workspace, optionally notifies workspace managers.

Signal sources: `automation_runs` (status distribution, failure patterns, timing), `automations` (active automations with zero recent runs).

Scope: Read `automations`, `automation_runs`. Cannot modify automations — reports and recommends only.

Cadence: Weekly digest, daily scan for critical failure rates (>50% failure rate on active automations).

**A5. Ops Intelligence Agent**

Aggregates error patterns across tenants to distinguish "one user has a bug" from "the platform has a regression." Correlates Sentry error spikes with recent deploys. Identifies slow queries via OpenTelemetry traces that have degraded over time. Produces daily ops brief.

Signal sources: Sentry error feeds, OpenTelemetry traces, Pino structured logs (aggregated), deploy timestamps.

Scope: Read telemetry data only. Never modifies application state. Output is a daily ops brief in Platform Owner Console.

Cadence: Continuous monitoring, daily report generation.

**A6. Docs Integrity Agent**

Compares MANIFEST.md line counts against actual files, verifies GLOSSARY.md terms match code and doc usage, checks cross-reference links for broken targets, detects when builds change behavior that specs still describe the old way. Produces a drift report after each build cycle.

Signal sources: Files in `docs/`, codebase symbols, git diffs from recent builds.

Scope: Read `docs/` and codebase. Write draft doc updates (same approval model as Skill Maintenance Agent). Cannot modify application code.

Cadence: Post-build trigger (after each Step 3 build completes), plus weekly scheduled scan.

**A7. Platform Health Agent**

Monitors resource consumption across tenants (record quotas, AI credit usage trends, workspace counts approaching plan limits). Cleans up expired `admin_impersonation_sessions` (15-minute TTL enforcement), stale `tenant_feature_flags`, and dormant workspace data. Produces weekly platform health summary.

Signal sources: `tenant_memberships`, `workspace_memberships`, `ai_credit_ledger`, `admin_impersonation_sessions`, `tenant_feature_flags`, record counts per table.

Scope: Read all platform-level tables. Auto-execute safe cleanup (expired sessions, TTL enforcement). Recommend actions for everything else.

Cadence: Daily cleanup, weekly health summary.

### Category B — Platform Security (protecting the platform)

**B1. Security Agent**

Monitors authentication and session anomalies across all four auth systems (Clerk platform users, Quick Portal magic links, App Portal email+password, Platform API keys). Detects brute force patterns, API key usage anomalies, expired/never-rotated credentials, stale sessions. Runs periodic RLS isolation verification. Validates PII anonymization cascade for deleted users. Monitors audit log integrity.

Sub-domains:
- **Authentication anomaly detection**: Failed auth patterns across portals, API key usage spikes, geographically impossible sessions (via Clerk webhooks), IP-based pattern clustering.
- **RLS & tenant isolation verification**: Periodic read-only "isolation probes" using `testTenantIsolation()` pattern against production. Verifies every tenant-scoped table has RLS enabled and forced. Runs after every deployment and weekly on schedule.
- **OAuth token & credential health**: Connections in `auth_required` status for >24h, token refresh anomalies, verification that OAuth tokens never appear in logs (Pino redaction audit).
- **Dependency & vulnerability monitoring**: Correlates CVEs with actual dependency usage, tracks vulnerability response SLA compliance, monitors for supply chain attacks (unexpected dependencies, postinstall scripts, ownership changes).
- **Audit log integrity**: Detects mutations without corresponding audit entries, verifies anonymization cascade completeness for deleted users, ensures log retention policies are enforced (90-day purge).

Signal sources: `audit_log`, `portal_sessions`, `portal_access`, `admin_impersonation_sessions`, `api_request_log`, `base_connections` (token metadata, not values), Clerk webhooks, Sentry feeds, dependency manifests.

Scope: Read access to almost everything. Write access to almost nothing. Can auto-execute expired session cleanup (deterministic, safe). Recommends but never executes emergency actions (key revocation, force logout). See scope table below.

| Can Do | Cannot Do |
|--------|-----------|
| Read audit_log, ai_usage_log, portal_sessions, admin_impersonation_sessions | Modify any user data |
| Read sync connection health and token metadata (not actual token values) | Access OAuth token values |
| Run RLS verification queries (read-only) | Modify RLS policies |
| Read Sentry error feeds | Dismiss or resolve errors |
| Read dependency manifests | Install or update packages |
| Produce security reports and alerts | Disable features or block users |
| Auto-clean expired sessions (deterministic TTL) | Revoke API keys or force logout |
| Recommend emergency actions | Execute emergency actions |

Cadence: Near-real-time for critical detection (brute force, API abuse). Daily for hygiene (session cleanup, token rotation reminders). Weekly for deep scans (RLS verification, audit integrity, vulnerability posture).

**B2. Abuse & Trust Agent**

Protects the platform from misuse by legitimate tenants. Distinct from Security Agent: security protects against attackers, abuse protects against misuse.

Detection domains:
- **Portal spam**: Public portals serving phishing content or SEO spam.
- **Automation email abuse**: Automations sending bulk unsolicited email through Resend — destroys sender reputation for all tenants.
- **Form submission abuse**: Bots hitting public Quick Forms, creating garbage records (even with Turnstile).
- **API key abuse**: Tenant API keys used for scraping or endpoint hammering.
- **Webhook abuse**: Outbound webhooks relaying data to malicious endpoints, or inbound webhooks injecting bad data.

Signal sources: `audit_log`, `automation_runs` (email action volume per tenant), `form_submissions` (submission rate patterns, IP clustering), `api_request_log` (per-key volume and endpoint distribution), outbound webhook logs.

Scope: Read operational tables. Recommend actions (suspend portal, disable automation, revoke API key). Cannot execute suspensions directly.

Cadence: Continuous monitoring with hourly aggregation. Immediate escalation for email reputation threats.

### Category C — Business Operations (running the business)

**C1. Tenant Success & Churn Risk Agent**

Scores tenant health based on composite activity signals. Detects churn risk patterns (login frequency declining over 3 weeks, automations being deactivated, workspaces going dormant). Identifies tenants stuck in onboarding. Surfaces prioritized list in Platform Owner Console.

Signal sources: `workspace_memberships.last_accessed_at`, `ai_usage_log` (engagement with AI features), `automation_runs` (value realization frequency), `base_connections` (sync activity — is data still flowing?), `portals` (portal creation and usage).

Scoring model:
- **Recency**: Days since last login (exponential decay weighting)
- **Frequency**: Login sessions per week (rolling 4-week average)
- **Feature breadth**: Number of distinct features used (sync, automations, portals, AI, forms)
- **Value indicators**: Active automations running, portals published, records growing
- **Decay signals**: Automations deactivated, workspaces going dormant, sync connections paused

Scope: Read `workspace_memberships`, `ai_usage_log`, `automation_runs`, `base_connections`, `portals`, `forms` across all tenants. Cannot access record data or workspace content. Output is a tenant health dashboard and prioritized risk list.

Cadence: Weekly scoring cycle. Daily scan for acute churn signals (tenant with zero logins for 14+ days that was previously active daily).

**C2. Onboarding Friction Agent**

Watches the signup-to-value funnel. Identifies where users drop off (connected a platform but never selected tables? Selected tables but never created a portal or automation?). Detects patterns across cohorts (Notion users consistently stuck at a different point than Airtable users). Correlates drop-off with specific error states.

Signal sources: `users.created_at` (signup timing), `base_connections` (platform connection timing and status), `tables` (table creation timing), `automations` (first automation timing), `portals` (first portal timing), `sync_failures` (errors during onboarding period).

Output: Specific, actionable findings — not dashboards. Example: "23% of new users abandon during table selection when they have more than 15 tables. Consider adding a 'recommended tables' suggestion."

Scope: Read user journey data across tenants. No write access. Output is findings report in Platform Owner Console.

Cadence: Weekly cohort analysis. Needs 2–3 months of signup data before producing meaningful findings.

**C3. Revenue & Plan Optimization Agent**

Tracks tenants approaching plan limits (record quotas, AI credit exhaustion, workspace count). Detects billing anomalies (10x credit consumption spike — power user or runaway automation?). Identifies plan/usage mismatches. Monitors AI credit system economics — are credit costs sustainable?

Signal sources: `ai_credit_ledger` (credit consumption per tenant), `ai_usage_log` (per-call costs vs credits charged), `tenants` (plan type), record counts per table, `workspace_memberships` (seat counts vs plan limits).

Scope: Read billing and usage data. No write access. Produces weekly margin report and real-time alerts for anomalies.

Cadence: Weekly margin analysis. Daily anomaly detection for credit consumption spikes.

**C4. Release & Changelog Agent**

Generates user-facing changelog entries from build diffs. Maintains a public changelog feed. Drafts release notes when batches of sub-phases ship. Detects when a build introduced behavioral changes that existing users should be notified about.

Signal sources: Git diffs from recent builds, updated reference docs, build playbook acceptance criteria.

Scope: Read git history and `docs/`. Write draft changelog entries for human review. Cannot publish directly.

Cadence: Post-build trigger (after each Step 4 review completes).

**C5. Knowledge Base & Help Content Agent**

Monitors `support_requests` for recurring themes. Identifies gaps between help content coverage and actual user questions. Drafts help articles based on patterns in resolved support requests. Keeps existing help content accurate as the platform evolves.

Signal sources: `support_requests` (themes, resolution patterns), help content (existing articles), feature changelog (what changed that might invalidate existing help content).

Scope: Read support data and help content. Write draft articles for human review. Cannot publish directly.

Cadence: Weekly theme analysis. Triggered when a new feature ships (check for help content gaps).

**C6. Infrastructure Cost Agent**

Tracks per-tenant resource consumption (record counts, sync traffic volume, AI call volume, file storage). Monitors provider cost trends (Anthropic bill, Resend email volume, R2 storage, compute costs). Calculates cost-to-serve vs revenue per tenant.

Signal sources: `ai_usage_log` (provider costs), `base_connections` (sync volume), `records` (counts per tenant), `files` (storage per tenant), infrastructure provider billing data.

Scope: Read usage and cost data. No write access. Produces weekly cost report with per-tenant margin analysis.

Cadence: Weekly cost analysis. Monthly trend report.

---

## 4. Shared Agent Runtime

Covers Execution Loop (identical for all agents), Tool Registry (shared pattern, different catalogs), Observability (identical for both types), Circuit Breakers (identical for both types), Dynamic Tier Escalation (identical for both types).
Touches `query_aggregate`, `query_tenant_detail`, `generate_report`, `create_platform_notice`, `create_pending_action` tables. See `agent-architecture.md`.

### Execution Loop (identical for all agents)

Every agent — user-facing and platform — runs the same core loop:

```
1. Create AgentSession (status: 'planning')
2. Load context: skills (Tier 1) + operational context (Tier 2) + historical patterns (Tier 3)
3. Agent reasons about goal with loaded context
4. Agent produces a Plan: ordered list of intended steps
5. For each step in plan:
    a. Check: has the plan been invalidated by observed results?
       → If yes: re-plan from current state
    b. Check: does this step require approval? (based on agent type's approval model)
       → If yes: pause, notify, wait
    c. Execute step (via tool call through tool registry)
    d. Observe result: capture output, check for errors
    e. Update working memory with result
    f. Check: are we done? Has the goal been achieved?
       → If yes: complete session
    g. Check: budget/timeout/mutation limits exceeded?
       → If yes: pause and report
6. Session complete → final summary → notification
```

Implementation: A `agent.execute` job type in the BullMQ worker service. Each loop iteration is a checkpoint — crash recovery resumes from the last completed step. Same infrastructure as automation checkpointing.

### Tool Registry (shared pattern, different catalogs)

The tool registry architecture from `agent-architecture.md` §2.5 applies to both agent types. The difference is which tools are available:

**User-facing agents** get tools filtered by `AgentScope.allowed_tools` ∩ user RBAC permissions. Catalog includes: search_records, create_record, update_field, create_automation, send_email_draft, etc.

**Platform maintenance agents** get a different tool catalog:

| Tool | Purpose | Used By |
|------|---------|---------|
| `query_aggregate` | Run aggregate queries across tenants (counts, rates, distributions) | All platform agents |
| `query_tenant_detail` | Drill into one tenant's data for diagnosis | Sync Health, Security, Tenant Success |
| `generate_report` | Produce structured finding report for Platform Owner Console | All platform agents |
| `create_platform_notice` | Create a notice visible to all tenants or specific tenants | Sync Health (systemic issues), Security (incidents) |
| `create_pending_action` | Surface a recommended action for platform owner approval | Security, Abuse, Sync Health |
| `update_agent_schedule` | Adjust own or peer agent's next run timing | Ops Intelligence (trigger deeper scan) |
| `run_rls_probe` | Execute read-only tenant isolation verification query | Security |
| `scan_dependencies` | Read package manifests and check CVE databases | Security |
| `cleanup_expired` | Delete rows past deterministic TTL (sessions, tokens) | Security, Platform Health |
| `read_eval_results` | Load eval suite results for skill analysis | Skill Maintenance |
| `draft_skill_update` | Write a proposed skill diff for human review | Skill Maintenance |
| `read_git_diff` | Load recent build diffs for changelog/docs analysis | Release, Docs Integrity |
| `query_usage_log` | Read ai_usage_log with anonymization | Skill Maintenance, Revenue |

The registry pattern (JSON Schema parameters, permission-gated, provider-agnostic) is identical. Only the tool catalog differs.

### Observability (identical for both types)

Every agent step produces an `AgentTraceStep` (from `agent-architecture.md` §2.6):

```typescript
interface AgentTraceStep {
  step_index: number;
  phase: 'planning' | 'tool_call' | 'observation' | 'replanning' | 'approval_wait';
  reasoning: string;
  action: {
    tool_name: string;
    parameters: Record<string, unknown>;
    risk_tier: string;
  } | null;
  result: {
    success: boolean;
    output: unknown;
    error?: string;
  } | null;
  ai_calls: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    credits: number;
  }[];
  duration_ms: number;
  timestamp: Date;
}
```

The debugging replay UI in Platform Owner Console works identically whether reviewing a Security Agent's findings or a user-facing Data Steward's actions. Same `agent_sessions` table, same trace format, same replay visualization.

### Circuit Breakers (identical for both types)

From `agent-architecture.md` §2.7, applied uniformly:

- 3 consecutive tool call errors → auto-pause, notify platform owner
- 3 reasoning loop iterations without progress → auto-pause
- Time budget exceeded → auto-pause (not terminate — can be extended)
- Chain depth protection (≤5) for agent → sub-agent spawning
- `max_mutations` hard cap on write operations per session

### Dynamic Tier Escalation (identical for both types)

Within a single agent run, different reasoning steps route to different capability tiers:

```typescript
const tier = agentRouter.selectTier({
  phase: 'planning' | 'tool_selection' | 'observation_analysis' | 'replanning',
  complexity: estimatedComplexity,
  previous_errors: errorCount,
  remaining_budget: creditsLeft,
});
```

For platform maintenance agents, this typically means:
- **Scanning phase** (80% of calls): `fast` tier (Haiku) — "does this tenant show anomalies?"
- **Diagnosis phase** (15% of calls): `standard` tier (Sonnet) — "what's causing this pattern?"
- **Report phase** (5% of calls): `standard` tier (Sonnet) — "draft the finding for the platform owner"

---

## 5. Platform Agent Extensions

Covers PlatformAgentSession, PlatformAgentScope, Approval Model for Platform Agents, Scheduling.
Touches `platform_agent_configs` tables. See `agent-architecture.md`.

### PlatformAgentSession

Extends `AgentSession` from `agent-architecture.md` §2.1 with platform-specific fields:

```typescript
interface PlatformAgentSession extends AgentSession {
  agent_category: 'platform';             // Distinguishes from user-facing agents
  delegating_user_id: string;             // Always the platform owner
  tenant_id: null;                        // Platform-scoped, not tenant-scoped
  schedule: {
    cron: string;                         // '0 9 * * 1' — Mondays at 9am
    last_run_at: Date | null;
    next_run_at: Date;
    enabled: boolean;
  };
  scope: PlatformAgentScope;
  trigger: 'scheduled' | 'event' | 'manual';  // What initiated this run
  event_trigger?: {                       // Present when trigger = 'event'
    event_type: string;                   // 'deploy_completed', 'sync_failure_spike', etc.
    event_data: Record<string, unknown>;
  };
}
```

### PlatformAgentScope

Different from user-facing `AgentScope`. Platform agents don't intersect with a user's RBAC — they operate with platform owner authority constrained by their specific scope definition.

```typescript
interface PlatformAgentScope {
  // Which system tables this agent can read
  readable_tables: string[];

  // Which tenants this agent can access (most agents need 'all')
  tenant_access: 'all' | string[];

  // Write permissions — almost always false or a narrow list of safe operations
  can_write: false | {
    tables: string[];                     // Which tables can be written to
    operations: ('cleanup_expired' | 'update_scheduling' | 'draft_update')[];
  };

  // Where this agent's output goes
  output_targets: (
    | 'console_report'      // Finding appears in Platform Owner Console
    | 'platform_notice'     // Notice visible to affected tenants
    | 'notification'        // Push notification to platform owner
    | 'pending_action'      // Recommended action requiring approval
    | 'draft_update'        // Proposed content change (skill, doc, changelog)
  )[];
}
```

### Approval Model for Platform Agents

Simpler than the five-tier user-facing model because platform agents rarely write:

| Action Type | Approval | Examples |
|-------------|----------|----------|
| **Read & analyze** | Auto-execute | All scanning, aggregation, pattern detection |
| **Report & surface** | Auto-execute | Findings in Console, notifications to platform owner |
| **Safe deterministic write** | Auto-execute with log | Expired session cleanup (TTL-based), retry rescheduling |
| **Recommended action** | Requires platform owner approval | Suspend a portal, revoke an API key, disable an automation |
| **Content draft** | Requires platform owner approval | Skill updates, doc changes, changelog entries |
| **Emergency recommendation** | Requires platform owner approval + escalation | Disable a skill (eval pass rate <50%), block a tenant's email sending |

The Platform Owner Console is the single approval surface. The platform owner reviews the week's findings from all agents in one place — not per-agent dashboards.

### Scheduling

Platform agents are scheduled via cron expressions stored in `platform_agent_configs`:

| Agent | Default Schedule | Event Triggers |
|-------|-----------------|----------------|
| Security + Abuse | Continuous / hourly aggregation | deploy_completed, auth_failure_spike |
| Sync Health | Hourly monitoring, weekly digest | sync_failure_rate > 30% |
| Tenant Success | Weekly scoring | tenant_inactive_14d |
| Revenue | Weekly margin, daily anomaly | credit_consumption_spike |
| Skill Maintenance | Weekly (Monday, configurable) | eval_drift_detected |
| Automation Health | Weekly digest, daily critical scan | automation_failure_rate > 50% |
| Onboarding Friction | Weekly cohort analysis | None (retrospective only) |
| Ops Intelligence | Continuous, daily report | sentry_error_spike, deploy_completed |
| Platform Health | Daily cleanup, weekly summary | None |
| Knowledge Base | Weekly theme analysis | feature_shipped |
| Docs Integrity | Weekly scan | build_completed |
| Release & Changelog | None (event-only) | build_reviewed (Step 4 complete) |
| Data Integrity | Weekly, off-peak | None |
| Infrastructure Cost | Weekly analysis, monthly trend | None |

Event triggers use the existing BullMQ event system — a deploy completion or a metric threshold crossing enqueues an agent run.

---

## 6. Skill Strategy for Platform Agents

Covers Applying the Three-Tier Model, Tier 1 — Platform Maintenance Skills (static, human-written), Tier 2 — Platform Operational Context (dynamic, generated per-cycle), Tier 3 — Historical Patterns (learned over time), How the Three Tiers Compose (Platform Agent Example).
Touches `ai_usage_log`, `audit_log`, `automation_runs`, `base_connections`, `agent_episodes` tables. See `ai-skills-architecture.md`, `sync-health-patterns.md`, `sync-engine.md`.

### Applying the Three-Tier Model

The three-tier skill model from `ai-skills-architecture.md` applies directly to platform maintenance agents, but the content of each tier serves a completely different purpose.

**User-facing skills** teach the AI how to *build* features (automation triggers, portal configs, merge tag syntax).

**Platform maintenance skills** teach agents how to *monitor and maintain* systems (failure pattern interpretation, anomaly detection methodology, recovery decision trees).

### Tier 1 — Platform Maintenance Skills (static, human-written)

Small documents (500–1,200 tokens at full condensation) that encode methodology — not data. The Sync Health Agent doesn't need a skill listing every sync failure in the system; it needs a skill teaching it how to *interpret* sync failures, distinguish systemic issues from per-tenant misconfiguration, and select the appropriate response for each failure category.

These skills change only when the platform's architecture changes (new sync error categories, new auth system, new field types). Same authoring and maintenance model as user-facing Tier 1 skills — human-written or Skill Maintenance Agent-drafted with human approval.

#### Platform Maintenance Skill Catalog

| Skill ID | Agent Consumer(s) | Token Est. (full/std/min) | Key Content |
|----------|-------------------|---------------------------|-------------|
| `sync-health-patterns.md` | Sync Health | 1,100 / 450 / 200 | Normal sync behavior baselines, failure taxonomy (8 error categories from `sync-engine.md`), rate limit patterns per platform (Airtable/Notion/SmartSuite), recovery decision tree, connection health state machine (active → error → auth_required → converted flow) |
| `security-monitoring.md` | Security, Abuse | 1,200 / 500 / 250 | Auth failure pattern signatures, brute force detection thresholds, RLS verification procedures, session lifecycle rules (TTLs per auth type), API key abuse patterns (volume, endpoint, timing anomalies), email reputation signals |
| `tenant-health-signals.md` | Tenant Success, Onboarding | 900 / 400 / 200 | Engagement scoring methodology, churn indicator taxonomy (leading vs lagging signals), onboarding funnel stages and expected conversion rates, activity decay curve patterns, feature adoption benchmarks |
| `ai-quality-analysis.md` | Skill Maintenance | 800 / 350 / 150 | Regeneration rate interpretation, failure pattern classification (invalid config, hallucinated feature, close-but-wrong), skill-to-task-type mapping, eval result interpretation rules, root cause analysis methodology |
| `cost-economics.md` | Revenue, Infra Cost | 700 / 300 / 150 | Credit cost formulas (from `ai-metering.md`), provider pricing model (per-MTok rates, cache discounts, Batch API), per-tenant cost calculation methodology, margin threshold definitions, anomaly detection thresholds |
| `automation-health-patterns.md` | Automation Health | 800 / 350 / 150 | Normal run/fail ratios by automation complexity, misconfiguration signature taxonomy, orphaned automation detection rules (active + zero runs + schema changed), chain depth violation patterns, template resolution failure causes |
| `platform-operations.md` | Ops Intelligence, Platform Health | 900 / 400 / 200 | Error severity classification (user bug vs platform regression vs provider outage), deployment correlation methodology, performance baseline calculation, feature flag lifecycle rules, session/token TTL specifications |

#### Skill Document Structure

Same structure as user-facing skills (YAML frontmatter + markdown content at three condensation levels):

```yaml
---
id: sync-health-patterns
version: 1
domain:
  - platform_sync_monitoring
  - platform_diagnostics
skillTier: platform-maintenance
tokenEstimates:
  full: 1100
  standard: 450
  minimal: 200
---
```

Stored in `packages/shared/ai/skills/documents/platform-maintenance/` alongside the existing `platform/` and `integrations/` directories.

### Tier 2 — Platform Operational Context (dynamic, generated per-cycle)

The platform maintenance counterpart to the Workspace Usage Descriptor. Instead of describing one tenant's configuration, it describes the platform's current operational state. Generated once at the start of each agent run cycle from database aggregation queries — no LLM calls required.

```typescript
interface PlatformOperationalContext {
  generated_at: string;                     // ISO timestamp

  // Aggregate health snapshot
  tenant_count: number;
  active_tenant_count: number;              // Logged in within 7 days
  total_sync_connections: number;
  connections_in_error_state: number;
  active_automations_count: number;
  total_portal_count: number;

  // Recent patterns (last 7 days)
  sync_failure_rate: number;                // Failures / total sync operations
  sync_failures_by_platform: Record<string, number>;   // { airtable: 42, notion: 8 }
  automation_failure_rate: number;
  ai_regeneration_rate: number;             // Global skill quality signal
  support_request_volume: number;
  new_signups_count: number;
  churned_tenants_count: number;            // Tenants who cancelled or went inactive

  // Baselines (rolling 30-day averages for comparison)
  baseline_sync_failure_rate: number;
  baseline_automation_failure_rate: number;
  baseline_ai_regeneration_rate: number;
  baseline_support_volume: number;

  // Open findings from previous agent runs
  open_findings: Array<{
    agent_type: string;                     // 'security', 'sync_health', etc.
    severity: 'info' | 'warning' | 'critical';
    summary: string;
    created_at: string;
    finding_id: string;
  }>;

  // Active alerts
  active_alerts: Array<{
    alert_type: string;
    triggered_at: string;
    details: Record<string, unknown>;
  }>;
}
```

**Generation cost**: One query pass across aggregate tables. Cached in Redis (`platform:operational_context:{cycle_id}`) for all agents to share during that cycle. Negligible cost — database aggregation, not LLM calls.

**Why this matters**: Without shared operational context, 14 agents would each independently run aggregate queries against `ai_usage_log`, `audit_log`, `automation_runs`, and `base_connections`. One generation pass eliminates 13× redundant database load.

### Tier 3 — Historical Patterns (learned over time)

After each run, every platform agent produces a summary stored in the `agent_episodes` table (from `agent-architecture.md` §2.3). Over time, these accumulate into a pattern library that agents can query semantically via pgvector embeddings.

**Examples of learned patterns:**

Sync Health Agent: "Airtable rate limit changes typically manifest as a sudden spike in 429 errors across 30%+ of tenants within the same hour. Last occurrence: 2026-08-14. Resolution was adjusting the token bucket refill rate from 5/sec to 3/sec."

Security Agent: "Portal brute force attempts typically come in clusters targeting multiple tenants from the same IP range. The pattern is 50–200 attempts within 10 minutes, then silence for 24 hours before another burst."

Tenant Success Agent: "Tenants who connect Airtable but don't create their first automation within 5 days have a 73% probability of churning within 30 days. The intervention that works best is a targeted email showing automation templates relevant to their connected table types."

**Retrieval**: When an agent runs, the Context Builder loads relevant Tier 3 patterns via semantic similarity to the current operational context. "Current sync failure spike" retrieves past episodes about sync failure spikes, giving the agent immediate historical context.

**Storage**: Same `agent_episodes` table as user-facing agents, with `agent_category: 'platform'` for filtering. Embedded via pgvector for semantic retrieval.

### How the Three Tiers Compose (Platform Agent Example)

```
Sync Health Agent weekly run:

Tier 1 (Maintenance Skill):  sync-health-patterns.md — failure taxonomy, recovery
                              decision tree, platform-specific rate limit patterns
Tier 2 (Operational Context): Platform snapshot — 12 connections in error state
                              (up from baseline of 3), 67% are Airtable, sync
                              failure rate 4.2% (baseline 0.8%)
Tier 3 (Historical Pattern):  "Last Airtable spike (2026-08-14) was caused by
                              rate limit change. Resolution: adjust token bucket."

Result: Agent immediately recognizes the pattern, skips exploratory diagnosis,
        recommends the same resolution that worked last time, generates a
        finding with high confidence.
```

Without skills, the same agent would spend 3,000–5,000 tokens re-learning what sync error categories exist, how to interpret failure rates, and what "normal" looks like — every single run.

---

## 7. Inter-Agent Communication

Covers Indirect Coordination via Shared Context, Coordination Examples, platform_agent_findings Table.
Touches `platform_agent_findings`, `open_findings`, `pending_action` tables.

### Indirect Coordination via Shared Context

Agents do not communicate directly. They communicate through the shared Tier 2 operational context via a `platform_agent_findings` table. When an agent produces a finding, it writes to this table. The next cycle's Tier 2 generation picks up all open findings and includes them in the `open_findings` array of `PlatformOperationalContext`.

This pattern is simpler to reason about, debug, and audit than point-to-point agent messaging.

### Coordination Examples

**Sync Health → Skill Maintenance → Ops Intelligence:**

1. Sync Health Agent detects Airtable rate limit pattern change. Writes finding: `{ agent: 'sync_health', severity: 'warning', summary: 'Airtable 429 rate increased 5x across 40% of tenants. Token bucket adjustment recommended.' }`

2. Next cycle, Skill Maintenance Agent sees the open finding in its Tier 2 context. Recognizes that the Airtable integration skill's rate limit section may be stale. Drafts an update to `skills/documents/integrations/airtable.md` with the new rate limit parameters.

3. After the skill update is approved and deployed, Ops Intelligence Agent detects that Airtable sync failure rate has returned to baseline. Writes finding confirming resolution.

**Security → Abuse → Platform Health:**

1. Security Agent detects unusual API key usage pattern for a specific tenant. Writes finding: `{ severity: 'warning', summary: 'Tenant X API key making 500 req/min (baseline: 10). Endpoint distribution suggests scraping.' }`

2. Abuse Agent picks up the finding, runs deeper analysis on the tenant's request patterns, confirms scraping behavior. Writes `pending_action`: recommend API key revocation + tenant notification.

3. Platform owner approves. Platform Health Agent records the action in its weekly digest.

### platform_agent_findings Table

```typescript
interface PlatformAgentFinding {
  id: string;                           // UUID
  agent_type: string;                   // Which agent produced this finding
  agent_session_id: string;             // Link to the specific run
  severity: 'info' | 'warning' | 'critical';
  category: string;                     // 'sync_health', 'security', 'churn_risk', etc.
  summary: string;                      // Human-readable finding
  details: Record<string, unknown>;     // Structured data for other agents to consume
  affected_tenants: string[] | null;    // Null = platform-wide
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed';
  recommended_action: string | null;    // What the agent suggests doing
  resolved_by: string | null;           // Platform owner or another agent's session
  created_at: Date;
  resolved_at: Date | null;
}
```

---

## 8. Cost Model

Covers Why Platform Agents Are Cheap, Prompt Caching (Primary Lever), Capability Tier Routing (Second Lever), Batch API (Third Lever), Shared Tier 2 Context (Fourth Lever), Estimated Weekly Cost (100-Tenant Platform).
See `ai-metering.md`.

### Why Platform Agents Are Cheap

Platform maintenance agents are dramatically cheaper per cycle than user-facing agents because of three properties: they're repetitive (same analysis patterns every cycle), predictable (same skills loaded every time), and mostly read-only (minimal output generation).

### Prompt Caching (Primary Lever)

When a platform agent runs its cycle, the system prompt + Tier 1 skill + Tier 2 operational context is identical for every per-tenant analysis step within that cycle. Anthropic's prompt caching means the first call pays full input price; subsequent calls pay 10% for cached content.

From `ai-metering.md` §2:

| Model | Input (per MTok) | Cache Read (per MTok) | Savings |
|-------|------------------|-----------------------|---------|
| Haiku 4.5 | $1.00 | $0.10 | 90% |
| Sonnet 4.5 | $3.00 | $0.30 | 90% |

A Security Agent scanning 100 tenants doesn't pay 100× skill loading cost — it pays 1× full + 99× at cache read rates. The skill context (1,200 tokens) costs $0.0012 on the first call and $0.00012 on each subsequent call at Haiku rates.

### Capability Tier Routing (Second Lever)

Most maintenance work is pattern detection and classification — `fast` tier (Haiku) work. Only report generation and recommendation drafting requires `standard` tier (Sonnet).

Typical distribution within a single agent cycle:

| Phase | % of Calls | Tier | Purpose |
|-------|-----------|------|---------|
| Scanning | 80% | fast (Haiku) | "Does this tenant show anomalies?" |
| Diagnosis | 15% | standard (Sonnet) | "What's causing this pattern?" |
| Reporting | 5% | standard (Sonnet) | "Draft the finding for the platform owner" |

### Batch API (Third Lever)

From `ai-metering.md` §2.1: Batch API provides a 50% discount for non-interactive submissions with 24-hour delivery guarantee.

Most maintenance agents don't need real-time results:

| Agent | Real-Time Required? | Batch Eligible? |
|-------|---------------------|-----------------|
| Security (critical detection) | Yes | No |
| Security (weekly deep scan) | No | Yes |
| Sync Health (critical alerts) | Yes | No |
| Sync Health (weekly digest) | No | Yes |
| Tenant Success | No | Yes |
| Revenue | No | Yes |
| Skill Maintenance | No | Yes |
| All others | No | Yes |

Only Security Agent critical-path detection and Sync Health Agent critical alerts need real-time processing. Everything else can be batched for 50% savings.

### Shared Tier 2 Context (Fourth Lever)

One `PlatformOperationalContext` generation per cycle (database aggregation, zero LLM cost) serves all 14 agents. Without this, each agent independently queries the same aggregate tables — 14× the database load and 14× the context-assembly overhead.

### Estimated Weekly Cost (100-Tenant Platform)

| Agent Group | Est. LLM Calls/Week | Avg Tokens/Call | Tier Mix | Est. Cost/Week |
|-------------|---------------------|-----------------|----------|----------------|
| Security + Abuse (continuous) | 150–250 | ~2,000 | 85% Haiku / 15% Sonnet | $1.50–3.00 |
| Sync Health (hourly + weekly) | 80–120 | ~1,500 | 90% Haiku / 10% Sonnet | $0.50–1.00 |
| Tenant Success + Onboarding | 30–50 | ~2,500 | 70% Haiku / 30% Sonnet | $0.40–0.80 |
| Revenue + Infra Cost | 20–30 | ~2,000 | 80% Haiku / 20% Sonnet | $0.20–0.40 |
| Skill Maintenance | 20–40 | ~3,000 | 50% Haiku / 50% Sonnet | $0.30–0.60 |
| All others (5 agents) | 40–80 | ~2,000 | 80% Haiku / 20% Sonnet | $0.40–0.80 |
| **Total** | **340–570** | | | **$3.30–6.60** |

**Key insight**: The total weekly cost for running all 14 platform maintenance agents across 100 tenants is roughly $3–7 — a rounding error on infrastructure costs. This is because maintenance agents are repetitive and predictable, which is exactly what prompt caching and Haiku routing optimize for. User-facing agents are more expensive per-session because each request is unique, producing lower cache hit rates.

### Cost Scaling

The cost scales sub-linearly with tenant count because:
- Tier 1 skills are loaded once per cycle regardless of tenant count (prompt caching)
- Tier 2 operational context is generated once from aggregates, not per-tenant
- Scanning-phase calls per tenant are Haiku-tier with cached context (minimal marginal cost)
- Only tenants flagged as anomalous generate Sonnet-tier diagnosis calls

At 1,000 tenants, estimated weekly cost is $15–30, not 10× the 100-tenant cost.

---

## 9. Prioritized Build Order

Covers Prioritization Criteria, Tier 1 — Build First (immediately when agent runtime ships), Tier 2 — Build within 4–6 weeks of agent runtime, Tier 3 — Build within 2–3 months of agent runtime, Tier 4 — Build within 6 months, Tier 5 — Build when it hurts not to have it.
Touches `ai_usage_log` tables. See `ai-skills-architecture.md`.

### Prioritization Criteria

Three factors determine build order:
1. **Survival risk**: What can kill the business if undetected?
2. **Data availability**: Does the agent need accumulated historical data, or can it work from day one?
3. **Founder time savings**: How many hours per week does this agent buy back?

### Tier 1 — Build First (immediately when agent runtime ships)

**Security + Abuse Agent (combined)**

Why first: A security breach or email reputation disaster is an extinction-level event for a young SaaS. If a tenant's automation spams through Resend, every tenant's email breaks. If a portal serves phishing content on `*.everystack.com`, the domain reputation takes the hit. These are "house on fire" scenarios, discoverable three days late if the founder is heads-down building.

Data requirement: Works from day one — monitors live activity, not historical patterns.

**Tenant Success & Churn Risk Agent**

Why first: Churn is the other silent killer. No customer success team exists. No one watches whether Tenant #47 logged in last week. By the time someone cancels, the decision was made weeks ago. Even a simple composite health score (recency × frequency × feature breadth) surfaced in the Platform Owner Console is transformative.

Data requirement: Works from day one using `workspace_memberships.last_accessed_at` and activity counts.

### Tier 2 — Build within 4–6 weeks of agent runtime

**Sync Health Agent**

Why tier 2: Sync is the core value proposition — EveryStack is the "layer above Airtable/Notion/SmartSuite." When sync breaks, the user's mental model of the product breaks. Sync issues generate the noisiest support requests. This agent directly reduces support burden and catches platform-wide provider issues before they become a flood of individual reports.

**Revenue & Plan Optimization Agent**

Why tier 2: Unit economics visibility is needed early. The risk for a solo-founder SaaS with usage-based AI pricing is that the most active tenants — the most exciting ones — cost the most in Anthropic API fees. If credit pricing is wrong, every new power user makes the problem worse. Even a weekly margin report prevents pricing surprises.

### Tier 3 — Build within 2–3 months of agent runtime

**Skill Maintenance Agent**

Why tier 3: Fully specced (`ai-skills-architecture.md` §10), most design-complete agent. But needs accumulated usage data — regeneration rates, failure patterns. Takes 4–6 weeks of real tenant activity before `ai_usage_log` has enough signal for meaningful pattern detection.

**Automation Health Agent**

Why tier 3: Same data accumulation dependency. Automations need to run for a while before failure patterns emerge. MVP automation surface (6 triggers, 7 actions, linear flows) is relatively contained.

**Onboarding Friction Agent**

Why tier 3: Needs cohort data. Can't detect "Notion users consistently drop off at table selection" until enough Notion users have gone through the flow. Give it 2–3 months of signups, then enable with backfill analysis.

### Tier 4 — Build within 6 months

**Ops Intelligence Agent**: Valuable but less urgent — observability stack (Pino + Sentry + OpenTelemetry) already generates alerts for acute issues. This agent adds intelligence on top (pattern correlation, daily briefs). Quality-of-life improvement, not survival requirement.

**Platform Health Agent**: Tenant-level resource monitoring, feature flag hygiene, session cleanup. The Security Agent handles the safety-critical subset (session cleanup, impersonation TTL enforcement) in tier 1. Full Platform Health is a scale concern.

**Knowledge Base Agent**: Depends on having a body of resolved support requests to learn from. Too early until the support system has run for several months.

**Infrastructure Cost Agent**: The Revenue Agent in tier 2 covers the most critical cost visibility (per-tenant margins). This agent adds deeper provider cost trend analysis. Worth building once past product-market fit.

### Tier 5 — Build when it hurts not to have it

**Data Integrity Agent**: RLS policies, foreign key constraints, and CI checks catch most integrity issues at the application layer. The edge cases (orphaned indexes, stale search vectors) are real but rarely urgent.

**Docs Integrity Agent**: Saves founder time during build cycles, but once in post-MVP agent territory, the cadence of major builds slows. Manual docs-sync is tolerable at slower pace.

**Release & Changelog Agent**: Solves a real communication problem but won't kill the business if deferred. Many early-stage SaaS products survive on a manually updated changelog.

### Build Order Summary

| Priority | Agent | Survival Risk | Data Needed? | Hours Saved/Week |
|----------|-------|---------------|--------------|------------------|
| 1st | Security + Abuse (combined) | Extinction-level | No (live signals) | 2–4h |
| 2nd | Tenant Success / Churn Risk | High (silent churn) | No (live signals) | 2–3h |
| 3rd | Sync Health | High (core value prop) | No (live signals) | 2–3h |
| 4th | Revenue & Plan Optimization | Medium (margin blindness) | Minimal (1–2 weeks) | 1–2h |
| 5th | Skill Maintenance | Medium (AI quality decay) | Yes (4–6 weeks) | 4–6h |
| 6th | Automation Health | Low–Medium | Yes (4–6 weeks) | 1–2h |
| 7th | Onboarding Friction | Low–Medium | Yes (2–3 months) | 1–2h |
| 8th+ | Remaining 7 agents | Low | Varies | <1h each |

### Architectural Note on Sequencing

Agents 1–4 all share the same core pattern: read from existing tables, compute scores or detect anomalies, surface findings in Platform Owner Console, recommend but rarely act. If the agent runtime is designed with this pattern as the default, the incremental cost of each new agent drops significantly after the first one is built. The Security Agent is the hardest to build (broadest read scope, most detection rules), so it's worth investing in getting that one right — everything after it is a simpler instance of the same pattern.

---

## 10. Data Model Additions

Covers New Tables, platform_agent_configs Schema, platform_agent_findings Schema, Changes to Existing Tables, Redis Key Patterns.
Touches `platform_agent_configs`, `platform_agent_findings`, `platform_operational_snapshots`, `agent_type`, `schedule_cron` tables. See `agent-architecture.md`.

### New Tables

| Table | Purpose |
|-------|---------|
| `platform_agent_configs` | Per-agent configuration: schedule, scope, enabled state, notification preferences |
| `platform_agent_findings` | Findings produced by agent runs, consumed by other agents and Platform Owner Console |
| `platform_operational_snapshots` | Cached Tier 2 operational context per cycle |

### platform_agent_configs Schema

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `agent_type` | VARCHAR | Registered platform agent type key |
| `enabled` | BOOLEAN | Whether this agent runs on schedule |
| `schedule_cron` | VARCHAR | Cron expression for scheduled runs |
| `scope` | JSONB | PlatformAgentScope definition |
| `config` | JSONB | Agent-specific configuration (thresholds, notification preferences) |
| `last_run_session_id` | UUID (nullable) | FK to `agent_sessions` |
| `last_run_at` | TIMESTAMPTZ (nullable) | |
| `next_run_at` | TIMESTAMPTZ (nullable) | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

No `tenant_id` column — this table is platform-scoped, not tenant-scoped. No RLS policy.

### platform_agent_findings Schema

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `agent_type` | VARCHAR | Which agent produced this finding |
| `agent_session_id` | UUID | FK to `agent_sessions` |
| `severity` | VARCHAR | 'info', 'warning', 'critical' |
| `category` | VARCHAR | Finding category for grouping |
| `summary` | TEXT | Human-readable finding |
| `details` | JSONB | Structured data for agent consumption |
| `affected_tenants` | UUID[] (nullable) | Null = platform-wide |
| `status` | VARCHAR | 'open', 'acknowledged', 'resolved', 'dismissed' |
| `recommended_action` | TEXT (nullable) | What the agent suggests doing |
| `resolved_by` | UUID (nullable) | Platform owner user ID |
| `created_at` | TIMESTAMPTZ | |
| `resolved_at` | TIMESTAMPTZ (nullable) | |

No `tenant_id` column. No RLS policy.

### Changes to Existing Tables

| Table | Change |
|-------|--------|
| `agent_sessions` | Add `agent_category` VARCHAR ('user', 'platform'). Allow `tenant_id` to be nullable (null for platform agents). Add `schedule_trigger` JSONB (nullable — present when triggered by schedule or event). |
| `ai_usage_log` | Existing `agent_session_id` nullable FK (from `agent-architecture.md`) covers platform agent calls too. Add `agent_category` VARCHAR (nullable) for efficient filtering. |

### Redis Key Patterns

| Pattern | Usage | TTL |
|---------|-------|-----|
| `platform:operational_context:{cycle_id}` | Shared Tier 2 context for current cycle | 24h |
| `platform:agent:schedule:{agent_type}` | Next scheduled run time | No TTL (managed) |
| `platform:agent:lock:{agent_type}` | Execution lock (prevent concurrent runs of same agent) | Agent timeout + buffer |
| `platform:agent:heartbeat:{session_id}` | Liveness check | 30s (refreshed) |
| `platform:findings:open_count` | Quick count of open findings for Console badge | 5min |

---

## 11. Key Architectural Decisions

Covers Decision 1: Combined Security + Abuse or separate agents?, Decision 2: Platform agents in same worker or separate service?, Decision 3: How do platform agents access cross-tenant data?, Decision 4: Should platform agents share Tier 3 memory with user-facing agents?, Decision 5: Can platform agents trigger user-facing agents?, Decision 6: Where do platform agent results appear?.
Touches `audit_log`, `portal_sessions`, `api_request_log`, `agent_category`, `agent_episodes` tables. See `agent-architecture.md`.

### Decision 1: Combined Security + Abuse or separate agents?

**Recommendation: Combined initially, split when scope warrants.**

Start as one agent with two operating modes (external threat detection and internal abuse detection). They share signal sources (`audit_log`, `portal_sessions`, `api_request_log`) and the same approval model. Split into two agents when the detection rule sets grow large enough that loading both skill sets exceeds the token budget for a single agent run. A single combined agent is simpler to build, deploy, and monitor.

### Decision 2: Platform agents in same worker or separate service?

**Recommendation: Same worker service, separate BullMQ queue.**

From `agent-architecture.md` §2.12 decision 1 — same rationale applies. Platform agents share execution infrastructure (Redis, DB connections, rate limiting, observability) with user-facing agents. A separate `platform-agent.execute` queue enables independent concurrency controls and priority scheduling without deployment complexity. Platform agent jobs run at P2 priority (below user-facing P0–P1) to avoid competing for resources during peak usage.

### Decision 3: How do platform agents access cross-tenant data?

**Recommendation: Bypass RLS with explicit platform-scoped queries.**

Platform agents need cross-tenant reads that RLS is specifically designed to prevent. The solution is a `getPlatformDb()` function (alongside the existing `getDbForTenant()`) that connects without setting `app.current_tenant_id`. This connection is only available to platform agent job processors — never exposed to user-facing code paths. The function is gated by a runtime check that the calling context is a platform agent session.

```typescript
// Only callable from platform agent execution context
function getPlatformDb(): DrizzleClient {
  assertPlatformAgentContext();  // Throws if not in a platform agent job
  return getDbConnection();       // No SET LOCAL app.current_tenant_id
}
```

This is a sensitive capability. The `assertPlatformAgentContext()` guard, combined with code review discipline and CI lint rules preventing `getPlatformDb()` imports outside of `apps/worker/src/agents/platform/`, contains the risk.

### Decision 4: Should platform agents share Tier 3 memory with user-facing agents?

**Recommendation: No. Separate memory pools.**

Platform agent episodic memory contains cross-tenant operational patterns. User-facing agent episodic memory contains per-workspace task history. Mixing them risks leaking cross-tenant information into user-facing agent context. Separate pools via `agent_category` filtering on `agent_episodes` queries. The `workspace_knowledge` table (shared knowledge from `agent-architecture.md` §2.3 Layer 3) is workspace-scoped and remains exclusively for user-facing agents.

### Decision 5: Can platform agents trigger user-facing agents?

**Recommendation: No. Platform agents surface findings; humans decide actions.**

A Sync Health Agent should not autonomously trigger a Data Import Agent to re-sync a tenant's broken connection. That crosses the boundary from "monitoring and recommending" to "acting on behalf of users without their knowledge." Platform agents produce findings and recommendations. The platform owner reviews them and decides whether to take action — which might include manually triggering a user-facing agent on a specific tenant's behalf.

The one exception: platform agents can trigger other platform agents via the event trigger system (e.g., Security Agent detects a pattern → enqueues an immediate Abuse Agent deep scan). This is platform-to-platform coordination, not platform-to-user action.

### Decision 6: Where do platform agent results appear?

**Recommendation: Platform Owner Console → Settings → AI → Platform Agents.**

A dedicated panel with three views:

- **Dashboard**: Per-agent status (last run, next run, findings count, health indicator). Open findings sorted by severity. Weekly summary digest.
- **Findings**: Filterable list of all findings across agents. Approve/dismiss/acknowledge actions. Drill-down to agent session replay.
- **Configuration**: Per-agent schedule, scope, and threshold configuration. Enable/disable individual agents. Override default schedules.

This is the single surface where the platform owner spends their 30–60 minutes per week reviewing agent output and approving recommended actions.

---

## 12. The Standalone Test

Covers Principle, Why This Matters for EveryStack, Applying the Test, Relationship to Integration Skills.
Touches `query_aggregate` tables. See `ai-skills-architecture.md`, `sync-health-patterns.md`, `security-monitoring.md`.

### Principle

Every Tier 1 skill — whether user-facing or platform maintenance — must produce useful output when given representative data as plain text input, with zero tool calls available. If disconnecting all MCP servers and disabling all tools makes a skill non-functional, the skill has conflated knowledge with execution and needs to be restructured.

This principle is adapted from the emerging pattern in production AI agent systems where practitioners have found that the most robust architectures maintain a clean separation: skills encode *what to know and how to reason*, tools handle *what to do*. The knowledge layer survives independently of the execution layer.

### Why This Matters for EveryStack

**Testability without infrastructure.** A skill that passes the standalone test can be evaluated with a simple prompt: paste in sample data, load the skill, and check whether the AI produces a correct analysis. No agent runtime, no database connections, no BullMQ worker needed. This makes the eval suite for skills dramatically cheaper and faster to run — critical for the Skill Maintenance Agent's weekly improvement cycle (`ai-skills-architecture.md` §9).

**Resilience during partial failures.** If the `query_aggregate` tool fails mid-run for the Sync Health Agent, the agent's reasoning quality shouldn't collapse. With a skill that passes the standalone test, the agent can still interpret whatever data it already has in working memory. The tool failure degrades the agent's *reach* (it can't fetch more data) but not its *judgment* (it still knows how to interpret sync failures).

**Skill quality signal.** A skill that cannot pass the standalone test is likely encoding execution logic (API call sequences, parameter construction) rather than domain knowledge (pattern interpretation, decision trees, classification rules). This is a design smell — the execution logic belongs in tool definitions or in the agent's planning phase, not baked into the skill.

### Applying the Test

For each Tier 1 platform maintenance skill, the standalone test works as follows:

| Skill | Standalone Input | Expected Output Without Tools |
|-------|-----------------|-------------------------------|
| `sync-health-patterns.md` | Pasted table of sync failure counts by error code and platform | Correct classification (systemic vs per-tenant), severity assessment, recommended investigation steps |
| `security-monitoring.md` | Pasted auth log showing 150 failed portal login attempts from one IP range in 10 minutes | Correct identification as brute force pattern, severity: critical, recommended actions (IP block, tenant notification) |
| `tenant-health-signals.md` | Pasted table of tenant activity metrics (last login, automation runs, portal usage) | Correct churn risk scoring, identification of at-risk tenants, prioritized intervention list |
| `ai-quality-analysis.md` | Pasted ai_usage_log summary showing 23% regeneration rate on automation-builder skill | Correct root cause hypothesis, identification of affected task types, draft skill section update |
| `cost-economics.md` | Pasted credit consumption and provider cost data for 10 tenants | Correct margin calculations, identification of unsustainable tenants, pricing adjustment recommendations |

**Formal rule for skill authoring:** A Tier 1 skill is not ready for deployment until it passes the standalone test with ≥80% accuracy on a representative eval suite using only pasted data and zero tool access. This requirement applies to both initial skill creation and to updates produced by the Skill Maintenance Agent.

### Relationship to Integration Skills

For user-facing integration skills (`ai-skills-architecture.md` §5–6), the standalone test has an additional implication. An integration skill for HubSpot should help the AI correctly configure a webhook action (payload shape, auth headers, endpoint URL) even if the HubSpot MCP server is not connected. The skill degrades gracefully — less capability (no live API calls) but the reference knowledge for configuration tasks remains fully functional. This is already noted in `ai-skills-architecture.md` §6 ("a user who hasn't connected the HubSpot MCP server still gets value from the skill when configuring webhook automations") but the standalone test formalizes it as a testable quality gate rather than an aspirational design goal.

---

## 13. MCP Schema Suppression

Covers The Token Cost Problem, The Suppression Strategy, Context Builder Change, Impact, Relationship to Token Budget Allocator.
See `ai-skills-architecture.md`.

### The Token Cost Problem

When an agent connects to an external MCP server, the naive approach loads the server's full tool schema into the context window. Popular MCP servers expose dozens of tools with detailed JSON Schema parameter definitions. A single MCP server can consume 20,000–50,000 tokens of context window budget just for its tool descriptions. An agent connecting to multiple external services (Slack, HubSpot, Google Analytics, Stripe) could burn 100,000–200,000 tokens on tool schemas before processing a single user request.

EveryStack's integration skills already solve the knowledge side of this problem — the Airtable integration skill teaches the AI what tools exist, what the common query patterns are, and how response data maps to EveryStack field types. But without explicit schema suppression, the system could still load both the skill AND the full MCP schema, wasting the token savings the skill was designed to provide.

### The Suppression Strategy

When an integration skill is loaded for a given MCP server, the Context Builder should **not** also load that server's full tool schema into the prompt. Instead:

1. **Skill provides tool awareness.** The integration skill's `full` condensation level already lists the MCP server's tools, their purposes, required vs optional parameters, and common usage patterns. The AI knows which tools to call and how to call them from the skill alone.

2. **Schema is resolved on demand.** When the agent decides to call a specific MCP tool (during the act phase of the execution loop), the tool registry fetches that single tool's JSON Schema for parameter validation. This is a runtime operation, not a context window cost.

3. **Fallback for unknown tools.** If the agent encounters a use case not covered by the skill (the user asks about an obscure MCP endpoint), the Context Builder can load the schema for that specific tool on demand into a follow-up reasoning step. The cost is one tool's schema (~500–2,000 tokens), not the entire server's catalog.

### Context Builder Change

Extend the skill-aware loading logic from `ai-skills-architecture.md` §4:

```
Current (with MCP, no suppression):
  Load integration skill (500 tokens) + Load full MCP schema (25,000 tokens) = 25,500 tokens

Proposed (with suppression):
  Load integration skill (500 tokens) + Defer schema to tool-call time = 500 tokens
  Per tool call: resolve single tool schema (~500 tokens, not in main prompt)
```

Implementation: Add a `suppressMcpSchema: boolean` flag to `SkillDocument` metadata for integration skills. When true and the skill is loaded, the Context Builder skips the MCP server's tool schema during prompt assembly. The tool registry still has access to schemas at call time for parameter validation.

```yaml
---
id: google-analytics
version: 3
domain:
  - conversation
  - summarize
skillTier: integration
mcpServerUrl: "https://ga.mcp.example.com/sse"
suppressMcpSchema: true          # Context Builder skips this server's schema when skill is loaded
lastVerified: "2026-03-01"
externalApiVersion: "GA4 Data API v1"
---
```

### Impact

For platform maintenance agents, this matters less in the near term (they mostly use internal tools with known, stable schemas). For user-facing agents connecting to multiple external MCP servers post-MVP, the savings are substantial — potentially reclaiming 100,000+ tokens of context window budget per session. This budget can be redirected to SDS schema context, conversation history, or deeper reasoning.

### Relationship to Token Budget Allocator

The token budget allocator (`ai-skills-architecture.md` §4) already prioritizes skill loading over schema loading. MCP schema suppression makes this priority operational: when a skill is loaded for an integration, the schema's budget allocation drops to zero (deferred to runtime). The freed budget flows to the next priority tier (SDS schema or conversation history).

---

## 14. Pre-Agent Operator Skills

Covers The Near-Term Opportunity, The Operator Skill Catalog, How They're Used (Pre-Agent), Evolution Path, Storage and Conventions.
Touches `workspace_memberships`, `ai_usage_log`, `automation_runs`, `ai_credit_ledger` tables. See `incident-response.md`, `tenant-intervention.md`, `pricing-review.md`.

### The Near-Term Opportunity

The agent runtime is post-MVP. But the knowledge encoded in Tier 1 platform maintenance skills is valuable *now* — as reference documents that the platform owner loads into Claude Code when doing manual operational work. This is the same pattern used for build playbooks (structured prompts for Claude Code), extended to platform operations.

A set of "operator skills" can deliver value immediately, months before the agent runtime ships. When the agent runtime does ship, these operator skills evolve directly into the Tier 1 skills for platform maintenance agents — the knowledge is identical, only the consumer changes from "founder + Claude Code" to "autonomous agent."

### The Operator Skill Catalog

These files live in `docs/operations/` and follow the same Markdown structure as agent skills (though without the YAML frontmatter metadata until they're promoted to agent skills):

**`incident-response.md`** — How to diagnose and respond to platform incidents. Covers: sync outage triage (which tables to query, what patterns indicate provider vs platform issues), tenant communication templates for different severity levels, escalation steps, post-incident review checklist. When loaded into Claude Code during an incident, the AI immediately knows the diagnostic methodology instead of the founder re-explaining it each time.

**`tenant-intervention.md`** — How to assess and help a struggling tenant. Covers: which metrics to pull from `workspace_memberships`, `ai_usage_log`, and `automation_runs` to build a tenant health picture, how to identify the tenant's "stuck point," outreach message templates calibrated by situation (churn risk, onboarding friction, feature confusion), follow-up cadence. Evolves into the Tenant Success Agent's Tier 1 skill.

**`pricing-review.md`** — How to evaluate AI credit pricing sustainability. Covers: queries to run against `ai_usage_log` and `ai_credit_ledger` for per-tenant margin calculation, how to interpret the results, thresholds that indicate pricing problems, adjustment methodology. Evolves into the Revenue Agent's Tier 1 skill.

**`deploy-verification.md`** — Post-deploy verification checklist. Covers: RLS policy verification steps, critical path smoke tests, what Sentry error patterns to watch for in the first 30 minutes, how to correlate new errors with the deploy, rollback criteria. Evolves into the Ops Intelligence Agent's post-deploy event trigger logic.

**`security-review.md`** — Periodic security review playbook. Covers: how to audit portal session hygiene, API key rotation status, OAuth token health across sync connections, dependency vulnerability posture check. Evolves into the Security Agent's Tier 1 skill.

**`sync-troubleshooting.md`** — How to diagnose sync issues reported by tenants. Covers: the 8 error categories from `sync-engine.md`, diagnostic queries for each category, how to distinguish tenant misconfiguration from platform issues, resolution steps by category. Evolves into the Sync Health Agent's Tier 1 skill.

### How They're Used (Pre-Agent)

The platform owner loads an operator skill into Claude Code when doing ops work:

```
# In Claude Code, during a sync outage:
> Load docs/operations/sync-troubleshooting.md and help me diagnose
> what's happening. Here's what I see in the sync_failures table...
```

Claude Code immediately has the diagnostic methodology, the failure taxonomy, and the decision tree for determining root cause. The founder doesn't re-explain how EveryStack's sync engine works or what the error categories mean. The AI goes straight to productive analysis — the same token savings that skills provide for agents, but for a human-in-the-loop workflow.

### Evolution Path

When the agent runtime ships, each operator skill gains YAML frontmatter, three condensation levels, and a `skillTier: platform-maintenance` designation. The content is already battle-tested from months of manual use. The founder knows which sections are essential (standard condensation), which are helpful but optional (full), and which are the bare minimum (minimal) — because they've been using the skills and naturally discovered which parts they always need versus which they skip.

This evolution path means Tier 1 platform maintenance skills aren't written cold when agents ship. They're refined versions of documents that have been in active use, with real operational feedback baked in. The standalone test (§12) is naturally validated: if the founder has been using the skill with pasted data in Claude Code for months, it already works without tools.

### Storage and Conventions

| Attribute | Value |
|-----------|-------|
| Location | `docs/operations/` |
| Format | Markdown, no YAML frontmatter (added when promoted to agent skill) |
| Naming | Descriptive: `incident-response.md`, `sync-troubleshooting.md` |
| Version control | Same as all `docs/` files — git, PR review |
| Cross-reference | Add to MANIFEST.md under a new "Operations" section |
| Phase | Can be created now — no dependency on agent runtime, AI infrastructure, or any specific build phase |
