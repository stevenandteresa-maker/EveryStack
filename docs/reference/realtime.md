# Real-Time Architecture

> **Reconciliation note (2026-02-27):** Aligned with `GLOSSARY.md` (source of truth). Changes: (1) Renamed "Comms Hub" → "Chat / Record Thread" per naming discipline ("Communications Hub" is not a glossary term). (2) Tagged approval workflow real-time events as post-MVP. (3) Tagged multi-page portal room pattern (`portal:{portalId}:page:{pageSlug}`) as post-MVP (MVP portals are single-record Record View shares). (4) Tagged "portal real-time blocks" as post-MVP (App Designer). (5) Clarified Chat Message Delivery scope — DMs/Chat are Quick Panel features but full Record Thread comms are phased.

> Transport abstraction, room model, connection lifecycle, event flow, horizontal scaling, presence, chat delivery, Hocuspocus strategy, and deployment.
> Cross-references: `embeddable-extensions.md` **(post-MVP)** (Live Chat Widget visitor-side WebSocket: `wss://chat.everystack.app/ws/{widget_id}/{visitor_token}`, lightweight protocol — message events only, HTTP long-polling fallback; agent side uses existing Chat / Record Thread real-time infrastructure), `approval-workflows.md` **(post-MVP: Approval Workflows)** (5 approval real-time events: `approval.requested`, `approval.step_activated`, `approval.decided` on `tenant:{tenantId}` channel; `approval.requirement_updated` on `record:{recordId}` channel for live-resolving checklist; `approval.overridden` on `tenant:{tenantId}` channel), `workspace-map.md` **(post-MVP: Workspace Map)** (live topology updates — map subscribes to `tenant:{tenantId}` channel for `workspace_map.invalidated` and entity-specific events: sync status changes, automation run completions, portal publish events; incremental updates with debouncing and full refresh fallback), `bulk-operations.md` (batch real-time event shape — `record.updated.batch`, `record.deleted.batch`, `record.created.batch` events with `recordIds[]`, `truncated` flag at 1,000, `totalCount`; client invalidation strategy: ≤100 IDs invalidate specific rows, >100 or truncated triggers full Table View refresh; prevents event storms from bulk mutations)
> Last updated: 2026-02-27 — Glossary reconciliation (naming, MVP scope tags). Prior: 2026-02-21 — Added `bulk-operations.md` cross-reference.

---

## Core Principle

Feature code talks to a `RealtimeService` abstraction, never to Socket.io directly. The transport is swappable.

---

## Transport Abstraction

```typescript
// packages/shared/realtime/service.ts
interface RealtimeService {
  joinRoom(roomId: string, userId: string, metadata?: RoomMetadata): Promise<void>;
  leaveRoom(roomId: string, userId: string): Promise<void>;
  getRoomMembers(roomId: string): Promise<RoomMember[]>;
  emitToRoom(roomId: string, event: string, payload: unknown): Promise<void>;
  emitToUser(userId: string, event: string, payload: unknown): Promise<void>;
  broadcast(event: string, payload: unknown, excludeUserId?: string): Promise<void>;
  setPresence(roomId: string, userId: string, state: PresenceState): Promise<void>;
  getPresence(roomId: string): Promise<PresenceState[]>;
}

interface PresenceState {
  userId: string;
  status: 'active' | 'idle' | 'away';
  cursor?: { x: number; y: number; fieldId?: string; recordId?: string };
  lastActiveAt: number;
}
```

**Implementation:** `SocketIORealtimeService` uses Socket.io rooms, namespaces, and Redis adapter. A future `ManagedRealtimeService` could implement the same interface using Ably or Pusher.

---

## Room Model

| Room Pattern                        | Purpose                                                                  | Join Trigger           | Leave Trigger           |
| ----------------------------------- | ------------------------------------------------------------------------ | ---------------------- | ----------------------- |
| `table:{tableId}`                   | Grid live updates, cell edit broadcasting                                | User opens table view  | User navigates away     |
| `record:{recordId}`                 | Record View presence, field edit conflicts                               | User opens Record View | User closes Record View |
| `thread:{threadId}`                 | Chat / Record Thread message delivery, typing indicators                 | User opens thread      | User navigates away     |
| `workspace:{workspaceId}`           | Workspace-wide notifications, sync status                                | User enters workspace  | User switches workspace |
| `user:{userId}`                     | Personal notifications, cross-workspace alerts                           | User connects          | User disconnects        |
| `portal:{portalId}:page:{pageSlug}` | Portal real-time updates **(post-MVP: App Designer portals with pages)** | Visitor loads page     | Visitor navigates away  |

**Tenant isolation:** Room names prefixed internally with `t:{tenantId}:`. Connection validated against Clerk session before room join.

---

## Connection Lifecycle

```
Client connects → Socket.io handshake with Clerk session token
  → Real-Time Service validates token with Clerk
  → Connection accepted, userId + tenantId bound to socket
  → Client joins rooms based on current view
  → On navigation: leave old rooms, join new rooms
  → On disconnect: cleanup rooms, update presence
  → Auto-reconnect: see Reconnection Strategy below
```

### Authentication & Authorization

Socket.IO connection handshake includes the Clerk session token in the `auth` parameter. The real-time service validates the token on connect and extracts `userId` + `tenantId`. If validation fails: connection rejected with `AUTH_FAILED` error code. The client should not retry auth failures — redirect to login.

**Room subscription authorization:** When a client requests to join a room (e.g., `table:{tableId}`), the server verifies the user has read access to that resource via the permission resolution algorithm (see `permissions.md`). If denied: `join` silently fails, client receives no events for that room. No error sent to client (prevents resource enumeration).

### Reconnection Strategy

| Parameter          | Value                                                   |
| ------------------ | ------------------------------------------------------- |
| Initial delay      | 1,000ms                                                 |
| Backoff multiplier | 2x                                                      |
| Max delay          | 30,000ms (30s)                                          |
| Jitter             | ±20% (prevents thundering herd on server restart)       |
| Max retry attempts | Unlimited (connection is restored when network returns) |
| Auth re-validation | On every reconnect (Clerk token may have expired)       |

**Reconnection sequence:**

1. Socket disconnects (network drop, server restart, idle timeout).
2. Client enters reconnecting state. UI indicator: subtle amber dot on connection icon (replaces green "connected" dot). No blocking modal.
3. Client attempts reconnect with exponential backoff + jitter.
4. On successful reconnect:
   a. Re-authenticate (Clerk token validated).
   b. Rejoin all rooms the client was subscribed to (client maintains room list locally).
   c. **Catch-up query:** Client sends `{ lastEventTimestamp }` for each active room. Server responds with all events since that timestamp (pulled from Redis Streams, 5-minute retention window). If gap exceeds 5 minutes: server responds with `FULL_REFRESH` signal → client re-fetches current state from API.
   d. UI indicator returns to green dot.
5. If Clerk token expired during disconnection: reconnect fails with `AUTH_EXPIRED`. Client triggers Clerk token refresh, then retries.
6. **Network change (Wi-Fi → cellular):** Socket.IO detects transport change automatically. Reconnection sequence fires. No special handling needed.

**During disconnection:** The client operates on stale data. Optimistic updates from the user's own actions are queued locally and replayed after reconnection. Other users' changes appear after catch-up. No "offline mode" in MVP — the client shows last-known state with the amber indicator.

### Stale Data Indicator

If reconnection takes longer than 10 seconds, show a non-blocking banner at the top of the workspace: "Reconnecting — data may be out of date." Banner auto-dismisses on successful reconnect. If user takes an action (edit a cell) while disconnected: optimistic UI applies the change locally. On reconnect, the queued mutation is sent to the server. If the server rejects it (conflict, permission change), the optimistic update is rolled back and a toast notifies the user.

---

## Event Flow

```
1. User A edits a cell
   → Server Action writes to Postgres
   → Server Action publishes to Redis: { channel: 'table:{tableId}', event: 'record.updated', payload }

2. Worker completes inbound sync
   → Worker publishes to Redis: { channel: 'table:{tableId}', event: 'sync.batch_complete', payload }

3. Real-Time Service subscribes to Redis pub/sub
   → Receives event → forwards to Socket.io clients in matching room
   → Clients update local state (Zustand / TanStack Query invalidation)
```

**Redis as event bus:** Web app and worker publish events to Redis. Real-time service subscribes and forwards. Neither producer needs to know about Socket.io.

**Approval events (post-MVP: Approval Workflows):** The approval engine publishes 5 events through the same Redis event bus. `approval.requested`, `approval.step_activated`, `approval.decided`, and `approval.overridden` are published to the `tenant:{tenantId}` channel (maps to `workspace:{workspaceId}` room) for queue refresh and notification delivery. `approval.requirement_updated` is published to the `record:{recordId}` channel, powering the live-resolving checklist UX — when a required field is filled while the approver has the approval panel open, the auto-verify item flips to green without page refresh. See `approval-workflows.md` > Real-Time Events.

---

## Horizontal Scaling

Socket.io scales horizontally via `@socket.io/redis-adapter`. Events published on one instance are broadcast to clients on any instance.

**Sticky sessions required:** Socket.io HTTP polling fallback needs routing to the same instance. Load balancer uses cookie-based or IP-based sticky sessions.

### Connection Capacity

| Scale Point     | Concurrent Connections | Instances (est.) |
| --------------- | ---------------------- | ---------------- |
| 100 tenants     | ~200–500               | 1                |
| 1,000 tenants   | ~2,000–5,000           | 2                |
| 10,000 tenants  | ~10,000–30,000         | 4–8              |
| 50,000+ tenants | ~50,000–150,000        | 16+              |

**Memory:** ~10–20KB per connection. 10,000 connections ≈ 200MB. CPU for message fan-out is the bottleneck, not memory.

---

## Presence System

```typescript
// Presence stored in Redis with TTL
// Key: presence:t:{tenantId}:{roomId}:{userId}
// TTL: 60 seconds (refreshed by heartbeat every 30s)

// On connect/room join: SET presence state
// Every 30 seconds: client heartbeat refreshes TTL
// On disconnect: DELETE immediately
// On crash/network loss: TTL expires after 60s, auto-clears
```

**Cursor broadcasting (post-MVP):** For native table real-time collaboration, cursor positions broadcast at max 10 updates/second per user. Only users in same `table:{tableId}` room receive updates. Data: `{ userId, fieldId, recordId, x, y }`.

---

## Chat / DM Message Delivery (Post-MVP: Advanced Communications)

> **MVP note:** The Chat Quick Panel (DMs) is an MVP feature, but full message delivery infrastructure (including Record Thread real-time delivery, typing indicators, and thread presence) is phased post-MVP. The architecture below describes the full system.

```
User A sends message in thread
  → Server Action: validate, write to DB, return message with ID
  → Server Action publishes to Redis: { channel: 'thread:{threadId}', event: 'message.created' }
  → Real-Time Service forwards to all clients in room
  → Target: < 200ms delivery

Typing indicators:
  → Client emits 'typing.start' to Real-Time Service (no DB write)
  → Broadcast to room (excluding sender)
  → 'typing.stop' after 3 seconds of no keystrokes
```

**Delivery guarantee:** Messages persisted to Postgres _before_ real-time event. If delivery fails, message appears on next page load or reconnect catch-up.

---

## Smart Doc Collaborative Editing (Post-MVP)

**Approach:** Hocuspocus — TipTap's open-source collaboration backend using CRDT (Yjs).

| Option            | Description                                  | Tradeoff                                    |
| ----------------- | -------------------------------------------- | ------------------------------------------- |
| **A: Integrated** | Hocuspocus runs within the real-time service | Simpler deployment; couples to main service |
| **B: Separate**   | Fourth service with own WebSocket endpoint   | Independent scaling; isolated traffic       |

**Recommended:** Option A initially, Option B if collaboration creates contention with chat/presence.

**What to decide now:** Real-time architecture accommodates collaborative editing. Hocuspocus uses same Redis and auth. TipTap in Post-MVP — Documents built without real-time — enabling Yjs later is a config change, not a rewrite.

---

## Deployment

| Environment    | Configuration                                                                         |
| -------------- | ------------------------------------------------------------------------------------- |
| Development    | Third Docker Compose service. Same Redis instance.                                    |
| Railway/Render | Third deployed service. WebSocket support verified. Sticky sessions.                  |
| AWS            | ECS/Fargate + ALB (sticky sessions) or NLB. Same VPC. Auto-scale on connection count. |

---

## Phase Implementation

| Phase                     | Real-Time Work                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation          | `RealtimeService` interface. Socket.io scaffold with Clerk auth, Redis adapter, room join/leave, basic presence. |
| MVP — Sync                | Sync status push: worker → Redis → real-time → client. Replaces TanStack Query polling.                          |
| MVP — Core UX             | Grid live updates, table/record presence indicators.                                                             |
| Post-MVP — Comms & Polish | Chat / DM delivery, typing indicators, Record Thread presence, notification delivery.                            |
| Post-MVP                  | Cursor broadcasting, Hocuspocus for Smart Doc co-editing, App Designer portal real-time updates.                 |
