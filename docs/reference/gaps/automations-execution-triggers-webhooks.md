# Automations — Gap Sections

> **Glossary Reconciliation — 2026-02-27**
> Aligned with `GLOSSARY.md` (source of truth).
> Changes:
>
> - Tagged MVP vs post-MVP scope throughout. Per glossary, MVP automations are **linear** (no branching, no conditions, no loops) with **6 triggers** and **7 actions** only. This doc's expanded trigger/action/condition sets, conditional branching, loops, and AI actions are all **post-MVP**. Content preserved but clearly labeled.
> - Renamed "Portal form submission" → "Form submission" (Forms are a separate concept from Portals per glossary).
> - Renamed "Comms Hub message handler" → "Chat message handler" per glossary naming discipline (❌ "Communications Hub" → ✅ "Chat" for personal messaging).
> - Cross-reference: MVP trigger and action lists are defined in GLOSSARY.md § Automations.

> **SUBSTANTIALLY MERGED (2026-03-01).** Key content from this gap doc has been incorporated into `automations.md`: Execution Model (sequential pipeline, error handling, retry, timeout, checkpointing, concurrency, re-entrant protection), Template Resolution Engine (template sources, type preservation), Webhook Architecture (inbound/outbound, signature verification, delivery pipeline, retry strategy, rate limiting, SSRF protection), and Data Model (automations table, step schema, plan limits). This gap doc retains additional detail (expanded action/condition catalogs for post-MVP, detailed webhook delivery log schema, HMAC consumer-side examples, webhook management UI spec) that serves as extended reference for post-MVP work. **For MVP implementation, use `automations.md` as the primary source.**
>
> Prior: **Merge target:** `automations.md` — add these three sections after the existing builder/triggers/actions/conditions content.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                      | Lines   | Covers                                                                    |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| Execution Model                              | 35–146  | Sequential pipeline, parallel execution, error handling, retry, timeout   |
| Automation Data Model                        | 148–205 | Full automations schema, trigger/step JSONB shapes                        |
| Action Types (22 Total — 7 MVP, 15 post-MVP) | 207–244 | Complete action catalog with parameters                                   |
| Condition Types (5 Total — all post-MVP)     | 246–260 | If/else, switch, filter, exists, compare conditions                       |
| Template Resolution Engine                   | 262–329 | Merge tag resolution, nested field access, formatting                     |
| Trigger Detection                            | 331–403 | Event-driven detection, polling triggers, webhook triggers, deduplication |
| Webhook Architecture                         | 405–702 | Inbound/outbound, signature verification, retry logic, dead letter queue  |
| Phase Implementation                         | 704–711 | Delivery timeline across phases                                           |

---

## Execution Model

Covers Sequential with Conditional Branching (post-MVP — MVP is linear only), Execution Context, Error Handling, Timeout Policy, Checkpointing, Execution Concurrency.
Touches `timed_out` tables.

### Sequential with Conditional Branching (post-MVP — MVP is linear only)

Automations execute as a **sequential pipeline**, not a DAG. Each automation is a flat list of steps evaluated top-to-bottom. Steps can be actions or conditions (if/else branches — **post-MVP**), but there are no parallel forks or merge nodes.

> **MVP note:** MVP automations are strictly linear — a flat list of action steps with no conditions, no branching, and no loops. The conditional branching described below is post-MVP. The sequential execution model, error handling, timeouts, and checkpointing described in this section apply to both MVP and post-MVP.

**Why not DAG:** EveryStack's automation target is SMBs building "when X happens, do Y then Z" workflows — not enterprise iPaaS. A sequential model is easier to build in the visual canvas, easier to debug (linear execution trace), and sufficient for 95%+ of use cases. Parallel execution introduces race conditions, partial failure semantics, and merge-point complexity that are not worth the UX cost.

**Execution flow:**

```
Trigger fires
  → Create execution context: { tenantId, traceId, triggeringUserId, triggerEvent, automationId }
  → Enqueue BullMQ job: automation.execute
  → Worker picks up job:
    Step 1: Action (e.g., "Update Record") → execute → capture output
    Step 2: Condition (e.g., "If Status = Done") → evaluate
      → TRUE branch: Step 3a, 3b, 3c → execute sequentially
      → FALSE branch: Step 4a → execute
    Step 5: Action (e.g., "Send Email") → execute → capture output
    → Execution complete → write execution log → publish event
```

### Execution Context

Every step receives and passes forward an execution context:

```typescript
interface AutomationExecutionContext {
  tenantId: string;
  automationId: string;
  executionId: string; // Unique per run
  traceId: string; // Correlates to the triggering event
  triggeringUserId: string | null; // null for scheduled/webhook triggers
  triggerEvent: TriggerEvent; // The event that started this
  stepOutputs: Map<string, StepOutput>; // Output of previous steps, keyed by stepId
  variables: Record<string, unknown>; // User-defined variables set during execution
  startedAt: Date;
  currentStepIndex: number;
}
```

**Step outputs are accessible:** Each step can reference the output of any previous step. For example, a "Create Record" step in position 2 outputs the new record ID. An "Update Record" step in position 5 can reference `{{step_2.record_id}}` to update that record.

### Error Handling

| Strategy            | When Used                       | Behavior                                                                                                                               |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Stop** (default)  | Any step fails                  | Mark execution as `failed`, stop processing, log the failing step and error, notify automation owner                                   |
| **Skip & Continue** | Per-step setting                | If this step fails, log the error, mark step as `skipped`, continue to next step                                                       |
| **Retry**           | Per-step setting, max 3 retries | Retry the failing step with exponential backoff (1s, 4s, 16s). If all retries fail, fall through to Stop or Skip based on step config. |

**Error types:**

- **Validation error:** Step input doesn't match expected schema (e.g., required field missing). Always stops — this is a configuration error, not a transient failure.
- **External API error:** Outbound webhook, email send, or sync push fails. Retryable.
- **Rate limit error:** External API returned 429. Retryable with backoff.
- **Timeout error:** Step exceeded its timeout. Retryable once, then stop.

### Timeout Policy

| Scope               | Timeout          | Enforcement                                                                                         |
| ------------------- | ---------------- | --------------------------------------------------------------------------------------------------- |
| Single step         | 30 seconds       | BullMQ job timeout per step. Steps that call external APIs (webhooks, email) have this as hard cap. |
| Full automation run | 5 minutes        | Total wall-clock time for all steps. If exceeded, mark execution as `timed_out`, stop processing.   |
| Scheduled job       | Same as full run | No special treatment — timeouts apply equally.                                                      |

### Checkpointing

For automations with many steps (10+), the worker checkpoints progress after each step:

```
Step N completes → write to execution_log: { executionId, stepIndex: N, status: 'completed', output: {...} }
```

If the worker crashes mid-execution, the BullMQ retry picks up the job and resumes from the last checkpoint rather than re-executing completed steps. This prevents duplicate side effects (e.g., sending the same email twice).

**Idempotency keys:** Steps with external side effects (send email, call webhook, create record) include an idempotency key in the execution context: `{executionId}:{stepIndex}`. External services that support idempotency keys use this to deduplicate. For services that don't, the checkpoint prevents re-execution.

### Execution Concurrency

**One execution at a time per automation.** If automation A fires while a previous execution of A is still running, the new execution is queued (not dropped). BullMQ enforces this via `jobId` deduplication: each automation has a dedicated job group with concurrency 1.

**Why:** Parallel executions of the same automation operating on the same table can create race conditions (e.g., two executions both read "Status = Open" and set it to "In Progress," missing the other's write). Sequential execution is simpler to reason about and debug.

**Exception:** Manual trigger with "Run for each selected record" mode enqueues one execution per record. These run with concurrency 4 (parallel across records, but each record's steps are still sequential).

### Re-Entrant Trigger Protection

**The problem:** An automation's action creates or updates a record, which fires a trigger that matches the same automation (or a different automation whose action fires the original). This creates infinite execution loops.

**Solution: execution ancestry tracking.** Every execution carries a `parentExecutionId` (null for the first trigger). When an automation action fires a domain event, the event carries the `executionId`. The trigger registry checks:

```typescript
if (event.sourceExecutionId) {
  const depth = await getExecutionChainDepth(event.sourceExecutionId);
  if (depth >= MAX_AUTOMATION_CHAIN_DEPTH) {
    // Default: 5
    logger.warn({ automationId, depth }, 'Automation chain depth exceeded, skipping');
    return; // Do not enqueue
  }
}
```

**Chain depth limit: 5.** An automation can trigger another automation, which can trigger another, up to 5 levels deep. Beyond that, the event is dropped with a warning logged and the automation owner notified.

---

## Automation Data Model

Covers `automations` Table, Step Schema (within `steps` JSONB array), Plan Limits.
Touches `tenant_id`, `table_id`, `trigger_config`, `rate_limit`, `debounce_ms` tables. See `data-model.md`.

### `automations` Table

| Column                  | Type                   | Purpose                                                                                                                                                                                                              |
| ----------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | UUID                   | Primary key                                                                                                                                                                                                          |
| `tenant_id`             | UUID                   | Tenant scope                                                                                                                                                                                                         |
| `name`                  | VARCHAR                | User-facing name                                                                                                                                                                                                     |
| `description`           | TEXT (nullable)        | Optional description                                                                                                                                                                                                 |
| `table_id`              | UUID (nullable)        | Scoped to a specific table (null for workspace-wide automations like scheduled/webhook)                                                                                                                              |
| `trigger_config`        | JSONB                  | Trigger type + conditions (see Trigger Detection)                                                                                                                                                                    |
| `steps`                 | JSONB                  | Ordered array of step definitions (see Step Schema below)                                                                                                                                                            |
| `environment`           | VARCHAR DEFAULT 'live' | `'live'` or `'sandbox'` — standard sandbox isolation (post-MVP, always 'live' in MVP)                                                                                                                                |
| `status`                | VARCHAR                | `'active'` \| `'paused'` \| `'draft'` — per `data-model.md`. Draft = not yet published. Active = published and firing on triggers. Paused = published but temporarily disabled. Replaces separate `enabled` boolean. |
| `rate_limit`            | INTEGER                | Max executions per minute (default 100)                                                                                                                                                                              |
| `debounce_ms`           | INTEGER                | Debounce window in milliseconds (default 5000)                                                                                                                                                                       |
| `inbound_webhook_token` | VARCHAR(64) (nullable) | Token for inbound webhook URL (only for webhook trigger type)                                                                                                                                                        |
| `created_by`            | UUID                   |                                                                                                                                                                                                                      |
| `created_at`            | TIMESTAMPTZ            |                                                                                                                                                                                                                      |
| `updated_at`            | TIMESTAMPTZ            |                                                                                                                                                                                                                      |

**Why `steps` is JSONB, not a separate table:** The step list is always read and written as a unit (the builder loads all steps, saves all steps). There's no query pattern that needs "find all steps of type X across automations." JSONB keeps the schema simple and the read path fast (single row fetch). The step array can hold up to 50 steps — the hard cap.

### Step Schema (within `steps` JSONB array)

```typescript
interface AutomationStep {
  id: string; // Stable UUID per step (for template references)
  type: 'action' | 'condition';
  position: number; // 0-indexed order
  name: string; // User-facing label
  actionType?: string; // e.g., 'create_record', 'send_email' (when type='action')
  conditionType?: string; // e.g., 'field_value', 'formula' (when type='condition')
  config: Record<string, unknown>; // Action/condition-specific configuration
  errorStrategy: 'stop' | 'skip_continue' | 'retry'; // Default: 'stop'
  maxRetries?: number; // Only when errorStrategy='retry' (max 3)
  trueBranch?: AutomationStep[]; // For conditions: steps to execute if true
  falseBranch?: AutomationStep[]; // For conditions: steps to execute if false
}
```

### Plan Limits

| Plan         | Max Automations | Max Executions/Month | Max Steps/Automation |
| ------------ | --------------- | -------------------- | -------------------- |
| Freelancer   | 5               | 500                  | 10                   |
| Starter      | 15              | 5,000                | 20                   |
| Professional | 50              | 25,000               | 30                   |
| Business     | 200             | 100,000              | 50                   |
| Enterprise   | Unlimited       | Custom               | 50                   |

**Enforcement:** Execution count tracked in `automation_execution_log`. Monthly counter cached in Redis (`auto:exec:{tenantId}:{YYYY-MM}`, TTL 35 days). When limit reached, new executions are rejected with status `quota_exceeded` and the automation owner is notified.

---

## Action Types (22 Total — 7 MVP, 15 post-MVP)

Defines `tableId`, `fieldValues: { fieldId: template }`, `recordSelector`, `fieldUpdates`, `filters`, `sortBy`.

> **MVP actions (per glossary):** Send Email, Create Record, Update Record, Generate Document, Send Notification, Adjust Field Value, Send Webhook. All other actions below are **post-MVP**.

| #   | Action                  | Config Fields                                                                                                 | Output                         | MVP?                       |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------------- |
| 1   | **Create Record**       | `tableId`, `fieldValues: { fieldId: template }`                                                               | `{ recordId, fields }`         | ✅ MVP                     |
| 2   | **Update Record**       | `recordSelector` (trigger record, or lookup), `fieldUpdates`                                                  | `{ recordId, changes }`        | ✅ MVP                     |
| 3   | **Delete Record**       | `recordSelector`                                                                                              | `{ recordId }`                 | Post-MVP                   |
| 4   | **Find Records**        | `tableId`, `filters`, `sortBy`, `limit`                                                                       | `{ records: [...], count }`    | Post-MVP                   |
| 5   | **Link Records**        | `crossLinkFieldId`, `sourceRecordSelector`, `targetRecordSelector`                                            | `{ linked: true }`             | Post-MVP                   |
| 6   | **Unlink Records**      | `crossLinkFieldId`, `sourceRecordSelector`, `targetRecordSelector`                                            | `{ unlinked: true }`           | Post-MVP                   |
| 7   | **Send Email**          | `to` (template), `subject`, `body` (rich text template), `attachments`                                        | `{ messageId }`                | ✅ MVP                     |
| 8   | **Send Webhook**        | `url`, `method`, `headers`, `bodyTemplate`                                                                    | `{ statusCode, responseBody }` | ✅ MVP                     |
| 9   | **Generate Document**   | `templateId`, `recordSelector`, `outputFormat` (PDF/DOCX)                                                     | `{ fileId, fileUrl }`          | ✅ MVP                     |
| 10  | **Create Notification** | `recipientSelector`, `title`, `body`, `link`                                                                  | `{ notificationId }`           | ✅ MVP (Send Notification) |
| 11  | **Set Variable**        | `variableName`, `value` (template)                                                                            | `{ [variableName]: value }`    | Post-MVP                   |
| 12  | **AI: Generate Text**   | `prompt` (template), `model` (capability tier), `maxTokens`                                                   | `{ text, tokensUsed }`         | Post-MVP                   |
| 13  | **AI: Classify**        | `input` (template), `categories[]`, `model`                                                                   | `{ category, confidence }`     | Post-MVP                   |
| 14  | **AI: Extract**         | `input` (template), `schema` (fields to extract), `model`                                                     | `{ extracted: {...} }`         | Post-MVP                   |
| 15  | **AI: Summarize**       | `input` (template), `maxLength`, `model`                                                                      | `{ summary }`                  | Post-MVP                   |
| 16  | **Wait**                | `durationMs` or `untilDate` (template)                                                                        | `{ waitedMs }`                 | Post-MVP                   |
| 17  | **Loop (For Each)**     | `collection` (template → array), `steps[]`                                                                    | `{ iterations, results[] }`    | Post-MVP                   |
| 18  | **Run Automation**      | `targetAutomationId`, `inputVariables`                                                                        | `{ executionId, status }`      | Post-MVP                   |
| 19  | **Update Portal**       | `portalId`, `config changes`                                                                                  | `{ portalId }`                 | Post-MVP                   |
| 20  | **Log to Activity**     | `message` (template), `level` (info/warning)                                                                  | `{ logged: true }`             | Post-MVP                   |
| 21  | **HTTP Request**        | `url`, `method`, `headers`, `body`, `responseMapping`                                                         | `{ statusCode, mappedFields }` | Post-MVP                   |
| 22  | **Convert Field Value** | `sourceField`, `targetField`, `transformFn` (predefined: uppercase, lowercase, trim, parseNumber, formatDate) | `{ oldValue, newValue }`       | Post-MVP                   |

> **Note:** The glossary's MVP action "Adjust Field Value" (atomic increment/decrement on a number field) is not listed in this expanded 22-action table. It should be added as an MVP action. "Convert Field Value" (#22) is a different operation (string/format transforms) and is post-MVP.

**Action #17 (Loop)** executes its nested `steps[]` once per item in the collection. Max iterations: 1,000. The loop body's steps can reference `{{loop.currentItem}}`, `{{loop.index}}`, and `{{loop.total}}`.

**Action #18 (Run Automation)** is subject to chain depth protection (see Re-Entrant Trigger Protection). It enqueues the target automation synchronously within the same execution and waits for completion (max 5 minutes). If the target automation fails, the calling step fails according to its error strategy.

---

## Condition Types (5 Total — all post-MVP)

> **Post-MVP.** Per glossary, MVP automations are linear with no conditions or branching. All condition types below are post-MVP.

| #   | Condition                      | Evaluation                                                                                                                     |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Field Value**                | `{fieldId} {operator} {value}` — same operators as view filters (eq, neq, contains, gt, lt, in, is_empty, etc.)                |
| 2   | **Formula**                    | Arbitrary formula expression evaluated against the trigger record (reuses formula engine parser + evaluator)                   |
| 3   | **Record in View**             | Does the trigger record match a view's filter criteria? Evaluates the view's filter against the record's current field values. |
| 4   | **Step Output**                | `{{step_N.fieldName}} {operator} {value}` — condition based on a previous step's output                                        |
| 5   | **Always True / Always False** | For testing and builder drafts — unconditional branch routing                                                                  |

Conditions always have `trueBranch` and `falseBranch` (either can be empty = no-op).

---

## Template Resolution Engine

Step configs use `{{...}}` template syntax to reference dynamic values. Templates are resolved at execution time, not at definition time.

### Template Sources

| Syntax                                             | Resolves To                                                     |
| -------------------------------------------------- | --------------------------------------------------------------- |
| `{{trigger.record}}`                               | The full trigger record (canonical_data)                        |
| `{{trigger.record.fields.{fieldId}}}`              | A specific field value from the trigger record                  |
| `{{trigger.changedFields}}`                        | Array of field IDs that changed (for `record.updated` triggers) |
| `{{trigger.webhookPayload}}`                       | Inbound webhook body (for webhook triggers)                     |
| `{{trigger.webhookPayload.fieldName}}`             | Specific field from inbound webhook body                        |
| `{{step_{id}.output}}`                             | Full output object of a previous step                           |
| `{{step_{id}.output.recordId}}`                    | Specific field from a previous step's output                    |
| `{{step_{id}.output.records[0].fields.{fieldId}}}` | Nested access into step output                                  |
| `{{var.{variableName}}}`                           | User-defined variable (set via "Set Variable" action)           |
| `{{loop.currentItem}}`                             | Current item in a Loop action                                   |
| `{{loop.index}}`                                   | Current iteration index (0-based)                               |
| `{{env.tenantId}}`                                 | Execution context metadata                                      |
| `{{env.executionId}}`                              | Execution ID                                                    |
| `{{env.now}}`                                      | Current ISO timestamp                                           |

### Resolution Implementation

```typescript
function resolveTemplate(template: string, ctx: AutomationExecutionContext): unknown {
  // 1. Find all {{...}} patterns
  // 2. For each, parse the dot-path
  // 3. Resolve against ctx.triggerEvent, ctx.stepOutputs, ctx.variables
  // 4. If the entire template is a single {{...}} reference, return the raw value (preserves types)
  // 5. If the template mixes text + {{...}}, string-interpolate (coerce values to strings)
  // 6. Unresolvable references → null (not error — allows graceful handling in conditions)
}
```

**Type preservation:** `{{step_3.output.recordId}}` in a field that expects a UUID returns the raw string UUID, not a stringified version. `{{step_4.output.amount}}` in a number field returns the number. Only when templates are embedded in text (`"Hello {{trigger.record.fields.name}}"`) are values coerced to strings.

### Execution Logging

Every execution writes to `automation_execution_log`:

| Column          | Type                   | Purpose                                                         |
| --------------- | ---------------------- | --------------------------------------------------------------- |
| `id`            | UUID                   | Execution ID                                                    |
| `tenant_id`     | UUID                   |                                                                 |
| `automation_id` | UUID                   |                                                                 |
| `trigger_event` | JSONB                  | What triggered this run                                         |
| `status`        | VARCHAR                | `running`, `completed`, `failed`, `timed_out`, `cancelled`      |
| `started_at`    | TIMESTAMPTZ            |                                                                 |
| `completed_at`  | TIMESTAMPTZ (nullable) |                                                                 |
| `steps`         | JSONB[]                | Array of `{ stepId, status, input, output, error, durationMs }` |
| `trace_id`      | VARCHAR                | Correlation ID for observability                                |

Managers can view execution history per automation and drill into individual runs to see step-by-step results and errors.

### Dry Run

Before activating an automation, Managers can run a **dry run** that:

1. Simulates the trigger with a real or sample record
2. Evaluates all conditions (shows which branches would be taken)
3. Previews action outputs without executing side effects
4. Shows the complete execution trace with timing estimates

Dry run results are shown in the builder UI inline, with each step annotated "Would execute" or "Would skip."

---

## Trigger Detection

Covers How the System Detects Triggers, Trigger Sources, Automation Trigger Registry, Event Flow: Trigger → Execution, Deduplication.

> **MVP scope:** Per glossary, MVP includes 6 triggers: Record Created, Record Updated, Field Value Changed, Form Submitted, Button Clicked, Scheduled. The additional triggers below (Record Deleted, Record Enters View, Webhook Received, Manual Trigger, Date Condition Met, Status Changed, Chat Keyword) are **post-MVP**.

### How the System Detects Triggers

Triggers are detected at the **application layer**, not via database triggers or CDC. This is deliberate — application-layer hooks give us context (who triggered it, via which feature, with what intent) that DB-level triggers cannot provide.

### Trigger Sources

| Trigger Type                      | Detection Mechanism                                                                                                                                   | Latency                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Record created**                | Server Action / sync job publishes `record.created` to Redis pub/sub after DB write                                                                   | <1 second                |
| **Record updated**                | Server Action / sync job publishes `record.updated` with changed fields                                                                               | <1 second                |
| **Record deleted**                | Server Action publishes `record.deleted`                                                                                                              | <1 second                |
| **Field value matches condition** | Evaluated on `record.updated` — the automation engine checks if the new field value matches the trigger condition                                     | <1 second                |
| **Record enters view**            | Evaluated on `record.updated` — checks if the updated record now matches a view's filter criteria                                                     | <2 seconds               |
| **Scheduled (cron)**              | BullMQ repeatable job runs the cron expression. On fire, the job queries for records matching the automation's scope and enqueues execution for each. | Depends on cron schedule |
| **Webhook received**              | Route handler at `/api/webhooks/automation/{automationId}` receives POST, validates HMAC signature, enqueues execution                                | <1 second                |
| **Manual trigger**                | Manager clicks "Run now" in automation builder. Enqueues execution for selected records.                                                              | Immediate                |
| **Form submitted**                | Form submission publishes `form.submitted` event                                                                                                      | <1 second                |
| **Date condition met**            | Daily BullMQ cron job scans records with date fields matching "X days before/after {date field}" conditions.                                          | Checked every 15 minutes |
| **Status changed**                | Subset of "field value matches condition" — specifically when a status/select field changes from one value to another                                 | <1 second                |
| **Chat keyword** (post-MVP)       | Chat message handler checks new messages against automation keyword triggers                                                                          | <2 seconds               |

### Automation Trigger Registry

Active automation triggers are indexed in an in-memory registry (loaded from DB on worker startup, refreshed on automation CRUD):

```typescript
interface TriggerRegistry {
  // Returns automations that should fire for this event
  getMatchingAutomations(event: DomainEvent): AutomationTrigger[];
}

// Internal index structure (conceptual)
// eventType → tableId → automationTrigger[]
// Enables O(1) lookup: when record.updated fires for table X, instantly find all automations watching table X for record updates
```

**Why in-memory:** Checking every event against every automation trigger via DB query would be too slow and too many queries. The registry is a small data structure (even 1,000 automations → ~50KB in memory) that enables instant matching.

**Refresh strategy:**

- On automation create/update/delete: publish `automation.changed` event → all worker instances refresh their registry
- On worker startup: full load from DB
- Periodic full refresh every 5 minutes as safety net

### Event Flow: Trigger → Execution

```
Domain event occurs (e.g., record.updated)
  → Published to Redis pub/sub: channel 'events:{tenantId}'
  → Worker's event listener receives event
  → TriggerRegistry.getMatchingAutomations(event) → [automation1, automation2]
  → For each matching automation:
      → Evaluate trigger conditions (field value checks, view membership checks)
      → If conditions met:
          → Enqueue BullMQ job: automation.execute with executionContext
          → Respect automation's rate limit (max N executions per minute, configurable)
```

### Deduplication

Rapid-fire events (e.g., bulk record import creating 500 records in 10 seconds) can trigger the same automation hundreds of times. Deduplication strategies:

- **Debounce window:** Automations have a configurable debounce (default: 5 seconds). If the same trigger fires multiple times within the window, only the last event enqueues execution.
- **Batch mode:** For "record created" triggers during bulk operations, the automation receives a batch of record IDs rather than firing once per record. The execution iterates over the batch.
- **Rate cap:** Maximum 100 executions per automation per minute. Excess events are queued and processed after the cap window resets.

---

## Webhook Architecture

Covers Feature 1: Workspace-Level Event Webhooks, Feature 2: Automation Action "Send Webhook", Inbound Webhook Receiving, Webhook Endpoint Management, `webhook_endpoints` Table, Delivery Pipeline.
Touches `api_version`, `webhook_endpoints`, `tenant_id`, `signing_secret`, `subscribed_events` tables.

> **MVP scope:** The "Send Webhook" automation action (outbound POST to a URL) is MVP. The full workspace-level event webhook subscription system (endpoint registration, event catalog, delivery pipeline) and inbound webhook triggers are **post-MVP** infrastructure that supports the MVP action and extends it.

EveryStack has two distinct webhook features. They share delivery infrastructure but serve different purposes.

### Feature 1: Workspace-Level Event Webhooks

**What it is:** A developer/integration feature. Managers (or API consumers) register endpoint URLs and subscribe to platform events. Whenever a subscribed event occurs in the workspace, EveryStack delivers a POST to all matching endpoints. This is how external systems stay in sync with EveryStack data — CRMs, analytics pipelines, notification services, MCP server event streams.

**Event catalog (subscribable):**

| Event                  | Payload `data` Shape                                                                         | When Fired                                       |
| ---------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `record.created`       | `{ tableId, recordId, fields: { fieldId: canonicalValue, ... }, createdBy: { type, id } }`   | Record inserted (user, sync, automation, portal) |
| `record.updated`       | `{ tableId, recordId, changes: [{ fieldId, oldValue, newValue }], updatedBy: { type, id } }` | Record field(s) changed                          |
| `record.deleted`       | `{ tableId, recordId, deletedBy: { type, id } }`                                             | Record soft-deleted                              |
| `table.created`        | `{ tableId, name, baseId }`                                                                  | Table created                                    |
| `table.deleted`        | `{ tableId, name }`                                                                          | Table deleted                                    |
| `field.created`        | `{ tableId, fieldId, name, fieldType }`                                                      | Field added                                      |
| `field.updated`        | `{ tableId, fieldId, changes: { name?, fieldType?, config? } }`                              | Field modified                                   |
| `portal.published`     | `{ portalId, slug, publishedBy }`                                                            | Portal goes live                                 |
| `automation.triggered` | `{ automationId, executionId, triggerType }`                                                 | Automation starts execution                      |
| `automation.completed` | `{ automationId, executionId, status, stepsRun, durationMs }`                                | Automation finishes                              |
| `sync.completed`       | `{ tableId, syncConnectionId, recordsCreated, recordsUpdated, recordsDeleted }`              | Sync batch completes                             |
| `member.added`         | `{ userId, role }`                                                                           | User joins workspace                             |
| `member.removed`       | `{ userId }`                                                                                 | User removed from workspace                      |

**Payload envelope (same for all events):**

```json
{
  "event": "record.updated",
  "timestamp": "2026-02-12T10:30:00.000Z",
  "webhook_id": "uuid-of-endpoint",
  "delivery_id": "uuid-unique-per-attempt",
  "workspace_id": "uuid-of-tenant",
  "api_version": "2026-02-01",
  "data": {
    /* event-specific, see table above */
  }
}
```

The `api_version` field enables future payload evolution without breaking existing consumers. All consumers built against `2026-02-01` see a stable contract. New fields can be added (additive), but removals or renames require a version bump with a deprecation period.

### Feature 2: Automation Action "Send Webhook"

**What it is:** An automation step. The Manager configures a target URL and payload template in the automation builder. When the automation runs and reaches this step, it sends a POST with a user-defined payload. This is for ad-hoc integrations — "when a deal closes, POST to Slack" or "when a task is overdue, notify PagerDuty."

**Key differences from workspace-level webhooks:**

| Aspect        | Workspace-Level                         | Automation Action                                             |
| ------------- | --------------------------------------- | ------------------------------------------------------------- |
| Configuration | Workspace Settings → Integrations       | Per-automation step in builder                                |
| Trigger       | Any subscribed platform event           | Only when the automation reaches that step                    |
| Payload       | Fixed schema per event type             | User-configurable template with `{{step_N.field}}` references |
| HMAC signing  | Yes (workspace signing secret)          | Yes (per-endpoint or automation-level secret)                 |
| Retry         | Standard retry policy (5 attempts)      | Step-level retry policy (configurable, max 3 retries)         |
| Shared infra  | Same BullMQ queue, same delivery worker | Same BullMQ queue, same delivery worker                       |

**Shared delivery pipeline:** Both features enqueue jobs on the same `webhook.deliver` BullMQ queue. The delivery worker doesn't care which feature originated the job — it processes the same way (build payload, sign, POST, evaluate response, retry if needed).

---

### Inbound Webhook Receiving

External systems can trigger automations by POSTing to a dedicated inbound webhook URL.

**URL structure:** `POST /api/webhooks/automation/{automationId}/{webhookToken}`

- `automationId`: identifies which automation to trigger
- `webhookToken`: a random 32-character token generated per-automation, separate from the automation ID. This prevents URL guessing — knowing the automation ID alone is not enough.

**Route handler location:** `apps/web/src/app/api/webhooks/automation/[automationId]/[webhookToken]/route.ts`

**Authentication model:** The `webhookToken` in the URL serves as the primary auth. Optionally, the external caller can also provide an HMAC signature in `X-Webhook-Signature` header, verified against a per-automation signing secret that the Manager configures. The HMAC is optional because many external systems (Zapier, Make, simple curl scripts) cannot easily compute HMAC signatures.

**Inbound processing flow:**

```
POST /api/webhooks/automation/{automationId}/{webhookToken}
  → Route handler (excluded from Clerk auth middleware):
    1. Validate webhookToken matches the automation's stored token
    2. If automation has a signing secret AND request has X-Webhook-Signature:
       → Verify HMAC-SHA256(secret, rawBody) — reject if mismatch
    3. Rate limit check: max 60 inbound webhook calls per automation per minute (Redis counter)
    4. Parse request body as JSON (reject if >256KB or invalid JSON)
    5. Validate automation exists, has `status = 'active'`, and has a "webhook received" trigger
    6. Enqueue BullMQ job: automation.execute
       → triggerEvent includes the inbound payload in `webhookPayload` field
       → actorType: 'system' (external webhook, no EveryStack user)
    7. Return 202 Accepted with { "execution_id": "uuid" }
       → Immediate response — execution is async
```

**The inbound payload is available to automation steps** via `{{trigger.webhookPayload.fieldName}}` template syntax. The automation builder shows the most recent inbound payload as a sample for field mapping.

**Security:**

- Excluded from Clerk auth middleware (external callers have no Clerk session)
- Token in URL is the access control — revocable by regenerating in the automation settings
- Optional HMAC for callers that support it
- 256KB body size limit (reject larger payloads before parsing)
- Rate limited per-automation (60/min default, configurable by plan)

---

### Webhook Endpoint Management

Managers configure webhook endpoints in workspace settings (for workspace-level webhooks) or per-automation (for the action step):

```typescript
interface WebhookEndpoint {
  id: string;
  tenantId: string;
  url: string; // Target URL (HTTPS required in production)
  description: string; // Manager's label for this endpoint
  signingSecret: string; // Generated per-endpoint, used for HMAC
  subscribedEvents: string[]; // For workspace-level: which events trigger delivery
  status: 'active' | 'disabled' | 'auto_disabled';
  consecutiveFailures: number; // Resets on success
  autoDisableThreshold: number; // Default 10
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  createdBy: string;
}
```

### `webhook_endpoints` Table

| Column                   | Type        | Purpose                                                    |
| ------------------------ | ----------- | ---------------------------------------------------------- |
| `id`                     | UUID        |                                                            |
| `tenant_id`              | UUID        |                                                            |
| `url`                    | VARCHAR     | Target URL (HTTPS required in production)                  |
| `description`            | VARCHAR     | Manager's label                                            |
| `signing_secret`         | VARCHAR     | HMAC-SHA256 secret (generated on creation, 32 bytes hex)   |
| `subscribed_events`      | VARCHAR[]   | Event types (e.g., `['record.created', 'record.updated']`) |
| `status`                 | VARCHAR     | `active`, `disabled`, `auto_disabled`                      |
| `consecutive_failures`   | INTEGER     | Resets on success                                          |
| `auto_disable_threshold` | INTEGER     | Default 10                                                 |
| `created_by`             | UUID        |                                                            |
| `created_at`             | TIMESTAMPTZ |                                                            |

### Delivery Pipeline

```
Event occurs (platform event or automation step "Send Webhook")
  → Enqueue BullMQ job: webhook.deliver
  → Worker picks up job:
    1. URL safety check (see Security section below — reject private IPs, internal hosts)

    2. Build payload:
       {
         "event": "record.updated",
         "timestamp": "2026-02-12T10:30:00.000Z",
         "webhook_id": "uuid",
         "delivery_id": "uuid",
         "workspace_id": "uuid",
         "api_version": "2026-02-01",
         "data": { /* event-specific payload */ }
       }

    3. Compute HMAC signature:
       signature = HMAC-SHA256(signing_secret, JSON.stringify(payload))

    4. Send HTTP POST:
       POST {endpoint.url}
       Content-Type: application/json
       User-Agent: EveryStack-Webhooks/1.0
       X-EveryStack-Signature: sha256={signature}
       X-EveryStack-Delivery-Id: {deliveryId}
       X-EveryStack-Timestamp: {timestamp}
       Body: {payload}

    5. Evaluate response:
       - 2xx → success, reset consecutive_failures, log delivery
       - 4xx (not 429) → permanent failure, log, increment consecutive_failures
       - 429 → rate limited, retry with Retry-After header or exponential backoff
       - 5xx → transient failure, retry with exponential backoff
       - Timeout (10s) → transient failure, retry
```

### Retry Strategy

| Attempt           | Delay      | Total Elapsed |
| ----------------- | ---------- | ------------- |
| 1st retry         | 30 seconds | 30s           |
| 2nd retry         | 2 minutes  | 2.5 minutes   |
| 3rd retry         | 10 minutes | 12.5 minutes  |
| 4th retry         | 1 hour     | ~1 hour       |
| 5th retry (final) | 4 hours    | ~5 hours      |

After 5 failed attempts, the delivery is marked as `failed` and logged. The webhook endpoint's `consecutive_failures` counter increments. At `auto_disable_threshold` (default 10) consecutive failures across any deliveries, the endpoint is auto-disabled and the Manager receives an in-app notification: "Webhook to {url} has been auto-disabled after {N} consecutive failures."

### Outbound Rate Limiting

Bulk operations can generate massive webhook volume. Without throttling, a 500-record import with 10 subscribed endpoints creates 5,000 delivery jobs instantly.

**Per-tenant outbound cap:** Maximum 1,000 webhook deliveries per tenant per minute. Excess deliveries are queued (not dropped) and processed as capacity frees up. This protects both EveryStack's outbound bandwidth and the consumer's servers.

**Per-endpoint throttle:** Maximum 100 deliveries per endpoint per minute. If a single endpoint is the bottleneck, other endpoints in the same workspace are unaffected.

**Bulk event condensation:** When the same event type fires for >50 records within a 5-second window (e.g., bulk import), the platform delivers a single batch webhook instead of individual deliveries:

```json
{
  "event": "record.created.batch",
  "data": {
    "tableId": "uuid",
    "count": 237,
    "record_ids": ["uuid1", "uuid2", "..."],
    "truncated": false
  }
}
```

Consumers that need per-record payloads can fetch individual records via the API using the IDs in the batch event. The `record_ids` array is capped at 1,000 entries; `truncated: true` if more.

### Delivery Logging

Every delivery attempt (including retries) is logged:

### `webhook_delivery_log` Table

| Column                | Type               | Purpose                                                                                         |
| --------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `id`                  | UUID               | Delivery ID (matches `X-EveryStack-Delivery-Id` header)                                         |
| `tenant_id`           | UUID               |                                                                                                 |
| `webhook_endpoint_id` | UUID               |                                                                                                 |
| `event_type`          | VARCHAR            | e.g., `record.updated`                                                                          |
| `payload`             | JSONB              | Full payload sent                                                                               |
| `attempt`             | INTEGER            | 1-based attempt number                                                                          |
| `status_code`         | INTEGER (nullable) | HTTP response code (null if timeout/connection error)                                           |
| `response_body`       | TEXT (nullable)    | First 1KB of response body (for debugging)                                                      |
| `error_message`       | TEXT (nullable)    | Internal error description if delivery failed before HTTP (DNS, connection refused, SSRF block) |
| `duration_ms`         | INTEGER            | Round-trip time                                                                                 |
| `status`              | VARCHAR            | `success`, `failed`, `retrying`                                                                 |
| `created_at`          | TIMESTAMPTZ        |                                                                                                 |

**Retention:** 30 days. Older delivery logs are pruned by a daily BullMQ cron job.

### Security

**SSRF protection on outbound URLs:** Before making any outbound HTTP request, the delivery worker validates the resolved IP address:

```typescript
// Blocked IP ranges — never deliver webhooks to these
const BLOCKED_RANGES = [
  '127.0.0.0/8', // Loopback
  '10.0.0.0/8', // Private (RFC 1918)
  '172.16.0.0/12', // Private (RFC 1918)
  '192.168.0.0/16', // Private (RFC 1918)
  '169.254.0.0/16', // Link-local
  '0.0.0.0/8', // "This" network
  '::1/128', // IPv6 loopback
  'fc00::/7', // IPv6 private
  'fe80::/10', // IPv6 link-local
];
```

**Implementation:** DNS-resolve the endpoint URL hostname, check the resolved IP against blocked ranges BEFORE opening the TCP connection. If the IP is blocked, fail the delivery immediately with error `ssrf_blocked` — no retry. Log the attempt.

**Additional security measures:**

- HTTPS required for all endpoint URLs in production (HTTP allowed in development only)
- Redirect following disabled — delivery worker does not follow 3xx redirects (prevents SSRF via redirect)
- Response body limited to 1KB capture (prevents memory exhaustion from large responses)
- Connection timeout: 5 seconds. Read timeout: 10 seconds.

### HMAC Signature Verification (Consumer Side)

Webhook consumers verify the signature to ensure the request is genuinely from EveryStack:

```
Expected = HMAC-SHA256(signing_secret, raw_request_body)
Received = X-EveryStack-Signature header (strip "sha256=" prefix)
Valid = timing-safe comparison of Expected vs Received
```

**Timestamp validation:** Consumers should also check `X-EveryStack-Timestamp` and reject deliveries older than 5 minutes (prevents replay attacks). EveryStack's webhook documentation provides verification code examples in JavaScript, Python, Ruby, and Go.

### Webhook Management UI

Managers access webhook settings from Workspace Settings → Integrations → Webhooks:

- **Create endpoint:** URL + select events + optional description
- **Signing secret:** Shown once on creation, can be regenerated (invalidates old secret immediately)
- **Test delivery:** Send a test event to verify the endpoint is reachable and signature verification works
- **Delivery log:** Table view of recent deliveries with status, response code, duration, and retry count. Filterable by endpoint, event type, status, and date range.
- **Re-send:** Manager can manually re-send a failed delivery
- **Disable/Enable:** Toggle without deleting. Auto-disabled endpoints show a warning badge with the failure count.

---

## Phase Implementation

> **Note:** Per glossary, the MVP automation builder is a simple step-by-step list builder (not a visual canvas). The visual builder, 12 trigger types, 22 action types, and 5 condition types described in Post-MVP — Automations below represent the **post-MVP** expansion.

| Phase                                | Automations Work                                                                                                                                                                                                                                                                                |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Post-MVP — Automations (Weeks 23-28) | **(Post-MVP)** Visual builder, trigger detection system, execution engine (sequential + conditions), error handling (stop/skip/retry), dry run, execution logging, outbound webhook delivery, webhook endpoint management UI. All 12 trigger types. All 22 action types. All 5 condition types. |
| Post-MVP — Automations+              | **(Post-MVP)** AI-powered automation building (describe workflow in natural language → generate automation), MCP server event hooks (trigger automations from external MCP clients).                                                                                                            |
