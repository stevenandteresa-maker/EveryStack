# Phase 1D — Observability, Security Hardening

## Phase Context

### What Has Been Built

**Phase 1A — Monorepo, CI Pipeline, Dev Environment (complete, merged to main):**
- Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds
- Docker Compose with PostgreSQL 16, PgBouncer, Redis
- GitHub Actions CI (lint → typecheck → test)
- ESLint + Prettier config, `tsconfig` strict mode, `.env.example`

**Phase 1B — Database Schema, Connection Pooling, Tenant Routing (complete, merged to main):**
- Drizzle schema for all 50 MVP tables (Tiers 0–7)
- PgBouncer connection pooling config (transaction mode)
- `getDbForTenant()` with read/write routing (`dbRead` + `db`)
- RLS policies enforcing tenant isolation on all tenant-scoped tables
- UUIDv7 primary key generation utility
- Initial migration files

**Phase 1C — Authentication, Tenant Isolation, Workspace Roles (complete, merged to main):**
- Clerk integration with webhook handler (`user.created`, `organization.created`)
- Tenant middleware (`getTenantId()` from Clerk session)
- Five workspace roles on `workspace_memberships` (Owner, Admin, Manager, Team Member, Viewer)
- `checkRole()` / `requireRole()` permission check utilities
- `PermissionDeniedError` typed error shape (HTTP 403)

### What This Phase Delivers

Cross-cutting runtime infrastructure that every subsequent feature depends on: structured logging with request-level correlation, error tracking with production diagnostics, distributed tracing across web/worker/realtime services, typed error classes for consistent error handling, security headers on all routes, webhook signature verification patterns, and PII compliance annotations. After this phase, every request and background job produces traceable, PII-safe structured logs, unhandled exceptions are captured with full context in Sentry, and security headers protect against common web vulnerabilities.

### What This Phase Does NOT Build

- Monitoring dashboards (operational — deployed post-MVP when production infrastructure exists)
- Alerting rules and PagerDuty/Slack integration (operational)
- AI telemetry columns on `ai_usage_log` (Phase 1H — AI Service Layer populates these)
- Production OTLP exporter to Grafana Tempo or Datadog (operational — console exporter is sufficient for development)
- WAF rules (Cloudflare WAF configured at deployment, not in application code)
- Session management controls — idle timeout, IP allowlist (Enterprise post-MVP)
- SAML SSO / SCIM provisioning (post-MVP)
- Portal-specific CSP with custom domain cookie security (post-MVP — Portals & Apps)
- Gotenberg sandboxing (post-MVP — Documents phase)
- Stripe webhook verification (post-MVP — Comms & Polish)
- Resend webhook verification (post-MVP — Documents)
- SOC 2 readiness tooling — Vanta/Drata (post-MVP)
- Trivy container scanning, Semgrep SAST, penetration testing (post-MVP)

### Architecture Patterns for This Phase

1. **Pino is the only logger.** No `console.log` in production code (ESLint rule enforced). Every log entry is structured JSON with `traceId` and `tenantId`.

2. **AsyncLocalStorage carries trace context.** `getTraceId()` is callable anywhere in the request/job call stack. Web middleware generates `traceId` per request. BullMQ job wrapper extracts `traceId` from job data. No manual threading of trace context.

3. **PII never appears in logs.** Pino redaction paths strip `password`, `token`, `authorization`, `cookie`, `email`, `name`. Log record IDs and field IDs only — never full record data or auth tokens.

4. **Sentry events carry `traceId`.** Every Sentry exception and breadcrumb includes the `traceId` so production errors can be cross-referenced with Pino structured logs.

5. **Two security header profiles.** Platform routes (`/w/*`, `/api/*`) get strict CSP with `frame-ancestors 'none'`. Portal routes get a separate, slightly relaxed CSP. Both are applied in Next.js middleware.

6. **Typed error classes extend a common base.** `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError` all extend `AppError` (defined in CLAUDE.md). Each maps to a specific HTTP status code. Feature code throws typed errors — middleware/boundaries catch and format them.

7. **CockroachDB safeguards remain active** (UUIDv7, no PG-specific syntax, no advisory locks, explicit transaction boundaries, hash-partitioning-compatible schemas).

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | Pino logger package with PII redaction and log levels | None | ~180 |
| 2 | AsyncLocalStorage traceId, `getTraceId()`, pino-http middleware, worker job wrapper | 1 | ~200 |
| 3 | Sentry integration for web app and worker | 2 | ~160 |
| 4 | OpenTelemetry auto-instrumentation with console exporter | 2 | ~150 |
| CP-1 | Integration Checkpoint 1 | 1–4 | — |
| 5 | Typed error class hierarchy with HTTP status mapping | None | ~180 |
| 6 | Security headers middleware (platform + portal profiles) and webhook signature verification | None | ~200 |
| 7 | PII registry, encryption verification, security.txt, vulnerability scanning config | None | ~170 |
| CP-2 | Integration Checkpoint 2 (Final) | 1–7 | — |

**Dependency graph:**

```
Prompt 1 (Pino Logger)
  └── Prompt 2 (traceId + pino-http)
        ├── Prompt 3 (Sentry)
        └── Prompt 4 (OpenTelemetry)
              └── CP-1

Prompt 5 (Typed Errors)       ← independent
Prompt 6 (Security Headers)   ← independent
Prompt 7 (PII/Encryption)     ← independent
              └── CP-2 (Final)
```

Prompts 5, 6, and 7 are independent of each other and of Prompts 1–4 (they share no file-level dependencies). However, they are sequenced after CP-1 for clean integration verification.

---

## Prompt 1: Create Pino Logger Package with PII Redaction

**Depends on:** None (uses existing `packages/shared` scaffold from Phase 1A)
**Load context:** `observability.md` (full, 173 lines) — Logging Architecture, PII Redaction, Log Levels sections
**Target files:**
- `packages/shared/logging/logger.ts`
- `packages/shared/logging/index.ts`
- `packages/shared/logging/logger.test.ts`
- `packages/shared/package.json` (add `pino` dependency)
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1d-observability-security` from `main`. Then commit with message `feat(logging): create Pino logger package with PII redaction [Phase 1D, Prompt 1]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the shared Pino logger package at `packages/shared/logging/`. This is the sole logging mechanism for the entire platform — every service (web, worker, realtime) imports from here.

**Logger factory (`logger.ts`):**

1. Create a `createLogger(options: { service: string })` factory that returns a configured Pino instance.

2. Configure Pino with these settings:
   - `level`: Read from `LOG_LEVEL` env var, default to `'info'` in production and `'debug'` in development.
   - `redact`: Configure redaction paths for PII fields: `['password', 'token', 'authorization', 'cookie', 'email', 'name', '*.password', '*.token', '*.authorization', '*.cookie', '*.email', '*.name']`. Use Pino's built-in redaction (replaces values with `[Redacted]`).
   - `formatters.level`: Use the level label string (e.g., `'info'`) instead of the numeric level. This makes structured log output human-readable in JSON.
   - `timestamp`: Use `pino.stdTimeFunctions.isoTime` for ISO 8601 timestamps.
   - `base`: Include `{ service }` in every log entry for service identification.

3. Create pre-configured logger instances exported as named exports:
   - `webLogger = createLogger({ service: 'web' })`
   - `workerLogger = createLogger({ service: 'worker' })`
   - `realtimeLogger = createLogger({ service: 'realtime' })`

4. Export a `createChildLogger(parent: Logger, bindings: Record<string, unknown>)` utility that creates a child logger with additional bound context (e.g., `{ tenantId, traceId }`). This is the pattern all request handlers and job processors will use.

**Log level guidance (document in JSDoc):**
- `error`: Unhandled failures, data corruption risks
- `warn`: Retry-worthy failures, rate limits hit, degraded responses
- `info`: Request lifecycle, job start/complete, sync events, AI calls
- `debug`: Query details, payload shapes — local development only

**Re-export from `index.ts`:** Export everything from `logger.ts` plus the `pino` `Logger` type for consumers.

### Acceptance Criteria

- [ ] `createLogger({ service: 'web' })` returns a Pino logger with `service: 'web'` in base bindings
- [ ] PII fields (`password`, `token`, `authorization`, `cookie`, `email`, `name`) are redacted in log output — test by logging an object with these keys and asserting output contains `[Redacted]`
- [ ] Nested PII fields (e.g., `{ user: { email: 'test@example.com' } }`) are also redacted via wildcard paths
- [ ] `createChildLogger()` produces a child logger with additional bound context visible in output
- [ ] Log level defaults to `'info'` when `LOG_LEVEL` is unset, respects `LOG_LEVEL` env var override
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- `pino-http` middleware (Prompt 2)
- AsyncLocalStorage or traceId binding (Prompt 2)
- Sentry integration (Prompt 3)
- Transport configuration for production (e.g., pino-transport to external services) — console/stdout is sufficient
- Log rotation or retention policies (operational concern)

---

## Prompt 2: AsyncLocalStorage TraceId, getTraceId(), pino-http Middleware, Worker Job Wrapper

**Depends on:** Prompt 1 (Pino logger package)
**Load context:** `observability.md` (full, 173 lines) — Correlation via traceId section
**Target files:**
- `packages/shared/logging/trace-context.ts`
- `packages/shared/logging/index.ts` (re-export new utilities)
- `apps/web/src/lib/pino-http.ts`
- `apps/worker/src/lib/job-wrapper.ts`
- `packages/shared/logging/trace-context.test.ts`
- `apps/worker/src/lib/job-wrapper.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(logging): add traceId via AsyncLocalStorage with pino-http and worker job wrapper [Phase 1D, Prompt 2]`

### Schema Snapshot

N/A — no schema changes.

### Task

Implement request-level trace correlation so that every log entry, Sentry breadcrumb, and OTel span produced during a request or job carries the same `traceId`.

**Trace context (`trace-context.ts`):**

1. Create an `AsyncLocalStorage<{ traceId: string; tenantId?: string }>` instance.

2. Export `getTraceId(): string` — reads `traceId` from the current async context. If no context exists (e.g., called outside a request/job), returns a fallback value of `'no-trace'`. This function is the primary API — call it from anywhere in the stack.

3. Export `getTenantIdFromTrace(): string | undefined` — reads `tenantId` from async context. Optional — some traces (health checks) have no tenant.

4. Export `runWithTraceContext(context: { traceId: string; tenantId?: string }, fn: () => T): T` — runs a function within a new async context with the given trace data. This is what middleware and job wrappers call.

5. Export `generateTraceId(): string` — produces a random trace ID. Use `crypto.randomUUID()` (Node.js built-in). Format: standard UUID.

**pino-http middleware (`apps/web/src/lib/pino-http.ts`):**

1. Create a pino-http middleware configuration that:
   - Uses `webLogger` from the logging package as the base logger.
   - Generates a `traceId` via `generateTraceId()` for each incoming request.
   - Calls `runWithTraceContext({ traceId, tenantId })` to bind the trace context for the full request lifecycle. `tenantId` comes from the Clerk session (via `getTenantId()` from Phase 1C) when available — `undefined` for unauthenticated routes.
   - Adds `traceId` to the response header `X-Trace-Id` for client-side debugging.
   - Logs request completion with: `method`, `url`, `statusCode`, `responseTime`.
   - Assigns the child logger to `req.log` for use in route handlers.

2. Export the middleware configuration for use in Next.js middleware or a custom server setup. Note: In the Next.js App Router, pino-http cannot be used as traditional Express middleware. Instead, create a `withTraceContext(handler)` wrapper function for Server Actions and Route Handlers that:
   - Generates `traceId`
   - Runs the handler inside `runWithTraceContext()`
   - Returns a child logger with `{ traceId, tenantId }` bound

**Worker job wrapper (`apps/worker/src/lib/job-wrapper.ts`):**

1. Create a `createJobProcessor<T>(name: string, processor: (job: Job<T>, logger: Logger) => Promise<void>)` function that:
   - Extracts `traceId` from `job.data.traceId` (callers must include it when enqueuing). If absent, generates a new one.
   - Extracts `tenantId` from `job.data.tenantId` if present.
   - Calls `runWithTraceContext({ traceId, tenantId }, ...)` to wrap the full processor execution.
   - Creates a child logger via `createChildLogger(workerLogger, { traceId, tenantId, jobName: name, jobId: job.id })`.
   - Logs `info` at job start and job completion (with duration).
   - Logs `error` on job failure with the error details.
   - Passes the child logger to the processor function.

### Acceptance Criteria

- [ ] `getTraceId()` returns the correct `traceId` when called inside `runWithTraceContext()`
- [ ] `getTraceId()` returns `'no-trace'` when called outside any trace context
- [ ] `withTraceContext()` wrapper generates a unique `traceId` per invocation and makes it available via `getTraceId()` throughout the handler
- [ ] Worker `createJobProcessor()` extracts `traceId` from job data and binds it to AsyncLocalStorage
- [ ] Worker `createJobProcessor()` generates a new `traceId` when `job.data.traceId` is absent
- [ ] Worker job start/complete/error lifecycle events are logged with `traceId`, `tenantId`, `jobName`, `jobId`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Sentry breadcrumb integration (Prompt 3)
- OTel span correlation (Prompt 4)
- Realtime (Socket.io) trace context (Phase 1G — realtime events carry `traceId` from originating web request)
- BullMQ queue setup or actual job definitions (Phase 1G and later phases)

---

## Prompt 3: Sentry Integration for Web App and Worker

**Depends on:** Prompt 2 (traceId available via `getTraceId()`)
**Load context:** `observability.md` (full, 173 lines) — Error Tracking (Sentry) section. `compliance.md` lines 308–319 (Subprocessor Registry — Sentry DPA reference)
**Target files:**
- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/sentry.edge.config.ts`
- `apps/web/src/app/global-error.tsx`
- `apps/worker/src/lib/sentry.ts`
- `apps/web/next.config.ts` (Sentry webpack plugin for source maps)
- `.env.example` (add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`)
**Migration required:** No
**Git:** Commit with message `feat(observability): integrate Sentry error tracking with traceId correlation [Phase 1D, Prompt 3]`

### Schema Snapshot

N/A — no schema changes.

### Task

Integrate Sentry for error tracking across the web app and worker. Every Sentry event must carry the `traceId` for cross-reference with Pino structured logs.

**Web app Sentry setup:**

1. Install `@sentry/nextjs`. Configure three Sentry config files as required by the Next.js SDK:
   - `sentry.client.config.ts` — client-side initialization. Enable `BrowserTracing` integration for performance monitoring. Set `tracesSampleRate` to `0.1` in production, `1.0` in development.
   - `sentry.server.config.ts` — server-side initialization. Attach `traceId` to every event via `beforeSend` callback: read `getTraceId()` and set it as a tag `trace_id` on the event.
   - `sentry.edge.config.ts` — Edge runtime initialization (minimal — just DSN and environment).

2. Configure custom tags on all events:
   - `trace_id`: from `getTraceId()`
   - `tenant_id`: from `getTenantIdFromTrace()` (when available)
   - `feature`: set by feature-level code when initiating an operation (e.g., `'sync'`, `'automation'`, `'ai'`) — provide a `setSentryFeatureTag(feature: string)` utility for this

3. Create `apps/web/src/app/global-error.tsx` — the Next.js App Router global error boundary. It should:
   - Call `Sentry.captureException(error)` with the `traceId` context
   - Render a user-friendly error page: "Something went wrong. Please try again." with a "Report Issue" link that includes the `traceId`
   - Provide a "Try Again" button that calls `reset()`

4. Update `next.config.ts` to wrap with `withSentryConfig()` for automatic source map upload on deploy. Use environment variables for `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Disable source map upload when env vars are not set (development).

**Worker Sentry setup (`apps/worker/src/lib/sentry.ts`):**

1. Install `@sentry/node` for the worker process.
2. Create `initWorkerSentry()` function that initializes Sentry with the worker DSN.
3. Export `captureJobError(error: Error, job: { name: string; id: string; traceId?: string; tenantId?: string })` — captures the error with `trace_id`, `tenant_id`, `job_name`, and `job_id` as tags.
4. Integrate with `createJobProcessor()` from Prompt 2: on job failure, call `captureJobError()` before logging the error. Update the job wrapper to include this call.

**Environment variables (add to `.env.example`):**
- `SENTRY_DSN` — Sentry project DSN (empty disables Sentry)
- `SENTRY_AUTH_TOKEN` — for source map uploads (CI/deploy only)
- `SENTRY_ORG` — Sentry organization slug
- `SENTRY_PROJECT` — Sentry project slug
- `SENTRY_ENVIRONMENT` — `development`, `staging`, or `production`

### Acceptance Criteria

- [ ] Sentry client config initializes in browser with `BrowserTracing`
- [ ] Sentry server config attaches `trace_id` tag to events via `beforeSend`
- [ ] `global-error.tsx` renders error UI and reports to Sentry with `traceId`
- [ ] Worker `captureJobError()` sends error to Sentry with job metadata tags
- [ ] `setSentryFeatureTag()` utility sets the `feature` tag on the current Sentry scope
- [ ] Sentry is disabled gracefully when `SENTRY_DSN` is empty (no errors thrown)
- [ ] `.env.example` includes all Sentry environment variables with comments
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new utility files

### Do NOT Build

- Performance monitoring dashboards or custom Sentry alerts (operational)
- Sentry for realtime service (Phase 1G — Socket.io server)
- User feedback dialog beyond the basic "Report Issue" link
- Sentry Replay or Session Replay features
- Sentry cron monitoring for BullMQ jobs (post-MVP operational)

---

## Prompt 4: OpenTelemetry Auto-Instrumentation with Console Exporter

**Depends on:** Prompt 2 (traceId context — OTel spans correlate with the same traceId)
**Load context:** `observability.md` (full, 173 lines) — Distributed Tracing (OpenTelemetry) section
**Target files:**
- `packages/shared/telemetry/otel.ts`
- `packages/shared/telemetry/index.ts`
- `apps/web/instrumentation.ts` (Next.js instrumentation hook)
- `apps/worker/src/lib/otel-init.ts`
- `packages/shared/telemetry/otel.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(telemetry): add OpenTelemetry auto-instrumentation with console exporter [Phase 1D, Prompt 4]`

### Schema Snapshot

N/A — no schema changes.

### Task

Set up OpenTelemetry distributed tracing with auto-instrumentation for HTTP requests, PostgreSQL queries (via `pg` driver used by Drizzle), and Redis operations (via `ioredis`). Use the console exporter for development — production OTLP exporters are an operational concern configured later.

**OTel SDK setup (`packages/shared/telemetry/otel.ts`):**

1. Install `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/sdk-trace-base`.

2. Create `initTelemetry(options: { serviceName: string; environment?: string })` function that:
   - Creates an `NodeSDK` instance with:
     - `resource`: service name and environment from options
     - `traceExporter`: Console exporter when `OTEL_EXPORTER_OTLP_ENDPOINT` is not set. OTLP HTTP exporter when the env var IS set (future production use).
     - `instrumentations`: Use `getNodeAutoInstrumentations()` with configuration to enable HTTP, `pg`, and `ioredis` instrumentations. Disable noisy instrumentations (fs, dns) to reduce span volume.
   - Calls `sdk.start()` to begin auto-instrumentation.
   - Returns a shutdown function for graceful cleanup.

3. Correlate OTel spans with the `traceId` from AsyncLocalStorage: Add a `SpanProcessor` that reads `getTraceId()` and sets it as a span attribute `app.trace_id`. This allows OTel traces to be cross-referenced with Pino logs and Sentry events using the same identifier.

**Web app instrumentation (`apps/web/instrumentation.ts`):**

1. Use the Next.js `instrumentation.ts` hook (stable in Next.js 15+):
   ```typescript
   export async function register() {
     if (process.env.NEXT_RUNTIME === 'nodejs') {
       const { initTelemetry } = await import('@everystack/shared/telemetry');
       initTelemetry({ serviceName: 'everystack-web', environment: process.env.NODE_ENV });
     }
   }
   ```

**Worker OTel init (`apps/worker/src/lib/otel-init.ts`):**

1. Call `initTelemetry({ serviceName: 'everystack-worker' })` at worker process startup (before any BullMQ processors are registered).
2. Store the shutdown function and call it on `SIGTERM`/`SIGINT` for clean span flushing.

### Acceptance Criteria

- [ ] `initTelemetry()` creates and starts an OTel `NodeSDK` instance without errors
- [ ] Console exporter is used when `OTEL_EXPORTER_OTLP_ENDPOINT` is not set
- [ ] OTLP exporter is used when `OTEL_EXPORTER_OTLP_ENDPOINT` is set
- [ ] HTTP, `pg`, and `ioredis` instrumentations are enabled
- [ ] Noisy instrumentations (fs, dns) are disabled
- [ ] Custom `SpanProcessor` attaches `app.trace_id` attribute from AsyncLocalStorage
- [ ] Web `instrumentation.ts` calls `initTelemetry()` only in Node.js runtime (not Edge)
- [ ] Worker calls `initTelemetry()` at startup and shuts down cleanly on process signals
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on `otel.ts`

### Do NOT Build

- Production OTLP exporter configuration for Grafana Tempo, Datadog, or Jaeger (operational — configured via env vars at deployment)
- AI telemetry columns or AI-specific span instrumentation (Phase 1H)
- Realtime service (Socket.io) OTel instrumentation (Phase 1G)
- Custom span creation helpers — auto-instrumentation covers the critical paths
- Dashboard or visualization of traces (operational)

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify the full observability stack integrates correctly — logging, trace correlation, Sentry, and OTel all work together.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass, including new logging and trace-context tests
4. `pnpm turbo test -- --coverage` — thresholds met, ≥80% on new files

Manual verification:
5. Start the dev environment (`pnpm dev` or Docker Compose). Confirm:
   - Web app starts without errors. Console shows Pino structured JSON logs with `service: 'web'`.
   - A request to any route produces a log entry with `traceId` in the JSON output.
   - The `X-Trace-Id` response header is present on HTTP responses.
   - OTel console output shows span data for HTTP requests (if console exporter is active).
   - Triggering an unhandled error in development shows the `global-error.tsx` error boundary.

**Git:** Commit with message `chore(verify): integration checkpoint 1 — observability stack verified [Phase 1D, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Typed Error Class Hierarchy with HTTP Status Mapping

**Depends on:** None (standalone — uses the `AppError` interface defined in CLAUDE.md)
**Load context:** `CLAUDE.md` § Error Handling — Default Patterns (lines 268–306 in the project root file — auto-loaded). `compliance.md` lines 32–36 (Core Principle — error handling as compliance foundation)
**Target files:**
- `packages/shared/errors/index.ts`
- `packages/shared/errors/errors.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(errors): create typed error class hierarchy with HTTP status mapping [Phase 1D, Prompt 5]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the shared typed error classes that all EveryStack services use. These replace ad-hoc error throwing with a consistent, typed system. The `PermissionDeniedError` from Phase 1C already exists — integrate it into this hierarchy as `ForbiddenError`.

**Base error class (`AppError`):**

```typescript
export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;
  readonly traceId?: string;
}
```

The `traceId` is populated automatically from `getTraceId()` at construction time.

**Concrete error classes:**

| Class | Code | HTTP Status | Usage |
|-------|------|-------------|-------|
| `ValidationError` | `VALIDATION_FAILED` | 422 | Zod validation failures, malformed input |
| `NotFoundError` | `NOT_FOUND` | 404 | Record/entity not found, cross-tenant access (prevents enumeration) |
| `ForbiddenError` | `PERMISSION_DENIED` | 403 | Insufficient role/permission |
| `ConflictError` | `CONFLICT` | 409 | Concurrent modification, duplicate creation |
| `RateLimitedError` | `RATE_LIMITED` | 429 | Rate limit exceeded |
| `InternalError` | `INTERNAL_ERROR` | 500 | Unexpected server error (wraps unknown errors) |

Each class accepts `(message: string, details?: Record<string, unknown>)` in its constructor.

**HTTP status mapping utility:**

Export `getHttpStatus(error: AppError): number` and `toErrorResponse(error: AppError): { error: { code: string; message: string; details?: Record<string, unknown>; traceId?: string } }` for use in API routes and Server Action error boundaries.

The `toErrorResponse()` function:
- Always includes `code` and `message`
- Includes `details` if present
- Includes `traceId` only for 500 errors (never expose internal trace data on client errors)
- For `ForbiddenError` on portal routes: omit `details` and `traceId` entirely (never expose internals to portal clients — per CLAUDE.md)

**Migration of `PermissionDeniedError`:**

Phase 1C created `PermissionDeniedError`. Refactor it to extend the new `ForbiddenError` class (or replace it with `ForbiddenError` directly, aliasing the old name for backward compatibility). Update Phase 1C's `requireRole()` to throw `ForbiddenError` instead. Verify existing tests still pass.

### Acceptance Criteria

- [ ] `AppError` base class includes `code`, `statusCode`, `details`, and auto-populated `traceId`
- [ ] All six concrete error classes construct correctly with message and optional details
- [ ] `getHttpStatus()` returns the correct HTTP status for each error type
- [ ] `toErrorResponse()` formats the error into the API response shape from CLAUDE.md
- [ ] `toErrorResponse()` includes `traceId` only for 500 errors
- [ ] `PermissionDeniedError` from Phase 1C is refactored into the new hierarchy — existing tests pass
- [ ] Unknown errors wrapped in `InternalError` do not expose internal messages — generic "An unexpected error occurred" message
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Server Action error boundary middleware (Phase 3 — Core UX, when Server Actions are used)
- Platform API error formatting middleware (Phase 1I — API Auth Skeleton)
- Portal-specific error formatting (Phase 3E — Portals)
- Error UI components (toasts, inline errors) — those are UI concerns in Core UX
- Error logging integration with Pino/Sentry — callers handle logging at their level

---

## Prompt 6: Security Headers Middleware and Webhook Signature Verification

**Depends on:** None (standalone — modifies Next.js middleware and creates verification utilities)
**Load context:** `compliance.md` lines 127–196 (Security Headers — Platform and Portal CSP), lines 219–227 (Webhook Signatures — Clerk verification)
**Target files:**
- `apps/web/src/middleware.ts` (add security headers — extend existing Clerk middleware)
- `packages/shared/webhooks/verify-signature.ts`
- `packages/shared/webhooks/verify-signature.test.ts`
- `apps/web/src/middleware.test.ts` (or equivalent integration test for header assertions)
**Migration required:** No
**Git:** Commit with message `feat(security): add security headers middleware and webhook signature verification [Phase 1D, Prompt 6]`

### Schema Snapshot

N/A — no schema changes.

### Task

**Security headers — two profiles in Next.js middleware:**

The existing `middleware.ts` from Phase 1C handles Clerk auth. Extend it to inject security headers on every response. Use two header profiles based on the request path:

**Platform headers** (routes matching `/w/*`, `/api/*`, and all other non-portal routes):

```typescript
const PLATFORM_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self)',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.clerk.dev https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://img.clerk.com https://files.everystack.com",
    "connect-src 'self' https://api.clerk.dev https://api.stripe.com wss://*.everystack.com",
    "frame-src https://js.stripe.com",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};
```

**Portal headers** (routes matching `/portal/*`):

```typescript
const PORTAL_HEADERS = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://js.stripe.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://files.everystack.com",
    "connect-src 'self' wss://*.everystack.com",
    "frame-src https://js.stripe.com",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; '),
};
```

Implementation approach:
- In the middleware response handler, determine which profile applies based on `request.nextUrl.pathname`.
- Apply the appropriate header set to the `NextResponse`.
- Ensure headers are applied even on redirects and rewrites.

**Webhook signature verification (`packages/shared/webhooks/verify-signature.ts`):**

Create a reusable HMAC signature verification utility for inbound webhooks. MVP — Foundation only verifies Clerk webhooks (via SVIX). Stripe and Resend verification ship in later phases.

1. `verifyClerkWebhook(payload: string, headers: { 'svix-id': string; 'svix-timestamp': string; 'svix-signature': string }, secret: string): boolean` — Uses the `svix` package to verify Clerk webhook signatures. Returns `true` if valid, `false` if invalid.

2. Wrap the existing Clerk webhook handler (from Phase 1C) to call `verifyClerkWebhook()` before processing. On verification failure: return HTTP 401, log a warning via Pino with `{ action: 'webhook_verification_failed', provider: 'clerk' }`, and report to Sentry as a warning-level event.

3. Export a generic `verifyHmacSignature(payload: string, signature: string, secret: string, algorithm?: string): boolean` utility that future webhook verifiers (Stripe, Resend) can use. Default algorithm: `sha256`.

### Acceptance Criteria

- [ ] Platform routes (`/w/*`, `/api/*`) receive all six security headers including the full CSP
- [ ] Portal routes (`/portal/*`) receive the portal-specific header set with `X-Frame-Options: SAMEORIGIN` (not DENY)
- [ ] `Strict-Transport-Security` has `preload` on platform routes but not portal routes
- [ ] CSP on platform routes includes Clerk and Stripe script sources
- [ ] CSP on portal routes does NOT include Clerk script source
- [ ] `verifyClerkWebhook()` returns `true` for a validly signed payload and `false` for tampered payloads
- [ ] Clerk webhook handler rejects requests with invalid signatures (HTTP 401)
- [ ] Invalid signature attempts are logged with Pino and reported to Sentry
- [ ] `verifyHmacSignature()` correctly validates SHA-256 HMAC signatures
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Portal cookie security attributes (post-MVP — Portals & Apps)
- Portal-specific CSP for custom domains (post-MVP)
- Stripe webhook verification integration (post-MVP — Comms & Polish)
- Resend webhook verification integration (post-MVP — Documents)
- WAF configuration (Cloudflare, not application code)
- CSP violation reporting endpoint (`report-uri`) — operational concern

---

## Prompt 7: PII Registry, Encryption Verification, security.txt, and Vulnerability Scanning Config

**Depends on:** None (standalone — creates compliance utilities and config files)
**Load context:** `compliance.md` lines 64–100 (PII Handling — PII Registry, Anonymization Cascade, Logging Redaction), lines 102–125 (Encryption — At Rest, In Transit), lines 296–305 (Vulnerability Management — Dependabot, npm audit, eslint-plugin-security, security.txt)
**Target files:**
- `packages/shared/compliance/pii-registry.ts`
- `packages/shared/compliance/pii-registry.test.ts`
- `packages/shared/compliance/index.ts`
- `public/.well-known/security.txt` (or `apps/web/public/.well-known/security.txt`)
- `.github/dependabot.yml`
- `eslint.config.js` or `.eslintrc` (add `eslint-plugin-security`)
- `.env.example` (add encryption-related env var comments)
**Migration required:** No
**Git:** Commit with message `feat(compliance): add PII registry, encryption verification, security.txt, vulnerability scanning [Phase 1D, Prompt 7]`

### Schema Snapshot

Referenced (read-only) — PII columns from `compliance.md` § PII Registry:

```
users:          email, name, avatar_url, preferences — Anonymize on deletion
workspace_memberships: user_id (FK) — Retain with anonymized user
records:        canonical_data (may contain PII) — Tenant-owned, not deleted on user deletion
thread_messages: sender_id, content — Anonymize sender, retain content
ai_usage_log:   user_id, prompt content — Delete rows on user deletion
command_bar_sessions: user_id, history — Delete entirely on user deletion
audit_log:      actor_id, action details — Anonymize actor, retain action
```

### Task

**PII registry (`packages/shared/compliance/pii-registry.ts`):**

1. Create a typed PII registry that maps table names to their PII columns and the required action on user deletion. This is a data structure, not active enforcement — it serves as the source of truth for future GDPR deletion cascade implementation.

```typescript
interface PiiColumnDef {
  column: string;
  sensitivity: 'direct' | 'indirect' | 'sensitive';
  onUserDeletion: 'anonymize' | 'delete' | 'retain';
  anonymizeTo?: string; // The replacement value, e.g., 'deleted_user_<hash>'
}

interface PiiTableEntry {
  table: string;
  columns: PiiColumnDef[];
}
```

2. Populate the registry with all PII-bearing tables from `compliance.md` § PII Registry. Include both MVP tables and those that will hold PII in later phases.

3. Export a `getPiiColumnsForTable(tableName: string): PiiColumnDef[]` lookup function.

4. Export a `getAllPiiTables(): PiiTableEntry[]` function for compliance auditing.

5. Add JSDoc comments documenting that the anonymization cascade runs on the Clerk `user.deleted` webhook (implementation is post-MVP — Portals & Apps phase) but the registry is defined now per compliance.md's "design for compliance now, enforce progressively" principle.

**Encryption verification:**

1. Add comments and documentation to `.env.example` for encryption-related environment variables:
   - `DATABASE_URL` — must use `sslmode=require` in production
   - `REDIS_URL` — must use `rediss://` protocol in production (TLS)
   - Note that R2/S3 server-side encryption is configured at the bucket level (not in app code)

2. Create a `packages/shared/compliance/verify-encryption.ts` utility with:
   - `verifyDatabaseTls(connectionString: string): boolean` — checks that the connection string includes `sslmode=require` or `sslmode=verify-full`
   - `verifyRedisTls(redisUrl: string): boolean` — checks that the URL starts with `rediss://`
   - These are called at startup in production to fail fast if TLS is misconfigured. In development, they log a warning but do not block startup.

**security.txt:**

Create `apps/web/public/.well-known/security.txt` following the RFC 9116 format:

```
Contact: security@everystack.com
Expires: [one year from now, ISO 8601]
Preferred-Languages: en
Canonical: https://everystack.com/.well-known/security.txt
Policy: https://everystack.com/security
```

**Vulnerability scanning configuration:**

1. Create `.github/dependabot.yml` with:
   - npm ecosystem update checks (weekly)
   - Docker ecosystem update checks (weekly)
   - GitHub Actions ecosystem update checks (weekly)

2. Install and configure `eslint-plugin-security` in the ESLint config:
   - Enable the `recommended` ruleset
   - This adds SAST-basic checks (detect-eval, detect-non-literal-regexp, detect-unsafe-regex, etc.)

3. Add `npm audit --audit-level=high` as a CI step note in a comment within the existing GitHub Actions workflow file (actual CI modification is a config concern — document what should be added).

### Acceptance Criteria

- [ ] PII registry contains entries for all 7 PII-bearing tables from compliance.md
- [ ] `getPiiColumnsForTable('users')` returns the correct 4 PII columns with anonymization strategies
- [ ] `getPiiColumnsForTable('nonexistent_table')` returns an empty array
- [ ] `getAllPiiTables()` returns the full registry
- [ ] `verifyDatabaseTls()` returns `true` for connection strings with `sslmode=require` and `false` without
- [ ] `verifyRedisTls()` returns `true` for `rediss://` URLs and `false` for `redis://` URLs
- [ ] `security.txt` exists at the correct public path and contains required fields
- [ ] `.github/dependabot.yml` configures npm, Docker, and GitHub Actions ecosystem monitoring
- [ ] `eslint-plugin-security` recommended rules are active in ESLint config — `pnpm turbo lint` passes
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Active anonymization cascade execution (post-MVP — Portals & Apps implements the Clerk `user.deleted` webhook handler)
- GDPR data export endpoint (post-MVP)
- Cookie consent mechanism (post-MVP — Portals & Apps)
- Trivy container scanning or Semgrep SAST (post-MVP)
- Data residency routing or `data_region` column logic (post-MVP)
- SOC 2 readiness tooling (post-MVP)

---

## Integration Checkpoint 2 — Final (after Prompts 1–7)

**Task:** Verify the complete Phase 1D — observability and security hardening — integrates correctly with all prior phases.

Run:
1. `pnpm turbo typecheck` — zero errors across all packages
2. `pnpm turbo lint` — zero errors (including new `eslint-plugin-security` rules)
3. `pnpm turbo test` — all pass, including:
   - Pino logger tests (PII redaction, log levels, child loggers)
   - Trace context tests (AsyncLocalStorage, getTraceId)
   - Worker job wrapper tests (traceId extraction, lifecycle logging)
   - Error class tests (construction, HTTP mapping, toErrorResponse)
   - Webhook verification tests (valid/invalid signatures)
   - PII registry tests (lookup, completeness)
   - Encryption verification tests (TLS detection)
4. `pnpm turbo test -- --coverage` — all thresholds met:
   - `packages/shared/logging/` — ≥80% lines
   - `packages/shared/errors/` — ≥80% lines
   - `packages/shared/telemetry/` — ≥80% lines
   - `packages/shared/compliance/` — ≥80% lines
   - `packages/shared/webhooks/` — ≥80% lines
5. Phase 1C tests still pass (verify `PermissionDeniedError` refactor didn't break existing role checks)

Manual verification:
6. Start the dev environment. Confirm:
   - All three services (web, worker, realtime) start without errors
   - Web request logs show structured JSON with `traceId`, `tenantId`, `service: 'web'`
   - Security headers appear on platform routes (check with `curl -I http://localhost:3000/w/test`)
   - Security headers appear on portal routes with the portal-specific CSP
   - `security.txt` is accessible at `http://localhost:3000/.well-known/security.txt`
   - Clerk webhook endpoint rejects a request with an invalid `svix-signature` (return 401)
7. Verify `.github/dependabot.yml` is valid YAML

**Git:** Commit with message `chore(verify): integration checkpoint 2 — Phase 1D complete [Phase 1D, CP-2]`, then push branch to origin.

**PR:** Open PR to `main` with title "Phase 1D — Observability, Security Hardening". Description should list all 7 prompt deliverables:
1. Pino logger package with PII redaction
2. AsyncLocalStorage traceId with pino-http and worker job wrapper
3. Sentry integration for web and worker
4. OpenTelemetry auto-instrumentation
5. Typed error class hierarchy
6. Security headers middleware and webhook signature verification
7. PII registry, encryption verification, security.txt, vulnerability scanning

Tag after merge: `v0.1.3-phase-1d`

Fix any failures before opening the PR.
