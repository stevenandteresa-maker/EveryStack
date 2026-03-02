# EveryStack — Platform API

> **Reconciliation note (2026-02-28):** Initial version. Aligned with `GLOSSARY.md` (source of truth) — all naming, MVP scope, entity definitions follow glossary conventions. Cross-checked against `data-model.md` (schema), `automations.md` (webhook architecture), `ai-architecture.md` (AIService, MCP), `compliance.md` (API key security), `audit-log.md` (actor types), `ai-metering.md` (credit system).

> **Reference doc (Tier 3).** External API for programmatic access to EveryStack. Covers authentication (service-level API keys), Data API (Record CRUD, Table queries), Schema API (Table/Field/Cross-Link structure, SDS), Provisioning API (create Tenants, Workspaces, Tables, Fields, Automations, Portals, Forms, Document Templates), AI API (AIService consumption), Automation API (trigger, status), rate limiting, versioning, error format, and audit integration. This API is the sole integration point for branded verticals, third-party tools, and customer scripts.
> Cross-references: `vertical-architecture.md` (vertical product architecture — B2B/B2C patterns, separation boundaries), `GLOSSARY.md` (source of truth — terminology, MVP scope), `data-model.md` (canonical schema — all table/column definitions), `automations.md` (webhook architecture — inbound/outbound, event catalog, delivery pipeline), `ai-architecture.md` (AIService, capability tiers, prompt registry, MCP server), `ai-metering.md` (credit system, cost computation, plan budgets), `compliance.md` (API key security, GDPR, RLS), `audit-log.md` (6-source attribution, actor types), `permissions.md` (5-tier role model, field permissions), `sync-engine.md` (canonical JSONB, Field Type Registry), `schema-descriptor-service.md` (SDS — AI-consumable schema), `cross-linking.md` (Cross-Link architecture), `portals.md` (Quick Portal spec), `forms.md` (Quick Form spec), `smart-docs.md` (Document Generation, merge tags), `realtime.md` (Redis pub/sub event bus), `settings.md` (workspace settings), `files.md` (upload pipeline, S3/R2)
> Last updated: 2026-02-28 — Initial version.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                       | Lines     | Covers                                                                                          |
| ----------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| Overview                      | 36–55     | API philosophy, audience, base URL, versioning strategy                                         |
| Authentication                | 56–169    | API keys, SHA-256 hashing, key prefixes (esk*live*/esk*test*/esk*platform*), scopes, management |
| Rate Limiting                 | 170–196   | 4 tiers, Redis token bucket, rate limit headers                                                 |
| API Versioning                | 197–213   | URL-based versioning (/api/v1/), deprecation policy                                             |
| Error Format                  | 214–256   | Structured JSON errors, error codes, validation errors                                          |
| Audit Integration             | 257–272   | actor_type: api_key, actor_label, audit log attribution                                         |
| Data API                      | 273–459   | Record CRUD, table queries, filter syntax, batch create, cursor pagination                      |
| Schema API                    | 460–603   | Workspace/Table/Field/Cross-Link structure, SDS endpoint                                        |
| Provisioning API              | 604–840   | Create workspaces, tables, fields, cross-links, automations, portals, forms, templates          |
| Automation API                | 841–907   | Trigger automations via API, run status, manual trigger endpoint                                |
| AI API                        | 908–993   | AIService consumption via capability tiers, prompt templates, credit metering                   |
| Webhook Management API        | 994–1049  | Endpoint registration, event types, delivery log, signature verification                        |
| File Upload API               | 1050–1089 | Presigned URL flow, file metadata, content-type validation                                      |
| Tenant Management API         | 1090–1133 | Tenant creation with platform-level keys, tenant listing                                        |
| Phase Implementation          | 1134–1148 | Phased API surface delivery (MVP — Foundation through Post-MVP — Automations)                   |
| SDK Considerations (Post-MVP) | 1149–1170 | Future SDK design notes                                                                         |

---

## Overview

The Platform API is EveryStack's external programmatic interface. Every operation that the EveryStack web application performs through internal Next.js Route Handlers has a corresponding Platform API endpoint available to external consumers. The API serves three audiences equally:

1. **Branded verticals** — B2B and B2C products powered by the EveryStack engine (see `vertical-architecture.md`)
2. **Third-party integrations** — Zapier, Make, custom scripts, MCP clients
3. **EveryStack customers** — power users automating their own workflows

There are no vertical-specific endpoints. The API is the same for all consumers.

### Design Principles

- **REST over JSON.** Standard HTTP methods, JSON request/response bodies, predictable URL structure.
- **Tenant-scoped.** Every API key is bound to a Tenant. Every request operates within that Tenant's data. RLS enforced at every layer.
- **Consistent with internal routes.** The Platform API is not a separate system — it's a versioned, authenticated, rate-limited surface on top of the same Next.js Route Handlers the web app uses. Behavior, validation, and business logic are identical.
- **Audit everything.** Every mutation records `actor_type: 'api_key'` in the Audit Log. See §Audit Integration.
- **Fail explicitly.** Structured error responses with machine-readable codes, human-readable messages, and field-level detail for validation errors.

---

## Authentication

### API Keys

All Platform API requests authenticate via API keys. Keys are service-level credentials — they authenticate a trusted backend or integration, not an individual user.

**Key format:** `esk_live_` prefix + 48 random alphanumeric characters. Example: `esk_live_a7b3c9d1e5f2g8h4i6j0k...`

**Prefixes:**
| Prefix | Environment |
|---|---|
| `esk_live_` | Production |
| `esk_test_` | Test / staging |

**Storage:** Only the SHA-256 hash is stored in the database. The full key is shown once at creation and never retrievable again.

**Header:** `Authorization: Bearer esk_live_...`

### Key Scoping

Each API key has a permission scope that controls what operations it can perform:

| Scope                | Permissions                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `data:read`          | Read Records, query Tables, read Cross-Links                                                 |
| `data:write`         | Create, update, delete Records. Manage Cross-Link entries                                    |
| `schema:read`        | Read Table, Field, View, Cross-Link definitions. Query SDS                                   |
| `schema:write`       | Create/update/delete Tables, Fields, Views, Cross-Links                                      |
| `automation:read`    | Read Automation definitions and run history                                                  |
| `automation:write`   | Create/update Automations, trigger Automations                                               |
| `automation:trigger` | Trigger Automations only (no create/update)                                                  |
| `portal:read`        | Read Quick Portal and Quick Form configurations                                              |
| `portal:write`       | Create/update Quick Portals, Quick Forms, Portal Access entries                              |
| `document:read`      | Read Document Template definitions and generated documents                                   |
| `document:write`     | Create/update Document Templates, trigger document generation                                |
| `ai:use`             | Call AIService endpoints (metered against Tenant credit budget)                              |
| `admin`              | All permissions. Tenant-level operations (create Workspaces, manage API keys, read settings) |

Keys can hold multiple scopes. A typical B2B vertical provisioning key uses `admin`. A domain service writing session results uses `data:read` + `data:write` + `automation:trigger`.

### Key Management

**Creation:** Owner or Admin creates keys via Settings → Data & Privacy → API Keys, or via the API itself (requires `admin` scope).

```
POST /api/v1/api-keys
Authorization: Bearer esk_live_... (with admin scope)
Body: {
  "name": "JobStack Provisioning",
  "scopes": ["admin"],
  "expires_at": null,
  "rate_limit_tier": "standard"
}

Response 201:
{
  "id": "uuid",
  "name": "JobStack Provisioning",
  "key": "esk_live_a7b3c9d1e5f2...",    ← shown once, never again
  "key_prefix": "esk_live_a7b3",          ← stored for identification
  "scopes": ["admin"],
  "rate_limit_tier": "standard",
  "created_at": "2026-02-28T10:00:00Z",
  "expires_at": null
}
```

**Listing:** `GET /api/v1/api-keys` — returns all keys for the Tenant (key_prefix, name, scopes, last_used_at — never the full key).

**Revocation:** `DELETE /api/v1/api-keys/{keyId}` — immediate. All in-flight requests with this key will fail.

**Rotation:** Create a new key, update vertical backend config, then revoke the old key. No built-in rotation mechanism — keep it simple.

### Database Schema

```
api_keys
  id              UUID PRIMARY KEY
  tenant_id       UUID NOT NULL → tenants.id
  name            VARCHAR(255) NOT NULL
  key_hash        VARCHAR(64) NOT NULL        ← SHA-256 of full key
  key_prefix      VARCHAR(16) NOT NULL        ← first 16 chars, for display
  scopes          TEXT[] NOT NULL              ← array of scope strings
  rate_limit_tier VARCHAR(32) DEFAULT 'standard'
  last_used_at    TIMESTAMPTZ
  expires_at      TIMESTAMPTZ                 ← null = never expires
  status          VARCHAR(16) DEFAULT 'active'  ← active | revoked
  created_by      UUID → users.id
  created_at      TIMESTAMPTZ DEFAULT NOW()
  revoked_at      TIMESTAMPTZ

  INDEX (tenant_id)
  INDEX (key_hash)                            ← lookup on every request
```

```
api_request_log
  id              UUID PRIMARY KEY
  tenant_id       UUID NOT NULL
  api_key_id      UUID NOT NULL → api_keys.id
  method          VARCHAR(8)
  path            VARCHAR(512)
  status_code     INTEGER
  duration_ms     INTEGER
  request_size    INTEGER                     ← bytes
  response_size   INTEGER                     ← bytes
  created_at      TIMESTAMPTZ DEFAULT NOW()

  Partitioned monthly by created_at.
  30-day retention (configurable per plan).
```

---

## Rate Limiting

Redis token bucket per API key. Headers included on every response:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 117
X-RateLimit-Reset: 1709125200
```

When exceeded: `429 Too Many Requests` with `Retry-After` header.

### Tiers

| Tier         | Requests/min | Burst | Target Audience                                     |
| ------------ | ------------ | ----- | --------------------------------------------------- |
| `basic`      | 60           | 10    | Customer scripts, light integrations                |
| `standard`   | 120          | 20    | Vertical backends, active integrations              |
| `high`       | 600          | 100   | High-volume vertical services (B2C domain services) |
| `enterprise` | 2,000        | 500   | Enterprise plan customers, dedicated                |

Rate limit tier is set per API key at creation. Upgradable via Settings or API.

**Per-Tenant ceiling:** Regardless of individual key tiers, total requests across all keys for a Tenant cannot exceed 3× the highest single-key tier. This prevents key proliferation as a rate limit bypass.

---

## API Versioning

**URL-based:** All endpoints prefixed with `/api/v1/`.

**Version lifecycle:**

- **Current** (`v1`) — actively developed, backwards-compatible changes only.
- **Deprecated** — still functional, sunset date announced. `Sunset` header on responses.
- **Retired** — returns `410 Gone`.

**Backwards-compatible changes** (no version bump): adding new optional fields to responses, adding new endpoints, adding new optional query parameters.

**Breaking changes** (version bump to `v2`): removing fields, renaming fields, changing response structure, changing validation rules, removing endpoints.

**Header:** `X-API-Version: 2026-02-01` — the API version in use. Included on every response.

---

## Error Format

All errors return a consistent JSON structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid field values",
    "details": [
      {
        "field": "fields.email",
        "code": "INVALID_FORMAT",
        "message": "Must be a valid email address"
      }
    ],
    "request_id": "req_a7b3c9d1"
  }
}
```

### Error Codes

| HTTP Status | Code                      | Meaning                                                                                 |
| ----------- | ------------------------- | --------------------------------------------------------------------------------------- |
| 400         | `VALIDATION_ERROR`        | Request body failed validation. `details` array has per-field errors                    |
| 400         | `INVALID_FILTER`          | Query filter syntax is invalid                                                          |
| 400         | `INVALID_SORT`            | Sort parameter references a nonexistent Field                                           |
| 401         | `UNAUTHORIZED`            | Missing or invalid API key                                                              |
| 401         | `KEY_EXPIRED`             | API key has passed its `expires_at`                                                     |
| 401         | `KEY_REVOKED`             | API key has been revoked                                                                |
| 403         | `INSUFFICIENT_SCOPE`      | API key lacks the required scope for this operation                                     |
| 403         | `FIELD_PERMISSION_DENIED` | API key scope allows the operation, but a specific Field is restricted                  |
| 404         | `NOT_FOUND`               | Resource does not exist (or is in a different Tenant — same response for security)      |
| 409         | `CONFLICT`                | Record was modified since last read (optimistic concurrency, if `If-Match` header used) |
| 413         | `PAYLOAD_TOO_LARGE`       | Request body exceeds 1MB limit                                                          |
| 422         | `RECORD_QUOTA_EXCEEDED`   | Tenant has reached their plan's Record quota                                            |
| 422         | `AI_CREDITS_EXHAUSTED`    | Tenant has no remaining AI credits for this billing period                              |
| 429         | `RATE_LIMITED`            | Rate limit exceeded. `Retry-After` header included                                      |
| 500         | `INTERNAL_ERROR`          | Server error. `request_id` included for support                                         |

---

## Audit Integration

Every mutation via the Platform API records an Audit Log entry:

| Field         | Value                                                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actor_type`  | `'api_key'`                                                                                                                                                                |
| `actor_id`    | `api_keys.id` (UUID of the key used)                                                                                                                                       |
| `actor_label` | Value of `X-Actor-Label` request header, if provided (max 255 chars). Optional metadata for readability (e.g., "JobStack: plumber@acme.com"). Not validated by EveryStack. |

**Note:** `actor_type: 'api_key'` is a new addition to the audit actor type enum. Existing types per `audit-log.md`: user, sync, automation, portal_client, system, agent. The `api_key` type joins this list when the Platform API ships. See `audit-log.md` and `data-model.md` for schema updates.

The Audit Log Activity tab displays API key actions with the key's `name` and optional `actor_label`, so Workspace Managers can see "API: JobStack Provisioning — plumber@acme.com created a Record" rather than a raw UUID.

---

## Data API

CRUD operations on Records, plus Table queries with filtering and sorting. This is the most-used API group — vertical frontends and domain services call these endpoints constantly.

**Required scope:** `data:read` for reads, `data:write` for mutations.

### List Records

```
GET /api/v1/tables/{tableId}/records
```

**Query parameters:**

| Parameter             | Type    | Description                                                                            |
| --------------------- | ------- | -------------------------------------------------------------------------------------- |
| `filter`              | string  | Filter expression (see §Filter Syntax)                                                 |
| `sort`                | string  | Sort expression: `field_id:asc` or `field_id:desc`. Comma-separated for multi-sort     |
| `fields`              | string  | Comma-separated Field IDs to include. Default: all visible Fields                      |
| `page_size`           | integer | Records per page (default 50, max 500)                                                 |
| `cursor`              | string  | Pagination cursor from previous response                                               |
| `include_cross_links` | boolean | Include Cross-Linked Record data (default false). Level 0 only — IDs and display field |

**Response:**

```json
{
  "records": [
    {
      "id": "uuid",
      "fields": {
        "fld_abc123": "Acme Corp",
        "fld_def456": "plumber@acme.com",
        "fld_ghi789": { "type": "select", "value": "active" },
        "fld_jkl012": {
          "type": "cross_link",
          "linked_records": [{ "id": "rec_xyz", "display": "Job #1042" }]
        }
      },
      "created_at": "2026-02-28T10:00:00Z",
      "updated_at": "2026-02-28T14:30:00Z"
    }
  ],
  "pagination": {
    "cursor": "eyJ...",
    "has_more": true,
    "total_count": 1247
  }
}
```

**Notes:**

- Field values are returned in canonical format, keyed by Field ID (not Field name). See `sync-engine.md` for canonical JSONB format per field type.
- `total_count` is approximate for tables with >10,000 Records (uses `EXPLAIN` row estimate for performance).
- Cursor-based pagination only. No offset pagination — it doesn't scale with large datasets.

### Filter Syntax

Filters use a structured expression syntax:

```
filter=fld_abc123:eq:Acme Corp
filter=fld_def456:contains:@gmail.com
filter=fld_ghi789:eq:active,fld_jkl012:gt:2026-01-01
```

**Operators:**

| Operator       | Types                   | Meaning                                              |
| -------------- | ----------------------- | ---------------------------------------------------- |
| `eq`           | All                     | Equals                                               |
| `neq`          | All                     | Not equals                                           |
| `gt`           | Number, Date            | Greater than                                         |
| `gte`          | Number, Date            | Greater than or equal                                |
| `lt`           | Number, Date            | Less than                                            |
| `lte`          | Number, Date            | Less than or equal                                   |
| `contains`     | Text, Email, URL, Phone | Substring match (case-insensitive)                   |
| `not_contains` | Text, Email, URL, Phone | Substring exclusion                                  |
| `is_empty`     | All                     | Field is null or empty                               |
| `is_not_empty` | All                     | Field has a value                                    |
| `in`           | Select, Multi-Select    | Value is one of (comma-separated within parentheses) |
| `has_any`      | Multi-Select            | Record has any of the specified values               |
| `has_all`      | Multi-Select            | Record has all of the specified values               |
| `linked_to`    | Cross-Link              | Linked to specific Record ID                         |

**Multiple filters** are comma-separated and ANDed. OR logic requires separate queries (or a future `filter_json` parameter for complex expressions).

### Get Record

```
GET /api/v1/tables/{tableId}/records/{recordId}
```

Returns a single Record with all Fields (or only those specified via `fields` parameter). Same response shape as a single item from List Records.

**Query parameters:** `fields`, `include_cross_links` (same as List Records).

### Create Record

```
POST /api/v1/tables/{tableId}/records
```

**Body:**

```json
{
  "fields": {
    "fld_abc123": "New Customer",
    "fld_def456": "new@customer.com",
    "fld_ghi789": "active"
  }
}
```

**Response:** `201 Created` with the full Record (same shape as Get Record).

**Record Templates (optional):** The request body also accepts an optional `template_id` to apply a Record Template before field values, and an optional `context_record_id` for templates that use `$context_record` tokens. Resolution order: field defaults → template values → request `fields`. See `record-templates.md` §API Surface for full template integration.

**Validation:**

- Required Fields must be present (per Field `required` flag in `fields` table).
- Values are validated against Field type (email format, number range, select option exists, etc.).
- Cross-Link Fields accept an array of target Record IDs: `"fld_jkl012": ["rec_abc", "rec_def"]`.
- Record quota checked before creation. If exceeded: `422 RECORD_QUOTA_EXCEEDED`.

**Side effects:**

- Audit Log entry: `actor_type: 'api_key'`, action: `record.created`.
- Automation triggers: "Record Created" fires for matching Automations.
- Real-time event: `record.created` published to `table:{tableId}` Redis room.
- Outbound webhooks: `record.created` event delivered to subscribed endpoints.

### Create Multiple Records (Batch)

```
POST /api/v1/tables/{tableId}/records/batch
```

**Body:**

```json
{
  "records": [
    { "fields": { "fld_abc123": "Customer A", ... } },
    { "fields": { "fld_abc123": "Customer B", ... } }
  ]
}
```

**Limits:** Max 100 Records per batch request.

**Behavior:** All-or-nothing. If any Record fails validation, the entire batch is rejected (consistent with `bulk-operations.md` binary gating — no partial success). Returns `201` with array of created Records, or `400` with per-record error details.

### Update Record

```
PATCH /api/v1/tables/{tableId}/records/{recordId}
```

**Body:** Partial update — include only the Fields being changed:

```json
{
  "fields": {
    "fld_ghi789": "completed",
    "fld_mno345": 95
  }
}
```

**Response:** `200 OK` with the full updated Record.

**Side effects:** Same as Create — Audit Log, Automation triggers ("Record Updated", "Field Value Changed"), real-time event, outbound webhooks.

### Delete Record

```
DELETE /api/v1/tables/{tableId}/records/{recordId}
```

**Response:** `204 No Content`.

**Behavior:** Soft delete (sets `deleted_at`). Consistent with EveryStack's internal delete behavior.

**Side effects:** Audit Log, Automation triggers ("Record Deleted" — post-MVP trigger type), real-time event, outbound webhook.

---

## Schema API

Read-only access to the Tenant's data structure. Enables vertical frontends to dynamically render UI based on schema, and AI consumers to understand the data model.

**Required scope:** `schema:read`.

### List Workspaces

```
GET /api/v1/workspaces
```

Returns all Workspaces in the Tenant:

```json
{
  "workspaces": [
    {
      "id": "uuid",
      "name": "Acme Plumbing Operations",
      "slug": "acme-plumbing",
      "board": { "id": "uuid", "name": "Client Work" },
      "created_at": "2026-02-28T10:00:00Z"
    }
  ]
}
```

### List Tables

```
GET /api/v1/workspaces/{workspaceId}/tables
```

Returns all Tables in the Workspace:

```json
{
  "tables": [
    {
      "id": "uuid",
      "name": "Customers",
      "table_type": "table",
      "field_count": 14,
      "record_count": 347,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ]
}
```

### Get Table Schema

```
GET /api/v1/tables/{tableId}/schema
```

Returns the Table definition with all Fields:

```json
{
  "id": "uuid",
  "name": "Customers",
  "table_type": "table",
  "workspace_id": "uuid",
  "fields": [
    {
      "id": "fld_abc123",
      "name": "Company Name",
      "field_type": "text",
      "is_primary": true,
      "required": true,
      "config": {}
    },
    {
      "id": "fld_def456",
      "name": "Email",
      "field_type": "email",
      "is_primary": false,
      "required": true,
      "config": {}
    },
    {
      "id": "fld_ghi789",
      "name": "Status",
      "field_type": "select",
      "is_primary": false,
      "required": false,
      "config": {
        "options": [
          { "id": "opt_1", "label": "Active", "color": "green" },
          { "id": "opt_2", "label": "Inactive", "color": "gray" }
        ]
      }
    },
    {
      "id": "fld_jkl012",
      "name": "Jobs",
      "field_type": "linked_record",
      "is_primary": false,
      "required": false,
      "config": {
        "cross_link_id": "uuid",
        "target_table_id": "uuid",
        "target_table_name": "Jobs",
        "relationship_type": "one_to_many"
      }
    }
  ],
  "cross_links": [
    {
      "id": "uuid",
      "name": "Customer → Jobs",
      "source_field_id": "fld_jkl012",
      "target_table_id": "uuid",
      "target_table_name": "Jobs",
      "relationship_type": "one_to_many"
    }
  ]
}
```

### List Cross-Links

```
GET /api/v1/cross-links
```

Returns all Cross-Links in the Tenant (tenant-scoped — Cross-Links span Workspaces). Optional `table_id` query parameter to filter to a specific Table.

### Schema Descriptor Service (SDS) Endpoint

```
GET /api/v1/schema/describe
GET /api/v1/schema/describe?workspace_id={id}
GET /api/v1/schema/describe?table_id={id}
```

Returns the SDS output — a structured, AI-optimized description of the Tenant's schema. This is the same output the internal AIService consumes for contextual AI. External AI consumers (vertical domain services, MCP clients) use this to understand the data model before making AI calls.

See `schema-descriptor-service.md` for SDS output format and detail levels.

---

## Provisioning API

Create and configure Workspaces, Tables, Fields, Cross-Links, Automations, Quick Portals, Quick Forms, and Document Templates programmatically. Primary consumer: B2B vertical provisioning services that stamp out configured Tenants during customer onboarding.

**Required scope:** `schema:write` for structural operations, `automation:write` for Automations, `portal:write` for Portals/Forms, `document:write` for Document Templates. Or `admin` for all.

### Create Workspace

```
POST /api/v1/workspaces
Body: {
  "name": "Acme Plumbing Operations",
  "board_id": null
}

Response 201: { "id": "uuid", "name": "...", "slug": "acme-plumbing-operations", ... }
```

### Create Table

```
POST /api/v1/workspaces/{workspaceId}/tables
Body: {
  "name": "Customers",
  "table_type": "table",
  "fields": [
    { "name": "Company Name", "field_type": "text", "is_primary": true, "required": true },
    { "name": "Email", "field_type": "email", "required": true },
    { "name": "Phone", "field_type": "phone" },
    { "name": "Status", "field_type": "select", "config": {
      "options": [
        { "label": "Active", "color": "green" },
        { "label": "Inactive", "color": "gray" }
      ]
    }}
  ]
}

Response 201: { "id": "uuid", "name": "Customers", "fields": [...with generated IDs...] }
```

Tables can be created with inline Fields (as above) for convenience, or Fields can be added individually:

### Create Field

```
POST /api/v1/tables/{tableId}/fields
Body: {
  "name": "Annual Revenue",
  "field_type": "number",
  "config": { "precision": 2, "format": "currency", "currency": "USD" }
}

Response 201: { "id": "fld_xyz", "name": "Annual Revenue", ... }
```

### Update Field

```
PATCH /api/v1/tables/{tableId}/fields/{fieldId}
Body: {
  "name": "Revenue (Annual)",
  "config": { "precision": 2, "format": "currency", "currency": "USD" }
}
```

### Create Cross-Link

```
POST /api/v1/cross-links
Body: {
  "name": "Customer → Jobs",
  "source_table_id": "uuid",
  "target_table_id": "uuid",
  "relationship_type": "one_to_many"
}

Response 201: {
  "id": "uuid",
  "name": "Customer → Jobs",
  "source_field_id": "fld_auto_generated",
  "target_table_id": "uuid",
  "reverse_field_id": "fld_auto_generated_reverse",
  ...
}
```

Cross-Link creation automatically creates Linked Record Fields on both the source and target Tables (per `cross-linking.md`).

### Create Automation

```
POST /api/v1/workspaces/{workspaceId}/automations
Body: {
  "name": "Job completed → send invoice",
  "trigger": {
    "type": "field_value_changed",
    "config": {
      "table_id": "uuid",
      "field_id": "fld_status",
      "to_value": "completed"
    }
  },
  "steps": [
    {
      "type": "send_email",
      "config": {
        "to": "{{record.fld_customer_email}}",
        "subject": "Job {{record.fld_job_number}} Complete",
        "body_template": "Your job has been completed. Invoice attached."
      }
    },
    {
      "type": "generate_document",
      "config": {
        "template_id": "uuid",
        "record_id": "{{trigger.record_id}}"
      }
    }
  ],
  "status": "active"
}
```

MVP Automations are linear — `steps` is an ordered array of actions, no branching. See `automations.md` for the 6 trigger types and 7 action types. The JSONB structure for `trigger` and `steps` follows the same schema as the `automations` table in `data-model.md`.

### Create Quick Portal

```
POST /api/v1/workspaces/{workspaceId}/portals
Body: {
  "name": "Customer Job Status",
  "table_id": "uuid",
  "record_view_config_id": "uuid",
  "auth_type": "magic_link",
  "status": "draft",
  "settings": {
    "editable_fields": ["fld_feedback", "fld_preferred_date"],
    "branding": { "accent_color": "#2563eb", "logo_url": "https://..." }
  }
}
```

Quick Portals are Record View configurations with auth wrappers — per `GLOSSARY.md`. The Record View Config referenced here must already exist (create it via the Record View Config endpoint below).

### Create Record View Config

```
POST /api/v1/tables/{tableId}/record-view-configs
Body: {
  "name": "Customer Portal Layout",
  "layout": {
    "columns": 2,
    "fields": [
      { "field_id": "fld_abc", "column_span": 2, "row": 0 },
      { "field_id": "fld_def", "column_span": 1, "row": 1 },
      { "field_id": "fld_ghi", "column_span": 1, "row": 1 }
    ]
  }
}
```

Record View Configs are the shared layout primitive underlying Record Views, Quick Portals, and Quick Forms — per `data-model.md`.

### Create Quick Form

```
POST /api/v1/workspaces/{workspaceId}/forms
Body: {
  "name": "Service Request Form",
  "table_id": "uuid",
  "record_view_config_id": "uuid",
  "status": "published",
  "settings": {
    "success_message": "Thank you! We'll be in touch within 24 hours.",
    "turnstile_enabled": true,
    "notification_emails": ["dispatch@acme.com"]
  }
}
```

### Create Portal Access

```
POST /api/v1/portals/{portalId}/access
Body: {
  "record_id": "uuid",
  "email": "customer@example.com"
}

Response 201: {
  "id": "uuid",
  "portal_url": "https://portal.everystack.app/acme-job-status",
  "magic_link": "https://portal.everystack.app/acme-job-status?token=..."
}
```

Creates a Portal Access entry granting a specific email access to a specific Record through the Quick Portal. Returns the portal URL and (for magic link auth) the initial magic link. See `portals.md` §`portal_access` Table.

### Create Document Template

```
POST /api/v1/workspaces/{workspaceId}/document-templates
Body: {
  "name": "Invoice Template",
  "table_id": "uuid",
  "content": { /* TipTap JSON with merge tags */ },
  "settings": {
    "page_size": "A4",
    "orientation": "portrait",
    "margins": { "top": 20, "bottom": 20, "left": 25, "right": 25 }
  }
}
```

Content is TipTap JSON with merge tag nodes. See `smart-docs.md` §Custom EveryStack Node Definitions for the merge tag format.

### Generate Document

```
POST /api/v1/document-templates/{templateId}/generate
Body: {
  "record_id": "uuid"
}

Response 200: {
  "document_id": "uuid",
  "file_url": "https://cdn.everystack.app/docs/...",
  "file_type": "pdf",
  "generated_at": "2026-02-28T10:00:00Z"
}
```

Triggers PDF generation via Gotenberg using the specified Document Template and Record. The generated file URL is a signed S3/R2 URL with configurable expiry.

---

## Automation API

Trigger Automations externally and query execution status.

### Trigger Automation (via Inbound Webhook)

The primary mechanism for external services to trigger Automations is the inbound webhook endpoint, already specced in `automations.md` §Inbound Webhook Receiving:

```
POST /api/webhooks/automation/{automationId}/{webhookToken}
Body: { "event": "session.completed", "data": { ... } }

Response 202: { "execution_id": "uuid" }
```

This endpoint is NOT authenticated via API key — it uses the `webhookToken` in the URL (32-char random token). See `automations.md` for HMAC signature verification, rate limits (60/min per Automation), and payload size limits (256KB).

Payload is available to Automation steps via `{{trigger.webhookPayload.fieldName}}`.

### Trigger Automation (via API Key)

An alternative trigger mechanism using standard API key auth:

```
POST /api/v1/automations/{automationId}/trigger
Authorization: Bearer esk_live_...
Body: {
  "payload": { "event": "session.completed", "data": { ... } }
}

Response 202: { "execution_id": "uuid" }
```

**Required scope:** `automation:trigger` or `automation:write` or `admin`.

Same behavior as the webhook trigger, but authenticated via API key instead of webhook token. Useful when the calling service already has an API key and doesn't want to manage separate webhook tokens.

### Get Automation Run Status

```
GET /api/v1/automations/{automationId}/runs/{runId}

Response 200: {
  "id": "uuid",
  "automation_id": "uuid",
  "status": "completed",
  "started_at": "2026-02-28T10:00:00Z",
  "completed_at": "2026-02-28T10:00:02Z",
  "step_log": [
    { "step": 0, "type": "send_email", "status": "success", "duration_ms": 450 },
    { "step": 1, "type": "update_record", "status": "success", "duration_ms": 120 }
  ]
}
```

**Required scope:** `automation:read` or `admin`.

### List Automation Runs

```
GET /api/v1/automations/{automationId}/runs?status=failed&page_size=20
```

Returns recent runs for the Automation, optionally filtered by status (running, completed, failed).

---

## AI API

Expose AIService for external consumption. Domain services can use EveryStack's AI infrastructure — provider-agnostic routing, capability tiers, prompt registry, and credit metering — without implementing their own AI integration.

**Required scope:** `ai:use`.

### Complete

```
POST /api/v1/ai/complete
Body: {
  "prompt_template_id": "exam_rubric_assessment",
  "variables": {
    "transcript": "The student said...",
    "exam_type": "cambridge_b2",
    "rubric_criteria": "grammar, discourse, pronunciation, interaction"
  },
  "capability_tier": "standard"
}

Response 200: {
  "result": { /* structured output per prompt template's outputSchema */ },
  "usage": {
    "credits_charged": 1.5,
    "credits_remaining": 847.5,
    "model": "claude-sonnet-4-5-20250929",
    "input_tokens": 2400,
    "output_tokens": 800
  }
}
```

**Behavior:**

- Resolves `capability_tier` to a provider/model via `CAPABILITY_ROUTING` (see `ai-architecture.md`).
- If `prompt_template_id` is provided, loads the template from the Prompt Registry and compiles it with the supplied `variables`.
- If no template, a raw `messages` array can be sent instead (same shape as the Anthropic Messages API, compiled through the provider adapter).
- Credits computed and deducted from the Tenant's `ai_credit_ledger`. If credits exhausted: `422 AI_CREDITS_EXHAUSTED`.
- Usage logged to `ai_usage_log` with `feature: 'platform_api'`.

### Raw Messages (Alternative)

```
POST /api/v1/ai/complete
Body: {
  "messages": [
    { "role": "system", "content": "You are an assessment engine..." },
    { "role": "user", "content": "Score this transcript: ..." }
  ],
  "capability_tier": "standard",
  "output_schema": { /* JSON Schema for structured output */ }
}
```

For domain services that manage their own prompts rather than registering them in the Prompt Registry.

### Register Prompt Template

```
POST /api/v1/ai/prompt-templates
Body: {
  "id": "exam_rubric_assessment",
  "description": "Scores a speaking transcript against exam rubrics",
  "capability_tier": "standard",
  "system_instruction": "You are an English language assessment expert. Score the following transcript against {{rubric_criteria}} for the {{exam_type}} exam...",
  "output_schema": {
    "type": "object",
    "properties": {
      "grammar_score": { "type": "number" },
      "discourse_score": { "type": "number" },
      "feedback": { "type": "string" }
    }
  },
  "variables": [
    { "name": "transcript", "required": true },
    { "name": "exam_type", "required": true },
    { "name": "rubric_criteria", "required": true }
  ]
}
```

**Required scope:** `ai:use` + `admin` (template registration is an admin operation).

Registered templates are Tenant-scoped. They don't pollute EveryStack's built-in templates — they live in a separate namespace keyed by Tenant ID.

---

## Webhook Management API

Manage outbound webhook endpoint registrations programmatically. Supplements the Workspace Settings → Integrations → Webhooks UI.

**Required scope:** `admin`.

### Register Webhook Endpoint

```
POST /api/v1/workspaces/{workspaceId}/webhooks
Body: {
  "url": "https://api.jobstack.com/hooks/everystack",
  "events": ["record.created", "record.updated", "automation.completed"],
  "description": "JobStack event handler"
}

Response 201: {
  "id": "uuid",
  "url": "https://api.jobstack.com/hooks/everystack",
  "signing_secret": "whsec_...",     ← shown once
  "events": ["record.created", "record.updated", "automation.completed"],
  "status": "active"
}
```

See `automations.md` §Webhook Architecture for the full event catalog (13 MVP events), payload envelope format, delivery pipeline, retry strategy, and SSRF protection.

### List Webhook Endpoints

```
GET /api/v1/workspaces/{workspaceId}/webhooks
```

### Update Webhook Endpoint

```
PATCH /api/v1/workspaces/{workspaceId}/webhooks/{webhookId}
Body: { "events": ["record.created", "record.updated"] }
```

### Delete Webhook Endpoint

```
DELETE /api/v1/workspaces/{workspaceId}/webhooks/{webhookId}
```

### Get Webhook Delivery Log

```
GET /api/v1/workspaces/{workspaceId}/webhooks/{webhookId}/deliveries?status=failed
```

Returns delivery history with status, response code, duration, retry count. 30-day retention per `automations.md`.

---

## File Upload API

Upload files to EveryStack's storage for use in File/Image Fields.

**Required scope:** `data:write`.

### Get Presigned Upload URL

```
POST /api/v1/files/upload-url
Body: {
  "filename": "invoice-scan.pdf",
  "content_type": "application/pdf",
  "size": 245000
}

Response 200: {
  "upload_url": "https://s3.../presigned...",
  "file_key": "uploads/tenant_id/abc123/invoice-scan.pdf",
  "expires_in": 3600
}
```

The caller uploads the file directly to the presigned S3/R2 URL, then references the `file_key` when creating or updating a Record's File Field:

```
PATCH /api/v1/tables/{tableId}/records/{recordId}
Body: {
  "fields": {
    "fld_attachments": [
      { "file_key": "uploads/tenant_id/abc123/invoice-scan.pdf", "filename": "invoice-scan.pdf" }
    ]
  }
}
```

File processing (virus scanning via ClamAV, image thumbnails via sharp, MIME verification) runs asynchronously after the Record update. See `files.md` for the full upload pipeline.

---

## Tenant Management API

Tenant-level operations for vertical provisioning services.

**Required scope:** `admin`.

**Note on Tenant creation:** Creating a new Tenant is a platform-level operation that requires a platform-level service key (not a Tenant-scoped key, since the Tenant doesn't exist yet). Platform-level keys are issued to authorized vertical operators during onboarding with EveryStack. They have a `esk_platform_` prefix and can create Tenants but cannot access any Tenant's data. Storage: `platform_keys` table (post-MVP, see `data-model.md` §Post-MVP Entities).

### Create Tenant

```
POST /api/v1/tenants
Authorization: Bearer esk_platform_...
Body: {
  "name": "Acme Plumbing",
  "plan": "professional"
}

Response 201: {
  "id": "uuid",
  "name": "Acme Plumbing",
  "slug": "acme-plumbing",
  "plan": "professional",
  "admin_api_key": {
    "id": "uuid",
    "key": "esk_live_...",            ← Tenant-scoped admin key, shown once
    "scopes": ["admin"]
  }
}
```

Creating a Tenant returns an initial admin-scoped API key for that Tenant. The vertical provisioning service uses this key for all subsequent setup calls (create Workspaces, Tables, etc.).

### Get Tenant

```
GET /api/v1/tenant
Authorization: Bearer esk_live_...     ← any Tenant-scoped key
```

Returns the Tenant associated with the API key: name, slug, plan, settings, usage summary.

---

## Phase Implementation

The Platform API ships incrementally alongside EveryStack's core development:

| Phase                         | API Work                                                                                                                                                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation**          | `api_keys` table schema. Key creation/revocation via Settings UI. Auth middleware for `Authorization: Bearer` header. Rate limiting infrastructure (Redis token bucket). Error format. `actor_type: 'api_key'` in Audit Log. |
| **MVP — Core UX**             | Data API (Record CRUD, Table queries, filter/sort). Schema API (list Workspaces, Tables, Fields, Cross-Links). File Upload API. API request logging.                                                                         |
| **Post-MVP — Portals & Apps** | Provisioning API (create Workspaces, Tables, Fields, Cross-Links). Portal/Form management endpoints. Document Template management.                                                                                           |
| **Post-MVP — Documents**      | Document Generation endpoint. Automation management and trigger endpoints. Webhook management API.                                                                                                                           |
| **Post-MVP — Automations**    | AI API (AIService consumption, prompt template registration). Tenant Management API (Tenant creation with platform keys). SDS endpoint. Full API documentation site.                                                         |
| **Post-MVP**                  | Batch provisioning (create full Workspace structure in one call). SDK generation (TypeScript, Python). API analytics dashboard.                                                                                              |

---

## SDK Considerations (Post-MVP)

Once the API is stable, generate typed SDKs from the OpenAPI spec:

```typescript
// TypeScript SDK (future)
import { EveryStackClient } from '@everystack/sdk';

const client = new EveryStackClient({ apiKey: 'esk_live_...' });

const records = await client.tables('tbl_abc').records.list({
  filter: { status: 'active' },
  sort: { created_at: 'desc' },
  pageSize: 50,
});

const newRecord = await client.tables('tbl_abc').records.create({
  fields: { name: 'Acme Corp', status: 'active' },
});
```

SDK generation is a post-MVP deliverable. The REST API with clear documentation is sufficient for all vertical development during MVP.
