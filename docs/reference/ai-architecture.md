# AI Integration Architecture

> **Glossary Reconciliation — 2026-02-27**
> Aligned with `GLOSSARY.md` (source of truth). Changes:
>
> - "Interface/Portal Generation" → "App Generation" (post-MVP per glossary — App Designer is post-MVP)
> - "interface gen" / "generate_interface" → "app generation" / "generate_app" in descriptions and code identifiers
> - "Interface Designer" → "App Designer" (glossary naming discipline)
> - Clarified post-MVP scope on: AI Agents, self-hosted deployment, DuckDB Context Layer, vector embeddings, MCP client
> - Clarified that MVP automations use a step-by-step list builder (not visual canvas)
> - Updated cross-reference language to use glossary terms throughout

> Provider adapter interface, capability routing, prompt registry, tool definitions, evaluation framework, MCP, fallback chains, self-hosted readiness, Platform API external consumption.
> Cross-references: `agent-architecture.md`, `ai-metering.md`, `ai-data-contract.md`, `ai-field-agents-ref.md`, `accounting-integration.md` (Context Builder financial data sources — financial_summary, financial_snapshots feed AI weekly briefing and agent analysis), `gaps/knowledge-base-live-chat-ai.md` (Live Chat AI retrieval pipeline consumes provider abstraction for LLM response generation — standard capability tier, grounded context prompt), `platform-api.md` (AI API — external consumption of AIService via Platform API, prompt template registration, credit metering)
> Last updated: 2026-02-28 — Added Platform API external consumption section (§External Consumption via Platform API). Cross-reference to `platform-api.md`. Prior: 2026-02-27 Glossary reconciliation (naming, MVP scope tagging).

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                               | Lines   | Covers                                                                                       |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| Core Principle                        | 40–47   | Provider independence, Context Assembly → Prompt → AI Call → Output → Review → Apply pattern |
| AI Capabilities                       | 48–60   | Feature matrix with MVP status: Command Bar AI, App Gen, Doc Drafting, Automation Building   |
| Provider Adapter Interface            | 61–93   | AIProviderAdapter TypeScript interface, capabilities, config, auth, provider registration    |
| Capability-Based Model Routing        | 94–143  | 4 capability tiers (basic→specialized), model mapping, fallback chains, routing config       |
| Prompt Registry & Versioning          | 144–181 | Provider-agnostic templates, version-controlled, PromptTemplate interface, compiler pattern  |
| Tool Definition Abstraction           | 182–203 | ToolDefinition interface, parameter schemas, provider-specific compilation                   |
| Provider Evaluation Framework         | 204–233 | EvaluationCase interface, scoring, regression detection, provider comparison                 |
| Streaming Support                     | 234–241 | Vercel AI SDK SSE for interactive features, BullMQ worker for heavy tasks                    |
| Technical Architecture                | 242–250 | Context Builder, Structured Output, User Review Loop, Audit Trail                            |
| Agent Integration                     | 251–265 | Post-MVP agent hooks: schema, session tables, delegation model, nullable FKs                 |
| Self-Hosted LLM Deployment            | 266–296 | Post-MVP OpenAI-compatible adapter, vLLM/SGLang/Ollama, hybrid routing                       |
| MCP (Model Context Protocol)          | 297–326 | EveryStack as MCP Server and Client (post-MVP)                                               |
| External Consumption via Platform API | 327–348 | AI API endpoints, prompt template registration, credit metering for external consumers       |
| Self-Hosted LLM Readiness (Summary)   | 349–365 | Deployment requirements summary, reference to self-hosted-ai.md                              |
| Phase Implementation                  | 366–376 | Phase breakdown: MVP — Foundation through Post-MVP — Intelligence                            |

---

## Core Principle

**Complete provider independence.** Feature code never knows which AI provider or model is executing a request. The AIService abstraction is enforced — not aspirational. Every layer (prompts, tools, structured output, metering) is provider-agnostic, enabling provider switches, multi-provider operation, or in-house LLM deployment without modifying feature code.

**Pattern:** Context Assembly → Prompt Compilation → AI Call → Structured Output → User Review → Application.

---

## AI Capabilities

| Feature                       | Description                                                                  | MVP Status                              |
| ----------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- |
| Command Bar Conversational AI | Data querying, cross-link traversal, action suggestions. Primary AI surface. | **MVP**                                 |
| App Generation                | Schema analysis → infer visualizations → generate block tree                 | **Post-MVP** (App Designer is post-MVP) |
| Document Content Drafting     | AI content blocks generate contextual prose from record data                 | **MVP** (Document AI Draft)             |
| Automation Building           | Natural language to automation config. Highest-impact MVP AI feature.        | **MVP**                                 |
| Communication Drafting        | Draft contextual messages based on record data and history                   | **MVP** (Post-MVP — Comms & Polish)     |
| Document Review               | Consistency, tone, completeness checking                                     | **Post-MVP**                            |

---

## Provider Adapter Interface

```typescript
// packages/shared/ai/providers/adapter.ts
interface AIProviderAdapter {
  readonly providerId: string; // 'anthropic' | 'openai' | 'self-hosted'

  complete(request: CompiledAIRequest): Promise<AIResponse>;
  streamComplete(request: CompiledAIRequest): AsyncIterable<AIStreamChunk>;
  completeWithTools(request: CompiledAIRequest, tools: ToolDefinition[]): Promise<AIToolResponse>;
  supportedCapabilities(): ProviderCapabilities;
  calculateCost(usage: TokenUsage): CreditCost;
}

interface ProviderCapabilities {
  maxContextTokens: number;
  supportsStreaming: boolean;
  supportsToolUse: boolean;
  supportsPromptCaching: boolean;
  supportsBatchAPI: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
}
```

**Adding a new provider:** Implement this interface — one file, zero modifications to feature code, prompts, or tools. The adapter handles: API auth, request formatting, response normalization, error mapping, retry logic, cost calculation.

**Vision capability (`supportsVision`):** Used by document intelligence for image analysis, document OCR (scanned PDFs), and asset version comparison. Vision requests route only to providers where `supportsVision: true`. New task types: `document_extraction`, `vision_analysis`, `version_comparison`. See `document-intelligence.md`.

**Self-hosted LLM adapter (post-MVP):** Targets an internal inference endpoint (vLLM, TGI, Ollama). `calculateCost()` computes credits based on GPU-seconds. `supportedCapabilities()` informs routing about which tiers the model can serve. See glossary: "Self-hosted AI, data residency" is post-MVP.

---

## Capability-Based Model Routing

Feature code routes to **capability tiers**, never to providers or models.

| Tier       | Characteristics                               | Current Mapping | Use Cases                                                                                  |
| ---------- | --------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| `fast`     | Sub-second, low cost, simple tasks            | Claude Haiku    | Intent classification, autocomplete, summarization, notification digests, search ranking   |
| `standard` | Balanced latency/quality, streaming, tool use | Claude Sonnet   | Conversational AI, doc drafting, communication, schema suggestions, automation building    |
| `advanced` | Maximum reasoning, complex multi-step         | Claude Opus     | Complex automations, full app generation (post-MVP), cross-base analysis, advanced reports |

### Routing Configuration

```typescript
// packages/shared/ai/config/routing.ts
const CAPABILITY_ROUTING: Record<CapabilityTier, ProviderModelConfig> = {
  fast: { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' },
  standard: { providerId: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' },
  advanced: { providerId: 'anthropic', modelId: 'claude-opus-4-6' },
};

const FEATURE_ROUTING: Record<AITaskType, CapabilityTier> = {
  classify_intent: 'fast',
  summarize: 'fast',
  conversation: 'standard',
  draft_content: 'standard',
  draft_communication: 'standard',
  suggest_schema: 'standard',
  generate_automation: 'standard', // upgrades to 'advanced' for complex automations
  generate_app: 'advanced', // Post-MVP — App Designer AI generation
};
```

**Switching providers:** Update `CAPABILITY_ROUTING` — one config change, zero feature code changes. Run evaluation suite first.

**Hybrid routing (post-MVP):** Different tiers served by different providers. E.g., `fast` → self-hosted for lowest latency, `standard` → Anthropic, `advanced` → Anthropic Opus.

### Fallback Chains

```typescript
const FALLBACK_CHAIN: Record<CapabilityTier, ProviderModelConfig[]> = {
  fast: [
    ,/* primary */
    /* fallback 1 */
  ],
  standard: [
    ,/* primary */
    /* fallback 1 */
  ],
  advanced: [
    /* primary */
  ], // No fallback — fail gracefully
};
```

Explicit fallback, not automatic retry with different provider.

---

## Prompt Registry & Versioning

All prompts stored as **provider-agnostic templates** with a **provider-specific compiler** adapting them at call time.

```typescript
// packages/shared/ai/prompts/registry.ts
interface PromptTemplate {
  id: string; // 'automation_builder', 'document_draft', etc.
  version: number; // Monotonically increasing
  description: string;
  capabilityTier: 'fast' | 'standard' | 'advanced';
  systemInstruction: string; // Template with {{variables}}
  outputSchema: JSONSchema; // Expected output (Zod → JSON Schema)
  variables: VariableDefinition[];
  examples: PromptExample[]; // Few-shot pairs
  testedWith: TestedModel[]; // Validated provider+model combos
  createdAt: string;
  changelog: string;
}
```

### Provider-Specific Compilation

Each adapter includes `compilePrompt()` that transforms generic templates:

- **Anthropic:** Injects `cache_control: { type: 'ephemeral' }`, uses XML tags
- **OpenAI:** Uses `response_format: { type: 'json_schema' }`, adapts system message style
- **Self-hosted (post-MVP):** May inject more explicit formatting instructions

### Version Management Rules

1. Templates live in `/packages/shared/ai/prompts/templates/` as TypeScript files
2. Every change increments version + changelog
3. `testedWith` tracks validated provider+model combinations
4. Model upgrades require updating `CAPABILITY_ROUTING` and validating the full suite — never automatic
5. Rollback = decrement active version pointer in config

---

## Tool Definition Abstraction

```typescript
// packages/shared/ai/tools/registry.ts
interface ToolDefinition {
  name: string; // 'search_records', 'create_record', etc.
  description: string;
  parameters: JSONSchema; // Standard JSON Schema
  handler: (params: unknown) => Promise<ToolResult>;
  requiredPermissions: Permission[];
}
```

**Provider compilation:** Each adapter translates `ToolDefinition` to native format:

- Anthropic: `tools` array with `input_schema`
- OpenAI: `functions` array with `parameters`
- Self-hosted (post-MVP): Prompt-based tool use with structured output parsing as fallback

**Available tools:** search records, query tables, resolve cross-links, trigger commands, create records, generate documents, get field definitions, list tables.

---

## Provider Evaluation Framework

```typescript
// packages/shared/ai/evaluation/suite.ts
interface EvaluationCase {
  promptTemplateId: string;
  input: Record<string, unknown>;
  expectedOutput: unknown;
  assertions: Assertion[];
  humanReviewRequired: boolean;
}
```

### Evaluation Metrics (per template, per provider/model)

| Metric              | Description                                 |
| ------------------- | ------------------------------------------- |
| Schema compliance   | % outputs parsing against expected schema   |
| Assertion pass rate | % automated assertions passed               |
| Latency (p50, p95)  | Time to complete or TTFT                    |
| Token efficiency    | Average input + output tokens               |
| Cost per call       | Credits consumed per execution              |
| Tool use accuracy   | % valid, correctly parameterized tool calls |

**Passing threshold:** ≥95% schema compliance, ≥90% assertion pass rate.

**Shadow mode:** Run a percentage of production traffic through a secondary provider (log results without serving) to gather quality data before switching.

---

## Streaming Support

Interactive features (Command Bar AI, doc drafting) stream via **Vercel AI SDK** through SSE route handler (`/api/ai/chat/route.ts`). The Vercel AI SDK supports multiple providers — the AIService adapter feeds into it.

Heavy AI tasks (app generation (post-MVP), complex automations) run in the **worker service** via BullMQ, with completion via Redis pub/sub.

---

## Technical Architecture

- **Context Builder:** Packages schema, sample data, user intent, conversation history into prompts. Uses the **Schema Descriptor Service** (`schema-descriptor-service.md`) for structured, permission-filtered schema discovery. **Post-MVP:** pgvector semantic retrieval to select relevant tables/fields within a token budget (see `vector-embeddings.md` — vector embeddings / semantic search is post-MVP per glossary). Falls back to heuristic selection when embeddings unavailable. For analytical queries, the **DuckDB Context Layer** (`duckdb-context-layer-ref.md`) hydrates and aggregates data into concise results that fit in the context window. **Note:** DuckDB analytical layer is post-MVP per glossary.
- **Structured Output:** AI responses must match exact Zod schemas. Validation, retry on parse failure, error recovery. Adapters use native JSON mode where available. Values targeting record fields must then be coerced to canonical JSONB via the FieldTypeRegistry's `aiToCanonical()` before storage or application. See `ai-data-contract.md`. AI Field Agents (`ai-field-agents-ref.md`) are the primary consumer of this pipeline — Output Validator → `aiToCanonical()` → `validate()` → store.
- **User Review Loop:** AI never auto-applies changes. Draft → diff/preview → user accepts, modifies, or regenerates.
- **Audit Trail:** Every interaction stored: template ID + version, compiled prompt, response, provider, model, tokens, user action. `command_bar_sessions` for Command Bar; `ai_usage_log` for all calls (with optional `agent_session_id` FK for agent-initiated calls — see `agent-architecture.md`).

---

## Agent Integration

> **Post-MVP.** AI Agents (autonomous multi-step) are explicitly post-MVP per glossary. The architectural hooks (schema, type interfaces, nullable FKs) ship in MVP — Foundation to avoid migrations, but agent runtime is post-MVP.

Agents are AI-driven, goal-directed workflows that use the same AIService, tool registry, and metering infrastructure as one-shot AI features. The key architectural extensions:

- **Dynamic tier escalation:** Unlike the static `FEATURE_ROUTING` map, agent orchestrators select capability tiers dynamically within a single execution. Intent classification → `fast`, planning → `standard`, complex generation → `advanced`. The agent router can escalate mid-task based on complexity, error recovery, or budget constraints.
- **Tool set composition:** Agents receive a filtered tool list based on their `AgentScope` — a subset of the full tool registry. The tool registry supports dynamic composition at runtime, not just static registration.
- **Working memory as context:** Each agent reasoning step loads the session's working memory into the LLM context window alongside the Context Builder's schema retrieval. The Context Builder supports incremental expansion across steps (not just single-shot assembly).
- **Actor type:** Agents are a first-class `actor_type` in the audit log. Every agent mutation flows through the same RBAC middleware, with permissions = user permissions ∩ agent scope.

Full specification: `agent-architecture.md`.

---

## Self-Hosted LLM Deployment

> **Post-MVP.** Self-hosted AI and data residency are explicitly post-MVP per glossary. The adapter interface and `providerId: 'self-hosted'` union type ship in MVP — Foundation as extension points.

The `AIProviderAdapter` interface enables self-hosted deployment with zero feature code changes. The `self-hosted.ts` adapter targets an OpenAI-compatible inference endpoint (vLLM, SGLang, Ollama).

### Enterprise Air-Gapped Mode

All AI inference runs inside the customer's infrastructure. No API calls to external providers. The architecture:

```
Customer's VPC / Private Cloud
├─ EveryStack App + Worker + Real-Time
├─ PostgreSQL + pgvector + Redis
└─ vLLM/SGLang serving open-weight model (Qwen3, Apache 2.0)
   → self-hosted.ts adapter → internal HTTP endpoint
   → Same capability routing, prompts, tools, metering
```

### Hybrid Routing

Different tiers served by different backends. Typical configuration: `fast` → self-hosted (lowest latency, lowest cost), `standard` → Anthropic API, `advanced` → Anthropic Opus.

### Prompt Template Compilation for Self-Hosted Models

The provider-specific compiler in `prompts/compiler.ts` handles model-specific instruction formats (ChatML for Qwen3, custom templates for Llama, etc.). Prompt templates remain provider-agnostic. Run the evaluation suite against all templates before activating any self-hosted routing.

Full specification: `self-hosted-ai.md`.

---

## MCP (Model Context Protocol)

### EveryStack as MCP Server (Post-MVP — Automations)

Exposes EveryStack tools via MCP for external AI tools (Claude Desktop, ChatGPT, Cursor):

```
External AI tool → MCP protocol → EveryStack MCP Server
  → Authenticate (workspace-scoped API key)
  → Route to existing tool handlers in packages/shared/ai/tools/
  → Same tenant isolation as internal calls
```

Tool definitions are already MCP-compatible (JSON Schema parameters, structured results). The MCP layer is a thin translation. Auth via workspace-scoped API keys. Rate limited per key using same Redis token bucket. The Schema Descriptor Service (`schema-descriptor-service.md`) is a primary MCP tool candidate — its `describe_workspace`, `describe_table`, and `describe_links` endpoints let external AI agents discover and reason about EveryStack workspace structure.

### EveryStack as MCP Client (Post-MVP)

Consuming external MCP servers lets AI features interact with user tools (Slack, GitHub, Calendar):

```
AIService builds tool list = internal tools + connected MCP server tools
  → AI model calls a tool
  → Internal? → Route to packages/shared/ai/tools/
  → External MCP? → Route to MCP client → external server
```

Connections are per-user within a workspace. Credentials stored encrypted, scoped to `user_id + tenant_id`.

---

## External Consumption via Platform API

The AIService is consumable by external systems — branded verticals, third-party integrations, and customer scripts — through the Platform API's AI endpoints. This is separate from MCP (which exposes EveryStack tools to external AI agents); the AI API exposes EveryStack's AI infrastructure to external code.

**Endpoint:** `POST /api/v1/ai/complete`

**Two modes:**

1. **Prompt template mode** — caller specifies a registered `prompt_template_id` and `variables`. The AIService loads the template from the Prompt Registry, compiles it via the provider adapter, and returns structured output per the template's `outputSchema`. Templates can be EveryStack built-in or Tenant-scoped (registered by the vertical via `POST /api/v1/ai/prompt-templates`).

2. **Raw messages mode** — caller sends a `messages` array (same shape as the Anthropic Messages API) plus an optional `output_schema`. The AIService routes to the appropriate capability tier and provider, but the caller manages their own prompts.

**Metering:** All external AI calls are metered against the Tenant's `ai_credit_ledger`, identical to internal AI usage. Credits computed per `ai-metering.md` rate card. When credits are exhausted, the endpoint returns `422 AI_CREDITS_EXHAUSTED`. Usage logged to `ai_usage_log` with `feature: 'platform_api'`.

**Auth:** Requires API key with `ai:use` scope. Template registration requires `ai:use` + `admin`.

**Why this matters for verticals:** Domain services (assessment engines, recommendation systems, content generators) can use EveryStack's AIService without implementing their own provider integration. They get capability-based routing, automatic fallbacks, prompt caching, and credit metering for free. If EveryStack switches AI providers, vertical domain services are unaffected — the Platform API is the contract, not the underlying provider.

**Full specification:** `platform-api.md` §AI API.

---

## Self-Hosted LLM Readiness (Summary)

> **Post-MVP.** Full specification: `self-hosted-ai.md` — open-weight model strategy, hybrid routing, enterprise air-gapped deployment modes, security model, cost breakeven, licensing.

Deploying an in-house LLM requires only:

1. Implement `AIProviderAdapter` for the hosting infra (`self-hosted.ts` targeting OpenAI-compatible endpoint)
2. Implement `calculateCost()` for GPU-seconds/tokens
3. Write a prompt compiler for the model's instruction format in `prompts/compiler.ts`
4. Run evaluation suite against all templates (`npx eval --provider=self-hosted --all-templates`)
5. Update `CAPABILITY_ROUTING` to point tiers at the self-hosted adapter

No feature code changes. No prompt template changes. No tool definition changes. No metering logic changes.

**Enterprise air-gapped deployment:** All components (app, worker, real-time, database, inference) run inside the customer's VPC. Zero data leaves the trust boundary. See `self-hosted-ai.md` > Enterprise Air-Gapped Deployment.

---

## Phase Implementation

| Phase                                    | AI Work                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation                         | AIService skeleton, Anthropic adapter, `self-hosted.ts` adapter skeleton, prompt registry structure, capability routing config (incl. `'self-hosted'` in providerId union), tool definition schema, EmbeddingProvider interface, context-builder placeholder, metering flow, `agent_sessions` table (schema only), `AgentScope`/`AgentConfig` type interfaces, `agent_session_id` nullable FK on `ai_usage_log` |
| MVP — Core UX                            | Context Builder with heuristic schema retrieval (semantic retrieval via pgvector is post-MVP — see `vector-embeddings.md`), Command Bar AI, full tool suite, dynamic tool set composition                                                                                                                                                                                                                       |
| Post-MVP — Documents                     | Doc drafting AI (Document AI Draft), document review                                                                                                                                                                                                                                                                                                                                                            |
| Post-MVP — Automations                   | Automation building AI, MCP server MVP, `trigger_automation` tool in registry, reusable checkpointing/chain-depth primitives in `packages/shared/`                                                                                                                                                                                                                                                              |
| Post-MVP — Comms & Polish                | Communication drafting, AI polish, notification infrastructure for agent approval gates                                                                                                                                                                                                                                                                                                                         |
| **Post-MVP (Post-MVP — AI Agents)**      | Agent execution runtime, memory system, tiered approval model, safety framework, agent debugging UI, specialized agent types. See `agent-architecture.md`.                                                                                                                                                                                                                                                      |
| **Post-MVP (Post-MVP — Self-Hosted AI)** | MCP client, self-hosted model evaluation (Qwen3), prompt compiler for open-weight models, Helm chart, enterprise security documentation, hybrid routing activation. See `self-hosted-ai.md`.                                                                                                                                                                                                                    |
