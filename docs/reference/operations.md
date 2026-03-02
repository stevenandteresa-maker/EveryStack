# Operations, Backup & Disaster Recovery

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Tagged cockroachdb-readiness.md cross-reference as post-MVP. (2) Added compliance.md to cross-references (referenced inline in Data Breach section). No naming drift found — all terms match glossary.

> Backup strategy, failover plans, RTO/RPO targets, monitoring dashboards, and incident response.
> Cross-references: `cockroachdb-readiness.md` _(post-MVP)_ (CockroachDB enterprise deployment, PgBouncer replacement, connection pooling changes), `compliance.md` (data breach notification procedures), `observability.md` (monitoring dashboards, alerting rules)
> Last updated: 2026-02-27 — Glossary reconciliation (see note above).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                       | Lines   | Covers                                                                                                                                                                                                                     |
| ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backup Strategy               | 30–106  | PostgreSQL WAL/daily/weekly backups, Redis RDB+AOF, R2/S3 versioning, backup testing drills (monthly/quarterly/annual), tenant-level PITR recovery, soft-delete implementation, per-plan retention                         |
| RTO/RPO Targets               | 110–121 | 4-tier recovery targets: Database (<1h/<1min), Cache (<5min), Services (<15min), Files (<1h/0)                                                                                                                             |
| Redis Failover Plan           | 125–142 | Per-environment failover: dev (restart), Railway/Render (managed), AWS ElastiCache (Multi-AZ, <30s failover, ioredis sentinel)                                                                                             |
| Monitoring Dashboards         | 146–178 | 3 dashboards: Platform Health (p95 latency, pool, replication, memory, errors), Sync Engine (rate limits, staleness, retries), AI Economics (credit burn, cost per call, cache hit, fallback, eval pass rate)              |
| Incident Response Runbook     | 182–206 | SEV-1 through SEV-4 definitions + response times, SEV-1 playbook (8 steps), data breach cross-reference to compliance.md                                                                                                   |
| BullMQ Queue Durability       | 210–236 | Redis AOF `everysec` persistence, RDB snapshots, what survives/doesn't survive crash, worker reconnection behavior                                                                                                         |
| Redis Multi-Tenancy Isolation | 240–395 | `volatile-lru` eviction (protects queues/rate limiters), per-tenant cache budgeting with code, pub/sub rate limiting (200 evt/s), connection management (21 total), memory sizing (100–50K tenants), Docker Compose config |
| Deployment Strategy           | 399–439 | Zero-downtime deploys for web/worker/real-time, rollback procedures, deploy order with migrations, reverse migration rule                                                                                                  |
| Secrets Management            | 443–479 | Secret storage per environment (dev/.env, Railway/Render, AWS Secrets Manager), full secret inventory with rotation schedules, 4 rules                                                                                     |
| Phase Implementation          | 483–491 | Operations work by phase — Foundation through Scale                                                                                                                                                                        |

---

## Backup Strategy

### PostgreSQL

| Method                         | Frequency            | Retention | Purpose                                                       |
| ------------------------------ | -------------------- | --------- | ------------------------------------------------------------- |
| **WAL Archiving (continuous)** | Continuous streaming | 7 days    | Point-in-time recovery (PITR) to any second within the window |
| **Automated daily snapshot**   | Daily at 03:00 UTC   | 30 days   | Fast full-database restore                                    |
| **Weekly full backup**         | Sunday 02:00 UTC     | 90 days   | Long-term recovery, compliance archive                        |

**WAL archiving** is the primary recovery mechanism. All writes are captured in the write-ahead log and streamed to object storage (R2/S3). Combined with the latest daily snapshot, this enables recovery to any point in time within the 7-day window.

**Implementation by environment:**

- **Railway/Render:** Use provider's managed backup (automated daily snapshots, point-in-time recovery if available). Supplement with `pg_dump` to R2 for independent copies.
- **AWS RDS:** Automated backups enabled (7-day retention), manual snapshots (weekly, 90-day retention). WAL archiving via RDS PITR. Cross-region snapshot copy for DR.

### Redis

Redis data falls into two categories with different recovery needs:

| Data Type                           | Examples                                       | Backup Strategy                                 |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| **Critical (must survive restart)** | BullMQ queues, rate limiter state              | RDB snapshots every 5 minutes + AOF persistence |
| **Ephemeral (rebuildable)**         | Presence state, portal cache, pub/sub channels | No backup needed. Rebuilt on restart.           |

**Implementation:** Redis configured with both RDB (periodic snapshots) and AOF (append-only file for write durability). On AWS ElastiCache: Multi-AZ replication enabled, automatic failover.

### Object Storage (R2/S3)

Object storage is inherently durable (11 nines on S3). No separate backup needed. Enable versioning for accidental overwrite protection (7-day version retention).

### Backup Testing

**Untested backups are not backups.** Recovery drills are scheduled and automated:

| Drill                      | Frequency | Procedure                                                                  | Pass Criteria                                                                   |
| -------------------------- | --------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **PITR restore**           | Monthly   | Restore WAL archive to a throwaway instance, run data integrity checks     | All tables present, row counts match ±0.01%, application boots and serves reads |
| **Daily snapshot restore** | Quarterly | Restore latest daily snapshot to staging, run full test suite              | All tests pass, no schema drift                                                 |
| **Redis recovery**         | Quarterly | Kill Redis on staging, observe BullMQ reconnection and queue recovery      | All in-flight jobs either complete or retry. Zero data loss in critical keys.   |
| **Full DR simulation**     | Annually  | Simulate primary region failure, execute full failover to secondary region | Platform operational in secondary region within RTO targets                     |

**Automation:** PITR restore drill runs as a monthly CI job. Spins up a temporary RDS instance (or Docker Postgres) from the latest WAL archive, runs a validation script (table counts, sample queries, schema hash comparison), tears down. Failure alerts the on-call engineer.

### Tenant-Level Recovery

A multi-tenant platform needs per-tenant recovery. Scenarios: customer accidentally bulk-deletes records, a bad automation corrupts a table, an admin requests a point-in-time rollback.

**Strategy: Logical export + PITR extraction.**

Full PITR restores the entire database — all tenants. To recover a single tenant:

1. Restore PITR to a **throwaway instance** at the desired point in time
2. Run a tenant-scoped `COPY` or `pg_dump --table` filtered by `tenant_id` to extract that tenant's data
3. Import the extracted data into the live database, replacing the tenant's current state
4. Verify via audit log that the restore is consistent

**Soft-delete as first defense:** Before restoring from backup, check the audit log. `record.deleted` entries within the last 7 days include the deleted record's `entity_id`. If the deletion was recent and the data is still in the recycle bin (soft-delete with 30-day retention), restore from there — no backup needed.

**Soft-delete implementation:**

Records are not physically deleted on user action. Instead:

- `deleted_at TIMESTAMPTZ` column added to `records` table
- User "delete" sets `deleted_at = NOW()`, record disappears from all queries (filtered in `/data` layer)
- Physical deletion runs as a daily cleanup job: delete records where `deleted_at < NOW() - INTERVAL '30 days'`
- "Undo delete" within 30 days: clear `deleted_at`, record reappears
- Audit log tracks both the soft-delete and any undo

**Scope by plan:**

| Plan         | Soft-Delete Retention | PITR Window               | Tenant-Level Restore             |
| ------------ | --------------------- | ------------------------- | -------------------------------- |
| Freelancer   | 7 days                | N/A (daily snapshot only) | Manual request to support        |
| Starter      | 14 days               | N/A (daily snapshot only) | Manual request to support        |
| Professional | 30 days               | 7 days                    | Manual request to support        |
| Business     | 30 days               | 7 days                    | Self-service (admin panel)       |
| Enterprise   | 90 days               | 30 days                   | Self-service + dedicated support |

---

## RTO/RPO Targets

| Tier                  | RTO (Recovery Time) | RPO (Recovery Point) | Applies To                    |
| --------------------- | ------------------- | -------------------- | ----------------------------- |
| **Tier 1 — Database** | < 1 hour            | < 1 minute (PITR)    | PostgreSQL (all tenant data)  |
| **Tier 2 — Cache**    | < 5 minutes         | < 5 minutes (RDB)    | Redis (queues, rate limiters) |
| **Tier 3 — Services** | < 15 minutes        | N/A (stateless)      | Web, Worker, Real-Time        |
| **Tier 4 — Files**    | < 1 hour            | 0 (durable storage)  | R2/S3 objects                 |

**Single-region failure scenario:** If the primary region goes down entirely, recovery involves: restore PostgreSQL from latest WAL archive (RPO <1 minute), deploy services in a new region (15 minutes with IaC), point DNS to new region. Total RTO: ~1 hour.

**Multi-region (post-MVP):** Active-active or active-passive with automated failover. RTO drops to <5 minutes with DNS failover.

---

## Redis Failover Plan

### Development

Single Redis instance. No failover. Restart Docker container if needed.

### Production (Railway/Render)

Use provider's managed Redis with automatic restart. If provider lacks replication: accept potential queue loss on crash (BullMQ jobs are idempotent by design — they'll be re-enqueued by their schedules).

### Production (AWS)

ElastiCache with Multi-AZ replication:

- Primary node in AZ-A, replica in AZ-B
- Automatic failover on primary failure (<30 seconds)
- BullMQ reconnects automatically via ioredis sentinel support
- Presence state (TTL-managed) self-heals — stale presence expires, clients re-establish on reconnect
- Rate limiter state temporarily lost on failover — conservative fallback (assume 50% capacity) until state rebuilds

---

## Monitoring Dashboards

### Dashboard 1: Platform Health

| Metric                               | Source                           | Alert Threshold               |
| ------------------------------------ | -------------------------------- | ----------------------------- |
| Web app p95 response time            | OpenTelemetry                    | > 500ms sustained 5 min       |
| Worker job processing latency        | BullMQ metrics                   | > 30s for P0 jobs             |
| Database connection pool utilization | PgBouncer stats                  | > 80%                         |
| Database replication lag             | PostgreSQL streaming replication | > 10 seconds                  |
| Redis memory utilization             | Redis INFO                       | > 80% of maxmemory            |
| Error rate (5xx responses)           | Sentry                           | > 1% of requests              |
| WebSocket connection count           | Socket.io metrics                | Approaching instance capacity |

### Dashboard 2: Sync Engine

| Metric                                   | Source             | Alert Threshold                |
| ---------------------------------------- | ------------------ | ------------------------------ |
| Rate limiter capacity per platform scope | Redis ZSET         | < 20% sustained 5 min          |
| 429 responses per platform               | Worker logs        | > 5/hour per scope             |
| Sync staleness (oldest unsynced record)  | Worker metrics     | > 15 min for P1 tables         |
| Per-tenant poll budget utilization       | Sync scheduler     | Any tenant > 15% of capacity   |
| Retry storm detection                    | BullMQ retry count | > 50 retries/min on sync queue |

### Dashboard 3: AI Economics

| Metric                                  | Source           | Alert Threshold                   |
| --------------------------------------- | ---------------- | --------------------------------- |
| Per-tenant credit burn rate             | ai_credit_ledger | 2x normal burn for any tenant     |
| Per-provider cost per call              | ai_usage_log     | Cost regression > 20% vs baseline |
| Cache hit rate (Anthropic prompt cache) | ai_usage_log     | Drop below 40%                    |
| Fallback chain activation rate          | AIService logs   | Any fallback > 5% of tier calls   |
| Evaluation suite pass rate              | CI pipeline      | Drop below 95% on any template    |

---

## Incident Response Runbook

### Severity Levels

| Level     | Definition                                  | Response Time     | Examples                                            |
| --------- | ------------------------------------------- | ----------------- | --------------------------------------------------- |
| **SEV-1** | Platform down, all tenants affected         | 15 min            | Database unreachable, all services crashing         |
| **SEV-2** | Major feature broken, many tenants affected | 30 min            | Sync engine stalled, AI service down, auth failures |
| **SEV-3** | Single tenant or minor feature affected     | 2 hours           | One tenant's portal returning errors, slow queries  |
| **SEV-4** | Cosmetic or non-urgent                      | Next business day | UI glitch, non-critical log errors                  |

### SEV-1 Playbook

1. Confirm scope: check all three services, database, Redis, external dependencies
2. Check recent deploys — rollback if deploy within last 2 hours
3. Check database: connection count, replication status, disk space
4. Check Redis: memory, connection count, queue depth
5. If database failure: initiate PITR recovery from WAL archive
6. If service failure: restart affected service, check crash logs in Sentry
7. Communicate status to affected users via status page
8. Post-incident review within 48 hours

### Data Breach Incidents

If an incident involves unauthorized access to tenant data (not just downtime), follow the **Data Breach Notification** procedure in `compliance.md > Data Breach Notification` in addition to the operational playbook above. Key difference: data breaches have a 72-hour GDPR notification deadline to supervisory authorities, and affected workspace admins and users must be notified.

---

## BullMQ Queue Durability

BullMQ stores all job data in Redis. If Redis crashes without persistence, all pending and in-progress jobs are lost. Configuration must ensure job survival.

**Required Redis persistence config for production:**

```
# redis.conf (or equivalent managed Redis settings)
appendonly yes                    # AOF enabled — every write is logged
appendfsync everysec              # Flush AOF to disk every second (1-second RPO for queue data)
save 300 10                       # RDB snapshot if 10+ writes in 300 seconds
save 60 10000                     # RDB snapshot if 10000+ writes in 60 seconds
```

**Why AOF `everysec`:** `always` guarantees zero data loss but adds latency to every Redis write (unacceptable for pub/sub and presence). `everysec` loses at most 1 second of writes on crash — acceptable because BullMQ jobs are idempotent and scheduled jobs will re-enqueue on their next interval.

**What survives a Redis crash:**

- All pending jobs in queues ✅ (persisted via AOF)
- Rate limiter state ✅ (Redis ZSETs persisted via AOF)
- In-progress jobs ✅ (BullMQ marks them stalled on reconnect, retries automatically)

**What does NOT survive:**

- Presence state (acceptable — TTL-managed, clients re-establish)
- Pub/sub channel subscriptions (acceptable — real-time service reconnects and resubscribes)
- Portal cache (acceptable — rebuilt from Postgres on next request)

**Worker reconnection:** ioredis (used by BullMQ) automatically reconnects with exponential backoff. On reconnect, BullMQ checks for stalled jobs (in-progress when crash occurred) and re-queues them. No manual intervention needed.

---

## Redis Multi-Tenancy Isolation

### The Problem

All tenants share a single Redis instance. Without isolation, one tenant's activity can degrade Redis for all tenants: a tenant with 500 cached portal pages can fill memory, a tenant with 50 active users generates massive pub/sub traffic, a bulk import triggers thousands of events per second.

### Eviction Policy: `volatile-lru`

**This is the foundation of Redis isolation.** Configured in `redis.conf`:

```
maxmemory 2gb                    # Set per environment (dev: 256mb, prod: 2-8gb)
maxmemory-policy volatile-lru    # ONLY evict keys that have a TTL, using LRU
```

**Why `volatile-lru`, not `allkeys-lru`:** BullMQ queue keys and rate limiter token buckets have **no TTL** — they must never be evicted. `allkeys-lru` would evict them under memory pressure, causing job loss and rate limit state corruption. `volatile-lru` guarantees only TTL-bearing keys (caches, presence) are evicted, naturally protecting queues and rate limiters.

**Enforcement:** Every cache key written by application code must include a TTL (`EX` or `PX`). A key without TTL is either a BullMQ internal or a rate limiter — both protected. If application code writes a cache key without TTL, it becomes a memory leak that `volatile-lru` cannot clean up. This rule is in root `CLAUDE.md`.

### Per-Tenant Cache Budgeting

Without budgets, a single tenant's cache can displace all other tenants' cache entries. Application-layer enforcement:

```typescript
// Before writing a tenant cache key:
const TENANT_CACHE_LIMITS: Record<PlanTier, number> = {
  freelancer: 500, // 500 cache keys max
  starter: 2_000,
  professional: 10_000,
  business: 50_000,
  enterprise: 200_000,
};

async function setTenantCache(tenantId: string, key: string, value: string, ttlSeconds: number) {
  const countKey = `cache:t:${tenantId}:__count`;
  const current = await redis.incr(countKey);

  if (current === 1) {
    // First key — set TTL on the counter itself (self-cleaning)
    await redis.expire(countKey, 3600); // Refresh hourly
  }

  const limit = TENANT_CACHE_LIMITS[await getTenantPlan(tenantId)];
  if (current > limit) {
    // Budget exceeded — don't write, decrement counter
    await redis.decr(countKey);
    logger.warn({ tenantId, cacheKey: key, limit }, 'Tenant cache budget exceeded');
    return;
  }

  await redis.set(`cache:t:${tenantId}:${key}`, value, 'EX', ttlSeconds);
}
```

**Not enforced via Redis itself** (Redis has no per-key-prefix memory limits). Application-layer counting is lightweight and sufficient. The counter key has its own TTL so it self-cleans if the tenant becomes inactive.

**Portal cache budget is separate:** Portal cache keys use `cache:portal:{portalId}:*` and are bounded by the number of portal pages (which is bounded by the portal definition). No additional counting needed — the portal cache invalidation system already manages lifecycle.

### Pub/Sub Noisy Neighbor Protection

Redis pub/sub is fire-and-forget — messages are delivered to subscribers and not stored. A tenant with high write volume (bulk imports, active automations) can generate thousands of events/second, consuming CPU for fan-out across all real-time service instances.

**Per-tenant event rate limiting:**

```typescript
// packages/shared/realtime/rate-limit.ts
const TENANT_EVENT_RATE = 200; // Max events per second per tenant

async function publishToRedis(channel: string, event: DomainEvent) {
  const tenantId = event.tenantId;
  const rateKey = `rl:pubsub:t:${tenantId}`;

  // Sliding window: INCR + EXPIRE (1-second window)
  const count = await redis.incr(rateKey);
  if (count === 1) await redis.expire(rateKey, 1);

  if (count > TENANT_EVENT_RATE) {
    // Drop the event — pub/sub consumers handle missed events gracefully
    // (UI uses TanStack Query polling as fallback, sync uses smart polling)
    logger.warn({ tenantId, channel, count }, 'Pub/sub rate limit exceeded, event dropped');
    return;
  }

  await redis.publish(channel, JSON.stringify(event));
}
```

**Why dropping is acceptable:** Real-time push is an optimization layer, not a source of truth. If a pub/sub event is dropped, the client's TanStack Query polling (5-second interval on active tables) picks up the change on its next tick. The sync engine uses its own polling schedule. Dropped events cause at most a brief delay in real-time UI updates — not data loss.

**200 events/second per tenant** is generous. A tenant with 20 concurrent users each editing once per second generates ~20 events/second. 200/s accommodates burst activity with 10x headroom. If exceeded (bulk import of 10,000 records), the excess is dropped and the UI refreshes via polling.

### Connection Management

All three services share a single Redis instance but use separate ioredis connection pools:

| Service       | Connection Purpose                                                                   | Pool Size (Default)                               |
| ------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| **Web app**   | Cache reads/writes, pub/sub publish                                                  | 5 connections                                     |
| **Worker**    | BullMQ job processing, rate limiter reads/writes, pub/sub publish                    | 10 connections (BullMQ uses 2 per queue + shared) |
| **Real-Time** | `@socket.io/redis-adapter` (2 connections), presence reads/writes, pub/sub subscribe | 6 connections                                     |
| **Total**     |                                                                                      | ~21 connections                                   |

**Why separate pools:** Each service has different usage patterns. The worker needs more connections for concurrent BullMQ queue processing. The real-time service's connections are long-lived (adapter subscriptions). Mixing them in a single pool would cause head-of-line blocking.

**ioredis configuration (shared):**

```typescript
// packages/shared/db/redis.ts
import Redis from 'ioredis';

export function createRedisClient(options?: Partial<Redis.RedisOptions>): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 5000), // Exponential backoff, max 5s
    enableReadyCheck: true,
    lazyConnect: false, // Connect immediately — fail fast if Redis is down
    ...options,
  });
}
```

**Connection scaling:** At 10K+ tenants, Redis connection count becomes a concern. `maxclients` on Redis defaults to 10,000. With 4 web instances + 2 workers + 2 real-time instances = ~168 connections. Well within limits even at scale.

### Memory Sizing Guidelines

| Tenants         | Estimated Redis Memory | Breakdown                                                                   |
| --------------- | ---------------------- | --------------------------------------------------------------------------- |
| 100 (dev/early) | 128–256 MB             | Queues: 20MB, Rate limiters: 5MB, Presence: 2MB, Cache: ~100MB              |
| 1,000           | 512 MB – 1 GB          | Queues: 50MB, Rate limiters: 20MB, Presence: 10MB, Cache: ~500MB            |
| 10,000          | 2–4 GB                 | Queues: 100MB, Rate limiters: 50MB, Presence: 50MB, Cache: ~2GB             |
| 50,000+         | 4–8 GB                 | Consider Redis Cluster for sharding, or offload cache to dedicated instance |

**Decision point:** At >4 GB Redis memory or >50K tenants, split Redis into two instances: one for queues + rate limiters (critical, persistent), one for cache + presence + pub/sub (evictable, ephemeral). BullMQ uses `REDIS_QUEUE_URL`, cache uses `REDIS_CACHE_URL`. This split can be done by changing env vars — no code changes if the Redis client factory is parameterized from day one.

### Docker Compose Configuration

```yaml
# docker-compose.yml — Redis service
redis:
  image: redis:7-alpine
  command: >
    redis-server
    --maxmemory 256mb
    --maxmemory-policy volatile-lru
    --appendonly yes
    --appendfsync everysec
    --save 300 10
    --save 60 10000
  ports:
    - '6379:6379'
  healthcheck:
    test: ['CMD', 'redis-cli', 'ping']
    interval: 10s
    timeout: 3s
    retries: 3
```

---

## Deployment Strategy

### Zero-Downtime Deploys

All three services (web, worker, real-time) must deploy without user-visible downtime.

**Web app (Next.js):**

- **Railway/Render:** Rolling deploy — new instance starts, health check passes, traffic shifts, old instance drains. Zero downtime natively.
- **AWS ECS:** Rolling update with minimum healthy percent = 100%, maximum percent = 200%. New task starts, passes ALB health check, old task drains connections.
- **Health check endpoint:** `GET /api/health` — returns 200 if the app can connect to Postgres (via pooler) and Redis. Used by load balancer and deployment orchestrator.

**Worker service:**

- **Graceful shutdown:** On SIGTERM, the worker stops accepting new jobs, waits for in-progress jobs to complete (up to 30-second grace period), then exits. BullMQ's `Worker.close()` handles this.
- **Deploy sequence:** Start new worker instance → verify it's processing jobs → send SIGTERM to old instance → old instance drains → done.
- **No job loss:** Jobs in progress complete on the old instance. New jobs are picked up by the new instance.

**Real-time service (Socket.io):**

- **Connection migration:** On deploy, existing WebSocket connections must gracefully move to the new instance. Socket.io's Redis adapter ensures events reach clients regardless of which instance they're connected to.
- **Deploy sequence:** Start new instance → it joins the Redis adapter → send SIGTERM to old instance → old instance closes connections with `server.close()` → clients auto-reconnect to the new instance (Socket.io built-in reconnection).
- **Brief reconnection window:** Clients experience a ~1–3 second reconnection during the old instance shutdown. This is acceptable — the client library handles it transparently.

### Rollback Procedure

| Trigger                               | Action                                                                                                                   | Timeline                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Crash loop on deploy                  | Automated rollback to previous image/commit (Railway/Render do this automatically)                                       | <2 minutes                                       |
| Feature regression caught post-deploy | Revert commit, trigger redeploy                                                                                          | <10 minutes                                      |
| Database migration broke something    | Apply reverse migration (must be pre-written for every migration). If irreversible, restore PITR to pre-migration point. | <30 minutes (migration revert) or <1 hour (PITR) |

**Rule: Every database migration must have a documented reverse migration.** Even if the reverse is "this is irreversible — PITR is the recovery path." Claude Code must create a `down` migration or a comment explaining why one isn't possible.

### Deploy Order (When Migrations Are Involved)

```
1. Run database migration (via direct connection, not pooler)
2. Deploy worker service (picks up new schema immediately)
3. Deploy web app (new code expects new schema)
4. Deploy real-time service (if affected)
```

**Why this order:** Migrations must complete before any service expects the new schema. Worker deploys first because it's backend-only (no user-visible impact if briefly processing with new schema while web is still on old code — the schema change must be backward-compatible per zero-downtime migration rules).

---

## Secrets Management

### Where Secrets Live

| Environment        | Storage                                                         | Access Pattern                                                 |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------- |
| **Development**    | `.env.local` files (git-ignored)                                | Loaded by Next.js / dotenv. Shared via 1Password team vault.   |
| **Railway/Render** | Platform environment variables (encrypted at rest)              | Injected at container start. Not in source control.            |
| **AWS**            | AWS Secrets Manager or SSM Parameter Store (encrypted with KMS) | Fetched at container start or via SDK at runtime for rotation. |

### Secret Inventory

| Secret                            | Services               | Rotation Schedule                                                 |
| --------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`                    | Web, Worker            | On credential rotation (quarterly or on breach)                   |
| `DATABASE_URL_DIRECT`             | Migrations only        | Same as above                                                     |
| `DATABASE_READ_URL`               | Web, Worker            | Same as above                                                     |
| `REDIS_URL`                       | Web, Worker, Real-Time | On credential rotation                                            |
| `CLERK_SECRET_KEY`                | Web                    | Via Clerk dashboard. Rotate annually.                             |
| `CLERK_WEBHOOK_SECRET`            | Web                    | Per-webhook endpoint                                              |
| `ANTHROPIC_API_KEY`               | Worker (via AIService) | Rotate quarterly. Zero-downtime: add new key, verify, remove old. |
| `RESEND_API_KEY`                  | Worker                 | Rotate annually                                                   |
| `STRIPE_SECRET_KEY`               | Web                    | Rotate on Stripe dashboard. Webhook signing secret separate.      |
| `STRIPE_WEBHOOK_SECRET`           | Web                    | Per-endpoint                                                      |
| `SENTRY_DSN`                      | All                    | Not a secret per se (safe to expose), but treated as config       |
| `R2_ACCESS_KEY` / `S3_ACCESS_KEY` | Worker, Web            | Rotate quarterly                                                  |
| `STORAGE_BUCKET`                  | Worker, Web            | Config, not secret — but per-environment                          |
| `STORAGE_ENDPOINT`                | Worker, Web            | R2 endpoint URL. Omit for native S3.                              |
| `STORAGE_PUBLIC_URL`              | Web                    | CDN base URL for public file serving                              |
| `GOTENBERG_URL`                   | Worker                 | Internal service URL, not a credential                            |

### Rules

1. **No secrets in source control.** Ever. `.env.local` is git-ignored. CI/CD uses platform-injected secrets.
2. **No secrets in Docker images.** Secrets are injected at runtime via environment variables, not baked into images.
3. **No secrets in Pino logs.** Pino redaction paths include: `password`, `token`, `authorization`, `cookie`, `secret`, `apiKey`, `api_key`. See `packages/shared/logging/CLAUDE.md`.
4. **Rotation must be zero-downtime.** For API keys, the pattern is: add new key as secondary → deploy with both keys accepted → remove old key. For database credentials, PgBouncer's `RELOAD` command applies new auth without dropping connections.

---

## Phase Implementation

| Phase                     | Operations Work                                                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation          | Docker Compose with health check endpoints (`/api/health`). `.env.example` with all required variables documented. PgBouncer monitoring query (`SHOW STATS`). `deleted_at` column on `records` table (soft-delete foundation). Graceful shutdown handler on worker service. |
| MVP — Sync                | Sync engine dashboard. Rate limiter alerting. Redis AOF+RDB persistence verified in Docker Compose.                                                                                                                                                                         |
| Post-MVP — Portals & Apps | Production deployment pipeline documented (deploy order, rollback procedure). Secrets in platform environment variables.                                                                                                                                                    |
| Post-MVP — Comms & Polish | Production backup automation (WAL archiving, daily snapshots). Redis failover configuration. All 3 monitoring dashboards deployed. Incident response runbook finalized. Status page. Monthly PITR restore drill automated.                                                  |
| Scale                     | Multi-region failover. Cross-region backup replication. Tenant-level self-service restore (Business+). Annual full DR simulation.                                                                                                                                           |
