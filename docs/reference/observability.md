# Observability & Telemetry

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Noted workspace-map.md cross-reference as post-MVP feature context. (2) Tagged "embedding job metrics" in MVP — Core UX as post-MVP per glossary (vector embeddings are post-MVP).

> Pino structured logging, Sentry error tracking, OpenTelemetry tracing, AI telemetry, monitoring dashboards, alerting rules, and runbook references.
> Cross-references: `workspace-map.md` _(post-MVP)_ (error indicators on sync source and automation nodes sourced from observability — sync failures, automation failures surfaced as red dot status indicators on map nodes)
> Last updated: 2026-02-27 — Glossary reconciliation (see note above). Prior: 2026-02-21 — Added `workspace-map.md` cross-reference (error indicators on map nodes).

---

## Stack

| Layer               | Tool                                          | Purpose                                                    |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Structured logging  | **Pino** + `pino-http`                        | Request/job lifecycle, sync events, AI calls               |
| Error tracking      | **Sentry** (`@sentry/nextjs`, `@sentry/node`) | Unhandled exceptions, performance monitoring               |
| Distributed tracing | **OpenTelemetry**                             | Request flow across web → worker → real-time               |
| AI telemetry        | Custom columns on `ai_usage_log`              | Provider/model performance, cache hit rates, cost tracking |

---

## Logging Architecture

Covers Logger Setup, Correlation via traceId, Log Levels, PII Redaction.

### Logger Setup

Pino logger instance created per service in `packages/shared/logging/`. Child loggers created per request/job with bound `traceId` and `tenantId`.

```typescript
// Every request/job:
const logger = parentLogger.child({ traceId: getTraceId(), tenantId });
logger.info({ action: 'record.updated', recordId }, 'Record updated');
```

### Correlation via traceId

Every operation carries a `traceId` via `AsyncLocalStorage`:

- **Web:** Middleware generates `traceId` on inbound request, binds to `AsyncLocalStorage`
- **Worker:** BullMQ job wrapper extracts `traceId` from job data, binds to `AsyncLocalStorage`
- **Real-time:** Connection events carry `traceId` from the originating web request

`getTraceId()` is available everywhere in the call stack. All log entries, Sentry breadcrumbs, and OTel spans include it.

### Log Levels

| Level   | Usage                                                        |
| ------- | ------------------------------------------------------------ |
| `error` | Unhandled failures, data corruption risks                    |
| `warn`  | Retry-worthy failures, rate limits hit, degraded responses   |
| `info`  | Request lifecycle, job start/complete, sync events, AI calls |
| `debug` | Query details, payload shapes — local dev only               |

### PII Redaction

Pino redaction paths configured for: `password`, `token`, `authorization`, `cookie`, `email`, `name`. Extended to redact PII in structured log fields.

**Rules:**

- Never log full record data, auth tokens, or PII
- Log record IDs, tenant IDs, and field IDs only
- External API logging: target, method, status code, latency, `traceId`. Response bodies at `debug` only.

**Log retention:** 90 days in production, then purged.

---

## Error Tracking (Sentry)

- DSN configured per environment
- Source maps uploaded on deploy
- `traceId` attached to every Sentry event for cross-reference with Pino logs
- Performance monitoring enabled for web (transaction tracing on routes)
- Custom tags: `tenantId`, `userId`, `feature` (for per-feature error grouping)

---

## Distributed Tracing (OpenTelemetry)

OpenTelemetry SDK initialized with auto-instrumentation for HTTP, `pg` (Drizzle queries), and `ioredis`.

| Environment | Exporter                                 |
| ----------- | ---------------------------------------- |
| Development | Console exporter (traces to stdout)      |
| Staging     | OTLP exporter → Jaeger or Grafana Tempo  |
| Production  | OTLP exporter → Grafana Tempo or Datadog |

**What's traced:** Every HTTP request (web), every BullMQ job (worker), every Socket.io event relay (real-time), every database query (via pg instrumentation), every Redis operation, every external API call.

---

## AI Telemetry

Extended columns on `ai_usage_log` capture per-call diagnostics:

| Column                                          | Purpose                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `provider`                                      | Which provider handled the call                                                    |
| `model_version`                                 | Exact model string                                                                 |
| `input_tokens`, `output_tokens`                 | Token counts                                                                       |
| `cache_read_tokens`, `cache_write_tokens`       | Prompt cache metrics (nullable)                                                    |
| `prompt_template_id`, `prompt_template_version` | Which template was used                                                            |
| `latency_ms`                                    | Total round-trip time                                                              |
| `time_to_first_token_ms`                        | Streaming TTFT (nullable)                                                          |
| `status`                                        | `success`, `error`, `timeout`, `rate_limited`, `credit_exhausted`, `fallback_used` |
| `error_code`                                    | Provider error code on failure (nullable)                                          |

This makes `ai_usage_log` both a billing ledger and a diagnostic tool. Queries like "average Sonnet latency this week" or "cache hit rate by feature" are single-table aggregations.

---

## Monitoring Dashboards

Covers Dashboard 1: Platform Health, Dashboard 2: Sync Engine, Dashboard 3: AI Economics, Dashboard 4: Real-Time.

### Dashboard 1: Platform Health

| Metric                         | Source               | Alert                   |
| ------------------------------ | -------------------- | ----------------------- |
| Web app p95 response time      | OTel                 | > 500ms sustained 5 min |
| Worker job processing latency  | BullMQ metrics       | > 30s for P0 jobs       |
| DB connection pool utilization | PgBouncer stats      | > 80%                   |
| DB replication lag             | PostgreSQL streaming | > 10 seconds            |
| Redis memory utilization       | Redis INFO           | > 80% maxmemory         |
| Error rate (5xx)               | Sentry               | > 1% of requests        |
| WebSocket connection count     | Socket.io metrics    | > 80% instance capacity |

### Dashboard 2: Sync Engine

| Metric                          | Source             | Alert                     |
| ------------------------------- | ------------------ | ------------------------- |
| Rate limiter capacity per scope | Redis ZSET         | < 20% sustained 5 min     |
| 429 responses per platform      | Worker logs        | > 5/hour per scope        |
| Sync staleness                  | Worker metrics     | > 15 min for P1 tables    |
| Per-tenant poll budget          | Sync scheduler     | Any tenant > 15% capacity |
| Retry storm detection           | BullMQ retry count | > 50 retries/min          |

### Dashboard 3: AI Economics

| Metric                      | Source           | Alert                           |
| --------------------------- | ---------------- | ------------------------------- |
| Per-tenant credit burn rate | ai_credit_ledger | 2× normal for any tenant        |
| Per-provider cost per call  | ai_usage_log     | Cost regression > 20%           |
| Prompt cache hit rate       | ai_usage_log     | Drop below 40%                  |
| Fallback chain activation   | AIService logs   | Any fallback > 5% of tier calls |
| Evaluation suite pass rate  | CI pipeline      | Drop below 95%                  |

### Dashboard 4: Real-Time

| Metric                          | Source            | Alert                                   |
| ------------------------------- | ----------------- | --------------------------------------- |
| Active connections per instance | Socket.io metrics | > 80% estimated capacity                |
| Room join/leave rate            | Event logs        | Sudden spike (possible reconnect storm) |
| Message fan-out latency         | OTel              | > 200ms p95                             |
| Presence TTL expiry rate        | Redis metrics     | Spike indicates connection instability  |

---

## Alerting Rules

| Severity     | Response              | Examples                                                            |
| ------------ | --------------------- | ------------------------------------------------------------------- |
| **Critical** | PagerDuty, immediate  | DB unreachable, all services 5xx, Redis OOM                         |
| **Warning**  | Slack channel, 30 min | Connection pool > 80%, sync stalled > 15 min, AI fallback rate > 5% |
| **Info**     | Dashboard only        | New tenant onboarded, weekly cost summary                           |

See `operations.md` for incident response runbooks.

---

## Phase Implementation

| Phase                     | Observability Work                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation          | Pino + `pino-http` + PII redaction, `getTraceId()` + AsyncLocalStorage, Sentry DSN per env, OTel auto-instrumentation (console exporter), AIService telemetry columns |
| MVP — Sync                | Sync engine dashboard metrics, rate limiter telemetry                                                                                                                 |
| MVP — Core UX             | AI economics dashboard, embedding job metrics _(post-MVP — vector embeddings)_                                                                                        |
| Post-MVP — Comms & Polish | Production dashboards deployed, alerting rules configured, real-time metrics, OTLP exporter to production backend                                                     |
