---
name: everystack-test-runner
description: >
  Test environment setup and management for EveryStack. Use this skill when
  setting up Docker test containers, checking test service health, running
  migrations against test databases, or troubleshooting test environment issues.
  Triggers on: Docker compose for tests, PostgreSQL test container, PgBouncer
  test setup, Redis test container, migration verification, or any task
  involving test infrastructure. Contains Docker compose setup, how to
  start/check test services, migration commands, env var requirements, and
  port mappings. Load this skill alongside the verify skill when running
  integration tests.
---

# EveryStack Test Runner Skill

This skill encodes the test environment setup and management process for
EveryStack. It is the source of truth for Docker container configuration,
port mappings, health checks, and migration verification. Load this skill
whenever you need to run integration tests or troubleshoot test infrastructure.

## When to Use This Skill

- **Always** when running integration tests that need a database
- **Always** when troubleshooting "cannot connect" errors in tests
- **Always** when setting up the test environment for a new session
- **Not needed** for unit tests (they don't require Docker)

---

## Test Infrastructure Architecture

Covers Port Mapping, Environment Variables.

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  PostgreSQL 16   │────▶│   PgBouncer       │────▶│  Test Suite  │
│  Port: 5434      │     │   Port: 6433      │     │  (Vitest)    │
└─────────────────┘     └──────────────────┘     └─────────────┘
                                                         │
┌─────────────────┐                                      │
│  Redis 7         │◀────────────────────────────────────┘
│  Port: 6380      │
└─────────────────┘
```

### Port Mapping

| Service | Container Port | Host Port | Purpose |
|---------|---------------|-----------|---------|
| **PostgreSQL** | 5432 | **5434** | Direct DB access for tests |
| **PgBouncer** | 6432 | **6433** | Connection pooling (transaction mode) |
| **Redis** | 6379 | **6380** | Cache, pub-sub, BullMQ in tests |

**Critical:** These are TEST ports, different from dev ports. Tests must use these ports or the corresponding env vars.

### Environment Variables

Tests read these env vars (set in `vitest.config.ts` with fallbacks):

```bash
DATABASE_URL=postgresql://everystack:everystack@localhost:5434/everystack
DATABASE_READ_URL=postgresql://everystack:everystack@localhost:5434/everystack
PGBOUNCER_URL=postgresql://everystack:everystack@localhost:6433/everystack
REDIS_URL=redis://localhost:6380
```

**CI overrides:** CI uses port 5433 for PostgreSQL (not 5434). The `vitest.config.ts` env block uses `process.env.DATABASE_URL ??` fallback pattern so CI ports override local dev ports.

---

## Starting Test Services

Covers Quick Start, Health Check, If Services Aren't Running.

### Quick Start
```bash
docker compose -f docker-compose.test.yml up -d
```

### Health Check
```bash
# Check all containers are running
docker compose -f docker-compose.test.yml ps

# Check PostgreSQL is accepting connections
docker exec everystack-postgres pg_isready -U everystack

# Check Redis is responding
docker exec everystack-redis redis-cli ping
# Expected: PONG

# Check PgBouncer is routing
docker exec everystack-pgbouncer psql -h localhost -p 6432 -U everystack -d everystack -c "SELECT 1"
```

### If Services Aren't Running
```bash
# Start fresh
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d

# Wait for health (PostgreSQL can take 5-10 seconds)
sleep 5
docker exec everystack-postgres pg_isready -U everystack
```

---

## Migration Verification

Before running integration tests, the database schema must be current:

```bash
# Run migrations against the test database
pnpm turbo db:migrate

# Verify migrations applied
docker exec everystack-postgres psql -U everystack -d everystack -c "\dt" | head -20
```

### Common Migration Issues

**Missing _journal.json entries:**
The Drizzle migration journal (`meta/_journal.json`) must include entries for ALL migration files. Missing entries cause columns to be absent in a fresh database, leading to test failures that work locally (because you migrated incrementally) but fail in CI (which starts fresh).

**Fix:** Check that `_journal.json` entries match migration files:
```bash
ls packages/shared/db/migrations/*.ts | wc -l
# Should match the number of entries in _journal.json
```

**Lock timeout violations:**
Migrations must not acquire ACCESS EXCLUSIVE lock for >1s.
```bash
pnpm turbo db:migrate:check
```

---

## Running Tests

### Unit Tests Only (No Docker)
```bash
pnpm turbo test -- --testPathPattern='\.test\.(ts|tsx)$' --testPathIgnorePatterns='integration'
```

### Integration Tests Only (Docker Required)
```bash
pnpm turbo test -- --testPathPattern='integration'
```

### All Tests
```bash
pnpm turbo test
```

### Specific Test File
```bash
pnpm turbo test -- --testPathPattern='records.test.ts'
```

### With Coverage
```bash
pnpm turbo test -- --coverage
```

---

## Troubleshooting

Covers "ECONNREFUSED" on Port 5434, "ECONNREFUSED" on Port 6380, Tests Pass Locally, Fail in CI, Stale Database State, Factory-Related Failures.

### "ECONNREFUSED" on Port 5434
PostgreSQL container is not running or not ready.
```bash
docker compose -f docker-compose.test.yml up -d
sleep 5
docker exec everystack-postgres pg_isready -U everystack
```

### "ECONNREFUSED" on Port 6380
Redis container is not running.
```bash
docker compose -f docker-compose.test.yml up -d
docker exec everystack-redis redis-cli ping
```

### Tests Pass Locally, Fail in CI
1. **Port mismatch:** CI uses port 5433 for PG. Check `vitest.config.ts` env fallback pattern.
2. **Missing migrations:** CI runs against a fresh DB. Ensure `_journal.json` is complete.
3. **Redis port:** CI uses port 6380. Tests must parse `REDIS_URL`, not hardcode 6379.
4. **Missing `DATABASE_READ_URL`:** CI requires this env var (added in Phase 1F).

### Stale Database State
If tests fail due to unexpected data or missing tables:
```bash
# Nuclear option: destroy and recreate
docker compose -f docker-compose.test.yml down -v
docker compose -f docker-compose.test.yml up -d
sleep 5
pnpm turbo db:migrate
```

### Factory-Related Failures
- Never hardcode UUIDs in tests — use `createTestTenant()`, `createTestRecord()`, etc.
- Each test must create its own state — no test interdependence
- Integration tests create their own database: `beforeAll` creates, `afterAll` drops

---

## Docker Compose File

The test Docker Compose file is at the project root: `docker-compose.test.yml`

It defines three services:
1. **postgres** — PostgreSQL 16 with pgvector extension
2. **pgbouncer** — Connection pooler in transaction mode
3. **redis** — Redis 7 for cache/pub-sub/BullMQ

All services use named volumes for persistence between test runs. Use `-v` flag with `down` to destroy volumes for a clean start.
