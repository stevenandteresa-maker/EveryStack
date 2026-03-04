# Phase 1G — Runtime Services: Real-Time Scaffold, Background Worker, File Upload

## Phase Context

### What Has Been Built
See `docs/skills/phase-context/SKILL.md` for the current build state. Key outputs from prior phases that this phase directly depends on:
- Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds (Phase 1A)
- Docker Compose with PostgreSQL 16, PgBouncer, Redis (Phase 1A)
- GitHub Actions CI pipeline (lint → typecheck → test gates) (Phase 1A)
- ESLint + Prettier configuration with `no-console` and `no-any` rules (Phase 1A)
- TypeScript strict mode across all packages (Phase 1A)
- Drizzle schema for all 50 MVP tables including `files` table (Phase 1B)
- PgBouncer connection pooling, `getDbForTenant()` with read/write routing (Phase 1B)
- RLS policies enforcing tenant isolation, UUIDv7 primary keys (Phase 1B)
- Clerk integration with webhook handler (Phase 1C)
- Tenant middleware (`getTenantId` from session) (Phase 1C)
- Five workspace roles on `workspace_memberships`, permission check utilities (Phase 1C)
- `PermissionDeniedError` typed error shape (Phase 1C)
- Pino + pino-http structured logging, traceId via AsyncLocalStorage (Phase 1D)
- Sentry DSN integration, OpenTelemetry basic instrumentation (Phase 1D)
- Security headers middleware, encryption at rest/in transit config (Phase 1D)
- Webhook signature verification pattern, typed error classes (Phase 1D)
- Vitest workspace config, Playwright E2E setup, test factories (Phase 1E)
- `testTenantIsolation()` helper, mock Clerk session utilities, MSW mocks (Phase 1E)
- shadcn/ui primitives, Tailwind token system, three-layer color architecture (Phase 1F)
- DM Sans + JetBrains Mono fonts, responsive application shell layout (Phase 1F)

### What This Phase Delivers
Three server-side runtime services: (1) a Socket.io real-time server (`apps/realtime`) with Clerk JWT authentication, Redis adapter for horizontal scaling, room-based pub/sub for workspace/table/record/thread/user events, and reconnection with exponential backoff; (2) a BullMQ background job processing skeleton (`apps/worker`) with queue definitions for all MVP job types, a job processor base class, and graceful shutdown; (3) a complete file upload pipeline with an `StorageClient` abstraction, R2 implementation, presigned URL upload endpoints, MIME allowlist with magic byte verification, image thumbnail generation via Sharp, ClamAV virus scanning integration, signed URL file serving, and orphan cleanup.

### What This Phase Does NOT Build
- Presence system — cursor broadcasting, active user indicators (Core UX)
- Chat / DM real-time message delivery, typing indicators (post-MVP — Advanced Communications)
- Smart Doc collaborative editing via Hocuspocus (post-MVP)
- Sync status push from worker to real-time (Phase 2 — Sync)
- Actual sync, automation, email, or document generation job implementations (later phases populate queues)
- File attachment field UI rendering in Grid or Record View (Core UX)
- Smart Doc image upload UI (Core UX)
- Portal asset management or portal-specific CDN serving (post-MVP)
- Multipart upload for >100MB files (post-MVP — Documents)
- Document Intelligence extraction (post-MVP)
- PDF thumbnail generation via Gotenberg (Core UX — requires Gotenberg dependency)
- Grid live updates or table/record presence indicators (Core UX)

### Architecture Patterns for This Phase
- Feature code talks to a **`RealtimeService` abstraction** — never to Socket.io directly. The transport is swappable.
- **Redis as event bus:** Web app and worker publish events to Redis. Real-time service subscribes and forwards to Socket.io clients. Neither producer needs to know about Socket.io.
- Feature code imports **`StorageClient`** from `packages/shared` — never `@aws-sdk` directly.
- **Presigned URLs** for all file uploads — never stream through the server.
- **BullMQ jobs** processed in `apps/worker`. Queue name constants defined in `packages/shared` for cross-package reuse.
- **Tenant isolation on every operation:** Room names prefixed `t:{tenantId}:`, storage keys prefixed `t/{tenantId}/`, all file queries tenant-scoped via `getDbForTenant()`.
- All services use **Pino logger** with traceId propagation — never `console.log`.

### Mandatory Context for All Prompts
`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, types, or constants. Do not load in full for every prompt.

### Skills for This Phase
Load these skill files before executing any prompt in this phase:
- `docs/skills/phase-context/SKILL.md` — Current build state, existing files/modules, active conventions

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | RealtimeService interface, shared types, and Socket.io server scaffold with Redis adapter | None | ~250 |
| 2 | Socket.io Clerk JWT authentication, connection lifecycle, and client connection utility | 1 | ~220 |
| 3 | Room model, join/leave authorization, event publishing, and Redis pub/sub flow | 2 | ~250 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–3) | 1–3 | — |
| 4 | BullMQ worker setup, queue definitions, job processor base class, and graceful shutdown | None | ~230 |
| 5 | StorageClient interface, R2 implementation, and MinIO dev setup | None | ~220 |
| 6 | Presigned upload pipeline, content-type security, and file size limits | 4, 5 | ~260 |
| 7 | Image processing pipeline, virus scanning, file serving, and orphan cleanup | 4, 5, 6 | ~250 |
| CP-2 | Integration Checkpoint 2 (after Prompts 4–7) | 4–7 | — |

---

## Prompt 1: RealtimeService Interface, Shared Types, and Socket.io Server Scaffold

**Depends on:** None
**Skills:** phase-context
**Load context:** `realtime.md` lines 11–38 (Core Principle, Transport Abstraction), lines 131–146 (Horizontal Scaling), lines 201–210 (Deployment)
**Target files:** `packages/shared/realtime/service.ts`, `packages/shared/realtime/types.ts`, `packages/shared/realtime/events.ts`, `packages/shared/realtime/index.ts`, `packages/shared/redis/client.ts`, `apps/realtime/package.json`, `apps/realtime/tsconfig.json`, `apps/realtime/src/server.ts`, `apps/realtime/src/socket-io-realtime-service.ts`, `docker-compose.yml` (update)
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1g-runtime-services` from `main`. Commit with message `feat(realtime): create RealtimeService interface and Socket.io server scaffold with Redis adapter [Phase 1G, Prompt 1]`

### Schema Snapshot
No schema changes. Room identifiers reference existing tables:
- `workspace:{workspaceId}` → `workspaces.id` (UUID)
- `table:{tableId}` → `tables.id` (UUID)
- `record:{recordId}` → `records.id` (UUID)
- `thread:{threadId}` → `threads.id` (UUID)
- `user:{userId}` → `users.id` (UUID)

### Task

**1. Create the shared Redis client factory.**

If not already present from prior phases, create `packages/shared/redis/client.ts`:

```typescript
import Redis from 'ioredis';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest: number | null;
  connectionName?: string;
}

export function getRedisConfig(name?: string): RedisConfig {
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null, // Required for BullMQ compatibility
    connectionName: name,
  };
}

export function createRedisClient(name?: string): Redis {
  return new Redis(getRedisConfig(name));
}
```

Export from `packages/shared/redis/index.ts`. This factory is reused by the real-time service, the worker (BullMQ), and the event publisher.

**2. Create shared real-time types.**

`packages/shared/realtime/types.ts`:

```typescript
export interface PresenceState {
  userId: string;
  status: 'active' | 'idle' | 'away';
  cursor?: { x: number; y: number; fieldId?: string; recordId?: string };
  lastActiveAt: number;
}

export interface RoomMember {
  userId: string;
  joinedAt: number;
  metadata?: RoomMetadata;
}

export interface RoomMetadata {
  displayName?: string;
  avatarUrl?: string;
}

export type RoomPattern =
  | `workspace:${string}`
  | `table:${string}`
  | `record:${string}`
  | `thread:${string}`
  | `user:${string}`;
```

**3. Create the shared real-time event constants.**

`packages/shared/realtime/events.ts`:

```typescript
export const REALTIME_EVENTS = {
  // Record events
  RECORD_CREATED: 'record.created',
  RECORD_UPDATED: 'record.updated',
  RECORD_DELETED: 'record.deleted',
  RECORD_CREATED_BATCH: 'record.created.batch',
  RECORD_UPDATED_BATCH: 'record.updated.batch',
  RECORD_DELETED_BATCH: 'record.deleted.batch',

  // Sync events
  SYNC_STARTED: 'sync.started',
  SYNC_BATCH_COMPLETE: 'sync.batch_complete',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',

  // Schema events
  FIELD_CREATED: 'field.created',
  FIELD_UPDATED: 'field.updated',
  FIELD_DELETED: 'field.deleted',
  VIEW_UPDATED: 'view.updated',

  // File events
  FILE_UPLOADED: 'file.uploaded',
  FILE_SCAN_COMPLETE: 'file.scan_complete',
  FILE_THUMBNAIL_READY: 'file.thumbnail_ready',

  // Notification events
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
```

These constants are the canonical event names used by publishers and subscribers. New events are added as features ship in later phases.

**4. Create the `RealtimeService` interface.**

`packages/shared/realtime/service.ts`:

```typescript
import type { PresenceState, RoomMember, RoomMetadata, RoomPattern } from './types';

export interface RealtimeService {
  joinRoom(roomId: RoomPattern, userId: string, metadata?: RoomMetadata): Promise<void>;
  leaveRoom(roomId: RoomPattern, userId: string): Promise<void>;
  getRoomMembers(roomId: RoomPattern): Promise<RoomMember[]>;
  emitToRoom(roomId: RoomPattern, event: string, payload: unknown): Promise<void>;
  emitToUser(userId: string, event: string, payload: unknown): Promise<void>;
  broadcast(event: string, payload: unknown, excludeUserId?: string): Promise<void>;
  setPresence(roomId: RoomPattern, userId: string, state: PresenceState): Promise<void>;
  getPresence(roomId: RoomPattern): Promise<PresenceState[]>;
}
```

Note: `setPresence` and `getPresence` are defined in the interface for completeness but will be implemented as stubs in this phase. Full presence with Redis TTL is built in Core UX.

**5. Create the barrel export.**

`packages/shared/realtime/index.ts` re-exports everything from `service.ts`, `types.ts`, and `events.ts`.

**6. Set up the Socket.io server entry point.**

`apps/realtime/src/server.ts`:

- Create an HTTP server using Node.js `http` module.
- Attach Socket.io with CORS configuration allowing the web app origin (`process.env.WEB_APP_URL ?? 'http://localhost:3000'`).
- Configure the Redis adapter using `@socket.io/redis-adapter` with `createRedisClient` from `packages/shared`.
- Set Socket.io transport options: `['websocket', 'polling']` (WebSocket preferred, polling fallback).
- Set `pingTimeout: 20000` and `pingInterval: 25000`.
- Log server startup with Pino (`realtime service listening on port ${PORT}`).
- Implement graceful shutdown: on `SIGTERM`/`SIGINT`, close all connections, disconnect Redis, then `process.exit(0)`.

The server should listen on `process.env.REALTIME_PORT ?? 3002`.

**7. Create the `SocketIORealtimeService` skeleton.**

`apps/realtime/src/socket-io-realtime-service.ts`:

- Implements `RealtimeService` from `packages/shared`.
- Constructor accepts the Socket.io `Server` instance.
- `joinRoom`: Finds the socket for the given user and joins the Socket.io room.
- `leaveRoom`: Finds the socket for the given user and leaves the Socket.io room.
- `getRoomMembers`: Returns connected sockets in the room.
- `emitToRoom`: Emits an event to all sockets in a room.
- `emitToUser`: Emits an event to a specific user's socket(s).
- `broadcast`: Emits to all connected sockets (optionally excluding a user).
- `setPresence`: Stub — logs a warning that presence is not yet implemented.
- `getPresence`: Stub — returns an empty array.

All room names are internally prefixed with `t:{tenantId}:` for tenant isolation. The tenantId is extracted from the socket's auth data (set during connection — Prompt 2).

**8. Update Docker Compose.**

Add the `realtime` service to `docker-compose.yml`:

```yaml
realtime:
  build:
    context: .
    dockerfile: apps/realtime/Dockerfile
  command: pnpm --filter @everystack/realtime dev
  ports:
    - "3002:3002"
  environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - REALTIME_PORT=3002
    - WEB_APP_URL=http://localhost:3000
  depends_on:
    - redis
```

If Docker Compose uses a dev command approach (no Dockerfile in dev), use the appropriate dev setup matching the existing `web` and `worker` service patterns from Phase 1A.

**9. Install dependencies.**

In `apps/realtime/package.json`, add:
- `socket.io`
- `@socket.io/redis-adapter`
- `ioredis`

In `packages/shared/package.json`, add (if not already present):
- `ioredis`

**10. Write unit tests.**

`packages/shared/realtime/__tests__/types.test.ts`:
- Test that `RoomPattern` type accepts valid patterns (`workspace:uuid`, `table:uuid`, etc.)
- Test that `REALTIME_EVENTS` has all expected event names

`apps/realtime/src/__tests__/socket-io-realtime-service.test.ts`:
- Test `emitToRoom` calls Socket.io `to().emit()` with tenant-prefixed room name
- Test `joinRoom` adds socket to the correct room
- Test `setPresence` logs a warning (stub behavior)
- Mock the Socket.io Server instance

### Acceptance Criteria
- [ ] `RealtimeService` interface is exported from `packages/shared/realtime`
- [ ] `PresenceState`, `RoomMember`, `RoomMetadata`, and `RoomPattern` types are exported from `packages/shared/realtime`
- [ ] `REALTIME_EVENTS` constant exports all 17 event names with correct values
- [ ] `createRedisClient()` factory exported from `packages/shared/redis` creates a configured ioredis instance
- [ ] Socket.io server starts on port 3002 with Redis adapter connected
- [ ] `SocketIORealtimeService` implements all 8 methods of `RealtimeService`
- [ ] Room names are internally prefixed with `t:{tenantId}:` for tenant isolation
- [ ] Docker Compose starts the realtime service alongside web, worker, postgres, and redis
- [ ] Graceful shutdown closes connections and exits cleanly on SIGTERM
- [ ] All unit tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Clerk JWT authentication on connection (Prompt 2)
- Room join authorization or permission checks (Prompt 3)
- Event publishing utility for web app / worker (Prompt 3)
- Client-side Socket.io connection hook (Prompt 2)
- Presence system with Redis TTL and heartbeat (Core UX)
- Chat message delivery or typing indicators (post-MVP)

---

## Prompt 2: Socket.io Connection Authentication and Lifecycle

**Depends on:** Prompt 1
**Skills:** phase-context
**Load context:** `realtime.md` lines 59–106 (Connection Lifecycle, Authentication & Authorization, Reconnection Strategy, Stale Data Indicator)
**Target files:** `apps/realtime/src/middleware/auth.ts`, `apps/realtime/src/server.ts` (update), `apps/web/src/lib/realtime/client.ts`, `apps/web/src/lib/realtime/use-realtime-connection.ts`, `apps/web/src/lib/realtime/index.ts`
**Migration required:** No
**Git:** Commit with message `feat(realtime): add Clerk JWT auth on connection, lifecycle management, and client connection utility [Phase 1G, Prompt 2]`

### Schema Snapshot
No schema changes. Authentication reads `userId` and `tenantId` from the Clerk JWT token validated on handshake.

### Task

**1. Create the Socket.io authentication middleware.**

`apps/realtime/src/middleware/auth.ts`:

Socket.io supports middleware via `io.use()`. Create an auth middleware that:

1. Extracts the Clerk session token from `socket.handshake.auth.token`.
2. Validates the token using `@clerk/backend` (the `verifyToken` function or `clerkClient.verifyToken()`). Use the same Clerk verification approach established in Phase 1C.
3. On success: Attach `userId` and `tenantId` to `socket.data`:
   ```typescript
   socket.data.userId = session.userId;
   socket.data.tenantId = session.tenantId; // From Clerk org metadata or tenant resolver
   ```
4. On failure: Call `next(new Error('AUTH_FAILED'))` — Socket.io will reject the connection.

The `tenantId` resolution should use the same `tenant-resolver.ts` pattern from Phase 1C (Clerk org ID → internal tenant UUID lookup).

```typescript
import type { Socket } from 'socket.io';
import { verifyToken } from '@clerk/backend';

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('AUTH_FAILED'));
    }

    const session = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });

    const tenantId = await resolveTenantId(session.org_id);
    if (!tenantId) {
      return next(new Error('AUTH_FAILED'));
    }

    socket.data.userId = session.sub;
    socket.data.tenantId = tenantId;
    next();
  } catch {
    next(new Error('AUTH_FAILED'));
  }
}
```

Adapt the Clerk verification call to match the exact API used in Phase 1C. The code above is illustrative — use the established pattern.

**2. Wire auth middleware into the Socket.io server.**

Update `apps/realtime/src/server.ts`:
- Register the auth middleware: `io.use(authenticateSocket)`.
- On successful connection, log: `logger.info({ userId, tenantId }, 'client connected')`.
- On disconnect, log: `logger.info({ userId, tenantId, reason }, 'client disconnected')`.
- Automatically join the user's personal room: `socket.join(\`t:${tenantId}:user:${userId}\`)`.

**3. Handle connection events.**

In `apps/realtime/src/server.ts`, within the `io.on('connection')` handler:

- On `disconnect`: Clean up any room memberships. Log the disconnect reason.
- On `error`: Log the error with Pino. Do not crash the server.
- The personal `user:{userId}` room join on connect enables cross-workspace notifications (e.g., `notification.created` events targeting a specific user).

**4. Create the client-side connection utility.**

`apps/web/src/lib/realtime/client.ts`:

```typescript
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getRealtimeClient(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:3002', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.2, // ±20% jitter
    reconnectionAttempts: Infinity,
    timeout: 20000,
  });

  return socket;
}

export function disconnectRealtimeClient(): void {
  socket?.disconnect();
  socket = null;
}
```

The reconnection parameters match the spec from `realtime.md`:
- Initial delay: 1,000ms
- Backoff multiplier: 2x (Socket.io default)
- Max delay: 30,000ms
- Jitter: ±20%
- Max retry attempts: Unlimited

**5. Create a React hook for real-time connection management.**

`apps/web/src/lib/realtime/use-realtime-connection.ts`:

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { getRealtimeClient, disconnectRealtimeClient } from './client';
import type { Socket } from 'socket.io-client';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export function useRealtimeConnection(): {
  socket: Socket | null;
  status: ConnectionStatus;
} {
  const { getToken } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let mounted = true;

    async function connect() {
      const token = await getToken();
      if (!token || !mounted) return;

      const sock = getRealtimeClient(token);
      socketRef.current = sock;

      sock.on('connect', () => mounted && setStatus('connected'));
      sock.on('disconnect', () => mounted && setStatus('disconnected'));
      sock.on('reconnect_attempt', () => mounted && setStatus('reconnecting'));
      sock.on('connect_error', (err) => {
        if (err.message === 'AUTH_FAILED' || err.message === 'AUTH_EXPIRED') {
          // Do not retry auth failures — token needs refresh or user needs re-login
          sock.disconnect();
        }
      });

      setStatus('connecting');
    }

    connect();

    return () => {
      mounted = false;
      disconnectRealtimeClient();
    };
  }, [getToken]);

  return { socket: socketRef.current, status };
}
```

This hook connects on mount, manages reconnection, and exposes connection status. Feature-specific room subscriptions are added in Core UX — this hook only manages the connection lifecycle.

**6. Add `NEXT_PUBLIC_REALTIME_URL` to `.env.example`.**

```
NEXT_PUBLIC_REALTIME_URL=http://localhost:3002
```

**7. Create barrel export.**

`apps/web/src/lib/realtime/index.ts` re-exports `getRealtimeClient`, `disconnectRealtimeClient`, `useRealtimeConnection`, and `ConnectionStatus`.

**8. Install client-side dependency.**

In `apps/web/package.json`, add:
- `socket.io-client`

In `apps/realtime/package.json`, add (if not already from Prompt 1):
- `@clerk/backend`

**9. Write tests.**

`apps/realtime/src/middleware/__tests__/auth.test.ts`:
- Test that valid Clerk token results in `socket.data.userId` and `socket.data.tenantId` being set
- Test that missing token calls `next` with `AUTH_FAILED` error
- Test that invalid token calls `next` with `AUTH_FAILED` error
- Test that expired token calls `next` with `AUTH_FAILED` error
- Mock `verifyToken` and `resolveTenantId`

`apps/web/src/lib/realtime/__tests__/client.test.ts`:
- Test that `getRealtimeClient` returns a Socket.io client configured with correct reconnection params
- Test that `disconnectRealtimeClient` disconnects and nulls the reference
- Mock `socket.io-client`

### Acceptance Criteria
- [ ] Socket.io handshake validates Clerk JWT token before accepting connections
- [ ] `socket.data.userId` and `socket.data.tenantId` are populated on successful auth
- [ ] Connections with missing or invalid tokens are rejected with `AUTH_FAILED`
- [ ] User automatically joins `t:{tenantId}:user:{userId}` room on connect
- [ ] Connection and disconnection events are logged via Pino with userId and tenantId context
- [ ] Client-side `getRealtimeClient()` creates a Socket.io client with correct reconnection parameters (1s initial, 30s max, ±20% jitter, unlimited retries)
- [ ] `useRealtimeConnection` hook exposes `socket` and `status` ('connecting' | 'connected' | 'reconnecting' | 'disconnected')
- [ ] Client does not retry on `AUTH_FAILED` — disconnects instead
- [ ] `NEXT_PUBLIC_REALTIME_URL` is in `.env.example`
- [ ] All tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Room join/leave authorization or permission checks (Prompt 3)
- Event publishing utility (Prompt 3)
- Stale data banner UI component (Core UX)
- Token refresh logic in the client hook — Clerk handles token refresh; the hook reconnects with a fresh token
- Presence heartbeat or idle detection (Core UX)
- Multiple concurrent connections per user (single connection with multiple room subscriptions)

---

## Prompt 3: Room Model, Join/Leave Authorization, Event Publishing, and Redis Pub/Sub Flow

**Depends on:** Prompt 2
**Skills:** phase-context
**Load context:** `realtime.md` lines 43–56 (Room Model), lines 73–76 (Room subscription authorization), lines 109–127 (Event Flow)
**Target files:** `apps/realtime/src/handlers/room-handler.ts`, `apps/realtime/src/server.ts` (update), `packages/shared/realtime/publisher.ts`, `packages/shared/realtime/index.ts` (update), `apps/realtime/src/subscribers/redis-event-subscriber.ts`
**Migration required:** No
**Git:** Commit with message `feat(realtime): implement room model, join/leave authorization, event publishing, and Redis pub/sub flow [Phase 1G, Prompt 3]`

### Schema Snapshot
No schema changes. Room authorization checks read access from existing permission resolution (Phase 1C).

### Task

**1. Create the room handler.**

`apps/realtime/src/handlers/room-handler.ts`:

This handler processes `room:join` and `room:leave` events from connected clients.

```typescript
import type { Socket } from 'socket.io';

export function registerRoomHandlers(socket: Socket): void {
  socket.on('room:join', async (roomId: string, callback?: (result: { ok: boolean }) => void) => {
    const { userId, tenantId } = socket.data;
    const prefixedRoom = `t:${tenantId}:${roomId}`;

    // Authorization: verify user has read access to the resource
    const authorized = await authorizeRoomJoin(tenantId, userId, roomId);
    if (!authorized) {
      // Silent failure — prevents resource enumeration (per realtime.md)
      callback?.({ ok: false });
      return;
    }

    await socket.join(prefixedRoom);
    logger.info({ userId, tenantId, room: roomId }, 'joined room');
    callback?.({ ok: true });
  });

  socket.on('room:leave', async (roomId: string) => {
    const { tenantId } = socket.data;
    const prefixedRoom = `t:${tenantId}:${roomId}`;
    await socket.leave(prefixedRoom);
    logger.info({ userId: socket.data.userId, tenantId, room: roomId }, 'left room');
  });
}
```

**2. Implement room join authorization.**

Create `apps/realtime/src/handlers/authorize-room-join.ts`:

```typescript
export async function authorizeRoomJoin(
  tenantId: string,
  userId: string,
  roomId: string,
): Promise<boolean> {
  // Parse room pattern
  const [resourceType, resourceId] = roomId.split(':');

  switch (resourceType) {
    case 'user':
      // Users can only join their own personal room
      return resourceId === userId;

    case 'workspace':
      // User must be a member of the workspace
      return checkWorkspaceMembership(tenantId, userId, resourceId);

    case 'table':
      // User must have read access to the table's workspace
      return checkTableAccess(tenantId, userId, resourceId);

    case 'record':
      // User must have read access to the record's table
      return checkRecordAccess(tenantId, userId, resourceId);

    case 'thread':
      // User must be a participant in the thread
      return checkThreadAccess(tenantId, userId, resourceId);

    default:
      return false;
  }
}
```

Each `check*` function queries the database using `getDbForTenant()` (read intent) to verify access. These are thin wrappers around the permission utilities from Phase 1C. If a check function is not yet available (e.g., `checkTableAccess` requires the full permission resolution from Core UX), implement a permissive stub that checks workspace membership as a minimum and add a `// TODO: Replace with full permission resolution in Core UX` comment.

**3. Register room handlers on connection.**

Update `apps/realtime/src/server.ts` to call `registerRoomHandlers(socket)` inside the `io.on('connection')` callback.

**4. Create the event publisher.**

`packages/shared/realtime/publisher.ts`:

This utility is used by `apps/web` (Server Actions) and `apps/worker` (job processors) to publish events to Redis. The real-time service subscribes to these channels and forwards to Socket.io rooms.

```typescript
import type Redis from 'ioredis';
import type { RealtimeEventName } from './events';

export interface PublishEventOptions {
  tenantId: string;
  channel: string;       // Room pattern: 'table:{tableId}', 'workspace:{id}', etc.
  event: RealtimeEventName;
  payload: unknown;
  excludeUserId?: string; // Don't echo back to sender
}

export class EventPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(options: PublishEventOptions): Promise<void> {
    const redisChannel = `realtime:t:${options.tenantId}:${options.channel}`;
    await this.redis.publish(
      redisChannel,
      JSON.stringify({
        event: options.event,
        payload: options.payload,
        excludeUserId: options.excludeUserId,
        timestamp: Date.now(),
      }),
    );
  }
}
```

The `realtime:` prefix distinguishes real-time event channels from other Redis pub/sub usage (e.g., cache invalidation).

Export a factory function:
```typescript
export function createEventPublisher(redis: Redis): EventPublisher {
  return new EventPublisher(redis);
}
```

**5. Create the Redis event subscriber in the real-time service.**

`apps/realtime/src/subscribers/redis-event-subscriber.ts`:

This subscribes to Redis pub/sub channels using pattern matching and forwards events to matching Socket.io rooms.

```typescript
import type { Server } from 'socket.io';
import type Redis from 'ioredis';

export function startRedisEventSubscriber(io: Server, redis: Redis): void {
  // Subscribe to all realtime event channels
  redis.psubscribe('realtime:t:*', (err) => {
    if (err) {
      logger.error({ err }, 'failed to subscribe to realtime channels');
      return;
    }
    logger.info('subscribed to realtime event channels');
  });

  redis.on('pmessage', (_pattern, channel, message) => {
    try {
      const parsed = JSON.parse(message) as {
        event: string;
        payload: unknown;
        excludeUserId?: string;
        timestamp: number;
      };

      // Extract the Socket.io room name from the Redis channel
      // Channel format: 'realtime:t:{tenantId}:{roomPattern}'
      // Socket.io room: 't:{tenantId}:{roomPattern}'
      const roomName = channel.replace('realtime:', '');

      if (parsed.excludeUserId) {
        // Emit to all sockets in the room except the sender
        io.to(roomName).except(`user:${parsed.excludeUserId}`).emit(parsed.event, parsed.payload);
      } else {
        io.to(roomName).emit(parsed.event, parsed.payload);
      }
    } catch (err) {
      logger.error({ err, channel }, 'failed to process realtime event');
    }
  });
}
```

**Important:** The subscriber Redis connection must be a **separate** ioredis instance from the one used by the Redis adapter. Redis clients in subscribe mode cannot run other commands. Create a dedicated subscriber client in `server.ts`:

```typescript
const subClient = createRedisClient('realtime-subscriber');
startRedisEventSubscriber(io, subClient);
```

**6. Wire the subscriber into the server.**

Update `apps/realtime/src/server.ts` to start the Redis event subscriber after the server is listening.

**7. Update the barrel export.**

Add `publisher.ts` to `packages/shared/realtime/index.ts`.

**8. Write tests.**

`apps/realtime/src/handlers/__tests__/room-handler.test.ts`:
- Test that `room:join` with valid authorization joins the tenant-prefixed room
- Test that `room:join` with failed authorization does not join (silent failure, callback returns `{ ok: false }`)
- Test that `room:join` for `user:` room only succeeds for the socket's own userId
- Test that `room:leave` leaves the tenant-prefixed room
- Mock socket, authorization functions

`packages/shared/realtime/__tests__/publisher.test.ts`:
- Test that `publish()` calls `redis.publish` with correct channel format (`realtime:t:{tenantId}:{channel}`)
- Test that payload includes event, payload, excludeUserId, and timestamp
- Mock ioredis

`apps/realtime/src/subscribers/__tests__/redis-event-subscriber.test.ts`:
- Test that received Redis messages are forwarded to the correct Socket.io room
- Test that `excludeUserId` excludes the sender's socket
- Test that malformed messages are logged and not forwarded
- Mock Socket.io Server and ioredis

### Acceptance Criteria
- [ ] Clients can join rooms by emitting `room:join` with a room pattern (e.g., `table:{tableId}`)
- [ ] Room join is authorized — users can only join rooms for resources they have read access to
- [ ] Failed room join is silent (no error sent to client, callback returns `{ ok: false }`)
- [ ] Users can only join `user:{id}` rooms matching their own userId
- [ ] All room names are prefixed with `t:{tenantId}:` for tenant isolation
- [ ] `EventPublisher.publish()` writes to Redis with channel format `realtime:t:{tenantId}:{roomPattern}`
- [ ] Redis event subscriber forwards received messages to matching Socket.io rooms
- [ ] `excludeUserId` prevents the sender from receiving their own events
- [ ] A separate Redis client is used for the subscriber (not shared with the adapter)
- [ ] All tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Client-side room subscription hooks (Core UX — each feature adds its own `useTableSubscription`, etc.)
- Redis Streams for catch-up queries on reconnect (Core UX — requires event retention)
- Batch event handling or throttling (Core UX — built with grid live updates)
- Presence broadcasting or heartbeat (Core UX)
- Thread message delivery (post-MVP — Advanced Communications)

---

## Integration Checkpoint 1 (after Prompts 1–3)

**Task:** Verify all real-time infrastructure from Prompts 1–3 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `docker compose up` — verify the realtime service starts alongside web, worker, postgres, and redis
5. Manual verification:
   - Start the dev environment (`docker compose up` or `pnpm dev`)
   - Check realtime service logs: "realtime service listening on port 3002" and "subscribed to realtime event channels"
   - Open browser dev tools console. Create a test script that:
     a. Connects to `ws://localhost:3002` with a valid Clerk token
     b. Emits `room:join` with `workspace:{workspaceId}` — verify callback returns `{ ok: true }`
     c. From a second connection (or via Redis CLI), publish an event to `realtime:t:{tenantId}:workspace:{workspaceId}` — verify the first client receives it
   - Connect with an invalid token — verify connection is rejected
6. Verify Redis adapter is working: check Redis `PUBSUB CHANNELS` shows Socket.io adapter channels

**Git:** Commit with message `chore(verify): integration checkpoint 1 — real-time scaffold verified [Phase 1G, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 4.

---

## Prompt 4: BullMQ Worker Setup, Queue Definitions, and Job Processor Base Class

**Depends on:** None (independent of Prompts 1–3)
**Skills:** phase-context
**Load context:** `CLAUDE.md` lines 33 (BullMQ), lines 59–60 (apps/worker structure)
**Target files:** `packages/shared/queue/constants.ts`, `packages/shared/queue/types.ts`, `packages/shared/queue/index.ts`, `apps/worker/package.json`, `apps/worker/src/index.ts`, `apps/worker/src/lib/base-processor.ts`, `apps/worker/src/lib/graceful-shutdown.ts`, `apps/worker/src/queues.ts`, `docker-compose.yml` (update worker service if needed)
**Migration required:** No
**Git:** Commit with message `feat(worker): set up BullMQ skeleton with queue definitions, job processor base class, and graceful shutdown [Phase 1G, Prompt 4]`

### Schema Snapshot
No schema changes. Worker jobs will reference existing tables when processing jobs in later phases.

### Task

**1. Define shared queue constants.**

`packages/shared/queue/constants.ts`:

```typescript
export const QUEUE_NAMES = {
  SYNC: 'sync',
  FILE_PROCESSING: 'file-processing',
  EMAIL: 'email',
  AUTOMATION: 'automation',
  DOCUMENT_GEN: 'document-gen',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
```

These names are the single source of truth for queue identification across all packages.

**2. Define shared job type interfaces.**

`packages/shared/queue/types.ts`:

```typescript
import type { QueueName } from './constants';

/** Base shape for all job data — every job carries tenant context */
export interface BaseJobData {
  tenantId: string;
  traceId: string;
  triggeredBy: string; // userId or 'system'
}

/** File processing job types */
export interface FileThumbnailJobData extends BaseJobData {
  fileId: string;
}

export interface FileScanJobData extends BaseJobData {
  fileId: string;
}

export interface FileOrphanCleanupJobData extends BaseJobData {
  batchSize: number;
}

/** Placeholder interfaces for future phases */
export interface SyncJobData extends BaseJobData {
  connectionId: string;
  tableId: string;
  syncType: 'full' | 'incremental';
}

export interface EmailJobData extends BaseJobData {
  templateId: string;
  to: string;
  variables: Record<string, unknown>;
}

export interface AutomationJobData extends BaseJobData {
  automationId: string;
  triggerId: string;
  triggerPayload: Record<string, unknown>;
}

export interface DocumentGenJobData extends BaseJobData {
  templateId: string;
  recordId: string;
  outputFormat: 'pdf' | 'docx';
}

/** Map queue names to their job data types */
export interface QueueJobDataMap {
  sync: SyncJobData;
  'file-processing': FileThumbnailJobData | FileScanJobData | FileOrphanCleanupJobData;
  email: EmailJobData;
  automation: AutomationJobData;
  'document-gen': DocumentGenJobData;
  cleanup: FileOrphanCleanupJobData;
}
```

These interfaces ensure type safety when enqueuing and processing jobs. Future phases refine these as job implementations are built.

**3. Create the barrel export.**

`packages/shared/queue/index.ts` re-exports everything from `constants.ts` and `types.ts`.

**4. Create the job processor base class.**

`apps/worker/src/lib/base-processor.ts`:

```typescript
import { Worker, type Job, type Processor } from 'bullmq';
import { type Logger } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { QueueName } from '@everystack/shared/queue';

const traceStore = new AsyncLocalStorage<{ traceId: string }>();

export abstract class BaseProcessor<TData extends { traceId: string; tenantId: string }> {
  protected worker: Worker;

  constructor(
    protected readonly queueName: QueueName,
    protected readonly logger: Logger,
    protected readonly concurrency: number = 1,
  ) {
    this.worker = new Worker(
      queueName,
      async (job: Job<TData>) => {
        return traceStore.run({ traceId: job.data.traceId }, () => this.processJob(job));
      },
      {
        connection: getRedisConfig(),
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.info({ jobId: job.id, queue: queueName }, 'job completed');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error({ jobId: job?.id, queue: queueName, err }, 'job failed');
      // Sentry capture here — using Sentry integration from Phase 1D
    });

    this.worker.on('error', (err) => {
      this.logger.error({ queue: queueName, err }, 'worker error');
    });
  }

  abstract processJob(job: Job<TData>): Promise<void>;

  async close(): Promise<void> {
    await this.worker.close();
  }
}
```

The `traceStore.run()` call propagates the traceId from the job data into `AsyncLocalStorage`, so Pino automatically includes it in all log lines during job execution (matching the Phase 1D traceId pattern).

**5. Create the queue registry and startup.**

`apps/worker/src/queues.ts`:

```typescript
import { Queue } from 'bullmq';
import { QUEUE_NAMES, type QueueName } from '@everystack/shared/queue';
import { getRedisConfig } from '@everystack/shared/redis';

const queues = new Map<QueueName, Queue>();

export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedisConfig() });
    queues.set(name, queue);
  }
  return queue;
}

export function initializeQueues(): void {
  for (const name of Object.values(QUEUE_NAMES)) {
    getQueue(name);
  }
}

export async function closeAllQueues(): Promise<void> {
  const promises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(promises);
  queues.clear();
}
```

**6. Create the graceful shutdown handler.**

`apps/worker/src/lib/graceful-shutdown.ts`:

```typescript
import type { Logger } from 'pino';

type ShutdownFn = () => Promise<void>;

const shutdownHandlers: ShutdownFn[] = [];
let isShuttingDown = false;

export function registerShutdownHandler(fn: ShutdownFn): void {
  shutdownHandlers.push(fn);
}

export function setupGracefulShutdown(logger: Logger): void {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, 'graceful shutdown initiated');

    const timeout = setTimeout(() => {
      logger.error('graceful shutdown timed out after 30s, forcing exit');
      process.exit(1);
    }, 30_000);

    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (err) {
        logger.error({ err }, 'shutdown handler failed');
      }
    }

    clearTimeout(timeout);
    logger.info('graceful shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```

This drains all active jobs (BullMQ's `worker.close()` waits for in-progress jobs to finish) before exiting. The 30-second timeout prevents hanging on stuck jobs.

**7. Create the worker entry point.**

`apps/worker/src/index.ts`:

```typescript
import { createLogger } from '@everystack/shared/logger'; // Phase 1D Pino setup
import { initializeQueues, closeAllQueues } from './queues';
import { setupGracefulShutdown, registerShutdownHandler } from './lib/graceful-shutdown';
// Job processors will be imported here as they are built in later phases

const logger = createLogger('worker');

async function main(): Promise<void> {
  logger.info('worker starting');

  initializeQueues();
  registerShutdownHandler(closeAllQueues);

  // Register job processors
  // registerShutdownHandler(() => fileProcessor.close());  // Prompt 7
  // registerShutdownHandler(() => syncProcessor.close());  // Phase 2

  setupGracefulShutdown(logger);
  logger.info('worker ready — listening for jobs');
}

main().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
```

**8. Update Docker Compose worker service if needed.**

Ensure the worker service in `docker-compose.yml` has the Redis connection environment variables:
```yaml
worker:
  environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
```

**9. Install dependencies.**

In `apps/worker/package.json`, add:
- `bullmq`
- `ioredis`

**10. Write tests.**

`packages/shared/queue/__tests__/constants.test.ts`:
- Test that `QUEUE_NAMES` has exactly 6 entries
- Test that all values are lowercase kebab-case strings

`apps/worker/src/lib/__tests__/base-processor.test.ts`:
- Test that `processJob` is called with job data
- Test that completed jobs are logged
- Test that failed jobs are logged with error details
- Test that traceId is propagated via AsyncLocalStorage
- Mock BullMQ Worker

`apps/worker/src/lib/__tests__/graceful-shutdown.test.ts`:
- Test that shutdown handlers are called in order on SIGTERM
- Test that forced exit fires after 30s timeout
- Test that duplicate signals are ignored (`isShuttingDown` guard)

### Acceptance Criteria
- [ ] `QUEUE_NAMES` exports 6 queue names: sync, file-processing, email, automation, document-gen, cleanup
- [ ] `BaseJobData` requires `tenantId`, `traceId`, and `triggeredBy` on all jobs
- [ ] `BaseProcessor` abstract class wraps BullMQ `Worker` with logging, traceId propagation, and error handling
- [ ] `initializeQueues()` creates BullMQ `Queue` instances for all 6 queues
- [ ] `getQueue(name)` returns a typed queue instance for enqueuing jobs
- [ ] Graceful shutdown calls `worker.close()` on all processors (draining in-progress jobs)
- [ ] Forced exit after 30s timeout prevents hanging on stuck jobs
- [ ] Worker entry point starts cleanly and logs "worker ready — listening for jobs"
- [ ] All tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Actual job processor implementations (sync, email, automation, document-gen — later phases)
- Job scheduling or cron (scheduled jobs added per feature)
- BullMQ dashboard or admin UI (operational tooling)
- Job priority or rate limiting configuration (added per queue as needed)
- Dead letter queue handling (added when job implementations are built)
- File processing jobs (Prompts 6–7)

---

## Prompt 5: StorageClient Interface, R2 Implementation, and MinIO Dev Setup

**Depends on:** None (independent of Prompts 1–4)
**Skills:** phase-context
**Load context:** `files.md` lines 70–125 (Storage Client, Provider Abstraction, Storage Key Hierarchy)
**Target files:** `packages/shared/storage/client.ts`, `packages/shared/storage/r2-client.ts`, `packages/shared/storage/keys.ts`, `packages/shared/storage/config.ts`, `packages/shared/storage/index.ts`, `docker-compose.yml` (update — add MinIO)
**Migration required:** No
**Git:** Commit with message `feat(storage): create StorageClient interface, R2 implementation, storage key utilities, and MinIO dev setup [Phase 1G, Prompt 5]`

### Schema Snapshot
No schema changes. The `files` table schema was created in Phase 1B. This prompt creates the storage layer that manages the actual file objects referenced by `files.storage_key`.

### Task

**1. Create the `StorageClient` interface.**

`packages/shared/storage/client.ts`:

```typescript
export interface PresignOptions {
  contentType: string;
  contentLength: number;
  expiresInSeconds?: number; // Default: 3600 (1 hour)
}

export interface PresignResult {
  url: string;
  headers: Record<string, string>;
}

export interface HeadObjectResult {
  size: number;
  contentType: string;
}

export interface StorageClient {
  presignPut(key: string, options: PresignOptions): Promise<PresignResult>;
  presignGet(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
  headObject(key: string): Promise<HeadObjectResult | null>;
  getStream(key: string): Promise<ReadableStream>;
}
```

Feature code imports `StorageClient` from this package — never `@aws-sdk` directly.

**2. Create the storage configuration.**

`packages/shared/storage/config.ts`:

```typescript
export interface StorageConfig {
  bucket: string;
  region: string;
  endpoint: string;
  publicUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getStorageConfig(): StorageConfig {
  return {
    bucket: process.env.STORAGE_BUCKET ?? 'everystack-dev',
    region: process.env.STORAGE_REGION ?? 'auto',
    endpoint: process.env.STORAGE_ENDPOINT ?? 'http://localhost:9000',
    publicUrl: process.env.STORAGE_PUBLIC_URL ?? 'http://localhost:9000/everystack-dev',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? 'minioadmin',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? 'minioadmin',
  };
}
```

**3. Implement the R2 storage client.**

`packages/shared/storage/r2-client.ts`:

```typescript
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { StorageClient, PresignOptions, PresignResult, HeadObjectResult } from './client';
import { getStorageConfig } from './config';

export class R2StorageClient implements StorageClient {
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor() {
    const config = getStorageConfig();
    this.bucket = config.bucket;
    this.s3 = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO and R2
    });
  }

  async presignPut(key: string, options: PresignOptions): Promise<PresignResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: options.contentType,
      ContentLength: options.contentLength,
    });
    const url = await getSignedUrl(this.s3, command, {
      expiresIn: options.expiresInSeconds ?? 3600,
    });
    return {
      url,
      headers: {
        'Content-Type': options.contentType,
        'Content-Length': String(options.contentLength),
      },
    };
  }

  async presignGet(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: 'attachment',
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    // S3 DeleteObjects supports max 1000 keys per request
    const batches = [];
    for (let i = 0; i < keys.length; i += 1000) {
      batches.push(keys.slice(i, i + 1000));
    }
    for (const batch of batches) {
      await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })) },
        }),
      );
    }
  }

  async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const result = await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        size: result.ContentLength ?? 0,
        contentType: result.ContentType ?? 'application/octet-stream',
      };
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'NotFound') return null;
      throw err;
    }
  }

  async getStream(key: string): Promise<ReadableStream> {
    const result = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return result.Body!.transformToWebStream();
  }
}
```

**4. Create storage key utilities.**

`packages/shared/storage/keys.ts`:

```typescript
/** Storage key hierarchy per files.md */
export function fileOriginalKey(tenantId: string, fileId: string, filename: string): string {
  return `t/${tenantId}/files/${fileId}/original/${filename}`;
}

export function fileThumbnailKey(tenantId: string, fileId: string, size: number): string {
  return `t/${tenantId}/files/${fileId}/thumb/${size}.webp`;
}

export function portalAssetKey(tenantId: string, portalId: string, assetName: string): string {
  return `t/${tenantId}/portal-assets/${portalId}/${assetName}`;
}

export function docGenOutputKey(tenantId: string, docId: string, ext: string): string {
  return `t/${tenantId}/doc-gen/${docId}/output.${ext}`;
}

export function templateKey(tenantId: string, templateId: string): string {
  return `t/${tenantId}/templates/${templateId}/template.docx`;
}

export function quarantineKey(tenantId: string, fileId: string, filename: string): string {
  return `t/${tenantId}/quarantine/${fileId}/${filename}`;
}
```

All key functions enforce the `t/{tenantId}/` prefix for tenant isolation.

**5. Create the barrel export.**

`packages/shared/storage/index.ts` re-exports `StorageClient`, `R2StorageClient`, all key utilities, `getStorageConfig`, and the type interfaces.

**6. Add MinIO to Docker Compose.**

Add to `docker-compose.yml`:

```yaml
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports:
    - "9000:9000"   # S3 API
    - "9001:9001"   # MinIO Console
  environment:
    - MINIO_ROOT_USER=minioadmin
    - MINIO_ROOT_PASSWORD=minioadmin
  volumes:
    - minio-data:/data

# Add to volumes section:
volumes:
  minio-data:
```

Also add a one-time bucket creation init container or startup script. Use the MinIO client (`mc`) to create the `everystack-dev` bucket:

```yaml
minio-init:
  image: minio/mc:latest
  depends_on:
    minio:
      condition: service_started
  entrypoint: >
    /bin/sh -c "
    sleep 2 &&
    mc alias set local http://minio:9000 minioadmin minioadmin &&
    mc mb --ignore-existing local/everystack-dev &&
    echo 'Bucket created'
    "
```

**7. Add storage environment variables to `.env.example`.**

```
STORAGE_BUCKET=everystack-dev
STORAGE_REGION=auto
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_PUBLIC_URL=http://localhost:9000/everystack-dev
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
```

**8. Install dependencies.**

In `packages/shared/package.json`, add:
- `@aws-sdk/client-s3`
- `@aws-sdk/s3-request-presigner`

**9. Write tests.**

`packages/shared/storage/__tests__/r2-client.test.ts`:
- Test `presignPut` returns a URL and headers with correct content type
- Test `presignGet` returns a signed URL string
- Test `delete` sends DeleteObjectCommand
- Test `deleteMany` batches keys in groups of 1000
- Test `headObject` returns null for non-existent keys
- Mock `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`

`packages/shared/storage/__tests__/keys.test.ts`:
- Test that all key functions produce paths starting with `t/{tenantId}/`
- Test `fileOriginalKey` format: `t/{tenantId}/files/{fileId}/original/{filename}`
- Test `fileThumbnailKey` format: `t/{tenantId}/files/{fileId}/thumb/{size}.webp`
- Test `quarantineKey` format: `t/{tenantId}/quarantine/{fileId}/{filename}`

### Acceptance Criteria
- [ ] `StorageClient` interface is exported from `packages/shared/storage` with all 6 methods
- [ ] `R2StorageClient` implements `StorageClient` using `@aws-sdk/client-s3`
- [ ] `forcePathStyle: true` is set on the S3 client (required for MinIO and R2)
- [ ] `deleteMany` batches deletions in groups of 1000
- [ ] `headObject` returns `null` for non-existent objects (not an error)
- [ ] All storage key functions enforce the `t/{tenantId}/` prefix
- [ ] MinIO runs in Docker Compose on ports 9000 (S3 API) and 9001 (console)
- [ ] `everystack-dev` bucket is auto-created via the init container
- [ ] Storage environment variables are in `.env.example`
- [ ] All tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Multipart upload for large files (post-MVP — Documents)
- CDN configuration or custom domain setup (production deployment)
- R2-specific features beyond S3 compatibility (keep provider-agnostic)
- Storage quota tracking (Prompt 6 handles quota checks)
- Thumbnail generation or image processing (Prompt 7)

---

## Prompt 6: Presigned Upload Pipeline and Content-Type Security

**Depends on:** Prompts 4, 5
**Skills:** phase-context
**Load context:** `files.md` lines 126–165 (Upload Flow), lines 166–212 (Content-Type Security), lines 293–306 (File Size Limits)
**Target files:** `apps/web/src/app/api/upload/presign/route.ts`, `apps/web/src/app/api/upload/complete/[fileId]/route.ts`, `packages/shared/storage/mime.ts`, `packages/shared/storage/magic-bytes.ts`, `packages/shared/storage/sanitize.ts`, `packages/shared/storage/limits.ts`
**Migration required:** No
**Git:** Commit with message `feat(upload): build presigned upload pipeline with MIME allowlist, magic byte verification, and file size limits [Phase 1G, Prompt 6]`

### Schema Snapshot
References the `files` table (created in Phase 1B):

| Column | Type | Relevant to this prompt |
|--------|------|------------------------|
| `id` | UUID | Generated on presign |
| `tenant_id` | UUID | From session |
| `uploaded_by` | UUID | From session |
| `storage_key` | VARCHAR | Generated using key utilities |
| `original_filename` | VARCHAR(255) | Sanitized user input |
| `mime_type` | VARCHAR(127) | Validated against allowlist |
| `size_bytes` | BIGINT | Validated against plan limits |
| `scan_status` | VARCHAR | Set to `'pending'` on creation |
| `context_type` | VARCHAR | From request body |
| `context_id` | UUID | From request body |
| `created_at` | TIMESTAMPTZ | Auto-set |

### Task

**1. Create the MIME allowlist.**

`packages/shared/storage/mime.ts`:

```typescript
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // Images
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'image/heic': ['.heic'],
  'image/heif': ['.heif'],

  // Documents
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/csv': ['.csv'],
  'text/plain': ['.txt'],
  'application/json': ['.json'],

  // Audio/Video (Business+ only — enforced at plan level)
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],

  // Archives
  'application/zip': ['.zip'],
};

export function isAllowedMimeType(mimeType: string): boolean {
  return mimeType in ALLOWED_MIME_TYPES;
}

export function isAllowedExtension(mimeType: string, filename: string): boolean {
  const allowedExts = ALLOWED_MIME_TYPES[mimeType];
  if (!allowedExts) return false;
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return allowedExts.includes(ext);
}

/** Image MIME types that support thumbnail generation */
export const THUMBNAIL_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
]);
```

**2. Create the magic byte verification module.**

`packages/shared/storage/magic-bytes.ts`:

```typescript
/** Magic byte signatures for MIME type verification */
const MAGIC_SIGNATURES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header; 'WEBP' at offset 8
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  {
    mime: 'application/zip',
    bytes: [0x50, 0x4B, 0x03, 0x04],
  }, // PK.. (also covers .docx, .xlsx, .pptx)
];

export function verifyMagicBytes(
  buffer: Buffer,
  claimedMime: string,
): { valid: boolean; detectedMime?: string } {
  for (const sig of MAGIC_SIGNATURES) {
    const offset = sig.offset ?? 0;
    const matches = sig.bytes.every((byte, i) => buffer[offset + i] === byte);
    if (matches && sig.mime === claimedMime) {
      return { valid: true };
    }
    if (matches && sig.mime !== claimedMime) {
      return { valid: false, detectedMime: sig.mime };
    }
  }

  // For MIME types without magic byte signatures (text/csv, text/plain, etc.),
  // accept if the MIME type is in the allowlist
  if (isAllowedMimeType(claimedMime)) {
    return { valid: true };
  }

  return { valid: false };
}
```

**3. Create the filename sanitization utility.**

`packages/shared/storage/sanitize.ts`:

```typescript
/** Sanitize a user-provided filename for safe storage and display */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^\w.\-() ]/g, '_') // Replace unsafe characters
    .replace(/\.{2,}/g, '.')       // Collapse consecutive dots
    .replace(/\s+/g, ' ')          // Collapse whitespace
    .trim()
    .slice(0, 255);                // Enforce max length
}
```

**4. Create the file size limits constant.**

`packages/shared/storage/limits.ts`:

```typescript
export interface PlanFileLimits {
  maxFileBytes: number;
  totalStorageBytes: number;
  multipartEnabled: boolean;
}

export const FILE_LIMITS: Record<string, PlanFileLimits> = {
  freelancer: {
    maxFileBytes: 25 * 1024 * 1024,       // 25 MB
    totalStorageBytes: 5 * 1024 * 1024 * 1024,   // 5 GB
    multipartEnabled: false,
  },
  starter: {
    maxFileBytes: 50 * 1024 * 1024,       // 50 MB
    totalStorageBytes: 25 * 1024 * 1024 * 1024,  // 25 GB
    multipartEnabled: false,
  },
  professional: {
    maxFileBytes: 100 * 1024 * 1024,      // 100 MB
    totalStorageBytes: 100 * 1024 * 1024 * 1024, // 100 GB
    multipartEnabled: false,
  },
  business: {
    maxFileBytes: 250 * 1024 * 1024,      // 250 MB
    totalStorageBytes: 500 * 1024 * 1024 * 1024, // 500 GB
    multipartEnabled: true,
  },
  enterprise: {
    maxFileBytes: 500 * 1024 * 1024,      // 500 MB
    totalStorageBytes: 1024 * 1024 * 1024 * 1024, // 1 TB
    multipartEnabled: true,
  },
};

export function getFileLimits(planSlug: string): PlanFileLimits {
  return FILE_LIMITS[planSlug] ?? FILE_LIMITS.freelancer;
}
```

**5. Create the presign upload endpoint.**

`apps/web/src/app/api/upload/presign/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const presignRequestSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  sizeBytes: z.number().positive(),
  contextType: z.enum([
    'record_attachment',
    'smart_doc',
    'doc_gen_output',
    'portal_asset',
    'email_attachment',
    'chat_attachment',
    'template',
  ]),
  contextId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  // 1. Authenticate — extract userId and tenantId from Clerk session
  // 2. Parse and validate request body with Zod schema
  // 3. Validate MIME type against allowlist
  // 4. Validate file extension matches MIME type
  // 5. Get tenant plan and check file size limit
  // 6. Check storage quota (SUM(size_bytes) WHERE tenant_id AND deleted_at IS NULL)
  // 7. Sanitize filename
  // 8. Generate UUIDv7 fileId
  // 9. Build storage key using key utilities
  // 10. Create `files` row with scan_status='pending'
  // 11. Generate presigned PUT URL via StorageClient
  // 12. Return { fileId, presignedUrl, headers, expiresAt }
}
```

Fill in the implementation following the exact flow from `files.md` Upload Flow section. Use `getDbForTenant()` for database access. Use Zod for input validation. Return appropriate error responses with typed error codes (VALIDATION_FAILED, RATE_LIMITED, etc.) using the error response shape from Phase 1D.

**6. Create the upload completion endpoint.**

`apps/web/src/app/api/upload/complete/[fileId]/route.ts`:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  // 1. Authenticate — extract userId and tenantId from Clerk session
  // 2. Look up file row — verify it belongs to the tenant and was uploaded by the user
  // 3. HEAD the object in storage — confirm it exists and size matches
  // 4. Read first 8KB of the file via StorageClient.getStream()
  // 5. Verify magic bytes match claimed MIME type
  // 6. If mismatch: delete storage object, delete files row, return 422
  // 7. Update files row (confirm upload)
  // 8. Enqueue BullMQ jobs:
  //    - 'file.scan' on file-processing queue
  //    - 'file.thumbnail' on file-processing queue (if MIME type is in THUMBNAIL_MIME_TYPES)
  // 9. Return file metadata
}
```

Use `getQueue(QUEUE_NAMES.FILE_PROCESSING)` from Prompt 4 to enqueue the jobs.

**7. Create SVG sanitization utility.**

`packages/shared/storage/sanitize.ts` (extend):

```typescript
/** Strip dangerous elements from SVG content */
export function sanitizeSvg(svgContent: string): string {
  // Remove <script> tags
  // Remove <foreignObject> tags
  // Remove event handler attributes (on*)
  // Return cleaned SVG
}
```

Use a lightweight XML parser (e.g., `fast-xml-parser` or string-based regex for these specific patterns). The sanitized SVG replaces the original in storage before marking the upload as complete.

**8. Update barrel exports.**

Add `mime.ts`, `magic-bytes.ts`, `sanitize.ts`, and `limits.ts` to `packages/shared/storage/index.ts`.

**9. Write tests.**

`packages/shared/storage/__tests__/mime.test.ts`:
- Test that `isAllowedMimeType` returns true for all 20 allowed MIME types
- Test that `isAllowedMimeType` returns false for `application/x-executable`
- Test that `isAllowedExtension` validates correct MIME/extension pairs
- Test that `isAllowedExtension` rejects mismatched pairs (e.g., `.exe` with `image/png`)

`packages/shared/storage/__tests__/magic-bytes.test.ts`:
- Test JPEG magic bytes (FF D8 FF)
- Test PNG magic bytes (89 50 4E 47)
- Test PDF magic bytes (25 50 44 46)
- Test mismatch detection (PNG bytes with claimed `image/jpeg`)

`packages/shared/storage/__tests__/sanitize.test.ts`:
- Test filename sanitization removes unsafe characters
- Test filename truncation at 255 characters
- Test SVG sanitization removes `<script>` tags and event handlers

`packages/shared/storage/__tests__/limits.test.ts`:
- Test all 5 plan tiers have correct byte limits
- Test that unknown plans fall back to freelancer limits

`apps/web/src/app/api/upload/__tests__/presign.test.ts`:
- Test successful presign returns fileId, presignedUrl, headers, expiresAt
- Test rejected MIME type returns 422
- Test file exceeding plan limit returns 422
- Test unauthenticated request returns 401
- Mock StorageClient, database

`apps/web/src/app/api/upload/__tests__/complete.test.ts`:
- Test successful completion updates file row and enqueues jobs
- Test magic byte mismatch returns 422 and deletes the file
- Test file not found returns 404
- Test file belonging to different tenant returns 404

### Acceptance Criteria
- [ ] `POST /api/upload/presign` validates input with Zod, checks MIME allowlist, checks plan limits, creates `files` row, returns presigned URL
- [ ] `POST /api/upload/complete/[fileId]` verifies HEAD match, validates magic bytes, enqueues scan and thumbnail jobs
- [ ] Magic byte mismatch on completion → storage object deleted, file row deleted, 422 returned
- [ ] MIME allowlist contains exactly 20 types matching `files.md` spec
- [ ] SVG uploads are sanitized (scripts, foreignObject, event handlers stripped)
- [ ] File size limits match all 5 plan tiers from `files.md`
- [ ] Storage quota check sums `size_bytes` for the tenant (excluding soft-deleted files)
- [ ] Filenames are sanitized before storage (unsafe chars, max 255 chars)
- [ ] All file operations use `getDbForTenant()` for tenant isolation
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- Multipart upload endpoints (post-MVP — Business+ only)
- Upload progress tracking UI or upload manager component (Core UX)
- File attachment field type rendering (Core UX)
- Smart Doc image upload integration (Core UX)
- Direct file streaming through the server (presigned URLs only)

---

## Prompt 7: Image Processing Pipeline, Virus Scanning, File Serving, and Orphan Cleanup

**Depends on:** Prompts 4, 5, 6
**Skills:** phase-context
**Load context:** `files.md` lines 213–240 (Image Processing Pipeline), lines 241–259 (Virus Scanning), lines 260–292 (Serving Strategy), lines 307–331 (Orphan Cleanup, Audit & Access Logging)
**Target files:** `apps/worker/src/processors/file-thumbnail.ts`, `apps/worker/src/processors/file-scan.ts`, `apps/worker/src/processors/file-orphan-cleanup.ts`, `apps/worker/src/index.ts` (update), `packages/shared/storage/serve.ts`, `packages/shared/storage/audit.ts`, `docker-compose.yml` (update — add ClamAV optional profile)
**Migration required:** No
**Git:** Commit with message `feat(files): add image thumbnail pipeline, virus scanning, file serving, and orphan cleanup [Phase 1G, Prompt 7]`

### Schema Snapshot
References the `files` table columns:

| Column | Updated by |
|--------|-----------|
| `scan_status` | file-scan processor (`'pending'` → `'clean'` / `'infected'` / `'skipped'`) |
| `thumbnail_key` | file-thumbnail processor (set to `t/{tenantId}/files/{fileId}/thumb/200.webp`) |
| `metadata` | file-thumbnail processor (adds `{ blurhash, width, height }`) |
| `storage_key` | file-scan processor (moved to quarantine key if infected) |
| `deleted_at` | file-orphan-cleanup reads this |

### Task

**1. Create the file thumbnail processor.**

`apps/worker/src/processors/file-thumbnail.ts`:

Extends `BaseProcessor` from Prompt 4. Processes `file.thumbnail` jobs on the `file-processing` queue.

**Pipeline (per `files.md`):**
1. Look up file row from database (verify scan_status is not `'infected'`).
2. Download original via `StorageClient.getStream()`.
3. Pipe through Sharp:
   - Auto-rotate based on EXIF orientation
   - Resize to 200px (fit: `'inside'`, no upscaling) → WebP quality 80 → upload as `thumb/200.webp`
   - Resize to 800px (fit: `'inside'`, no upscaling) → WebP quality 85 → upload as `thumb/800.webp`
4. Generate blurhash from the 200px thumbnail (use the `blurhash` package, 4×3 components, 10-char output).
5. Upload both thumbnails via `StorageClient.presignPut()` or direct put (use a separate internal upload method that doesn't go through the presign flow).
6. Update `files` row: set `thumbnail_key` to the 200px thumb key, set `metadata.blurhash`, `metadata.width`, `metadata.height`.
7. Publish `file.thumbnail_ready` event via `EventPublisher` (Prompt 3).

**Guard rails:**
- Timeout: 60 seconds per file.
- Skip images >50 megapixels with a warning log.
- HEIC/HEIF: Sharp supports these formats natively.
- GIF: Thumbnail the first frame only.

```typescript
import sharp from 'sharp';
import { encode as blurhashEncode } from 'blurhash';
```

**2. Create the file scan processor.**

`apps/worker/src/processors/file-scan.ts`:

Extends `BaseProcessor`. Processes `file.scan` jobs on the `file-processing` queue.

**In dev mode (`NODE_ENV !== 'production'`):** If ClamAV is not available, set `scan_status = 'skipped'` and log a warning. Do not block uploads in development.

**In production:**
1. Look up file row from database.
2. Download file stream.
3. Pipe to ClamAV daemon via TCP (ClamAV runs as a sidecar container, INSTREAM command).
4. Parse result:
   - `OK` → set `scan_status = 'clean'`
   - `FOUND` → set `scan_status = 'infected'`, move file to quarantine key, log to audit
   - Connection refused → set `scan_status = 'skipped'`, alert admin (log error)

Use `clamscan` npm package or a lightweight TCP client for the ClamAV `INSTREAM` protocol:

```typescript
import NodeClam from 'clamscan';
// or direct TCP approach for lighter footprint
```

**Quarantine flow for infected files:**
1. Copy file to `quarantine/{fileId}/{filename}` key.
2. Delete original storage key.
3. Update `files.storage_key` to the quarantine key.
4. Update `files.scan_status` to `'infected'`.
5. Write audit log entry: `file.quarantined`.
6. Publish `file.scan_complete` event with `{ fileId, status: 'infected' }`.

**3. Create the file serving utility.**

`packages/shared/storage/serve.ts`:

```typescript
import type { StorageClient } from './client';

export interface FileServeOptions {
  tenantId: string;
  fileId: string;
  storageKey: string;
  scanStatus: string;
  contextType: string;
}

/**
 * Generate a download URL for an authenticated file.
 * Public files (portal assets) use CDN URLs — this function handles authenticated files only.
 */
export async function getFileDownloadUrl(
  storage: StorageClient,
  options: FileServeOptions,
): Promise<string> {
  if (options.scanStatus === 'pending') {
    throw new ForbiddenError('File is being scanned');
  }
  if (options.scanStatus === 'infected') {
    throw new ForbiddenError('File has been quarantined');
  }
  // 15-minute expiry for authenticated files (per files.md)
  return storage.presignGet(options.storageKey, 900);
}

/**
 * Generate a thumbnail URL. Thumbnails are CDN-cacheable.
 */
export function getThumbnailUrl(publicUrl: string, thumbnailKey: string): string {
  return `${publicUrl}/${thumbnailKey}`;
}
```

**4. Create the orphan cleanup processor.**

`apps/worker/src/processors/file-orphan-cleanup.ts`:

Extends `BaseProcessor`. Processes `file.orphan_cleanup` jobs on the `cleanup` queue.

**Strategy (per `files.md`):**
1. Query files with `deleted_at` older than 30 days (batch size from job data, default 100).
2. For each file:
   a. Delete original from storage.
   b. Delete thumbnails from storage (200px and 800px).
   c. Hard-delete the `files` row.
3. Log each deletion with file ID and size.

This job should be triggered by a recurring schedule (e.g., daily). The schedule is registered in the worker entry point using BullMQ's `Queue.upsertJobScheduler()`:

```typescript
const cleanupQueue = getQueue(QUEUE_NAMES.CLEANUP);
await cleanupQueue.upsertJobScheduler(
  'file-orphan-cleanup-daily',
  { pattern: '0 3 * * *' }, // 3 AM daily
  {
    name: 'file.orphan_cleanup',
    data: { tenantId: 'system', traceId: generateTraceId(), triggeredBy: 'system', batchSize: 100 },
  },
);
```

**Note:** The orphan cleanup runs as a system-level job across all tenants. The query scans for `deleted_at < NOW() - INTERVAL '30 days'` without a tenant filter (it processes all tenants). Each file deletion respects the tenant's storage key prefix.

**5. Create the file audit logging helpers.**

`packages/shared/storage/audit.ts`:

```typescript
export const FILE_AUDIT_ACTIONS = {
  UPLOADED: 'file.uploaded',
  ACCESSED: 'file.accessed',
  DELETED: 'file.deleted',
  QUARANTINED: 'file.quarantined',
} as const;

export interface FileAuditEntry {
  action: (typeof FILE_AUDIT_ACTIONS)[keyof typeof FILE_AUDIT_ACTIONS];
  fileId: string;
  filename: string;
  sizeBytes?: number;
  contextType?: string;
  scanResult?: string;
}
```

These are passed to `writeAuditLog()` (Phase 1I) when it becomes available. For now, export the constants and interface so the processor can log structured data via Pino. Wire to the audit system in Phase 1I or when both are merged.

**6. Register processors in the worker entry point.**

Update `apps/worker/src/index.ts`:

```typescript
import { FileThumbnailProcessor } from './processors/file-thumbnail';
import { FileScanProcessor } from './processors/file-scan';
import { FileOrphanCleanupProcessor } from './processors/file-orphan-cleanup';

// In main():
const thumbnailProcessor = new FileThumbnailProcessor(logger);
const scanProcessor = new FileScanProcessor(logger);
const orphanProcessor = new FileOrphanCleanupProcessor(logger);

registerShutdownHandler(() => thumbnailProcessor.close());
registerShutdownHandler(() => scanProcessor.close());
registerShutdownHandler(() => orphanProcessor.close());

// Schedule recurring cleanup
await scheduleOrphanCleanup();
```

**7. Add ClamAV to Docker Compose as an optional profile.**

```yaml
clamav:
  image: clamav/clamav:stable
  profiles:
    - scanning
  ports:
    - "3310:3310"
  volumes:
    - clamav-data:/var/lib/clamav
```

In dev mode without `--profile scanning`, ClamAV doesn't run and the scan processor sets `scan_status = 'skipped'`.

**8. Install dependencies.**

In `apps/worker/package.json`, add:
- `sharp`
- `blurhash`
- `clamscan` (or lightweight ClamAV TCP client)

**9. Write tests.**

`apps/worker/src/processors/__tests__/file-thumbnail.test.ts`:
- Test that Sharp processes an image through the thumbnail pipeline (200px and 800px outputs)
- Test that blurhash is generated and stored in metadata
- Test that images >50MP are skipped with warning
- Test that infected files are not processed
- Mock Sharp, StorageClient, database

`apps/worker/src/processors/__tests__/file-scan.test.ts`:
- Test that clean scan sets `scan_status = 'clean'`
- Test that infected scan quarantines the file and sets `scan_status = 'infected'`
- Test that unavailable ClamAV sets `scan_status = 'skipped'` in dev mode
- Mock ClamAV client, StorageClient, database

`apps/worker/src/processors/__tests__/file-orphan-cleanup.test.ts`:
- Test that files with `deleted_at` > 30 days are hard-deleted from storage and database
- Test that files with `deleted_at` < 30 days are not touched
- Test batch size limit is respected
- Mock StorageClient, database

`packages/shared/storage/__tests__/serve.test.ts`:
- Test that `getFileDownloadUrl` throws ForbiddenError for `pending` scan status
- Test that `getFileDownloadUrl` throws ForbiddenError for `infected` scan status
- Test that `getFileDownloadUrl` returns signed URL for `clean` or `skipped` status
- Mock StorageClient

### Acceptance Criteria
- [ ] `file.thumbnail` job processes images through Sharp: auto-rotate, resize to 200px + 800px, convert to WebP, generate blurhash
- [ ] Thumbnails are uploaded to `t/{tenantId}/files/{fileId}/thumb/200.webp` and `thumb/800.webp`
- [ ] `files.thumbnail_key` and `files.metadata` (blurhash, width, height) are updated after thumbnail generation
- [ ] Images >50MP are skipped with a warning log (no crash)
- [ ] `file.scan` job integrates with ClamAV: clean → `'clean'`, infected → quarantine + `'infected'`, unavailable → `'skipped'`
- [ ] Infected files are moved to `quarantine/` storage prefix and `scan_status` updated
- [ ] `getFileDownloadUrl` blocks downloads for `pending` and `infected` files (throws ForbiddenError)
- [ ] `getFileDownloadUrl` returns 15-minute presigned URL for `clean` and `skipped` files
- [ ] `file.orphan_cleanup` hard-deletes files with `deleted_at` > 30 days from storage and database
- [ ] Orphan cleanup runs on a daily schedule (3 AM via BullMQ scheduler)
- [ ] ClamAV runs in Docker Compose only with `--profile scanning`
- [ ] In dev mode without ClamAV, scan_status defaults to `'skipped'`
- [ ] All tests pass with ≥80% coverage on new files
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build
- PDF thumbnail generation via Gotenberg (Core UX — requires Gotenberg dependency)
- Video thumbnail extraction (post-MVP)
- Image transformation API (resize on demand) — thumbnails are pre-generated only
- File deduplication by checksum (not in MVP scope)
- Full virus signature database management or ClamAV auto-update config (operational)
- File download tracking beyond audit log entry (analytics is post-MVP)

---

## Integration Checkpoint 2 (after Prompts 4–7)

**Task:** Verify the complete Phase 1G output — real-time scaffold, BullMQ worker, and file upload pipeline — integrates correctly and all CI gates pass.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — zero violations (no new UI text in this phase)
4. `pnpm turbo test` — all pass
5. `pnpm turbo build` — successful production build
6. `docker compose up` — all services start: web, worker, realtime, postgres, pgbouncer, redis, minio
7. Manual verification — Real-time:
   - Verify realtime service logs show "listening on port 3002" and "subscribed to realtime event channels"
   - Test connection with valid Clerk token → accepted
   - Test connection with invalid token → rejected
   - Test room join → room leave cycle
   - Publish a test event via Redis CLI → verify client receives it
8. Manual verification — Worker:
   - Verify worker logs show "worker ready — listening for jobs"
   - Verify all 6 queues are created in Redis (check via `redis-cli KEYS bull:*`)
9. Manual verification — File upload:
   - Open MinIO console at `http://localhost:9001` — verify `everystack-dev` bucket exists
   - Call `POST /api/upload/presign` with a valid JPEG file metadata → verify presigned URL returned
   - Upload a test file to the presigned URL via `curl`
   - Call `POST /api/upload/complete/{fileId}` → verify file row updated, thumbnail job enqueued
   - Check worker logs — thumbnail job should process (or fail gracefully if Sharp can't find the uploaded file in MinIO yet — fix any connectivity issues)
   - Attempt upload with disallowed MIME type (`application/x-executable`) → verify 422 rejection
10. Verify graceful shutdown: send SIGTERM to worker → verify "graceful shutdown initiated" and clean exit

**Git:** Commit with message `chore(verify): integration checkpoint 2 — worker, storage, and file upload verified [Phase 1G, CP-2]`, then push branch to origin. Open PR to `main` with title "Phase 1G — Runtime Services: Real-Time Scaffold, Background Worker, File Upload".
