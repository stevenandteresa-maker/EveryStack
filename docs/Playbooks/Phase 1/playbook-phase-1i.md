# Phase 1I — Audit Log Helper, Platform API Auth Skeleton

## Phase Context

### What Has Been Built

**Phase 1A (Monorepo, CI Pipeline, Dev Environment):** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI (lint → typecheck → test). ESLint + Prettier config. tsconfig strict mode. `.env.example`.

**Phase 1B (Database Schema, Connection Pooling, Tenant Routing):** Drizzle schema for all 50 MVP tables (Tiers 0–7) including `audit_log`, `api_keys`, and `api_request_log`. PgBouncer connection pooling config. `getDbForTenant()` with read/write routing. RLS policies enforcing tenant isolation. UUIDv7 primary key generation. Initial migration files.

**Phase 1C (Authentication, Tenant Isolation, Workspace Roles):** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities. `PermissionDeniedError` shape.

**Phase 1D (Observability, Security Hardening):** Pino + `pino-http` structured logging. `traceId` via AsyncLocalStorage. Sentry DSN integration. OpenTelemetry basic instrumentation. Security headers middleware. Encryption at rest/in transit config. Webhook signature verification pattern. Typed error classes (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`).

**Phase 1E (Testing Infrastructure):** Vitest workspace config for monorepo. Playwright E2E setup. Test data factories for all core tables. `testTenantIsolation()` helper. Mock Clerk session utilities. MSW mock setup. `docker-compose.test.yml` for CI.

**Phase 1F (Design System Foundation):** shadcn/ui primitives installed. Tailwind config with three-layer color architecture. DM Sans + JetBrains Mono fonts. Spacing scale. Responsive application shell layout with sidebar.

**Phase 1G (Runtime Services: Real-Time Scaffold, Background Worker, File Upload):** Socket.io server with Clerk JWT auth and Redis adapter. Room join/leave model. BullMQ worker skeleton with queue definitions. `StorageClient` + R2 implementation. Presigned URL endpoints. MIME allowlist. File upload pipeline.

**Phase 1H (AI Service Layer):** AIService skeleton with `AIProviderAdapter` interface. Anthropic adapter with SDK integration. Capability-based model routing. Prompt registry with versioning. `canonicalToAIContext()` / `aiToCanonical()` type signatures. Credit metering flow with `ai_usage_log` and `ai_credit_ledger`.

### What This Phase Delivers

When complete, EveryStack has:

1. **A `writeAuditLog()` helper** that any Server Action, Worker job, or API handler can call within a database transaction to record an immutable audit trail entry with seven-source attribution (user, sync, automation, portal_client, system, agent, api_key).

2. **API key infrastructure** — secure key generation with `esk_live_` / `esk_test_` prefixes, SHA-256 hashed storage, create/list/revoke operations, and a scope-based permission model.

3. **Platform API auth middleware** — extracts API keys from the `Authorization: Bearer` header, validates the key, checks scopes, and injects tenant context into the request — enabling all future `/api/v1/` endpoints.

4. **Redis token-bucket rate limiting** with 4 plan-based tiers and per-tenant ceiling protection.

5. **Structured API error format** and versioned route scaffolding (`/api/v1/`) ready for Data API, Schema API, and all future Platform API endpoints.

### What This Phase Does NOT Build

- **Data API endpoints** (Record CRUD, Table queries) — ships in Phase 6A (MVP — API)
- **Schema API endpoints** (Workspace/Table/Field/Cross-Link structure) — ships in Phase 6B
- **Provisioning API** (create Tenants, Workspaces, Tables) — post-MVP
- **Automation API** (trigger automations, run status) — post-MVP
- **AI API** (AIService consumption endpoint) — post-MVP
- **Webhook Management API** — post-MVP
- **Audit log UI** — Record Activity tab ships in Phase 3G-i, Workspace Audit Log page ships in Phase 3G-i
- **Audit log CSV export** — post-MVP
- **API key management Settings UI page** — ships in Phase 3G-i (Settings page)
- **Platform-level service keys** (`esk_platform_` prefix for Tenant creation) — post-MVP
- **SDK generation** (TypeScript/Python SDKs) — post-MVP

### Architecture Patterns for This Phase

1. **Audit writes are transactional.** `writeAuditLog()` runs inside the same database transaction as the mutation it describes. Wrapped in try/catch — never fails the parent operation. If the insert fails, log to Sentry.

2. **Audit logs are append-only.** No updates. No deletes (except partition drops for retention).

3. **API keys use SHA-256 hashing.** The full key is shown once at creation. Only the hash is stored. Lookup uses constant-time comparison to prevent timing attacks.

4. **API auth middleware injects tenant context.** After validating the key and checking scopes, the middleware sets `tenantId`, `apiKeyId`, `apiKeyScopes`, and `actorLabel` on the request context — identical to how Clerk middleware sets `userId` and `tenantId` for authenticated users.

5. **Rate limiting uses Redis token bucket.** Each API key has a tier. Tokens refill at a fixed rate. The per-tenant ceiling prevents key proliferation as a rate limit bypass.

6. **CockroachDB safeguards remain active.** UUIDv7 for all IDs, no PG-specific syntax, no advisory locks, explicit transaction boundaries.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

---

## Section Index

| Prompt | Deliverable | Depends On | Est. Lines |
|--------|-------------|------------|------------|
| 1 | writeAuditLog() helper with seven-source attribution | None | ~200 |
| 2 | API key generation and SHA-256 hashing utilities | None | ~180 |
| 3 | API key CRUD data functions and Server Actions | 2 | ~250 |
| CP-1 | Integration Checkpoint 1 | 1–3 | — |
| 4 | Platform API auth middleware | 2, 3 | ~220 |
| 5 | Redis token-bucket rate limiter | None | ~200 |
| 6 | Platform API error format, versioning setup, and request logging | 4, 5 | ~250 |
| CP-2 | Final Integration Checkpoint | 4–6 | — |

---

## Prompt 1: Build the writeAuditLog() Helper with Seven-Source Attribution

**Depends on:** None
**Load context:** `audit-log.md` lines 49–75 (Seven-Source Attribution), lines 76–137 (Schema), lines 138–151 (Retention Policy), lines 181–330 (Audit Write Mechanism), lines 331–341 (Implementation Rules), lines 342–351 (Phase Implementation)
**Target files:** `packages/shared/db/audit.ts`, `packages/shared/db/audit.test.ts`
**Migration required:** No — `audit_log` table already exists from Phase 1B with monthly partitioning by `created_at`.
**Git:** Create and checkout branch `feat/phase-1i-audit-api-auth` from `main`. After completion, commit with message `feat(audit): create writeAuditLog() helper with seven-source attribution [Phase 1I, Prompt 1]`

### Schema Snapshot

```
audit_log (exists from 1B):
  id           UUID PRIMARY KEY (UUIDv7)
  tenant_id    UUID NOT NULL → tenants.id
  actor_type   VARCHAR           — 'user' | 'sync' | 'automation' | 'portal_client' | 'system' | 'agent' | 'api_key'
  actor_id     UUID (nullable)   — null for system
  actor_label  VARCHAR(255) (nullable) — human-readable context (api_key mutations only)
  action       VARCHAR           — e.g. 'record.updated'
  entity_type  VARCHAR           — e.g. 'record', 'field', 'table'
  entity_id    UUID
  details      JSONB             — change payload, varies by action type
  trace_id     VARCHAR           — correlation ID from AsyncLocalStorage
  ip_address   VARCHAR (nullable) — user-initiated actions only
  created_at   TIMESTAMPTZ       — immutable, never updated

Indexes (from 1B):
  (tenant_id, entity_type, entity_id, created_at DESC) — Activity tab
  (tenant_id, actor_type, actor_id, created_at DESC)   — "what did this user do?" queries
  (tenant_id, created_at DESC)                         — tenant-level audit log

Partitioned: RANGE (created_at), monthly partitions.
```

### Task

Create `packages/shared/db/audit.ts` with:

1. **`AuditActorType` type** — a union of the 7 actor type strings: `'user' | 'sync' | 'automation' | 'portal_client' | 'system' | 'agent' | 'api_key'`. Foundation ships `user` + `system` as actively-called types; all 7 are defined now so the interface is complete.

2. **`AuditEntry` interface:**
   ```typescript
   interface AuditEntry {
     tenantId: string;
     actorType: AuditActorType;
     actorId: string | null;       // null for 'system'
     actorLabel?: string | null;   // X-Actor-Label header, api_key only
     action: string;               // e.g. 'record.updated'
     entityType: string;           // e.g. 'record'
     entityId: string;
     details: Record<string, unknown>;
     traceId: string;
     ipAddress?: string;
   }
   ```

3. **`auditEntrySchema`** — a Zod schema that validates `AuditEntry` input. `actorType` must be one of the 7 values. `actorId` required when `actorType !== 'system'`. `actorLabel` only allowed when `actorType === 'api_key'`.

4. **`writeAuditLog()` function:**
   ```typescript
   async function writeAuditLog(
     tx: DrizzleTransaction,  // Same transaction as the mutation
     entry: AuditEntry,
   ): Promise<void>
   ```
   - Validates entry with `auditEntrySchema`
   - Inserts into `audit_log` table using Drizzle ORM
   - Uses `generateId()` (UUIDv7) for the `id` column
   - Sets `createdAt` to `new Date()`
   - Wrapped in try/catch — on failure, logs to Pino logger at error level and calls `captureException()` (Sentry). **Never** fails the parent transaction.

5. **`writeAuditLogBatch()` function** — for bulk audit condensation (sync batches >10 records):
   ```typescript
   async function writeAuditLogBatch(
     tx: DrizzleTransaction,
     entry: Omit<AuditEntry, 'entityType' | 'entityId'> & {
       entityType: string;
       entityId: string;  // table ID for batch entries
       batchDetails: {
         recordsCreated: number;
         recordsUpdated: number;
         recordsDeleted: number;
         recordIdsCreated: string[];
         recordIdsUpdated: string[];
         recordIdsDeleted: string[];
         truncated?: boolean;  // true if arrays capped at 1,000
       };
     },
   ): Promise<void>
   ```
   - Caps `recordIds*` arrays at 1,000 entries; sets `truncated: true` if overflow
   - Uses action `'sync.batch_complete'`
   - Same try/catch pattern as `writeAuditLog()`

6. **`AUDIT_RETENTION_DAYS` config object** — a readonly map of plan names to retention days:
   ```typescript
   const AUDIT_RETENTION_DAYS = {
     freelancer: 30,
     starter: 90,
     professional: 365,
     business: 730,
     enterprise: Infinity,  // unlimited
   } as const;
   ```

7. **Unit tests** in `packages/shared/db/audit.test.ts`:
   - Test that `writeAuditLog()` inserts a valid audit entry within a transaction
   - Test that `writeAuditLog()` does not throw when the insert fails (try/catch verification)
   - Test `auditEntrySchema` validation: rejects unknown `actorType`, rejects missing `actorId` when `actorType !== 'system'`, rejects `actorLabel` when `actorType !== 'api_key'`
   - Test `writeAuditLogBatch()` caps record ID arrays at 1,000 and sets `truncated: true`
   - Use test factories from `packages/shared/testing/`

### Acceptance Criteria

- [ ] `writeAuditLog()` inserts an audit entry inside a Drizzle transaction
- [ ] `writeAuditLog()` never throws — insert failure is caught, logged to Pino, and reported to Sentry
- [ ] `auditEntrySchema` validates all 7 actor types and rejects invalid values
- [ ] `auditEntrySchema` enforces `actorId` required for non-system actors
- [ ] `auditEntrySchema` enforces `actorLabel` only allowed for `api_key` actor type
- [ ] `writeAuditLogBatch()` caps record ID arrays at 1,000 with truncation flag
- [ ] `AUDIT_RETENTION_DAYS` config matches the 5 plan tiers from audit-log.md
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Audit log UI (Record Activity tab, Workspace Audit Log page) — Phase 3G-i
- Partition management automation (detach/archive/drop) — operational concern, not application code
- CSV export of audit log — post-MVP
- Actual Server Action integrations calling `writeAuditLog()` — each feature adds its own calls when built

---

## Prompt 2: Build API Key Generation and SHA-256 Hashing Utilities

**Depends on:** None
**Load context:** `platform-api.md` lines 56–169 (Authentication — key format, prefixes, scoping, management, database schema)
**Target files:** `packages/shared/db/api-key-utils.ts`, `packages/shared/db/api-key-utils.test.ts`
**Migration required:** No — `api_keys` and `api_request_log` tables already exist from Phase 1B.
**Git:** Commit with message `feat(api): add API key generation and SHA-256 hashing utilities [Phase 1I, Prompt 2]`

### Schema Snapshot

```
api_keys (exists from 1B):
  id               UUID PRIMARY KEY (UUIDv7)
  tenant_id        UUID NOT NULL → tenants.id
  name             VARCHAR(255) NOT NULL
  key_hash         VARCHAR(64) NOT NULL        — SHA-256 of full key
  key_prefix       VARCHAR(16) NOT NULL        — first 16 chars, for display
  scopes           TEXT[] NOT NULL              — array of scope strings
  rate_limit_tier  VARCHAR(32) DEFAULT 'standard'
  last_used_at     TIMESTAMPTZ
  expires_at       TIMESTAMPTZ                 — null = never expires
  status           VARCHAR(16) DEFAULT 'active'  — 'active' | 'revoked'
  created_by       UUID → users.id
  created_at       TIMESTAMPTZ DEFAULT NOW()
  revoked_at       TIMESTAMPTZ

  INDEX (tenant_id)
  INDEX (key_hash)                              — lookup on every request
```

### Task

Create `packages/shared/db/api-key-utils.ts` with:

1. **`API_KEY_PREFIXES` constant:**
   ```typescript
   const API_KEY_PREFIXES = {
     live: 'esk_live_',
     test: 'esk_test_',
   } as const;
   ```

2. **`ApiKeyScope` type** — Foundation ships 5 scopes:
   ```typescript
   type ApiKeyScope = 'data:read' | 'data:write' | 'schema:read' | 'schema:write' | 'admin';
   ```
   Use a `string` type in the Drizzle schema's `scopes` column to allow future scope additions without migration.

3. **`API_KEY_SCOPES` constant** — a readonly array of the 5 Foundation scopes for validation.

4. **`generateApiKey(environment: 'live' | 'test')` function:**
   - Generates a cryptographically secure random string of 48 alphanumeric characters using Node.js `crypto.randomBytes()` with base62 encoding
   - Prepends the appropriate prefix (`esk_live_` or `esk_test_`)
   - Returns `{ fullKey: string; keyPrefix: string; keyHash: string }` where:
     - `fullKey` = the complete key (shown once to user, never stored)
     - `keyPrefix` = first 16 characters of the full key (e.g., `esk_live_a7b3`) — stored for display/identification
     - `keyHash` = SHA-256 hex digest of the full key — stored for lookup

5. **`hashApiKey(fullKey: string)` function:**
   - Computes SHA-256 hex digest of the full key string
   - Uses Node.js `crypto.createHash('sha256')`

6. **`verifyApiKeyHash(fullKey: string, storedHash: string)` function:**
   - Computes hash of `fullKey` and compares with `storedHash`
   - Uses `crypto.timingSafeEqual()` for constant-time comparison (timing attack prevention)
   - Returns `boolean`

7. **`apiKeyCreateSchema`** — Zod schema for key creation input:
   ```typescript
   z.object({
     name: z.string().min(1).max(255),
     scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
     rateLimitTier: z.enum(['basic', 'standard', 'high', 'enterprise']).default('standard'),
     expiresAt: z.date().nullable().default(null),
   })
   ```

8. **`RATE_LIMIT_TIERS` constant:**
   ```typescript
   const RATE_LIMIT_TIERS = {
     basic: { requestsPerMinute: 60, burst: 10 },
     standard: { requestsPerMinute: 120, burst: 20 },
     high: { requestsPerMinute: 600, burst: 100 },
     enterprise: { requestsPerMinute: 2000, burst: 500 },
   } as const;
   ```

9. **Unit tests** in `packages/shared/db/api-key-utils.test.ts`:
   - `generateApiKey('live')` produces a key starting with `esk_live_` of correct total length
   - `generateApiKey('test')` produces a key starting with `esk_test_`
   - `keyPrefix` is the first 16 characters of `fullKey`
   - `keyHash` matches `hashApiKey(fullKey)`
   - `verifyApiKeyHash()` returns `true` for matching key/hash and `false` for mismatched
   - `verifyApiKeyHash()` uses constant-time comparison (verify `crypto.timingSafeEqual` is called — mock test)
   - `apiKeyCreateSchema` validates valid input and rejects invalid scopes
   - Generated keys have sufficient entropy (48 random characters = >250 bits)

### Acceptance Criteria

- [ ] `generateApiKey()` produces cryptographically random keys with correct prefix format
- [ ] `hashApiKey()` returns a 64-character hex SHA-256 digest
- [ ] `verifyApiKeyHash()` uses `crypto.timingSafeEqual()` for timing-safe comparison
- [ ] `apiKeyCreateSchema` validates the 5 Foundation scopes and rejects unknown scopes
- [ ] `RATE_LIMIT_TIERS` defines 4 tiers matching platform-api.md specification
- [ ] No full API key is ever logged (Pino PII redaction pattern from 1D)
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Platform-level service keys (`esk_platform_` prefix for Tenant creation) — post-MVP
- API key rotation endpoint — Foundation uses manual create-then-revoke pattern
- Key usage analytics dashboard — post-MVP
- Additional scopes beyond the 5 Foundation scopes (automation:*, portal:*, document:*, ai:use) — added when their API groups ship

---

## Prompt 3: Build API Key CRUD Data Functions and Server Actions

**Depends on:** Prompt 2 (key generation and hashing utilities)
**Load context:** `platform-api.md` lines 56–169 (Authentication — key management, creation, revocation, listing)
**Target files:** `apps/web/src/data/api-keys.ts`, `apps/web/src/actions/api-keys.ts`, `apps/web/src/data/__tests__/api-keys.integration.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(api): add API key CRUD data functions and Server Actions [Phase 1I, Prompt 3]`

### Schema Snapshot

```
api_keys (exists from 1B — same as Prompt 2 snapshot)
```

### Task

Create data functions and Server Actions for API key lifecycle management. These will be consumed by the Settings UI (Phase 3G-i) and by the Platform API key management endpoints (Phase 6).

**Data functions** in `apps/web/src/data/api-keys.ts`:

1. **`createApiKey(input: CreateApiKeyInput)`:**
   - Accepts: `name`, `scopes`, `rateLimitTier`, `expiresAt`
   - Calls `generateApiKey('live')` (or `'test'` based on environment config)
   - Inserts into `api_keys` table: `id` (UUIDv7), `tenantId` (from context), `name`, `keyHash`, `keyPrefix`, `scopes`, `rateLimitTier`, `expiresAt`, `createdBy` (from context), `status: 'active'`
   - Writes audit log entry within the same transaction: `action: 'api_key.created'`, `entityType: 'api_key'`, `actorType: 'user'`, `details: { name, scopes, rateLimitTier }`
   - Returns `{ id, name, fullKey, keyPrefix, scopes, rateLimitTier, expiresAt, createdAt }` — `fullKey` is returned ONLY on creation, never again
   - Uses `getDbForTenant()` for tenant-scoped access

2. **`listApiKeys()`:**
   - Returns all API keys for the tenant: `id`, `name`, `keyPrefix`, `scopes`, `rateLimitTier`, `lastUsedAt`, `expiresAt`, `status`, `createdAt`
   - **Never** returns `keyHash` or reconstructs the full key
   - Ordered by `createdAt DESC`
   - Uses `getDbForTenant()` for tenant-scoped access

3. **`revokeApiKey(keyId: string)`:**
   - Sets `status: 'revoked'`, `revokedAt: new Date()`
   - Writes audit log entry: `action: 'api_key.revoked'`, `entityType: 'api_key'`, `actorType: 'user'`, `details: { keyId, name }`
   - Returns void on success, throws `NotFoundError` if key doesn't exist or belongs to different tenant
   - Uses `getDbForTenant()` for tenant-scoped access

4. **`getApiKeyByHash(keyHash: string)`:**
   - Looks up an API key by its SHA-256 hash (used by auth middleware)
   - Returns full key record including `tenantId`, `scopes`, `rateLimitTier`, `status`, `expiresAt`
   - This function does NOT use `getDbForTenant()` — it needs to query across all tenants to find which tenant the key belongs to (the tenant is unknown until the key is resolved)
   - Uses the `(key_hash)` index for fast lookup
   - Returns `null` if not found

**Server Actions** in `apps/web/src/actions/api-keys.ts`:

1. **`createApiKeyAction(input)`** — validates with `apiKeyCreateSchema`, calls `createApiKey()`, requires Owner or Admin role (use `requireRole()` from 1C)
2. **`revokeApiKeyAction(keyId)`** — validates `keyId` is a UUID, calls `revokeApiKey()`, requires Owner or Admin role

**Integration tests** in `apps/web/src/data/__tests__/api-keys.integration.test.ts`:

1. `testTenantIsolation()` for `listApiKeys()` — keys from Tenant A are not visible to Tenant B
2. `createApiKey()` returns a full key that, when hashed, matches the stored `keyHash`
3. `revokeApiKey()` sets status to `'revoked'` and `revokedAt` timestamp
4. `getApiKeyByHash()` returns the correct key record
5. `getApiKeyByHash()` returns `null` for a non-existent hash
6. `listApiKeys()` never includes `keyHash` in response

### Acceptance Criteria

- [ ] `testTenantIsolation()` passes for `listApiKeys()`
- [ ] `createApiKey()` returns `fullKey` only on creation — subsequent `listApiKeys()` never returns it
- [ ] `createApiKey()` writes an audit log entry within the same transaction
- [ ] `revokeApiKey()` writes an audit log entry within the same transaction
- [ ] `getApiKeyByHash()` queries across all tenants without `getDbForTenant()`
- [ ] Server Actions enforce Owner or Admin role via `requireRole()`
- [ ] `keyHash` is never included in `listApiKeys()` response
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Settings UI page for API key management — Phase 3G-i
- API endpoint for key creation via Platform API (`POST /api/v1/api-keys`) — Phase 6
- Key rotation automation — manual create-then-revoke for MVP
- Usage analytics or last-used-at tracking on every API call — added when auth middleware is built (Prompt 4 updates `lastUsedAt`)

---

## Integration Checkpoint 1 (after Prompts 1–3)

**Task:** Verify all work from Prompts 1–3 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (existing tests + new audit and API key tests)
4. `pnpm turbo test -- --coverage` — thresholds met for `packages/shared/db/`

Manual verification:
- Confirm `packages/shared/db/audit.ts` exports `writeAuditLog`, `writeAuditLogBatch`, `AuditEntry`, `AuditActorType`, `auditEntrySchema`, `AUDIT_RETENTION_DAYS`
- Confirm `packages/shared/db/api-key-utils.ts` exports `generateApiKey`, `hashApiKey`, `verifyApiKeyHash`, `ApiKeyScope`, `API_KEY_SCOPES`, `RATE_LIMIT_TIERS`, `apiKeyCreateSchema`
- Confirm `apps/web/src/data/api-keys.ts` exports `createApiKey`, `listApiKeys`, `revokeApiKey`, `getApiKeyByHash`
- Confirm no full API keys appear in any test output or log statements

**Git:** Commit with message `chore(verify): integration checkpoint 1 — audit helper and API key CRUD verified [Phase 1I, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 4.

---

## Prompt 4: Build Platform API Authentication Middleware

**Depends on:** Prompt 2 (hashing utilities), Prompt 3 (`getApiKeyByHash()`)
**Load context:** `platform-api.md` lines 56–169 (Authentication), lines 257–272 (Audit Integration)
**Target files:** `apps/web/src/lib/api/auth-middleware.ts`, `apps/web/src/lib/api/auth-middleware.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(api): add Platform API authentication middleware with scope validation [Phase 1I, Prompt 4]`

### Schema Snapshot

```
api_keys (exists — relevant columns for auth):
  key_hash         VARCHAR(64)    — SHA-256, indexed for fast lookup
  tenant_id        UUID           — injected into request context after auth
  scopes           TEXT[]         — checked against required scope for each endpoint
  status           VARCHAR(16)    — must be 'active'
  expires_at       TIMESTAMPTZ    — must be null or in the future
  last_used_at     TIMESTAMPTZ    — updated on each authenticated request
  rate_limit_tier  VARCHAR(32)    — passed to rate limiter
```

### Task

Create `apps/web/src/lib/api/auth-middleware.ts` with:

1. **`ApiRequestContext` interface** — the authenticated context injected into each API request:
   ```typescript
   interface ApiRequestContext {
     tenantId: string;
     apiKeyId: string;
     apiKeyScopes: string[];
     rateLimitTier: string;
     actorLabel: string | null;   // from X-Actor-Label header
     requestId: string;           // generated per-request for tracing
   }
   ```

2. **`authenticateApiKey(request: NextRequest)` function:**
   - Extracts the key from the `Authorization: Bearer esk_...` header
   - Validates the key starts with a known prefix (`esk_live_` or `esk_test_`)
   - Computes SHA-256 hash using `hashApiKey()`
   - Looks up the key using `getApiKeyByHash(hash)`
   - If not found: return 401 `UNAUTHORIZED` error
   - If `status !== 'active'`: return 401 `KEY_REVOKED` error
   - If `expiresAt` is set and in the past: return 401 `KEY_EXPIRED` error
   - Updates `last_used_at` to `new Date()` (fire-and-forget — do not await; log errors but don't fail the request)
   - Extracts optional `X-Actor-Label` header (max 255 chars, truncated if longer)
   - Generates a `requestId` (prefixed `req_` + 8 random hex chars) for tracing
   - Returns `ApiRequestContext`

3. **`requireScope(context: ApiRequestContext, ...requiredScopes: string[])` function:**
   - Checks if the API key's scopes include ANY of the required scopes OR includes `'admin'` (admin grants all scopes)
   - If insufficient scope: throw `ForbiddenError` with code `INSUFFICIENT_SCOPE` and message identifying the missing scope
   - Returns void on success

4. **`withApiAuth(handler, ...requiredScopes)` higher-order function:**
   - Wraps a Next.js Route Handler to enforce API key authentication and scope checking
   - Calls `authenticateApiKey()`, then `requireScope()`, then passes `ApiRequestContext` to the wrapped handler
   - Catches and formats auth errors using the Platform API error shape (built in Prompt 6; for now, return raw JSON error responses matching the spec)

5. **Unit tests** in `apps/web/src/lib/api/auth-middleware.test.ts`:
   - Valid key → returns `ApiRequestContext` with correct `tenantId` and `scopes`
   - Missing Authorization header → 401 `UNAUTHORIZED`
   - Invalid prefix → 401 `UNAUTHORIZED`
   - Key not found (hash doesn't match any record) → 401 `UNAUTHORIZED`
   - Revoked key → 401 `KEY_REVOKED`
   - Expired key → 401 `KEY_EXPIRED`
   - `requireScope('data:read')` passes when key has `['data:read', 'data:write']`
   - `requireScope('data:write')` fails when key has `['data:read']` only
   - `requireScope('data:write')` passes when key has `['admin']` (admin override)
   - `X-Actor-Label` header extracted and truncated to 255 chars
   - `last_used_at` update failure does not fail the request
   - Use MSW mocks and test factories (mock `getApiKeyByHash()` to return test key records)

### Acceptance Criteria

- [ ] `authenticateApiKey()` extracts and validates keys from `Authorization: Bearer` header
- [ ] Auth middleware returns distinct 401 error codes: `UNAUTHORIZED`, `KEY_REVOKED`, `KEY_EXPIRED`
- [ ] `requireScope()` grants access when key has `admin` scope regardless of required scope
- [ ] `requireScope()` returns 403 `INSUFFICIENT_SCOPE` when scope is missing
- [ ] `X-Actor-Label` header is extracted, capped at 255 chars, and included in context
- [ ] `last_used_at` update is fire-and-forget — failure doesn't block the request
- [ ] `requestId` is generated per-request for tracing
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Clerk auth bypass/fallback for Platform API routes — Platform API uses API keys exclusively, never Clerk sessions
- IP allowlisting per API key — post-MVP
- Webhook signature verification for inbound webhooks — different auth path, built with Automations (Phase 4)
- Rate limiting integration — built separately in Prompt 5 and composed in Prompt 6

---

## Prompt 5: Build Redis Token-Bucket Rate Limiter

**Depends on:** None (self-contained, composed with auth middleware in Prompt 6)
**Load context:** `platform-api.md` lines 170–196 (Rate Limiting — tiers, token bucket, headers, per-tenant ceiling)
**Target files:** `apps/web/src/lib/api/rate-limiter.ts`, `apps/web/src/lib/api/rate-limiter.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(api): add Redis token-bucket rate limiter with 4 tiers [Phase 1I, Prompt 5]`

### Schema Snapshot

N/A — no schema changes. Rate limiting uses Redis, not PostgreSQL.

### Task

Create `apps/web/src/lib/api/rate-limiter.ts` with:

1. **Redis token-bucket algorithm:**
   - Each API key gets a bucket identified by `rate_limit:{apiKeyId}`
   - Each bucket has `tokens` (current count) and `lastRefill` (timestamp)
   - On each request: calculate tokens to add since `lastRefill` based on the tier's `requestsPerMinute` ÷ 60 (tokens per second). Add refilled tokens up to `burst` maximum. Consume 1 token. If tokens < 1, reject.
   - Use a Redis Lua script for atomicity (check + refill + consume must be atomic to prevent race conditions under concurrent requests)

2. **`checkRateLimit(apiKeyId: string, tier: string)` function:**
   - Loads tier config from `RATE_LIMIT_TIERS` (imported from Prompt 2's `api-key-utils.ts`)
   - Executes the Lua script against Redis
   - Returns:
     ```typescript
     interface RateLimitResult {
       allowed: boolean;
       limit: number;         // max requests per window
       remaining: number;     // tokens remaining
       resetAt: number;       // Unix timestamp when bucket fully refills
       retryAfter?: number;   // seconds until a token is available (only when blocked)
     }
     ```

3. **`setRateLimitHeaders(response: NextResponse, result: RateLimitResult)` function:**
   - Sets `X-RateLimit-Limit` → `result.limit`
   - Sets `X-RateLimit-Remaining` → `result.remaining`
   - Sets `X-RateLimit-Reset` → `result.resetAt`
   - If blocked (`!result.allowed`): sets `Retry-After` → `result.retryAfter`

4. **Per-tenant ceiling check:**
   - `checkTenantCeiling(tenantId: string, highestKeyTier: string)` function
   - Uses a separate Redis counter `rate_limit_tenant:{tenantId}` with a sliding window
   - Ceiling = 3 × the highest single-key tier's `requestsPerMinute` for that tenant
   - Called AFTER the per-key check passes. If tenant ceiling exceeded, return 429.
   - For Foundation, this is a simple implementation: look up all active keys for the tenant, find the highest tier, multiply by 3. Cache the ceiling value in Redis with 60s TTL to avoid per-request DB queries.

5. **Unit/integration tests** in `apps/web/src/lib/api/rate-limiter.test.ts`:
   - `checkRateLimit()` allows requests up to the burst limit
   - `checkRateLimit()` rejects requests when bucket is empty
   - Tokens refill at the correct rate over time
   - `setRateLimitHeaders()` sets all 3 standard headers
   - `setRateLimitHeaders()` adds `Retry-After` header when rate limited
   - Per-tenant ceiling: if 2 keys each with `standard` tier (120/min), tenant ceiling is 3 × 120 = 360/min
   - Use Redis test instance from `docker-compose.test.yml`

### Acceptance Criteria

- [ ] Token-bucket algorithm uses an atomic Redis Lua script for concurrent safety
- [ ] 4 tiers correctly configured: basic (60/min, burst 10), standard (120/min, burst 20), high (600/min, burst 100), enterprise (2000/min, burst 500)
- [ ] Rate limit response headers set on every API response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] 429 responses include `Retry-After` header
- [ ] Per-tenant ceiling prevents key proliferation as rate limit bypass (3× highest tier)
- [ ] Tokens refill at the correct per-second rate
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Rate limit tier upgrades via API — manual DB update or Settings UI (Phase 3G-i)
- Rate limit analytics dashboard — post-MVP
- Per-endpoint rate limits (e.g., different limits for reads vs. writes) — Foundation uses per-key tier only
- DDoS protection or WAF integration — operational concern, not application code

---

## Prompt 6: Build Platform API Error Format, Versioning Setup, and Request Logging

**Depends on:** Prompt 4 (auth middleware), Prompt 5 (rate limiter)
**Load context:** `platform-api.md` lines 36–55 (Overview), lines 197–213 (API Versioning), lines 214–256 (Error Format)
**Target files:** `apps/web/src/lib/api/errors.ts`, `apps/web/src/lib/api/request-logger.ts`, `apps/web/src/lib/api/middleware.ts`, `apps/web/src/app/api/v1/route.ts`, `apps/web/src/lib/api/errors.test.ts`, `apps/web/src/lib/api/request-logger.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(api): add Platform API error format, versioning, and request logging [Phase 1I, Prompt 6]`

### Schema Snapshot

```
api_request_log (exists from 1B):
  id              UUID PRIMARY KEY (UUIDv7)
  tenant_id       UUID NOT NULL
  api_key_id      UUID NOT NULL → api_keys.id
  method          VARCHAR(8)
  path            VARCHAR(512)
  status_code     INTEGER
  duration_ms     INTEGER
  request_size    INTEGER        — bytes
  response_size   INTEGER        — bytes
  created_at      TIMESTAMPTZ DEFAULT NOW()

  Partitioned monthly by created_at. 30-day retention.
```

### Task

**1. API Error Response Utilities** — `apps/web/src/lib/api/errors.ts`:

Create a `createApiErrorResponse()` function and typed error helpers that produce the Platform API error shape:

```typescript
interface ApiErrorBody {
  error: {
    code: string;         // Machine-readable: VALIDATION_ERROR, UNAUTHORIZED, etc.
    message: string;      // Human-readable, safe for consumers
    details?: unknown[];  // Per-field validation errors or additional context
    request_id?: string;  // For tracing (included on 500 errors and optionally on all)
  };
}
```

Error helper functions (each returns a `NextResponse` with correct status code and error body):
- `apiError(status, code, message, details?, requestId?)` — generic
- `apiBadRequest(code, message, details?)` → 400
- `apiUnauthorized(code, message)` → 401
- `apiForbidden(code, message)` → 403
- `apiNotFound(message?)` → 404 with code `NOT_FOUND`
- `apiConflict(message?)` → 409 with code `CONFLICT`
- `apiValidationError(details)` → 400 with code `VALIDATION_ERROR`
- `apiPayloadTooLarge()` → 413 with code `PAYLOAD_TOO_LARGE`
- `apiRateLimited(retryAfter)` → 429 with code `RATE_LIMITED` and `Retry-After` header
- `apiInternalError(requestId)` → 500 with code `INTERNAL_ERROR` and `request_id`

All error responses include the `X-API-Version` header.

**2. API Versioning Setup:**

- Create the directory structure `apps/web/src/app/api/v1/` for all future Platform API routes
- Create a placeholder `apps/web/src/app/api/v1/route.ts` that returns a 200 JSON response:
  ```json
  { "api": "everystack", "version": "v1", "status": "ok" }
  ```
  This serves as a health check and version discovery endpoint.
- Define `API_VERSION = '2026-03-01'` constant — the version date header value
- All API responses include `X-API-Version: 2026-03-01` header

**3. API Request Logging Middleware** — `apps/web/src/lib/api/request-logger.ts`:

Create `logApiRequest()` function:
- Called after the response is sent (fire-and-forget, don't block the response)
- Inserts into `api_request_log` table: `id` (UUIDv7), `tenantId`, `apiKeyId`, `method`, `path`, `statusCode`, `durationMs` (computed from request start time), `requestSize` (from `Content-Length` header), `responseSize` (from response body length), `createdAt`
- Wrapped in try/catch — never fails the API response. On failure, log to Pino.

**4. Composed API Middleware** — `apps/web/src/lib/api/middleware.ts`:

Create `withPlatformApi(handler, ...requiredScopes)` that composes:
1. Auth middleware (from Prompt 4) — authenticates the API key, checks scopes
2. Rate limiter (from Prompt 5) — checks rate limit, returns 429 if exceeded
3. Sets `X-API-Version` header on the response
4. Sets rate limit headers on the response
5. Calls the handler with `ApiRequestContext`
6. Logs the request via `logApiRequest()` (fire-and-forget after response)
7. Catches unhandled errors → `apiInternalError(requestId)` with Sentry capture

This is the single entry point for all Platform API route handlers going forward.

**5. Tests:**

`apps/web/src/lib/api/errors.test.ts`:
- Each error helper returns correct HTTP status code and error body shape
- `apiValidationError()` includes `details` array
- `apiInternalError()` includes `request_id` in the error body
- All error responses include `X-API-Version` header

`apps/web/src/lib/api/request-logger.test.ts`:
- `logApiRequest()` inserts into `api_request_log` with correct values
- `logApiRequest()` does not throw on insert failure

### Acceptance Criteria

- [ ] All API error responses follow the `{ error: { code, message, details?, request_id? } }` shape
- [ ] Error codes match the Platform API spec: `VALIDATION_ERROR`, `UNAUTHORIZED`, `KEY_REVOKED`, `KEY_EXPIRED`, `INSUFFICIENT_SCOPE`, `NOT_FOUND`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`
- [ ] `X-API-Version: 2026-03-01` header present on all API responses (success and error)
- [ ] `GET /api/v1/` returns a 200 health check response with version info
- [ ] `logApiRequest()` inserts into `api_request_log` asynchronously (fire-and-forget)
- [ ] `logApiRequest()` never fails the API response
- [ ] `withPlatformApi()` composes auth → rate limit → handler → request logging
- [ ] Unhandled errors caught by `withPlatformApi()` return 500 `INTERNAL_ERROR` with Sentry capture
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual Data API or Schema API route handlers — Phase 6
- OpenAPI spec generation — post-MVP
- Request body size enforcement middleware (1MB limit) — built when Data API endpoints ship
- API key creation endpoint (`POST /api/v1/api-keys`) via the Platform API — Phase 6 (Foundation creates keys via Server Actions/Settings UI only)
- Deprecation or `Sunset` header handling — no deprecated versions exist yet

---

## Integration Checkpoint 2 — Final (after Prompts 4–6)

**Task:** Verify all Phase 1I work integrates correctly and the branch is ready for PR.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (existing tests + all new tests from Prompts 1–6)
4. `pnpm turbo test -- --coverage` — thresholds met for `packages/shared/db/` and `apps/web/src/`

Manual verification:
- Confirm `GET /api/v1/` returns `{ "api": "everystack", "version": "v1", "status": "ok" }` with `X-API-Version` header
- Confirm the full auth flow works end-to-end: generate a test API key → use the key prefix + hash to verify lookup → authenticate via middleware → check scope → rate limit check → response with rate limit headers
- Confirm `writeAuditLog()` can be called within a Drizzle transaction and the entry appears in the `audit_log` table
- Confirm no secrets (full API keys, hashes) appear in any log output
- Review all exports:
  - `packages/shared/db/audit.ts` — `writeAuditLog`, `writeAuditLogBatch`, `AuditEntry`, `AuditActorType`, `auditEntrySchema`, `AUDIT_RETENTION_DAYS`
  - `packages/shared/db/api-key-utils.ts` — `generateApiKey`, `hashApiKey`, `verifyApiKeyHash`, `ApiKeyScope`, `API_KEY_SCOPES`, `RATE_LIMIT_TIERS`, `apiKeyCreateSchema`, `API_KEY_PREFIXES`
  - `apps/web/src/data/api-keys.ts` — `createApiKey`, `listApiKeys`, `revokeApiKey`, `getApiKeyByHash`
  - `apps/web/src/lib/api/auth-middleware.ts` — `authenticateApiKey`, `requireScope`, `withApiAuth`, `ApiRequestContext`
  - `apps/web/src/lib/api/rate-limiter.ts` — `checkRateLimit`, `setRateLimitHeaders`, `checkTenantCeiling`
  - `apps/web/src/lib/api/errors.ts` — `createApiErrorResponse`, `apiError`, `apiBadRequest`, `apiUnauthorized`, `apiForbidden`, `apiNotFound`, `apiConflict`, `apiValidationError`, `apiPayloadTooLarge`, `apiRateLimited`, `apiInternalError`
  - `apps/web/src/lib/api/request-logger.ts` — `logApiRequest`
  - `apps/web/src/lib/api/middleware.ts` — `withPlatformApi`

**Git:** Commit with message `chore(verify): integration checkpoint 2 — Phase 1I complete [Phase 1I, CP-2]`, then push branch to origin. Open PR to `main` with title `Phase 1I — Audit Log Helper, Platform API Auth Skeleton`.
