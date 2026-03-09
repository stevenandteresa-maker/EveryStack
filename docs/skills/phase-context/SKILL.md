---
name: everystack-phase-context
description: Current build state for EveryStack. Load this skill at the start of every build prompt. It documents what exists in the codebase right now — files, modules, patterns, conventions — so Claude Code doesn't have to rediscover it each time.
---

# EveryStack — Phase Context

**Last updated:** 2026-03-09
**Branch:** `main`
**Latest tag:** `v0.2.0-phase-2a`
**Total commits:** 9 (squash merges)

---

## What Exists Now

### Phase 1A — Infrastructure (Complete)

Monorepo scaffold with Turborepo + pnpm workspaces, CI pipeline, and dev environment.

**Key files:**
- `turbo.json` — Task orchestration (dev, build, lint, typecheck, test, db:\*)
- `pnpm-workspace.yaml` — 3 apps + 1 shared package
- `.github/workflows/ci.yml` — 5-job CI (lint, unit/integration, E2E, AI eval, migration timing)
- `.github/dependabot.yml` — Weekly dependency updates
- `docker-compose.yml` — Dev services (PostgreSQL 16 + pgvector, PgBouncer, Redis 7)
- `docker/pgbouncer/pgbouncer.ini` — Transaction-mode pooling (port 6432)
- `docker/postgres/init-extensions.sql` — pgvector extension
- `tsconfig.base.json` — Strict mode, ES2022, noUncheckedIndexedAccess
- `eslint.config.mjs` — no-console, no-any, security plugin
- `.nvmrc` — Node 20

**Patterns established:** Turborepo task graph, pnpm workspaces, strict TypeScript, conventional commits (`type(scope): description [Phase X, Prompt N]`).

### Phase 1B — Database (Complete)

Full Drizzle ORM schema (59 tables), 16 SQL migrations, RLS, connection pooling, tenant routing.

**Key files:**
- `packages/shared/db/client.ts` — `getDbForTenant(tenantId, intent)` routing, PgBouncer clients
- `packages/shared/db/rls.ts` — `setTenantContext()`, 48 tenant-scoped tables with RLS policies (47 standard + `tenant_relationships` with OR-clause), `RLS_EXCLUDED_COLUMNS`
- `packages/shared/db/uuid.ts` — `generateUUIDv7()` (all PKs are UUIDv7)
- `packages/shared/db/schema/` — 59 Drizzle table definitions (50 MVP + 2 feature management + 7 platform admin)
- `packages/shared/db/migrations/` — 24 migrations (0000–0018 prior phases + 0019–0020 Phase 1I + 0021–0023 Phase 1J)
- `packages/shared/db/operations/user-operations.ts` — `createUserWithTenant()` (now provisions personal tenant), `updateUserFromClerk()`
- `packages/shared/db/drizzle.config.ts` — Migration config (uses DATABASE_URL_DIRECT for DDL)

**Schema highlights:** `records` hash-partitioned into 16 partitions by `tenant_id`. `audit_log`, `ai_usage_log`, `api_request_log` time-partitioned monthly. Canonical JSONB pattern: `records.canonical_data` keyed by `fields.id`.

**Patterns established:** `getDbForTenant()` for all DB access, `setTenantContext()` before RLS queries, UUIDv7 everywhere, composite PKs on partitioned tables, no raw SQL outside migrations. Admin-only tables intentionally skip RLS (accessed only via `/admin` routes). Cross-tenant queries (e.g. `effective_memberships`) use `dbRead` directly.

### Phase 1C — Auth & Tenant Isolation (Complete)

Clerk integration, 5-role RBAC hierarchy, tenant resolution, webhook-driven user provisioning.

**Key files:**
- `packages/shared/auth/roles.ts` — Role constants, hierarchy (owner=50 > admin=40 > manager=30 > team_member=20 > viewer=10), `roleAtLeast()`
- `packages/shared/auth/check-role.ts` — `resolveEffectiveRole()`, `checkRole()`, `requireRole()`
- `packages/shared/auth/errors.ts` — `PermissionDeniedError` (403)
- `apps/web/src/lib/auth.ts` — Clerk session extraction
- `apps/web/src/lib/auth-context.ts` — `getAuthContext()` resolves Clerk IDs to internal UUIDs
- `apps/web/src/lib/tenant-resolver.ts` — Maps `clerk_org_id` to internal `tenant_id`
- `apps/web/src/app/api/webhooks/clerk/route.ts` — `user.created` / `org.updated` webhook handler
- `apps/web/src/lib/middleware.ts` — Clerk middleware + route matchers

**Patterns established:** Clerk org ID stored in `tenants.clerk_org_id` (varchar), internal UUIDs for all DB relations. `tenant-resolver.ts` handles the lookup. Never trust client-supplied tenant/user IDs.

### Phase 1D — Observability & Security (Complete)

Pino logging with PII redaction, OpenTelemetry tracing, Sentry error tracking, security headers, compliance foundations.

**Key files:**
- `packages/shared/logging/logger.ts` — `createLogger()`, PII redaction, `webLogger`/`workerLogger`/`realtimeLogger`
- `packages/shared/logging/trace-context.ts` — AsyncLocalStorage trace propagation, `runWithTraceContext()`
- `packages/shared/telemetry/otel.ts` — `initTelemetry()`, custom `TraceIdSpanProcessor`
- `packages/shared/errors/index.ts` — 6 error classes (Validation/NotFound/Forbidden/Conflict/RateLimited/Internal), `toErrorResponse()`
- `packages/shared/webhooks/verify-signature.ts` — Svix + generic HMAC verification
- `packages/shared/compliance/pii-registry.ts` — Declarative PII column registry (7 tables tracked)
- `packages/shared/compliance/verify-encryption.ts` — TLS verification stubs
- `apps/web/src/lib/pino-http.ts` — HTTP logging wrappers with trace context
- `apps/web/src/app/global-error.tsx` — Sentry error boundary with support reporting
- `apps/web/instrumentation.ts` — Runtime instrumentation entry
- `apps/web/sentry.*.config.ts` — Client/server/edge Sentry configs
- `apps/worker/src/lib/job-wrapper.ts` — `createJobProcessor()` with tracing + Sentry
- `apps/worker/src/lib/sentry.ts` — Worker Sentry init + `captureJobError()`
- `apps/worker/src/lib/otel-init.ts` — Worker telemetry init
- Security headers in middleware: CSP, HSTS, X-Frame-Options (DENY for platform, SAMEORIGIN for portal)

**Patterns established:** All errors extend `AppError` with code/statusCode/traceId. PII redacted in logs. AsyncLocalStorage for trace propagation across async boundaries. Different security policies for platform vs portal routes.

### Phase 1E — Testing Infrastructure (Complete)

Vitest monorepo config, Docker test services, comprehensive test data factories.

**Key files:**
- `vitest.workspace.ts` — Root workspace referencing 4 package configs
- `packages/shared/vitest.config.ts` — Forks pool, V8 coverage (db: 90/85%, sync: 90/85%)
- `apps/web/vitest.config.ts` — Forks pool, coverage (data: 95/90%, actions: 90/85%), env fallbacks for CI
- `apps/worker/vitest.config.ts` — Coverage (jobs: 85/80%)
- `apps/realtime/vitest.config.ts` — passWithNoTests: true
- `apps/web/vitest.setup.ts` — Auto-runs migrations in beforeAll, truncates all tables in afterEach
- `docker-compose.test.yml` — tmpfs PostgreSQL (5434), PgBouncer (6433), Redis (6380)
- `packages/shared/testing/factories.ts` — 19 factory functions with auto-parent creation (`createTestTenant`, `createTestUser`, `createTestWorkspace`, `createTestRecord`, `createTestTable`, `createTestField`, `createTestBase`, `createTestView`, `createTestCrossLink`, `createTestRecordViewConfig`, `createTestPortal`, `createTestForm`, `createTestAutomation`, `createTestDocumentTemplate`, `createTestThread`, `createTestApiKey`)
- `packages/shared/testing/tenant-isolation.ts` — `testTenantIsolation()` helper — **mandatory for every `/data` function** (see CLAUDE.md non-negotiable rules)
- `packages/shared/testing/mock-clerk.ts` — `mockClerkSession()`, `mockClerkSessionWithUser()`, `clearClerkMocks()`, `getMockAuthContext()`, `getMockRole()`, `hasMockSession()`
- `packages/shared/testing/mock-apis.ts` — MSW handlers per platform (`airtableHandlers`, `notionHandlers`, `smartsuiteHandlers`), `mockApiServer`, `setupMockApis()`
- `packages/shared/testing/mock-uuid.ts` — `createMockUUIDs()` for deterministic UUIDs in tests
- `packages/shared/testing/performance.ts` — `expectQueryTime()` for query performance assertions
- `packages/shared/testing/a11y.ts` — `checkAccessibility()` wrapper around axe-core
- `packages/shared/testing/factories.test.ts` — Factory unit tests

**All utilities exported from `@everystack/shared/testing`** — import from the package, not individual files.

**Shared package imports added in 1G:**
- `@everystack/shared/realtime` — RealtimeService, EventPublisher, REALTIME_EVENTS, types
- `@everystack/shared/redis` — createRedisClient, getRedisConfig
- `@everystack/shared/queue` — QUEUE_NAMES, BaseJobData, job data types, QueueJobDataMap
- `@everystack/shared/storage` — StorageClient, R2StorageClient, keys, MIME, magic bytes, limits, sanitize, serve, audit

**Shared package imports added in 1H:**
- `@everystack/shared/ai` — AIService, AnthropicAdapter, SelfHostedAdapter, PromptRegistry, ToolRegistry, AI_FEATURES, AI_RATES, calculateCost, logAIUsage, checkBudget, deductCredits, canonicalToAIContext, aiToCanonical, createAIStream, provider errors, all types

**Shared package exports added in 1I:**
- `@everystack/shared/db` — writeAuditLog, writeAuditLogBatch, auditEntrySchema, AUDIT_ACTOR_TYPES, AUDIT_RETENTION_DAYS, API_KEY_PREFIXES, API_KEY_SCOPES, RATE_LIMIT_TIERS, generateApiKey, hashApiKey, verifyApiKeyHash, apiKeyCreateSchema

**Shared package exports added in 1J:**
- `@everystack/shared/db` — effectiveMemberships (view), EffectiveMembership (type), getEffectiveMemberships, getEffectiveMembershipForTenant

**Patterns established:** Vitest configs (4), Docker test services, 20 factories with auto-parent creation (added `createTestTenantRelationship` in 1J), tenant isolation testing helper, Clerk session mocking, MSW-based platform API mocking (enhanced with Airtable OAuth/metadata handlers in 2A), performance + a11y test helpers. Integration tests: auth-flow, role-check, webhook, effective-memberships, sidebar-navigation, sync-connections, sync-setup.

### Phase 1F — Design System Foundation & i18n (Complete)

Tailwind token system, shadcn/ui primitives, application shell, i18n framework.

**Key files:**
- `apps/web/tailwind.config.ts` — CSS custom properties, DM Sans/JetBrains Mono fonts, Obsidian Teal surface tokens, accent/data-color layers, responsive breakpoints (phone/tablet/desktop)
- `apps/web/src/app/globals.css` — CSS custom properties for surface tokens, accent color, sidebar colors
- `apps/web/src/lib/design-system/colors.ts` — 8 workspace accent colors, 13-color data palette, contrast map, `applyAccentColor()`, `getDataColor()`, `getContrastText()`
- `apps/web/src/lib/design-system/typography.ts` — 9-step type scale (page-title through timestamp)
- `apps/web/src/lib/design-system/breakpoints.ts` — 3 semantic breakpoints (phone <768, tablet >=768, desktop >=1440)
- `apps/web/src/lib/design-system/index.ts` — Re-exports all design system constants
- `apps/web/src/lib/fonts.ts` — DM Sans + JetBrains Mono via next/font/google
- `apps/web/src/components/ui/` — 16 shadcn/ui primitives (badge, button, card, command, dialog, dropdown-menu, input, label, popover, scroll-area, select, separator, sheet, skeleton, tabs, tooltip)
- `apps/web/src/components/layout/app-shell.tsx` — Root layout: dark sidebar + accent header + white content
- `apps/web/src/components/layout/sidebar.tsx` — Collapsible sidebar (48px/280px), workspace nav
- `apps/web/src/components/layout/header.tsx` — Accent-colored header (52px), command bar placeholder
- `apps/web/src/components/layout/main-content.tsx` — White content area
- `apps/web/src/stores/sidebar-store.ts` — Zustand store for sidebar collapsed state
- `apps/web/messages/en.json` — English translations
- `apps/web/messages/es.json` — Spanish translations
- `apps/web/src/i18n/request.ts` — next-intl request config (non-routing locale strategy)
- `apps/web/src/test-utils/intl-wrapper.tsx` — IntlWrapper for component testing with translations
- `scripts/check-i18n.ts` — AST-based CI script enforcing zero hardcoded English strings in UI code
- `apps/web/components.json` — shadcn/ui CLI config

**Patterns established:** Three-layer color architecture (workspace accent, semantic/process, data palette). CSS custom properties for all tokens. `applyAccentColor()` for runtime theme switching. next-intl with non-routing locale strategy. `check:i18n` CI gate active. IntlWrapper for test isolation.

### Phase 1G — Runtime Services (Complete)

Real-time server, background worker, file storage/upload pipeline.

**Realtime Server (`apps/realtime/src/`):**
- `index.ts` — Entry point, calls `startServer()`
- `server.ts` — Socket.io server with Redis adapter (`@socket.io/redis-adapter`), CORS, graceful shutdown (10s)
- `middleware/auth.ts` — Clerk JWT auth on connection, resolves user/tenant, populates `socket.data`
- `handlers/room-handler.ts` — `room:join` / `room:leave` event handlers with callback support
- `handlers/authorize-room-join.ts` — Query-based room authorization for 5 resource types (user, workspace, table, record, thread)
- `subscribers/redis-event-subscriber.ts` — Pattern-subscribes to `realtime:t:*`, forwards events to Socket.io rooms, supports user exclusion
- `socket-io-realtime-service.ts` — Implements `RealtimeService` interface (joinRoom, leaveRoom, emitToRoom, emitToUser, broadcast)

**Background Worker (`apps/worker/src/`):**
- `index.ts` — Worker bootstrap: OpenTelemetry init, queue init, processor creation, recurring job scheduling (orphan cleanup daily 3AM UTC), graceful shutdown
- `queues.ts` — Lazy-creates and caches BullMQ Queue instances for all 6 queues
- `lib/base-processor.ts` — Abstract `BaseProcessor<TData>`: trace propagation via AsyncLocalStorage, Pino child logger, Sentry capture, configurable concurrency
- `lib/graceful-shutdown.ts` — `setupGracefulShutdown()`: ordered handler execution, SIGTERM/SIGINT hooks, 30s forced exit
- `lib/clamav-client.ts` — ClamAV INSTREAM protocol over TCP, 8KB chunks, dev-mode fallback (skipped)
- `processors/file-processing-router.ts` — Dispatches `file-processing` queue jobs by name to concrete processors
- `processors/file-thumbnail.ts` — Sharp: auto-rotate EXIF, resize to 200px + 800px WebP, blurhash (4×3), skips >50MP and infected files
- `processors/file-scan.ts` — Streams file to ClamAV; infected → quarantine (copy + delete original + audit log + event)
- `processors/file-orphan-cleanup.ts` — Hard-deletes soft-deleted files >30 days; removes original + thumbnails from storage in batches of 1000

**Upload Endpoints (`apps/web/src/app/api/upload/`):**
- `presign/route.ts` — POST: validates MIME + extension, checks per-plan file size + storage quota, creates `files` row (scanStatus: pending), returns presigned PUT URL (1hr expiry)
- `complete/[fileId]/route.ts` — POST: HEAD object to verify upload, magic byte verification, SVG sanitization, enqueues `file.scan` + `file.thumbnail` jobs, publishes `FILE_UPLOADED` event

**Web Realtime & Queue Clients (`apps/web/src/lib/`):**
- `queue.ts` — Lightweight BullMQ Queue client for web app job enqueueing (lazy-loads, caches per queue name)
- `realtime/client.ts` — Singleton Socket.io client with Clerk JWT auth, exponential backoff reconnection (1s→30s, ±20% jitter)
- `realtime/use-realtime-connection.ts` — React hook: manages connection lifecycle via Clerk auth, tracks connection status
- `realtime/index.ts` — Public exports

**Shared Realtime (`packages/shared/realtime/`):**
- `service.ts` — Transport-agnostic `RealtimeService` interface (joinRoom, leaveRoom, getRoomMembers, emitToRoom, emitToUser, broadcast)
- `publisher.ts` — `createEventPublisher(redis)`: publishes to `realtime:t:{tenantId}:{channel}`, supports `excludeUserId`
- `events.ts` — `REALTIME_EVENTS` constant: 16 event types (record.created/updated/deleted, sync.*, schema.*, file.*, notification.created)
- `types.ts` — PresenceState, RoomMember, RoomMetadata, RoomPattern types

**Shared Redis (`packages/shared/redis/`):**
- `client.ts` — `createRedisClient(name)` / `getRedisConfig()`: ioredis with `maxRetriesPerRequest: null` (BullMQ), `lazyConnect: true`, env-based config
- `index.ts` — Public exports

**Shared Queue (`packages/shared/queue/`):**
- `constants.ts` — `QUEUE_NAMES`: sync, file-processing, email, automation, document-gen, cleanup
- `types.ts` — `BaseJobData` (tenantId, traceId, triggeredBy) + 7 job data types + `QueueJobDataMap` with compile-time exhaustiveness check
- `index.ts` — Public exports

**Shared Storage (`packages/shared/storage/`):**
- `client.ts` — `StorageClient` interface: presignPut, presignGet, delete, deleteMany, headObject, getStream, put
- `r2-client.ts` — `R2StorageClient`: S3-compatible via `@aws-sdk/client-s3` (works with R2 and MinIO)
- `config.ts` — `getStorageConfig()` from env vars (STORAGE_PROVIDER, S3_ACCESS_KEY, etc.), MinIO dev fallback
- `keys.ts` — Tenant-scoped key builders: `fileOriginalKey`, `fileThumbnailKey`, `quarantineKey`, `portalAssetKey`, `docGenOutputKey`, `templateKey`
- `mime.ts` — `ALLOWED_MIME_TYPES` (19 types), `isAllowedMimeType()`, `isAllowedExtension()`, `THUMBNAIL_MIME_TYPES`
- `magic-bytes.ts` — `MAGIC_SIGNATURES` array, `verifyMagicBytes()` (first 8KB), RIFF/MP4/OOXML disambiguation
- `limits.ts` — `FILE_LIMITS` per plan (Freelancer 25MB→Enterprise 500MB), `getFileLimits(planSlug)`
- `sanitize.ts` — `sanitizeFilename()` (path traversal, shell chars, 255 limit), `sanitizeSvg()` (strips scripts, event handlers, javascript: URIs)
- `serve.ts` — `getFileDownloadUrl()` (presigned GET, blocks pending/infected), `getThumbnailUrl()` (CDN URL)
- `audit.ts` — `FILE_AUDIT_ACTIONS` enum, `writeFileAuditLog()` (tracks uploads, scans, quarantines, deletes)
- `index.ts` — Public exports for all storage modules

**Database Schema:**
- `packages/shared/db/schema/files.ts` — `files` table: id, tenantId, uploadedBy, storageKey, originalFilename, mimeType, sizeBytes, checksumSha256, scanStatus (pending/clean/infected/skipped), contextType (record_attachment/smart_doc/doc_gen_output/portal_asset/email_attachment/chat_attachment/template), contextId, thumbnailKey, metadata (JSONB: blurhash, dimensions), createdAt, archivedAt. Indexes on (tenant, context), (tenant, scan_status), archivedAt partial.

**Docker Compose:**
- `docker-compose.yml` — Added MinIO (ports 9000–9001), ClamAV (optional profile), Realtime service, Worker service

**Tests (Phase 1G — 30 test files):**
- `apps/realtime/src/__tests__/socket-io-realtime-service.test.ts` (7 tests)
- `apps/realtime/src/middleware/__tests__/auth.test.ts` (6 tests)
- `apps/realtime/src/handlers/__tests__/room-handler.test.ts` (8 tests)
- `apps/realtime/src/subscribers/__tests__/redis-event-subscriber.test.ts` (9 tests)
- `apps/worker/src/lib/__tests__/base-processor.test.ts`
- `apps/worker/src/lib/__tests__/graceful-shutdown.test.ts`
- `apps/worker/src/processors/__tests__/file-thumbnail.test.ts`
- `apps/worker/src/processors/__tests__/file-scan.test.ts`
- `apps/worker/src/processors/__tests__/file-orphan-cleanup.test.ts`
- `apps/web/src/app/api/upload/__tests__/presign.test.ts`
- `apps/web/src/app/api/upload/__tests__/complete.test.ts`
- `apps/web/src/lib/realtime/__tests__/client.test.ts`
- `packages/shared/realtime/__tests__/publisher.test.ts`
- `packages/shared/realtime/__tests__/types.test.ts`
- `packages/shared/queue/__tests__/constants.test.ts`
- `packages/shared/storage/__tests__/keys.test.ts`
- `packages/shared/storage/__tests__/mime.test.ts`
- `packages/shared/storage/__tests__/magic-bytes.test.ts`
- `packages/shared/storage/__tests__/limits.test.ts`
- `packages/shared/storage/__tests__/sanitize.test.ts`
- `packages/shared/storage/__tests__/serve.test.ts`
- `packages/shared/storage/__tests__/r2-client.test.ts`

**Patterns established:** `BaseProcessor` abstract class for all worker jobs. `createEventPublisher()` for all real-time events. `StorageClient` interface for provider-agnostic storage. Tenant-scoped storage keys (`t/{tenantId}/...`). Magic byte verification on upload complete. ClamAV quarantine flow with audit trail. `setupGracefulShutdown()` for ordered cleanup. 6 BullMQ queues with typed job data. `useRealtimeConnection()` React hook for Socket.io lifecycle.

### Phase 1H — AI Service Layer (Complete)

Provider-agnostic AI abstraction. Feature code uses capability tiers (`fast`/`standard`/`advanced`), never providers or models. `@anthropic-ai/sdk` confined to a single adapter file.

**Core Types & Config (`packages/shared/ai/`):**
- `types.ts` — `CapabilityTier`, `ProviderId`, `AIMessage`, `CompiledAIRequest`, `TokenUsage`, `CreditCost`, `AIResponse`, `AIStreamChunk`, `ToolDefinition`, `AIToolCall`, `AgentConfig`, `EmbeddingProvider`
- `config/routing.ts` — `CAPABILITY_ROUTING`, `FEATURE_ROUTING`, `FALLBACK_CHAINS`, `resolveRoute()`, `resolveRouteByTier()`, `getFallbackChain()`. Maps capability tiers and AI features to provider/model pairs
- `index.ts` — Barrel export (all types, classes, and functions re-exported via `@everystack/shared/ai`)

**Provider Adapters (`packages/shared/ai/providers/`):**
- `adapter.ts` — `AIProviderAdapter` interface: `complete()`, `stream()`, `countTokens()`, `getCapabilities()`
- `anthropic.ts` — `AnthropicAdapter`: wraps `@anthropic-ai/sdk` (the ONLY file that imports it). Supports tool use, structured output, token counting, streaming
- `self-hosted.ts` — `SelfHostedAdapter`: skeleton for OpenAI-compatible self-hosted models (Post-MVP)
- `errors.ts` — `AIProviderError`, `AIProviderAuthError`, `AIProviderRateLimitError`, `AIProviderTimeoutError`

**Prompt System (`packages/shared/ai/prompts/`):**
- `registry.ts` — `PromptRegistry`: stores versioned `PromptTemplate` objects with monotonically increasing versions. `compile()` resolves tier → provider/model → compiler
- `compiler.ts` — `AnthropicPromptCompiler` (XML tags + cache_control), `BasicPromptCompiler` (plain text), `compilerForProvider()` factory
- `templates/` — Directory for versioned prompt template files (empty, ready for feature prompts)

**Tool System (`packages/shared/ai/tools/`):**
- `registry.ts` — `ToolRegistry` with 8 tool stubs in `TOOL_NAMES`: `search_records`, `get_record`, `update_record`, `create_record`, `get_field_options`, `get_linked_records`, `summarize_records`, `suggest_values`. `createDefaultToolRegistry()` factory

**Metering (`packages/shared/ai/metering/`):**
- `features.ts` — `AI_FEATURES` enum: 13 features (natural_language_search, smart_fill, record_summarization, document_ai_draft, field_suggestions, link_suggestions, automation_builder, support_chatbot, smart_categorize, data_validation, anomaly_detection, template_generation, bulk_operations)
- `rates.ts` — `AI_RATES`: per-model token pricing (input/output per 1M tokens), `isKnownModel()`
- `cost-calculator.ts` — `calculateCost()`: tokens × rate → credit cost
- `usage-logger.ts` — `logAIUsage()`: writes to `ai_usage_log` table
- `credit-ledger.ts` — `checkBudget()`, `deductCredits()`, `checkAlertThresholds()`: budget enforcement with 4 alert tiers (50%/75%/90%/100%)

**AIService (`packages/shared/ai/service.ts`):**
- `AIService` singleton: 6-step flow — budget check → route resolution → prompt compile → provider execute → usage log → credit deduct
- `FEATURE_TASK_MAP`: maps AI features to task types for routing
- `AIServiceRequest`/`AIServiceResponse`/`AIServiceContext` types

**Streaming (`packages/shared/ai/streaming/`):**
- `stream-adapter.ts` — `createAIStream()`: wraps provider streaming into Vercel AI SDK `createDataStreamResponse` format
- `ai-job-types.ts` — `AIJobPayload`/`AIJobResult` types for BullMQ async AI jobs
- `index.ts` — Public exports

**Data Contract (`packages/shared/ai/data-contract/`):**
- `canonical-to-ai.ts` — `canonicalToAIContext()`: translates canonical JSONB records into AI-friendly context with field metadata
- `ai-to-canonical.ts` — `aiToCanonical()`: validates and converts AI output back to canonical JSONB format. Returns `AIToCanonicalSuccess | AIToCanonicalError`
- `types.ts` — `AIDataContractFieldType` union, per-field-type configs (`TextFieldConfig`, `NumberFieldConfig`, `SingleSelectFieldConfig`, `CheckboxFieldConfig`)
- `index.ts` — Public exports with type guards (`isAIToCanonicalSuccess`, `isAIToCanonicalError`)

**SSE Route (`apps/web/src/app/api/ai/chat/`):**
- `route.ts` — POST handler: Clerk auth, Zod validation, AIService integration, SSE streaming response

**Tests (Phase 1H — 14 test files, 320+ tests):**
- `packages/shared/ai/__tests__/types.test.ts` (16 tests)
- `packages/shared/ai/__tests__/service.test.ts` (38 tests)
- `packages/shared/ai/config/__tests__/routing.test.ts` (34 tests)
- `packages/shared/ai/providers/__tests__/anthropic.test.ts` (24 tests)
- `packages/shared/ai/providers/__tests__/self-hosted.test.ts` (6 tests)
- `packages/shared/ai/providers/__tests__/errors.test.ts` (7 tests)
- `packages/shared/ai/prompts/__tests__/registry.test.ts` (40 tests)
- `packages/shared/ai/tools/__tests__/registry.test.ts` (20 tests)
- `packages/shared/ai/metering/__tests__/cost-calculator.test.ts` (12 tests)
- `packages/shared/ai/metering/__tests__/usage-logger.test.ts` (10 tests)
- `packages/shared/ai/metering/__tests__/credit-ledger.test.ts` (18 tests)
- `packages/shared/ai/streaming/__tests__/stream-adapter.test.ts` (7 tests)
- `packages/shared/ai/data-contract/__tests__/canonical-to-ai.test.ts` (27 tests)
- `packages/shared/ai/data-contract/__tests__/ai-to-canonical.test.ts` (58 tests)
- `apps/web/src/app/api/ai/chat/__tests__/route.test.ts` (coverage via web test suite)

**Coverage:** config: 100%, metering: 100%, prompts: 100%, data-contract: 96%, tools: 93%, providers: 88%, streaming: 81%.

**Patterns established:** `AIService` singleton for all AI calls. Capability tiers (`fast`/`standard`/`advanced`) — never reference providers in feature code. `PromptRegistry` with versioned templates and provider-specific compilers. `ToolRegistry` with scope-based filtering. Budget check before execution, usage logging after. `canonicalToAIContext()`/`aiToCanonical()` for JSONB ↔ AI translation. `createAIStream()` for SSE responses. `@anthropic-ai/sdk` in exactly one file.

### Phase 1I — Audit Log & Platform API Auth Skeleton (Complete)

Audit logging helper, API key infrastructure, Platform API authentication/rate limiting middleware, error format, and composed middleware pipeline.

**Audit Logging (`packages/shared/db/audit.ts`):**
- `writeAuditLog(tx, entry)` — Single audit entry writer, never fails parent transaction
- `writeAuditLogBatch(tx, entry)` — Batch writer (record ID arrays capped at 1,000 with truncation flag)
- `auditEntrySchema` — Zod validation (actorId required for non-system actors, actorLabel only for api_key type)
- `AUDIT_ACTOR_TYPES` — 7 sources: `user`, `sync`, `automation`, `portal_client`, `system`, `agent`, `api_key`
- `AUDIT_RETENTION_DAYS` — Plan-based: freelancer 30d, starter 90d, professional 365d, business 730d, enterprise ∞

**API Key Utilities (`packages/shared/db/api-key-utils.ts`):**
- `generateApiKey(environment)` — Base62 encoding with rejection sampling on `crypto.randomBytes` (~285 bits entropy, 48 chars)
- `hashApiKey(fullKey)` — SHA-256 hex digest
- `verifyApiKeyHash(fullKey, storedHash)` — Timing-safe comparison via `crypto.timingSafeEqual`
- `apiKeyCreateSchema` — Zod validation schema
- `API_KEY_PREFIXES` — `{ live: 'esk_live_', test: 'esk_test_' }`
- `API_KEY_SCOPES` — `['data:read', 'data:write', 'schema:read', 'schema:write', 'admin']`
- `RATE_LIMIT_TIERS` — 4 tiers: basic (60/min, burst 10), standard (120/min, burst 20), high (600/min, burst 100), enterprise (2000/min, burst 500)

**API Key Data Functions (`apps/web/src/data/api-keys.ts`):**
- `createApiKey(tenantId, userId, input)` — Transactional create + audit log, returns full key once
- `listApiKeys(tenantId)` — Excludes `keyHash` from response (never exposed)
- `revokeApiKey(tenantId, userId, keyId)` — Transactional revoke + audit log
- `getApiKeyByHash(keyHash)` — Cross-tenant lookup by hash (tenant unknown at auth time)

**API Key Server Actions (`apps/web/src/actions/api-keys.ts`):**
- `createApiKeyAction(input)` — Owner/Admin only via `requireRole()`
- `revokeApiKeyAction(keyId)` — Owner/Admin only via `requireRole()`

**Auth Middleware (`apps/web/src/lib/api/auth-middleware.ts`):**
- `authenticateApiKey(request)` → `ApiRequestContext` (tenantId, apiKeyId, scopes, rateLimitTier, actorLabel, requestId)
- `requireScope(context, ...scopes)` — Throws 403 if insufficient (admin scope overrides all)
- `withApiAuth(handler, ...requiredScopes)` — Higher-order wrapper
- Bearer token flow: extract → prefix validate → SHA-256 hash → DB lookup → status/expiry check
- Fire-and-forget `lastUsedAt` update (doesn't block response)
- `X-Actor-Label` header extraction for audit attribution (capped 255 chars)

**Rate Limiter (`apps/web/src/lib/api/rate-limiter.ts`):**
- `checkRateLimit(apiKeyId, tier)` — Per-key token bucket via atomic Redis Lua script
- `checkTenantCeiling(tenantId, highestKeyTier)` — Per-tenant sliding window (ceiling = 3× highest tier)
- `setRateLimitHeaders(response, result)` — X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After
- `setRedisClient(client)` — For test injection
- Sub-integer precision (×1000 scaling), auto-expiring keys, fail-open on Redis errors
- Redis keys: `rate_limit:{apiKeyId}` (hash), `rate_limit_tenant:{tenantId}` (sorted set), `rate_limit_tenant_ceiling:{tenantId}` (cached value, 60s TTL)

**Error Format (`apps/web/src/lib/api/errors.ts`):**
- `apiError(status, code, message, details?, requestId?)` — Generic error builder
- `createApiErrorResponse` — Alias for `apiError`
- 9 convenience helpers: `apiBadRequest`, `apiUnauthorized`, `apiForbidden`, `apiNotFound`, `apiConflict`, `apiValidationError`, `apiPayloadTooLarge`, `apiRateLimited`, `apiInternalError`
- `API_VERSION` = `'2026-03-01'` (date-based), `API_VERSION_HEADER` = `'X-API-Version'`
- Response shape: `{ error: { code, message, details?, request_id? } }` + version header

**Request Logger (`apps/web/src/lib/api/request-logger.ts`):**
- `logApiRequest(entry)` — Fire-and-forget insert to `api_request_log`, never throws
- Records: tenantId, apiKeyId, method, path, statusCode, durationMs, requestSize, responseSize

**Composed Middleware (`apps/web/src/lib/api/middleware.ts`):**
- `withPlatformApi(handler, ...requiredScopes)` — Single entry point for all Platform API handlers
- Pipeline: auth → scope check → per-key rate limit → tenant ceiling → version header → rate limit headers → handler → request logging → error mapping
- Error mapping: AppError → typed API response, unhandled → 500 with Sentry capture + requestId

**Health Endpoint (`apps/web/src/app/api/v1/route.ts`):**
- `GET /api/v1/` — Returns `{ api: "everystack", version: "v1", status: "ok" }` + version header, no auth required

**Migrations:**
- `0019_make_audit_log_actor_id_nullable.sql` — `ALTER TABLE audit_log ALTER COLUMN actor_id DROP NOT NULL` (for system actor type)
- `0020_add_clerk_org_id_to_tenants.sql` — `ALTER TABLE tenants ADD COLUMN clerk_org_id varchar(255)` + unique index

**Shared package exports updated:**
- `@everystack/shared/db` — Added: `writeAuditLog`, `writeAuditLogBatch`, `auditEntrySchema`, `AUDIT_ACTOR_TYPES`, `AUDIT_RETENTION_DAYS`, `API_KEY_PREFIXES`, `API_KEY_SCOPES`, `RATE_LIMIT_TIERS`, `generateApiKey`, `hashApiKey`, `verifyApiKeyHash`, `apiKeyCreateSchema`

**Tests (Phase 1I — 7 test files, 139 tests):**
- `packages/shared/db/audit.test.ts` (21 tests)
- `packages/shared/db/api-key-utils.test.ts` (32 tests)
- `apps/web/src/data/__tests__/api-keys.integration.test.ts` (7 tests)
- `apps/web/src/lib/api/auth-middleware.test.ts` (22 tests)
- `apps/web/src/lib/api/rate-limiter.test.ts` (17 tests)
- `apps/web/src/lib/api/errors.test.ts` (35 tests)
- `apps/web/src/lib/api/request-logger.test.ts` (5 tests)

**Patterns established:** `writeAuditLog()` in same transaction as mutations. API keys shown once at creation, SHA-256 hashed for storage. Bearer token auth with timing-safe verification. Two-level rate limiting (per-key token bucket + per-tenant ceiling). Fail-open on Redis errors. `withPlatformApi()` as single entry point for API routes. Fire-and-forget request logging. Date-based API versioning (`2026-03-01`).

### Phase 1J — CP Migration, Multi-Tenant Auth & Navigation Shell (Complete)

CP-001/CP-002 schema migrations, multi-tenant identity (personal tenants, agency relationships, effective memberships), tenant switching (Clerk+Redis hybrid), sidebar navigation shell with contextual clarity signals.

**Migrations (3 new — 0021, 0022, 0023):**
- `0021_cp001_portal_thread_refinements.sql` — Portal slug uniqueness scoped to tenant (`UNIQUE(tenant_id, slug)`), portal access revocation tracking (`revoked_at`, `revoked_reason`, `record_slug`, `linked_record_id`), threads `visibility` → `thread_type` (varchar 50, default 'internal'), unique constraint on `(scope_type, scope_id, thread_type)`
- `0022_cp002_multi_tenant_identity.sql` — `users.personal_tenant_id` (uuid FK), workspace transfer stubs (`transferred_from_tenant_id`, `original_created_by_tenant_id`), new `tenant_relationships` table (agency-client relationships with `relationship_type`, `status`, `access_level`, `initiated_by`, `agency_billing_responsible`, `metadata` JSONB), RLS with OR clause (both agency and client can see rows)
- `0023_effective_memberships_view.sql` — `effective_memberships` SQL view: UNION ALL of direct `tenant_memberships` + agency access via `tenant_relationships` join. Columns: `userId`, `tenantId`, `role`, `source` ('direct'|'agency'), `agencyTenantId`

**New Schema Files:**
- `packages/shared/db/schema/tenant-relationships.ts` — Agency-client relationships table. All string columns VARCHAR (not ENUM). Relationship types: 'managed'|'white_label'|'reseller'|'referral'. Status: 'pending'|'active'|'suspended'|'revoked'. Access levels: 'admin'|'builder'|'read_only'. Drizzle relations to agency/client tenants, authorizedBy/revokedBy users
- `packages/shared/db/schema/effective-memberships.ts` — `pgView('effective_memberships').existing()` — TypeScript typing only (DDL in migration). Exports `EffectiveMembership` type

**Modified Schema Files:**
- `portals.ts` — Slug index changed from global unique to tenant-scoped `UNIQUE(tenant_id, slug)`
- `portal-access.ts` — Added `revokedAt`, `revokedReason`, `recordSlug` (client-safe, never exposes raw UUID), `linkedRecordId`
- `threads.ts` — Replaced `visibility` with `threadType` (varchar 50, default 'internal'). Known values: 'internal'|'client'
- `users.ts` — Added `personalTenantId` (uuid FK → tenants, ON DELETE SET NULL) with index
- `workspaces.ts` — Added `transferredFromTenantId`, `originalCreatedByTenantId` (post-MVP transfer stubs)
- `rls.ts` — Added `tenant_relationships` to tenant-scoped tables (48 total now). OR-clause RLS policy for agency+client visibility

**Database Operations (`packages/shared/db/operations/`):**
- `effective-memberships.ts` — `getEffectiveMemberships(userId)` (all accessible tenants), `getEffectiveMembershipForTenant(userId, tenantId)` (specific tenant check). Cross-tenant by design, uses `dbRead`
- `user-operations.ts` — `createUserWithTenant()` updated: no longer sets `personalTenantId` directly (set via webhook handler)

**DB Exports (`packages/shared/db/index.ts`):**
- Added: `effectiveMemberships` view, `EffectiveMembership` type, `getEffectiveMemberships()`, `getEffectiveMembershipForTenant()`

**Auth Layer (`apps/web/src/lib/auth/`):**
- `effective-membership.ts` — `resolveUserAccess(userId, tenantId)` → `ResolvedUserAccess` (role, source, agencyTenantId). `resolveUserTenants(userId)` → deduplicated tenant ID array. Agency access_level mapping: admin→admin, builder→member, read_only→viewer. Direct memberships take precedence
- `personal-tenant.ts` — `provisionPersonalTenant(userId, userName)` (idempotent, creates tenant+membership, sets `users.personal_tenant_id`). `isPersonalTenant(tenantId, userId)`. `hasPersonalWorkspace(tenantId)` (sidebar display rule: hidden until ≥1 workspace). `PERSONAL_TENANT_ACCENT_COLOR` = '#78716C' (warm neutral, fixed, never reused by org tenants)
- `tenant-switch.ts` — Clerk+Redis hybrid model. `switchTenant(userId, targetTenantId)` → `TenantSwitchResult` (validates access, fetches tenant, updates Redis cache 24h TTL, returns clerkOrgId for client `setActive()`). `getActiveTenant(userId)` (Redis cache first, Clerk fallback). `invalidateTenantCache(userId)` (client revert path). Redis key: `active_tenant:{userId}`. All Redis failures non-fatal

**Auth Context (`apps/web/src/lib/`):**
- `auth-context.ts` — `getAuthContext()` now returns `agencyTenantId: string | null` in `ResolvedAuthContext` (non-null when accessing via agency relationship)
- `tenant-resolver.ts` — `resolveUser()` now resolves all accessible tenants via `resolveUserTenants()` (direct+agency). `resolveTenant()` verifies effective access via `resolveUserAccess()`, logs agency access. Returns `ResolvedTenant` with optional `agencyTenantId`. 404 (not 403) on access denial to prevent tenant enumeration

**Server Actions (`apps/web/src/actions/`):**
- `tenant-switch.ts` — `switchTenantAction(targetTenantId)` (Zod validation, calls `switchTenant()`, writes audit log with `action: 'tenant.switched'`, returns `TenantSwitchResult`). `invalidateTenantCacheAction()` (Redis cache deletion for client revert path)

**Data Functions (`apps/web/src/data/`):**
- `sidebar-navigation.ts` — `getSidebarNavigation(userId, activeTenantId)` → `SidebarNavigation` (tenants + portals). Cross-tenant aggregation via `dbRead`. Role-aware workspace filtering (Owner/Admin see all, Members only explicit memberships). Board grouping. Personal tenants sorted first, hidden if empty. Portal entries via user email (active, non-revoked). Types: `SidebarNavigation`, `TenantNavSection`, `BoardNavGroup`, `WorkspaceNavEntry`, `PortalNavEntry`

**Shell Components (`apps/web/src/components/shell/`):**
- `ShellAccentProvider.tsx` — React Context for `--shell-accent` CSS variable. `useShellAccent()` hook: `shellAccent`, `setShellAccent()`, `revertShellAccent()`, `applyTenantAccent()`. Syncs to `:root` CSS property. Personal tenant → warm neutral, org tenant → configured accent or default Teal
- `SidebarHeader.tsx` — Signal 1 of Contextual Clarity. Sticky header with avatar + tenant name + qualifier ("Personal" or org name). Uses Clerk `useUser()` for avatar. Collapsed: avatar only (32px). Expanded: avatar (36px) + name
- `TenantSwitcher.tsx` — Orchestrates 5-step optimistic switching: (1) repaint accent + expand target, (2) `switchTenantAction()`, (3) Clerk `setActive()`, (4) `router.refresh()`, (5) on failure: revert accent, show error toast, invalidate Redis cache. Prevents concurrent switches
- `TenantSection.tsx` — Expandable tenant node: accent dot + name + chevron. Active tenants start expanded. Renders "My Office" entry + WorkspaceTree. Click on inactive tenant triggers switch callback
- `WorkspaceTree.tsx` — Renders boards (collapsible groups) + ungrouped workspaces. Active workspace: white left border + bold. Board headers: uppercase muted text
- `PortalSection.tsx` — Portal entries below divider. Globe icon + system accent (#64748B, non-customizable). Portal name + tenant qualifier. Links to `/portal/{portalSlug}`. Hidden when no portals
- `MyOfficeHeading.tsx` — Signal 3 of Contextual Clarity. Personal: "My Office · Personal". Org: "My Office · {tenantName}"

**Design System (`apps/web/src/lib/design-system/`):**
- `shell-accent.ts` — `PERSONAL_TENANT_ACCENT` (#78716C), `PORTAL_ACCENT` (#64748B), `ORG_ACCENT_OPTIONS` (8 curated colors), `DEFAULT_ACCENT_COLOR` (#0D9488 Teal). `getShellAccent(tenantId, isPersonal, accentColor?)` computes correct accent. `isValidAccentColor(hex)` validates against curated set. All org colors ≥3:1 WCAG AA contrast on dark sidebar

**Layout Changes:**
- `sidebar.tsx` — Major rewrite: Icon Rail (48px, always visible: Home/Tasks/Chat/Calendar top, Toggle/Help/Avatar bottom) + Content Zone (232px, only when expanded: SidebarHeader + TenantSwitcher + PortalSection). Responsive: hidden on mobile, flex on tablet+
- `header.tsx` — Background now uses `--shell-accent` CSS variable with 150ms transition. Command bar placeholder (300px). Responsive mobile/desktop layout
- `app-shell.tsx` — Accepts `navData?: SidebarNavigation | null` prop for sidebar

**CSS (`globals.css`):**
- New CSS variables: `--shell-accent` (#0D9488 default), `--portal-accent` (#64748B), `--personal-accent` (#78716C)
- Touch target utilities: `.touch-target` (44×44), `.touch-target-lg` (48×48), `.touch-target-primary` (56×56)

**UI Primitives:**
- `apps/web/src/components/ui/sonner.tsx` — Sonner toast component (17 shadcn/ui components total now)

**i18n (en.json + es.json):**
- New keys: `shell.sidebar.*` (myOfficeQualified, myOfficePersonal, personalQualifier, currentWorkspace, portals, noWorkspaces, switchError, portalNavigate), `shell.header.*` (commandBarPlaceholder, commandBarShortcut, search), `my_office.*` (heading_personal, heading_org)

**Factories (`packages/shared/testing/factories.ts`):**
- New: `createTestTenantRelationship()` — auto-creates agency+client tenants, defaults: managed/active/builder/agency-initiated. 20 factories total
- Updated: `createTestPortalAccess()` now includes `recordSlug`. `createTestThread()` uses `threadType` (was `visibility`)

**Tests (Phase 1J — 14 new test files, ~192 tests):**
- `apps/web/src/components/shell/__tests__/PortalSection.test.tsx` (11 tests)
- `apps/web/src/components/shell/__tests__/ShellAccentProvider.test.tsx` (10 tests)
- `apps/web/src/components/shell/__tests__/TenantSection.test.tsx` (10 tests)
- `apps/web/src/components/shell/__tests__/TenantSwitcher.test.tsx` (12 tests)
- `apps/web/src/components/shell/__tests__/WorkspaceTree.test.tsx` (6 tests)
- `apps/web/src/components/shell/__tests__/contextual-clarity.test.tsx` (25 tests)
- `apps/web/src/data/__tests__/sidebar-navigation.integration.test.ts` (7 tests)
- `apps/web/src/lib/auth/__tests__/effective-membership.test.ts` (12 tests)
- `apps/web/src/lib/auth/__tests__/personal-tenant.test.ts` (15 tests)
- `apps/web/src/lib/auth/__tests__/tenant-switch.test.ts` (9 tests)
- `apps/web/src/lib/design-system/shell-accent.test.ts` (20 tests)
- `packages/shared/db/operations/effective-memberships.test.ts` (4 tests)
- `packages/shared/db/operations/__tests__/effective-memberships.integration.test.ts` (8 tests)
- Updated: `auth-flow.integration.test.ts`, `role-check.integration.test.ts`, `webhook-user-created.integration.test.ts`, `sidebar.test.tsx`

**Patterns established:** CP-001/CP-002 schema migrations. `effective_memberships` SQL view for unified direct+agency access. `resolveUserAccess()` / `resolveUserTenants()` for auth resolution. Clerk+Redis hybrid tenant switching (server validates → Redis cache → client `setActive()`). Personal tenant auto-provisioning via Clerk webhook (idempotent). Three Contextual Clarity signals (SidebarHeader, shell accent, MyOfficeHeading). `ShellAccentProvider` React Context for `--shell-accent` CSS variable repainting. Optimistic tenant switch with revert-on-failure. Shell accent: 8 curated org colors + fixed personal (#78716C) + fixed portal (#64748B). Cross-tenant sidebar aggregation via `dbRead`. Role-aware workspace visibility. Board grouping. 404 (not 403) on cross-tenant access denial.

### Scope Updates (PR #13 — docs/scope-updates)

Schema expansions, personal tenant provisioning, Platform Owner Console, Support System, and comprehensive naming/convention audit.

**New schemas (9 tables):**
- `packages/shared/db/schema/support-requests.ts` — Support tickets with priority/status/category
- `packages/shared/db/schema/support-request-messages.ts` — Threaded messages on support requests
- `packages/shared/db/schema/ai-support-sessions.ts` — AI support session audit trail
- `packages/shared/db/schema/feature-requests.ts` — Aggregated feature request log
- `packages/shared/db/schema/admin-impersonation-sessions.ts` — "View as Tenant" admin sessions
- `packages/shared/db/schema/tenant-feature-flags.ts` — Per-tenant feature flag overrides
- `packages/shared/db/schema/tenant-enterprise-config.ts` — Enterprise SLA config
- `packages/shared/db/schema/platform-notices.ts` — Platform-wide announcements
- `packages/shared/db/schema/user-dismissed-notices.ts` — User notice dismissal tracking

**New migrations (4):**
- `0015_update_thread_participants_for_external_contacts.sql` — `participant_type`, `external_contact_id` columns, identity check constraint
- `0016_platform_owner_console.sql` — Platform Owner Console tables + tenant billing columns
- `0017_support_system.sql` — Support System tables
- `0018_rename_indexes_consistency.sql` — Index naming consistency pass

**Schema modifications:**
- `tenants.ts` — Added billing/subscription columns (`stripe_customer_id`, `subscription_status`, `trial_ends_at`, `plan_override`, `support_tier`), churn tracking (`churn_risk_flag`, `first_active_at`, `last_active_at`, `admin_notes`), `is_internal` flag
- `users.ts` — Added `is_platform_admin`, `is_support_agent` boolean columns
- `thread-participants.ts` — Made `user_id` nullable, added `participant_type` + `external_contact_id` for external contacts

**Key logic changes:**
- `user-operations.ts` — `createUserWithTenant()` creates initial tenant + membership (personal tenant provisioning now handled by `provisionPersonalTenant()` in Phase 1J).
- `rls.ts` — Updated to 48 tenant-scoped tables (47 standard + `tenant_relationships` OR-clause in 1J). Added `RLS_EXCLUDED_COLUMNS` (hides `is_platform_admin`, `is_support_agent` from tenant queries). Documented 6 admin-only tables that intentionally skip RLS.

**New reference docs:**
- `docs/reference/platform-owner-console.md` — Full spec for platform admin dashboard
- `docs/reference/support-system.md` — 3-tier support architecture (AI → human → admin escalation)

**Audit fixes (commit 175468c):**
- Naming conventions standardized across all reference docs
- Schema drift corrections between Drizzle schemas and data-model.md
- RLS documentation aligned with actual policies
- Scope labels standardized (no more phase numbers in reference docs)

### Phase 2A — FieldTypeRegistry, Canonical Transform Layer, Airtable Adapter (Complete)

FieldTypeRegistry singleton, 60+ canonical value types, complete Airtable adapter (32 field types across 10 transform modules), OAuth PKCE flow, filter pushdown, proactive rate limiting, quota enforcement, token encryption, sync worker processors, setup wizard UI, and sync filter management.

**Sync Core (`packages/shared/sync/`):**
- `field-registry.ts` — `FieldTypeRegistry` class: singleton registry mapping `{platform}:{fieldType}` → `FieldTransform`. Methods: `register()`, `get()`, `has()`, `getAllForPlatform()`, `getSupportedFieldTypes()`, `clear()`, `size`. Exported singleton: `fieldTypeRegistry`
- `types.ts` — Canonical value types (9 categories, 60+ variants), filter grammar (`FilterOperator` 15 operators, `FilterRule`, Zod schemas), `SyncConfig`/`SyncTableConfig` (stored in `base_connections.sync_config` JSONB), `FieldTransform` interface (`toCanonical()`, `fromCanonical()`, `isLossless`, `supportedOperations`), `RecordSyncMetadata`, `PlatformFieldConfig`, `SourceRefs`, `SyncPlatform`
- `quota.ts` — Plan-based record quota enforcement with Redis caching (60s TTL). `PLAN_QUOTAS` (Freelancer 10K → Enterprise ∞). 3 enforcement points: `canSyncRecords()` (preventive), `enforceQuotaOnBatch()` (runtime partial acceptance), `canCreateRecord()` (single). Cache mutation: `incrementQuotaCache()`/`decrementQuotaCache()`. `checkRecordQuota()` main interface
- `rate-limiter.ts` — Redis-backed sliding-window rate limiter with atomic Lua scripts. `RateLimiter` class: `checkLimit()`, `waitForCapacity()` (blocks with exponential backoff). `AIRTABLE_RATE_LIMITS`: per_base 5/sec, per_api_key 50/sec. Retry strategy: 5 max, 200ms base, 30s max, 2× backoff. Fail-open on Redis errors. Exported singleton: `rateLimiter`
- `index.ts` — Barrel exports: all types, schemas, registry, adapter types, rate limiter, quota, Airtable adapter + OAuth + API client + filter pushdown

**Adapter Types (`packages/shared/sync/adapters/types.ts`):**
- `PlatformAdapter` interface: `platform`, `toCanonical()`, `fromCanonical()`
- `FieldMapping`: Maps ES field UUID ↔ platform field ID/type (`fieldId`, `externalFieldId`, `fieldType`, `externalFieldType`, `config`)
- `RateLimit`, `RetryStrategy`, `PlatformRateLimits` types

**Airtable Adapter (`packages/shared/sync/adapters/airtable/`):**
- `index.ts` — `AirtableAdapter` class implementing `PlatformAdapter`. `registerAirtableTransforms()` registers all 10 transform bundles at app startup. Delegates transforms to registry; skips unregistered types with warning (never crashes)
- `api-client.ts` — `AirtableApiClient` class: `listRecords()` (paginated, `returnFieldsByFieldId=true`), `getRecord()`, `listFields()`. Rate-limited via `rateLimiter.waitForCapacity()` before every fetch. Zod-validated responses
- `oauth.ts` — OAuth 2.0 PKCE flow: `generateCodeVerifier()`, `generateCodeChallenge()`, `getAirtableAuthUrl()`, `exchangeCodeForTokens()`, `refreshAirtableToken()`. Metadata: `listAirtableBases()`, `listAirtableTables()`, `estimateAirtableRecordCount()` (pages up to 5×100). Scopes: `data.records:read data.records:write schema.bases:read schema.bases:write`
- `filter-pushdown.ts` — `translateFilterToFormula()` (FilterRule[] → Airtable formula string), `applyLocalFilters()` (post-fetch fallback), `getLocalOnlyFilters()`, `canPushDown()`. 14 pushable operators, 1 local-only (`is_within`)

**Airtable Transform Modules (10 files, each exports `AIRTABLE_*_TRANSFORMS` array):**
- `text-transforms.ts` — `singleLineText` → `TextValue`, `multilineText` → `TextAreaValue`, `richText` → `SmartDocValue` (lossy: Markdown ↔ TipTap JSON with `markdownToTipTap()`/`tipTapToMarkdown()`)
- `number-transforms.ts` — `number` → `NumberValue`, `currency` → `CurrencyValue`, `percent` → `PercentValue`, `rating` → `RatingValue`, `duration` → `DurationValue` (seconds → minutes), `progress` → `ProgressValue`, `autoNumber` → `AutoNumberValue` (read-only)
- `selection-transforms.ts` — `singleSelect` → `SingleSelectValue`, `multipleSelects` → `MultipleSelectValue`, `status` → `StatusValue` (resolves category from config), `tag` → `TagValue`. Option resolution by label with `source_refs.airtable` for lossless round-trip. Unrecognized values get placeholder option IDs (`es_opt_unsynced_{hash}`)
- `date-transforms.ts` — `date`/`dateTime` → `DateValue`, `dateRange` → `DateRangeValue`, `dueDate` → `DueDateValue`, `time` → `TimeValue`, `createdTime` → `CreatedAtValue`, `lastModifiedTime` → `UpdatedAtValue` (both read-only). Timezone normalization from field config
- `people-contact-transforms.ts` — `collaborator` → `PeopleValue`, `createdBy` → `CreatedByValue`, `lastModifiedBy` → `UpdatedByValue` (both read-only), `email` → `EmailValue`, `phoneNumber` → `PhoneValue`, `url` → `UrlValue`, `address` → `AddressValue` (lossy: heuristic CSV parsing), `fullName` → `FullNameValue` (lossy: heuristic prefix/suffix detection), `social` → `SocialValue` (domain-based platform detection)
- `boolean-interactive-transforms.ts` — `checkbox` → `CheckboxValue` (Airtable undefined → false), `button` → `ButtonValue` (read-only). Checklist/signature intentionally NOT registered (EveryStack-only)
- `files-transforms.ts` — `multipleAttachments` → `FilesValue` (partial lossless). Best thumbnail selection (large → full → small). `source_refs.airtable = attachment.id` for round-trip
- `relational-transforms.ts` — `multipleRecordLinks` → `LinkedRecordValue`. Uses `fieldConfig.options.recordIdMap` for Airtable → ES UUID mapping. Unmapped records: `record_id = null`, `filtered_out = true` (per sync-engine.md § Cross-Links to Filtered-Out Records)
- `identification-transforms.ts` — `barcode` → `BarcodeValue` (lossless: unwrap/wrap `{text}`)
- `lossy-transforms.ts` — `lookup`/`rollup`/`formulaField`/`count` → `TextValue` (read-only, lossy). Arrays comma-joined. `fromCanonical()` returns undefined. Per CLAUDE.md: "Never sync computed fields back to platforms"

**Token Encryption (`packages/shared/crypto/`):**
- `token-encryption.ts` — AES-256-GCM encryption for OAuth tokens in `base_connections.oauth_tokens` JSONB. `encryptTokens()`, `decryptTokens()`. 12-byte IV, 16-byte auth tag, version field (=1) for future algorithm migration. Key from `TOKEN_ENCRYPTION_KEY` env var (64-char hex). `EncryptedPayloadSchema` Zod validation
- `index.ts` — Re-exports: `encryptTokens`, `decryptTokens`, `EncryptedPayloadSchema`, `EncryptedPayload` type

**Worker Processors (`apps/worker/src/processors/sync/`):**
- `initial-sync.ts` — `InitialSyncProcessor` extends `BaseProcessor<InitialSyncJobData>`. 3-phase sync: schema sync → paginated record fetch with `AirtableApiClient` + `AirtableAdapter.toCanonical()` → quota enforcement via `enforceQuotaOnBatch()`. Emits 5 realtime events: `SYNC_STARTED`, `SYNC_SCHEMA_READY`, `SYNC_PROGRESS`, `SYNC_COMPLETED`, `SYNC_FAILED`
- `schema-sync.ts` — `syncSchema()` helper (not a separate processor): creates ES tables + fields + `synced_field_mappings` per enabled table. `AIRTABLE_TO_CANONICAL_TYPE` static map (32 Airtable types → canonical). `remapFilterFieldIds()` translates Airtable fldXxx → ES UUIDs in filter rules. Returns `{ tableMap, updatedSyncConfig }`
- `orphan-detection.ts` — `detectAndProcessOrphans()`: 6-step pipeline — load local records → fetch IDs matching current filter → diff → verify candidates against Airtable API (batch of 5) → mark orphaned (`sync_status: 'orphaned'`, `orphaned_reason: 'filter_changed'`) or soft-delete (platform-deleted) → decrement quota cache → emit `SYNC_RECORDS_ORPHANED`

**Worker Index (`apps/worker/src/index.ts`):**
- Added `InitialSyncProcessor` import, instantiation with `eventPublisher`, `.start()` call, and shutdown handler

**Server Actions (`apps/web/src/actions/`):**
- `sync-connections.ts` — `initiateAirtableConnection()` (PKCE state + code verifier in Redis 10min TTL, returns auth URL), `completeAirtableConnection()` (token exchange, encrypt, create connection + audit log), `listBasesForConnection()` (auto-refresh if <5min to expiry), `selectBaseForConnection()`. Admin + 'connection' resource permissions
- `sync-setup.ts` — `listTablesInBase()`, `fetchEstimatedRecordCount()`, `checkQuotaForSync()`, `saveSyncConfigAndStartSync()` (saves config, re-validates quota, enqueues `sync.initial` job). Shared `resolveAccessToken()` helper
- `sync-filters.ts` — `updateSyncFilter()` (stores `previous_sync_filter` for undo, re-validates quota, enqueues re-sync), `enableSyncTable()`, `disableSyncTable()`, `estimateFilteredRecordCount()` (translates FilterRule[] → Airtable formula via field mappings). Admin + 'connection' permissions
- `sync-orphans.ts` — `deleteOrphanedRecords()` (soft-delete + decrement quota cache), `keepOrphanedRecordsAsLocal()` (dismiss banner), `undoFilterChange()` (revert to `previous_sync_filter`, reset orphan markers, enqueue re-sync). Admin + 'record' permissions

**Data Functions (`apps/web/src/data/`):**
- `sync-connections.ts` — `getConnectionsForTenant()` (never includes tokens), `getConnectionById()`, `getConnectionWithTokens()` (internal only), `createConnection()`, `updateConnectionBase()`, `updateConnectionTokens()`. Types: `ConnectionListItem`, `ConnectionDetail`, `ConnectionWithTokens`. All tenant-scoped, transactional writes with audit logging
- `sync-setup.ts` — `getSyncConfig()`, `updateSyncConfig()` (transactional + audit log with tableCount/pollingInterval)

**OAuth Callback (`apps/web/src/app/api/oauth/airtable/callback/route.ts`):**
- Handles Airtable OAuth redirect: reads `code` + `state`, exchanges tokens, renders HTML with `postMessage({ type: 'airtable_oauth_complete', connectionId })` to popup opener. Fallback: redirect with query param. Error: `airtable_oauth_error` postMessage

**Sync Components (`apps/web/src/components/sync/`):**
- `SyncSetupWizard.tsx` — 3-step Dialog wizard ("Wizard Create" pattern): Step 1 (OAuth popup via `window.open()` + `postMessage` listener), Step 2 (base selection with permission badges), Step 3 (table selection with per-table checkboxes, lazy record count fetching, inline SyncFilterBuilder, quota progress bar, large table warning >10K). `useReducer` with discriminated actions. StepIndicator sub-component
- `SyncFilterBuilder.tsx` — Reusable filter builder. Props: `fields`, `filters`, `onChange`, `mode` ('platform' | 'es'). FIELD_TYPE_OPERATORS Map (not switch) for 6 field type categories. Per-row: conjunction AND/OR, field selector, operator selector, value input. VALUE_FREE_OPERATORS Set for operators without values
- `SyncFilterEditor.tsx` — Post-setup filter editing panel. Embeds SyncFilterBuilder (mode="es"). Debounced estimation (500ms). Quota display with remaining/overage. Save & Re-sync button
- `FilteredOutLinkChip.tsx` — Display-only badge for cross-linked records outside sync filter. Truncates at 24 chars. Filter icon + opacity-50. Tooltip: "This record exists on {platform} but is outside your sync filter"
- `OrphanBanner.tsx` — Alert banner for orphaned records. Amber warning style (`role="alert"`). 3 actions: Delete, Keep as Local-Only, Undo Filter Change
- `OrphanRowIndicator.tsx` — CloudOff icon + tooltip for orphaned grid rows. Exports `ORPHAN_ROW_CLASS` constant for row-level muting

**UI Primitives:**
- `apps/web/src/components/ui/checkbox.tsx` — shadcn/ui Checkbox (Radix UI). 18 shadcn/ui components total

**Queue Types (`packages/shared/queue/types.ts`):**
- Added `InitialSyncJobData` (extends `SyncJobData` + `workspaceId`). `QueueJobDataMap.sync` now accepts `SyncJobData | InitialSyncJobData`

**Realtime Events (`packages/shared/realtime/events.ts`):**
- Added 7 sync events: `SYNC_STARTED`, `SYNC_SCHEMA_READY`, `SYNC_PROGRESS`, `SYNC_BATCH_COMPLETE`, `SYNC_COMPLETED`, `SYNC_FAILED`, `SYNC_RECORDS_ORPHANED`. 23 event types total

**DB Exports (`packages/shared/db/index.ts`):**
- Added: `syncedFieldMappings` table, `syncedFieldMappingsRelations`, `SyncedFieldMapping` type, `NewSyncedFieldMapping` type

**Mock APIs (`packages/shared/testing/mock-apis.ts`):**
- Enhanced Airtable handlers: OAuth token exchange/refresh, list bases, list tables with realistic field metadata (singleLineText, email, singleSelect, date, currency). Support for `returnFieldsByFieldId=true`

**Environment Variables (`.env.example`):**
- `AIRTABLE_CLIENT_ID`, `AIRTABLE_CLIENT_SECRET` — Airtable OAuth app credentials
- `TOKEN_ENCRYPTION_KEY` — AES-256-GCM key (64-char hex, generate with `crypto.randomBytes(32).toString('hex')`)

**i18n (`en.json` + `es.json`):**
- New namespaces: `sync_wizard` (28 keys: title, steps, buttons, errors), `sync_filter_editor` (10 keys: status, estimation, quota, actions), `sync_orphans` (6 keys: banner message with plural, action buttons, tooltips)

**Tests (Phase 2A — 31 test files, ~774 tests):**
- `packages/shared/sync/__tests__/field-registry.test.ts` (21 tests)
- `packages/shared/sync/__tests__/quota.test.ts` (33 tests)
- `packages/shared/sync/__tests__/rate-limiter.test.ts` (25 tests)
- `packages/shared/crypto/token-encryption.test.ts` (15 tests)
- `packages/shared/sync/adapters/airtable/__tests__/airtable-adapter.test.ts` (20 tests)
- `packages/shared/sync/adapters/airtable/__tests__/api-client.test.ts` (11 tests)
- `packages/shared/sync/adapters/airtable/__tests__/oauth.test.ts` (24 tests)
- `packages/shared/sync/adapters/airtable/__tests__/filter-pushdown.test.ts` (58 tests)
- `packages/shared/sync/adapters/airtable/__tests__/text-transforms.test.ts` (39 tests)
- `packages/shared/sync/adapters/airtable/__tests__/number-transforms.test.ts` (47 tests)
- `packages/shared/sync/adapters/airtable/__tests__/selection-transforms.test.ts` (48 tests)
- `packages/shared/sync/adapters/airtable/__tests__/date-transforms.test.ts` (55 tests)
- `packages/shared/sync/adapters/airtable/__tests__/people-contact-transforms.test.ts` (113 tests)
- `packages/shared/sync/adapters/airtable/__tests__/boolean-interactive-transforms.test.ts` (24 tests)
- `packages/shared/sync/adapters/airtable/__tests__/files-transforms.test.ts` (14 tests)
- `packages/shared/sync/adapters/airtable/__tests__/relational-transforms.test.ts` (19 tests)
- `packages/shared/sync/adapters/airtable/__tests__/identification-transforms.test.ts` (15 tests)
- `packages/shared/sync/adapters/airtable/__tests__/lossy-transforms.test.ts` (16 tests)
- `apps/worker/src/processors/sync/__tests__/initial-sync.test.ts` (8 tests)
- `apps/worker/src/processors/sync/__tests__/schema-sync.test.ts` (6 tests)
- `apps/worker/src/processors/sync/__tests__/orphan-detection.test.ts` (10 tests)
- `apps/web/src/actions/__tests__/sync-filters.test.ts` (11 tests)
- `apps/web/src/actions/__tests__/sync-orphans.test.ts` (9 tests)
- `apps/web/src/data/__tests__/sync-connections.integration.test.ts` (15 tests)
- `apps/web/src/data/__tests__/sync-setup.integration.test.ts` (9 tests)
- `apps/web/src/components/sync/__tests__/SyncSetupWizard.test.tsx` (15 tests)
- `apps/web/src/components/sync/__tests__/SyncFilterBuilder.test.tsx` (8 tests)
- `apps/web/src/components/sync/__tests__/SyncFilterEditor.test.tsx` (11 tests)
- `apps/web/src/components/sync/__tests__/FilteredOutLinkChip.test.tsx` (6 tests)
- `apps/web/src/components/sync/__tests__/OrphanBanner.test.tsx` (7 tests)

**Shared package exports added in 2A:**
- `@everystack/shared/sync` — FieldTypeRegistry, fieldTypeRegistry, all canonical value types, FilterOperator, FilterRule, SyncConfig, SyncTableConfig, FieldTransform, PlatformAdapter, FieldMapping, RateLimiter, rateLimiter, AIRTABLE_RATE_LIMITS, quota functions, AirtableAdapter, registerAirtableTransforms, filter pushdown utilities, AirtableApiClient, Airtable OAuth functions, AirtableTokens, AirtableBase, AirtableTableMeta, AirtableFieldMeta
- `@everystack/shared/crypto` — encryptTokens, decryptTokens, EncryptedPayloadSchema, EncryptedPayload
- `@everystack/shared/db` — syncedFieldMappings, syncedFieldMappingsRelations, SyncedFieldMapping, NewSyncedFieldMapping

**Patterns established:** FieldTypeRegistry singleton for all field type operations (no switch statements). Canonical JSONB discrimination via `{ type, value }` objects. `isLossless` flag on transforms for sync algorithm decisions. `supportedOperations` array declaring read/write/filter/sort capabilities. `source_refs` for platform-native ID preservation (lossless round-tripping). Filter pushdown optimization (push to platform formula vs. local fallback). Proactive rate limiting via `rateLimiter.waitForCapacity()` before every API call. Redis-cached quota with INCRBY/DECRBY mutations. AES-256-GCM token encryption with versioning. PKCE OAuth flow with Redis state + popup `postMessage` communication. `registerAirtableTransforms()` called once at startup. `resolveAccessToken()` shared helper with 5-min auto-refresh threshold. `previous_sync_filter` tracking for undo support. Orphan detection 6-step pipeline with verification against platform API. `AIRTABLE_TO_CANONICAL_TYPE` static map for schema sync. `FIELD_TYPE_OPERATORS` Map (not switch) in filter builder UI.

### Phase 2B — Synced Data Performance, Outbound Sync, Conflict Resolution (Complete)

Performance optimizations, outbound (bidirectional) sync, and conflict resolution UX.

**Key files:**
- `packages/shared/sync/outbound.ts` — Outbound sync processor (canonical → platform write-back via `fromCanonical()`)
- `packages/shared/sync/health.ts` — `ConnectionHealth` JSONB shape, health evaluation helpers
- `packages/shared/sync/rate-limiter.ts` — Enhanced rate limiter with priority-aware dispatch
- `packages/shared/sync/types.ts` — Added `TableVisibility`, `SyncPriority`, `ConnectionHealth`, `SyncError`, `SyncErrorCode`, `POLLING_INTERVALS`, `PRIORITY_CAPACITY_THRESHOLDS`
- `apps/web/src/components/sync/ConflictsTab.tsx` — Conflict resolution UI (diff view, per-field accept/reject)
- `apps/web/src/data/sync-dashboard-conflicts.ts` — Conflict queries for dashboard

### Phase 2C — Notion Adapter, Error Recovery, Sync Dashboard (Complete)

Notion platform adapter, sync error recovery flows, and the sync settings dashboard.

**Key files (Notion adapter):**
- `packages/shared/sync/adapters/notion/notion-adapter.ts` — `NotionAdapter` implementing `PlatformAdapter` (18 property types)
- `packages/shared/sync/adapters/notion/notion-field-transforms.ts` — 18 field transforms registered via `registerNotionTransforms()`
- `packages/shared/sync/adapters/notion/notion-types.ts` — `NotionPropertyType`, `NotionProperty`, `NotionPage`, `NotionDatabase`, all property interfaces
- `packages/shared/sync/adapters/notion/notion-filter.ts` — `translateToNotionFilter()` for filter pushdown
- `packages/shared/sync/adapters/notion/api-client.ts` — `NotionApiClient` with rate limiting and pagination
- `packages/shared/sync/adapters/notion/oauth.ts` — Notion OAuth 2.0 flow (`getNotionAuthUrl()`)
- `apps/web/src/app/api/oauth/notion/callback/route.ts` — Notion OAuth callback handler

**Key files (error recovery & scheduling):**
- `packages/shared/sync/sync-error-handler.ts` — `classifyError()` mapping errors to `SyncErrorCode`, `getBackoffDelay()` with exponential backoff
- `packages/shared/sync/priority-scheduler.ts` — `getSyncDispatchMode()` evaluating priority vs capacity
- `packages/shared/sync/sync-failures.ts` — Sync failure persistence and query helpers
- `packages/shared/sync/sync-notifications.ts` — Real-time sync event notifications
- `packages/shared/sync/schema-change-detector.ts` — Detects schema diffs between platform and local
- `packages/shared/sync/notification-queue.ts` — Notification queuing for sync events
- `apps/worker/src/processors/sync/sync-scheduler.ts` — `SyncScheduler` (30s tick, priority-based dispatch)
- `apps/worker/src/processors/sync/sync-error-handler.ts` — Error classification and retry logic in worker
- `apps/worker/src/processors/sync/escalation-check.ts` — Escalation check processor
- `apps/worker/src/processors/sync/sync-inbound.ts` — Enhanced inbound sync with error handling
- `apps/worker/src/processors/sync/initial-sync.ts` — Updated with Notion support

**Key files (sync dashboard UI):**
- `apps/web/src/app/(app)/[workspaceId]/settings/sync/[baseConnectionId]/page.tsx` — Sync dashboard route
- `apps/web/src/components/sync/SyncDashboard.tsx` — Tabbed dashboard (Overview, Tables & Filters, Conflicts, Failures, Schema Changes, History)
- `apps/web/src/components/sync/OverviewTab.tsx` — Connection health overview
- `apps/web/src/components/sync/TablesFiltersTab.tsx` — Per-table sync configuration
- `apps/web/src/components/sync/FailuresTab.tsx` — Error log with retry/dismiss
- `apps/web/src/components/sync/SchemaChangesTab.tsx` — Schema diff display
- `apps/web/src/components/sync/HistoryTab.tsx` — Sync event timeline
- `apps/web/src/components/sync/SyncStatusBadge.tsx` — Status badge component
- `apps/web/src/components/sync/SyncStatusTooltip.tsx` — Status tooltip with details
- `apps/web/src/components/sync/SyncNotificationToast.tsx` — Toast notifications for sync events
- `apps/web/src/components/sync/ReauthBanner.tsx` — Re-authentication prompt banner
- `apps/web/src/components/sync/QuotaExceededPanel.tsx` — Quota overage panel with upgrade options

**Key files (sidebar sync indicators):**
- `apps/web/src/components/sidebar/PlatformBadge.tsx` — 14px platform logo overlay on table icon
- `apps/web/src/components/sidebar/SyncStatusIcon.tsx` — 6-state sync health icon
- `apps/web/src/components/sidebar/TableTabItem.tsx` — Table tab with badge + status integration
- `apps/web/src/components/icons/platforms/` — AirtableLogo, NotionLogo, SmartSuiteLogo SVG components

**Server Actions (2C):**
- `sync-dashboard-actions.ts` — Dashboard data mutations (retry, dismiss, acknowledge)
- `sync-failure-actions.ts` — Failure management (retry individual, bulk retry, dismiss)
- `sync-reauth.ts` — Re-authentication flow for expired tokens
- `sync-schema-actions.ts` — Schema change acknowledgement and migration

**Data Functions (2C):**
- `sync-dashboard.ts` — Dashboard overview queries (health, history, stats)
- `sync-dashboard-conflicts.ts` — Conflict queries for resolution UI
- `sync-failures.ts` — Failure log queries with filtering
- `sync-schema-changes.ts` — Schema change detection queries
- `sync-status.ts` — Connection status and health queries

**Realtime Events (2C):**
- Added sync notification events to `packages/shared/realtime/events.ts`

**Queue Types (2C):**
- Added `EscalationCheckJobData` to `packages/shared/queue/types.ts`

**i18n (2C):**
- New namespaces in `en.json`/`es.json`: sync dashboard, sync failures, sync notifications, reauth, schema changes

**Tests (Phase 2C):**
- `packages/shared/sync/adapters/notion/__tests__/notion-adapter.test.ts`
- `packages/shared/sync/adapters/notion/__tests__/notion-field-transforms.test.ts`
- `packages/shared/sync/adapters/notion/__tests__/notion-filter.test.ts`
- `packages/shared/sync/adapters/notion/__tests__/notion-pipeline-e2e.test.ts`
- `packages/shared/sync/adapters/notion/__tests__/oauth.test.ts`
- `packages/shared/sync/__tests__/health.test.ts`
- `packages/shared/sync/__tests__/priority-scheduler.test.ts`
- `packages/shared/sync/__tests__/priority-scheduling-verify.test.ts`
- `packages/shared/sync/__tests__/schema-change-detector.test.ts`
- `packages/shared/sync/__tests__/sync-failures.test.ts`
- `packages/shared/sync/__tests__/sync-notifications.test.ts`
- `packages/shared/realtime/__tests__/types.test.ts`
- `apps/worker/src/processors/sync/__tests__/sync-scheduler.test.ts`
- `apps/worker/src/processors/sync/__tests__/sync-error-handler.test.ts`
- `apps/worker/src/processors/sync/__tests__/sync-inbound.test.ts`
- `apps/worker/src/processors/sync/__tests__/escalation-check.test.ts`
- `apps/worker/src/processors/sync/__tests__/smart-polling-verify.test.ts`
- `apps/worker/src/processors/sync/__tests__/initial-sync.test.ts` (updated)
- `apps/web/src/actions/__tests__/sync-dashboard-actions.test.ts`
- `apps/web/src/data/__tests__/sync-dashboard.test.ts`
- `apps/web/src/data/__tests__/sync-dashboard-conflicts.test.ts`
- `apps/web/src/data/__tests__/sync-failures.test.ts`
- `apps/web/src/data/__tests__/sync-schema-changes.integration.test.ts`
- `apps/web/src/data/__tests__/sync-status.integration.test.ts`
- `apps/web/src/components/sync/__tests__/FailuresTab.test.tsx`
- `apps/web/src/components/sync/__tests__/QuotaExceededPanel.test.tsx`
- `apps/web/src/components/sync/__tests__/ReauthBanner.test.tsx`
- `apps/web/src/components/sync/__tests__/SyncNotificationToast.test.tsx`
- `apps/web/src/components/sync/__tests__/SyncStatusBadge.test.tsx`
- `apps/web/src/components/sync/__tests__/SyncStatusTooltip.test.tsx`
- `apps/web/src/components/sidebar/__tests__/PlatformBadge.test.tsx`
- `apps/web/src/components/sidebar/__tests__/SyncStatusIcon.test.tsx`
- `apps/web/src/components/sidebar/__tests__/TableTabItem.test.tsx`

**Shared package exports added in 2C:**
- `@everystack/shared/sync` — NotionAdapter, registerNotionTransforms, NotionApiClient, Notion OAuth functions, NotionPropertyType, NotionProperty, NotionPage, NotionDatabase, translateToNotionFilter, TableVisibility, SyncPriority, ConnectionHealth, SyncError, SyncErrorCode, ConnectionHealthSchema, SyncErrorSchema, POLLING_INTERVALS, PRIORITY_CAPACITY_THRESHOLDS, getSyncDispatchMode, getPollingInterval, getBackoffDelay, classifyError, SyncScheduler, hasActiveWebhook, health utilities, sync-failures, sync-notifications, schema-change-detector

**Patterns established in 2C:** NotionAdapter follows same FieldTypeRegistry pattern as AirtableAdapter (`registerNotionTransforms()` at startup). `NotionApiClient` with rate limiting and cursor-based pagination. `classifyError()` maps platform errors to `SyncErrorCode` for driving recovery flows. `SyncScheduler` 30s tick with P0–P3 priority dispatch. Multi-tenant fairness cap (20% per tenant, P0 exempt). Exponential backoff via `BACKOFF_SCHEDULE` array. `ConnectionHealth` JSONB on `base_connections` for health tracking. Sync dashboard as tabbed settings page pattern. `PlatformBadge` + `SyncStatusIcon` as independent visual channels in sidebar. `SyncNotificationToast` for real-time sync event feedback. Schema change detection with diff-based comparison.

---

## What Does NOT Exist Yet

**Sync Engine** — FieldTypeRegistry, canonical types, Airtable adapter (32 field types), and Notion adapter (18 property types) are operational. Initial sync, schema sync, orphan detection, outbound sync, conflict resolution, error recovery, priority scheduling, and smart polling are operational. SmartSuite adapter not yet implemented (adapter stub only). No webhook-based change detection (Airtable webhooks specced but not connected). No incremental/delta sync processor (uses full-table polling).

**UI / Design System** — Tailwind config, globals.css, CSS custom properties, and 18 shadcn/ui primitives installed (added checkbox in 2A). Application shell with multi-tenant navigation (sidebar with icon rail + content zone, accent header, content area), ShellAccentProvider, TenantSwitcher, contextual clarity signals operational. Sync setup wizard + filter builder + orphan UI + sync dashboard + sidebar badges (PlatformBadge, SyncStatusIcon) operational. TanStack Table + TanStack Virtual used by DataGrid. Zustand stores: sidebar-store (global) + use-grid-store (per-grid-instance).

**Views / Grid / Card** — Grid view is operational (DataGrid, 18 cell renderers, inline editing, keyboard navigation, clipboard, undo/redo, drag-to-fill, column resize/reorder/color, row reorder, row density, frozen columns, performance banner, empty state, skeleton loading). Card view not yet implemented. No view filters/sorts/grouping UI (server actions exist but no toolbar).

**Record View** — No overlay component. Schema for `record_view_configs` exists but no UI.

**Cross-Linking** — Schema for `cross_links` + `cross_link_index` exists but no resolution logic.

**Portals & Forms** — Schema exists, no implementation. No portal auth (magic link/password), no form renderer.

**Automations** — Schema for `automations` + `automation_runs` exists, no execution engine.

**Communications** — Schema for `threads` + `thread_messages` + `thread_participants` (with external contact support) exists, no chat UI or real-time messaging.

**Documents / PDF** — Schema for `document_templates` + `generated_documents` exists, no Gotenberg integration, no merge-tag engine.

**AI Features** — AIService, providers, prompts, tools, metering, streaming, and data contract are operational. No AI feature UI yet (no Smart Fill panel, no NL Search bar, no Record Summarization widget). Prompt templates directory is empty (ready for feature-specific prompts). Vector embeddings and DuckDB Context Layer are Post-MVP.

**Platform Owner Console** — Schemas and reference doc exist (`platform-owner-console.md`). No admin UI, no Stripe integration, no impersonation flow.

**Support System** — Schemas and reference doc exist (`support-system.md`). No support UI, no AI support chatbot, no escalation flow.

**Platform API** — Auth middleware, rate limiting, error format, composed middleware (`withPlatformApi`), and `GET /api/v1/` health endpoint exist. No v1 data endpoints (CRUD for records, tables, fields).

**i18n** — next-intl installed with non-routing locale strategy. `en.json` + `es.json` locale files exist with shell/sidebar/header/my_office + sync_wizard/sync_filter_editor/sync_orphans + sync_dashboard/sync_failures/sync_notifications/reauth/schema_changes keys. `check:i18n` CI gate enforces zero hardcoded English strings. IntlWrapper available for testing.

**Realtime** — Socket.io server with Redis adapter, Clerk JWT auth, room management, and event publishing are fully operational. No presence tracking yet (stubs exist, marked for MVP — Core UX).

**Worker Jobs** — BullMQ worker with 6 queues, 3 file processors (thumbnail, scan, orphan cleanup), initial sync processor, inbound sync processor, sync scheduler (30s tick), escalation check processor, and sync error handler operational. Email, automation, and document-gen processors not yet implemented.

**File Storage** — StorageClient interface, R2/MinIO client, presigned upload pipeline, MIME/magic byte validation, thumbnail generation, virus scanning, and orphan cleanup are operational. No file attachment UI yet (no record attachment picker, no file browser).

**E2E Tests** — `apps/web/e2e/` contains only `.gitkeep`. Playwright not configured.

**Server Actions / Data Functions** — Actions: `api-keys.ts`, `tenant-switch.ts`, `sync-connections.ts`, `sync-setup.ts`, `sync-filters.ts`, `sync-orphans.ts`, `sync-dashboard-actions.ts`, `sync-failure-actions.ts`, `sync-reauth.ts`, `sync-schema-actions.ts`. Data: `api-keys.ts`, `sidebar-navigation.ts`, `sync-connections.ts`, `sync-setup.ts`, `sync-dashboard.ts`, `sync-dashboard-conflicts.ts`, `sync-failures.ts`, `sync-schema-changes.ts`, `sync-status.ts`. No record CRUD actions, no workspace/table management actions yet.

---

## Active Conventions

| Convention | Implementation |
|---|---|
| **Primary keys** | UUIDv7 via `generateUUIDv7()` — no serial/auto-increment anywhere |
| **ORM** | Drizzle ORM exclusively. No raw SQL outside migrations |
| **Tenant routing** | `getDbForTenant(tenantId, intent)` for every query |
| **RLS** | `setTenantContext(db, tenantId)` before tenant-scoped operations. 48 tenant-scoped tables. 6 admin-only tables skip RLS intentionally. `tenant_relationships` uses OR-clause RLS (both agency and client can see) |
| **RLS column exclusion** | `RLS_EXCLUDED_COLUMNS` in `rls.ts` — hide `is_platform_admin`, `is_support_agent` from tenant queries |
| **Admin tables** | Admin-only tables (support_requests, admin_impersonation_sessions, etc.) have no RLS — accessed only via `/admin` routes |
| **Personal tenants** | Auto-provisioned via Clerk webhook (`provisionPersonalTenant()`). Idempotent. `users.personal_tenant_id` FK. Fixed accent #78716C (warm neutral). Hidden in sidebar until ≥1 workspace |
| **Error handling** | All errors extend `AppError` with code/statusCode/details/traceId |
| **Logging** | Pino with PII redaction. `webLogger`/`workerLogger`/`realtimeLogger` |
| **Tracing** | AsyncLocalStorage via `runWithTraceContext()`. TraceId flows to logs + OTel spans |
| **Auth** | Clerk for platform users. `getAuthContext()` resolves to internal IDs + `agencyTenantId`. `resolveUserAccess()` + `resolveUserTenants()` for effective membership resolution (direct + agency) |
| **Roles** | 5-role hierarchy checked via `roleAtLeast()` or `requireRole()`. Agency access_level mapped: admin→admin, builder→member, read_only→viewer |
| **Tenant switching** | Clerk+Redis hybrid: server validates access → Redis cache (24h TTL, key `active_tenant:{userId}`) → client `setActive()`. `switchTenantAction()` Server Action with audit log. Redis failures non-fatal (Clerk fallback). 404 on access denial (prevents enumeration) |
| **Effective memberships** | `effective_memberships` SQL view (UNION ALL direct + agency). `getEffectiveMemberships(userId)` and `getEffectiveMembershipForTenant(userId, tenantId)`. Cross-tenant by design (uses `dbRead`) |
| **Agency relationships** | `tenant_relationships` table with OR-clause RLS. Types: managed/white_label/reseller/referral. Statuses: pending/active/suspended/revoked. All VARCHAR (not ENUM). `createTestTenantRelationship()` factory |
| **Testing** | Vitest with forks pool. Factories with auto-parent creation. Mocked DB in unit tests, real DB in integration |
| **Test isolation** | `afterEach` truncates all tables. Each test creates own state via factories |
| **Coverage** | V8 provider. Per-path thresholds enforced (data: 95%, db/sync: 90%, actions: 90%, jobs: 85%) |
| **Commits** | `type(scope): description [Phase X, Prompt N]` — types: feat, chore(verify), fix |
| **Branches** | `feat/phase-XX-description` (kebab-case) |
| **Tags** | `v0.1.X-phase-YZ` |
| **Security headers** | CSP + HSTS + X-Frame-Options. Platform (strict) vs Portal (embeddable) |
| **Webhook verification** | Svix for Clerk, generic HMAC for others |
| **Realtime events** | `createEventPublisher(redis)` publishes to `realtime:t:{tenantId}:{channel}`. Sync notification events for toast-style UI feedback. 23+ event types in `REALTIME_EVENTS` |
| **Room authorization** | Tenant-scoped rooms (`t:{tenantId}:{resourceType}:{resourceId}`). 5 resource types with query-based authorization |
| **Worker processors** | Extend `BaseProcessor<TData>`. Trace propagation + Pino child logger + Sentry. `processJob(job, logger)` abstract method |
| **Graceful shutdown** | `setupGracefulShutdown()` with ordered handlers. Realtime: 10s, Worker: 30s forced exit |
| **Queue definitions** | 6 queues in `QUEUE_NAMES`. All job data extends `BaseJobData` (tenantId, traceId, triggeredBy). `QueueJobDataMap` for type safety |
| **Storage keys** | Tenant-scoped: `t/{tenantId}/files/{fileId}/original/{filename}`. Use `fileOriginalKey()`, `fileThumbnailKey()`, etc. |
| **File uploads** | Presign → client PUT → complete (magic bytes + scan + thumbnail). Never stream through server |
| **File scanning** | ClamAV INSTREAM via TCP. Infected → quarantine + audit log. Dev fallback: skipped |
| **Redis clients** | `createRedisClient(name)` with `maxRetriesPerRequest: null` for BullMQ. Separate clients for pub/sub (subscribe mode) |
| **Design tokens** | CSS custom properties in globals.css. Three-layer color: accent, semantic, data palette |
| **Typography** | DM Sans (UI), JetBrains Mono (code). 9-step scale in `design-system/typography.ts` |
| **UI primitives** | 18 shadcn/ui components in `components/ui/` (added checkbox in 2A). Extend via composition, never recreate |
| **i18n** | next-intl, non-routing locale strategy. All user-facing text through `useTranslations()`. `check:i18n` CI gate |
| **Shell layout** | Dark sidebar: Icon Rail (48px, always visible) + Content Zone (232px, expandable). Accent header (52px, `--shell-accent` CSS var with 150ms transition). White content. `block-size: 100dvh`. Responsive: sidebar hidden on mobile |
| **Shell accent** | `ShellAccentProvider` React Context manages `--shell-accent` on `:root`. 8 curated org colors + fixed personal (#78716C) + fixed portal (#64748B). `getShellAccent()` computes correct accent. `useShellAccent()` hook: set, revert, applyTenantAccent. All ≥3:1 WCAG AA on dark sidebar |
| **Contextual clarity** | 3 signals: (1) SidebarHeader (avatar + tenant name), (2) Shell accent repainting on switch, (3) MyOfficeHeading (tenant-qualified page title). All update on tenant switch |
| **Sidebar navigation** | `getSidebarNavigation()` cross-tenant aggregation via `dbRead`. Role-aware workspace visibility (Owner/Admin all, Members explicit only). Board grouping. Personal tenants first, hidden if empty. Portal section with system accent |
| **Optimistic tenant switch** | TenantSwitcher: repaint accent → `switchTenantAction()` → Clerk `setActive()` → `router.refresh()`. On failure: revert accent, error toast, Redis cache invalidation. Prevents concurrent switches |
| **AI service** | `AIService.getInstance()` singleton. 6-step flow: budget check → route → compile → execute → log → deduct |
| **AI capability tiers** | `fast`/`standard`/`advanced` — feature code never references providers or models directly |
| **AI provider isolation** | `@anthropic-ai/sdk` imported ONLY in `packages/shared/ai/providers/anthropic.ts` |
| **AI prompts** | `PromptRegistry` with monotonically increasing versions. `AnthropicPromptCompiler` (XML + cache_control) and `BasicPromptCompiler` |
| **AI tools** | `ToolRegistry` with 8 stubs. `createDefaultToolRegistry()` factory. Scope-based filtering |
| **AI metering** | `calculateCost()` for token pricing. `checkBudget()` before execution. `logAIUsage()` + `deductCredits()` after. 4 alert tiers (50/75/90/100%) |
| **AI data contract** | `canonicalToAIContext()` (JSONB → AI) and `aiToCanonical()` (AI → JSONB). Per-field-type configs. Type guards for success/error results |
| **AI streaming** | `createAIStream()` wraps into Vercel AI SDK `createDataStreamResponse`. `AIJobPayload`/`AIJobResult` for async BullMQ jobs |
| **Audit logging** | `writeAuditLog(tx, entry)` inside same transaction as mutation. 7 actor types. Never fails parent transaction. Plan-based retention |
| **API keys** | Generated with `generateApiKey()` (base62, ~285 bits). Hashed with SHA-256, full key shown once. Timing-safe verification via `verifyApiKeyHash()` |
| **Platform API auth** | `authenticateApiKey()` extracts Bearer token, validates prefix (`esk_live_`/`esk_test_`), hash-lookups DB, checks status/expiry. Fire-and-forget `lastUsedAt` update |
| **Rate limiting** | Two-level: per-key token bucket + per-tenant ceiling (3× highest tier). Atomic Redis Lua scripts. Fail-open on Redis errors. Standard headers on all responses |
| **API error format** | `{ error: { code, message, details?, request_id? } }`. All responses include `X-API-Version: 2026-03-01`. Use convenience helpers (`apiBadRequest`, etc.) |
| **API middleware** | `withPlatformApi(handler, ...scopes)` — single entry point. Pipeline: auth → rate limit → handler → logging → error mapping |
| **Request logging** | `logApiRequest()` fire-and-forget to `api_request_log`. Never throws. Records method, path, status, duration, sizes |
| **FieldTypeRegistry** | `fieldTypeRegistry` singleton maps `{platform}:{fieldType}` → `FieldTransform`. Use `registry.get()` — never switch on field types. `registerAirtableTransforms()` called once at startup |
| **Canonical JSONB values** | All field values use `{ type: 'fieldType', value: <typed> }` discriminated union. 9 categories, 60+ variants. Keyed by `fields.id` (UUID) |
| **Transform lossless flag** | Each `FieldTransform` declares `isLossless: boolean` — sync engine uses this for algorithm decisions |
| **Transform operations** | Each `FieldTransform` declares `supportedOperations: ('read' \| 'write' \| 'filter' \| 'sort')[]`. Outbound sync skips fields without 'write'. Computed fields (lookup/rollup/formula/count) are `['read']` only |
| **Source refs** | Selection, files, relational fields store platform-native IDs in `source_refs.{platform}` for lossless round-tripping. Used during `fromCanonical()` to recover original IDs |
| **Filter pushdown** | `translateFilterToFormula()` pushes supported operators to platform API. `applyLocalFilters()` handles unpushable operators locally. `canPushDown()` for query planning |
| **Sync rate limiting** | `rateLimiter.waitForCapacity(platform, scopeKey)` gates all platform API calls. Proactive sliding-window via Redis Lua scripts. `AIRTABLE_RATE_LIMITS`: 5/sec per base, 50/sec per key. Fail-open on Redis errors |
| **Record quota** | Plan-based limits in `PLAN_QUOTAS`. 3 enforcement points: preventive (`canSyncRecords`), runtime (`enforceQuotaOnBatch`), single (`canCreateRecord`). Redis cache (60s TTL) with INCRBY/DECRBY mutation |
| **Token encryption** | `encryptTokens()`/`decryptTokens()` via AES-256-GCM. 12-byte IV, 16-byte auth tag, version field. `TOKEN_ENCRYPTION_KEY` env var (64-char hex). Stored in `base_connections.oauth_tokens` JSONB |
| **OAuth PKCE** | PKCE state + code verifier stored in Redis (10min TTL). Popup opens OAuth URL → callback exchanges code → `postMessage` to opener. Auto-refresh when token expires within 5 minutes |
| **Sync setup wizard** | 3-step "Wizard Create" pattern (Dialog): authenticate → select base → select/filter tables. `useReducer` state machine. OAuth popup via `window.open()` + `postMessage` |
| **Filter builder** | `SyncFilterBuilder` uses `FIELD_TYPE_OPERATORS` Map (not switch). Two modes: 'platform' (external field IDs) and 'es' (ES UUIDs). Reusable across wizard and post-setup filter editor |
| **Orphan handling** | `previous_sync_filter` stored for undo support. Orphan detection: diff local vs platform-filtered IDs → verify against API → mark `sync_status: 'orphaned'`. 3 user actions: delete, keep local, undo filter change |
| **Sync schema sync** | `AIRTABLE_TO_CANONICAL_TYPE` static map (32 types). Creates tables + fields + synced_field_mappings. `remapFilterFieldIds()` translates platform IDs → ES UUIDs |
| **Sync initial sync** | `InitialSyncProcessor` extends `BaseProcessor`. 3-phase: schema sync → paginated record fetch (Airtable/Notion API → `toCanonical()`) → quota enforcement. 5 realtime events |
| **Notion adapter** | `NotionAdapter` implements `PlatformAdapter`. 18 field transforms via `registerNotionTransforms()`. `NotionApiClient` with rate limiting + cursor pagination. OAuth 2.0 via `getNotionAuthUrl()` |
| **Sync error handling** | `classifyError()` maps platform errors → `SyncErrorCode`. `BACKOFF_SCHEDULE` array for exponential retry delays. `ConnectionHealth` JSONB tracks consecutive failures + next retry |
| **Priority scheduling** | `SyncScheduler` 30s tick. P0–P3 dispatch tiers via `getSyncDispatchMode()`. Multi-tenant fairness: max 20% capacity per tenant (P0 exempt). `PRIORITY_CAPACITY_THRESHOLDS` constants |
| **Smart polling (impl)** | `getPollingInterval(visibility, hasWebhook)` resolves to 30s/5min/30min/null. `TableVisibility` derived from Socket.io room membership. `hasActiveWebhook()` for event-driven skip |
| **Sync dashboard** | Tabbed settings page at `/[workspaceId]/settings/sync/[baseConnectionId]`. 6 tabs: Overview, Tables & Filters, Conflicts, Failures, Schema Changes, History. Skeleton loading states |
| **Sidebar sync badges** | `PlatformBadge` (14px logo overlay) + `SyncStatusIcon` (6 health states) as independent visual channels. `TableTabItem` integrates both into sidebar |
| **Sync notifications** | `SyncNotificationToast` for real-time sync event feedback via Socket.io. Tenant-scoped delivery via standard event bus |

### Phase 3A-i — Grid View Core (Complete)

Grid view layout, 18 cell renderers, inline editing, keyboard navigation, clipboard, undo/redo, drag-to-fill, column management, row management, and data access layer.

**Key files:**
- `apps/web/src/components/grid/DataGrid.tsx` — Root grid component: TanStack Table + TanStack Virtual, frozen columns, row density, keyboard shortcuts dialog
- `apps/web/src/components/grid/GridHeader.tsx` — Virtualized column headers with sort/filter indicators, column header menu
- `apps/web/src/components/grid/GridRow.tsx` — Virtualized row with selection checkbox, row number, drag handle
- `apps/web/src/components/grid/GridCell.tsx` — Cell renderer dispatcher: resolves field type → display/edit component via cell registry
- `apps/web/src/components/grid/cells/cell-registry.ts` — Registry pattern mapping `field_type` → `{ DisplayComponent, EditComponent }`. 18 field types registered via `registerPrompt3Cells()`
- `apps/web/src/components/grid/cells/*.tsx` — 18 cell renderers: Text, Number, Date, Checkbox, Rating, Currency, Percent, SingleSelect, MultiSelect, People, LinkedRecord, Attachment, Url, Email, Phone, SmartDoc, Barcode, Checklist
- `apps/web/src/components/grid/cells/PillBadge.tsx` — Shared pill badge for select/people cells with 4 display styles (pill, block, dot, plain)
- `apps/web/src/components/grid/cells/OverflowBadge.tsx` — "+N" overflow indicator for multi-value cells
- `apps/web/src/components/grid/grid-types.ts` — Default column widths by field type, fixed column widths, virtualization constants, grid design tokens, `CellPosition` type
- `apps/web/src/components/grid/use-grid-store.ts` — Per-instance Zustand store: active cell, editing state, density, frozen columns, column widths/order/colors, hidden fields, row selection
- `apps/web/src/components/grid/use-keyboard-navigation.ts` — Arrow keys, Tab/Shift+Tab, Enter/Escape, Home/End, Ctrl+Home/End, Page Up/Down, F2 to edit
- `apps/web/src/components/grid/use-clipboard.ts` — Copy/paste (single cell, multi-cell range), TSV format for multi-cell
- `apps/web/src/components/grid/use-column-resize.ts` — Drag-to-resize columns (min 60px, max 800px), persists to view config
- `apps/web/src/components/grid/use-column-reorder.ts` — Drag-and-drop column reorder, persists to view config
- `apps/web/src/components/grid/use-row-reorder.ts` — Drag-and-drop row reorder with optimistic update
- `apps/web/src/components/grid/ColumnResizer.tsx` — Visual drag handle between column headers
- `apps/web/src/components/grid/ColumnHeaderMenu.tsx` — Right-click/dropdown menu: sort, hide, freeze, color, resize to fit
- `apps/web/src/components/grid/RowContextMenu.tsx` — Right-click menu: expand, duplicate, delete, copy link
- `apps/web/src/components/grid/NewRowInput.tsx` — Inline row creation at bottom of grid
- `apps/web/src/components/grid/DragToFillHandle.tsx` — Drag handle for filling cell values down (smart fill by field type)
- `apps/web/src/components/grid/CellErrorOverlay.tsx` — Validation error overlay on cells
- `apps/web/src/components/grid/PerformanceBanner.tsx` — Warning banner when row count exceeds performance threshold
- `apps/web/src/components/grid/GridSkeleton.tsx` — Skeleton loading state matching grid layout shape
- `apps/web/src/components/grid/GridEmptyState.tsx` — Empty state with "Create your first record" CTA
- `apps/web/src/components/grid/TableTypeIcon.tsx` — Lucide icon for table type (5 types)
- `apps/web/src/components/grid/KeyboardShortcutsDialog.tsx` — Keyboard shortcuts help dialog
- `apps/web/src/lib/types/grid.ts` — `GridRecord`, `GridField`, `GridView`, `ViewConfig` (Zod schema), `RowDensity`, `ROW_DENSITY_HEIGHTS`
- `apps/web/src/lib/constants/table-types.ts` — `TableType` union, `TABLE_TYPES` metadata, `TAB_COLOR_PALETTE` (10 colors), `resolveTabColor()`, `isValidTableType()`
- `apps/web/src/data/tables.ts` — Server-side table queries (tenant-scoped)
- `apps/web/src/data/fields.ts` — Server-side field queries (tenant-scoped)
- `apps/web/src/data/records.ts` — Server-side record queries (tenant-scoped, paginated)
- `apps/web/src/data/views.ts` — Server-side view queries (tenant-scoped)
- `apps/web/src/actions/record-actions.ts` — Server Actions: create, update, delete, duplicate, reorder records
- `apps/web/src/actions/view-actions.ts` — Server Actions: create, update, delete views; update view config (column widths, order, colors, density, frozen columns)
- `apps/web/src/app/api/grid-data/route.ts` — API route for paginated grid data fetch

**Patterns established:**
- Cell Registry pattern: `registerCellRenderer()` / `getCellRenderer()` — maps field types to display/edit React components (no switch statements, consistent with FieldTypeRegistry)
- Per-grid-instance Zustand stores (not global — each DataGrid manages its own state)
- `ViewConfig` Zod schema for typed, validated view configuration JSONB
- Three row densities: compact (32px), medium (44px), tall (64px)
- CellPosition `{ rowId, fieldId }` as the universal grid coordinate
- Table type metadata system with icon/color/label for 5 table types
- Tab color palette (10 colors) with light/dark mode hex pairs
- TanStack Table for column/row model + TanStack Virtual for row/column virtualization
- Keyboard navigation with cell-level focus management (arrow keys, Tab, Enter, Escape, F2)
- Clipboard with TSV format for multi-cell copy/paste
- Drag-to-fill with field-type-aware smart fill behaviors
- `PillBadge` shared component with 4 display styles for consistent select/people rendering

| Convention | Detail |
| --- | --- |
| **Cell registry** | `registerCellRenderer(fieldType, { DisplayComponent, EditComponent })` — no switch statements on field types. `getCellRenderer(fieldType)` to resolve. All 18 MVP field types registered via `registerPrompt3Cells()` |
| **Grid store** | Per-instance via `create<GridState & GridActions>()`. Not global. Manages `activeCell`, `editingCell`, `editMode` ('replace' \| 'edit'), `density`, `frozenColumnCount`, `columnWidths`, `columnOrder`, `columnColors`, `hiddenFieldIds`, `selectedRows` |
| **ViewConfig** | Zod schema: `columns` (fieldId + width + visible), `frozenColumns` (0–5), `density` (compact\|medium\|tall), `isDefault`, `columnOrder`, `columnColors`. Stored in `views.config` JSONB |
| **Table types** | 5 types: table, projects, calendar, documents, wiki. Each has icon (Lucide), defaultTabColor, defaultView ('grid'), labelKey. `TABLE_TYPES` constant + `TableType` union |
| **Tab colors** | 10-color palette with light + dark hex. `resolveTabColor(tableType, tabColor, useDarkMode)` selects correct variant. Independent of PlatformBadge |
| **Row density** | `ROW_DENSITY_HEIGHTS`: compact=32, medium=44, tall=64. `RowDensity` = `keyof typeof ROW_DENSITY_HEIGHTS` |
| **Grid tokens** | `GRID_TOKENS` constant: borderDefault, panelBg, textPrimary, textSecondary, rowHover, rowStripeEven/Odd, activeCellBorder. In `grid-types.ts` |
| **Column widths** | `DEFAULT_COLUMN_WIDTHS` map by field type. `DEFAULT_COLUMN_WIDTH_FALLBACK` = 160. `getDefaultColumnWidth(fieldType, isPrimary)`. Min 60px, max 800px |
| **Virtualization** | `ROW_OVERSCAN` = 10, `COLUMN_OVERSCAN` = 3, `MAX_FROZEN_COLUMNS` = 5 (excluding primary). TanStack Virtual for row + column virtualization |

---

## How to Update This File

After every phase merge to `main`, re-run this audit:

1. Scan all directories for new files, modules, and patterns
2. Move completed phases from "In Progress" to "Complete"
3. Remove items from "What Does NOT Exist Yet" as they get built
4. Update "Active Conventions" if new patterns are established
5. Update the "Last updated" date, branch, and latest tag

Run the same comprehensive scan that generated this file — check every source file, schema, test, and config. Only document what actually exists in the repo.
