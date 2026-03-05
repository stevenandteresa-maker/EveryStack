# EveryStack — Automations Architecture

> **Reference doc.** MVP automation system: step-by-step list builder, 6 triggers, 7 actions, linear execution engine, template resolution, webhook architecture, testing/debugging.
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (automations, automation_runs schema), `email.md` (Send Email action details), `smart-docs.md` (Generate Document action), `communications.md` (Send Notification action)
> Last updated: 2026-02-27 — Aligned with GLOSSARY.md. Scoped to MVP: 6 triggers, 7 actions, linear flows only. Replaced visual canvas with step-by-step list builder. Removed conditions/branching, lifecycle workflows, recipes. Full 22-trigger/42-action spec preserved in session archives.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                    | Lines   | Covers                                                                             |
| -------------------------- | ------- | ---------------------------------------------------------------------------------- |
| MVP Scope                  | 29–57   | 6 triggers, 7 actions, linear flows only, no branching                             |
| Builder Interface          | 58–115  | Step-by-step list builder UI, trigger/action configuration                         |
| Triggers (6 MVP Types)     | 116–178 | Record Created, Updated, Field Changed, Form Submitted, Button Clicked, Scheduled  |
| Actions (7 MVP Types)      | 179–208 | Send Email, Create/Update Record, Generate Document, Notify, Adjust Field, Webhook |
| Execution Model            | 209–293 | Sequential pipeline, BullMQ jobs, error handling, retry logic                      |
| Template Resolution Engine | 294–318 | Merge tag resolution in automation actions, dynamic values                         |
| Webhook Architecture       | 319–422 | Inbound/outbound webhooks, signature verification, delivery retry                  |
| Testing & Debugging        | 423–447 | Automation test mode, execution log, step-by-step replay                           |
| Data Model                 | 448–511 | automations, automation_runs tables, trigger/steps JSONB schemas                   |
| Post-MVP Expansion Path    | 512–526 | Visual canvas, branching, conditions, loops, 22+ triggers, 42+ actions             |

---

## MVP Scope

**What ships:**

- Linear trigger → action flows (no branching, no conditions)
- 6 trigger types
- 7 action types
- Step-by-step list builder UI (not visual canvas)
- Execution engine with error handling, checkpointing, retry
- Template resolution for dynamic values in action configs
- Outbound webhooks (Send Webhook action + workspace event webhooks)
- Inbound webhooks (trigger automations from external systems)
- Dry run testing
- Execution history / run log

**What's post-MVP:**

- Visual flow canvas with branching/conditions
- Condition nodes (Branch by Field Value, Formula, View, etc.)
- Lifecycle workflows (Wait for Event, global exit, re-entry prevention, sending windows)
- Loop (For Each) action
- AI actions (Generate Text, Classify, Extract, Summarize)
- Run Script (sandboxed JS)
- Accounting actions (#31–37)
- Booking actions (#40–42)
- Inventory actions (Adjust Number Field as power-user, Snapshot)
- Pre-built recipes
- Chain automations (Run Automation action)

---

## Builder Interface

**Step-by-step list builder** — not a visual canvas. Simple vertical list: one trigger at top, then ordered action steps below.

### Layout

Full-screen, two zones:

- **Left sidebar (280px):** Automation list + run history
- **Main panel:** Trigger config at top + ordered action list below

**Toolbar (48px):** Back arrow, automation name (editable), status badge (draft/active/paused), Test Run button, Settings gear, Activate/Deactivate toggle.

### Left Sidebar — Two Tabs

- **Tab 1: Automations (list icon):** All workspace automations. Each row: name, status dot (green/gray/red), last run summary. + New Automation button. Sections for organization (see `tables-and-views.md` > Sections).
- **Tab 2: History (clock icon):** Scoped to selected automation. Run log: status dot, description, step completion count, duration. Click a run → main panel highlights execution path with per-step status/timing.

### Creation Flow (Progressive Disclosure)

1. **"+ New Automation"** → Name it → Pick trigger type (6 options as cards)
2. **Configure trigger** — table picker, field selectors, schedule config (depends on type)
3. **Add steps** — "+" button below last step → action type picker (7 options as cards)
4. **Configure each step** — inline config panel expands below the step in the list
5. **Test** → **Activate**

### Step List UX

```
┌─────────────────────────────────────────┐
│  ⚡ TRIGGER: Record Created              │
│  Table: Invoices                         │
│  Filter: Status = "Sent"                 │
├─────────────────────────────────────────┤
│  1. 📄 Generate Document                │
│     Template: Invoice PDF                │
│     Record: Trigger record               │
├─────────────────────────────────────────┤
│  2. ✉️ Send Email                        │
│     To: {{trigger.record.fields.email}}  │
│     Subject: Invoice #{auto_number}      │
│     Attach: Step 1 output                │
├─────────────────────────────────────────┤
│  3. 🔔 Send Notification                │
│     To: Record owner                     │
│     "Invoice sent to client"             │
├─────────────────────────────────────────┤
│  [+ Add Step]                            │
└─────────────────────────────────────────┘
```

- Steps are **drag-reorderable** via handle on left edge.
- Click a step to expand its inline config panel.
- Each step shows a one-line summary when collapsed.
- Delete step via "×" on hover.
- Max 20 steps per automation (MVP).

---

## Triggers (6 MVP Types)

| #   | Trigger                 | Config                                                                                                    | Context Provided                                 |
| --- | ----------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | **Record Created**      | `tableId`, optional filter on initial field values                                                        | `{ record, table, createdBy }`                   |
| 2   | **Record Updated**      | `tableId`, toggle specific fields to watch, "Ignore changes by automations" toggle. **Note (CP-001-C):** Portal client edits that write back to the record fire this trigger — no separate portal-specific trigger is needed. The Manager who configured both the editable portal field and the automation has implicitly established this relationship. Source-based filtering (e.g., "only fire when client changes this") deferred to post-MVP payload enrichment. | `{ record, changedFields[], table, updatedBy }`  |
| 3   | **Field Value Changed** | `tableId`, `fieldId`, optional "changed to" value filter                                                  | `{ record, fieldId, oldValue, newValue, table }` |
| 4   | **Form Submitted**      | `formId` (links to `forms` table)                                                                         | `{ record, form, submitterEmail, submitterIp }`  |
| 5   | **Button Clicked**      | `tableId`, button field config                                                                            | `{ record, table, clickedBy }`                   |
| 6   | **Scheduled**           | Cron expression (daily/weekly/monthly/custom), timezone, optional record filter, per-record or batch mode | `{ schedule, matchedRecords[] }`                 |

### Trigger Detection

Triggers are detected at the **application layer** — application hooks provide context (who, which feature, what intent) that DB-level triggers cannot.

| Trigger Type        | Detection Mechanism                                                      | Latency       |
| ------------------- | ------------------------------------------------------------------------ | ------------- |
| Record Created      | Server Action publishes `record.created` to Redis pub/sub after DB write | <1s           |
| Record Updated      | Server Action publishes `record.updated` with changed field IDs          | <1s           |
| Field Value Changed | Evaluated on `record.updated` — compares old vs new for watched field    | <1s           |
| Form Submitted      | Form submission handler publishes `form.submitted`                       | <1s           |
| Button Clicked      | Button field handler publishes `button.clicked`                          | Immediate     |
| Scheduled           | BullMQ repeatable job runs cron expression, queries matching records     | Cron schedule |

### Trigger Registry

Active triggers are indexed in an **in-memory registry** (loaded from DB on worker startup, refreshed on automation CRUD):

```typescript
interface TriggerRegistry {
  // Returns automations that should fire for this event
  getMatchingAutomations(event: DomainEvent): AutomationTrigger[];
}

// Internal index: eventType → tableId → automationTrigger[]
// O(1) lookup: record.updated for table X → find all automations watching table X
```

**Why in-memory:** Checking every event against every trigger via DB would be too slow. Registry is small (~50KB for 1,000 automations).

**Refresh:** On automation CRUD → publish `automation.changed` → all workers refresh. Full refresh every 5 minutes as safety net.

### Event Flow: Trigger → Execution

```
Domain event (e.g., record.updated)
  → Published to Redis pub/sub: channel 'events:{tenantId}'
  → Worker receives event
  → TriggerRegistry.getMatchingAutomations(event)
  → For each match:
      → Evaluate trigger conditions
      → If met: enqueue BullMQ job: automation.execute
      → Respect rate limit (max N per minute)
```

### Deduplication

- **Debounce window:** Default 5 seconds. Same trigger fires multiple times → only last event enqueues.
- **Batch mode:** For bulk record imports, receives batch of record IDs rather than firing per-record.
- **Rate cap:** Max 100 executions per automation per minute. Excess queued.

---

## Actions (7 MVP Types)

| #   | Action                | Config                                                                                                                                                         | Output                               |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | **Send Email**        | `to` (template), `subject` (template), `body` (rich text template), `cc`, `bcc`, `attachments` (file field or step output)                                     | `{ messageId, status }`              |
| 2   | **Create Record**     | `tableId`, `fieldValues: { fieldId: template }`                                                                                                                | `{ recordId, fields }`               |
| 3   | **Update Record**     | `recordSelector` (trigger record or lookup by field), `fieldUpdates: { fieldId: template }`                                                                    | `{ recordId, changes }`              |
| 4   | **Generate Document** | `templateId` (→ document_templates), `recordSelector`, `outputFormat` (PDF)                                                                                    | `{ fileId, fileUrl }`                |
| 5   | **Send Notification** | `recipientSelector` (record owner, specific users, people field), `title` (template), `body` (template), `link` (template), `urgency` (info\|action\|critical) | `{ notificationId }`                 |
| 6   | **Adjust Field**      | `recordSelector`, `fieldId` (number field), `delta` (template — positive adds, negative subtracts)                                                             | `{ previousValue, newValue, delta }` |
| 7   | **Send Webhook**      | `url`, `method` (POST\|PUT\|PATCH), `headers`, `bodyTemplate`                                                                                                  | `{ statusCode, responseBody }`       |

### Action Details

**Action 1 — Send Email:** Uses workspace SMTP or Resend. Rich text body supports merge tags. Attachments can reference file fields on the trigger record or output from a Generate Document step. See `email.md` for full email infrastructure.

**Action 2 — Create Record:** Creates a new record in any table within the workspace. Field values use template syntax to pull from trigger record or previous step outputs. The new record ID is available to subsequent steps via `{{step_{id}.output.recordId}}`.

**Action 3 — Update Record:** Updates fields on the trigger record or a record found by field lookup. `recordSelector` options: `trigger_record` (the record that fired the trigger), or `lookup` (find by field value match in a specified table).

**Action 4 — Generate Document:** Merges record data into a document template and produces PDF via Gotenberg. Output file URL available to subsequent steps (e.g., attach to Send Email). See `smart-docs.md` for template architecture.

**Action 5 — Send Notification:** In-app notification to specified recipients. Shows in notification feed and Quick Panel. Urgency levels control visual treatment (info = subtle, action = prominent, critical = banner).

**Action 6 — Adjust Field:** Atomic server-side increment/decrement on a number field. Executes single Postgres `jsonb_set` arithmetic — never reads-then-writes. Prevents race conditions in concurrent updates. Use for inventory quantities, counters, balances.

**Action 7 — Send Webhook:** HTTP POST/PUT/PATCH to an external URL. Body template uses `{{...}}` syntax. Response captured for debugging. SSRF protection applied (see Webhook Architecture). Enables integration with any external system.

---

## Execution Model

### Linear Sequential Pipeline

MVP automations execute as a **flat sequential list** — trigger fires, then steps 1, 2, 3... in order. No branching, no parallel forks, no conditions.

```
Trigger fires
  → Step 1 executes → output saved to context
  → Step 2 executes (can reference step 1 output) → output saved
  → Step 3 executes (can reference step 1 or 2 output)
  → ... until last step
  → Execution complete → write run log
```

### Execution Context

Every step receives and passes forward a context:

```typescript
interface AutomationExecutionContext {
  tenantId: string;
  automationId: string;
  executionId: string; // Unique per run
  traceId: string; // Correlates to triggering event
  triggeringUserId: string | null; // null for scheduled/webhook
  triggerEvent: TriggerEvent;
  stepOutputs: Map<string, StepOutput>; // Previous step outputs, keyed by stepId
  startedAt: Date;
  currentStepIndex: number;
}
```

**Step outputs are accessible:** Each step can reference any previous step's output. E.g., Create Record in step 1 outputs `recordId` → Send Email in step 3 references `{{step_1.output.recordId}}`.

### Error Handling

| Strategy            | Config          | Behavior                                                                             |
| ------------------- | --------------- | ------------------------------------------------------------------------------------ |
| **Stop** (default)  | Per-step        | Step fails → mark execution `failed`, stop, notify owner                             |
| **Skip & Continue** | Per-step toggle | Step fails → log error, mark `skipped`, continue to next                             |
| **Retry**           | Per-step, max 3 | Retry with exponential backoff (1s, 4s, 16s). If all fail → Stop or Skip per config. |

**Error types:**

- **Validation error:** Config mismatch. Always stops.
- **External API error:** Webhook/email fails. Retryable.
- **Rate limit (429):** Retryable with backoff.
- **Timeout:** Step exceeded 30s. Retryable once, then stop.

### Timeout Policy

| Scope               | Timeout    |
| ------------------- | ---------- |
| Single step         | 30 seconds |
| Full automation run | 5 minutes  |

### Checkpointing

For automations with many steps, the worker checkpoints after each step. If the worker crashes, BullMQ retry resumes from last checkpoint — prevents duplicate side effects.

**Idempotency keys:** Steps with external side effects include key `{executionId}:{stepIndex}` for deduplication.

### Execution Concurrency

**One execution at a time per automation.** If automation fires while previous run is active, new execution queues. BullMQ enforces via job group with concurrency 1.

**Exception:** Manual "Run for each selected record" mode → concurrency 4 across records.

### Re-Entrant Trigger Protection

Automation actions can create/update records that fire triggers → potential infinite loops.

**Solution: execution ancestry tracking.** Every execution carries `parentExecutionId`. Domain events from automation actions carry `sourceExecutionId`. Trigger registry checks chain depth:

```typescript
if (event.sourceExecutionId) {
  const depth = await getExecutionChainDepth(event.sourceExecutionId);
  if (depth >= MAX_CHAIN_DEPTH) {
    // Default: 5
    return; // Do not enqueue — drop with warning
  }
}
```

---

## Template Resolution Engine

Action configs use `{{...}}` template syntax for dynamic values, resolved at execution time.

### Template Sources

| Syntax                                 | Resolves To                                     |
| -------------------------------------- | ----------------------------------------------- |
| `{{trigger.record}}`                   | Full trigger record (canonical_data)            |
| `{{trigger.record.fields.{fieldId}}}`  | Specific field value from trigger record        |
| `{{trigger.changedFields}}`            | Array of changed field IDs (for record.updated) |
| `{{trigger.webhookPayload}}`           | Inbound webhook body (for webhook triggers)     |
| `{{trigger.webhookPayload.fieldName}}` | Specific field from webhook payload             |
| `{{step_{id}.output}}`                 | Full output of a previous step                  |
| `{{step_{id}.output.recordId}}`        | Specific field from step output                 |
| `{{env.tenantId}}`                     | Workspace ID                                    |
| `{{env.executionId}}`                  | Execution ID                                    |
| `{{env.now}}`                          | Current ISO timestamp                           |

### Type Preservation

When the entire template is a single `{{...}}` reference, the raw value is returned (preserves types). When mixed with text (`"Hello {{trigger.record.fields.name}}"`), values are coerced to strings. Unresolvable references → null.

---

## Webhook Architecture

Two distinct webhook features sharing delivery infrastructure.

### Feature 1: Workspace-Level Event Webhooks

Managers register endpoint URLs and subscribe to platform events. When events occur, EveryStack delivers POST to matching endpoints. For external system integration.

**Event catalog (MVP — 13 subscribable events):**

| Event                  | When Fired                   |
| ---------------------- | ---------------------------- |
| `record.created`       | Record inserted (any source) |
| `record.updated`       | Record field(s) changed      |
| `record.deleted`       | Record soft-deleted          |
| `table.created`        | Table created                |
| `table.deleted`        | Table deleted                |
| `field.created`        | Field added                  |
| `field.updated`        | Field modified               |
| `portal.published`     | Portal goes live             |
| `automation.triggered` | Automation starts            |
| `automation.completed` | Automation finishes          |
| `sync.batch_complete`  | Sync batch completes         |
| `member.added`         | User joins workspace         |
| `member.removed`       | User removed                 |

**Payload envelope:**

```json
{
  "event": "record.updated",
  "timestamp": "2026-02-12T10:30:00.000Z",
  "webhook_id": "uuid",
  "delivery_id": "uuid",
  "workspace_id": "uuid",
  "api_version": "2026-02-01",
  "data": {
    /* event-specific */
  }
}
```

### Feature 2: Automation Action "Send Webhook"

Automation step with user-configured URL and payload template. For ad-hoc integrations.

### Inbound Webhook Receiving

External systems trigger automations via POST:

**URL:** `POST /api/webhooks/automation/{automationId}/{webhookToken}`

- `webhookToken`: random 32-char token, separate from automation ID. Prevents URL guessing.
- Excluded from Clerk auth middleware. Token in URL is access control.
- Optional HMAC signature verification via `X-Webhook-Signature` header.
- Rate limit: 60 inbound calls per automation per minute.
- Max body: 256KB.
- Returns `202 Accepted` with `{ "execution_id": "uuid" }`.

Payload available to steps via `{{trigger.webhookPayload.fieldName}}`.

### Delivery Pipeline

```
Event → Enqueue BullMQ: webhook.deliver → Worker:
  1. SSRF check (reject private IPs)
  2. Build payload (envelope + data)
  3. Compute HMAC: SHA256(signing_secret, payload)
  4. POST with headers: X-EveryStack-Signature, X-EveryStack-Delivery-Id
  5. Evaluate: 2xx=success, 429=retry with backoff, 5xx=retry, 4xx=permanent fail
```

### Retry Strategy

| Attempt           | Delay      | Total Elapsed |
| ----------------- | ---------- | ------------- |
| 1st retry         | 30 seconds | 30s           |
| 2nd retry         | 2 minutes  | 2.5 min       |
| 3rd retry         | 10 minutes | 12.5 min      |
| 4th retry         | 1 hour     | ~1 hour       |
| 5th retry (final) | 4 hours    | ~5 hours      |

After 5 failures, delivery marked `failed`. At 10 consecutive failures, endpoint auto-disabled + Manager notified.

### Rate Limiting

- Per-tenant: 1,000 deliveries/minute (excess queued)
- Per-endpoint: 100 deliveries/minute
- Bulk condensation: >50 same-type events in 5s → single batch webhook

### SSRF Protection

DNS-resolve hostname, check against blocked private IP ranges before TCP connection. HTTPS required in production. No redirect following. Response capture limited to 1KB.

### Webhook Management UI

Workspace Settings → Integrations → Webhooks:

- Create endpoint (URL + events + description)
- Signing secret (shown once, regenerable)
- Test delivery
- Delivery log (table with status, response code, duration, retry count)
- Manual re-send for failures
- Disable/Enable toggle

---

## Testing & Debugging

### Test Run (Dry Run)

1. Pick a real or sample record
2. Simulate the trigger
3. Steps animate green (pass) / red (fail) in the list
4. Preview action outputs **without executing side effects**
5. Each step annotated "Would execute" / "Would skip"
6. Complete execution trace with timing

### Run History

Sidebar Tab 2. Click a run → main panel shows per-step status and timing. "Retry from here" on failures.

### Error Handling UX

Failed automation → pause + push notification + red badge on sidebar. Options: fix config and retry, skip failed step, disable automation.

### Settings (Gear Icon)

Name/description, status (active/paused/draft), error handling strategy, execution limits (max runs/hour), error notification recipients.

---

## Data Model

### `automations` Table

See `data-model.md` for the canonical schema. Key columns:

| Column         | Type                 | Notes                                                                 |
| -------------- | -------------------- | --------------------------------------------------------------------- |
| `workspace_id` | UUID FK → workspaces | Denormalized for sidebar queries and permission checks                |
| `trigger`      | JSONB                | Trigger type + config + table_id                                      |
| `steps`        | JSONB[]              | Ordered action list. Always read/written as unit. Max 20 steps (MVP). |
| `status`       | VARCHAR              | `active`, `paused`, `draft`                                           |
| `run_count`    | INTEGER              | Total executions                                                      |
| `error_count`  | INTEGER              | Failed executions                                                     |

**Why `steps` is JSONB, not a separate table:** Step list always read/written as a unit. No cross-automation step queries needed. Single row fetch.

### Step Schema

```typescript
interface AutomationStep {
  id: string; // Stable UUID per step
  type: 'action'; // MVP: actions only (conditions post-MVP)
  position: number; // 0-indexed order
  name: string; // User-facing label
  actionType: string; // e.g., 'send_email', 'create_record'
  config: Record<string, unknown>; // Action-specific configuration
  errorStrategy: 'stop' | 'skip_continue' | 'retry';
  maxRetries?: number; // Only when errorStrategy='retry' (max 3)
}
```

### `automation_runs` Table

See `data-model.md`. Per-run execution log: status, timing, step_log (JSONB with per-step status/output/errors).

### Webhook Tables

| Table                  | Purpose                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `webhook_endpoints`    | Registered URLs, signing secrets, subscribed events, status, failure count          |
| `webhook_delivery_log` | Per-delivery record: payload, status code, duration, retry count. 30-day retention. |

### Plan Limits

| Plan         | Max Automations | Max Executions/Month | Max Steps |
| ------------ | --------------- | -------------------- | --------- |
| Freelancer   | 5               | 500                  | 10        |
| Starter      | 15              | 5,000                | 15        |
| Professional | 50              | 25,000               | 20        |
| Business     | 200             | 100,000              | 20        |
| Enterprise   | Unlimited       | Custom               | 20        |

Execution count tracked via Redis counter (`auto:exec:{tenantId}:{YYYY-MM}`, TTL 35 days). At limit, executions rejected with `quota_exceeded` + owner notified.

### Redis Key Patterns

| Pattern                             | Usage                        | TTL     |
| ----------------------------------- | ---------------------------- | ------- |
| `auto:exec:{tenantId}:{YYYY-MM}`    | Monthly execution counter    | 35 days |
| `rl:webhook:outbound:t:{tenantId}`  | Per-tenant outbound throttle | 60s     |
| `rl:webhook:inbound:{automationId}` | Inbound webhook rate counter | 60s     |

---

## Post-MVP Expansion Path

The linear step-by-step model is designed to extend to a visual canvas with branching:

- **Conditions** add branch nodes between steps (Branch by Field Value, Formula, View, Step Result, Portal Context)
- **Loop** action iterates over collections
- **Wait for Event** enables lifecycle workflows (drip campaigns, onboarding)
- **AI actions** (Generate Text, Classify, Extract, Summarize) add intelligence to flows
- **Run Script** (sandboxed V8) for power users
- **Run Automation** chains automations with depth protection
- **Recipe library** with pre-built templates for accounting, booking, inventory
- Full trigger expansion to 22 types (including webhook received, email received, threshold crossed, booking lifecycle, accounting events)
- Full action expansion to 42+ types

The execution engine, trigger registry, template resolution, webhook infrastructure, and error handling all carry forward unchanged. The upgrade is UI (canvas + branches) and node types (conditions, lifecycle), not engine architecture.
