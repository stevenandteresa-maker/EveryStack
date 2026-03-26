---
name: everystack-ai
description: >
  AI feature patterns for EveryStack's intelligent workspace capabilities.
  Use this skill for ANY prompt that integrates LLM providers, builds AI-powered
  features, touches the Schema Descriptor Service (SDS), implements credit
  metering, or creates AI field agents. Triggers on: AIService calls, prompt
  engineering, Smart Fill, natural language search, record summarization,
  document AI draft, field/link suggestions, DuckDB context layer, credit
  system, or anything in packages/shared/ai. Also use when building the
  AI affordance UI (suggestion chips, confidence indicators, inline AI buttons).
  If a prompt makes an LLM API call or presents AI-generated content to users,
  this skill applies.
---

# EveryStack AI Features Skill

This skill encodes the AI integration patterns for EveryStack. It governs
how Claude Code should build AI-powered features, manage LLM providers,
meter credits, and present AI outputs to users.

## When to Use This Skill

- **Always** for Phase 5 (MVP — AI)
- **Always** when a prompt in any phase adds an AI affordance to existing UI
- **Combine with backend skill** for AIService plumbing
- **Combine with UX/UI skill** for AI affordance components

---

## AIService Architecture

Covers Provider Abstraction, Canonical Data Contract, Schema Descriptor Service (SDS).

### Provider Abstraction

```
packages/shared/ai/
├── service.ts           → AIService class (singleton per tenant)
├── providers/
│   ├── anthropic.ts     → Claude API adapter
│   ├── openai.ts        → OpenAI API adapter (future)
│   └── types.ts         → Provider interface
├── prompts/
│   ├── smart-fill.ts    → Prompt templates for Smart Fill
│   ├── summarize.ts     → Record summarization prompts
│   ├── search.ts        → Natural language search prompts
│   └── draft.ts         → Document AI draft prompts
├── tools/               → AI tool definitions (function calling)
├── metering/
│   ├── credit-system.ts → Credit tracking and enforcement
│   └── usage-log.ts     → Usage logging for billing
└── eval/                → Prompt evaluation utilities
```

**Rules:**
- All LLM calls go through `AIService` — never call provider APIs directly
- `AIService` handles: provider selection, rate limiting, credit deduction,
  usage logging, error handling, and retry logic
- The skeleton is built in Phase 1D — Phase 5 connects it to features

### Canonical Data Contract

AI features receive workspace context through a standardized contract:

```typescript
interface AIContext {
  workspace: {
    id: string;
    name: string;
    schema: SDSOutput; // From Schema Descriptor Service
  };
  record?: {
    id: string;
    tableName: string;
    fields: Record<string, { name: string; type: string; value: unknown }>;
  };
  relatedRecords?: Array<{
    tableName: string;
    linkField: string;
    records: Array<Record<string, unknown>>;
  }>;
}
```

**Rule:** AI features never query the database directly. They receive
context through `AIContext`, which the calling feature assembles.

### Schema Descriptor Service (SDS)

The SDS produces an LLM-optimized representation of the workspace schema:

```typescript
import { getSchemaDescriptor } from '@/ai/sds';

const sds = await getSchemaDescriptor(tenantId);
// Returns: tables, fields, relationships, constraints
// in a compact format optimized for LLM context windows
```

**SDS is cached** per tenant with a 5-minute TTL. Schema changes
invalidate the cache. The SDS output is included in `AIContext.workspace.schema`.

---

## Credit System

Covers Metering Model, Credit Enforcement, Usage Logging.
Touches `ai_usage_log` tables.

### Metering Model

Every AI operation costs credits. Credit costs are defined per operation type:

| Operation | Credit Cost | Notes |
|-----------|-------------|-------|
| Smart Fill (single field) | 1 | Per field filled |
| Record Summarization | 2 | Per record |
| Natural Language Search | 1 | Per query |
| Document AI Draft | 5 | Per draft generation |
| Field/Link Suggestion | 1 | Per suggestion set |

### Credit Enforcement

```typescript
// Before any AI operation:
const canProceed = await creditSystem.checkAndDeduct(tenantId, operationType);
if (!canProceed) {
  throw new AppError(ErrorCode.CREDITS_EXHAUSTED, 'AI credits depleted');
}
```

**Rules:**
- Check credits BEFORE making the LLM call, not after
- Deduction is atomic — no partial charges on failure
- Credit balance is shown in the workspace header (small pill badge)
- When credits are low (<10%), show a warning banner
- When credits are zero, AI features degrade gracefully:
  the buttons remain visible but show "No credits remaining" on click

### Usage Logging

Every AI call is logged to `ai_usage_log`:
```sql
ai_usage_log: id, tenant_id, user_id, operation_type, credits_used,
  provider, model, input_tokens, output_tokens, latency_ms, created_at
```

---

## AI Affordance UI Patterns

Covers Inline AI Buttons, Loading / Streaming States, Confidence Indicators.

### Inline AI Buttons

AI features surface as small, unobtrusive buttons near their trigger context:

- **Smart Fill:** Sparkle icon next to empty fields in Record View
- **Summarize:** Sparkle icon in the record header area
- **AI Draft:** Sparkle icon in the Smart Doc toolbar
- **Search:** AI mode toggle in the Command Bar

**Pattern:**
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-6 w-6 text-muted-foreground hover:text-primary"
  onClick={handleAIAction}
  disabled={creditsRemaining <= 0}
  title={creditsRemaining <= 0 ? 'No AI credits remaining' : 'Smart Fill'}
>
  <Sparkles className="h-3.5 w-3.5" />
</Button>
```

### Loading / Streaming States

AI operations show progress through three states:

1. **Thinking:** Pulsing sparkle animation + "Thinking..." text
2. **Streaming:** Content appears progressively (for text generation)
3. **Complete:** Content solidifies, sparkle becomes static checkmark

**Rule:** Never show a blank loading spinner for AI operations.
Always show the "Thinking..." state so users know AI is working.

### Confidence Indicators

When AI suggests values (Smart Fill, link suggestions):
- High confidence (>0.8): Suggested value shown directly, one-click accept
- Medium confidence (0.5–0.8): Suggested value shown with "Suggested" badge
- Low confidence (<0.5): Not shown to user (log for evaluation)

---

## DuckDB Context Layer (Post-MVP, but architected now)

> This ships post-MVP but the AIContext interface should accommodate it.

The DuckDB context layer will provide fast analytical queries over tenant
data for AI features that need aggregate context (e.g., "summarize trends
across all records in this table"). The `AIContext` interface includes
an optional `analytics` field for this future capability:

```typescript
interface AIContext {
  // ... existing fields ...
  analytics?: {
    source: 'duckdb';
    query: string;
    results: unknown[];
  };
}
```

**Rule for MVP:** Do NOT build the DuckDB layer. Do NOT import DuckDB.
Just ensure the `AIContext` type has the optional `analytics` field so
the interface doesn't break when it's added post-MVP.

---

## Prompt Engineering Conventions

### Template Structure

All prompt templates follow this pattern:

```typescript
// packages/shared/ai/prompts/smart-fill.ts
export function buildSmartFillPrompt(context: AIContext, fieldId: string) {
  const field = context.record?.fields[fieldId];
  return {
    system: `You are a data assistant for a workspace management tool.
You fill in missing field values based on the record's context.
Only return the field value — no explanation, no formatting.`,
    user: `
Workspace schema:
${context.workspace.schema.compact()}

Record: ${context.record?.tableName}
Existing fields:
${Object.entries(context.record?.fields ?? {})
  .filter(([id]) => id !== fieldId)
  .map(([, f]) => `- ${f.name} (${f.type}): ${f.value}`)
  .join('\n')}

Fill in the value for: ${field?.name} (type: ${field?.type})
`,
  };
}
```

**Rules:**
- System prompts are short and role-defining
- User prompts include the SDS schema context
- Prompt templates are pure functions — no side effects
- Templates live in `packages/shared/ai/prompts/`
- Test prompts with eval utilities before shipping

---

## Checklist Before Every AI Commit

- [ ] All LLM calls go through AIService (no direct provider calls)
- [ ] Credit check happens BEFORE the LLM call
- [ ] Usage logged to ai_usage_log
- [ ] AI affordance uses sparkle icon pattern (not custom icons)
- [ ] Loading state shows "Thinking..." (not blank spinner)
- [ ] Zero-credit state degrades gracefully (button visible, disabled)
- [ ] Prompt template is a pure function in packages/shared/ai/prompts/
- [ ] AIContext assembled by the calling feature (AI doesn't query DB)
- [ ] No DuckDB imports or analytical queries (post-MVP)
