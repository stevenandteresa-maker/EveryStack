# Audit Step 8 — API & Technical Contract Consistency

**Date:** 2026-03-01
**Tarball:** `everystack-post-step7-fixed_tar.gz`
**Scope:** API endpoints, webhook events, component names, technical interfaces, auth references, error handling
**Source of truth:** `GLOSSARY.md`, `platform-api.md` (canonical external API), `automations.md` (canonical event catalog)

---

## Summary

16 findings across 6 categories. 3 Critical (would cause Claude Code to generate wrong endpoints or event names), 6 Moderate (naming inconsistencies that create ambiguity), 7 Low (style/documentation consistency). All Critical and Moderate issues fixed in this pass.

---

## Findings Table

| #   | File A                                             | File B                                       | Interface                          | Conflict Description                                                                                                                                                                                                                                                                                   | Severity      | Status                                                              |
| --- | -------------------------------------------------- | -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------- | ------------ | --------- |
| 1   | `vertical-architecture.md` L178                    | `platform-api.md` L625–650                   | Provisioning endpoints             | Abbreviated paths omitted required parent resource IDs (e.g., `POST /api/v1/tables` instead of `POST /api/v1/workspaces/{workspaceId}/tables`). 5 of 8 provisioning steps had wrong paths. Claude Code would generate routes that 404.                                                                 | **Critical**  | **Fixed**                                                           |
| 2   | `automations.md` L341                              | `realtime.md` L81, `audit-log.md` L254       | Sync event name                    | Webhook event catalog listed `sync.completed` but Redis pub/sub and audit log use `sync.batch_complete`. Claude Code would subscribe/emit the wrong event name.                                                                                                                                        | **Critical**  | **Fixed**                                                           |
| 3   | `ai-field-agents-ref.md` L14,786,795,802,1232–1233 | `automations.md` L133–137, `realtime.md` L78 | Domain event naming                | AI Field Agents doc used snake_case (`record_created`, `record_updated`) while the canonical platform event bus uses dot notation (`record.created`, `record.updated`). 6 occurrences. Claude Code would subscribe to non-existent events.                                                             | **Critical**  | **Fixed**                                                           |
| 4   | `my-office.md` L236                                | `my-office.md` L240                          | Calendar feed source_type          | Request parameter filter listed `calendar_table                                                                                                                                                                                                                                                        | projects_task | personal`but response field used`calendar_record                    | task | personal`. Request/response naming mismatched within the same endpoint. | **Moderate** | **Fixed** |
| 5   | `vertical-architecture.md` L170                    | `platform-api.md` L265, `audit-log.md` L56   | X-Actor-Label header               | Used lowercase `x-actor-label` while all other docs use `X-Actor-Label`. HTTP headers are case-insensitive in practice, but documentation inconsistency confuses Claude Code's code generation.                                                                                                        | **Moderate**  | **Fixed**                                                           |
| 6   | `record-templates.md` L729–762                     | `platform-api.md` (all endpoints)            | URL parameter format               | Used Express-style `:tableId` while platform-api.md uses REST doc convention `{tableId}`. 8 endpoint references.                                                                                                                                                                                       | **Moderate**  | **Fixed**                                                           |
| 7   | `ai-field-agents-ref.md` L1303–1331                | `platform-api.md` (all endpoints)            | URL parameter format               | Used Express-style `:fieldId` and `:workspaceId` for 7 endpoint references.                                                                                                                                                                                                                            | **Moderate**  | **Fixed**                                                           |
| 8   | `schema-descriptor-service.md` L464–466            | `platform-api.md` (convention)               | URL parameter format               | Internal endpoints used `:workspaceId`/`:tableId` instead of `{workspaceId}`/`{tableId}`. 3 occurrences.                                                                                                                                                                                               | **Moderate**  | **Fixed**                                                           |
| 9   | `record-templates.md` L729                         | `platform-api.md` L375                       | Create Record endpoint extension   | `record-templates.md` extends `POST /api/v1/tables/{tableId}/records` with `template_id`, `canonical_data`, `context_record_id` parameters. `platform-api.md` didn't acknowledge this extension. Claude Code building the API would miss template support.                                             | **Moderate**  | **Fixed**                                                           |
| 10  | `bulk-operations.md` L323,395                      | `bulk-operations.md` L341,461                | Bulk event dual naming             | Audit actions use `record.bulk_updated` / `record.bulk_deleted` / `record.bulk_created`. Real-time events use `record.updated.batch` / `record.deleted.batch` / `record.created.batch`. Intentionally different (audit is granular, real-time is batched), but the rationale is not documented inline. | **Low**       | Noted                                                               |
| 11  | `automations.md` L136–137                          | `automations.md` L331–343                    | Missing webhook events             | `form.submitted` and `button.clicked` are emitted as Redis events (trigger detection table) but not included in the 13-event webhook catalog. External consumers cannot subscribe to form submissions or button clicks via outbound webhooks.                                                          | **Low**       | Noted                                                               |
| 12  | `files.md` L113–142                                | `platform-api.md` L1059–1089                 | Upload endpoint paths              | Internal upload uses non-versioned `POST /api/upload/presign`. External API uses versioned `POST /api/v1/files/upload-url`. Both are correct (internal Route Handler vs Platform API), but neither doc cross-references the other to explain the distinction.                                          | **Low**       | Noted                                                               |
| 13  | `personal-notes-capture.md` L388,396,454           | `platform-api.md`                            | Internal vs Platform API confusion | Notes clip endpoints (`POST /api/v1/notes/clip`, `GET /api/v1/auth/session`) use the `/api/v1/` prefix but are NOT Platform API endpoints. The shared prefix could lead Claude Code to expose them on the Platform API surface.                                                                        | **Low**       | Noted                                                               |
| 14  | `platform-api.md` L853,871                         | `platform-api.md` L881                       | Run ID naming                      | Trigger endpoints return `execution_id` in response body. Get Run Status endpoint uses `runs/{runId}` in URL path. These refer to the same `automation_runs.id` value, but the naming inconsistency between `execution_id` and `runId` could confuse Claude Code.                                      | **Low**       | Noted                                                               |
| 15  | `ai-field-agents-ref.md` L864                      | `data-model.md`, `GLOSSARY.md`               | Missing `ai_agent_runs` table      | `ai-field-agents-ref.md` defines `CREATE TABLE ai_agent_runs` and `workspace-map.md` queries it for aggregate stats, but neither `data-model.md` nor `GLOSSARY.md` includes this table. Phantom table for Claude Code building schema migrations.                                                      | **Low**       | Noted — schema gap (Step 5 territory, flagged here for API context) |
| 16  | `automations.md` L331–343                          | `bulk-operations.md` L461–463,498            | Batch webhook events               | The webhook event catalog (13 MVP events) does not include batch events (`record.updated.batch`, etc.). `bulk-operations.md` L498 references `record.updated.batch` webhook delivery via condensation, implying these should be deliverable to outbound webhooks. Gap in webhook catalog.              | **Low**       | Noted                                                               |

---

## Fix Details

Covers Finding 1: Abbreviated provisioning paths — **Fixed**, Finding 2: Webhook sync event name — **Fixed**, Finding 3: AI Field Agent event naming — **Fixed**, Finding 4: Calendar feed source_type naming — **Fixed**, Finding 5: X-Actor-Label header casing — **Fixed**, Findings 6–8: URL parameter format standardization — **Fixed**.
Touches `record_created`, `record_updated`, `template_id`, `canonical_data`, `context_record_id` tables. See `vertical-architecture.md`, `automations.md`, `realtime.md`.

### Finding 1: Abbreviated provisioning paths — **Fixed**

**File:** `vertical-architecture.md` §Provisioning (B2B)

Before:

```
3. POST /api/v1/tables, POST /api/v1/fields
5. POST /api/v1/automations
6. POST /api/v1/document-templates
7. POST /api/v1/portals
8. POST /api/v1/forms
```

After:

```
3. POST /api/v1/workspaces/{workspaceId}/tables (inline fields), POST /api/v1/tables/{tableId}/fields (individual fields)
5. POST /api/v1/workspaces/{workspaceId}/automations
6. POST /api/v1/workspaces/{workspaceId}/document-templates
7. POST /api/v1/workspaces/{workspaceId}/portals
8. POST /api/v1/workspaces/{workspaceId}/forms
```

### Finding 2: Webhook sync event name — **Fixed**

**File:** `automations.md` §Webhook Architecture event catalog, L341

Before: `| sync.completed | Sync batch completes |`
After: `| sync.batch_complete | Sync batch completes |`

Rationale: `sync.batch_complete` is the event name used by the Redis pub/sub event bus (`realtime.md` L81) and the audit log action name (`audit-log.md` L254). The webhook catalog must match the actual event emitted.

### Finding 3: AI Field Agent event naming — **Fixed**

**File:** `ai-field-agents-ref.md` — 6 occurrences across lines 14, 786, 795, 802, 1232, 1233

Before: `record_created` / `record_updated` (snake_case)
After: `record.created` / `record.updated` (dot notation)

Rationale: The platform event bus uses dot notation consistently across `automations.md` (trigger detection table, webhook catalog), `realtime.md` (Redis pub/sub), and `audit-log.md` (action column). Snake_case was a pre-reconciliation artifact.

### Finding 4: Calendar feed source_type naming — **Fixed**

**File:** `my-office.md` L236

Before: `source_types[] (optional: calendar_table | projects_task | personal)`
After: `source_types[] (optional: calendar_record | task | personal)`

Rationale: Request filter values must match response field values for consistent API behavior.

### Finding 5: X-Actor-Label header casing — **Fixed**

**File:** `vertical-architecture.md` L170

Before: `x-actor-label`
After: `X-Actor-Label`

### Findings 6–8: URL parameter format standardization — **Fixed**

**Files:** `record-templates.md` (8 occurrences), `ai-field-agents-ref.md` (7 occurrences), `schema-descriptor-service.md` (3 occurrences)

Before: `:tableId`, `:fieldId`, `:workspaceId`, `:templateId` (Express-style)
After: `{tableId}`, `{fieldId}`, `{workspaceId}`, `{templateId}` (REST doc convention)

Rationale: `platform-api.md` establishes `{param}` as the canonical URL parameter format for API documentation. Express-style `:param` is appropriate in route handler file paths (e.g., `src/routes/api/ai-field-agent.ts`) but not in API endpoint documentation.

### Finding 9: Record template extension — **Fixed**

**File:** `platform-api.md` §Create Record, after L390

Added note documenting the `template_id`, `canonical_data`, and `context_record_id` optional parameters with cross-reference to `record-templates.md` §API Surface.

---

## Items Noted (Not Fixed — Require Design Decisions)

Covers Finding 10: Bulk event dual naming, Finding 11: Missing webhook events for forms/buttons, Finding 12: Internal vs external upload paths, Finding 13: Notes clip endpoints using /api/v1/ prefix, Finding 14: execution_id vs runId naming, Finding 15: ai_agent_runs phantom table.
Touches `execution_id`, `ai_agent_runs` tables. See `bulk-operations.md`, `automations.md`, `files.md`.

### Finding 10: Bulk event dual naming

The audit log uses `record.bulk_*` naming while real-time uses `record.*.batch` naming. This appears intentional — audit entries are per-mutation-type while real-time events are per-delivery-pattern — but the distinction isn't documented. **Recommendation:** Add a one-line note in `bulk-operations.md` §Audit Trail explaining the naming convention difference.

### Finding 11: Missing webhook events for forms/buttons

`form.submitted` and `button.clicked` are emitted to the Redis event bus but aren't in the 13-event webhook catalog. External consumers may want to subscribe to form submissions. **Recommendation:** Either add these to the webhook catalog (making it 15 events) or explicitly note in `automations.md` that these are internal-only events.

### Finding 12: Internal vs external upload paths

`files.md` documents internal Route Handler paths while `platform-api.md` documents external API paths. Neither cross-references the other. **Recommendation:** Add a note in `files.md` §Upload Flow: "The Platform API exposes this flow via `POST /api/v1/files/upload-url` — see `platform-api.md` §File Upload API."

### Finding 13: Notes clip endpoints using /api/v1/ prefix

`personal-notes-capture.md` uses `/api/v1/` prefixed paths for internal browser extension endpoints. This prefix should be reserved for Platform API endpoints. **Recommendation:** Either rename these to `/api/internal/notes/clip` or add a comment clarifying these are internal Route Handlers, not Platform API endpoints.

### Finding 14: execution_id vs runId naming

API trigger responses return `execution_id` while the Get Run Status path uses `runs/{runId}`. Both refer to `automation_runs.id`. **Recommendation:** Add a one-line note in platform-api.md §Automation API: "The `execution_id` returned by trigger endpoints is the `automation_runs.id` value used as `{runId}` in the runs endpoints."

### Finding 15: ai_agent_runs phantom table

`ai-field-agents-ref.md` defines a `CREATE TABLE ai_agent_runs` and `workspace-map.md` queries it for aggregate stats, but this table isn't in `data-model.md` or `GLOSSARY.md`. **Recommendation:** Add `ai_agent_runs` to `data-model.md` §Post-MVP Entities and `GLOSSARY.md` §DB Entity Quick Reference.

### Finding 16: Batch webhook events not in catalog

The 13-event webhook catalog doesn't include `record.updated.batch` et al., but `bulk-operations.md` implies batch events should be deliverable to webhook endpoints. **Recommendation:** Add batch events to the webhook catalog with a note about condensation (these only fire when >50 records change within 5 seconds).

---

## Verification Commands

```bash
# Verify no `:param` style remaining in API documentation (excluding source file paths and testing.md mock URLs)
grep -rn "/:.*Id\b" *.md | grep -v "AUDIT-STEP\|session-log\|testing.md\|src/\|File:" | grep "/api/"

# Verify sync event name consistency
grep -rn "sync\.completed\|sync\.batch_complete" *.md | grep -v "AUDIT-STEP\|session-log"

# Verify no snake_case event names outside of expected contexts
grep -rn "record_created\|record_updated" *.md | grep -v "AUDIT-STEP\|session-log\|MANIFEST\|record_created_at\|trigger_record_id"

# Verify X-Actor-Label casing
grep -rn "x-actor-label" *.md | grep -v "AUDIT-STEP\|session-log\|X-Actor-Label"

# Verify vertical-architecture provisioning paths include parent IDs
grep "POST /api/v1/" vertical-architecture.md | grep -v "workspaceId\|tenants\|workspaces$\|cross-links"
```

---

## Cross-Reference to Prior Steps

- **Finding 15 (ai_agent_runs):** Overlaps with Step 5 (Schema Consistency) — phantom table. Not flagged in Step 5 findings because the table is defined in a post-MVP reference doc.
- **Findings 2–3 (event naming):** Related to Step 3 (Terminology Discipline) — but event names are technical identifiers, not terminology. Step 3 focused on user-facing terms.
- **Finding 1 (provisioning paths):** Would have caused immediate build failure. This was the highest-impact fix in Step 8.
