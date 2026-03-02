# AI Agent Architecture Foundations

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) This entire doc is **post-MVP** per glossary ("AI Agents (autonomous multi-step) | Post-MVP") — added scope header. Phase integration section (2.11) describes schema prep work in earlier phases, which is acceptable as foundation work. (2) Renamed "Interface Designer" agent type → "App Designer" agent per glossary naming discipline ("Interface Designer" → App Designer). (3) Replaced `update_interface_config` tool → `update_app_config` per glossary. (4) Replaced "interface layouts" → "App layouts", "interface builder" → "App Designer" per glossary. (5) Replaced "Comms Hub" → "Record Thread / Chat" per glossary naming discipline ("Communications Hub" → Record Thread or Chat). (6) Replaced "Smart Docs" → "Document Templates" for report-building context per glossary document terminology.

> **Reference doc (Tier 3). Post-MVP scope — AI Agents are explicitly excluded from MVP per glossary.** Strategic analysis of existing agent-ready infrastructure (Part 1) and foundational additions needed for agent deployment (Part 2): agent identity & delegation, execution runtime, memory system, tiered approval model, tool expansion, safety framework, observability, agent types, data model, metering, and phase integration.
> Cross-references: `ai-architecture.md` (provider adapters, capability tiers, tool definitions, MCP), `ai-metering.md` (credit budgets, metering flow, agent session metering), `self-hosted-ai.md` (enterprise air-gapped deployment), `automations.md` (execution engine, checkpointing, chain depth), `permissions.md` (RBAC, field-level resolution), `vector-embeddings.md` (context builder, semantic retrieval), `schema-descriptor-service.md` (structured schema discovery — agents are primary consumers), `duckdb-context-layer-ref.md` (analytical query execution — agents generate QueryPlans for cross-base analysis), `ai-field-agents-ref.md` (AI Field Agents — field-level LLM agents with cross-base awareness, shares trigger/execution patterns), `accounting-integration.md` (Report Builder agent financial tools — monthly strategy sessions, scenario analysis with financial_summary data), `approval-workflows.md` (generic record approval system — distinct from agent approval gates; agent approvals concern action permissions/risk tiers, record approvals concern lifecycle state transitions)
> Implements: `packages/shared/ai/CLAUDE.md` (agent rules), `apps/worker/CLAUDE.md` (agent execution queue)
> Cross-references (cont.): `gaps/knowledge-base-live-chat-ai.md` (`workspace_knowledge` is agent-to-agent institutional memory — distinct from customer-facing knowledge base which serves Live Chat AI auto-responses and public help centers via wiki tables)
> Last updated: 2026-02-27 — Glossary reconciliation. Prior: 2026-02-21 — Added `gaps/knowledge-base-live-chat-ai.md` cross-reference (workspace_knowledge disambiguation).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Part 1: What You Already Have (And Why It Matters for Agents) | 25–132 | Existing infrastructure (AIService, SDS, BullMQ, permissions) that agents build on |
| Part 2: What Needs to Change or Be Added | 133–623 | AgentSession, AgentScope, execution runtime, 3-layer memory, 5-tier approval, safety framework, 8 agent types |
| Summary: The 30-Second Version | 624–636 | Quick reference for the full agent architecture |

---

## Part 1: What You Already Have (And Why It Matters for Agents)

Your AI architecture is significantly more agent-ready than a typical "bolt-on AI" platform. Here's a genuine assessment of what's already in place, why each piece matters for agents specifically, and where each piece falls short.

---

### 1.1 Provider Adapter + Capability Tier Routing

**What's planned:** `AIProviderAdapter` interface with `fast`/`standard`/`advanced` tiers. Feature code never references providers or models. `FEATURE_ROUTING` maps task types to tiers, `CAPABILITY_ROUTING` maps tiers to providers.

**Why it matters for agents:** An agent performing a multi-step task will use different capability tiers *within the same task*. Intent classification for a sub-step → `fast`. Planning the next action → `standard`. Generating a complex automation from natural language → `advanced`. The tier abstraction means the agent orchestrator can route each reasoning step appropriately without coupling to models.

**Where it falls short:** The current routing is a static map — `FEATURE_ROUTING[taskType] → tier`. Agents need *dynamic* tier selection within a single execution based on the complexity of what they're reasoning about at that moment. A "build me an automation" agent might start at `standard` for planning, realize the logic is genuinely complex, and escalate to `advanced` mid-task. The routing layer needs to support this kind of adaptive escalation, not just fixed task-to-tier mapping.

---

### 1.2 Tool Definition System

**What's planned:** `ToolDefinition` with JSON Schema parameters, pure function handlers, required permissions, and provider-agnostic compilation. Tools include: search records, query tables, resolve cross-links, trigger commands, create records, generate documents, get field definitions, list tables. Already MCP-compatible.

**Why it matters for agents:** Agents are, at their core, a reasoning loop that calls tools. Your tool registry IS the agent's action space. The fact that tools are already permission-gated (`requiredPermissions: Permission[]`), schema-validated (JSON Schema), and transport-agnostic (works for internal AI, MCP server, and MCP client) means agents get a well-defined, secure action space for free.

**Where it falls short:** The current tool set is designed for user-facing AI assistance — search, read, create. Agents need *operational* tools that the current set doesn't include: modify automation configs, manage portal settings, update field definitions, manage user tasks, send messages on behalf of users, schedule future actions, and critically — tools for *self-management* (checkpoint own state, request human approval, spawn sub-tasks). The tool registry architecture is sound; the tool catalog needs a significant expansion for agents.

---

### 1.3 Permission-Scoped AI

**What's planned:** Every AI call passes through RBAC middleware. The Command Bar sends a permission envelope with every request: `user_id`, `workspace_id`, `role`, `base_permissions[]`, `table_permissions[]`. The AI context provider is pre-filtered — the AI doesn't even see entities the user can't access. Every AI-executed action is logged under the user's identity, not "AI user."

**Why it matters for agents:** This is perhaps the most important existing foundation. The principle that "AI operates with the user's permissions, not its own" is exactly right for agents. An agent acting on behalf of a Team Member must never see or modify data that Team Member can't access. The field-level permission resolution (read-write / read-only / hidden) gives agents properly granular boundaries.

**Where it falls short:** The current model is "AI inherits user's full permissions." Agents need a *further-scoped* delegation model — a Manager might want to deploy an agent that can only operate on one specific table, or can read broadly but only write to specific fields. Think of it like creating an API key with a subset of your permissions. The permission envelope needs to support "user permissions ∩ agent scope restrictions."

---

### 1.4 BullMQ Execution Infrastructure

**What's planned:** Worker service with priority scheduling (P0–P3), checkpointing (resume from last completed step on crash), idempotency keys (`{executionId}:{stepIndex}`), configurable retry with exponential backoff, 5-minute total timeout, graceful shutdown on SIGTERM, traceId/tenantId binding via AsyncLocalStorage.

**Why it matters for agents:** Long-running agent tasks need exactly this infrastructure — queued execution, crash recovery, progress tracking, and timeout enforcement. The automation execution engine's sequential pipeline with checkpointing is structurally close to what an agent execution loop needs.

**Where it falls short:** The automation engine runs a *predetermined* step sequence. Agents don't have a predetermined sequence — they plan, act, observe the result, and decide the next step dynamically. The execution model needs to support an *open-ended loop* that the agent controls, not a static pipeline the builder defined. Also, the 5-minute total timeout is far too short for many agent tasks (a "clean up and reorganize this entire base's field naming conventions" agent might run for 30+ minutes).

---

### 1.5 Audit Trail + AI Usage Logging

**What's planned:** `audit_log` with `actor_type` (user / sync / automation / portal_client / system) + `actor_id`, covering every state-changing operation. `ai_usage_log` tracking every AI call with feature, model, tokens, cost, credits, and duration. Both feed into compliance and the admin dashboard.

**Why it matters for agents:** The five-source attribution model already solved the hard conceptual problem of "who did this." Adding `agent` as a sixth `actor_type` is a schema-level addition, not an architecture change. The `ai_usage_log` already tracks cost per call — agents just generate more calls per logical task.

**Where it falls short:** An agent generates a *sequence* of related actions that constitute a single logical task. The current audit log captures each mutation independently. There's no way to see "these 14 record updates and 3 email sends were all part of Agent Task #xyz." You need a concept of an **agent session** that groups related audit entries and AI usage entries into a single traceable unit of work. The `trace_id` correlation partially does this, but it's per-request, not per-agent-task.

---

### 1.6 Automations Engine

**What's planned:** 12 triggers, 30 actions, 5 conditions, sequential execution with conditional branching, template resolution engine (`{{trigger.record.fields.X}}`), execution context passing between steps, chain depth protection (≤5), deduplication, rate limiting, lifecycle workflows with Wait for Event, global exit conditions.

**Why it matters for agents:** The automations engine and agents share a LOT of DNA. They both execute multi-step workflows, need error handling strategies, carry context between steps, interact with records/email/webhooks, and need safety rails (chain depth limits, rate caps, timeouts). Critically, your template resolution engine — the ability to reference outputs of previous steps via `{{step_N.output.fieldName}}` — is essentially a simple form of agent working memory.

**Where it falls short:** Automations are *rigid flows* defined at build time. An agent's "steps" are *emergent* — decided at runtime by the LLM. The automation builder creates a static DAG; an agent creates its plan on the fly. The execution engine needs to support both paradigms, and ideally agents should be able to *use* automations as tools (e.g., "trigger the client onboarding automation for this new record").

---

### 1.7 Vector/Semantic Layer + Context Builder

**What's planned:** pgvector embeddings for tables, fields, records, and portal content. Context Builder assembles relevant schema + sample data within a token budget using semantic retrieval. Hybrid search (keyword + semantic) with RRF merging in the Command Bar. Graceful fallback to heuristic selection when embeddings unavailable.

**Why it matters for agents:** Agents operating on a workspace with 30+ tables and hundreds of fields need to understand what's relevant to their task. The Context Builder solves the "needle in a haystack" problem — given a goal like "find all overdue invoices and email the clients," the semantic layer identifies which tables, fields, and records are relevant without the agent needing to enumerate everything.

**Where it falls short:** The Context Builder is optimized for single-turn queries. An agent working on a multi-step task needs *progressive context refinement* — it discovers new relevant context as it works. Step 1 might reveal that "invoices" are linked to "projects" which are linked to "clients," and the agent needs to pull in the project and client schemas that weren't in the initial retrieval. The Context Builder needs to support incremental context expansion across an agent's execution. The Schema Descriptor Service (`schema-descriptor-service.md`) partially addresses this: its `describe_table()` drill-down and `link_graph` traversal map enable agents to progressively discover schema as they work, rather than requiring all context up front.

---

### 1.8 MCP Compatibility

**What's planned:** EveryStack as MCP Server (Post-MVP — Automations) exposes internal tools via MCP protocol. EveryStack as MCP Client (Post-MVP — Self-Hosted AI) consumes external MCP servers for user-connected tools (Slack, GitHub, Calendar). Tool definitions are already MCP-compatible.

**Why it matters for agents:** MCP is the natural protocol for agent-tool communication. An EveryStack agent that can call both internal tools (search records, create records) and external tools (post to Slack, create GitHub issue, schedule calendar event) via the same unified tool interface becomes dramatically more useful. MCP Client is arguably more important for agents than MCP Server.

**Where it falls short:** The MCP Client is deferred to Post-MVP — Self-Hosted AI (post-MVP). For agents to be genuinely useful, they need access to external tools earlier. Consider pulling core MCP Client capability forward — even if limited to a few key integrations (Slack, email, calendar) — when you ship agents.

---

### 1.9 User Review Loop ("AI Never Auto-Applies")

**What's planned:** Hard rule in `packages/shared/ai/CLAUDE.md`: "AI never auto-applies changes. Draft → preview/diff → user accepts, modifies, or regenerates."

**Why this needs to evolve for agents:** This rule makes sense for one-shot AI assistance (draft an email, suggest a formula). It breaks down for agents. An agent tasked with "clean up duplicate contacts across all our tables" that requires human approval for each of 200 deduplication merges is useless — the whole point is autonomous execution. But an agent that silently deletes records without any oversight is terrifying.

The resolution is a **tiered approval model** based on action risk, not a blanket "always confirm" or "never confirm." This is the single biggest philosophical shift from current AI to agents.

---

### 1.10 The "AI-Capable, Not AI-Dependent" Principle

**What's planned:** Every feature works fully without AI. AI enhances but never gates. When credits are exhausted, all core workflows continue with quiet, non-disruptive degradation.

**Why it matters for agents:** This principle should absolutely extend to agents. An agent that fails mid-task must leave the workspace in a consistent state. Agent-created automations must be editable in the visual builder. Agent-generated App layouts must be modifiable by hand. The agent is a power tool, not a dependency.

**Where it's already right:** No changes needed to this principle. If anything, it becomes MORE important with agents — the blast radius of an agent failure is larger than a single AI call failure.

---

---

## Part 2: What Needs to Change or Be Added

These are the foundational architectural additions, ordered roughly by how foundational they are (build the bottom layers first).

---

### 2.1 Agent Identity & Delegation Model

**The problem:** The current `actor_type` enum is `user | sync | automation | portal_client | system`. Agents need to be a first-class actor type with a clear delegation chain — "this agent is acting on behalf of User X, with scope Y."

**What to add:**

```
actor_type: 'agent'
actor_id:   → agent_session_id (the specific execution)
```

**Agent Session as the core identity:**

```typescript
interface AgentSession {
  id: string;                          // UUID — the agent execution identity
  tenant_id: string;
  delegating_user_id: string;          // Who authorized this agent
  agent_type: string;                  // 'workspace_assistant' | 'automation_builder' | 'data_cleanup' | ...
  scope: AgentScope;                   // Permission boundaries (see below)
  status: 'planning' | 'executing' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
  goal: string;                        // Natural language description of the task
  plan: AgentPlan | null;              // Current execution plan (updated as agent works)
  config: AgentConfig;                 // Approval mode, budget limits, timeout
  started_at: Date;
  completed_at: Date | null;
  parent_session_id: string | null;    // For sub-agents spawned by a parent agent
}
```

**AgentScope — Permission narrowing:**

```typescript
interface AgentScope {
  // Agent permissions = user permissions ∩ these constraints
  allowed_tables: string[] | 'all';          // Which tables the agent can access
  allowed_operations: ('read' | 'create' | 'update' | 'delete')[];
  allowed_tools: string[] | 'all';           // Which tools from the registry
  max_mutations: number;                     // Hard cap on write operations
  max_records_affected: number;              // Hard cap on records touched
  restricted_fields?: Record<string, 'hidden' | 'read_only'>;  // Further field restrictions
}
```

**Why this matters:** The delegation chain (user → agent → actions) is what makes agent activity auditable, revocable, and scope-limited. Every mutation the agent performs flows through the same RBAC middleware as user actions, but with the intersection of user permissions and agent scope.

**Schema change:** Add `'agent'` to `actor_type` in `audit_log`. New `agent_sessions` table.

---

### 2.2 Agent Execution Runtime

**The problem:** The automation engine runs a static pipeline. AI calls are one-shot request/response. Neither supports the core agent pattern: **plan → act → observe → re-plan → repeat**.

**What to add — the Agent Loop:**

```
User provides goal
  → Create AgentSession (status: 'planning')
  → Agent reasons about the goal with workspace context (Context Builder)
  → Agent produces a Plan: ordered list of intended steps
  → If approval_mode requires it: pause for user review of plan
  → For each step in plan:
      → Check: has the plan been invalidated by observed results?
        → If yes: re-plan from current state
      → Check: does this step require approval? (based on action risk tier)
        → If yes: pause, notify user, wait
      → Execute step (via tool call through existing tool registry)
      → Observe result: capture output, check for errors
      → Update working memory with result
      → Check: are we done? Has the goal been achieved?
        → If yes: complete session
      → Check: budget/timeout/mutation limits exceeded?
        → If yes: pause and report to user
  → Session complete → final summary → user notification
```

**Key difference from automations:** The agent loop is *open-ended* — the number and sequence of steps isn't predetermined. The agent decides what to do next based on what it's observed so far. This is a fundamentally different execution model from the automation engine's sequential pipeline, but it can and should run on the same BullMQ infrastructure.

**Implementation approach:** A new job type `agent.execute` in the worker, with its own processor. The processor implements the loop above. Each iteration of the loop is a checkpoint — if the worker crashes, it resumes from the last completed step (exactly like automation checkpointing today).

**Timeout policy for agents:**

| Scope | Limit | Rationale |
|-------|-------|-----------|
| Single tool call | 30s | Same as automation step timeout |
| Planning/reasoning step | 60s | LLM calls for complex reasoning |
| Total agent session | Configurable: 5min–60min | User sets based on task scope |
| Idle timeout (awaiting approval) | 24 hours | Don't hold resources indefinitely |

**Dynamic tier escalation within the agent loop:**

Unlike the static `FEATURE_ROUTING` map (see `ai-architecture.md` > Capability-Based Model Routing), the agent orchestrator selects capability tiers dynamically within a single execution:

```typescript
// Within the agent loop, each reasoning step selects its tier
const tier = agentRouter.selectTier({
  phase: 'planning' | 'tool_selection' | 'observation_analysis' | 'replanning',
  complexity: estimatedComplexity,     // heuristic from task context
  previous_errors: errorCount,         // escalate after failures
  remaining_budget: creditsLeft,       // downgrade if budget tight
});
```

This extends `ai-architecture.md` > Capability-Based Model Routing with an agent-specific adaptive routing layer.

---

### 2.3 Agent Memory System

**The problem:** Current AI calls are stateless. Command Bar sessions store conversation history, but there's no structured memory that persists across steps within an agent task, or across agent tasks over time.

**Three layers of agent memory:**

**Layer 1 — Working Memory (within a single agent session):**

This already has a partial analog in the automation execution context's `stepOutputs: Map<string, StepOutput>`. For agents, extend this to a richer structure:

```typescript
interface AgentWorkingMemory {
  goal: string;                                    // The original task description
  plan: AgentStep[];                               // Current plan (mutable — agent can re-plan)
  completed_steps: CompletedStep[];                // What's been done + results
  discovered_context: Record<string, unknown>;     // Schema/data learned during execution
  observations: string[];                          // Natural language notes the agent leaves for itself
  active_entities: {                               // Records/tables the agent is currently working with
    tables: string[];
    records: string[];
    cross_links: string[];
  };
}
```

Stored in the `agent_sessions.working_memory` JSONB column. Updated after each step. This is the agent's "scratchpad."

**Layer 2 — Episodic Memory (across agent sessions, per workspace):**

After an agent session completes, a summary is stored:

```typescript
interface AgentEpisode {
  session_id: string;
  tenant_id: string;
  agent_type: string;
  goal: string;
  outcome: 'success' | 'partial' | 'failed';
  summary: string;                    // AI-generated summary of what was done
  lessons: string[];                  // What went wrong, what was tricky
  entities_affected: string[];        // Table/record IDs touched
  created_at: Date;
}
```

Future agent sessions can query episodic memory: "Has an agent done something like this before in this workspace? What happened?" This prevents repeating mistakes and enables learning from past tasks. Embedded via pgvector for semantic retrieval.

**Layer 3 — Shared Knowledge (workspace-level, used by all agents):**

A persistent knowledge base about the workspace that all agents can read and contribute to:

- Table purposes and relationships (beyond schema — semantic understanding)
- Business rules discovered during agent tasks ("invoices over $10k need CFO approval")
- User preferences observed ("this workspace always uses Title Case for field names")
- Known data quality issues ("the 'Phone' field in Contacts has inconsistent formatting")

This is stored in a `workspace_knowledge` table, embedded for retrieval, and included in agent context when relevant. It's the closest thing to "institutional memory" — the agent equivalent of onboarding notes.

---

### 2.4 Tiered Approval Model

**The problem:** "AI never auto-applies" is too restrictive for agents. "AI always auto-applies" is too dangerous. You need a middle ground.

> **Distinction from record approval workflows:** The tiered approval model here governs *agent action permissions* — can the agent do X? The generic record approval system in `approval-workflows.md` governs *record lifecycle state transitions* — can this record advance past a gate? Different problem, different data model, different UX. These two systems do not overlap. See `approval-workflows.md` > Key Architectural Decisions > "Agent approval gates remain separate."

**Action risk tiers:**

| Risk Tier | Examples | Default Approval | Can Override? |
|-----------|---------|-----------------|---------------|
| **Read** | Search records, list tables, query data | None (auto-execute) | No — reads are always safe |
| **Low-risk write** | Update a field value, add a tag, set a status | Auto-execute with undo | Yes — Manager can require approval |
| **Medium-risk write** | Create records, send notifications, link records | Auto-execute with undo + summary | Yes — can escalate to approval-required |
| **High-risk write** | Delete records, send external emails, modify field definitions, trigger automations | Requires approval | Yes — Admin can downgrade to auto |
| **Structural** | Create/delete tables, modify permissions, change automation configs | Always requires approval | No — structural changes always need human review |

**Approval UX:**

When an agent hits an approval gate:
1. Agent session status → `awaiting_approval`
2. Push notification + in-app indicator to the delegating user
3. Approval card shows: what the agent wants to do, why (reasoning), what it's done so far, diff/preview of the change
4. User: Approve / Reject / Modify / Approve All Remaining (dangerous but available for trusted agents)
5. Agent resumes or re-plans based on response

**Configurable per agent deployment:**

```typescript
interface AgentConfig {
  approval_mode: 'supervised' | 'semi_autonomous' | 'autonomous';
  // supervised: approve every write
  // semi_autonomous: approve high-risk only (default)
  // autonomous: approve structural only

  max_auto_mutations: number;         // After N auto-approved writes, pause for checkpoint
  require_plan_approval: boolean;     // Must user approve the plan before execution starts?
  notify_on_completion: boolean;
  budget_credits: number;             // Max AI credits for this session
}
```

**Evolution of `packages/shared/ai/CLAUDE.md` rule 10:**

- **For one-shot AI assistance** (Command Bar, doc drafting, automation suggestions): Rule unchanged. "AI never auto-applies changes." Draft → preview/diff → user accepts.
- **For agent execution**: The tiered approval model above replaces the blanket rule. `AgentConfig.approval_mode` and action risk tiers govern whether each step requires approval. See `packages/shared/ai/CLAUDE.md` rules 10–11.

---

### 2.5 Agent-Specific Tool Expansion

**The problem:** The current tool catalog serves user-facing AI assistance. Agents need operational tools.

**New tool categories for agents:**

**Self-management tools (agents managing their own execution):**
- `request_approval` — pause and ask for human input on a specific decision
- `update_plan` — revise the execution plan based on new observations
- `checkpoint` — explicitly save current state (beyond automatic checkpointing)
- `spawn_sub_agent` — delegate a sub-task to a specialized agent (with chain depth protection, like automation chain depth ≤5)
- `report_progress` — send a status update to the delegating user
- `abort_with_reason` — gracefully terminate with explanation

**Schema/structural tools (for agents that manage workspace configuration):**
- `create_field` / `update_field` / `delete_field`
- `create_table` / `update_table`
- `update_view_config`
- `create_automation` / `update_automation` / `toggle_automation`
- `update_app_config`

**Communication tools:**
- `send_thread_message` — post to a thread on behalf of the user
- `create_notification` — notify specific users
- `send_email_draft` — stage an email for user review (not auto-send)

**Cross-entity tools:**
- `create_cross_link` / `remove_cross_link`
- `bulk_update_records` — batch operations with a single tool call
- `find_and_replace` — workspace-wide field value replacement

**Automation-as-tool:**
- `trigger_automation` — agents can invoke existing automations as tools
- `inspect_automation_history` — check if a relevant automation has already handled something

**MCP external tools (when MCP Client ships):**
- All connected MCP server tools are automatically available to agents
- Agent sees a unified tool list: internal EveryStack tools + external MCP tools

---

### 2.6 Agent Observability & Debugging

**The problem:** Current observability tracks requests and jobs. Agents need *reasoning traces* — not just "what happened" but "why the agent decided to do it."

**Agent trace structure:**

```typescript
interface AgentTraceStep {
  step_index: number;
  phase: 'planning' | 'tool_call' | 'observation' | 'replanning' | 'approval_wait';

  // What the agent was thinking
  reasoning: string;              // The LLM's reasoning (extracted from chain-of-thought)

  // What it decided to do
  action: {
    tool_name: string;
    parameters: Record<string, unknown>;
    risk_tier: 'read' | 'low' | 'medium' | 'high' | 'structural';
  } | null;                       // Null for planning/observation phases

  // What happened
  result: {
    success: boolean;
    output: unknown;
    error?: string;
  } | null;

  // Cost
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

**Agent debugging UI (for Admins/Managers):**

A "replay" view in the workspace admin panel showing:
- The agent's goal and initial plan
- Each step: what it decided, what it did, what it observed
- Decision points: why it chose action A over action B
- Approval gates: what was approved/rejected and by whom
- Cost breakdown: credits consumed per step, total
- Timeline: when each step happened, how long reasoning vs execution took
- Undo capability: revert all changes made by a specific agent session

This builds on the automation execution history UI (sidebar Tab 3 with canvas highlighting) — same concept, but with the addition of reasoning traces and dynamic plans.

---

### 2.7 Safety Framework

**The problem:** Agents have a larger blast radius than one-shot AI calls. A confused agent with write access can do real damage.

**Safety layers (defense in depth):**

**Layer 1 — Scope constraints (prevention):**
- `AgentScope` defines hard boundaries (tables, operations, field restrictions)
- `max_mutations` and `max_records_affected` are hard caps — agent session terminates if exceeded
- Budget ceiling in AI credits — agent can't burn unlimited credits on a confused reasoning loop

**Layer 2 — Action validation (detection):**
- Every tool call passes through RBAC middleware (existing)
- New: **pre-execution validation** — before executing a high-risk action, validate that the action is consistent with the stated goal. A "clean up field names" agent trying to delete records should trigger a safety alert.
- Schema validation of tool parameters (existing JSON Schema validation)

**Layer 3 — Rollback capability (recovery):**
- Agent sessions create a **change journal** — an ordered list of every mutation made, with before/after values
- "Undo agent session" reverses all changes in LIFO order
- For irreversible actions (sent emails, triggered webhooks), the change journal logs them as "non-reversible" so the user knows what can't be undone
- Change journal is essentially the audit log entries for this session, pre-linked for batch rollback

**Layer 4 — Circuit breakers (containment):**
- If an agent errors on 3 consecutive tool calls → auto-pause, notify user
- If an agent's reasoning loop doesn't make progress for 3 iterations → auto-pause
- If an agent exceeds its time budget → auto-pause (not terminate — user can extend)
- Re-entrant protection: same chain depth logic as automations (≤5) applies to agent → sub-agent spawning

**Layer 5 — Post-hoc review (audit):**
- Every agent session produces a completion summary
- High-mutation sessions (>20 writes) are flagged for admin review
- Weekly digest: "Agents in your workspace modified X records, sent Y emails, used Z credits this week"

---

### 2.8 Agent Types & Where They Deploy

Rather than a generic "agent" that does everything, plan for specialized agent types that map to your existing feature surfaces:

| Agent Type | Deployment Surface | Primary Tools | Approval Mode |
|-----------|-------------------|---------------|---------------|
| **Workspace Assistant** | Command Bar | search, query, read — answers questions, doesn't modify | Read-only (no approval needed) |
| **Data Steward** | Table settings / Command Bar | find_records, bulk_update, create_field, find_and_replace | Semi-autonomous |
| **Automation Builder** | Automation creation flow | create_automation, update_automation, inspect_automation_history | Plan approval required |
| **App Designer** | App Designer (Portals, Forms, Apps) | update_app_config, create_field, update_view_config | Plan approval required |
| **Onboarding Agent** | New workspace setup | create_table, create_field, create_automation, create_cross_link | Supervised |
| **Communication Drafter** | Record Thread / Chat / Email | search_records, send_email_draft, send_thread_message | Emails require approval |
| **Report Builder** | Document Templates / Portals | search_records, query_tables, generate_document | Semi-autonomous |
| **Data Import Agent** | Sync / CSV import | create_records, update_records, create_field, map_fields | Semi-autonomous with checkpoints |

Each agent type has a default `AgentConfig` and `AgentScope` that can be further restricted by the deploying user.

---

### 2.9 Data Model Additions

**New tables:**

| Table | Purpose |
|-------|---------|
| `agent_sessions` | Core agent execution tracking. One row per agent task. |
| `agent_steps` | Individual steps within a session (tool calls, reasoning phases, approval gates). |
| `agent_episodes` | Post-session summaries for episodic memory. Embedded via pgvector. |
| `workspace_knowledge` | Shared knowledge base entries. Embedded via pgvector. |
| `agent_approval_requests` | Pending approval gates. Links to notification system. |
| `agent_type_configs` | Per-workspace customization of agent type defaults (approval mode, scope overrides). |

**`agent_sessions` schema:**

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key — this is the `actor_id` in audit_log |
| `tenant_id` | UUID | Tenant scope |
| `delegating_user_id` | UUID | Who authorized this agent |
| `agent_type` | VARCHAR | Registered agent type key |
| `status` | VARCHAR | planning / executing / awaiting_approval / completed / failed / cancelled |
| `goal` | TEXT | Natural language task description |
| `config` | JSONB | AgentConfig (approval mode, budget, timeout) |
| `scope` | JSONB | AgentScope (table/operation/field restrictions) |
| `working_memory` | JSONB | Current working memory state |
| `plan` | JSONB | Current execution plan |
| `cost_credits` | NUMERIC | Total credits consumed so far |
| `mutations_count` | INTEGER | Total write operations performed |
| `parent_session_id` | UUID (nullable) | For sub-agent sessions |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ (nullable) | |
| `completion_summary` | TEXT (nullable) | AI-generated summary on completion |

**Changes to existing tables:**

| Table | Change |
|-------|--------|
| `audit_log.actor_type` | Add `'agent'` to enum. `actor_id` → `agent_sessions.id` |
| `ai_usage_log` | Add `agent_session_id` (nullable UUID). Links AI calls to agent sessions. |
| `notifications` | Add source types for agent approval requests and completions |

**Redis key patterns:**

| Pattern | Usage | TTL |
|---------|-------|-----|
| `agent:session:{sessionId}:lock` | Execution lock (one worker at a time) | Session duration + buffer |
| `agent:session:{sessionId}:heartbeat` | Liveness check — worker writes heartbeat | 30s (refreshed) |
| `agent:budget:{sessionId}` | Running credit tally (fast reads during execution) | Session duration |
| `agent:active:{tenantId}` | Set of currently running agent sessions per tenant | No TTL (managed) |

---

### 2.10 Metering & Plan Limits

**The problem:** AI metering tracks individual API calls. Agent sessions are *meta-tasks* that generate many API calls.

**Extension to existing metering:**

- Every AI call from an agent still goes through the standard metering flow (pre-check → execute → log → deduct). No bypass.
- `ai_usage_log` gets `agent_session_id` as a nullable FK. This enables "show me total cost of this agent task."
- Agent sessions have a `budget_credits` ceiling in their config. The agent loop checks remaining budget before each reasoning step.
- When workspace credits are exhausted, active agent sessions are paused (not terminated) — they resume when credits reset or are topped up.

**Plan limits:**

| Plan | Max Concurrent Agents | Max Agent Sessions/Month | Max Session Duration |
|------|----------------------|-------------------------|---------------------|
| Freelancer | 1 | 20 | 10 min |
| Starter | 2 | 100 | 15 min |
| Professional | 3 | 500 | 30 min |
| Business | 5 | 2,000 | 60 min |
| Enterprise | 10 | Custom | Custom |

Concurrent agent limit prevents runaway resource consumption. Monthly session limit prevents cost surprises.

---

### 2.11 Phase Integration

This is the critical question: when do you build what? Here's how agent foundations thread into your existing phase plan without derailing it.

| Phase | Agent Foundation Work |
|-------|---------------------|
| **MVP — Foundation (Foundation)** | Add `'agent'` to `actor_type` enum. Create `agent_sessions` table (empty). Define `AgentScope` and `AgentConfig` type interfaces in `packages/shared/types/`. Add `agent_session_id` nullable FK to `ai_usage_log`. This is schema prep — zero runtime code. |
| **MVP — Core UX (Core UX)** | When building Context Builder with semantic retrieval, design it to support incremental context expansion (not just single-shot retrieval). This serves agents later without changing the API. Ensure the tool registry supports dynamic tool set composition (agent gets a filtered tool list based on scope). |
| **Post-MVP — Automations (Automations)** | The automation execution engine's checkpointing, error handling, and chain depth protection are directly reusable. Build them as *reusable primitives* in `packages/shared/` rather than automation-specific code in `apps/worker/`. Also: implement `trigger_automation` as a tool in the tool registry — this is useful for Command Bar AI even before agents exist. |
| **Post-MVP — Comms & Polish (Comms + Polish)** | Notification infrastructure for approval gates. Agent sessions can use the same notification delivery (in-app + push + email digest) that automations and comms use. |
| **Post-MVP (Post-MVP — AI Agents)** | Agent execution runtime, memory system, approval model, safety framework, debugging UI, specialized agent types. This is where the bulk of agent-specific code lives — but the foundations from prior phases make it incremental, not a rewrite. |

---

### 2.12 Key Architectural Decisions to Make Now

These decisions have downstream implications and should be settled before MVP — Foundation code is written:

**1. Agent runtime: same worker or separate service?**

Recommendation: **Same worker service**, new BullMQ queue (`agent.execute`). Agents share the execution infrastructure (Redis, DB connections, rate limiting, observability) but have their own concurrency controls. A separate service adds deployment complexity for minimal benefit.

**2. Agent ↔ Automation relationship: are agents a superset?**

Recommendation: **Parallel, not hierarchical.** Automations are user-defined, deterministic, trigger-based flows. Agents are AI-driven, goal-directed, dynamic flows. They coexist and can call each other (agent triggers automation; automation action invokes agent). Neither subsumes the other. This preserves the "AI-capable, not AI-dependent" principle — automations work without AI, agents are the AI layer.

**3. Agent memory: in the DB or in the context window?**

Recommendation: **Both.** Working memory (current session state) lives in the `agent_sessions.working_memory` JSONB column and is loaded into the LLM context window at each reasoning step. Episodic memory and shared knowledge live in the DB with pgvector embeddings and are *selectively retrieved* into the context window based on relevance — same pattern as the Context Builder already uses for schema retrieval.

**4. Can agents create other agents?**

Recommendation: **Yes, with depth limits.** Same chain depth protection as automations (≤5). A "workspace reorganization" agent might spawn a "data cleanup" sub-agent for each table. Parent agent can only spawn agent types that are within its own scope. Parent session tracks child sessions via `parent_session_id`.

**5. How do agents interact with the real-time layer?**

Recommendation: **Agents publish events to Redis pub/sub like any other actor.** When an agent updates a record, the real-time service pushes the change to connected clients. Users see records updating "live" as the agent works — same UX as watching a collaborator edit. The agent's avatar/indicator in the presence system shows "Agent is working on this table."

---

## Summary: The 30-Second Version

**What you already have** that's agent-ready: provider abstraction, tool registry, permission-scoped AI, BullMQ execution infrastructure, audit trail with multi-source attribution, vector/semantic layer, MCP compatibility, and a strong "AI-capable not AI-dependent" philosophy.

**The five big things you need to add:**

1. **Agent Identity & Delegation** — agents as first-class actors with scoped permissions narrower than the delegating user
2. **Agent Execution Runtime** — an open-ended plan/act/observe loop (not a static pipeline) running on BullMQ with checkpointing
3. **Agent Memory** — working memory within tasks, episodic memory across tasks, shared workspace knowledge
4. **Tiered Approval Model** — replace "AI never auto-applies" with risk-based approval gates configurable per agent type
5. **Safety Framework** — scope constraints, action validation, rollback capability, circuit breakers, and post-hoc review

**What to do now (MVP — Foundation):** Add the `'agent'` actor type, create the `agent_sessions` schema, define the `AgentScope`/`AgentConfig` type interfaces, and add `agent_session_id` to `ai_usage_log`. Zero runtime code, pure schema preparation. Build the Context Builder with agent-ready extensibility points in MVP — Core UX, and extend the tool registry in Post-MVP — Automations. Build the actual agent runtime post-MVP on top of all these foundations.
