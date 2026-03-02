# Phase 1G — Runtime Services: Real-Time Scaffold, Background Worker, File Upload

## Phase Context

### What Has Been Built

**Phase 1A (Monorepo, CI Pipeline, Dev Environment):** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI (lint → typecheck → test). ESLint + Prettier config. tsconfig strict mode. `.env.example`.

**Phase 1B (Database Schema, Connection Pooling, Tenant Routing):** Drizzle schema for all 50 MVP tables (Tiers 0–7). PgBouncer connection pooling config. `getDbForTenant()` with read/write routing. RLS policies enforcing tenant isolation. UUIDv7 primary key generation. Initial migration files. Tables relevant to this phase: `files` (with `storage_key`, `mime_type`, `size_bytes`, `checksum_sha256`, `scan_status`, `context_type`, `context_id`, `thumbnail_key`, `metadata`), `tables`, `records`, `views`, `threads`, `workspaces`.

**Phase 1C (Authentication, Tenant Isolation, Workspace Roles):** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities (`checkRole()`, `requireRole()`). `PermissionDeniedError` shape. Clerk session token available for Socket.io handshake.

**Phase 1D (Observability, Security Hardening):** Pino + `pino-http` structured logging. `traceId` via `AsyncLocalStorage`. Sentry DSN integration. OpenTelemetry basic instrumentation. Security headers middleware. Encryption at rest/in transit config. Webhook signature verification pattern. Typed error classes (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`).

**Phase 1E (Testing Infrastructure):** Vitest workspace config for monorepo. Playwright E2E setup. Test data factories for all core tables. `testTenantIsolation()` helper. Mock Clerk session utilities. MSW mock setup. `docker-compose.test.yml` for CI.

**Phase 1F (Design System Foundation):** shadcn/ui primitives installed. Tailwind config with three-layer color architecture (surface + accent + data palette). DM Sans + JetBrains Mono fonts. Spacing scale. Responsive application shell layout with sidebar.

### What This Phase Delivers

Three runtime service foundations that all subsequent features depend on:

1. **Real-Time Scaffold** — A running Socket.io server (`apps/realtime`) that authenticates connections via Clerk JWT, manages tenant-isolated rooms, and bridges Redis pub/sub events to connected clients. Feature code talks to a `RealtimeService` abstraction, never to Socket.io directly.

2. **Background Worker** — A running BullMQ worker (`apps/worker`) with queue definitions for all MVP job types (sync, file-processing, email, automation, document-gen, cleanup), a job processor base class with logging/tracing/error-handling, and graceful shutdown support.

3. **File Upload Pipeline** — A complete `StorageClient` abstraction with R2 implementation (MinIO locally), presigned URL upload/download endpoints, MIME allowlist with magic byte verification, image thumbnail generation via Sharp, ClamAV virus scanning integration, CDN serving strategy, per-plan file size limits, and orphan cleanup.

### What This Phase Does NOT Build

- Presence system with cursor positions (post-MVP for cursor broadcasting; Core UX for basic presence indicators)
- Chat / DM message delivery or typing indicators (post-MVP: Advanced Communications)
- Smart Doc collaborative editing / Hocuspocus (post-MVP)
- Sync status push via real-time (Phase 2 — Sync)
- Grid live updates or record presence (Phase 3 — Core UX)
- Portal real-time blocks or multi-page portal rooms (post-MVP: App Designer)
- Approval workflow real-time events (post-MVP)
- Workspace Map live topology updates (post-MVP)
- Actual sync/automation/email/document-gen job processors (later phases populate these queues)
- Document Intelligence extraction (post-MVP)
- Any UI components — this phase is backend services only (except a minimal connection status indicator placeholder)
- Multipart upload (Business+ plan, post-MVP — Documents)
- SVG sanitization (post-MVP — Comms & Polish)

### Architecture Patterns for This Phase

1. **Transport Abstraction:** Feature code imports `RealtimeService` from `packages/shared`, never `socket.io` directly. The `RealtimeService` interface is the contract. `SocketIORealtimeService` is the implementation.

2. **Redis as Event Bus:** Web app server actions and workers publish events to Redis pub/sub channels. The real-time service subscribes and forwards to Socket.io clients. Producers never know about Socket.io.

3. **Storage Abstraction:** Feature code imports `StorageClient` from `packages/shared`, never `@aws-sdk/client-s3` directly. R2 implementation wraps the S3-compatible SDK. MinIO substitutes in local dev.

4. **Presigned URL Pattern:** Clients never upload through the server. The server generates presigned PUT URLs; clients upload directly to R2/MinIO. The server verifies completion via HEAD + magic byte check.

5. **Job Processor Base Class:** All BullMQ job processors extend a base class that provides structured logging (Pino), `traceId` injection via `AsyncLocalStorage`, Sentry error capture, and graceful shutdown hooks.

6. **Tenant Isolation:** Room names include `t:{tenantId}:` prefix internally. Room join validates tenant ownership via Clerk session. File operations validate `tenant_id` ownership before signing URLs.

7. **CockroachDB Safeguards Remain Active:** UUIDv7 primary keys, no PG-specific syntax, explicit transaction boundaries, no advisory locks, hash-partitioning-compatible schemas.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | RealtimeService interface + Socket.io server scaffold with Clerk JWT auth | None | ~200 |
| 2 | Room model with tenant-isolated join/leave + Redis adapter | 1 | ~180 |
| 3 | Reconnection support + Redis pub/sub event bridge | 1, 2 | ~200 |
| CP-1 | Integration Checkpoint 1 (Real-Time Scaffold) | 1–3 | — |
| 4 | BullMQ worker skeleton with queue definitions + job processor base class | None | ~250 |
| 5 | StorageClient interface + R2/MinIO implementation | None | ~200 |
| 6 | Presigned URL upload endpoints with MIME allowlist + magic byte verification | 5 | ~250 |
| CP-2 | Integration Checkpoint 2 (Worker + Storage Foundation) | 4–6 | — |
| 7 | Image processing pipeline — Sharp thumbnails + blurhash | 5, 6 | ~200 |
| 8 | Virus scanning (ClamAV) + authenticated/public serving strategy | 5, 6 | ~180 |
| 9 | Per-plan file size limits + orphan cleanup scheduled job | 4, 5, 6 | ~180 |
| CP-3 | Final Integration Checkpoint + PR | 7–9 | — |

---

## Prompt 1: RealtimeService Interface + Socket.io Server Scaffold with Clerk JWT Auth

**Depends on:** None (uses existing `apps/realtime` scaffold from 1A, Clerk auth from 1C, Pino logger from 1D)
**Load context:** `realtime.md` lines 1–28 (Core Principle + Transport Abstraction), `realtime.md` lines 85–134 (Connection Lifecycle + Authentication)
**Target files:** `packages/shared/realtime/service.ts`, `packages/shared/realtime/types.ts`, `apps/realtime/src/index.ts`, `apps/realtime/src/auth.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1g-runtime-services` from `main`. Commit with message `feat(realtime): RealtimeService interface + Socket.io scaffold with Clerk JWT auth [Phase 1G, Prompt 1]`

### Schema Snapshot

N/A — no schema changes. The `files`, `tables`, `records`, `views`, `threads`, `workspaces` tables exist from Phase 1B.

### Task

1. **Create the `RealtimeService` interface** in `packages/shared/realtime/service.ts`:

```typescript
interface RealtimeService {
  joinRoom(roomId: string, userId: string, metadata?: RoomMetadata): Promise<void>;
  leaveRoom(roomId: string, userId: string): Promise<void>;
  getRoomMembers(roomId: string): Promise<RoomMember[]>;
  emitToRoom(roomId: string, event: string, payload: unknown): Promise<void>;
  emitToUser(userId: string, event: string, payload: unknown): Promise<void>;
  broadcast(event: string, payload: unknown, excludeUserId?: string): Promise<void>;
}
```

Omit `setPresence` and `getPresence` — presence system ships in Core UX.

2. **Create shared types** in `packages/shared/realtime/types.ts`: `RoomMetadata`, `RoomMember`, `RealtimeEvent` (event name + typed payload union), room name patterns as a type-safe enum/const (`table`, `record`, `thread`, `workspace`, `user`).

3. **Build the Socket.io server** in `apps/realtime/src/index.ts`:
   - Create an HTTP server + Socket.io instance.
   - Configure CORS to allow the web app origin (from env `WEB_APP_URL`).
   - Add Clerk JWT validation in the Socket.io `connection` middleware (the `auth` handshake parameter carries the Clerk session token). Use Clerk's `verifyToken()` to validate. On success, bind `userId` and `tenantId` to the socket instance. On failure, reject with `AUTH_FAILED` error code.
   - Integrate Pino logger from `packages/shared` (structured logging with `traceId`).
   - Listen on `PORT` from env (default `3002`).

4. **Create `apps/realtime/src/auth.ts`** — Clerk token verification helper that extracts `userId` and `tenantId` from the JWT. This is called during handshake and on every reconnect.

5. **Export the `RealtimeService` interface** from `packages/shared` barrel export.

6. **Update Docker Compose** to expose the realtime service port and set env vars (`CLERK_SECRET_KEY`, `REDIS_URL`, `WEB_APP_URL`).

### Acceptance Criteria

- [ ] `RealtimeService` interface compiles and is exported from `@everystack/shared`
- [ ] Socket.io server starts on `PORT` (default 3002) and accepts WebSocket connections
- [ ] Connection with valid Clerk JWT succeeds — socket has `userId` and `tenantId` attached
- [ ] Connection with invalid/expired JWT is rejected with `AUTH_FAILED` error code
- [ ] Connection without auth token is rejected
- [ ] Pino logger emits structured connection/disconnection events with `traceId`
- [ ] Unit tests for auth validation (mock Clerk `verifyToken`) achieve ≥80% coverage
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Presence system (`setPresence`, `getPresence`) — ships in Core UX
- Room join/leave logic — that's Prompt 2
- Redis adapter — that's Prompt 2
- Client-side Socket.io code — this is server-only
- Reconnection handling — that's Prompt 3
- Any UI indicators

---

## Prompt 2: Room Model with Tenant-Isolated Join/Leave + Redis Adapter

**Depends on:** Prompt 1 (Socket.io server + auth)
**Load context:** `realtime.md` lines 30–82 (Room Model table + tenant isolation), `realtime.md` lines 135–170 (Horizontal Scaling)
**Target files:** `apps/realtime/src/rooms.ts`, `apps/realtime/src/socket-realtime-service.ts`, `apps/realtime/src/index.ts` (updated)
**Migration required:** No
**Git:** Commit with message `feat(realtime): room model with tenant-isolated join/leave + Redis adapter [Phase 1G, Prompt 2]`

### Schema Snapshot

N/A — no schema changes. Room identifiers reference existing table primary keys: `tables.id`, `records.id`, `threads.id`, `workspaces.id`, `users.id`.

### Task

1. **Implement the room model** in `apps/realtime/src/rooms.ts`:
   - Define room patterns as constants with type-safe constructors:
     - `table:{tableId}` — Grid live updates (join when user opens table view)
     - `record:{recordId}` — Record View presence (join when user opens Record View)
     - `thread:{threadId}` — Chat / Record Thread message delivery (join when user opens thread)
     - `workspace:{workspaceId}` — Workspace-wide notifications, sync status (join when user enters workspace)
     - `user:{userId}` — Personal notifications, cross-workspace alerts (join on connect)
   - All room names are prefixed internally with `t:{tenantId}:` for tenant isolation. The prefix is added transparently — callers pass the logical room name.
   - Room join validates that the `tenantId` from the authenticated socket matches the tenant scope of the resource. For MVP, this is a simple check that the socket's `tenantId` is set (full resource-level authorization — "does this user have read access to this table?" — ships with the permission model in Core UX).

2. **Implement `SocketIORealtimeService`** in `apps/realtime/src/socket-realtime-service.ts`:
   - Implements the `RealtimeService` interface from `packages/shared`.
   - `joinRoom`: Add socket to the Socket.io room (prefixed with tenant). Log join event.
   - `leaveRoom`: Remove socket from the Socket.io room. Log leave event.
   - `getRoomMembers`: Return list of sockets in the room with their `userId`.
   - `emitToRoom`: Emit an event to all sockets in the specified room.
   - `emitToUser`: Emit to the `user:{userId}` room (personal channel).
   - `broadcast`: Emit to all connected sockets in the tenant, optionally excluding one user.

3. **Register Socket.io Redis adapter** (`@socket.io/redis-adapter`) for horizontal scaling. Connect to the Redis instance from env `REDIS_URL`. This enables events published on one Socket.io instance to be broadcast to clients on any instance.

4. **Wire room handlers** into the main Socket.io server (`apps/realtime/src/index.ts`):
   - On `connection`: automatically join `user:{userId}` room.
   - Listen for `room:join` and `room:leave` client events with room name validation.
   - On `disconnect`: cleanup all rooms for that socket.

### Acceptance Criteria

- [ ] `SocketIORealtimeService` implements all `RealtimeService` interface methods
- [ ] Room names are internally prefixed with `t:{tenantId}:` — never exposed to clients
- [ ] `room:join` for `table:{tableId}` adds socket to the correct tenant-prefixed room
- [ ] `room:leave` removes socket from the room
- [ ] `emitToRoom` delivers events only to sockets in the specified tenant-prefixed room
- [ ] `emitToUser` delivers to the personal `user:{userId}` channel
- [ ] Redis adapter is configured — test with 2 Socket.io instances shows cross-instance delivery
- [ ] `disconnect` cleans up all room memberships
- [ ] Integration test: two tenants cannot receive each other's room events (tenant isolation)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Resource-level authorization on room join (e.g., "does user have read access to this table?") — ships with full permission model in Core UX
- Presence tracking or cursor broadcasting — Core UX / post-MVP
- `portal:{portalId}:page:{pageSlug}` room pattern — post-MVP (App Designer portals with pages)
- Sticky session configuration in load balancer — deployment concern, not code
- Client-side reconnection logic — that's Prompt 3

---

## Prompt 3: Reconnection Support + Redis Pub/Sub Event Bridge

**Depends on:** Prompt 1, Prompt 2
**Load context:** `realtime.md` lines 97–134 (Reconnection Strategy + Stale Data Indicator), `realtime.md` lines 136–160 (Event Flow)
**Target files:** `apps/realtime/src/event-bridge.ts`, `apps/realtime/src/reconnection.ts`, `packages/shared/realtime/events.ts`
**Migration required:** No
**Git:** Commit with message `feat(realtime): reconnection support + Redis pub/sub event bridge [Phase 1G, Prompt 3]`

### Schema Snapshot

N/A — no schema changes.

### Task

1. **Define the event catalog** in `packages/shared/realtime/events.ts`:
   - Create a typed event catalog as a const map. MVP events (placeholder — actual events are populated as features are built):
     - `record.created`, `record.updated`, `record.deleted` — on `table:{tableId}` channel
     - `record.updated.batch`, `record.deleted.batch`, `record.created.batch` — batch events with `recordIds[]`, `truncated` flag at 1,000, `totalCount` (from `bulk-operations.md` cross-reference)
     - `sync.batch_complete` — on `table:{tableId}` channel
     - `notification.created` — on `user:{userId}` channel
   - Export a `RealtimeEventPayload` discriminated union type so consumers get type safety.
   - Export a `publishRealtimeEvent(channel: string, event: string, payload: unknown)` helper that writes to Redis pub/sub. This is what Server Actions and workers call — they never import Socket.io.

2. **Build the event bridge** in `apps/realtime/src/event-bridge.ts`:
   - Subscribe to Redis pub/sub channels matching the room patterns (`t:{tenantId}:table:*`, `t:{tenantId}:record:*`, etc.).
   - When a Redis message arrives, forward it to the matching Socket.io room via `emitToRoom`.
   - Use Redis pattern subscriptions (`PSUBSCRIBE`) to avoid per-room subscription overhead.
   - Log all bridged events at `debug` level (structured Pino).

3. **Implement reconnection support** in `apps/realtime/src/reconnection.ts`:
   - Configure Socket.io server to support client reconnection (Socket.io handles transport-level reconnection automatically).
   - On reconnect: re-authenticate (Clerk token validated — may have expired), rejoin rooms (client sends its room list), and perform catch-up.
   - **Catch-up mechanism:** Use Redis Streams with a 5-minute retention window. When the event bridge publishes to Socket.io, also write to a Redis Stream keyed by room. On reconnect, client sends `{ lastEventTimestamp }` per room. Server replays events since that timestamp. If gap exceeds 5 minutes, respond with `FULL_REFRESH` signal — client re-fetches current state from API.
   - Export reconnection configuration constants (initial delay: 1000ms, backoff multiplier: 2x, max delay: 30000ms, jitter: ±20%).

4. **Export `publishRealtimeEvent`** from `packages/shared` barrel export so Server Actions and workers can publish events without importing the realtime service.

### Acceptance Criteria

- [ ] `publishRealtimeEvent('table:abc123', 'record.updated', payload)` writes to Redis pub/sub with tenant prefix
- [ ] Event bridge receives the Redis message and emits to the correct Socket.io room
- [ ] Type-safe event catalog — `RealtimeEventPayload` provides autocomplete for event names and payloads
- [ ] Redis Streams catch-up: simulated disconnect + reconnect replays missed events
- [ ] Gap > 5 minutes returns `FULL_REFRESH` signal instead of event replay
- [ ] Batch events include `recordIds[]`, `truncated` flag, and `totalCount`
- [ ] Server Actions can import `publishRealtimeEvent` from `@everystack/shared` without depending on Socket.io
- [ ] Unit tests for event bridge with mocked Redis achieve ≥80% coverage
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Client-side Socket.io integration or React hooks — ships in Core UX
- UI stale data indicator or reconnecting banner — ships in Core UX
- Optimistic update queue or rollback — ships in Core UX
- Specific feature event handlers (sync status, grid updates) — populated as features are built

---

## Integration Checkpoint 1 (after Prompts 1–3)

**Task:** Verify the complete real-time scaffold integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification:
   - Start Docker Compose (`docker compose up`) — realtime service starts on port 3002, Redis connected
   - Verify the realtime service logs: "Socket.io server listening on port 3002" with structured Pino output
   - Use a WebSocket test client (e.g., `wscat` or a simple script) to connect with a mock Clerk JWT — verify connection accepted
   - Connect without JWT — verify connection rejected with `AUTH_FAILED`
   - Publish a test event via `publishRealtimeEvent` from a test script — verify it arrives at the connected client

**Git:** Commit with message `chore(verify): integration checkpoint 1 — real-time scaffold [Phase 1G, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 4.

---

## Prompt 4: BullMQ Worker Skeleton with Queue Definitions + Job Processor Base Class

**Depends on:** None (uses existing `apps/worker` scaffold from 1A, Pino logger from 1D)
**Load context:** `CLAUDE.md` lines 59 (worker directory), `realtime.md` lines 262–270 (Deployment — worker as Docker Compose service)
**Target files:** `apps/worker/src/index.ts`, `apps/worker/src/queues.ts`, `apps/worker/src/base-processor.ts`, `packages/shared/jobs/types.ts`, `packages/shared/jobs/queue-client.ts`
**Migration required:** No
**Git:** Commit with message `feat(worker): BullMQ skeleton with queue definitions + job processor base class [Phase 1G, Prompt 4]`

### Schema Snapshot

N/A — no schema changes.

### Task

1. **Define queue types** in `packages/shared/jobs/types.ts`:
   - Create typed job definitions for all MVP queue categories:
     - `sync` — sync operations (populated in Phase 2)
     - `file-processing` — thumbnail generation, virus scan
     - `email` — transactional email delivery (populated in Core UX)
     - `automation` — automation step execution (populated in Phase 4)
     - `document-gen` — PDF generation via Gotenberg (populated in Core UX)
     - `cleanup` — orphan file cleanup, expired session pruning
   - Each queue definition includes: queue name (string constant), job data type (TypeScript interface), job result type, default job options (attempts, backoff, removeOnComplete, removeOnFail).
   - Export a `JobName` union type and per-queue `JobData` discriminated union.

2. **Create queue client** in `packages/shared/jobs/queue-client.ts`:
   - A typed helper that creates BullMQ `Queue` instances for each queue name.
   - `enqueueJob(queueName, jobName, data, options?)` — type-safe job enqueue function. Server Actions and other services import this to enqueue work.
   - Redis connection from env `REDIS_URL`.
   - Export from `packages/shared` barrel.

3. **Build the worker entry point** in `apps/worker/src/index.ts`:
   - Create BullMQ `Worker` instances for each defined queue.
   - Each worker maps job names to processor functions via a registry pattern.
   - Connect to Redis from env `REDIS_URL`.
   - Integrate Pino logger with `traceId` injection (generate a new `traceId` per job execution via `AsyncLocalStorage`).
   - Implement graceful shutdown: on `SIGTERM` and `SIGINT`, stop accepting new jobs, wait for in-progress jobs to complete (30s timeout), then exit.
   - Log worker startup, job start/complete/fail events with structured Pino.
   - Integrate Sentry for job failure capture.

4. **Create the base processor class** in `apps/worker/src/base-processor.ts`:
   - Abstract `BaseProcessor<TData, TResult>` class that all job processors extend.
   - Provides: structured logging (child Pino logger with `jobId`, `queueName`, `traceId`), Sentry breadcrumbs, automatic duration tracking, retry-aware error classification (transient vs. permanent failures).
   - Abstract `process(data: TData): Promise<TResult>` method.
   - `onFailed(data: TData, error: Error)` hook for cleanup logic (optional override).

5. **Create a `NoopProcessor`** as a placeholder — processes jobs by logging receipt and returning success. All queues initially route to `NoopProcessor` until real processors are built in later phases.

6. **Update Docker Compose** to start the worker service with appropriate env vars.

### Acceptance Criteria

- [ ] All 6 queue types are defined with typed job data interfaces
- [ ] `enqueueJob('file-processing', 'file.thumbnail', { fileId: '...' })` compiles with type checking on job name + data shape
- [ ] Worker starts and connects to Redis, logs "Worker started for queues: sync, file-processing, email, automation, document-gen, cleanup"
- [ ] Enqueuing a test job → worker picks it up → `NoopProcessor` logs receipt
- [ ] Graceful shutdown: sending SIGTERM causes worker to drain in-progress jobs before exiting
- [ ] Each job execution gets a unique `traceId` in logs
- [ ] Job failures are captured in Sentry with job metadata
- [ ] `BaseProcessor` subclass test verifies logging, duration tracking, and error hooks
- [ ] `enqueueJob` is exported from `@everystack/shared` — Server Actions can import it
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Actual sync, email, automation, or document-gen job processors — later phases populate these
- Job scheduling / cron (except basic repeatable jobs in Prompt 9 for cleanup)
- Dashboard or UI for job monitoring — operational concern
- Rate limiting per queue — added per-feature as needed
- Concurrency tuning — use BullMQ defaults initially

---

## Prompt 5: StorageClient Interface + R2/MinIO Implementation

**Depends on:** None (uses existing `packages/shared` from 1A)
**Load context:** `files.md` lines 70–125 (Storage Client + Storage Key Hierarchy)
**Target files:** `packages/shared/storage/client.ts`, `packages/shared/storage/r2-client.ts`, `packages/shared/storage/config.ts`, `packages/shared/storage/keys.ts`
**Migration required:** No
**Git:** Commit with message `feat(storage): StorageClient interface + R2/MinIO implementation [Phase 1G, Prompt 5]`

### Schema Snapshot

From Phase 1B — `files` table (relevant columns only):
```
files: id (UUID PK), tenant_id, storage_key (VARCHAR), original_filename (VARCHAR 255),
       mime_type (VARCHAR 127), size_bytes (BIGINT), thumbnail_key (VARCHAR nullable),
       metadata (JSONB), scan_status (VARCHAR: pending|clean|infected|skipped)
```

### Task

1. **Define the `StorageClient` interface** in `packages/shared/storage/client.ts`:

```typescript
interface StorageClient {
  presignPut(key: string, options: PresignOptions): Promise<{ url: string; headers: Record<string, string> }>;
  presignGet(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  headObject(key: string): Promise<{ size: number; contentType: string } | null>;
  getStream(key: string): Promise<ReadableStream>;
}

interface PresignOptions {
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number; // default: 3600
}
```

2. **Create the storage configuration** in `packages/shared/storage/config.ts`:
   - Load from env: `STORAGE_BUCKET`, `STORAGE_REGION` ('auto' for R2), `STORAGE_ENDPOINT` (R2 endpoint or MinIO `http://localhost:9000`), `STORAGE_PUBLIC_URL` (CDN URL prefix for public files), `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`.
   - Export a validated config object (Zod schema for env validation).

3. **Implement `R2StorageClient`** in `packages/shared/storage/r2-client.ts`:
   - Wraps `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` (R2 is S3-compatible).
   - Implements all `StorageClient` methods.
   - `presignPut`: Generate presigned PUT URL with content type and length restrictions.
   - `presignGet`: Generate presigned GET URL with expiry (default 15 minutes for authenticated files).
   - `delete` / `deleteMany`: Delete objects from the bucket.
   - `headObject`: Check if object exists and return size + content type.
   - `getStream`: Return a readable stream for the object (used by image processing).
   - Uses `forcePathStyle: true` for MinIO compatibility in dev.

4. **Define the storage key hierarchy** in `packages/shared/storage/keys.ts`:
   - Type-safe key builders:
     - `fileOriginalKey(tenantId, fileId, sanitizedFilename)` → `t/{tenantId}/files/{fileId}/original/{sanitizedFilename}`
     - `fileThumbnailKey(tenantId, fileId, size)` → `t/{tenantId}/files/{fileId}/thumb/{size}.webp`
     - `portalAssetKey(tenantId, portalId, assetType, ext)` → `t/{tenantId}/portal-assets/{portalId}/{assetType}.{ext}`
     - `docGenOutputKey(tenantId, docId, ext)` → `t/{tenantId}/doc-gen/{docId}/output.{ext}`
     - `templateKey(tenantId, templateId)` → `t/{tenantId}/templates/{templateId}/template.docx`
     - `quarantineKey(tenantId, fileId, sanitizedFilename)` → `t/{tenantId}/quarantine/{fileId}/{sanitizedFilename}`
   - Filename sanitization utility: strip path traversal, limit length to 255, replace unsafe characters.

5. **Add MinIO to Docker Compose** (`docker-compose.yml`) with a `minio` service, default credentials, and a startup bucket creation command.

6. **Export** `StorageClient`, `R2StorageClient`, storage key builders, and config from `packages/shared` barrel.

### Acceptance Criteria

- [ ] `StorageClient` interface compiles and is exported from `@everystack/shared`
- [ ] `R2StorageClient` implements all interface methods
- [ ] `presignPut` generates a valid presigned URL — uploading a test file via the URL succeeds (integration test with MinIO)
- [ ] `presignGet` generates a valid download URL — downloading the uploaded file succeeds
- [ ] `headObject` returns correct size and content type for an uploaded file
- [ ] `delete` removes the object — subsequent `headObject` returns null
- [ ] Storage key builders produce the correct hierarchy paths
- [ ] Filename sanitization strips `../`, null bytes, and limits length
- [ ] MinIO service starts in Docker Compose with a default bucket
- [ ] Environment config validated with Zod — missing vars throw descriptive errors
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Multipart upload (Business+ plan feature, post-MVP — Documents)
- CDN invalidation logic — content-addressed via checksum means no invalidation needed
- Public URL generation without presigning — that's the serving strategy in Prompt 8
- Upload endpoints — that's Prompt 6

---

## Prompt 6: Presigned URL Upload Endpoints with MIME Allowlist + Magic Byte Verification

**Depends on:** Prompt 5 (StorageClient)
**Load context:** `files.md` lines 126–212 (Upload Flow + Content-Type Security)
**Target files:** `apps/web/src/app/api/upload/presign/route.ts`, `apps/web/src/app/api/upload/complete/[fileId]/route.ts`, `packages/shared/storage/mime-allowlist.ts`, `packages/shared/storage/magic-bytes.ts`, `packages/shared/storage/upload-service.ts`
**Migration required:** No
**Git:** Commit with message `feat(storage): presigned URL upload endpoints with MIME allowlist + magic byte verification [Phase 1G, Prompt 6]`

### Schema Snapshot

```
files: id (UUID PK), tenant_id, uploaded_by, storage_key, original_filename, mime_type,
       size_bytes, checksum_sha256, scan_status ('pending'), context_type, context_id,
       thumbnail_key (null), metadata (JSONB {}), created_at, deleted_at (null)
```

### Task

1. **Create the MIME allowlist** in `packages/shared/storage/mime-allowlist.ts`:
   - Map of allowed MIME types to valid extensions (from `files.md` Content-Type Security section):
     - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `image/heic`, `image/heif`
     - Documents: `application/pdf`, `.docx`, `.xlsx`, `.pptx`, `text/csv`, `text/plain`, `application/json`
     - Audio/Video (Business+ only — enforce plan check): `audio/mpeg`, `audio/wav`, `video/mp4`, `video/webm`
     - Archives: `application/zip`
   - Export `isAllowedMimeType(mimeType: string, plan: string): boolean`.

2. **Create magic byte verification** in `packages/shared/storage/magic-bytes.ts`:
   - Read first 8KB of a file stream and verify magic bytes match the claimed MIME type.
   - Support magic byte patterns for: JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), GIF (`47 49 46`), WebP (`52 49 46 46` + `57 45 42 50`), PDF (`25 50 44 46`), ZIP/DOCX/XLSX/PPTX (`50 4B 03 04`), MP4 (`66 74 79 70`).
   - Export `verifyMagicBytes(stream: ReadableStream, claimedMimeType: string): Promise<boolean>`.

3. **Build the upload service** in `packages/shared/storage/upload-service.ts`:
   - `initiateUpload(params)`: Validates auth, tenant, MIME type against allowlist, file size against plan limit, storage quota not exceeded. Creates a `files` row with `scan_status: 'pending'`, generates `storage_key`, returns presigned PUT URL + file ID.
   - `completeUpload(fileId, tenantId)`: Validates file belongs to tenant, HEAD confirms object exists and size matches, downloads first 8KB for magic byte verification. On mismatch: delete the files row, delete the object, throw `ValidationError`. On success: update files row, enqueue `file.scan` and `file.thumbnail` jobs via `enqueueJob`.

4. **Create the presign endpoint** at `POST /api/upload/presign`:
   - Body: `{ filename, mimeType, sizeBytes, contextType, contextId }`
   - Validates via Zod schema. Requires Clerk auth.
   - Calls `uploadService.initiateUpload()`.
   - Returns: `{ fileId, presignedUrl, headers, expiresAt }`.

5. **Create the completion endpoint** at `POST /api/upload/complete/{fileId}`:
   - Requires Clerk auth. Validates file belongs to the authenticated tenant.
   - Calls `uploadService.completeUpload()`.
   - Returns file metadata (id, filename, mimeType, sizeBytes).

6. **Context types** — validate `contextType` against the enum: `record_attachment`, `smart_doc`, `doc_gen_output`, `portal_asset`, `email_attachment`, `chat_attachment`, `template`.

### Acceptance Criteria

- [ ] `POST /api/upload/presign` with valid MIME type returns a presigned URL and creates a `files` row with `scan_status: 'pending'`
- [ ] Presigned URL allows direct upload to MinIO/R2 from the client
- [ ] `POST /api/upload/complete/{fileId}` verifies the upload, checks magic bytes, and updates the files row
- [ ] MIME type not in allowlist → 422 error at presign time
- [ ] Magic byte mismatch (e.g., claim `image/png` but upload a `.exe`) → files row deleted, object deleted, 422 error at completion
- [ ] File size exceeding plan limit → 422 error at presign time
- [ ] `file.scan` and `file.thumbnail` jobs enqueued after successful completion
- [ ] Cross-tenant file completion blocked — returns 404 (not 403, to prevent enumeration)
- [ ] `testTenantIsolation()` passes for upload service functions
- [ ] All Zod schemas validate correctly for edge cases (empty filename, zero-length file, oversized filename)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Multipart upload endpoint (Business+ only, post-MVP)
- SVG sanitization (post-MVP — Comms & Polish)
- Client-side upload manager UI — ships in Core UX
- Actual file.scan or file.thumbnail processors — those are Prompts 7 and 8
- Content-Disposition headers for download — that's the serving strategy in Prompt 8

---

## Integration Checkpoint 2 (after Prompts 4–6)

**Task:** Verify the worker, storage, and upload pipeline integrate correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification:
   - Start Docker Compose — worker, MinIO, and Redis all running
   - Worker logs show: "Worker started for queues: sync, file-processing, email, automation, document-gen, cleanup"
   - Call `POST /api/upload/presign` with a test file → receive presigned URL
   - Upload a JPEG to the presigned URL via `curl` → succeeds
   - Call `POST /api/upload/complete/{fileId}` → files row updated, `file.scan` and `file.thumbnail` jobs enqueued
   - Worker picks up the jobs → NoopProcessor logs receipt
   - Upload a file with mismatched MIME type → magic byte check rejects at completion

**Git:** Commit with message `chore(verify): integration checkpoint 2 — worker + storage foundation [Phase 1G, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 7.

---

## Prompt 7: Image Processing Pipeline — Sharp Thumbnails + Blurhash

**Depends on:** Prompt 5 (StorageClient), Prompt 6 (upload pipeline enqueues `file.thumbnail` jobs)
**Load context:** `files.md` lines 213–240 (Image Processing Pipeline)
**Target files:** `apps/worker/src/processors/file-thumbnail.ts`, `packages/shared/storage/image-processing.ts`
**Migration required:** No
**Git:** Commit with message `feat(files): image processing pipeline — Sharp thumbnails + blurhash [Phase 1G, Prompt 7]`

### Schema Snapshot

```
files: thumbnail_key (VARCHAR nullable), metadata (JSONB — stores dimensions, blurhash)
```

### Task

1. **Create the image processing module** in `packages/shared/storage/image-processing.ts`:
   - `generateThumbnails(stream: ReadableStream, options: ThumbnailOptions): Promise<ThumbnailResult[]>`:
     - Two output sizes per `files.md`:
       - `thumb/200.webp` — max dimension 200px, WebP quality 80, purpose: grid cell / file list
       - `thumb/800.webp` — max dimension 800px, WebP quality 85, purpose: lightbox / record view
     - Use `sharp` library: detect EXIF orientation, auto-rotate, resize with `fit: 'inside'`, convert to WebP.
     - Generate a blurhash (10-character) for the original image — store in `metadata.blurhash`.
     - Extract original dimensions (width, height) — store in `metadata.width` and `metadata.height`.
     - Return: array of `{ key: string, buffer: Buffer, size: number }` for each thumbnail.
   - `isPdfThumbnailCandidate(mimeType: string): boolean` — returns true for `application/pdf`. PDF thumbnail generation via Gotenberg ships later (Core UX — Documents). For now, skip PDF thumbnails and set a flag.
   - Timeout: 60s per file. Images >50 megapixels are skipped with a warning log.

2. **Create the `file.thumbnail` job processor** in `apps/worker/src/processors/file-thumbnail.ts`:
   - Extends `BaseProcessor`.
   - Job data: `{ fileId: string, tenantId: string }`.
   - Process flow:
     1. Fetch file record from database.
     2. Download original via `storageClient.getStream()`.
     3. Check MIME type — only process images (`image/*`). Skip non-images silently.
     4. Call `generateThumbnails()`.
     5. Upload thumbnails to storage using `fileThumbnailKey()`.
     6. Update `files.thumbnail_key` and `files.metadata` with dimensions and blurhash.
   - Error handling: if Sharp fails (corrupted image, unsupported format), log warning, set `metadata.thumbnail_error: true`, do not crash the job.

3. **Register the processor** in the worker's `file-processing` queue handler — replace `NoopProcessor` for `file.thumbnail` jobs.

4. **Install dependencies:** `sharp` and `blurhash` packages in the worker app.

### Acceptance Criteria

- [ ] Uploading a JPEG → `file.thumbnail` job → two WebP thumbnails (200px, 800px) stored at correct storage keys
- [ ] Uploading a PNG → same result — EXIF orientation corrected
- [ ] `files.thumbnail_key` updated to `thumb/200.webp` path
- [ ] `files.metadata` contains `{ width, height, blurhash }` — blurhash is 10 chars
- [ ] Non-image files (PDF, CSV) → processor skips silently, no error
- [ ] Corrupted image → warning logged, `metadata.thumbnail_error: true`, job completes (no crash)
- [ ] Images >50MP → skipped with warning, no thumbnails generated
- [ ] Timeout enforced at 60s — long-running Sharp operations are killed
- [ ] Unit tests for `generateThumbnails` with sample images achieve ≥80% coverage
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- PDF thumbnail generation via Gotenberg — ships in Core UX (Documents phase)
- Video thumbnails — post-MVP
- Image CDN transforms (dynamic resize) — not in spec, use pre-generated thumbnails
- Client-side image preview or lightbox — Core UX
- Format conversion beyond WebP thumbnails

---

## Prompt 8: Virus Scanning (ClamAV) + Authenticated/Public Serving Strategy

**Depends on:** Prompt 5 (StorageClient), Prompt 6 (upload pipeline enqueues `file.scan` jobs)
**Load context:** `files.md` lines 241–292 (Virus Scanning + Serving Strategy)
**Target files:** `apps/worker/src/processors/file-scan.ts`, `packages/shared/storage/virus-scanner.ts`, `apps/web/src/app/api/files/[fileId]/route.ts`, `packages/shared/storage/serving.ts`
**Migration required:** No
**Git:** Commit with message `feat(files): virus scanning (ClamAV) + serving strategy [Phase 1G, Prompt 8]`

### Schema Snapshot

```
files: scan_status (VARCHAR: pending|clean|infected|skipped), storage_key, tenant_id
```

### Task

1. **Create the virus scanner abstraction** in `packages/shared/storage/virus-scanner.ts`:
   - `VirusScanner` interface: `scan(stream: ReadableStream): Promise<ScanResult>` where `ScanResult` is `{ status: 'clean' | 'infected' | 'skipped', details?: string }`.
   - `ClamAVScanner` implementation: connects to ClamAV daemon via TCP (clamdscan protocol). Streams the file for scanning.
   - `NoopScanner` implementation: returns `{ status: 'skipped' }` — used in dev mode when ClamAV is not available.
   - Scanner selection: if env `CLAMAV_HOST` is set, use `ClamAVScanner`. Otherwise, use `NoopScanner` and log a warning.

2. **Create the `file.scan` job processor** in `apps/worker/src/processors/file-scan.ts`:
   - Extends `BaseProcessor`.
   - Job data: `{ fileId: string, tenantId: string }`.
   - Process flow:
     1. Fetch file record. If `scan_status !== 'pending'`, skip (idempotent).
     2. Download file via `storageClient.getStream()`.
     3. Scan via `virusScanner.scan()`.
     4. If `clean`: update `files.scan_status = 'clean'`.
     5. If `infected`: move file to quarantine path (`quarantineKey`), update `files.scan_status = 'infected'`, write audit log entry (`file.quarantined`). File is never served.
     6. If `skipped`: update `files.scan_status = 'skipped'`, log warning for admin alerting.
   - Target: <30s for files under 50MB.

3. **Register the processor** in the worker's `file-processing` queue handler for `file.scan` jobs.

4. **Build the file serving endpoint** at `GET /api/files/{fileId}`:
   - Requires Clerk auth. Validates file belongs to the authenticated tenant.
   - Check `scan_status`:
     - `pending` → 403 with message "File is being scanned"
     - `infected` → 403 with message "File has been quarantined"
     - `clean` or `skipped` → generate presigned GET URL (15-minute expiry) and redirect (302)
   - Set `Content-Disposition: attachment; filename="{sanitizedFilename}"` via presigned URL metadata — forces download, prevents XSS.

5. **Create the serving strategy module** in `packages/shared/storage/serving.ts`:
   - `getFileDownloadUrl(tenantId, fileId)`: fetch file, validate scan status, generate presigned GET URL (15 min expiry).
   - `getPublicFileUrl(tenantId, storageKey)`: for portal assets and public doc gen outputs — construct CDN URL using `STORAGE_PUBLIC_URL` prefix + storage key. Long TTL: `Cache-Control: public, max-age=31536000, immutable`.
   - `getThumbnailUrl(tenantId, fileId, size)`: CDN URL for thumbnails. `Cache-Control: public, max-age=86400` (1 day).

6. **Add ClamAV to Docker Compose** as an optional profile (`docker compose --profile security up`). Default dev mode uses `NoopScanner`.

### Acceptance Criteria

- [ ] `file.scan` job processes an uploaded file — `scan_status` updated to `clean` (with NoopScanner in dev, `skipped`)
- [ ] When ClamAV detects an infected file: file moved to quarantine, `scan_status = 'infected'`, audit log written
- [ ] `GET /api/files/{fileId}` with `scan_status: 'clean'` → 302 redirect to presigned GET URL
- [ ] `GET /api/files/{fileId}` with `scan_status: 'pending'` → 403 "File is being scanned"
- [ ] `GET /api/files/{fileId}` with `scan_status: 'infected'` → 403 "File has been quarantined"
- [ ] Presigned GET URL includes `Content-Disposition: attachment` header
- [ ] Cross-tenant file download blocked — returns 404
- [ ] Public file URLs use CDN prefix with long cache TTL
- [ ] Thumbnail URLs use CDN prefix with 1-day cache TTL
- [ ] `testTenantIsolation()` passes for file serving functions
- [ ] ClamAV optional profile works in Docker Compose
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Separate CDN domain (`files.everystack.com`) — production deployment concern, not dev
- Real-time notification to user when scan completes — Core UX
- Admin UI for quarantined files — post-MVP
- Signature DB auto-update scheduling for ClamAV — operational concern
- Inline file preview (non-download serving) — Core UX

---

## Prompt 9: Per-Plan File Size Limits + Orphan Cleanup Scheduled Job

**Depends on:** Prompt 4 (BullMQ worker with cleanup queue), Prompt 5 (StorageClient), Prompt 6 (upload service)
**Load context:** `files.md` lines 293–331 (File Size Limits + Orphan Cleanup + Audit & Access Logging)
**Target files:** `packages/shared/storage/plan-limits.ts`, `apps/worker/src/processors/file-orphan-cleanup.ts`, `packages/shared/storage/upload-service.ts` (updated)
**Migration required:** No
**Git:** Commit with message `feat(files): per-plan file size limits + orphan cleanup job [Phase 1G, Prompt 9]`

### Schema Snapshot

```
files: size_bytes (BIGINT), tenant_id, deleted_at (TIMESTAMPTZ nullable)
tenants: plan (VARCHAR — Freelancer|Starter|Professional|Business|Enterprise)
```

### Task

1. **Define per-plan file limits** in `packages/shared/storage/plan-limits.ts`:

| Plan | Max File Size | Total Storage | Multipart |
|------|--------------|---------------|-----------|
| Freelancer | 25 MB | 5 GB | No |
| Starter | 50 MB | 25 GB | No |
| Professional | 100 MB | 100 GB | No |
| Business | 250 MB | 500 GB | Yes (post-MVP) |
| Enterprise | 500 MB | 1 TB | Yes (post-MVP) |

   - Export `getFileSizeLimit(plan: string): number` (bytes).
   - Export `getStorageQuota(plan: string): number` (bytes).
   - Export `isMultipartAllowed(plan: string): boolean`.
   - All values stored as config constants, not hardcoded in enforcement logic — easy to tune.

2. **Update the upload service** (`packages/shared/storage/upload-service.ts`):
   - In `initiateUpload`: check `sizeBytes` against `getFileSizeLimit(tenant.plan)`. If exceeded, throw `ValidationError` with clear message: "File size {size} exceeds your plan limit of {limit}. Upgrade your plan for larger uploads."
   - In `initiateUpload`: check current storage usage (`SUM(size_bytes) WHERE tenant_id = $1 AND deleted_at IS NULL`) against `getStorageQuota(tenant.plan)`. If exceeded, throw `ValidationError`: "Storage quota exceeded. You've used {used} of your {limit} storage."

3. **Create the orphan cleanup processor** in `apps/worker/src/processors/file-orphan-cleanup.ts`:
   - Extends `BaseProcessor`.
   - Runs as a repeatable BullMQ job on the `cleanup` queue (schedule: daily at 3:00 AM UTC).
   - Process flow:
     1. Query files with `deleted_at` older than 30 days.
     2. For each file: delete original + all thumbnails from storage via `storageClient.deleteMany()`.
     3. Hard-delete the `files` row.
     4. Process in batches of 100 to avoid long-running transactions.
   - **Template files and portal assets:** Skip files where `context_type` is `template` or `portal_asset` — never auto-deleted unless tenant is deleted or explicit admin action.
   - Log summary: "Orphan cleanup complete: {count} files deleted, {bytes} bytes freed."

4. **Register the repeatable job** in the worker startup — add the orphan cleanup to the `cleanup` queue with a cron expression (`0 3 * * *`).

5. **Add audit log entries** for file operations using `writeAuditLog()` from Phase 1I (if already built) or stub the calls to be wired later:
   - `file.uploaded` — on upload completion
   - `file.accessed` — on download URL generation
   - `file.deleted` — on orphan cleanup hard delete
   - `file.quarantined` — on virus scan infection (already added in Prompt 8)

### Acceptance Criteria

- [ ] `getFileSizeLimit('Freelancer')` returns 25 MB in bytes (26_214_400)
- [ ] Upload of a 30MB file by a Freelancer plan tenant → 422 error with plan limit message
- [ ] Upload when storage quota is exceeded → 422 error with quota message
- [ ] Orphan cleanup job runs, finds files with `deleted_at > 30 days`, deletes from storage and hard-deletes rows
- [ ] Template and portal asset files are skipped by orphan cleanup
- [ ] Cleanup processes in batches of 100
- [ ] Repeatable job registered with cron `0 3 * * *`
- [ ] Audit log stubs are present for all 4 file operations (`file.uploaded`, `file.accessed`, `file.deleted`, `file.quarantined`)
- [ ] Storage quota query uses `SUM(size_bytes)` with `deleted_at IS NULL` filter
- [ ] Unit tests for plan limits and quota enforcement achieve ≥80% coverage
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Multipart upload implementation — post-MVP (Business+ only)
- Tenant deletion cascade — operational concern, not file-specific
- Storage usage dashboard or UI — Core UX / Settings
- File versioning or version history
- Quota alerting (approaching limit notifications) — post-MVP

---

## Final Integration Checkpoint (after Prompts 7–9)

**Task:** Verify all Phase 1G work integrates correctly — real-time scaffold, background worker, and complete file upload pipeline.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (all sub-phases: 1A–1G)
4. `pnpm turbo test -- --coverage` — thresholds met:
   - `apps/worker/src/jobs/` ≥85% lines, ≥80% branches
   - `packages/shared/storage/` ≥90% lines, ≥85% branches
   - `packages/shared/realtime/` ≥90% lines, ≥85% branches
5. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations
6. Manual full-cycle verification:
   - Start all services: `docker compose up`
   - Verify realtime service is running, worker is processing, MinIO is serving
   - Upload a JPEG via presign → complete → verify:
     - `files` row created with `scan_status: 'pending'`
     - `file.scan` job picked up by worker → `scan_status` updated to `skipped` (dev mode, no ClamAV)
     - `file.thumbnail` job picked up → two WebP thumbnails stored → `thumbnail_key` and `metadata` updated
     - `GET /api/files/{fileId}` returns 302 to presigned download URL
   - Upload a file with wrong magic bytes → rejected at completion
   - Upload exceeding plan limit → rejected at presign
   - Connect to real-time service via test WebSocket client → publish event → verify receipt
   - Verify orphan cleanup job is registered (check BullMQ dashboard or logs)

**Git:** Commit with message `chore(verify): final integration checkpoint — runtime services complete [Phase 1G, CP-3]`, push branch to origin, then open PR to `main` with title "Phase 1G — Runtime Services: Real-Time Scaffold, Background Worker, File Upload".

---

## Dependency Graph

```
Phase 1A–1F (complete) ──────────────────────────────────────────┐
                                                                  │
Prompt 1 (RealtimeService + Socket.io scaffold)                   │
  └── Prompt 2 (Room model + Redis adapter)                       │
       └── Prompt 3 (Reconnection + event bridge)                 │
            └── CP-1 ─────────────────────────────────────────────┤
                                                                  │
Prompt 4 (BullMQ worker skeleton) ─────────────────┐              │
                                                    ├── Prompt 9  │
Prompt 5 (StorageClient + R2) ─────┐               │              │
  └── Prompt 6 (Upload endpoints)──┼── CP-2 ───────┤              │
       ├── Prompt 7 (Thumbnails)   │               └── CP-3 (PR)  │
       └── Prompt 8 (Virus scan)   │                              │
                                    └──────────────────────────────┘
```

Prompts 1–3 (real-time) and Prompts 4–6 (worker + storage) can be executed in parallel — they have no cross-dependencies until Prompt 9 (which needs both the worker and storage).

---

## Post-Phase Summary

When Phase 1G is complete and merged, the following exists:

| Component | What's Running |
|-----------|---------------|
| `apps/realtime` | Socket.io server with Clerk JWT auth, tenant-isolated rooms, Redis adapter, event bridge, reconnection with catch-up |
| `apps/worker` | BullMQ worker with 6 queues, `file.thumbnail` and `file.scan` processors, repeatable orphan cleanup, graceful shutdown |
| `packages/shared/realtime` | `RealtimeService` interface, typed event catalog, `publishRealtimeEvent()` helper |
| `packages/shared/storage` | `StorageClient` interface, `R2StorageClient`, key hierarchy, MIME allowlist, magic byte verifier, plan limits, serving helpers |
| `packages/shared/jobs` | Typed queue definitions, `enqueueJob()` helper |
| API endpoints | `POST /api/upload/presign`, `POST /api/upload/complete/{fileId}`, `GET /api/files/{fileId}` |
| Docker Compose | MinIO (S3-compatible local storage), ClamAV (optional profile) |

**What this unlocks:**
- Phase 2 (Sync) can enqueue sync jobs to BullMQ and push sync status updates via the real-time event bridge.
- Phase 3 (Core UX) can use file upload for record attachments, Smart Doc images, and portal assets. Grid live updates use the real-time scaffold. File attachment field type renders using the serving strategy.
