# Phase 1H — AI Service Layer

## Phase Context

Covers What Has Been Built, What This Phase Delivers, What This Phase Does NOT Build, Architecture Patterns for This Phase, Mandatory Context for All Prompts, Skills for This Phase.
Touches `ai_usage_log`, `ai_credit_ledger`, `agent_sessions` tables.

### What Has Been Built
See `docs/skills/phase-context/SKILL.md` for the current build state. Key outputs from prior phases that this phase directly depends on:
- Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` (Phase 1A)
- Drizzle schema for all 50 MVP tables including `ai_usage_log`, `ai_credit_ledger`, and `agent_sessions` (Phase 1B)
- Pino structured logging with `traceId` via AsyncLocalStorage, OpenTelemetry instrumentation (Phase 1D)
- BullMQ worker skeleton with queue definitions — heavy AI tasks will route here (Phase 1G)
- `packages/shared/ai/` directory exists in the monorepo structure but is empty (Phase 1A scaffold)

### What This Phase Delivers
A complete, provider-independent AI service abstraction. When this phase is done, any feature in the codebase can request an AI capability (text generation, structured output, streaming, tool use) by specifying a capability tier (`fast`, `standard`, `advanced`) — without knowing which provider or model executes the request. The Anthropic Claude adapter is the first (and MVP-only) production adapter. The metering system tracks every AI call, calculates cost, deducts credits from the workspace budget, and alerts admins at threshold crossings. The AI data contract establishes the translation functions (`canonicalToAIContext` / `aiToCanonical`) that ensure AI reads and writes canonical JSONB — the same discipline applied to sync adapters.

### What This Phase Does NOT Build
- Agent runtime, agent execution, or agent UI (post-MVP — AI Agents are post-MVP per glossary)
- DuckDB Context Layer or analytical queries (post-MVP)
- Vector embeddings or pgvector semantic search (post-MVP)
- AI Field Agents (post-MVP)
- Self-hosted LLM adapter beyond an empty skeleton (post-MVP — full implementation deferred)
- MCP server or client (post-MVP)
- Provider Evaluation Framework beyond type interfaces (post-MVP)
- Admin AI Dashboard UI or user usage view UI (Core UX — Phase 3/5)
- Actual AI features: Command Bar AI search, Smart Fill, record summarization, document AI draft, field/link suggestions (Core UX — Phase 5)
- Context Builder with schema retrieval logic (Core UX — Phase 5)
- `canonicalToAIContext()` / `aiToCanonical()` for field types beyond text, number, single_select, checkbox (Core UX — Phase 5)

### Architecture Patterns for This Phase
- **Provider independence is enforced, not aspirational.** Feature code requests capability tiers, never providers or models. The `AIService` is the single entry point — no direct Anthropic SDK usage outside the adapter.
- **AI is a boundary-crosser.** Like sync adapters, AI reads via `canonicalToAIContext()` and writes via `aiToCanonical()`. Both functions live in the FieldTypeRegistry.
- **Metering wraps every call.** The 6-step flow (pre-check budget → execute → calculate → log → deduct → alert) is non-negotiable. Failed API calls log with `status='error'` and charge zero credits.
- **AI-capable, never AI-dependent.** Every core workflow functions without AI. AI features degrade gracefully when credits are exhausted.
- **All AI types, interfaces, and configs live in `packages/shared/ai/`.** Feature packages import from `@everystack/shared/ai`.
- **Streaming uses Vercel AI SDK.** Interactive features stream via SSE. Heavy tasks run in the BullMQ worker.

### Mandatory Context for All Prompts
`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

### Skills for This Phase
Load these skill files before executing any prompt in this phase:
- `docs/skills/backend/SKILL.md` — Drizzle ORM, tenant isolation, CockroachDB safeguards, error handling, test patterns
- `docs/skills/ai-features/SKILL.md` — AIService architecture, credit metering, AI affordance UI, prompt engineering conventions
- `docs/skills/phase-context/SKILL.md` — current build state and existing files/modules

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|:------------:|
| 1 | Core AI type system and provider adapter interface | None | ~200 |
| 2 | Capability-based model routing configuration | 1 | ~150 |
| 3 | Anthropic SDK adapter implementation | 1, 2 | ~250 |
| 4 | Prompt Registry with versioning and provider-specific compilation | 1 | ~200 |
| CP-1 | Integration Checkpoint 1 | 1–4 | — |
| 5 | Tool Definition abstraction and registry | 1 | ~150 |
| 6 | AIFeature enum, rate card, and cost calculator | 1 | ~120 |
| 7 | AI usage logging and credit ledger write paths | 6 | ~200 |
| CP-2 | Integration Checkpoint 2 | 5–7 | — |
| 8 | AIService singleton with metering flow | 827–940 | ~250 |
| 9 | Streaming support with Vercel AI SDK | 3, 8 | ~180 |
| 10 | AI data contract — canonicalToAIContext() and aiToCanonical() for Foundation field types | None (within phase) | ~200 |
| CP-3 | Final Integration Checkpoint | 8–10 | — |

---

## Prompt 1: Core AI Type System and Provider Adapter Interface

**Depends on:** None
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-architecture.md` lines 61–93 (Provider Adapter Interface), lines 251–265 (Agent Integration — type interfaces only), lines 266–296 (Self-Hosted LLM Deployment — providerId union type only)
**Target files:**
- `packages/shared/ai/providers/adapter.ts`
- `packages/shared/ai/types.ts`
- `packages/shared/ai/index.ts`
- `packages/shared/ai/providers/adapter.test.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1h-ai-service-layer` from `main`. After completion, commit with message `feat(ai): define core AI type system and provider adapter interface [Phase 1H, Prompt 1]`

### Schema Snapshot
N/A — no schema changes. The `ai_usage_log`, `ai_credit_ledger`, and `agent_sessions` tables already exist from Phase 1B.

### Task

Create the foundational TypeScript type system for the AI layer. All types live in `packages/shared/ai/` and are exported from the package barrel.

**1. Provider Adapter Interface** (`packages/shared/ai/providers/adapter.ts`):

Define the `AIProviderAdapter` interface exactly as specified in `ai-architecture.md`:

```typescript
interface AIProviderAdapter {
  readonly providerId: string;  // 'anthropic' | 'openai' | 'self-hosted'

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

**2. Core AI Types** (`packages/shared/ai/types.ts`):

Define all supporting types referenced by the adapter and used throughout the AI layer:

- `CompiledAIRequest` — the provider-agnostic request shape (system instruction, messages array, model config, output schema, max tokens, temperature)
- `AIResponse` — completion result (content string, token usage, finish reason, provider request ID)
- `AIStreamChunk` — individual stream chunk (delta content, done flag, usage on final chunk)
- `AIToolResponse` — response with tool calls (content, tool_calls array with name/params/result, token usage)
- `TokenUsage` — input_tokens, output_tokens, cached_input_tokens
- `CreditCost` — cost_usd (number), credits_charged (number)
- `CapabilityTier` — `'fast' | 'standard' | 'advanced'`
- `ProviderId` — `'anthropic' | 'openai' | 'self-hosted'` (union type — openai and self-hosted are extension points, not implementations)
- `AIMessage` — role (`'system' | 'user' | 'assistant'`), content string
- `AgentScope` — type interface for post-MVP agent integration (the shape only, not the implementation). Define as a readonly set of allowed tool names + permission constraints.
- `AgentConfig` — type interface for post-MVP agent sessions (budget_credits, max_steps, scope, timeout). Define the shape only.
- `EmbeddingProvider` — interface for post-MVP vector embeddings (embed single, embed batch, dimension count). Define the interface only — no implementation.

**3. Barrel Export** (`packages/shared/ai/index.ts`):

Re-export all types from `types.ts` and `providers/adapter.ts`. This is the public API surface for `@everystack/shared/ai`.

**4. Tests:**

Write unit tests verifying:
- Type exports are accessible from the barrel
- `ProviderId` union accepts valid values and the type system rejects invalid ones (compile-time — use `expectTypeOf` from vitest)
- `CapabilityTier` union is correctly constrained

### Acceptance Criteria
- [ ] `AIProviderAdapter` interface matches the spec from `ai-architecture.md` exactly
- [ ] `ProviderCapabilities` includes all 7 capability flags including `supportsVision`
- [ ] `ProviderId` union includes `'self-hosted'` as an extension point
- [ ] `AgentScope` and `AgentConfig` type interfaces exist (shapes only — post-MVP hooks)
- [ ] `EmbeddingProvider` interface exists (shape only — post-MVP hook)
- [ ] All types are exported from `packages/shared/ai/index.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] No `any` types used

### Do NOT Build
- Concrete implementations of any adapter (that's Prompt 3)
- The AIService orchestrator (that's Prompt 8)
- Agent runtime logic — only the type interfaces (`AgentScope`, `AgentConfig`)
- Embedding implementations — only the `EmbeddingProvider` interface
- Provider registration or factory patterns — just the interface contract

---

## Prompt 2: Capability-Based Model Routing Configuration

**Depends on:** Prompt 1
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-architecture.md` lines 94–143 (Capability-Based Model Routing)
**Target files:**
- `packages/shared/ai/config/routing.ts`
- `packages/shared/ai/config/routing.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): add capability-based model routing configuration [Phase 1H, Prompt 2]`

### Schema Snapshot
N/A — no schema changes.

### Task

Create the capability-based model routing configuration. Feature code never references providers or models — it specifies an `AITaskType`, and the routing system resolves it to a provider + model.

**1. Task Type Enum:**

```typescript
type AITaskType =
  | 'classify_intent'
  | 'summarize'
  | 'conversation'
  | 'draft_content'
  | 'draft_communication'
  | 'suggest_schema'
  | 'generate_automation'
  | 'generate_app';  // Post-MVP — App Designer AI generation
```

**2. Routing Configuration** (`packages/shared/ai/config/routing.ts`):

```typescript
const CAPABILITY_ROUTING: Record<CapabilityTier, ProviderModelConfig> = {
  fast:     { providerId: 'anthropic', modelId: 'claude-haiku-4-5-20251001' },
  standard: { providerId: 'anthropic', modelId: 'claude-sonnet-4-5-20250929' },
  advanced: { providerId: 'anthropic', modelId: 'claude-opus-4-6' },
};

const FEATURE_ROUTING: Record<AITaskType, CapabilityTier> = {
  classify_intent:      'fast',
  summarize:            'fast',
  conversation:         'standard',
  draft_content:        'standard',
  draft_communication:  'standard',
  suggest_schema:       'standard',
  generate_automation:  'standard',
  generate_app:         'advanced',
};
```

**3. Fallback Chain Configuration:**

```typescript
const FALLBACK_CHAIN: Record<CapabilityTier, ProviderModelConfig[]> = {
  fast:     [CAPABILITY_ROUTING.fast],
  standard: [CAPABILITY_ROUTING.standard],
  advanced: [CAPABILITY_ROUTING.advanced],
};
```

MVP ships with single-entry fallback chains (Anthropic only). The data structure supports multi-provider fallback for post-MVP. Fallback is explicit — not automatic retry with a different provider.

**4. Route Resolution Function:**

```typescript
function resolveRoute(taskType: AITaskType): ProviderModelConfig
function resolveRouteByTier(tier: CapabilityTier): ProviderModelConfig
```

Both functions return the primary route. If the primary is unavailable (provider error), callers use `getFallbackChain(tier)` to iterate through alternatives.

**5. `ProviderModelConfig` Type:**

```typescript
interface ProviderModelConfig {
  providerId: ProviderId;
  modelId: string;
}
```

**6. Tests:**

- Every `AITaskType` resolves to a valid `ProviderModelConfig`
- `resolveRoute('classify_intent')` returns the `fast` tier config
- `resolveRoute('conversation')` returns the `standard` tier config
- `resolveRoute('generate_app')` returns the `advanced` tier config
- Fallback chains contain at least the primary config
- All configs reference a valid `ProviderId` from the union type

### Acceptance Criteria
- [ ] `CAPABILITY_ROUTING` maps all 3 tiers to Anthropic models with correct model IDs
- [ ] `FEATURE_ROUTING` maps all 8 task types to capability tiers matching the reference doc
- [ ] `resolveRoute()` correctly resolves task type → tier → provider/model
- [ ] `resolveRouteByTier()` allows direct tier-based routing
- [ ] Fallback chain data structure supports multi-provider fallback (even though MVP only has one provider per tier)
- [ ] All exports accessible from `packages/shared/ai/index.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Multi-provider fallback logic (post-MVP — MVP chains have single entries)
- Hybrid routing (different tiers served by different providers — post-MVP)
- Dynamic tier escalation for agents (post-MVP)
- Shadow mode for secondary provider testing (post-MVP)
- Runtime config reloading — config is static at build time for MVP

---

## Prompt 3: Anthropic SDK Adapter Implementation

**Depends on:** Prompt 1, Prompt 2
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-architecture.md` lines 61–93 (Provider Adapter Interface), lines 234–241 (Streaming Support), lines 266–296 (Self-Hosted LLM Deployment — skeleton only)
**Target files:**
- `packages/shared/ai/providers/anthropic.ts`
- `packages/shared/ai/providers/self-hosted.ts` (skeleton only)
- `packages/shared/ai/providers/anthropic.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): implement Anthropic SDK adapter and self-hosted skeleton [Phase 1H, Prompt 3]`

### Schema Snapshot
N/A — no schema changes.

### Task

Implement the Anthropic adapter — the only production adapter for MVP — and a self-hosted adapter skeleton.

**1. Install Dependencies:**

```bash
pnpm add @anthropic-ai/sdk --filter @everystack/shared
```

**2. Anthropic Adapter** (`packages/shared/ai/providers/anthropic.ts`):

Implement `AIProviderAdapter` for Anthropic Claude:

- **`complete(request)`** — Call `client.messages.create()`. Map `CompiledAIRequest` to Anthropic message format. Return `AIResponse` with normalized token usage.
- **`streamComplete(request)`** — Use `client.messages.stream()`. Yield `AIStreamChunk` objects. Include final usage in the last chunk.
- **`completeWithTools(request, tools)`** — Call `client.messages.create()` with tools array. Map `ToolDefinition[]` to Anthropic's native `tools` format (`input_schema`). Return `AIToolResponse` with parsed tool calls.
- **`supportedCapabilities()`** — Return `ProviderCapabilities` with: `maxContextTokens: 200000`, `supportsStreaming: true`, `supportsToolUse: true`, `supportsPromptCaching: true`, `supportsBatchAPI: true`, `supportsStructuredOutput: true`, `supportsVision: true`.
- **`calculateCost(usage)`** — Compute cost using the rate card from `ai-metering.md`. Rates keyed by model ID. Return `CreditCost` with `cost_usd` and `credits_charged` (Math.ceil(cost_usd * 100)).

**Prompt caching:** Inject `cache_control: { type: 'ephemeral' }` on system instructions and large context blocks. This is the Anthropic-specific compilation — feature code never sees it.

**Error mapping:** Catch Anthropic SDK errors and map to typed errors:
- `401/403` → `AIProviderAuthError`
- `429` → `AIProviderRateLimitError` (include `retry_after` if available)
- `500/529` → `AIProviderError`
- Timeout → `AIProviderTimeoutError`

All error types extend a base `AIProviderError` class. These are internal to the adapter — the AIService (Prompt 8) maps them to user-facing responses.

**Configuration:** Read `ANTHROPIC_API_KEY` from environment. Validate at adapter construction — throw immediately if missing.

**3. Self-Hosted Adapter Skeleton** (`packages/shared/ai/providers/self-hosted.ts`):

Create a minimal file that implements `AIProviderAdapter` with all methods throwing `new Error('Self-hosted adapter not implemented — post-MVP')`. Set `providerId: 'self-hosted'`. This establishes the extension point without building the implementation.

**4. Tests:**

Use MSW (Mock Service Worker) to mock Anthropic API responses. Do NOT make real API calls in tests.

- `complete()` returns normalized `AIResponse` from a mocked Anthropic response
- `streamComplete()` yields chunks and includes usage on final chunk
- `completeWithTools()` parses tool calls from mocked response
- `calculateCost()` correctly computes cost for Haiku, Sonnet, and Opus model IDs
- Error mapping: 429 → `AIProviderRateLimitError`, 500 → `AIProviderError`
- Constructor throws if `ANTHROPIC_API_KEY` is not set
- Prompt caching: system instructions include `cache_control` header
- Self-hosted skeleton throws on all methods

### Acceptance Criteria
- [ ] `AnthropicAdapter` implements all 5 methods of `AIProviderAdapter`
- [ ] `@anthropic-ai/sdk` installed and imported only inside the adapter file — never in feature code
- [ ] Prompt caching (`cache_control: { type: 'ephemeral' }`) injected on system instructions
- [ ] `calculateCost()` matches the rate card: Haiku ($1/$5 per MTok), Sonnet ($3/$15), Opus ($5/$25)
- [ ] Error types defined and mapped correctly (auth, rate limit, timeout, generic)
- [ ] MSW mocks used for all tests — zero real API calls
- [ ] Self-hosted skeleton exists with all methods throwing "not implemented"
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- OpenAI adapter or any other provider adapter
- Self-hosted adapter implementation (only the skeleton)
- Retry logic with exponential backoff in the adapter (the AIService handles retry policy)
- Batch API support (the adapter declares `supportsBatchAPI: true` in capabilities, but batch submission is post-MVP)
- Vision-specific request handling (declared in capabilities, implemented when Document Intelligence ships post-MVP)

---

## Prompt 4: Prompt Registry with Versioning and Provider-Specific Compilation

**Depends on:** Prompt 1
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-architecture.md` lines 144–181 (Prompt Registry & Versioning)
**Target files:**
- `packages/shared/ai/prompts/registry.ts`
- `packages/shared/ai/prompts/compiler.ts`
- `packages/shared/ai/prompts/templates/` (directory — empty, ready for templates)
- `packages/shared/ai/prompts/registry.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): build prompt registry with versioning and provider-specific compilation [Phase 1H, Prompt 4]`

### Schema Snapshot
N/A — no schema changes.

### Task

Build the prompt registry — the system that stores, versions, and compiles provider-agnostic prompt templates.

**1. PromptTemplate Interface:**

```typescript
interface PromptTemplate {
  id: string;                      // 'automation_builder', 'document_draft', etc.
  version: number;                 // Monotonically increasing
  description: string;
  capabilityTier: CapabilityTier;
  systemInstruction: string;       // Template with {{variables}}
  outputSchema: JSONSchema;        // Expected output (Zod → JSON Schema)
  variables: VariableDefinition[];
  examples: PromptExample[];       // Few-shot pairs
  testedWith: TestedModel[];       // Validated provider+model combos
  createdAt: string;
  changelog: string;
}
```

Supporting types: `VariableDefinition` (name, type, required, description), `PromptExample` (input, expectedOutput), `TestedModel` (providerId, modelId, passRate).

**2. PromptRegistry Class:**

```typescript
class PromptRegistry {
  register(template: PromptTemplate): void;
  get(id: string, version?: number): PromptTemplate | undefined;
  getLatest(id: string): PromptTemplate | undefined;
  listTemplates(): Array<{ id: string; latestVersion: number }>;
  compile(templateId: string, variables: Record<string, unknown>, providerId: ProviderId): CompiledAIRequest;
}
```

- Templates are registered at application startup from TypeScript files in `packages/shared/ai/prompts/templates/`.
- `get()` retrieves a specific version. `getLatest()` retrieves the highest version.
- `compile()` resolves variables in the template, then passes through the provider-specific compiler.

**3. Provider-Specific Compiler** (`packages/shared/ai/prompts/compiler.ts`):

```typescript
interface PromptCompiler {
  compile(template: PromptTemplate, variables: Record<string, unknown>): CompiledAIRequest;
}
```

Implement `AnthropicPromptCompiler`:
- Inject `cache_control: { type: 'ephemeral' }` on system instructions
- Use XML tags for structured sections (Anthropic best practice)
- Map `outputSchema` to Anthropic's structured output format

Create a `compilerForProvider(providerId: ProviderId): PromptCompiler` factory function. For `'self-hosted'`, return a basic compiler that does simple variable substitution without provider-specific optimizations (placeholder for post-MVP).

**4. Version Management Rules (enforced in code):**
- `register()` rejects a template if its version is ≤ the currently registered version for that ID
- Templates are immutable once registered — no in-place mutation
- Rollback = register a new entry pointing to an older version's content

**5. Template Directory:**

Create `packages/shared/ai/prompts/templates/` directory. No templates yet — they ship with features in Core UX (Phase 5). The directory structure and one example placeholder file (documented but commented out) establish the pattern.

**6. Tests:**

- Register a template, retrieve it by ID and version
- `getLatest()` returns the highest version
- `compile()` substitutes `{{variables}}` correctly
- `compile()` with Anthropic compiler injects `cache_control`
- Registering a lower version than existing throws
- Unknown template ID returns `undefined`

### Acceptance Criteria
- [ ] `PromptTemplate` interface matches the spec from `ai-architecture.md` exactly
- [ ] `PromptRegistry` supports register, get, getLatest, listTemplates, compile
- [ ] `AnthropicPromptCompiler` injects `cache_control` and uses XML tags
- [ ] Version management prevents registering lower versions
- [ ] `compilerForProvider()` factory returns correct compiler per provider
- [ ] Template directory created at `packages/shared/ai/prompts/templates/`
- [ ] All exports accessible from `packages/shared/ai/index.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- Actual prompt templates for features (Core UX — Phase 5)
- A/B testing or shadow evaluation of templates (post-MVP)
- Dynamic template loading from database (templates are TypeScript files, loaded at startup)
- OpenAI-specific compiler (post-MVP)
- Template analytics or usage tracking

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all work from Prompts 1–4 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including tests from prior phases)
4. `pnpm turbo test -- --coverage` — thresholds met for `packages/shared/ai/`
5. Manual verification: confirm that `packages/shared/ai/index.ts` exports all public types and classes. Import `AIProviderAdapter`, `CapabilityTier`, `PromptRegistry`, `AnthropicAdapter` from the barrel and verify TypeScript resolves them.

**Git:** Commit with message `chore(verify): integration checkpoint 1 [Phase 1H, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Tool Definition Abstraction and Registry

**Depends on:** Prompt 1
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-architecture.md` lines 182–203 (Tool Definition Abstraction)
**Target files:**
- `packages/shared/ai/tools/registry.ts`
- `packages/shared/ai/tools/registry.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): build tool definition abstraction and registry [Phase 1H, Prompt 5]`

### Schema Snapshot
N/A — no schema changes.

### Task

Build the tool definition system that lets AI models invoke EveryStack capabilities.

**1. ToolDefinition Interface:**

```typescript
interface ToolDefinition {
  name: string;                    // 'search_records', 'create_record', etc.
  description: string;
  parameters: JSONSchema;          // Standard JSON Schema
  handler: (params: unknown) => Promise<ToolResult>;
  requiredPermissions: Permission[];
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

**2. ToolRegistry Class:**

```typescript
class ToolRegistry {
  register(tool: ToolDefinition): void;
  get(name: string): ToolDefinition | undefined;
  listTools(): ToolDefinition[];
  getForScope(scope?: AgentScope): ToolDefinition[];  // Filters tools by agent scope (post-MVP hook)
  compileForProvider(tools: ToolDefinition[], providerId: ProviderId): unknown[];  // Provider-native format
}
```

**3. Provider-Specific Tool Compilation:**

- **Anthropic:** Transform `ToolDefinition` to Anthropic's `tools` array format with `input_schema` field.
- **Self-hosted (placeholder):** Transform to a basic JSON description format (for post-MVP prompt-based tool use).

The compilation functions live inside the registry, keyed by `ProviderId`.

**4. Available Tools (names only — no implementations):**

Register tool stubs (name + description + parameter schema + empty handler that throws "not implemented") for the 8 tools specified in the reference doc:
- `search_records` — search records across tables
- `query_tables` — query table data with filters
- `resolve_cross_links` — traverse cross-link relationships
- `trigger_commands` — execute a registered command
- `create_record` — create a new record in a table
- `generate_document` — trigger document generation
- `get_field_definitions` — retrieve field schema for a table
- `list_tables` — list tables in a workspace

These stubs establish the tool catalogue. Actual handler implementations ship in Core UX (Phase 5) when the features they depend on exist.

**5. Tests:**

- Register a tool, retrieve by name
- `listTools()` returns all registered tools
- `getForScope()` returns all tools when no scope provided (MVP behavior)
- Anthropic compilation produces correct `input_schema` format
- Duplicate tool name registration throws
- All 8 stub tools are registered and listed

### Acceptance Criteria
- [ ] `ToolDefinition` interface matches the spec from `ai-architecture.md`
- [ ] `ToolRegistry` supports register, get, listTools, getForScope, compileForProvider
- [ ] Anthropic tool compilation produces the correct native format
- [ ] All 8 tool stubs registered with name, description, parameter schema
- [ ] `getForScope()` accepts `AgentScope` parameter (post-MVP hook) but returns all tools when undefined
- [ ] All exports accessible from `packages/shared/ai/index.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- Actual tool handler implementations (Core UX — Phase 5)
- Dynamic tool set composition for agents (post-MVP)
- Tool execution middleware or permission checking (Core UX)
- Tool result caching
- MCP protocol translation layer (post-MVP)

---

## Prompt 6: AIFeature Enum, Rate Card, and Cost Calculator

**Depends on:** Prompt 1
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-metering.md` lines 84–165 (Anthropic API Pricing Reference, AI Usage Logging Infrastructure — cost calculation formula only), lines 423–438 (AIFeature Enum)
**Target files:**
- `packages/shared/ai/metering/features.ts`
- `packages/shared/ai/metering/rates.ts`
- `packages/shared/ai/metering/cost-calculator.ts`
- `packages/shared/ai/metering/cost-calculator.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): define AIFeature enum, rate card, and cost calculator [Phase 1H, Prompt 6]`

### Schema Snapshot
N/A — no schema changes. References `ai_usage_log.feature` column (VARCHAR(64)) and `ai_usage_log.model` column (VARCHAR(32)) from Phase 1B.

### Task

Create the metering primitives: the feature enum, per-model pricing, and cost calculation.

**1. AIFeature Enum** (`packages/shared/ai/metering/features.ts`):

Define as a TypeScript const object (not a TypeScript `enum` — use `as const` pattern for better tree-shaking and type inference):

```typescript
const AI_FEATURES = {
  command_bar: 'command_bar',
  formula_suggest: 'formula_suggest',       // post-MVP
  email_draft: 'email_draft',
  automation_build: 'automation_build',
  cross_base_analysis: 'cross_base_analysis', // post-MVP
  guide_mode: 'guide_mode',                 // post-MVP
  doc_assist: 'doc_assist',
  record_summary: 'record_summary',
  app_suggest: 'app_suggest',               // post-MVP — App Designer AI
  thread_summary: 'thread_summary',
  agent_planning: 'agent_planning',         // post-MVP
  agent_tool_selection: 'agent_tool_selection', // post-MVP
  agent_observation: 'agent_observation',    // post-MVP
} as const;

type AIFeature = typeof AI_FEATURES[keyof typeof AI_FEATURES];
```

Add JSDoc comments marking post-MVP features.

**2. Rate Card** (`packages/shared/ai/metering/rates.ts`):

```typescript
const AI_RATES: Record<string, ModelRate> = {
  'claude-haiku-4-5-20251001':  { input: 0.000001, output: 0.000005, cache_read: 0.0000001 },
  'claude-sonnet-4-5-20250929': { input: 0.000003, output: 0.000015, cache_read: 0.0000003 },
  'claude-opus-4-6':            { input: 0.000005, output: 0.000025, cache_read: 0.0000005 },
};

interface ModelRate {
  input: number;    // Cost per token (not per million — pre-divided)
  output: number;
  cache_read: number;
}
```

**3. Cost Calculator** (`packages/shared/ai/metering/cost-calculator.ts`):

```typescript
function calculateCost(modelId: string, usage: TokenUsage): CreditCost {
  const rate = AI_RATES[modelId];
  if (!rate) throw new Error(`Unknown model: ${modelId}`);
  const costUsd = (usage.input_tokens * rate.input)
                + (usage.cached_input_tokens * rate.cache_read)
                + (usage.output_tokens * rate.output);
  const creditsCharged = Math.ceil(costUsd * 100); // 1 credit = $0.01
  return { cost_usd: costUsd, credits_charged: creditsCharged };
}
```

**4. Tests:**

- Haiku: 1000 input + 500 output + 0 cached = expected cost (verify exact numbers)
- Sonnet: 1000 input + 500 output + 2000 cached = expected cost
- Opus: 1000 input + 500 output + 0 cached = expected cost
- Credits are always rounded up (Math.ceil): 0.001 USD → 1 credit, not 0
- Unknown model ID throws
- Zero tokens → zero cost, zero credits
- All 13 AIFeature values are defined and accessible
- AIFeature type correctly constrains to valid values

### Acceptance Criteria
- [ ] `AI_FEATURES` contains all 13 values from the reference doc
- [ ] `AI_RATES` matches the Anthropic pricing: Haiku ($1/$5), Sonnet ($3/$15), Opus ($5/$25) per MTok
- [ ] `calculateCost()` produces correct USD cost for known test vectors
- [ ] Credits are `Math.ceil(costUsd * 100)` — never rounded down
- [ ] Unknown model ID throws (not silently returns zero)
- [ ] All exports accessible from `packages/shared/ai/index.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- Per-feature credit cost estimates (those are usage patterns, not the calculator)
- Plan-tier budget definitions (that's the credit ledger concern in Prompt 7)
- Cost reduction optimizations (caching, batching are adapter concerns)
- Real-time cost tracking UI (Core UX)
- Currency conversion or localization of costs

---

## Prompt 7: AI Usage Logging and Credit Ledger Write Paths

**Depends on:** Prompt 6
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-metering.md` lines 117–212 (AI Usage Logging Infrastructure, Credit Budget & Metering System)
**Target files:**
- `packages/shared/ai/metering/usage-logger.ts`
- `packages/shared/ai/metering/credit-ledger.ts`
- `packages/shared/ai/metering/usage-logger.test.ts`
- `packages/shared/ai/metering/credit-ledger.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): implement AI usage logging and credit ledger write paths [Phase 1H, Prompt 7]`

### Schema Snapshot
From Phase 1B (existing tables):
```
ai_usage_log: id (UUIDv7 PK), tenant_id, user_id, feature (VARCHAR(64)), model (VARCHAR(32)),
  input_tokens (INT), output_tokens (INT), cached_input (INT, default 0), cost_usd (NUMERIC(10,6)),
  credits_charged (NUMERIC(10,2)), request_id (VARCHAR(128) nullable), duration_ms (INT nullable),
  status (VARCHAR(16), default 'success'), error_code (VARCHAR(64) nullable), metadata (JSONB, default {}),
  agent_session_id (UUID FK nullable), created_at (TIMESTAMPTZ)

ai_credit_ledger: id (UUIDv7 PK), tenant_id, period_start (DATE), period_end (DATE),
  credits_total (INT), credits_used (NUMERIC(10,2), default 0),
  credits_remaining (GENERATED: credits_total - credits_used),
  usage_pct (GENERATED: ROUND(credits_used / credits_total * 100, 1)), updated_at (TIMESTAMPTZ)
  Unique index: (tenant_id, period_start)
```

### Task

Implement the database write paths for AI usage tracking.

**1. Usage Logger** (`packages/shared/ai/metering/usage-logger.ts`):

```typescript
interface UsageLogEntry {
  tenantId: string;
  userId: string;
  feature: AIFeature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInput: number;
  costUsd: number;
  creditsCharged: number;
  requestId?: string;
  durationMs?: number;
  status: 'success' | 'error' | 'timeout' | 'rate_limited';
  errorCode?: string;
  metadata?: Record<string, unknown>;
  agentSessionId?: string;
}

async function logAIUsage(entry: UsageLogEntry): Promise<void>
```

- INSERT into `ai_usage_log` using Drizzle ORM via `getDbForTenant()`
- Generate UUIDv7 for `id`
- Set `created_at` to current timestamp
- Error calls (status !== 'success') are logged with `credits_charged: 0`
- Use the Pino logger to log the usage event at `info` level with `traceId`

**2. Credit Ledger Operations** (`packages/shared/ai/metering/credit-ledger.ts`):

```typescript
async function checkBudget(tenantId: string): Promise<BudgetStatus>
async function deductCredits(tenantId: string, credits: number): Promise<BudgetStatus>
```

- `checkBudget()`: Query `ai_credit_ledger` for current billing period (where `period_start <= now < period_end`). Return `{ creditsTotal, creditsUsed, creditsRemaining, usagePct, exhausted: boolean }`.
- `deductCredits()`: Atomic UPDATE `credits_used = credits_used + credits`. Return updated `BudgetStatus`.
- If no ledger row exists for the current period, return `{ exhausted: true }` — the billing system creates ledger rows (not the AI layer).

**3. Alert Threshold Check:**

```typescript
async function checkAlertThresholds(tenantId: string, budgetStatus: BudgetStatus): Promise<AlertAction[]>
```

- At 80% usage: return `[{ type: 'budget_80pct', tenantId }]`
- At 95% usage: return `[{ type: 'budget_95pct', tenantId }]`
- At 100% usage: return `[{ type: 'budget_exhausted', tenantId }]`
- Return empty array if no threshold crossed

Alert actions are returned, not dispatched — the AIService (Prompt 8) decides how to handle them (e.g., queue a notification job). This keeps the metering layer pure.

**4. Tests:**

Use test factories from Phase 1E. Create test tenants with ledger rows.

- `logAIUsage()` inserts a row with correct values
- `logAIUsage()` with `status: 'error'` sets `credits_charged: 0`
- `checkBudget()` returns correct remaining credits
- `deductCredits()` atomically updates `credits_used`
- `deductCredits()` concurrent calls don't lose credits (test with parallel deductions)
- `checkAlertThresholds()` returns correct alerts at 80%, 95%, 100%
- Missing ledger row returns `exhausted: true`
- `testTenantIsolation()` passes for both `logAIUsage` and `checkBudget`

### Acceptance Criteria
- [ ] `logAIUsage()` correctly INSERTs into `ai_usage_log` with all fields
- [ ] Error calls logged with zero credits charged
- [ ] `checkBudget()` returns correct budget status for current period
- [ ] `deductCredits()` is atomic (concurrent-safe UPDATE)
- [ ] Alert thresholds at 80%, 95%, 100% detected correctly
- [ ] `testTenantIsolation()` passes for all data access functions
- [ ] Pino logger used (not console.log) with traceId context
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- Ledger row creation (billing system responsibility — not AI layer)
- Daily caps or per-user caps (Post-MVP — Comms & Polish phase)
- Reconciliation job (Post-MVP — Comms & Polish phase)
- Admin dashboard queries or aggregation views (Core UX)
- CSV export of usage data (Post-MVP)
- Alert dispatching (the AIService dispatches — metering layer returns alert actions)

---

## Integration Checkpoint 2 (after Prompts 5–7)

**Task:** Verify all work from Prompts 5–7 integrates correctly with Prompts 1–4.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including tests from Prompts 1–4 and prior phases)
4. `pnpm turbo test -- --coverage` — thresholds met for `packages/shared/ai/`
5. Manual verification: in a test file, import `ToolRegistry`, `calculateCost`, `logAIUsage`, `checkBudget`, `deductCredits` from `@everystack/shared/ai` and verify TypeScript resolves them.

**Git:** Commit with message `chore(verify): integration checkpoint 2 [Phase 1H, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## Prompt 8: AIService Singleton with Metering Flow

**Depends on:** Prompts 1, 2, 3, 4, 5, 6, 7
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-metering.md` lines 304–337 (AIService Wrapper Implementation), `ai-architecture.md` lines 40–47 (Core Principle)
**Target files:**
- `packages/shared/ai/service.ts`
- `packages/shared/ai/service.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): implement AIService singleton with metering flow [Phase 1H, Prompt 8]`

### Schema Snapshot
N/A — uses existing tables via the write paths from Prompt 7.

### Task

Build the `AIService` — the **single entry point** for all AI calls in the platform. No code should call the Anthropic SDK directly. Every AI call flows through this service.

**1. AIService Interface:**

```typescript
interface AIServiceRequest {
  tenantId: string;
  userId: string;
  feature: AIFeature;
  prompt: string;
  context?: {
    tableSchemas?: TableSchema[];
    recordSample?: unknown[];
    conversationHistory?: AIMessage[];
  };
  taskType?: AITaskType;         // Optional — if omitted, inferred from feature
  outputSchema?: JSONSchema;     // For structured output
  tools?: string[];              // Tool names from ToolRegistry
  stream?: boolean;              // Request streaming response
}

interface AIServiceResponse {
  success: boolean;
  content?: string;
  structuredOutput?: unknown;
  toolCalls?: Array<{ name: string; params: unknown; result: unknown }>;
  creditsCharged: number;
  creditsRemaining: number;
  budgetExhausted?: boolean;
  error?: string;
}
```

**2. AIService Class:**

```typescript
class AIService {
  private static instance: AIService;
  static getInstance(): AIService;

  async execute(request: AIServiceRequest): Promise<AIServiceResponse>;
  async stream(request: AIServiceRequest): AsyncIterable<AIStreamChunk>;
}
```

**3. The 6-Step Metering Flow** (in `execute()`):

1. **Pre-check:** Call `checkBudget(tenantId)`. If `credits_remaining < 1`, return `{ success: false, budgetExhausted: true, creditsCharged: 0, creditsRemaining: 0 }` immediately. No API call is made.
2. **Route:** Resolve `request.feature` → `AITaskType` → `CapabilityTier` → `ProviderModelConfig` via the routing configuration. If `request.taskType` is provided, use it directly.
3. **Compile:** If a `promptTemplateId` is provided, compile via `PromptRegistry`. Otherwise, build a `CompiledAIRequest` from the raw prompt + context. If `tools` are specified, resolve them from `ToolRegistry` and compile for the target provider.
4. **Execute:** Call the resolved adapter's `complete()`, `completeWithTools()`, or `streamComplete()` based on request shape. Measure `durationMs`. On API error: catch, log, return `{ success: false, error: errorMessage, creditsCharged: 0 }`.
5. **Calculate & Log:** Call `calculateCost()` with the response's token usage. Call `logAIUsage()` with all fields including `requestId` from the provider response.
6. **Deduct & Alert:** Call `deductCredits()`. Call `checkAlertThresholds()`. If alert actions returned, emit them (for now, log at `warn` level — notification dispatch ships with Core UX).

**4. Context Builder Placeholder:**

Create a stub `buildContext()` method that concatenates `request.context` fields into a simple text format. The real Context Builder with schema retrieval, permission filtering, and token budgeting ships in Phase 5. The stub exists so the AIService has a consistent internal API.

**5. Error Handling:**

- Budget exhaustion → `{ success: false, budgetExhausted: true }`
- Provider error → `{ success: false, error: 'AI service temporarily unavailable' }` (never expose provider details to callers)
- Provider rate limit → log, attempt fallback chain if available, else return error
- Timeout → log, return `{ success: false, error: 'Request timed out' }`

**6. Tests:**

Mock the Anthropic adapter (don't use real SDK calls). Mock the metering write paths.

- Happy path: execute() routes correctly, returns content, charges credits
- Budget exhaustion: returns `budgetExhausted: true`, zero credits charged, no API call made
- API error: returns error, zero credits charged, usage logged with `status: 'error'`
- Feature routing: `command_bar` → fast tier, `conversation` → standard tier
- Tool use: tools resolved from ToolRegistry and passed to adapter
- Alert thresholds: warn-level log emitted at 80% and 95%
- Singleton: `getInstance()` returns the same instance

### Acceptance Criteria
- [ ] `AIService` is a singleton — all AI calls go through `AIService.getInstance().execute()`
- [ ] 6-step metering flow executes in order: pre-check → route → compile → execute → log → deduct
- [ ] Budget exhaustion short-circuits before any API call
- [ ] Failed API calls charge zero credits and log with `status: 'error'`
- [ ] Provider details never leak to callers (error messages are generic)
- [ ] Feature → task type → tier → model routing resolves correctly
- [ ] Context builder placeholder exists (stub, not real implementation)
- [ ] All exports accessible from `packages/shared/ai/index.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- Context Builder with real schema retrieval (Core UX — Phase 5)
- Notification dispatch for budget alerts (Core UX — the service just logs for now)
- Daily cap enforcement (Post-MVP)
- Agent session budget tracking (post-MVP)
- Retry with different providers on failure (single-provider MVP)
- Request queuing or concurrency limiting

---

## Prompt 9: Streaming Support with Vercel AI SDK

**Depends on:** Prompt 3, Prompt 8
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-architecture.md` lines 234–241 (Streaming Support)
**Target files:**
- `packages/shared/ai/streaming/stream-adapter.ts`
- `apps/web/src/app/api/ai/chat/route.ts`
- `packages/shared/ai/streaming/stream-adapter.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): add streaming support with Vercel AI SDK integration [Phase 1H, Prompt 9]`

### Schema Snapshot
N/A — no schema changes.

### Task

Connect the AI streaming pipeline: Anthropic adapter → Vercel AI SDK → SSE to frontend.

**1. Install Dependencies:**

```bash
pnpm add ai --filter @everystack/web
pnpm add ai --filter @everystack/shared
```

**2. Stream Adapter** (`packages/shared/ai/streaming/stream-adapter.ts`):

Create a bridge between the `AIProviderAdapter.streamComplete()` (which returns `AsyncIterable<AIStreamChunk>`) and the Vercel AI SDK's streaming utilities:

```typescript
function createAIStream(
  request: AIServiceRequest,
  aiService: AIService
): ReadableStream;
```

This function:
- Calls `AIService.stream()` which internally routes to the adapter's `streamComplete()`
- Wraps the `AsyncIterable<AIStreamChunk>` into a `ReadableStream` compatible with Vercel AI SDK's `StreamingTextResponse` (or the newer `streamText` pattern)
- Handles metering: accumulates token usage from the final chunk, then logs and deducts after the stream completes
- On error mid-stream: closes the stream gracefully, logs with `status: 'error'`

**3. SSE Route Handler** (`apps/web/src/app/api/ai/chat/route.ts`):

Create the Next.js App Router API route that serves as the SSE endpoint for interactive AI features:

```typescript
export async function POST(req: Request) {
  // 1. Authenticate via Clerk session
  // 2. Extract tenantId, userId from session
  // 3. Parse request body (feature, prompt, context)
  // 4. Call createAIStream() with AIService
  // 5. Return StreamingTextResponse
}
```

This route is the Foundation skeleton. The actual feature-specific logic (Command Bar AI, doc drafting) will be added in Phase 5. For now, it demonstrates the full pipeline works end-to-end.

**4. BullMQ Integration Point:**

Document (in code comments) the pattern for heavy AI tasks that should NOT stream to the client:
- Heavy tasks (complex automations, app generation) are submitted to BullMQ queues
- The worker processes them via `AIService.execute()` (non-streaming)
- Completion is pushed to the client via Redis pub/sub → Socket.io

No BullMQ AI job processor implementation in this prompt — just the documented pattern and a type for `AIJobPayload` that worker jobs will use.

**5. Tests:**

- `createAIStream()` produces a valid `ReadableStream` from a mocked adapter
- Stream completes and final usage is accumulated
- Metering (log + deduct) fires after stream completes, not during
- Error mid-stream: stream closes, error logged, zero credits charged
- Route handler returns 401 for unauthenticated requests
- Route handler returns streaming response for valid requests (mock the AIService)

### Acceptance Criteria
- [ ] `ai` package (Vercel AI SDK) installed in `apps/web` and `packages/shared`
- [ ] `createAIStream()` bridges adapter's `AsyncIterable` to Vercel AI SDK `ReadableStream`
- [ ] SSE route handler at `/api/ai/chat` authenticates via Clerk and streams responses
- [ ] Metering fires after stream completion (not per-chunk)
- [ ] Error handling closes stream gracefully and logs with zero credits
- [ ] `AIJobPayload` type defined for BullMQ worker integration
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- Command Bar AI feature logic (Core UX — Phase 5)
- Document drafting AI (Core UX — Phase 5)
- BullMQ AI job processor implementation (Phase 5 — only the type is defined here)
- Client-side streaming UI components (Core UX — Phase 5)
- Conversation history management (Core UX — Phase 5)
- Token budget tracking during streaming

---

## Prompt 10: AI Data Contract — canonicalToAIContext() and aiToCanonical() for Foundation Field Types

**Depends on:** None (within this phase — depends on Phase 1B FieldTypeRegistry concept from `packages/shared/sync/field-registry.ts`)
**Skills:** backend, ai-features, phase-context
**Load context:** `ai-data-contract.md` lines 26–59 (Core Principle, Two Translation Functions), lines 62–91 (Category 1: Text, Category 2: Number, Category 3: Selection — single_select only), lines 117–122 (Category 6: Boolean — checkbox only), lines 184–210 (Integration with Existing Validation, Implementation Notes)
**Target files:**
- `packages/shared/ai/data-contract/canonical-to-ai.ts`
- `packages/shared/ai/data-contract/ai-to-canonical.ts`
- `packages/shared/ai/data-contract/index.ts`
- `packages/shared/ai/data-contract/canonical-to-ai.test.ts`
- `packages/shared/ai/data-contract/ai-to-canonical.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): implement AI data contract for text, number, single_select, checkbox field types [Phase 1H, Prompt 10]`

### Schema Snapshot
N/A — no schema changes. These functions operate on canonical JSONB values, not database tables directly.

### Task

Implement the two translation functions that ensure AI speaks canonical JSONB — the same discipline applied to sync adapters.

**1. Function Signatures:**

```typescript
// Read path: canonical JSONB → AI prompt context
function canonicalToAIContext(
  value: unknown,
  fieldType: string,
  fieldConfig: Record<string, unknown>
): string;

// Write path: AI output → canonical JSONB
function aiToCanonical(
  rawLLMOutput: string,
  fieldType: string,
  fieldConfig: Record<string, unknown>
): { value: unknown; warnings: string[] } | { error: string };
```

These functions will be registered per field type in the FieldTypeRegistry. For Foundation, implement for 4 field types.

**2. Text Field Type:**

- `canonicalToAIContext()`: Return string as-is.
- `aiToCanonical()`: Return string as-is. Apply `max_length` truncation from config if configured. No warnings unless truncated.

**3. Number Field Type:**

- `canonicalToAIContext()`: Format with configured `thousands_separator` and `precision`. E.g., `"15,000.50"`.
- `aiToCanonical()`: Extract first numeric value. Strip `$`, `€`, `,`, `%`, whitespace, unit suffixes. Parse as float. Apply `precision` rounding from config. Return `{ error }` if no number found.

**4. Single Select Field Type:**

- `canonicalToAIContext()`: Resolve option ID → option label using `fieldConfig.options[]`. Return the label string. LLMs reason about labels, not IDs.
- `aiToCanonical()`: Match LLM output against option labels with cascade: exact match → case-insensitive → trimmed → extracted from explanatory text (e.g., "I'd suggest 'Active'" → match "Active"). Return the matching option ID. Return `{ error }` if no match found.

**5. Checkbox Field Type:**

- `canonicalToAIContext()`: Return `"Yes"` or `"No"`.
- `aiToCanonical()`: Accept: `true`/`false`, `yes`/`no`, `1`/`0`, `checked`/`unchecked` (case-insensitive). Map to boolean. Return `{ error }` if unrecognized.

**6. Validation Pipeline Integration:**

Document and demonstrate (in a test) the full pipeline:
```
Raw LLM output → aiToCanonical() → validate() → store in canonical_data JSONB
```

`aiToCanonical()` does NOT replace `validate()` from the FieldTypeRegistry. It coerces messy LLM text to canonical shape; `validate()` then enforces constraints (required, unique, max_length). For Foundation, show the integration pattern in tests — the actual `validate()` calls happen when features ship.

**7. Tests:**

For each field type, test:
- Round-trip: `canonical → canonicalToAIContext() → aiToCanonical()` recovers the original value
- Edge cases for `aiToCanonical()`:
  - **Text:** empty string, very long string (truncation), null
  - **Number:** currency symbols (`"$15,000.50"`), percentage (`"75%"`), commas, no number found
  - **Single select:** exact label match, case mismatch, trimming, option not found, label extracted from surrounding text
  - **Checkbox:** all accepted variations (yes/no/true/false/1/0/checked/unchecked), unrecognized input
- Warnings array populated on lossy conversions (e.g., text truncation)
- Error returned on impossible conversions (e.g., "hello" as number)

### Acceptance Criteria
- [ ] `canonicalToAIContext()` implemented for text, number, single_select, checkbox
- [ ] `aiToCanonical()` implemented for text, number, single_select, checkbox
- [ ] Number parsing strips currency symbols, commas, percentage signs, unit suffixes
- [ ] Single select resolves label → option ID with 4-step cascade (exact, case-insensitive, trimmed, extracted)
- [ ] Checkbox accepts 8 variations (true/false/yes/no/1/0/checked/unchecked)
- [ ] `aiToCanonical()` returns `{ value, warnings }` on success, `{ error }` on failure — never throws
- [ ] Round-trip tests pass for all 4 field types
- [ ] Validation pipeline integration pattern demonstrated in tests
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build
- `canonicalToAIContext()` / `aiToCanonical()` for field types beyond text, number, single_select, checkbox (Core UX — Phase 5)
- Integration with the actual FieldTypeRegistry (Phase 5 — for now these are standalone functions)
- DuckDB type coercion (post-MVP)
- AI Field Agent output validator pipeline (post-MVP)
- Smart Doc TipTap JSON ↔ Markdown conversion (post-MVP)

---

## Final Integration Checkpoint (after Prompts 8–10)

**Task:** Verify the complete Phase 1H integrates correctly — all 10 prompts plus all prior phase work.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (full test suite including all prior phases)
4. `pnpm turbo test -- --coverage` — thresholds met for `packages/shared/ai/` and `apps/web/`
5. Manual verification:
   - Import `AIService` from `@everystack/shared/ai` and verify `getInstance()` returns the singleton
   - Import `calculateCost`, `AI_FEATURES`, `AI_RATES` and verify they resolve
   - Import `canonicalToAIContext`, `aiToCanonical` and verify they resolve
   - Verify the `/api/ai/chat` route file exists in `apps/web/src/app/api/ai/chat/route.ts`
   - Verify `@anthropic-ai/sdk` appears ONLY in `packages/shared/ai/providers/anthropic.ts` — nowhere else in the codebase
6. Verify no circular dependencies in `packages/shared/ai/` (run `madge --circular packages/shared/ai/` if available, or manually inspect imports)

**Git:** Commit with message `chore(verify): final integration checkpoint [Phase 1H, CP-3]`, then push branch to origin. Open PR to main with title `Phase 1H — AI Service Layer`.

---

## Summary of File Structure Created

```
packages/shared/ai/
├── index.ts                           # Barrel export
├── types.ts                           # Core AI types (CompiledAIRequest, AIResponse, etc.)
├── service.ts                         # AIService singleton
├── config/
│   └── routing.ts                     # Capability routing, feature routing, fallback chains
├── providers/
│   ├── adapter.ts                     # AIProviderAdapter interface
│   ├── anthropic.ts                   # Anthropic SDK adapter
│   └── self-hosted.ts                 # Self-hosted skeleton (post-MVP)
├── prompts/
│   ├── registry.ts                    # PromptRegistry class
│   ├── compiler.ts                    # Provider-specific prompt compilation
│   └── templates/                     # (empty — templates ship with features)
├── tools/
│   └── registry.ts                    # ToolDefinition + ToolRegistry
├── metering/
│   ├── features.ts                    # AIFeature enum (13 values)
│   ├── rates.ts                       # Rate card per model
│   ├── cost-calculator.ts             # calculateCost()
│   ├── usage-logger.ts                # logAIUsage() → ai_usage_log
│   └── credit-ledger.ts              # checkBudget(), deductCredits()
├── streaming/
│   └── stream-adapter.ts             # Vercel AI SDK bridge
└── data-contract/
    ├── index.ts                       # Data contract barrel
    ├── canonical-to-ai.ts             # canonicalToAIContext() for 4 field types
    └── ai-to-canonical.ts             # aiToCanonical() for 4 field types

apps/web/src/app/api/ai/
└── chat/
    └── route.ts                       # SSE streaming endpoint
```
