# Audit Log Architecture

> **Reconciliation: 2026-02-28** — Added `'api_key'` as seventh actor_type per `data-model.md` and `GLOSSARY.md` (seven-source attribution). Added `actor_label` column (VARCHAR 255, nullable). Updated all section headings, tables, and implementation notes. Prior: 2026-02-27 — Aligned with `GLOSSARY.md` (source of truth). Changes: (1) Fixed section title "Four-Source Attribution Problem" → "Six-Source Attribution Problem" to match doc's own content and header. (2) "expand record view" → "Record View" per glossary. (3) "Custom Apps" → "Apps (Post-MVP)" per glossary naming discipline ("Interface"/"Custom App" → "App"). (4) Added 'agent' to AuditEntry TypeScript interface (was missing from actorType union despite being documented elsewhere in the doc). (5) Flagged "board/base" MVP — Foundation references as pending glossary alignment. (6) Approval Workflows, AI Agents, Apps, DuckDB are all post-MVP per glossary — content retained and clearly labeled.

> What gets audited, the seven-source attribution model (user/sync/automation/portal_client/system/agent/api_key), schema, retention, and UI surfaces.
> Cross-references: `approval-workflows.md` (5 approval audit action types — process context alongside record.updated value changes; **post-MVP** per glossary), `custom-apps.md` → renamed concept: **Apps (Post-MVP)** (6 app/transaction audit action types — transaction.completed, transaction.voided, cart.abandoned, kiosk.locked/unlocked/user_switched, app-specific details JSONB), `agent-architecture.md` (agent actor_type, session tracing via agent_sessions.delegating_user_id; **post-MVP** per glossary — AI Agents are post-MVP), `bulk-operations.md` (3 bulk audit action types: `record.bulk_updated`, `record.bulk_deleted`, `record.bulk_created` — condensed single entry per batch with `entity_type: 'table'`, `record_ids_affected[]` capped at 1,000 with truncation flag; extends user-initiated condensation beyond sync batches; Record Activity tab query includes bulk entries via JSONB `?` operator on GIN-indexed details)
> Last updated: 2026-02-27 — Glossary reconciliation. Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference (3 bulk audit action types, user-initiated condensation). Prior: Custom Apps audit events.

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                              | Lines   | Covers                                                                                               |
| ------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------- |
| What Gets Audited                    | 26–48   | Event categories: records, schema, membership, portals; audit coverage table                         |
| The Seven-Source Attribution Problem | 49–75   | 7 actor types: user, sync, automation, portal_client, system, agent, api_key                         |
| Schema                               | 76–137  | audit_log table DDL, details JSONB by action type, index strategy                                    |
| Retention Policy                     | 138–151 | 90-day hot, 1-year cold, 7-year compliance; tier-based retention                                     |
| UI Surfaces                          | 152–180 | Record Activity tab, Workspace Audit Log, Automation History tab                                     |
| Audit Write Mechanism                | 181–330 | Code emission pattern, AuditService API, bulk condensation, 7 actor types, cascades, scale estimates |
| Implementation Rules                 | 331–341 | Hard rules for audit write discipline                                                                |
| Phase Implementation                 | 342–351 | Phase breakdown: MVP — Foundation through Post-MVP                                                   |

---

## What Gets Audited

Every state-changing operation that affects tenant data is logged with who did it, what changed, and how.

| Category                 | Events                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Records**              | `record.created`, `record.updated`, `record.deleted`, `record.restored`                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Schema**               | `field.created`, `field.updated`, `field.deleted`, `table.created`, `table.deleted`, `table.converted_to_native`, `table.conversion_reverted`, `view.created`, `view.updated`                                                                                                                                                                                                                                                                                                 |
| **Membership**           | `member.invited`, `member.role_changed`, `member.removed`                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Portals**              | `portal.published`, `portal.unpublished`, `portal.settings_updated`                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Automations**          | `automation.created`, `automation.enabled`, `automation.disabled`, `automation.triggered`, `automation.completed`, `automation.failed`, `automation.quota_exceeded`, `automation.chain_depth_exceeded`                                                                                                                                                                                                                                                                        |
| **Documents**            | `document.generated`, `template.created`, `template.updated`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **AI**                   | `ai.action_accepted`, `ai.action_rejected` (when user reviews AI-generated content)                                                                                                                                                                                                                                                                                                                                                                                           |
| **Auth**                 | `workspace.created`, `api_key.created`, `api_key.revoked`, `settings.updated`                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Cross-links**          | `cross_link.created`, `cross_link.deleted`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Sync**                 | `sync.connected`, `sync.disconnected`, `sync.conflict_resolved`, `sync.auth_expired`, `sync.failure_resolved`, `sync.schema_change_accepted`, `sync.schema_change_rejected`                                                                                                                                                                                                                                                                                                   |
| **Approvals (Post-MVP)** | `approval.submitted`, `approval.step_decided`, `approval.completed`, `approval.overridden`, `approval.withdrawn` — supplement `record.updated` entries that capture actual status field value changes. Approval audit entries capture the _process_ context. See `approval-workflows.md` > Audit Log Integration. _(Post-MVP per glossary — Approval workflows are post-MVP.)_                                                                                                |
| **Apps (Post-MVP)**      | `transaction.completed`, `transaction.voided`, `cart.abandoned` (if tracking enabled), `kiosk.locked`, `kiosk.unlocked`, `kiosk.user_switched` — app actions use `actor_type: 'user'` (workspace user, not portal*client). Details JSONB includes `appId`, `appSlug`, `transactionTotal`, `lineItemCount`, `paymentMethod`, `stripePaymentIntentId`. See `custom-apps.md` > Audit Trail for App Actions. *(Post-MVP per glossary — Apps and the App Designer are post-MVP.)\_ |

**What is NOT audited:** Read-only operations (page views, searches), real-time presence events, typing indicators, embedding generation, cache operations.

---

## The Seven-Source Attribution Problem

A record can be modified by seven different sources, and the audit log must correctly attribute each:

| Source            | `actor_type`    | `actor_id`                   | Example                                                     |
| ----------------- | --------------- | ---------------------------- | ----------------------------------------------------------- |
| **User**          | `user`          | User's UUID                  | Manager edits a cell in the grid                            |
| **Sync Engine**   | `sync`          | Sync connection UUID         | Inbound sync updates a record from Airtable                 |
| **Automation**    | `automation`    | Automation definition UUID   | An automation updates a field based on a trigger            |
| **Portal Client** | `portal_client` | Portal client UUID           | External visitor submits a form via an authenticated portal |
| **System**        | `system`        | `null`                       | Retention policy drops old partitions, data migrations      |
| **Agent**         | `agent`         | Agent session UUID           | Data Steward agent bulk-updates field formatting            |
| **API Key**       | `api_key`       | API key UUID (`api_keys.id`) | External integration updates records via Platform API       |

**Why this matters:** When a user opens the Activity tab on a record and sees "Status changed to Complete 2 hours ago," they need to know whether a colleague did it, whether it synced from Airtable, whether an automation triggered it, whether a portal visitor submitted data, whether an agent made the change on behalf of a user, or whether an external integration pushed the change via the Platform API. Different sources require different investigation paths.

**Implementation:** The `actor_type` + `actor_id` pair is set by the code path that performs the mutation:

- Server Actions set `actor_type: 'user'` and `actor_id` from `getUserId()`
- Worker sync jobs set `actor_type: 'sync'` and `actor_id` from the sync connection record
- Worker automation jobs set `actor_type: 'automation'` and `actor_id` from the automation definition
- Portal form submission handlers set `actor_type: 'portal_client'` and `actor_id` from the portal session
- Worker agent jobs set `actor_type: 'agent'` and `actor_id` from the `agent_sessions.id`. The delegating user is traceable via `agent_sessions.delegating_user_id`. See `agent-architecture.md`.
- Platform API middleware sets `actor_type: 'api_key'` and `actor_id` from `api_keys.id`. An optional `X-Actor-Label` request header provides human-readable context (e.g., "JobStack: plumber@acme.com") stored in `actor_label` — not validated by EveryStack. See `platform-api.md` §Authentication.
- System background operations set `actor_type: 'system'` with `actor_id` as `null`.

---

## Schema

### `audit_log` Table

| Column        | Type                   | Purpose                                                                                                                                                 |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | UUID                   | Primary key                                                                                                                                             |
| `tenant_id`   | UUID                   | Tenant scope                                                                                                                                            |
| `actor_type`  | VARCHAR                | `'user'`, `'sync'`, `'automation'`, `'portal_client'`, `'system'`, `'agent'`, `'api_key'`                                                               |
| `actor_id`    | UUID (nullable)        | User ID, sync connection ID, automation ID, API key ID, or null for system                                                                              |
| `actor_label` | VARCHAR 255 (nullable) | Human-readable context from `X-Actor-Label` request header. API key mutations only. Not validated by EveryStack. Example: "JobStack: plumber@acme.com". |
| `action`      | VARCHAR                | Event name (e.g., `record.updated`)                                                                                                                     |
| `entity_type` | VARCHAR                | `'record'`, `'field'`, `'table'`, `'portal'`, `'automation'`, etc.                                                                                      |
| `entity_id`   | UUID                   | ID of the affected entity                                                                                                                               |
| `details`     | JSONB                  | Change payload — structure varies by action type                                                                                                        |
| `trace_id`    | VARCHAR                | Correlation ID linking to request/job logs                                                                                                              |
| `ip_address`  | VARCHAR (nullable)     | For user-initiated actions only                                                                                                                         |
| `created_at`  | TIMESTAMPTZ            | Immutable — audit logs are never updated                                                                                                                |

**Partitioning:** `PARTITION BY RANGE (created_at)`, monthly partitions. Old partitions are detached after the retention period, archived to cold storage, then dropped.

**Indexes:** `(tenant_id, entity_type, entity_id, created_at DESC)` for the Activity tab. `(tenant_id, actor_type, actor_id, created_at DESC)` for "what did this user/automation do?" queries. `(tenant_id, created_at DESC)` for tenant-level audit log.

### `details` JSONB Structure by Action Type

**`record.updated`:**

```jsonb
{
  "table_id": "uuid",
  "changes": [
    {
      "field_id": "uuid",
      "field_name": "Status",
      "old_value": { "type": "single_select", "value": { "label": "In Progress" } },
      "new_value": { "type": "single_select", "value": { "label": "Complete" } }
    }
  ]
}
```

**`member.role_changed`:**

```jsonb
{
  "target_user_id": "uuid",
  "old_role": "team_member",
  "new_role": "manager"
}
```

**`automation.triggered`:**

```jsonb
{
  "automation_id": "uuid",
  "trigger_type": "record.updated",
  "trigger_record_id": "uuid",
  "actions_executed": 3,
  "duration_ms": 1250
}
```

---

## Retention Policy

| Plan         | Retention        | Archive                                  |
| ------------ | ---------------- | ---------------------------------------- |
| Freelancer   | 30 days          | None                                     |
| Starter      | 90 days          | None                                     |
| Professional | 1 year           | Cold storage after 1 year, 3-year total  |
| Business     | 2 years          | Cold storage after 2 years, 5-year total |
| Enterprise   | Unlimited (live) | Configurable                             |

**Implementation:** Monthly partitions make retention trivial. Detach partitions older than the plan's retention window. For plans with archival: export partition to Parquet on R2/S3 before dropping.

---

## UI Surfaces

### Record Activity Tab (MVP — Core UX)

The bottom tab on Record View. Shows a chronological feed of changes to that specific record.

```
Query: SELECT * FROM audit_log
  WHERE tenant_id = $1 AND entity_type = 'record' AND entity_id = $2
  ORDER BY created_at DESC
  LIMIT 50
```

**Display:** Timeline format. Each entry shows: actor avatar (user) or icon (sync/automation), actor name, action description ("changed Status from In Progress to Complete"), relative timestamp. Inline diff for text field changes.

### Workspace Audit Log (Settings → Audit Log, Admin+ only)

Full workspace audit feed with filtering:

**Filters:** Date range, actor (user dropdown), action type (dropdown), entity type (dropdown), search (text search on `details` JSONB).

**Export:** CSV export for compliance. Includes all columns. Respects date range filter.

### Automation History Tab

When viewing an automation, the History tab shows all executions — sourced from audit_log entries where `actor_type = 'automation'` and `actor_id` matches.

---

## Audit Write Mechanism

### How Code Emits Audit Entries

Audit entries are written via an **async inline insert** within the same database transaction as the mutation, but wrapped in a try/catch that never fails the parent operation. This is NOT a queued job — audit writes must be transactionally consistent with the mutation they describe. If the mutation commits, the audit entry commits. If the mutation rolls back, the audit entry rolls back.

**Why not a BullMQ job:** A queued audit write can be lost if the worker crashes between the mutation commit and the job enqueue. Audit integrity requires transactional co-location. The performance cost of one additional INSERT per mutation is negligible (<2ms).

**Audit write helper:**

```typescript
// packages/shared/db/audit.ts
interface AuditEntry {
  tenantId: string;
  actorType: 'user' | 'sync' | 'automation' | 'portal_client' | 'system' | 'agent' | 'api_key';
  actorId: string | null;
  actorLabel?: string | null; // Human-readable context from X-Actor-Label header (api_key mutations only)
  action: string; // e.g., 'record.updated'
  entityType: string; // e.g., 'record'
  entityId: string;
  details: Record<string, unknown>;
  traceId: string;
  ipAddress?: string;
}

async function writeAuditLog(
  tx: DrizzleTransaction, // Same transaction as the mutation
  entry: AuditEntry,
): Promise<void> {
  try {
    await tx.insert(auditLogTable).values({
      id: generateId(),
      ...entry,
      createdAt: new Date(),
    });
  } catch (error) {
    // Never fail the parent operation
    logger.error({ error, auditEntry: entry }, 'Audit write failed');
    captureException(error);
  }
}
```

**Usage in Server Actions:**

```typescript
// apps/web/src/actions/records.ts
export async function updateRecord(input: UpdateRecordInput) {
  const validated = updateRecordSchema.parse(input);
  const tenantId = await getTenantId();
  const userId = await getUserId();
  const traceId = getTraceId();

  return await db.transaction(async (tx) => {
    const oldRecord = await tx.select()...;  // read current state
    await tx.update(recordsTable)...;         // perform mutation

    await writeAuditLog(tx, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'record.updated',
      entityType: 'record',
      entityId: validated.recordId,
      details: { tableId: validated.tableId, changes: computeDiff(oldRecord, validated) },
      traceId,
    });

    return result;
  });
}
```

**Usage in Worker jobs (sync/automation):**

```typescript
// Same pattern — the worker job wraps its mutation and audit write in the same transaction.
// actorType is 'sync' or 'automation'. actorId is the sync connection or automation definition ID.
```

### Bulk Operation Condensation

When a sync batch imports or updates many records, writing one audit entry per record creates unnecessary volume. Strategy:

**Batch audit entries:** For sync operations affecting >10 records in a single batch, write a single condensed audit entry:

```jsonb
{
  "action": "sync.batch_complete",
  "entity_type": "table",
  "entity_id": "uuid-of-table",
  "details": {
    "records_created": 47,
    "records_updated": 183,
    "records_deleted": 2,
    "record_ids_created": ["uuid1", "uuid2", ...],
    "record_ids_updated": ["uuid3", "uuid4", ...],
    "record_ids_deleted": ["uuid5", "uuid6"],
    "sync_connection_id": "uuid",
    "platform": "airtable",
    "duration_ms": 4200
  }
}
```

Individual record-level audit entries are written only for: user-initiated edits (always individual), automation-triggered changes (always individual), and sync batches of ≤10 records (small enough to be individual).

**The `record_ids_*` arrays** in the batch entry are capped at 1,000 IDs. For larger batches, the array is truncated with a `"truncated": true` flag. The Record Activity tab can still find relevant entries by querying: `WHERE entity_type = 'table' AND entity_id = $tableId AND action = 'sync.batch_complete'` and checking if the record ID appears in the details arrays.

### Seven Actor Types

Seven distinct actor types produce auditable actions. Each has a clear delegation/attribution chain:

| Source            | `actor_type`    | `actor_id`                   | Example                                           |
| ----------------- | --------------- | ---------------------------- | ------------------------------------------------- |
| **User**          | `user`          | User's UUID                  | Manager edits a cell                              |
| **Sync Engine**   | `sync`          | Sync connection UUID         | Inbound sync updates a record                     |
| **Automation**    | `automation`    | Automation definition UUID   | Automation changes a field                        |
| **Portal Client** | `portal_client` | Portal client UUID           | Visitor submits a form via portal                 |
| **System**        | `system`        | `null`                       | Retention policy drops old partitions             |
| **Agent**         | `agent`         | Agent session UUID           | Data Steward cleans up duplicates                 |
| **API Key**       | `api_key`       | API key UUID (`api_keys.id`) | External integration pushes data via Platform API |

Portal client audit entries are useful for Managers tracking form submissions. Agent audit entries link to the full session trace — the delegating user, goal, reasoning, and all steps are traceable via `agent_sessions`. See `agent-architecture.md` > Agent Observability. API key audit entries include the optional `actor_label` for human-readable attribution context — see §Schema above.

### Background Cascades Are NOT Audited

The following background operations touch records but are **not audited** — they are derived data maintenance, not state changes:

- Cross-link display value updates (a cached denormalization refreshed when the target record changes)
- Formula field recalculations (computed values recomputed on dependency change)
- Embedding generation/regeneration
- tsvector index updates
- Portal cache invalidation

**Rationale:** These operations change derived data, not source data. The audit entry for the _source_ change (the record edit that triggered the cascade) is the audit trail. Logging every downstream update would create massive volume with no informational value.

### Scale Estimates

| Tenant Size                                 | Est. Audit Entries/Day | Monthly Partition Size          |
| ------------------------------------------- | ---------------------- | ------------------------------- |
| Small (5 users, 1K records)                 | ~200–500               | ~50MB                           |
| Medium (20 users, 50K records)              | ~2,000–10,000          | ~500MB                          |
| Large (50 users, 250K records, active sync) | ~10,000–50,000         | ~2GB                            |
| Platform total (10K tenants)                | ~5M–20M                | ~50–100GB per monthly partition |

**Query performance:** The composite indexes on `(tenant_id, entity_type, entity_id, created_at DESC)` ensure per-record Activity tab queries hit a small slice even at large scale. Monthly partitioning means the query planner prunes all partitions outside the date range. The workspace audit log (all events for a tenant) is the heaviest query — paginate with `LIMIT 50` and cursor-based pagination on `created_at`.

---

## Implementation Rules

1. **Audit writes are transactional.** Written in the same DB transaction as the mutation they describe. Wrapped in try/catch — never fail the parent operation. If the insert fails, log to Sentry.
2. **Audit logs are append-only.** No updates. No deletes (except partition drops for retention).
3. **Every Server Action that mutates data must call `writeAuditLog()`.** No exceptions. This is enforced via code review — there is no automated lint for this, so vigilance is required.
4. **Every Worker job that mutates data must call `writeAuditLog()`.** Sync jobs use batch condensation for >10 records. Automation jobs write individual entries.
5. **PII in audit logs:** `actor_id` references a user who may later be deleted. On user deletion, `actor_id` is anonymized to `'deleted_user'` (see compliance.md). The `details` JSONB should not contain raw PII — use field IDs and record IDs, not field values that might be PII (except for the change diff, which is tenant-owned data).
6. **Trace ID linkage:** Every audit entry includes `trace_id`, allowing correlation with Pino logs and OpenTelemetry traces for debugging.

---

## Phase Implementation

| Phase                     | Audit Work                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation          | `audit_log` table with monthly partitioning. `writeAuditLog()` helper in `packages/shared/db/audit.ts`. Audit on workspace/table/field CRUD with `actor_type: 'user'`. _(Note: older docs referenced board/base CRUD here — glossary defines flat Workspace → Table hierarchy; board/base pending alignment.)_ |
| MVP — Core UX             | Record Activity tab in Record View. Audit on record CRUD with seven-source attribution (user, sync, automation, portal_client, system, agent, api_key). Bulk condensation for sync batches. Agent (`actor_type: 'agent'`) activated post-MVP — schema ready from MVP — Foundation.                             |
| Post-MVP — Portals & Apps | Portal publish/unpublish auditing.                                                                                                                                                                                                                                                                             |
| Post-MVP — Automations    | Automation execution auditing. Workspace audit log admin UI.                                                                                                                                                                                                                                                   |
| Post-MVP — Comms & Polish | Full audit coverage. CSV export. Retention policy enforcement.                                                                                                                                                                                                                                                 |
| Post-MVP — Custom Apps    | **App audit actions (Post-MVP):** `transaction.completed`, `transaction.voided`, `cart.abandoned`, `kiosk.locked`, `kiosk.unlocked`, `kiosk.user_switched`. App-specific `details` JSONB (appId, appSlug, transactionTotal, paymentMethod, stripePaymentIntentId). See `custom-apps.md`.                       |
