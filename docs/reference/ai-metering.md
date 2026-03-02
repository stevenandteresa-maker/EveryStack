# EveryStack — AI Usage Metering, Logging & Admin Dashboard

> **Glossary Reconciliation — 2026-02-27**
> Aligned with `GLOSSARY.md` (source of truth). Changes:
>
> - "Portal Builder | Block designer, drag-drop, data binding" → split into MVP (Portal = externally-shared Record View) and post-MVP (App Designer). Block designer/drag-drop is App Designer (post-MVP).
> - "Communications Hub" → "Record Thread & Chat" (glossary naming discipline — "Communications Hub" is a banned term)
> - "Visual builder" for Automations → "Step-by-step list builder" (glossary: MVP automations are linear, no visual canvas)
> - "Smart Docs" → "Smart Doc" (singular, matches glossary table_type wiki default view)
> - "Interface Designer" → "App Designer" in agent session cost estimates
> - Tagged post-MVP features: formula engine, guide mode, cross-base analysis (DuckDB), live chat AI, document intelligence AI operations, agent sessions
> - `portal_suggest` → `app_suggest` (App Designer is post-MVP; portals MVP don't need AI generation)
> - `guide_mode` feature enum → tagged post-MVP

> **Reference doc (Tier 3).** AI independence guarantee, rate card, model routing, credit budgets, metering flow, admin dashboard, user usage view, daily caps, alerts, reconciliation, data retention, pre-launch testing framework.
> Cross-references: `ai-architecture.md` (provider adapters, capability tiers, prompt registry, fallback chains), `CLAUDE.md` (pricing table with credits per tier), `data-model.md` (ai_usage_log, ai_credit_ledger, ai_daily_caps schema), `command-bar.md` (AI credit costs per Command Bar action), `ai-field-agents-ref.md` (per-agent token tracking, credit checks before execution, BYOK bypass), `chart-blocks.md` (Admin AI Dashboard chart rendering — usage trend charts, cost breakdown visualizations, agent dashboard integration), `document-intelligence.md` (Document Intelligence feature category — 6 operations with credit costs: metadata/content extraction free, scanned PDF OCR 2-5/page, vision analysis 1-2/image, document-to-record extraction 3-5/doc, version comparison 2-3/comparison; dashboard subcategories: OCR, Vision Analysis, Extraction, Version Comparison)
> Implements: `packages/shared/ai/CLAUDE.md` (metering flow architecture, AIService wrapper)
> Cross-references (cont.): `gaps/knowledge-base-live-chat-ai.md` (Live Chat AI Responses feature category — standard tier, 1–3 credits per response; no credits for embedding visitor message or low-confidence routing; metered as "Live Chat AI Responses" in Settings > AI Usage)
> Last updated: 2026-02-27 — Glossary reconciliation (naming, MVP scope tagging).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                 | Lines   | Covers                                                                                     |
| --------------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| AI Independence Guarantee               | 43–82   | Zero-AI core workflows (14 categories), AI feature degradation behavior                    |
| Anthropic API Pricing Reference         | 84–115  | Model cost table, 5 cost reduction mechanisms (caching, Haiku routing, batching)           |
| AI Usage Logging Infrastructure         | 117–165 | `ai_usage_log` schema, cost calculation formula                                            |
| Credit Budget & Metering System         | 167–212 | Credit definition ($0.01 = 1 credit), tier budgets, `ai_credit_ledger`, metering flow      |
| Workspace Admin AI Dashboard            | 214–242 | Settings → AI Usage, overview panel, per-user/feature breakdowns, admin controls           |
| User-Facing AI Usage View               | 244–256 | Personal usage view, daily cap indicator                                                   |
| Pre-Launch Usage Testing Framework      | 258–281 | 13-feature test matrix (small/medium/large context), test procedure                        |
| Internal Cost Monitoring                | 283–302 | Per-tenant margin dashboard, platform-wide economics, anomaly alerts                       |
| AIService Wrapper Implementation        | 304–337 | Interface contract, 6-step execution flow, single entry point for all AI calls             |
| Reconciliation & Integrity              | 339–357 | Daily reconciliation job, Anthropic invoice reconciliation, data retention policy          |
| Agent Session Metering                  | 359–421 | Credit integration, session cost estimates, plan limits, self-hosted cost model, dashboard |
| Implementation Phasing & AIFeature Enum | 423–438 | MVP/post-MVP phase table, 13 AIFeature enum values                                         |

---

## 1. AI Independence Guarantee

Every feature in EveryStack falls into one of two categories: core workflow functions that operate with zero AI dependency, and AI-enhanced features that add convenience but are never required.

> **Core Design Principle: AI-capable, never AI-dependent. Every workflow must function fully without AI. AI enhances but never gates.**

### 1.1 Core Workflows — Zero AI Required

The following features function identically whether AI credits are available or exhausted:

| Feature Area         | Core Function                                       | AI Enhancement (Optional)                       | MVP Status                                                           |
| -------------------- | --------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| Cross-Base Linking   | Postgres FK joins, manual link creation             | AI suggests likely link fields based on naming  | **MVP**                                                              |
| Sync Engine          | API adapters, diff/upsert, scheduled sync           | None — fully deterministic                      | **MVP**                                                              |
| Table Grid & Views   | CRUD, filtering, sorting, grouping                  | Natural language filter builder                 | **MVP**                                                              |
| Portals (Quick)      | Externally-shared Record View, single record, auth  | AI suggests field layout from schema            | **MVP** (Quick Portal = Record View with auth)                       |
| App Designer         | Block designer, drag-drop, data binding             | AI suggests layout from schema                  | **Post-MVP** (App Designer is post-MVP per glossary)                 |
| Doc Generation       | Merge-tag templates + Gotenberg, PDF output         | AI drafts template placeholder suggestions      | **MVP**                                                              |
| Smart Doc            | TipTap editor, wiki pages, manual authoring         | AI writing assist, summarization                | **Post-MVP** (Wiki / Knowledge Base is post-MVP per glossary)        |
| Automations          | Step-by-step list builder: trigger → action config  | "Describe what you want" → AI drafts automation | **MVP** (linear flows, no visual canvas)                             |
| Record Thread & Chat | Record-scoped comments, DMs, @mentions, assignments | AI thread summarization                         | **MVP** (Record Thread) / **Post-MVP** (full thread & chat features) |
| Outbound Email       | Compose UI, templates, merge fields                 | AI drafts email body from context               | **MVP**                                                              |
| Formula Engine       | User writes formulas, deterministic eval            | AI suggests formulas from description           | **Post-MVP** (formula engine is post-MVP per glossary)               |
| Permissions & Roles  | Role matrix, field-level access control             | None — fully deterministic                      | **MVP**                                                              |
| Search / Command Bar | Fuzzy text search across records and entities       | Natural language queries, AI answers            | **MVP**                                                              |

> **Implementation Rule: No feature may be shipped where the primary workflow requires AI to function. AI is always the enhancement layer.**

### 1.2 AI Feature Degradation Behavior

When a workspace exhausts its AI credit budget:

- All core workflows continue functioning with zero degradation.
- AI-enhanced controls show a subtle disabled state with tooltip: "AI credits exhausted — resets [date]. Manual controls available."
- Command Bar search falls back to fuzzy text search only. The search bar itself never disappears.
- Automation builder reverts to manual-only mode. The "Describe what you want" input is disabled; the step-by-step list builder works normally.
- Smart Doc editor disables AI slash commands (/summarize, /draft, /expand). Manual editing and all formatting tools remain active. _(Smart Doc is post-MVP — wiki / knowledge base deferred per glossary.)_
- No pop-ups, modals, or blocking upgrade prompts. Degradation is quiet and non-disruptive.

---

## 2. Anthropic API Pricing Reference

Current Claude API pricing as of February 2026. All rates are pay-as-you-go per million tokens (MTok).

| Model      | Input (per MTok) | Output (per MTok) | Cache Write | Cache Read |
| ---------- | ---------------- | ----------------- | ----------- | ---------- |
| Haiku 4.5  | $1.00            | $5.00             | $1.25       | $0.10      |
| Sonnet 4.5 | $3.00            | $15.00            | $3.75       | $0.30      |
| Opus 4.5   | $5.00            | $25.00            | $6.25       | $0.50      |

### 2.1 Cost Reduction Mechanisms

**Prompt Caching (90% input savings):** System prompts, table schemas, and workspace context are identical across calls from the same workspace. By caching these input tokens, cache reads cost 10% of base input price.

**Batch API (50% discount):** Non-interactive AI tasks (automation suggestions, bulk record analysis, scheduled AI reports) can be submitted via the Batch API for a flat 50% discount. Delivery guaranteed within 24 hours.

**Intelligent Model Routing:** Users never choose a model. EveryStack routes internally based on task complexity. This is the single most important cost control lever.

| Task Category                       | Routed Model | Rationale                                                 | MVP Status                                      |
| ----------------------------------- | ------------ | --------------------------------------------------------- | ----------------------------------------------- |
| Command Bar quick lookup            | Haiku 4.5    | Low token volume, speed-critical, simple pattern matching | **MVP**                                         |
| Formula suggestion                  | Haiku 4.5    | Small context window, structured output                   | **Post-MVP** (formula engine deferred)          |
| Record summarization                | Haiku 4.5    | Moderate context, standardized output format              | **MVP**                                         |
| Email draft from context            | Sonnet 4.5   | Needs nuance and tone awareness                           | **MVP**                                         |
| Automation builder from description | Sonnet 4.5   | Multi-step reasoning, structured JSON output              | **MVP**                                         |
| Cross-base analysis                 | Sonnet 4.5   | Large context window, relational reasoning                | **Post-MVP** (DuckDB analytical layer deferred) |
| Guide Mode (multi-step)             | Sonnet 4.5   | Conversational, iterative, needs planning                 | **Post-MVP**                                    |
| Complex data modeling advice        | Opus 4.5     | Deep reasoning, architectural decisions (rare)            | **Post-MVP**                                    |

Expected model mix: approximately 50–60% Haiku, 35–45% Sonnet, and 2–5% Opus by call volume.

---

## 3. AI Usage Logging Infrastructure

### 3.1 Database Schema — `ai_usage_log`

Every AI API call is logged to a dedicated table immediately after the Anthropic API response is received. This is the single source of truth for all metering, billing, and admin reporting.

| Column           | Type                                | Description                                                                                                |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| id               | UUID PK                             |                                                                                                            |
| tenant_id        | UUID FK → tenants                   | Workspace that owns this usage                                                                             |
| user_id          | UUID FK → users                     | Individual user who triggered the AI call                                                                  |
| feature          | VARCHAR(64)                         | Enum: command_bar, formula_suggest, email_draft, automation_build, etc.                                    |
| model            | VARCHAR(32)                         | Actual model used: haiku-4.5, sonnet-4.5, opus-4.5                                                         |
| input_tokens     | INTEGER                             | Total input tokens billed (excluding cached)                                                               |
| output_tokens    | INTEGER                             | Total output tokens billed                                                                                 |
| cached_input     | INTEGER (default 0)                 | Input tokens served from prompt cache (billed at 10% rate)                                                 |
| cost_usd         | NUMERIC(10,6)                       | Exact dollar cost computed from rate card formula                                                          |
| credits_charged  | NUMERIC(10,2)                       | Credits deducted from workspace budget. 1 credit = $0.01                                                   |
| request_id       | VARCHAR(128) nullable               | Anthropic API request ID for debugging and reconciliation                                                  |
| duration_ms      | INTEGER nullable                    | End-to-end latency of the API call                                                                         |
| status           | VARCHAR(16) (default 'success')     | success, error, timeout, rate_limited                                                                      |
| error_code       | VARCHAR(64) nullable                | Anthropic error code if status != success. No credits charged for errors.                                  |
| metadata         | JSONB (default {})                  | Flexible context: { table_ids, record_count, prompt_template, ... }                                        |
| agent_session_id | UUID FK → agent_sessions (nullable) | Links AI calls to agent sessions (post-MVP). Enables per-session cost tracking. See agent-architecture.md. |
| created_at       | TIMESTAMPTZ                         |                                                                                                            |

**Indexes:** `(tenant_id, created_at)`, `(user_id, created_at)`, `(tenant_id, feature, created_at)`. Time-partitioned monthly.

> **Error Handling: If the Anthropic API returns an error (status != success), the call is logged with the error status but zero credits are charged. This prevents budget drain from API outages.**

### 3.3 Cost Calculation Formula

```typescript
const RATES = {
  'haiku-4.5': { input: 0.000001, output: 0.000005, cache_read: 0.0000001 },
  'sonnet-4.5': { input: 0.000003, output: 0.000015, cache_read: 0.0000003 },
  'opus-4.5': { input: 0.000005, output: 0.000025, cache_read: 0.0000005 },
};

function calculateCost(model, inputTokens, outputTokens, cachedInput) {
  const r = RATES[model];
  return inputTokens * r.input + cachedInput * r.cache_read + outputTokens * r.output;
}

// Credits: 1 credit = $0.01
const credits = Math.ceil(costUsd * 100);
```

---

## 4. Credit Budget & Metering System

### 4.1 Credit Definition

1 AI credit = $0.01 of actual Anthropic API spend. Pass-through cost model with a defined ceiling per tier. The workspace is never billed overages — AI features gracefully disable when the budget is consumed.

### 4.2 Monthly Credit Budgets by Tier

| Tier         | Price | Monthly AI Credits | Equivalent USD | AI as % of Sub |
| ------------ | ----- | ------------------ | -------------- | -------------- |
| Freelancer   | $29   | 200                | $2.00          | 6.9%           |
| Starter      | $79   | 800                | $8.00          | 10.1%          |
| Professional | $149  | 2,500              | $25.00         | 16.8%          |
| Business     | $299  | 7,500              | $75.00         | 25.1%          |
| Enterprise   | $499+ | 20,000             | $200.00        | 40.1%          |

AI budget as a percentage of subscription intentionally increases at higher tiers. Larger workspaces have more users and more data surface area for AI features.

### 4.3 Credit Tracking Table — `ai_credit_ledger`

| Column            | Type                                                      | Purpose              |
| ----------------- | --------------------------------------------------------- | -------------------- |
| id                | UUID PK                                                   |                      |
| tenant_id         | UUID FK → tenants                                         |                      |
| period_start      | DATE                                                      | Billing period start |
| period_end        | DATE                                                      | Billing period end   |
| credits_total     | INTEGER                                                   | From plan tier       |
| credits_used      | NUMERIC(10,2) (default 0)                                 | Running total        |
| credits_remaining | GENERATED (credits_total - credits_used)                  | Computed column      |
| usage_pct         | GENERATED (ROUND(credits_used / credits_total \* 100, 1)) | Computed column      |
| updated_at        | TIMESTAMPTZ                                               |                      |

**Unique index:** `(tenant_id, period_start)`. One row per tenant per billing period.

### 4.4 Metering Flow

The AIService wrapper executes this sequence on every AI call:

1. **Pre-check:** Query ai_credit_ledger for current period. If credits_remaining < 1, reject immediately. No API call is made.
2. **Execute:** Send request to Anthropic API with prompt caching enabled. Receive response with usage tokens.
3. **Calculate:** Compute cost_usd using rate card formula. Convert to credits_charged (cost_usd × 100, rounded up).
4. **Log:** INSERT into ai_usage_log with all fields populated.
5. **Deduct:** UPDATE ai_credit_ledger SET credits_used = credits_used + credits_charged. Atomic operation.
6. **Alert:** If usage_pct crosses 80% or 95% threshold, fire notification to workspace admin(s).

---

## 5. Workspace Admin AI Dashboard

**Location:** Settings → AI Usage. **Access:** Owner and Admin roles only.

### 5.1 Dashboard Overview Panel

**Workspace Budget Card:** Visual progress bar (credits used / credits total with percentage). Color coding: green (0–70%), amber (70–90%), red (90–100%). Text: "1,847 / 2,500 credits used (73.9%) — Resets March 1". Estimated days remaining based on rolling 7-day average daily burn rate. Comparison to last month: "↑15% vs. January".

### 5.2 Per-User Breakdown

Primary tool for admins to identify usage patterns and users who may need training. Columns: User, Role, Credits Used, % of Total, Calls, Avg Cr/Call, Top Feature. Sorted by credits used descending.

### 5.3 Per-Feature Breakdown

Columns: Feature, Credits Used, % Budget, Total Calls, Avg Cost/Call, Avg Tokens/Call. Sorted by credits used descending.

**Document Intelligence (post-MVP for AI-powered operations)** appears as a top-level feature category with four subcategories: OCR (scanned PDF text extraction, 2–5 credits/page), Vision Analysis (image description + tagging, 1–2 credits/image), Extraction (document-to-record field mapping, 3–5 credits/doc), and Version Comparison (asset version AI diff, 2–3 credits/comparison). Metadata extraction and text-based content extraction (PDF, DOCX, XLSX) are free and do not appear in credit tracking. See `document-intelligence.md` > Section 9: AI Credit Costs.

**Live Chat AI Responses (post-MVP — live chat widget is post-MVP per glossary)** appears as a top-level feature category. Each AI-generated response to a visitor question consumes 1–3 credits (standard capability tier — short responses grounded in retrieved knowledge base content). Embedding the visitor message is free (platform infrastructure). Routing to a human agent when confidence is below threshold consumes no credits (no LLM call). Agent-assist mode (AI suggests answers in agent sidebar) consumes the same credits as auto-reply. Usage appears in Settings > AI Usage as "Live Chat AI Responses." See `gaps/knowledge-base-live-chat-ai.md` > AI Credit Cost.

### 5.4 Admin Controls

**Per-User Daily Caps (Optional):** Default: no per-user cap (workspace budget is shared pool). Configurable: admin can set a daily cap per user or per role. Example: "Team Members limited to 20 credits/day, Managers unlimited." Override: admin can grant a temporary daily allowance increase for a specific user.

**Usage Alerts:** Workspace budget 80% consumed → email notification to all admins. Workspace budget 95% consumed → email + in-app banner for admins. Workspace budget 100% consumed → in-app notification to all users that AI features are paused until reset. Per-user spike: if any single user consumes >30% of monthly budget in 24 hours, admin receives alert.

**Usage Export:** CSV export of full ai_usage_log for the billing period, filterable by user, feature, date range. Useful for internal chargeback, team retrospectives, and cost allocation.

---

## 6. User-Facing AI Usage View

Each individual user sees a simplified view of their own AI consumption. Promotes self-awareness without creating anxiety or competitive dynamics.

**What each user sees:** Their own credit usage this period (not other users'). Workspace budget status: progress bar showing overall workspace remaining (not per-user breakdown). Their most-used AI features this month. If a per-user daily cap is active: their remaining daily allowance.

**What users do NOT see:** Other users' individual consumption. Ranking or leaderboard. Cost in dollars (only credits). Model routing decisions (users never see "Haiku" or "Sonnet").

---

## 7. Pre-Launch Usage Testing Framework

Before setting final credit budgets, run systematic tests to establish real per-feature cost baselines.

### 7.1 Test Matrix

| Feature             | Small Context             | Medium Context             | Large Context            | MVP Status                                      |
| ------------------- | ------------------------- | -------------------------- | ------------------------ | ----------------------------------------------- |
| command_bar         | 1 table, 5 fields         | 5 tables, 30 fields        | 15 tables, 100 fields    | **MVP**                                         |
| formula_suggest     | Single table, 3 fields    | Single table, 15 fields    | Cross-base, 30 fields    | **Post-MVP**                                    |
| email_draft         | 1 record context          | 5 records + thread history | 20 records + attachments | **MVP**                                         |
| automation_build    | Simple 1-trigger/1-action | 3-step linear flow         | Complex multi-step       | **MVP** (linear only; branching post-MVP)       |
| cross_base_analysis | 2 bases, 1K records       | 5 bases, 10K records       | 10 bases, 50K records    | **Post-MVP** (DuckDB analytical layer deferred) |
| guide_mode          | Single question           | 3-turn conversation        | 10-turn with context     | **Post-MVP**                                    |
| doc_assist          | Short paragraph           | Full page draft            | Multi-section document   | **MVP** (Document AI Draft)                     |
| record_summary      | 5 fields                  | 15 fields + linked records | 30 fields + history      | **MVP**                                         |

### 7.2 Test Procedure

1. For each cell in the matrix: Run 30 iterations with representative real-world data.
2. Log: input_tokens, output_tokens, cached_input_tokens, model, duration_ms, cost_usd for every call.
3. Compute: P50, P90, and P99 cost per call for each feature at each context size.
4. Model the monthly budget: Estimate expected feature mix and daily call volume per tier. Multiply by P90 cost.
5. Compare to credit budgets: If projected monthly spend exceeds budget, adjust routing (e.g., move feature from Sonnet to Haiku).

> **Critical: Run Tests With Caching Enabled. Test with prompt caching active to get realistic cost figures. Without caching, costs will be 5–10x higher and budgets will appear insufficient.**

---

## 8. Internal Cost Monitoring (Platform Admin)

Separate from the workspace admin dashboard, the EveryStack platform team needs an internal view of AI cost health across all tenants.

### 8.1 Per-Tenant Margin Dashboard

For each tenant: monthly subscription revenue vs. actual AI API spend. AI cost as percentage of subscription — flag any tenant exceeding 50%. Top 10 tenants by absolute AI spend. Top 10 tenants by AI cost as % of subscription (margin risk list).

### 8.2 Platform-Wide AI Economics

Total monthly Anthropic API spend across all tenants. Blended cost per credit (should track close to $0.01; if higher, caching or routing needs optimization). Model mix breakdown: % of calls and % of cost per model. Cache hit rate (target: >60% of input tokens served from cache). Feature cost ranking: which features consume the most total API spend.

### 8.3 Anomaly Alerts

- Any single tenant whose daily AI spend exceeds their monthly credit budget ÷ 15 (burning at 2x sustainable rate)
- Any feature whose average cost per call increases by >25% week-over-week (possible prompt regression or context bloat)
- Platform cache hit rate drops below 40% (possible infrastructure issue)
- Any model routing mismatch: Opus calls exceeding 10% of total volume

---

## 9. AIService Wrapper Implementation

The AIService class is the single entry point for all AI calls in the platform. No code should call the Anthropic SDK directly.

### 9.1 Interface Contract

```typescript
interface AIServiceRequest {
  tenantId: string;
  userId: string;
  feature: AIFeature;
  prompt: string;
  context?: {
    tableSchemas?: TableSchema[];
    recordSample?: Record[];
    conversationHistory?: Message[];
  };
}

interface AIServiceResponse {
  success: boolean;
  content?: string;
  creditsCharged: number;
  creditsRemaining: number;
  budgetExhausted?: boolean;
  error?: string;
}
```

### 9.2 Execution Flow

8-step metering sequence (see Section 4.4). On API error: log with `status='error'`, charge zero credits. On budget exhaustion: return `{ success: false, budgetExhausted: true, creditsCharged: 0 }`. On daily cap reached: return `{ success: false, error: 'daily_cap_reached' }`.

---

## 10. Reconciliation & Integrity

### 10.1 Daily Reconciliation Job

Scheduled nightly. Compares `ai_credit_ledger.credits_used` against `SUM(ai_usage_log.credits_charged)` for each tenant. Any discrepancy greater than 0.5 credits is flagged for investigation.

### 10.2 Anthropic Invoice Reconciliation

Monthly. Compare total `cost_usd` in `ai_usage_log` against the Anthropic API invoice. Any discrepancy greater than 1% is investigated. Common causes: rounding differences, token count estimation drift.

### 10.3 Data Retention

- `ai_usage_log`: Retained for 13 months (current + 12 months history). Aggregated to daily summaries after 13 months.
- `ai_credit_ledger`: Retained indefinitely (one row per tenant per billing period).
- Daily aggregates: Retained for 3 years for trend analysis.

> **Reminder: AI-Capable, Never AI-Dependent. This entire metering system exists to manage an enhancement layer. If it breaks, AI features should fail closed (disable gracefully), not bring down core platform functionality.**

---

## 11. Agent Session Metering

> **Post-MVP.** AI Agents (autonomous multi-step) are explicitly post-MVP per glossary. Agent session metering ships with the agent runtime.
>
> Full agent architecture: `agent-architecture.md`

### 11.1 Credit Integration

Agent sessions are meta-tasks that generate many individual AI API calls. The metering integration:

- **Every AI call from an agent goes through the standard 6-step metering flow.** No bypass. Pre-check → execute → log → deduct. The existing pipeline handles agents without modification.
- **`ai_usage_log.agent_session_id`** (nullable UUID FK → `agent_sessions`) links each AI call to its parent agent session. This enables "show me total cost of this agent task" queries.
- **Agent sessions have a `budget_credits` ceiling** in their `AgentConfig`. The agent loop checks remaining budget (via Redis `agent:budget:{sessionId}` for fast reads) before each reasoning step. If budget exhausted → session pauses, does not terminate.
- **When workspace credits exhausted**, active agent sessions are paused (not terminated) — they resume when credits reset or are topped up. Same graceful degradation as one-shot AI features.

### 11.2 Agent Session Cost Estimates

Typical agent session costs (with prompt caching enabled):

| Session Type                       | Estimated AI Calls | Estimated Credits | Notes                               |
| ---------------------------------- | ------------------ | ----------------- | ----------------------------------- |
| Simple query/analysis (2–3 calls)  | 2–3                | 4–6               | Workspace Assistant, read-only      |
| Data cleanup batch (10–15 calls)   | 10–15              | 15–25             | Data Steward, medium writes         |
| Automation building (8–12 calls)   | 8–12               | 20–35             | Automation Builder, plan + generate |
| App generation (15–20 calls)       | 15–20              | 30–45             | App Designer AI, full layout        |
| Workspace onboarding (20–25 calls) | 20–25              | 40–60             | Onboarding Agent, high write volume |

**Agents cost 5–50x a single AI call** depending on complexity. However, value-per-credit is dramatically higher — an agent session that builds a complete automation in 5 minutes replaces 45 minutes of manual work.

**Cost lever:** Anthropic Batch API (50% discount) for non-interactive agent steps (planning, background analysis, summaries). Could reduce a 24-credit session to ~19 credits.

### 11.3 Plan Limits for Agents

| Plan         | Max Concurrent Agents | Max Sessions/Month | Max Session Duration |
| ------------ | --------------------- | ------------------ | -------------------- |
| Freelancer   | 1                     | 20                 | 10 min               |
| Starter      | 2                     | 100                | 15 min               |
| Professional | 3                     | 500                | 30 min               |
| Business     | 5                     | 2,000              | 60 min               |
| Enterprise   | 10                    | Custom             | Custom               |

Concurrent agent limit prevents runaway resource consumption. Monthly session limit prevents cost surprises. Agents consume credits from the same workspace AI credit pool (no separate agent pool).

### 11.4 Self-Hosted Cost Model

> **Post-MVP.** Self-hosted AI and data residency are post-MVP per glossary.

For enterprise deployments using self-hosted inference (see `self-hosted-ai.md`):

- **`calculateCost()` in `self-hosted.ts`** computes credits based on GPU-seconds or a fixed per-token rate configured by the deployment.
- Self-hosted inference costs may be zero to the tenant (customer pays for GPU infrastructure). Credit tracking still applies for usage reporting and session budgeting.
- Hybrid routing: calls to cloud API are metered at standard rates; calls to self-hosted are metered at the configured self-hosted rate.

### 11.5 Agent Dashboard Integration

The Admin AI Dashboard (Section 5) extends with agent-specific views:

- **Agent sessions tab:** list of recent sessions with goal, outcome, credits consumed, duration
- **Per-agent-type breakdown:** which agent types consume the most credits
- **Session detail view:** step-by-step credit consumption, reasoning trace link
- **Weekly digest:** "Agents modified X records, sent Y emails, used Z credits this week"

---

## Implementation Phasing

| Phase                                                         | What Ships                                                                                                                                                                                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation (Foundation)**                             | `ai_usage_log` + `ai_credit_ledger` schema (incl. `agent_session_id` nullable FK on `ai_usage_log`), AIFeature enum, rate card (`rates.ts`), cost calculator, AIService metering wrapper (6-step flow), `agent_sessions` table (empty schema) |
| **Post-MVP — Comms & Polish (Record Thread & Chat + Polish)** | Admin AI dashboard (Settings → AI Usage), user personal usage view, daily caps (`ai_daily_caps`), alerts, CSV export, reconciliation job, retention job                                                                                       |
| **Post-MVP (Post-MVP — AI Agents)**                           | Agent session metering flow (budget ceiling, Redis fast-read tally, pause-on-exhaust), agent dashboard tab, per-session cost tracking, weekly agent digest                                                                                    |
| **Post-MVP (Post-MVP — Self-Hosted AI)**                      | Self-hosted cost model (`calculateCost()` for GPU-seconds), hybrid routing metering (different rates per provider)                                                                                                                            |

---

## AIFeature Enum (13 values)

`command_bar`, `formula_suggest` _(post-MVP)_, `email_draft`, `automation_build`, `cross_base_analysis` _(post-MVP)_, `guide_mode` _(post-MVP)_, `doc_assist`, `record_summary`, `app_suggest` _(post-MVP — App Designer AI)_, `thread_summary`, `agent_planning` _(post-MVP)_, `agent_tool_selection` _(post-MVP)_, `agent_observation` _(post-MVP)_

Defined in `packages/shared/src/types/ai-features.ts`. Extensible — new features add enum values and routing entries. Agent-prefixed features are used for AI calls within agent sessions (always paired with `agent_session_id` on `ai_usage_log`).
