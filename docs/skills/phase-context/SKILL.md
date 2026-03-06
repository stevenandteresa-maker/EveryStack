---
name: everystack-phase-context
description: Current build state for EveryStack. Load this skill at the start of every build prompt. It documents what exists in the codebase right now — files, modules, patterns, conventions — so Claude Code doesn't have to rediscover it each time.
---

# EveryStack — Phase Context

**Last updated:** 2026-03-06
**Branch:** `main`
**Latest tag:** `v0.1.9-phase-1j`
**Total commits:** 21 (squash merges)

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

**Patterns established:** Vitest configs (4), Docker test services, 20 factories with auto-parent creation (added `createTestTenantRelationship` in 1J), tenant isolation testing helper, Clerk session mocking, MSW-based platform API mocking, performance + a11y test helpers. Integration tests: auth-flow, role-check, webhook, effective-memberships, sidebar-navigation.

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

---

## What Does NOT Exist Yet

**Sync Engine** — `packages/shared/sync/field-registry.ts` is empty. No platform adapters (Airtable, Notion, SmartSuite). No `toCanonical()`/`fromCanonical()` transforms. Schema tables exist but no sync logic.

**UI / Design System** — Tailwind config, globals.css, CSS custom properties, and 17 shadcn/ui primitives installed. Application shell with multi-tenant navigation (sidebar with icon rail + content zone, accent header, content area), ShellAccentProvider, TenantSwitcher, contextual clarity signals operational. No TanStack Query/Virtual yet. No Zustand stores beyond sidebar-store.

**Views / Grid / Card** — No view rendering code. Schema for `views` exists but no UI.

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

**i18n** — next-intl installed with non-routing locale strategy. `en.json` + `es.json` locale files exist with shell/sidebar/header/my_office keys. `check:i18n` CI gate enforces zero hardcoded English strings. IntlWrapper available for testing.

**Realtime** — Socket.io server with Redis adapter, Clerk JWT auth, room management, and event publishing are fully operational. No presence tracking yet (stubs exist, marked for MVP — Core UX).

**Worker Jobs** — BullMQ worker with 6 queues and 3 file processors (thumbnail, scan, orphan cleanup) operational. Sync, email, automation, and document-gen processors not yet implemented.

**File Storage** — StorageClient interface, R2/MinIO client, presigned upload pipeline, MIME/magic byte validation, thumbnail generation, virus scanning, and orphan cleanup are operational. No file attachment UI yet (no record attachment picker, no file browser).

**E2E Tests** — `apps/web/e2e/` contains only `.gitkeep`. Playwright not configured.

**Server Actions / Data Functions** — `apps/web/src/actions/api-keys.ts`, `apps/web/src/actions/tenant-switch.ts`, `apps/web/src/data/api-keys.ts`, and `apps/web/src/data/sidebar-navigation.ts` exist. No record CRUD actions, no workspace/table management actions yet.

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
| **Realtime events** | `createEventPublisher(redis)` publishes to `realtime:t:{tenantId}:{channel}`. 16 event types in `REALTIME_EVENTS` |
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
| **UI primitives** | 17 shadcn/ui components in `components/ui/` (added sonner toast). Extend via composition, never recreate |
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

---

## How to Update This File

After every phase merge to `main`, re-run this audit:

1. Scan all directories for new files, modules, and patterns
2. Move completed phases from "In Progress" to "Complete"
3. Remove items from "What Does NOT Exist Yet" as they get built
4. Update "Active Conventions" if new patterns are established
5. Update the "Last updated" date, branch, and latest tag

Run the same comprehensive scan that generated this file — check every source file, schema, test, and config. Only document what actually exists in the repo.
