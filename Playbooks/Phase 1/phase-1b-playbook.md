# Phase 1B — Database Schema, Connection Pooling, Tenant Routing

## Phase Context

### What Has Been Built

**Phase 1A (Monorepo, CI Pipeline, Dev Environment)** is complete and merged to `main`:

- Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds
- Docker Compose with PostgreSQL 16, PgBouncer, Redis
- GitHub Actions CI (lint → typecheck → test)
- ESLint + Prettier config
- `tsconfig` strict mode
- `.env.example`

Key files that exist:

- `turbo.json`, `pnpm-workspace.yaml`
- `docker-compose.yml` (PostgreSQL on 5432, PgBouncer on 6432, Redis on 6379)
- `docker-compose.test.yml`
- `.github/workflows/ci.yml`
- `packages/shared/` package scaffold

### What This Phase Delivers

A complete database layer: Drizzle ORM schemas for all 50 MVP tables, PgBouncer connection pooling in transaction mode, tenant-isolated read/write routing via `getDbForTenant()`, Row-Level Security (RLS) policies on all tenant-scoped tables, UUIDv7 primary keys (no serial/auto-increment), hash-partitioned `records` table, and an initial migration. After this phase, every subsequent phase can create data access functions against a stable, well-defined schema.

### What This Phase Does NOT Build

- Application-level CRUD helpers or data access functions (Phase 1C+)
- tsvector indexing or `search_vector` column population logic (Core UX)
- JSONB expression indexes for filtered/sorted fields (Core UX optimization)
- CockroachDB regional routing or multi-region setup (post-MVP)
- Any UI code or React components
- Any sync engine logic or platform adapters (Phase 2)
- Authentication or middleware (Phase 1C)
- Test factories or test infrastructure (Phase 1E)
- The `search_vector` column IS declared on `records` (it's part of the table definition), but the `extractSearchableText()` and `buildSearchVector()` functions that populate it ship in Core UX

### Architecture Patterns for This Phase

1. **All primary keys are UUIDv7** — use `gen_random_uuid()` as Postgres default. No `serial`, `BIGSERIAL`, or `SEQUENCE`. The application generates UUIDv7 for ordering when needed; the DB default is a fallback.
2. **All tenant-scoped queries go through `getDbForTenant(tenantId, intent)`** — returns the write primary or read replica connection based on intent.
3. **`environment` column** on `tables`, `fields`, `cross_links`, `views`, `record_templates`, `automations`, `document_templates` — always `'live'` in MVP. Every query on these tables MUST filter `WHERE environment = 'live'`.
4. **`records` table is hash-partitioned by `tenant_id`** with 16 partitions from initial creation.
5. **`audit_log` and `ai_usage_log` are time-partitioned** (monthly) for retention management.
6. **RLS is defense-in-depth** — application-level `tenant_id` filtering is primary; RLS catches bugs. `SET LOCAL app.current_tenant_id` at transaction start.
7. **CockroachDB safeguards active**: UUIDv7 PKs, no PG-specific syntax in app queries, explicit transactions, no advisory locks, hash-partitioning compatible schemas.
8. **Drizzle ORM only** — no raw SQL except in migration files.
9. **Foreign keys use `onDelete` cascades or restrictions as appropriate** — cascading deletes for child records that cannot exist without parents, restrict for entities with cross-references.
10. **Connection strings**: `DATABASE_URL` → PgBouncer (6432), `DATABASE_URL_DIRECT` → PostgreSQL (5432, migrations only).

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.
Phase division files are not needed during build execution — their content has been pre-digested into this playbook.

---

## Section Index

| Prompt | Deliverable                                                                                                                                                                         | Depends On | Lines (est.) |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------ |
| 1      | Drizzle config, UUIDv7 utility, `getDbForTenant()` client, PgBouncer transaction-mode config                                                                                        | None       | ~180         |
| 2      | Tier 0 schema — `users`, `tenants`                                                                                                                                                  | 1          | ~120         |
| 3      | Tier 1 schema — `tenant_memberships`, `boards`, `board_memberships`, `workspaces`, `workspace_memberships`                                                                          | 2          | ~180         |
| 4      | Tier 2 schema — `base_connections`, `tables`, `fields`                                                                                                                              | 3          | ~200         |
| 5      | Tier 3 schema — `records` (hash-partitioned), `cross_links`, `cross_link_index`                                                                                                     | 4          | ~200         |
| CP-1   | Integration Checkpoint 1                                                                                                                                                            | 1–5        | —            |
| 6      | Tier 4 schema — `views`, `user_view_preferences`, `record_view_configs`, `record_templates`, `sections`                                                                             | 5          | ~200         |
| 7      | Tier 5A schema — `portals`, `portal_access`, `portal_sessions`, `forms`, `form_submissions`                                                                                         | 5          | ~160         |
| 8      | Tier 5B schema — sync tables (`synced_field_mappings`, `sync_conflicts`, `sync_failures`, `sync_schema_changes`)                                                                    | 4          | ~160         |
| 9      | Tier 6A schema — `threads`, `thread_participants`, `thread_messages`, `user_saved_messages`                                                                                         | 3          | ~160         |
| CP-2   | Integration Checkpoint 2                                                                                                                                                            | 6–9        | —            |
| 10     | Tier 6B schema — `user_tasks`, `user_events`, `notifications`, `user_notification_preferences`                                                                                      | 3          | ~140         |
| 11     | Tier 6C schema — `document_templates`, `generated_documents`, `automations`, `automation_runs`, `webhook_endpoints`, `webhook_delivery_log`                                         | 4, 5       | ~200         |
| 12     | Tier 7 schema — `ai_usage_log`, `ai_credit_ledger`, `audit_log`, `api_keys`, `api_request_log`, `user_recent_items`, `command_bar_sessions`, `feature_suggestions`, `feature_votes` | 3          | ~220         |
| CP-3   | Integration Checkpoint 3                                                                                                                                                            | 10–12      | —            |
| 13     | RLS policies on all tenant-scoped tables + initial migration generation + schema barrel export                                                                                      | 1–12       | ~250         |
| CP-4   | Final Integration Checkpoint + PR                                                                                                                                                   | 13         | —            |

---

## Prompt 1: Drizzle Config, UUIDv7 Utility, Database Client with `getDbForTenant()`

**Depends on:** None (Phase 1A complete — monorepo, Docker Compose with PgBouncer exist)
**Load context:** database-scaling.md lines 29–95 (Connection Pooling, getDbForTenant()), cockroachdb-readiness.md lines 291–331 (Development Safeguards)
**Target files:** `packages/shared/db/drizzle.config.ts`, `packages/shared/db/client.ts`, `packages/shared/db/uuid.ts`, `packages/shared/db/schema/index.ts` (barrel — initially empty), `.env.example` (update with DB vars), `docker-compose.yml` (verify PgBouncer transaction mode)
**Migration required:** No (infrastructure only — no tables yet)
**Git:** Create and checkout branch `feat/phase-1b-database` from `main`. Commit with message `feat(db): drizzle config, UUIDv7 utility, getDbForTenant client [Phase 1B, Prompt 1]`

### Schema Snapshot

N/A — no tables created in this prompt.

### Task

Set up the Drizzle ORM infrastructure and tenant-aware database client.

**1. Install dependencies:**

```bash
pnpm add drizzle-orm postgres --filter @everystack/shared
pnpm add -D drizzle-kit --filter @everystack/shared
```

**2. Create `packages/shared/db/drizzle.config.ts`:**

- Configure Drizzle Kit for PostgreSQL with `driver: 'pg'`.
- Schema path: `packages/shared/db/schema/`.
- Migration output: `packages/shared/db/migrations/`.
- Connection string from `DATABASE_URL_DIRECT` (bypasses PgBouncer for migrations — session mode required for DDL).

**3. Create `packages/shared/db/uuid.ts`:**

- Export a `generateUUIDv7()` function that produces UUIDv7 (time-ordered UUIDs).
- Use a library like `uuidv7` or implement per RFC 9562. The key requirement: IDs sort chronologically by creation time, which improves index locality.
- Export a `isValidUUID(value: string): boolean` helper for validation.
- **No `serial` or `BIGSERIAL` anywhere in the project.** This is a CockroachDB readiness safeguard.

**4. Create `packages/shared/db/client.ts`:**

- Create two Drizzle client instances: `db` (write primary via `DATABASE_URL`) and `dbRead` (read replica via `DATABASE_READ_URL`).
- MVP: `DATABASE_READ_URL` = `DATABASE_URL` (same instance). Adding a read replica later = changing one env var.
- Export `getDbForTenant(tenantId: string, intent: 'read' | 'write' = 'write')`:
  - If intent is `'read'`, return `dbRead`.
  - If intent is `'write'`, return `db`.
  - Include a commented-out section for future multi-region routing (post-MVP).
- Both connection strings MUST point to PgBouncer (port 6432), NOT directly to PostgreSQL (port 5432).
- Export the `DrizzleClient` type for use in data layer functions.

**5. Verify PgBouncer transaction mode in `docker-compose.yml`:**

- Confirm the PgBouncer service is configured with `pool_mode = transaction`.
- Confirm `DATABASE_URL` in `.env.example` uses port 6432 (PgBouncer).
- Add `DATABASE_URL_DIRECT` pointing to port 5432 (PostgreSQL, for migrations).
- Add `DATABASE_READ_URL` pointing to port 6432 (same as `DATABASE_URL` for MVP).

**6. Create an empty barrel file `packages/shared/db/schema/index.ts`:**

- This will re-export all schema tables as they're created in subsequent prompts.
- For now, export nothing — just create the file with a comment explaining its purpose.

### Acceptance Criteria

- [ ] `generateUUIDv7()` produces valid UUID strings that sort chronologically (test with 100 sequential calls)
- [ ] `isValidUUID()` accepts valid UUIDs and rejects invalid strings
- [ ] `getDbForTenant(tenantId, 'read')` returns the read client instance
- [ ] `getDbForTenant(tenantId, 'write')` returns the write client instance
- [ ] `DATABASE_URL` in `.env.example` points to PgBouncer (port 6432)
- [ ] `DATABASE_URL_DIRECT` in `.env.example` points to PostgreSQL (port 5432)
- [ ] PgBouncer config in `docker-compose.yml` uses `pool_mode = transaction`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Multi-region routing logic (post-MVP — leave as commented code only)
- Connection pooling metrics or monitoring (Phase 1D observability)
- Any database tables (those start in Prompt 2)
- Test factories (Phase 1E)

---

## Prompt 2: Tier 0 Schema — `users` and `tenants`

**Depends on:** 1
**Load context:** data-model.md lines 24–37 (User, Tenant & Workspace section — users, tenants rows only)
**Target files:** `packages/shared/db/schema/users.ts`, `packages/shared/db/schema/tenants.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0001_create_users_tenants.ts`
**Git:** Commit with message `feat(db): create users and tenants schema [Phase 1B, Prompt 2]`

### Schema Snapshot

```
users: id (UUIDv7 PK), clerk_id (VARCHAR UNIQUE NOT NULL), email (VARCHAR NOT NULL), name (VARCHAR NOT NULL), avatar_url (VARCHAR nullable), preferences (JSONB — {locale, theme}), created_at (TIMESTAMPTZ DEFAULT now()), updated_at (TIMESTAMPTZ DEFAULT now())

tenants: id (UUIDv7 PK), name (VARCHAR NOT NULL), plan (VARCHAR DEFAULT 'freelancer'), default_locale (VARCHAR DEFAULT 'en'), settings (JSONB — {branding_accent_color, logo_url, email_branding}), created_at (TIMESTAMPTZ DEFAULT now()), updated_at (TIMESTAMPTZ DEFAULT now())
```

### Task

Create the Drizzle schema definitions for the two identity-layer tables that have no `tenant_id` (they ARE the identity layer).

**1. `packages/shared/db/schema/users.ts`:**

- Define the `users` table with all columns from the schema snapshot.
- `id` is UUIDv7 primary key with `defaultRandom()`.
- `clerk_id` is unique — this is the join key to Clerk's user system.
- `preferences` JSONB defaults to `{}`.
- Create a TypeScript `User` type inferred from the schema using Drizzle's `InferSelectModel`.
- Create a `NewUser` type using `InferInsertModel`.
- Add indexes: `(clerk_id)` unique, `(email)`.
- **Note: `users` has NO `tenant_id`.** It is the only table (along with `tenants`) that is not tenant-scoped. A user can belong to multiple tenants via `tenant_memberships`.

**2. `packages/shared/db/schema/tenants.ts`:**

- Define the `tenants` table with all columns from the schema snapshot.
- `plan` is VARCHAR with values: `freelancer`, `starter`, `professional`, `business`, `enterprise`.
- `settings` JSONB defaults to `{}`.
- Export `Tenant` and `NewTenant` types.
- Add index: `(name)`.

**3. Update `packages/shared/db/schema/index.ts`** to re-export both tables.

**4. Generate migration** via `drizzle-kit generate`. Verify the migration creates both tables with correct types, defaults, and indexes.

### Acceptance Criteria

- [ ] `users` table schema compiles with correct column types and constraints
- [ ] `tenants` table schema compiles with correct column types and constraints
- [ ] `clerk_id` has a unique index
- [ ] `users` table has NO `tenant_id` column
- [ ] `tenants` table has NO `tenant_id` column
- [ ] Migration file is generated and applies cleanly to a fresh database
- [ ] `User`, `NewUser`, `Tenant`, `NewTenant` types are exported
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- `tenant_memberships` (Prompt 3 — needs both `users` and `tenants` to exist)
- Any RLS policies (Prompt 13 — applied all at once after all tables exist)
- Data seed scripts (Phase 1E testing infrastructure)

---

## Prompt 3: Tier 1 Schema — Memberships, Boards, Workspaces

**Depends on:** 2
**Load context:** data-model.md lines 24–37 (tenant_memberships, boards, board_memberships, workspaces, workspace_memberships rows)
**Target files:** `packages/shared/db/schema/tenant-memberships.ts`, `packages/shared/db/schema/boards.ts`, `packages/shared/db/schema/board-memberships.ts`, `packages/shared/db/schema/workspaces.ts`, `packages/shared/db/schema/workspace-memberships.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0002_create_org_hierarchy.ts`
**Git:** Commit with message `feat(db): create org hierarchy schema — memberships, boards, workspaces [Phase 1B, Prompt 3]`

### Schema Snapshot

```
tenant_memberships: id (UUIDv7 PK), tenant_id (FK → tenants.id), user_id (FK → users.id), role (VARCHAR: owner|admin|member), status (VARCHAR: active|invited|suspended), invited_by (nullable FK → users.id), created_at, updated_at
  Indexes: (tenant_id, user_id) UNIQUE, (user_id)

boards: id (UUIDv7 PK), tenant_id (FK → tenants.id), name (VARCHAR NOT NULL), icon (VARCHAR nullable), color (VARCHAR 20 nullable), sort_order (INTEGER), created_at
  Indexes: (tenant_id, sort_order)

board_memberships: id (UUIDv7 PK), board_id (FK → boards.id ON DELETE CASCADE), user_id (FK → users.id), default_workspace_role (VARCHAR: manager|team_member|viewer), granted_at (TIMESTAMPTZ DEFAULT now())
  Indexes: (board_id, user_id) UNIQUE

workspaces: id (UUIDv7 PK), tenant_id (FK → tenants.id), board_id (nullable FK → boards.id ON DELETE SET NULL), name (VARCHAR NOT NULL), icon (VARCHAR nullable), color (VARCHAR nullable), slug (VARCHAR NOT NULL), sort_order (INTEGER), settings (JSONB DEFAULT '{}'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, slug) UNIQUE, (tenant_id, sort_order), (board_id)

workspace_memberships: id (UUIDv7 PK), user_id (FK → users.id), tenant_id (FK → tenants.id), workspace_id (FK → workspaces.id ON DELETE CASCADE), role (VARCHAR: manager|team_member|viewer), joined_at (TIMESTAMPTZ DEFAULT now()), last_accessed_at (TIMESTAMPTZ nullable), status_emoji (VARCHAR nullable), status_text (VARCHAR nullable), status_clear_at (TIMESTAMPTZ nullable)
  Indexes: (user_id, workspace_id) UNIQUE, (tenant_id, workspace_id), (user_id)
```

### Task

Create the organizational hierarchy tables that define how users relate to tenants and workspaces.

**1. `tenant_memberships`:** Org-level membership. Role enum: `owner`, `admin`, `member`. Status enum: `active`, `invited`, `suspended`. The `(tenant_id, user_id)` pair must be unique — one membership per user per org. `invited_by` is nullable FK to `users.id` (null for self-signup owners).

**2. `boards`:** Optional workspace grouping. Tenant-scoped. `sort_order` INTEGER for sidebar ordering.

**3. `board_memberships`:** Board-level access grants. Cascade delete when board is deleted. `default_workspace_role` determines what role users get when workspaces are added to the board.

**4. `workspaces`:** The primary organizational container. `board_id` is nullable (ungrouped workspaces). `slug` is unique per tenant for URL routing. `settings` JSONB for workspace-level configuration.

**5. `workspace_memberships`:** Per-workspace role assignment. Workspace-level roles only: `manager`, `team_member`, `viewer`. Owner/Admin are org-level (on `tenant_memberships`). Custom presence status fields (`status_emoji`, `status_text`, `status_clear_at`).

**6. Establish Drizzle relations** between these tables and the Tier 0 tables for type-safe joins.

**7. Update barrel export.**

**8. Generate migration.** Verify FK ordering is correct (tenants and users must exist before memberships).

### Acceptance Criteria

- [ ] All five tables compile with correct column types, FKs, and constraints
- [ ] `(tenant_id, user_id)` is unique on `tenant_memberships`
- [ ] `(user_id, workspace_id)` is unique on `workspace_memberships`
- [ ] `(tenant_id, slug)` is unique on `workspaces`
- [ ] `board_memberships` cascades on board delete
- [ ] `workspaces.board_id` sets null on board delete
- [ ] Drizzle relations are defined for joins between all Tier 0–1 tables
- [ ] Migration applies cleanly after Prompt 2's migration
- [ ] All inferred types (`TenantMembership`, `Workspace`, etc.) are exported
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Clerk webhook handler that creates these rows (Phase 1C)
- Permission check utilities (`checkRole()`, `requireRole()`) — those are Phase 1C
- Any application logic for invitations or role changes

---

## Prompt 4: Tier 2 Schema — `base_connections`, `tables`, `fields`

**Depends on:** 3
**Load context:** data-model.md lines 42–45 (base_connections, tables, fields rows), data-model.md lines 195–209 (environment column rules)
**Target files:** `packages/shared/db/schema/base-connections.ts`, `packages/shared/db/schema/tables.ts`, `packages/shared/db/schema/fields.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0003_create_data_layer.ts`
**Git:** Commit with message `feat(db): create base_connections, tables, fields schema [Phase 1B, Prompt 4]`

### Schema Snapshot

```
base_connections: id (UUIDv7 PK), tenant_id (FK → tenants.id), platform (VARCHAR: airtable|notion|smartsuite), external_base_id (VARCHAR), external_base_name (VARCHAR), oauth_tokens (JSONB — encrypted at rest), sync_config (JSONB DEFAULT '{}'), sync_direction (VARCHAR DEFAULT 'bidirectional': inbound_only|bidirectional), conflict_resolution (VARCHAR DEFAULT 'last_write_wins': last_write_wins|manual), last_sync_at (TIMESTAMPTZ nullable), sync_status (VARCHAR DEFAULT 'active': active|paused|error|auth_required|converted|converted_dual_write|converted_finalized), health (JSONB DEFAULT '{}'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id), (tenant_id, platform)

tables: id (UUIDv7 PK), workspace_id (FK → workspaces.id ON DELETE CASCADE), tenant_id (FK → tenants.id), name (VARCHAR NOT NULL), table_type (VARCHAR DEFAULT 'table': table|projects|calendar|documents|wiki), tab_color (VARCHAR 20 nullable), environment (VARCHAR DEFAULT 'live': live|sandbox), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, workspace_id), (workspace_id, environment)

fields: id (UUIDv7 PK), table_id (FK → tables.id ON DELETE CASCADE), tenant_id (FK → tenants.id), name (VARCHAR NOT NULL), field_type (VARCHAR NOT NULL), field_sub_type (VARCHAR nullable), is_primary (BOOLEAN DEFAULT false), is_system (BOOLEAN DEFAULT false), required (BOOLEAN DEFAULT false), unique (BOOLEAN DEFAULT false), read_only (BOOLEAN DEFAULT false), config (JSONB DEFAULT '{}'), display (JSONB DEFAULT '{}'), permissions (JSONB DEFAULT '{}'), default_value (JSONB nullable), description (TEXT nullable), sort_order (INTEGER DEFAULT 0), external_field_id (VARCHAR nullable), environment (VARCHAR DEFAULT 'live'), created_at, updated_at
  Indexes: (tenant_id, table_id, environment), (table_id, sort_order), (table_id, external_field_id) WHERE external_field_id IS NOT NULL
```

### Task

Create the data definition layer — the tables that describe what data exists (connections, tables, fields) but not the data itself (records come in Prompt 5).

**1. `base_connections`:** Sync credentials to external platforms. `oauth_tokens` JSONB stores encrypted OAuth tokens. `health` JSONB stores connection health metrics (`last_success_at`, `consecutive_failures`, `next_retry_at`, `last_error`, `records_synced`, `records_failed`). `sync_status` has 7 possible values including the 3-phase conversion statuses.

**2. `tables`:** Table definitions within workspaces. **Critical: `environment` column defaults to `'live'`.** MVP table_types are `table` and `projects` only. Calendar, documents, wiki are defined in the enum but are post-MVP. Cascade delete from workspace.

**3. `fields`:** Column definitions within tables. `config` JSONB holds type-specific configuration. `display` JSONB holds rendering hints. `permissions` JSONB holds Layer 1 field-level permission defaults. `external_field_id` maps to the source platform field for synced tables — null for EveryStack-native fields. **Critical: `environment` column defaults to `'live'`.**

**4. Establish Drizzle relations** for the FK chain: `tenants → base_connections`, `workspaces → tables → fields`.

**5. Update barrel export.**

**6. Generate migration.**

### Acceptance Criteria

- [ ] All three tables compile with correct column types and constraints
- [ ] `tables.environment` defaults to `'live'` — verify in schema definition
- [ ] `fields.environment` defaults to `'live'` — verify in schema definition
- [ ] `fields` cascade deletes when parent `table` is deleted
- [ ] `tables` cascade deletes when parent `workspace` is deleted
- [ ] Index on `(table_id, external_field_id)` is partial (WHERE external_field_id IS NOT NULL)
- [ ] Migration applies cleanly after Prompt 3's migration
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- FieldTypeRegistry (Phase 2 — Sync)
- tsvector column on `fields` or any search infrastructure
- Field validation logic (Core UX)
- Sync engine or adapter logic (Phase 2)

---

## Prompt 5: Tier 3 Schema — `records` (Hash-Partitioned), `cross_links`, `cross_link_index`

**Depends on:** 4
**Load context:** data-model.md lines 45–48 (records, cross_links, cross_link_index), database-scaling.md lines 175–185 (Table Partitioning), database-scaling.md lines 189–198 (Tenant-Aware Resource Protection)
**Target files:** `packages/shared/db/schema/records.ts`, `packages/shared/db/schema/cross-links.ts`, `packages/shared/db/schema/cross-link-index.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0004_create_records_crosslinks.ts`
**Git:** Commit with message `feat(db): create records (hash-partitioned), cross_links, cross_link_index [Phase 1B, Prompt 5]`

### Schema Snapshot

```
records: tenant_id (FK → tenants.id, PARTITION KEY), id (UUIDv7), table_id (FK → tables.id), canonical_data (JSONB DEFAULT '{}'), sync_metadata (JSONB nullable), search_vector (tsvector nullable), deleted_at (TIMESTAMPTZ nullable), created_by (FK → users.id nullable), updated_by (FK → users.id nullable), created_at, updated_at
  Composite PK: (tenant_id, id)
  PARTITION BY HASH (tenant_id) — 16 partitions
  Indexes (per partition): (tenant_id, table_id, deleted_at), (tenant_id, id)
  Note: search_vector GIN index deferred to Core UX

cross_links: id (UUIDv7 PK), tenant_id (FK → tenants.id), name (VARCHAR), source_table_id (FK → tables.id), source_field_id (FK → fields.id), target_table_id (FK → tables.id), target_display_field_id (FK → fields.id), relationship_type (VARCHAR: many_to_one|one_to_many), reverse_field_id (nullable FK → fields.id), link_scope_filter (JSONB nullable), card_fields (JSONB DEFAULT '[]'), max_links_per_record (INTEGER DEFAULT 50), max_depth (INTEGER DEFAULT 3), environment (VARCHAR DEFAULT 'live'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id), (source_table_id), (target_table_id)

cross_link_index: tenant_id (FK → tenants.id), cross_link_id (FK → cross_links.id ON DELETE CASCADE), source_record_id (UUID), source_table_id (FK → tables.id), target_record_id (UUID), created_at
  Composite PK: (tenant_id, cross_link_id, source_record_id, target_record_id)
  Indexes: (tenant_id, target_record_id, cross_link_id), (tenant_id, source_record_id, cross_link_id)
```

### Task

Create the core data storage tables. The `records` table is the most critical table in the system — it stores ALL record data across ALL platforms via the canonical JSONB pattern.

**1. `records` table with hash partitioning:**

- Composite primary key: `(tenant_id, id)`. This is NOT the standard single-column PK pattern — the partition key must be part of the PK for hash partitioning.
- `PARTITION BY HASH (tenant_id)` with 16 partitions named `records_p0` through `records_p15`.
- `canonical_data` JSONB stores all field values keyed by `fields.id` (UUID keys, not field names).
- `sync_metadata` JSONB stores platform-specific sync state.
- `search_vector` tsvector column declared but NOT populated — the logic for `buildSearchVector()` and `extractSearchableText()` ships in Core UX. The column exists now to avoid an `ALTER TABLE` on a partitioned table later.
- `deleted_at` for soft deletes (records are never hard-deleted in the application — only via retention policy).
- **The migration for `records` must use raw SQL** to create the partitioned table and its 16 child partitions. Drizzle ORM does not natively support `PARTITION BY HASH` syntax. The Drizzle schema file defines the table structure for type inference; the migration handles the actual DDL.
- Create indexes per partition: `(tenant_id, table_id)` filtered on `deleted_at IS NULL` is the primary query path.

**2. `cross_links`:** Cross-link definitions. Tenant-scoped. `environment` column defaults to `'live'`. `card_fields` JSONB stores ordered field IDs for chip/preview display.

**3. `cross_link_index`:** Denormalized record-to-record link pairs for fast reverse lookups. Cascade delete from `cross_links`. Both directional indexes needed: source→target and target→source.

**4. Establish Drizzle relations.**

**5. Update barrel export.**

**6. Generate migration.** The `records` migration portion requires custom SQL for partitioning. Other tables use standard Drizzle migration output.

### Acceptance Criteria

- [ ] `records` table is hash-partitioned by `tenant_id` into 16 partitions
- [ ] Composite PK `(tenant_id, id)` is correctly defined
- [ ] `search_vector` tsvector column exists on `records` (declared, not populated)
- [ ] `canonical_data` defaults to `'{}'::jsonb`
- [ ] `cross_links.environment` defaults to `'live'`
- [ ] `cross_link_index` has both directional indexes
- [ ] `cross_link_index` cascades on `cross_links` delete
- [ ] Migration with raw SQL for partitioning applies cleanly
- [ ] TypeScript types correctly infer the composite PK structure
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- `search_vector` population logic (`buildSearchVector`, `extractSearchableText`) — Core UX
- GIN index on `search_vector` — Core UX
- JSONB expression indexes — Core UX optimization
- Cross-link resolution queries or UI — Core UX
- Rollups, formulas, or computed fields across links (post-MVP)

---

## Integration Checkpoint 1 (after Prompts 1–5)

**Task:** Verify all database infrastructure and core schema tables (Tiers 0–3) integrate correctly.

Run:

1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (if any tests exist from Phase 1A)
4. Apply all migrations in sequence against a fresh database: `pnpm turbo db:migrate`
5. Verify all 16 `records` partitions exist: connect to PostgreSQL and run `SELECT tablename FROM pg_tables WHERE tablename LIKE 'records_p%' ORDER BY tablename;` — should return `records_p0` through `records_p15`
6. Verify PgBouncer connectivity: connect through port 6432 and run a simple query
7. Verify the barrel export (`packages/shared/db/schema/index.ts`) re-exports all tables created so far

**Git:** Commit with message `chore(verify): integration checkpoint 1 — core schema tiers 0–3 [Phase 1B, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 6.

---

## Prompt 6: Tier 4 Schema — Views, Preferences, Record View Configs, Templates, Sections

**Depends on:** 5
**Load context:** data-model.md lines 49–57 (views, user_view_preferences, record_view_configs, record_templates), data-model.md lines 122 (sections)
**Target files:** `packages/shared/db/schema/views.ts`, `packages/shared/db/schema/user-view-preferences.ts`, `packages/shared/db/schema/record-view-configs.ts`, `packages/shared/db/schema/record-templates.ts`, `packages/shared/db/schema/sections.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0005_create_views_templates.ts`
**Git:** Commit with message `feat(db): create views, preferences, record view configs, templates, sections [Phase 1B, Prompt 6]`

### Schema Snapshot

```
views: id (UUIDv7 PK), tenant_id (FK → tenants.id), table_id (FK → tables.id ON DELETE CASCADE), name (VARCHAR NOT NULL), view_type (VARCHAR DEFAULT 'grid': grid|card — MVP; kanban|list|gantt|calendar|gallery|smart_doc — reserved), config (JSONB DEFAULT '{}'), permissions (JSONB DEFAULT '{}'), is_shared (BOOLEAN DEFAULT true), publish_state (VARCHAR DEFAULT 'live': live|draft), environment (VARCHAR DEFAULT 'live'), position (INTEGER DEFAULT 0), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, table_id, environment), (table_id, position)

user_view_preferences: id (UUIDv7 PK), view_id (FK → views.id ON DELETE CASCADE), user_id (FK → users.id), overrides (JSONB DEFAULT '{}'), updated_at
  Indexes: (view_id, user_id) UNIQUE

record_view_configs: id (UUIDv7 PK), tenant_id (FK → tenants.id), table_id (FK → tables.id ON DELETE CASCADE), name (VARCHAR NOT NULL), layout (JSONB DEFAULT '{}'), is_default (BOOLEAN DEFAULT false), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, table_id)
  Unique partial: (tenant_id, table_id) WHERE is_default = true

record_templates: id (UUIDv7 PK), tenant_id (FK → tenants.id), table_id (FK → tables.id ON DELETE CASCADE), name (VARCHAR 255 NOT NULL), description (TEXT nullable), icon (VARCHAR 50 nullable), color (VARCHAR 20 nullable), canonical_data (JSONB DEFAULT '{}'), linked_records (JSONB nullable), is_default (BOOLEAN DEFAULT false), available_in (VARCHAR[] DEFAULT '{all}'), section_id (nullable FK → sections.id ON DELETE SET NULL), sort_order (INTEGER DEFAULT 0), created_by (FK → users.id), publish_state (VARCHAR DEFAULT 'live': live|draft), environment (VARCHAR DEFAULT 'live'), created_at, updated_at
  Indexes: (tenant_id, table_id, environment), (tenant_id, table_id, publish_state)
  Unique partial: (tenant_id, table_id) WHERE is_default = true

sections: id (UUIDv7 PK), tenant_id (FK → tenants.id), user_id (nullable FK → users.id — null for shared), context (VARCHAR NOT NULL: view_switcher|automations|cross_links|documents|sidebar_tables), context_parent_id (UUID nullable), name (VARCHAR NOT NULL), sort_order (INTEGER DEFAULT 0), collapsed (BOOLEAN DEFAULT false), created_by (FK → users.id), created_at
  Indexes: (tenant_id, context, context_parent_id)
```

### Task

Create the view and display configuration tables. These define HOW data is presented, not the data itself.

**1. `views`:** Table View configurations. `view_type` MVP values: `grid`, `card`. Reserve the post-MVP types in comments but do not validate against them — the column is VARCHAR, not ENUM. `config` JSONB holds filters, sorts, field visibility, frozen columns, grouping. `permissions` JSONB holds `ViewPermissions` (Layer 2 overrides). **`environment` defaults to `'live'`.** `publish_state` is separate from `environment` — governs draft/live authoring workflow.

**2. `user_view_preferences`:** Per-user overrides on shared views. Cascade delete from parent view. Unique on `(view_id, user_id)`.

**3. `record_view_configs`:** Saved Record View layouts. The shared layout primitive under Record Views, Portals, and Forms. Unique partial index enforces at most one default config per table per tenant.

**4. `record_templates`:** Pre-filled record creation templates. `canonical_data` uses same JSONB shape as `records.canonical_data`. `available_in` is a VARCHAR array controlling contexts. `section_id` nullable FK to `sections` (ON DELETE SET NULL). Has both `publish_state` AND `environment` columns — both default to `'live'`. Unique partial index enforces at most one default template per table per tenant.

**5. `sections`:** Universal list organizer for sidebar groupings. `context` identifies what entity type the section organizes. `user_id` nullable — null means shared section, non-null means personal.

**6. Establish Drizzle relations, update barrel, generate migration.**

### Acceptance Criteria

- [ ] `views.environment` defaults to `'live'`
- [ ] `record_templates` has both `publish_state` and `environment` columns, both defaulting to `'live'`
- [ ] Unique partial index on `record_view_configs` for `(tenant_id, table_id) WHERE is_default = true`
- [ ] Unique partial index on `record_templates` for `(tenant_id, table_id) WHERE is_default = true`
- [ ] `user_view_preferences` cascades on view delete
- [ ] `record_templates.section_id` sets null on section delete
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- View rendering logic (Core UX Phase 3A)
- Record View overlay UI (Core UX Phase 3A)
- Template picker UX (Core UX)
- Section drag-and-drop reordering (Core UX)

---

## Prompt 7: Tier 5A Schema — Portals and Forms

**Depends on:** 5 (needs `records` for FK), 6 (needs `record_view_configs`)
**Load context:** data-model.md lines 59–67 (portals, portal_access, portal_sessions, forms, form_submissions)
**Target files:** `packages/shared/db/schema/portals.ts`, `packages/shared/db/schema/portal-access.ts`, `packages/shared/db/schema/portal-sessions.ts`, `packages/shared/db/schema/forms.ts`, `packages/shared/db/schema/form-submissions.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0006_create_portals_forms.ts`
**Git:** Commit with message `feat(db): create portals, portal_access, portal_sessions, forms, form_submissions [Phase 1B, Prompt 7]`

### Schema Snapshot

```
portals: id (UUIDv7 PK), tenant_id (FK → tenants.id), table_id (FK → tables.id), record_view_config_id (FK → record_view_configs.id), name (VARCHAR NOT NULL), slug (VARCHAR UNIQUE NOT NULL), auth_type (VARCHAR: magic_link|password), status (VARCHAR DEFAULT 'draft': draft|published|archived), settings (JSONB DEFAULT '{}'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id), (slug) UNIQUE

portal_access: id (UUIDv7 PK), tenant_id (FK → tenants.id), portal_id (FK → portals.id ON DELETE CASCADE), record_id (UUID NOT NULL), email (VARCHAR NOT NULL), auth_hash (VARCHAR nullable — password auth), token (VARCHAR nullable — magic link), token_expires_at (TIMESTAMPTZ nullable), last_accessed_at (TIMESTAMPTZ nullable), created_at
  Indexes: (tenant_id, portal_id), (portal_id, record_id, email) UNIQUE

portal_sessions: id (UUIDv7 PK), auth_type (VARCHAR: quick|app), auth_id (UUID NOT NULL), portal_id (UUID NOT NULL), tenant_id (FK → tenants.id), created_at, expires_at (TIMESTAMPTZ NOT NULL), revoked_at (TIMESTAMPTZ nullable)
  Indexes: (auth_type, auth_id), (portal_id)

forms: id (UUIDv7 PK), tenant_id (FK → tenants.id), table_id (FK → tables.id), record_view_config_id (FK → record_view_configs.id), name (VARCHAR NOT NULL), slug (VARCHAR UNIQUE NOT NULL), status (VARCHAR DEFAULT 'draft': draft|published|archived), settings (JSONB DEFAULT '{}'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id), (slug) UNIQUE

form_submissions: id (UUIDv7 PK), form_id (FK → forms.id ON DELETE CASCADE), tenant_id (FK → tenants.id), record_id (UUID — the created record), submitted_at (TIMESTAMPTZ DEFAULT now()), ip_address (VARCHAR nullable), user_agent (VARCHAR nullable)
  Indexes: (tenant_id, form_id), (form_id, submitted_at)
```

### Task

Create the external-facing entity tables. Quick Portals and Quick Forms both share `record_view_configs` as their layout definition.

**1. `portals`:** Quick Portal definitions. `slug` is globally unique for URL routing. `settings` JSONB stores branding, editable_fields array, linked_record_display config. `auth_type` determines whether the portal uses magic links or email+password auth.

**2. `portal_access`:** Per-record access credentials. One row per client email per record per portal. Magic link tokens are single-use. `(portal_id, record_id, email)` is unique — prevents duplicate grants.

**3. `portal_sessions`:** Server-side session store. Polymorphic: `auth_type` = `'quick'` references `portal_access.id`, `auth_type` = `'app'` references `portal_clients.id` (post-MVP). Session ID stored in httpOnly cookie. 30-day expiry.

**4. `forms`:** Quick Form definitions. Same structure as portals but for record creation. `settings` JSONB stores success_message, redirect_url, turnstile_enabled, notification_emails, required_field_overrides.

**5. `form_submissions`:** Submission log for analytics. `record_id` references the record that was created. Cascade delete from parent form.

**6. Establish Drizzle relations, update barrel, generate migration.**

### Acceptance Criteria

- [ ] `portals.slug` has a unique index
- [ ] `forms.slug` has a unique index
- [ ] `(portal_id, record_id, email)` is unique on `portal_access`
- [ ] `portal_access` cascades on portal delete
- [ ] `form_submissions` cascades on form delete
- [ ] `portal_sessions` uses VARCHAR `auth_type` (not FK — polymorphic reference)
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Portal auth logic (magic link generation, password hashing) — Core UX Phase 3E
- Form submission pipeline (Turnstile integration) — Core UX Phase 3E
- Portal UI or form builder UI — Core UX
- App Portals or App Forms (post-MVP)

---

## Prompt 8: Tier 5B Schema — Sync Tables

**Depends on:** 4 (needs `base_connections`, `tables`, `fields`)
**Load context:** data-model.md lines 70–76 (synced_field_mappings, sync_conflicts, sync_failures, sync_schema_changes)
**Target files:** `packages/shared/db/schema/synced-field-mappings.ts`, `packages/shared/db/schema/sync-conflicts.ts`, `packages/shared/db/schema/sync-failures.ts`, `packages/shared/db/schema/sync-schema-changes.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0007_create_sync_tables.ts`
**Git:** Commit with message `feat(db): create sync tracking tables [Phase 1B, Prompt 8]`

### Schema Snapshot

```
synced_field_mappings: id (UUIDv7 PK), tenant_id (FK → tenants.id), base_connection_id (FK → base_connections.id ON DELETE CASCADE), table_id (FK → tables.id), field_id (FK → fields.id), external_field_id (VARCHAR NOT NULL), external_field_type (VARCHAR NOT NULL), status (VARCHAR DEFAULT 'active': active|type_mismatch|disconnected), created_at
  Indexes: (tenant_id, base_connection_id), (field_id)

sync_conflicts: id (UUIDv7 PK), tenant_id (FK → tenants.id), record_id (UUID NOT NULL), field_id (FK → fields.id), local_value (JSONB), remote_value (JSONB), base_value (JSONB), platform (VARCHAR NOT NULL), status (VARCHAR DEFAULT 'pending': pending|resolved), resolved_by (nullable FK → users.id), created_at, resolved_at (TIMESTAMPTZ nullable)
  Indexes: (tenant_id, status), (record_id)

sync_failures: id (UUIDv7 PK), tenant_id (FK → tenants.id), base_connection_id (FK → base_connections.id ON DELETE CASCADE), record_id (UUID nullable), direction (VARCHAR: inbound|outbound), error_code (VARCHAR NOT NULL: validation|schema_mismatch|payload_too_large|platform_rejected|unknown), error_message (TEXT), platform_record_id (VARCHAR nullable), payload (JSONB), retry_count (INTEGER DEFAULT 0), status (VARCHAR DEFAULT 'pending': pending|retrying|resolved|skipped|requires_manual_resolution), created_at, resolved_at (TIMESTAMPTZ nullable), resolved_by (nullable FK → users.id)
  Indexes: (tenant_id, base_connection_id, status), (tenant_id, status)

sync_schema_changes: id (UUIDv7 PK), tenant_id (FK → tenants.id), base_connection_id (FK → base_connections.id ON DELETE CASCADE), change_type (VARCHAR NOT NULL: field_type_changed|field_deleted|field_added|field_renamed), field_id (UUID nullable), platform_field_id (VARCHAR NOT NULL), old_schema (JSONB), new_schema (JSONB), impact (JSONB DEFAULT '{}'), status (VARCHAR DEFAULT 'pending': pending|accepted|rejected), created_at, resolved_at (TIMESTAMPTZ nullable), resolved_by (nullable FK → users.id)
  Indexes: (tenant_id, base_connection_id, status)
```

### Task

Create the sync tracking tables. These track the per-field mapping status, conflicts requiring resolution, per-record failures, and schema changes detected from external platforms.

**1. `synced_field_mappings`:** Per-field sync mapping between EveryStack fields and external platform fields. `status` tracks whether the mapping is active, has a type mismatch, or has been disconnected. Cascade delete from `base_connections`.

**2. `sync_conflicts`:** Field-level conflict records for manual resolution. Three-way values: `local_value`, `remote_value`, `base_value`. 90-day retention policy for resolved conflicts (enforced by background job, not DB constraint).

**3. `sync_failures`:** Per-record sync error tracking. `retry_count` max 3 (enforced in application). `payload` stores the data that failed for retry. `record_id` is nullable — some failures are record-independent. Cascade delete from `base_connections`.

**4. `sync_schema_changes`:** Platform schema change detection. `impact` JSONB stores downstream analysis (`{ formulaCount, automationCount, portalFieldCount, crossLinkCount }`). Cascade delete from `base_connections`.

**5. Establish Drizzle relations, update barrel, generate migration.**

### Acceptance Criteria

- [ ] All four sync tables compile with correct types and constraints
- [ ] All three sync operational tables cascade on `base_connections` delete
- [ ] `sync_conflicts` has index on `(tenant_id, status)` for dashboard queries
- [ ] `sync_failures.retry_count` defaults to 0
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Sync engine logic (Phase 2)
- Conflict resolution UI (Core UX)
- Retry logic or BullMQ job definitions (Phase 2)

---

## Prompt 9: Tier 6A Schema — Communications

**Depends on:** 3 (needs `users` for author FKs)
**Load context:** data-model.md lines 77–85 (threads, thread_participants, thread_messages, user_saved_messages)
**Target files:** `packages/shared/db/schema/threads.ts`, `packages/shared/db/schema/thread-participants.ts`, `packages/shared/db/schema/thread-messages.ts`, `packages/shared/db/schema/user-saved-messages.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0008_create_communications.ts`
**Git:** Commit with message `feat(db): create threads, messages, saved messages schema [Phase 1B, Prompt 9]`

### Schema Snapshot

```
threads: id (UUIDv7 PK), tenant_id (FK → tenants.id), scope_type (VARCHAR NOT NULL: record|dm|group_dm), scope_id (UUID NOT NULL), visibility (VARCHAR DEFAULT 'internal': internal|client_visible), name (VARCHAR nullable — group_dm display name), created_by (FK → users.id), created_at
  Indexes: (tenant_id, scope_type, scope_id), (tenant_id, scope_type)

thread_participants: id (UUIDv7 PK), thread_id (FK → threads.id ON DELETE CASCADE), user_id (FK → users.id), joined_at (TIMESTAMPTZ DEFAULT now()), last_read_at (TIMESTAMPTZ nullable), muted (BOOLEAN DEFAULT false)
  Indexes: (thread_id, user_id) UNIQUE, (user_id)

thread_messages: id (UUIDv7 PK), thread_id (FK → threads.id ON DELETE CASCADE), author_id (UUID nullable — null for system messages), author_type (VARCHAR DEFAULT 'user': user|portal_client|system), message_type (VARCHAR DEFAULT 'message': message|system), content (JSONB NOT NULL — TipTap JSON), parent_message_id (nullable FK → thread_messages.id — threaded replies), mentions (JSONB DEFAULT '[]'), attachments (JSONB DEFAULT '[]'), reactions (JSONB DEFAULT '{}'), pinned_at (TIMESTAMPTZ nullable), pinned_by (UUID nullable), edited_at (TIMESTAMPTZ nullable), deleted_at (TIMESTAMPTZ nullable — soft delete), created_at
  Indexes: (thread_id, created_at), (thread_id, parent_message_id)

user_saved_messages: id (UUIDv7 PK), user_id (FK → users.id), message_id (FK → thread_messages.id ON DELETE CASCADE), tenant_id (FK → tenants.id), note (TEXT nullable — personal annotation), saved_at (TIMESTAMPTZ DEFAULT now())
  Indexes: (user_id, saved_at DESC), (user_id, message_id) UNIQUE
```

### Task

Create the communications tables. These power Record Threads (record-scoped comments), DMs, and group DMs.

**1. `threads`:** Conversation containers. `scope_type` determines context: `record` for Record Threads, `dm`/`group_dm` for Quick Panel Chat. `scope_id` references the scoped entity (record ID for record threads, or a generated thread ID for DMs). `visibility` controls portal client access — default `internal`. `name` is nullable, used only for group DMs.

**2. `thread_participants`:** Thread membership and unread tracking. `last_read_at` compared to message `created_at` to compute unread count. Cascade delete from thread. Unique on `(thread_id, user_id)`.

**3. `thread_messages`:** Messages within threads. `content` is TipTap JSON (not plain text). `author_type` is VARCHAR to allow `portal_client` authors for client-visible portal threads. `parent_message_id` self-FK enables threaded replies. Reactions stored as `{emoji: [user_ids]}` JSONB. Soft delete via `deleted_at`.

**4. `user_saved_messages`:** Private message bookmarks. Cascade delete from message. Unique on `(user_id, message_id)` — prevent duplicate saves.

**5. Establish Drizzle relations (including self-FK on `thread_messages.parent_message_id`), update barrel, generate migration.**

### Acceptance Criteria

- [ ] `threads.scope_type` supports `record`, `dm`, `group_dm` values
- [ ] `thread_participants` has unique constraint on `(thread_id, user_id)`
- [ ] `thread_messages` has self-referential FK for `parent_message_id`
- [ ] `thread_messages` cascades on thread delete
- [ ] `user_saved_messages` cascades on message delete
- [ ] `user_saved_messages` has unique constraint on `(user_id, message_id)`
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- TipTap editor or message rendering (Core UX Phase 3C)
- Real-time message delivery (Phase 1G + Core UX)
- Notification system (Core UX)
- Client-visible thread logic (Core UX portals)

---

## Integration Checkpoint 2 (after Prompts 6–9)

**Task:** Verify Tier 4–6A schema tables integrate correctly with the core schema.

Run:

1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. Apply all migrations in sequence against a fresh database: `pnpm turbo db:migrate`
5. Verify all FK relationships are valid: connect to PostgreSQL and check that all foreign key constraints exist on the expected tables
6. Verify the barrel export re-exports all tables created through Prompt 9
7. Count total tables created so far — should be approximately 30 (across Tiers 0–6A)

**Git:** Commit with message `chore(verify): integration checkpoint 2 — schema tiers 4–6A [Phase 1B, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 10.

---

## Prompt 10: Tier 6B Schema — Personal and Notifications

**Depends on:** 3 (needs `users`, `tenants` for FKs)
**Load context:** data-model.md lines 86–94 (user_tasks, user_events, notifications, user_notification_preferences)
**Target files:** `packages/shared/db/schema/user-tasks.ts`, `packages/shared/db/schema/user-events.ts`, `packages/shared/db/schema/notifications.ts`, `packages/shared/db/schema/user-notification-preferences.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0009_create_personal_notifications.ts`
**Git:** Commit with message `feat(db): create user_tasks, user_events, notifications, preferences [Phase 1B, Prompt 10]`

### Schema Snapshot

```
user_tasks: id (UUIDv7 PK), user_id (FK → users.id), title (VARCHAR NOT NULL), completed (BOOLEAN DEFAULT false), due_date (DATE nullable), sort_order (INTEGER DEFAULT 0), parent_task_id (nullable self-FK → user_tasks.id ON DELETE CASCADE), linked_record_id (UUID nullable), linked_tenant_id (UUID nullable)
  Indexes: (user_id, completed), (user_id, due_date), (parent_task_id)

user_events: id (UUIDv7 PK), user_id (FK → users.id), title (VARCHAR NOT NULL), start_time (TIMESTAMPTZ NOT NULL), end_time (TIMESTAMPTZ NOT NULL), all_day (BOOLEAN DEFAULT false), location (VARCHAR nullable), notes (TEXT nullable), color (VARCHAR nullable), show_as (VARCHAR DEFAULT 'busy': busy|free), recurrence_rule (JSONB nullable), reminder_minutes (INTEGER[] nullable), created_at
  Indexes: (user_id, start_time, end_time), (user_id, all_day)

notifications: id (UUIDv7 PK), user_id (FK → users.id), tenant_id (FK → tenants.id), type (VARCHAR NOT NULL), source_thread_id (UUID nullable), source_message_id (UUID nullable), read (BOOLEAN DEFAULT false), created_at
  Indexes: (user_id, read, created_at DESC), (user_id, tenant_id)

user_notification_preferences: id (UUIDv7 PK), user_id (FK → users.id), tenant_id (FK → tenants.id), preferences (JSONB DEFAULT '{}'), updated_at
  Indexes: (user_id, tenant_id) UNIQUE
```

### Task

Create the personal productivity and notification tables for Quick Panel features (Tasks, Calendar, Notifications).

**1. `user_tasks`:** Private personal tasks with subtask support. `parent_task_id` self-FK enables nested tasks — cascade delete children when parent deleted. `linked_record_id` and `linked_tenant_id` allow optional association to a record (for checklist items that surface in Tasks panel).

**2. `user_events`:** Private personal calendar events. `recurrence_rule` JSONB stores RFC 5545-style recurrence patterns. `reminder_minutes` is an integer array (e.g., `[15, 60]` for 15-min and 1-hour reminders). `show_as` for busy/free display.

**3. `notifications`:** Notification feed. `type` is VARCHAR for extensibility. `source_thread_id` and `source_message_id` are nullable UUIDs (not strict FKs — notifications may reference entities that get deleted). Indexed for the primary query: unread notifications for a user, sorted by recency.

**4. `user_notification_preferences`:** Per-user, per-tenant notification settings. `preferences` JSONB stores channel and type preferences. Unique on `(user_id, tenant_id)`.

**5. Establish Drizzle relations (including self-FK on `user_tasks`), update barrel, generate migration.**

### Acceptance Criteria

- [ ] `user_tasks` has self-referential FK with cascade delete for subtasks
- [ ] `user_events.reminder_minutes` is an integer array type
- [ ] `notifications` index on `(user_id, read, created_at DESC)` exists for feed queries
- [ ] `user_notification_preferences` unique on `(user_id, tenant_id)`
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Task or calendar UI (Core UX — My Office)
- Push notification delivery (Core UX)
- Notification routing logic (Core UX)

---

## Prompt 11: Tier 6C Schema — Documents, Automations, Webhooks

**Depends on:** 4 (needs `tables`), 5 (needs `records` for generated doc references)
**Load context:** data-model.md lines 96–110 (document_templates, generated_documents, automations, automation_runs, webhook_endpoints, webhook_delivery_log)
**Target files:** `packages/shared/db/schema/document-templates.ts`, `packages/shared/db/schema/generated-documents.ts`, `packages/shared/db/schema/automations.ts`, `packages/shared/db/schema/automation-runs.ts`, `packages/shared/db/schema/webhook-endpoints.ts`, `packages/shared/db/schema/webhook-delivery-log.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0010_create_docs_automations_webhooks.ts`
**Git:** Commit with message `feat(db): create document_templates, automations, webhook schema [Phase 1B, Prompt 11]`

### Schema Snapshot

```
document_templates: id (UUIDv7 PK), tenant_id (FK → tenants.id), table_id (FK → tables.id ON DELETE CASCADE), name (VARCHAR NOT NULL), content (JSONB DEFAULT '{}' — TipTap JSON with merge tags), settings (JSONB DEFAULT '{}' — page_size, orientation, margins, header, footer), version (INTEGER DEFAULT 1), environment (VARCHAR DEFAULT 'live'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, table_id)

generated_documents: id (UUIDv7 PK), tenant_id (FK → tenants.id), template_id (FK → document_templates.id), source_record_id (UUID NOT NULL), file_url (VARCHAR NOT NULL — S3/R2 path), file_type (VARCHAR DEFAULT 'pdf'), generated_by (FK → users.id nullable), generated_at (TIMESTAMPTZ DEFAULT now()), automation_run_id (UUID nullable), ai_drafted (BOOLEAN DEFAULT false)
  Indexes: (tenant_id, template_id), (tenant_id, source_record_id)

automations: id (UUIDv7 PK), tenant_id (FK → tenants.id), workspace_id (FK → workspaces.id ON DELETE CASCADE), name (VARCHAR NOT NULL), trigger (JSONB NOT NULL — type, config, table_id), steps (JSONB[] NOT NULL — ordered action list), status (VARCHAR DEFAULT 'draft': active|paused|draft), run_count (INTEGER DEFAULT 0), last_run_at (TIMESTAMPTZ nullable), error_count (INTEGER DEFAULT 0), environment (VARCHAR DEFAULT 'live'), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, workspace_id, environment), (tenant_id, status)

automation_runs: id (UUIDv7 PK), automation_id (FK → automations.id ON DELETE CASCADE), trigger_record_id (UUID nullable), status (VARCHAR DEFAULT 'running': running|completed|failed), started_at (TIMESTAMPTZ DEFAULT now()), completed_at (TIMESTAMPTZ nullable), error_message (TEXT nullable), step_log (JSONB DEFAULT '[]')
  Indexes: (automation_id, started_at DESC)

webhook_endpoints: id (UUIDv7 PK), tenant_id (FK → tenants.id), workspace_id (FK → workspaces.id ON DELETE CASCADE), url (VARCHAR 2048 NOT NULL), signing_secret (VARCHAR 64 NOT NULL), subscribed_events (TEXT[] NOT NULL), description (TEXT nullable), status (VARCHAR DEFAULT 'active': active|disabled), consecutive_failures (INTEGER DEFAULT 0), created_by (FK → users.id), created_at, updated_at
  Indexes: (tenant_id, workspace_id), (tenant_id, status)

webhook_delivery_log: id (UUIDv7 PK), tenant_id (FK → tenants.id), webhook_endpoint_id (FK → webhook_endpoints.id ON DELETE CASCADE), event (VARCHAR 64 NOT NULL), delivery_id (UUID NOT NULL), payload (JSONB NOT NULL), status_code (INTEGER nullable), duration_ms (INTEGER nullable), status (VARCHAR DEFAULT 'pending': pending|success|failed), retry_count (INTEGER DEFAULT 0), error_message (TEXT nullable), created_at
  Indexes: (tenant_id, webhook_endpoint_id, created_at DESC), (tenant_id, status)
```

### Task

Create the document generation, automation, and webhook tables.

**1. `document_templates`:** TipTap-based merge-tag templates. `content` JSONB stores TipTap JSON with custom merge tag nodes. `settings` JSONB stores PDF page configuration. `version` integer for template versioning. **`environment` defaults to `'live'`.**

**2. `generated_documents`:** Output document tracking. `file_url` stores the S3/R2 path. `automation_run_id` is nullable — null for manually generated docs, UUID when generated by an automation step. `ai_drafted` tracks whether AI assisted in content generation.

**3. `automations`:** Linear trigger → action flow definitions. MVP: no branching, no visual canvas. `trigger` JSONB stores trigger type and config. `steps` is a JSONB array of ordered actions. `workspace_id` denormalized for sidebar queries. **`environment` defaults to `'live'`.**

**4. `automation_runs`:** Execution history. `step_log` JSONB records per-step outcomes. Cascade delete from automation.

**5. `webhook_endpoints`:** Registered webhook endpoints for workspace-level event delivery. `signing_secret` for HMAC signature verification. `consecutive_failures` — auto-disabled at 10 (enforced in application). Cascade delete from workspace.

**6. `webhook_delivery_log`:** Per-delivery tracking. `delivery_id` is a unique UUID per delivery attempt. `retry_count` max 5 (enforced in application). 30-day retention. Cascade delete from endpoint.

**7. Establish Drizzle relations, update barrel, generate migration.**

### Acceptance Criteria

- [ ] `document_templates.environment` defaults to `'live'`
- [ ] `automations.environment` defaults to `'live'`
- [ ] `automations.steps` is a JSONB array type
- [ ] `webhook_endpoints.subscribed_events` is a TEXT array
- [ ] `automation_runs` cascades on automation delete
- [ ] `webhook_delivery_log` cascades on endpoint delete
- [ ] `webhook_endpoints` cascades on workspace delete
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Automation trigger evaluation or action execution (Phase 4)
- Document merge-tag resolution or PDF generation (Core UX Phase 3D)
- Webhook delivery pipeline or retry logic (Phase 4)
- Visual automation canvas (post-MVP)

---

## Prompt 12: Tier 7 Schema — AI, Audit, API, Platform Utilities

**Depends on:** 3 (needs `users`, `tenants` for FKs)
**Load context:** data-model.md lines 111–130 (AI tables, platform tables, audit_log, api_keys, api_request_log, feature tables)
**Target files:** `packages/shared/db/schema/ai-usage-log.ts`, `packages/shared/db/schema/ai-credit-ledger.ts`, `packages/shared/db/schema/audit-log.ts`, `packages/shared/db/schema/api-keys.ts`, `packages/shared/db/schema/api-request-log.ts`, `packages/shared/db/schema/user-recent-items.ts`, `packages/shared/db/schema/command-bar-sessions.ts`, `packages/shared/db/schema/feature-suggestions.ts`, `packages/shared/db/schema/feature-votes.ts`, `packages/shared/db/schema/index.ts` (update barrel)
**Migration required:** Yes — `packages/shared/db/migrations/0011_create_ai_audit_api_platform.ts`
**Git:** Commit with message `feat(db): create AI, audit, API, platform utility tables [Phase 1B, Prompt 12]`

### Schema Snapshot

```
ai_usage_log: id (UUIDv7 PK), tenant_id (FK → tenants.id), user_id (FK → users.id), feature (VARCHAR 64 NOT NULL), model (VARCHAR 32), input_tokens (INTEGER), output_tokens (INTEGER), cached_input (INTEGER DEFAULT 0), cost_usd (NUMERIC(10,6)), credits_charged (NUMERIC(10,2)), status (VARCHAR: success|error|timeout|rate_limited), duration_ms (INTEGER), metadata (JSONB DEFAULT '{}'), created_at
  Time-partitioned by created_at (monthly)
  Indexes: (tenant_id, created_at DESC), (tenant_id, feature)

ai_credit_ledger: id (UUIDv7 PK), tenant_id (FK → tenants.id), period_start (DATE NOT NULL), period_end (DATE NOT NULL), credits_total (INTEGER NOT NULL), credits_used (NUMERIC(10,2) DEFAULT 0), updated_at
  Indexes: (tenant_id, period_start) UNIQUE
  Note: credits_remaining is a GENERATED column = credits_total - credits_used

audit_log: id (UUIDv7 PK), tenant_id (FK → tenants.id), actor_type (VARCHAR NOT NULL: user|sync|automation|portal_client|system|agent|api_key), actor_id (UUID NOT NULL), actor_label (VARCHAR 255 nullable — human-readable context for API key mutations), action (VARCHAR NOT NULL), entity_type (VARCHAR NOT NULL), entity_id (UUID NOT NULL), details (JSONB DEFAULT '{}'), trace_id (VARCHAR nullable), ip_address (VARCHAR nullable), created_at
  Time-partitioned by created_at (monthly)
  Indexes: (tenant_id, created_at DESC), (tenant_id, entity_type, entity_id), (tenant_id, actor_type, actor_id)

api_keys: id (UUIDv7 PK), tenant_id (FK → tenants.id), name (VARCHAR 255 NOT NULL), key_hash (VARCHAR 64 NOT NULL — SHA-256), key_prefix (VARCHAR 16 NOT NULL — first 16 chars for display), scopes (TEXT[] NOT NULL), rate_limit_tier (VARCHAR 32 DEFAULT 'standard': basic|standard|high|enterprise), last_used_at (TIMESTAMPTZ nullable), expires_at (TIMESTAMPTZ nullable — null = never), status (VARCHAR DEFAULT 'active': active|revoked), created_by (FK → users.id), revoked_at (TIMESTAMPTZ nullable), created_at
  Indexes: (tenant_id), (key_hash) UNIQUE

api_request_log: id (UUIDv7 PK), tenant_id (FK → tenants.id), api_key_id (FK → api_keys.id), method (VARCHAR 8 NOT NULL), path (VARCHAR 512 NOT NULL), status_code (INTEGER NOT NULL), duration_ms (INTEGER), request_size (INTEGER), response_size (INTEGER), created_at
  Time-partitioned by created_at (monthly), 30-day retention
  Indexes: (tenant_id, api_key_id, created_at DESC)

user_recent_items: id (UUIDv7 PK), user_id (FK → users.id), item_type (VARCHAR NOT NULL), item_id (UUID NOT NULL), tenant_id (FK → tenants.id), accessed_at (TIMESTAMPTZ DEFAULT now())
  Indexes: (user_id, tenant_id, accessed_at DESC), (user_id, item_type, item_id) UNIQUE

command_bar_sessions: id (UUIDv7 PK), user_id (FK → users.id), tenant_id (FK → tenants.id), context (JSONB DEFAULT '{}'), messages (JSONB DEFAULT '[]'), result_set (JSONB DEFAULT '{}'), created_at
  Indexes: (user_id, tenant_id, created_at DESC)

feature_suggestions: id (UUIDv7 PK), user_id (FK → users.id), tenant_id (FK → tenants.id), title (VARCHAR NOT NULL), description (TEXT), category (VARCHAR), user_priority (VARCHAR), context (JSONB DEFAULT '{}'), status (VARCHAR DEFAULT 'open'), vote_count (INTEGER DEFAULT 0), created_at
  Indexes: (tenant_id, status), (tenant_id, vote_count DESC)

feature_votes: id (UUIDv7 PK), suggestion_id (FK → feature_suggestions.id ON DELETE CASCADE), user_id (FK → users.id), created_at
  Indexes: (suggestion_id, user_id) UNIQUE
```

### Task

Create the infrastructure and utility tables: AI metering, audit trail, API keys, and platform utilities.

**1. `ai_usage_log`:** All AI metering data. **Time-partitioned by `created_at` (monthly)**. The migration requires custom SQL for monthly partitioning — similar to `records` hash partitioning. Create initial partitions for the next 3 months. `credits_charged` uses NUMERIC(10,2) — zero credits on errors. `status` tracks the outcome.

**2. `ai_credit_ledger`:** Monthly credit budget per tenant. `credits_remaining` is a generated column: `credits_total - credits_used`. Unique on `(tenant_id, period_start)` — one ledger entry per tenant per month.

**3. `audit_log`:** Immutable audit trail. **Time-partitioned by `created_at` (monthly)**. Seven actor types in the `actor_type` column — MVP ships `user` and `system`, the others are created by later phases. `actor_label` is the human-readable context from `X-Actor-Label` header (API key mutations only). Create initial monthly partitions.

**4. `api_keys`:** Platform API authentication. `key_hash` is SHA-256 of the full key — the cleartext key is shown once at creation, never stored. `key_prefix` (first 16 chars, e.g., `esk_live_abc123...`) is for display/identification. `scopes` TEXT array supports 13 scope values. Unique index on `key_hash`.

**5. `api_request_log`:** API usage tracking. **Time-partitioned by `created_at` (monthly)**. 30-day retention. Create initial monthly partitions.

**6. `user_recent_items`:** Command Bar recents. Capped per user (enforced in application). Unique on `(user_id, item_type, item_id)` — upsert pattern updates `accessed_at`.

**7. `command_bar_sessions`:** AI search conversation sessions for Command Bar.

**8. `feature_suggestions` and `feature_votes`:** User feedback system. One vote per user per suggestion (unique constraint).

**9. Establish Drizzle relations, update barrel, generate migration.** Time-partitioned table migrations require custom SQL (similar approach to `records` hash partitioning).

### Acceptance Criteria

- [ ] `ai_usage_log` is time-partitioned by month with initial partitions created
- [ ] `audit_log` is time-partitioned by month with initial partitions created
- [ ] `api_request_log` is time-partitioned by month with initial partitions created
- [ ] `ai_credit_ledger` has unique index on `(tenant_id, period_start)`
- [ ] `api_keys.key_hash` has a unique index
- [ ] `feature_votes` has unique constraint on `(suggestion_id, user_id)`
- [ ] `user_recent_items` has unique constraint on `(user_id, item_type, item_id)`
- [ ] Seven actor types are documented as valid values for `audit_log.actor_type`
- [ ] 13 API key scopes are documented as valid values for `api_keys.scopes`
- [ ] Migration applies cleanly after prior migrations
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- `writeAuditLog()` helper function (Phase 1I)
- API key generation or authentication middleware (Phase 1I)
- Rate limiting logic (Phase 1I)
- AI metering flow or credit deduction logic (Phase 1H)
- Command Bar UI or search logic (Core UX)

---

## Integration Checkpoint 3 (after Prompts 10–12)

**Task:** Verify all remaining schema tables (Tiers 6B–7) integrate correctly.

Run:

1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. Apply all migrations in sequence against a fresh database: `pnpm turbo db:migrate`
5. Verify time-partitioned tables exist: check that `audit_log`, `ai_usage_log`, and `api_request_log` have monthly partitions
6. Count total tables created — should be approximately 50 MVP tables (plus partitions)
7. Verify the barrel export re-exports ALL tables

**Git:** Commit with message `chore(verify): integration checkpoint 3 — all schema tiers complete [Phase 1B, CP-3]`, then push branch to origin.

Fix any failures before proceeding to Prompt 13.

---

## Prompt 13: RLS Policies, Schema Barrel Finalization, Migration Validation

**Depends on:** 1–12 (all tables must exist)
**Load context:** compliance.md lines 198–217 (Row-Level Security Policies), database-scaling.md lines 202–210 (RLS at Scale)
**Target files:** `packages/shared/db/migrations/0012_enable_rls_policies.ts`, `packages/shared/db/schema/index.ts` (final barrel), `packages/shared/db/rls.ts` (RLS helper utilities)
**Migration required:** Yes — `packages/shared/db/migrations/0012_enable_rls_policies.ts`
**Git:** Commit with message `feat(db): enable RLS on all tenant-scoped tables, finalize schema barrel [Phase 1B, Prompt 13]`

### Schema Snapshot

N/A — no new tables. This prompt applies policies to existing tables.

### Task

Enable Row-Level Security on all tenant-scoped tables as defense-in-depth. Application-level `tenant_id` filtering is primary enforcement; RLS catches bugs.

**1. Create `packages/shared/db/rls.ts`:**

- Export a `setTenantContext(tenantId: string)` helper that executes `SET LOCAL app.current_tenant_id = '{tenantId}'` within the current transaction.
- This must be called at the start of every database transaction. Integrate with `getDbForTenant()` — when using the write client, the tenant context should be set automatically.
- Export the list of tenant-scoped tables as a constant for reference.

**2. Create migration `0012_enable_rls_policies.ts`:**
Apply RLS to ALL tenant-scoped tables. For each table with a `tenant_id` column:

```sql
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;
ALTER TABLE {table_name} FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON {table_name}
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Tables that get RLS (all tables with `tenant_id`):**
`tenant_memberships`, `boards`, `board_memberships`, `workspaces`, `workspace_memberships`, `base_connections`, `tables`, `fields`, `records` (applied to parent — inherited by partitions), `cross_links`, `cross_link_index`, `views`, `user_view_preferences` (via join — no direct tenant_id, but protected by view FK), `record_view_configs`, `record_templates`, `sections`, `portals`, `portal_access`, `portal_sessions`, `forms`, `form_submissions`, `synced_field_mappings`, `sync_conflicts`, `sync_failures`, `sync_schema_changes`, `threads`, `thread_participants` (via join — no direct tenant_id), `thread_messages` (via join), `user_saved_messages`, `user_tasks` (no tenant_id — user-scoped), `user_events` (no tenant_id — user-scoped), `notifications`, `user_notification_preferences`, `document_templates`, `generated_documents`, `automations`, `automation_runs` (via join), `webhook_endpoints`, `webhook_delivery_log`, `ai_usage_log` (applied to parent — inherited by partitions), `ai_credit_ledger`, `audit_log` (applied to parent — inherited by partitions), `api_keys`, `api_request_log` (applied to parent — inherited by partitions), `user_recent_items`, `command_bar_sessions`, `feature_suggestions`, `feature_votes` (via join)

**Tables WITHOUT RLS** (no `tenant_id` column):
`users`, `tenants`

Note: Tables that lack a direct `tenant_id` but reference a parent that has one (e.g., `thread_participants` → `threads.tenant_id`, `automation_runs` → `automations.tenant_id`) do NOT get direct RLS — they are protected by application-level joins that always go through tenant-scoped parent queries.

**3. Finalize `packages/shared/db/schema/index.ts`:**

- Ensure ALL 50 MVP tables are re-exported from the barrel file.
- Organize exports by tier with section comments.
- Export all inferred types (select and insert models).

**4. Run full migration sequence validation:**

- Drop and recreate the database.
- Run all migrations (0001 through 0012) from scratch.
- Verify zero errors, all tables exist, all RLS policies are active.
- Verify that a query WITHOUT `SET LOCAL app.current_tenant_id` on an RLS-protected table raises an error or returns no rows.

### Acceptance Criteria

- [ ] `setTenantContext()` helper is exported and sets `app.current_tenant_id`
- [ ] RLS is enabled and forced on all tables with direct `tenant_id` column
- [ ] RLS policy uses `current_setting('app.current_tenant_id')::uuid` comparison
- [ ] `users` and `tenants` tables do NOT have RLS
- [ ] RLS on `records` parent table is inherited by all 16 partitions
- [ ] RLS on `audit_log` parent table is inherited by monthly partitions
- [ ] Full migration sequence (0001–0012) applies cleanly from scratch
- [ ] Query on RLS-protected table without tenant context set returns empty or errors
- [ ] Schema barrel exports all 50 MVP tables with types
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- `testTenantIsolation()` helper (Phase 1E — testing infrastructure)
- Clerk integration for extracting tenant context (Phase 1C)
- Middleware that sets tenant context per request (Phase 1C)

---

## Integration Checkpoint 4 — Final (after Prompt 13)

**Task:** Final verification that the complete Phase 1B database layer is correct and production-ready.

Run:

1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. Drop and recreate database, then `pnpm turbo db:migrate` — all 12 migrations apply cleanly in sequence
5. Verify table count: `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';` — should be approximately 50 MVP tables + partition child tables
6. Verify RLS: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;` — should show all tenant-scoped tables
7. Verify `records` partitions: 16 hash partitions exist
8. Verify time partitions: `audit_log`, `ai_usage_log`, `api_request_log` have monthly child tables
9. Verify `getDbForTenant()` returns different clients for read vs write intents
10. Verify `generateUUIDv7()` produces valid, chronologically-sortable UUIDs
11. Verify `setTenantContext()` properly sets the session variable and RLS enforcement works
12. Full CI gate check: `pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test`

**Git:** Commit with message `chore(verify): final integration checkpoint — Phase 1B complete [Phase 1B, CP-4]`, push branch to origin, then open PR to main with title `Phase 1B — Database Schema, Connection Pooling, Tenant Routing`.

**PR Description:**

```
## Phase 1B — Database Schema, Connection Pooling, Tenant Routing

### Deliverables
- Drizzle ORM schemas for all 50 MVP tables across Tiers 0–7
- PgBouncer connection pooling (transaction mode)
- `getDbForTenant()` tenant-isolated read/write routing
- UUIDv7 primary key generation (no serial/auto-increment)
- Hash-partitioned `records` table (16 partitions by tenant_id)
- Time-partitioned `audit_log`, `ai_usage_log`, `api_request_log` (monthly)
- Row-Level Security policies on all tenant-scoped tables
- 12 sequential migration files
- Complete schema barrel export with TypeScript types

### Files Changed
- packages/shared/db/ (schema, client, config, migrations, utilities)
- docker-compose.yml (PgBouncer verification)
- .env.example (database connection vars)

### Testing
- TypeScript strict compilation: ✅
- ESLint: ✅
- All migrations apply cleanly from scratch: ✅
- RLS enforcement verified: ✅
- Partition structure verified: ✅

### CockroachDB Safeguards Active
- UUIDv7 for all PKs (no serial)
- No PostgreSQL-specific syntax in application queries
- Hash-partitioning compatible schemas
- No advisory locks
```

---

## Dependency Graph

```
Prompt 1 (DB Client + Config)
  ├─ Prompt 2 (Tier 0: users, tenants)
  │   └─ Prompt 3 (Tier 1: memberships, boards, workspaces)
  │       ├─ Prompt 4 (Tier 2: connections, tables, fields)
  │       │   ├─ Prompt 5 (Tier 3: records, cross-links)
  │       │   │   ├─ Prompt 6 (Tier 4: views, configs, templates)
  │       │   │   │   └─ Prompt 7 (Tier 5A: portals, forms)
  │       │   │   └─ Prompt 11 (Tier 6C: docs, automations, webhooks)
  │       │   └─ Prompt 8 (Tier 5B: sync tables)
  │       ├─ Prompt 9 (Tier 6A: communications)
  │       ├─ Prompt 10 (Tier 6B: personal, notifications)
  │       └─ Prompt 12 (Tier 7: AI, audit, API, utilities)
  └── Prompt 13 (RLS + migration validation) ← depends on ALL prior prompts

CP-1 after Prompts 1–5
CP-2 after Prompts 6–9
CP-3 after Prompts 10–12
CP-4 (Final) after Prompt 13
```

All dependencies flow downward — no cycles. The FK tier ordering ensures migrations can be applied sequentially without constraint violations.
