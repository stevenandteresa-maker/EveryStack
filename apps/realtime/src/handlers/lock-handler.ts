import type { Socket, Server } from 'socket.io';
import type { Redis } from 'ioredis';
import { realtimeLogger } from '@everystack/shared/logging';
import { REALTIME_EVENTS } from '@everystack/shared/realtime';

const logger = realtimeLogger;

/** TTL for field locks in seconds. */
const LOCK_TTL_SECONDS = 60;

/** Redis key prefix for field locks. */
const LOCK_KEY_PREFIX = 'lock';

/** Metadata stored in each lock's Redis key. */
export interface FieldLockData {
  userId: string;
  userName: string;
  avatarUrl: string;
  timestamp: number;
  socketId: string;
}

/** Payload sent by clients when requesting a lock. */
interface FieldLockRequest {
  tenantId: string;
  recordId: string;
  fieldId: string;
  userName: string;
  avatarUrl: string;
}

/** Payload sent by clients when releasing / renewing a lock. */
interface FieldUnlockRequest {
  tenantId: string;
  recordId: string;
  fieldId: string;
}

/** Callback shape returned to emitting client. */
interface LockCallback {
  (response: { ok: boolean; lockedBy?: FieldLockData }): void;
}

/**
 * Build the Redis key for a field lock.
 */
export function buildLockKey(tenantId: string, recordId: string, fieldId: string): string {
  return `${LOCK_KEY_PREFIX}:${tenantId}:${recordId}:${fieldId}`;
}

/**
 * Build the Redis key that tracks which locks a socket holds.
 * Stored as a Redis Set of lock keys.
 */
function buildSocketLocksKey(socketId: string): string {
  return `socket_locks:${socketId}`;
}

/**
 * Registers field lock event handlers on a socket.
 *
 * Events:
 * - `field:lock`          — acquire a lock (set Redis key + broadcast)
 * - `field:unlock`        — release a lock (delete Redis key + broadcast)
 * - `field:lock_renewed`  — renew lock TTL (extend Redis key)
 *
 * On disconnect: all locks held by this socket are cleaned up.
 */
export function registerLockHandlers(
  socket: Socket,
  io: Server,
  redis: Redis,
): void {
  const userId = socket.data['userId'] as string;
  const tenantId = socket.data['tenantId'] as string;

  // ---- field:lock ----
  socket.on('field:lock', (data: FieldLockRequest, callback?: LockCallback) => {
    void handleFieldLock(socket, io, redis, userId, tenantId, data, callback);
  });

  // ---- field:unlock ----
  socket.on('field:unlock', (data: FieldUnlockRequest) => {
    void handleFieldUnlock(socket, io, redis, userId, tenantId, data);
  });

  // ---- field:lock_renewed ----
  socket.on('field:lock_renewed', (data: FieldUnlockRequest) => {
    void handleFieldLockRenew(socket, io, redis, userId, tenantId, data);
  });

  // ---- disconnect cleanup ----
  socket.on('disconnect', () => {
    void cleanupSocketLocks(socket, io, redis, userId, tenantId);
  });
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleFieldLock(
  socket: Socket,
  io: Server,
  redis: Redis,
  userId: string,
  tenantId: string,
  data: FieldLockRequest,
  callback?: LockCallback,
): Promise<void> {
  const lockKey = buildLockKey(data.tenantId, data.recordId, data.fieldId);

  try {
    // Check if lock already exists
    const existing = await redis.get(lockKey);

    if (existing) {
      const lockData = JSON.parse(existing) as FieldLockData;

      // If same user, re-acquire (idempotent)
      if (lockData.userId === userId) {
        lockData.socketId = socket.id;
        lockData.timestamp = Date.now();
        await redis.set(lockKey, JSON.stringify(lockData), 'EX', LOCK_TTL_SECONDS);
        callback?.({ ok: true });
        return;
      }

      // Locked by another user
      callback?.({ ok: false, lockedBy: lockData });
      return;
    }

    // Acquire lock
    const lockData: FieldLockData = {
      userId,
      userName: data.userName,
      avatarUrl: data.avatarUrl,
      timestamp: Date.now(),
      socketId: socket.id,
    };

    // SET with NX (only if not exists) + EX (TTL)
    const result = await redis.set(lockKey, JSON.stringify(lockData), 'EX', LOCK_TTL_SECONDS, 'NX');

    if (result !== 'OK') {
      // Race condition: another client acquired between our GET and SET
      const nowExisting = await redis.get(lockKey);
      const nowLockData = nowExisting ? (JSON.parse(nowExisting) as FieldLockData) : undefined;
      callback?.({ ok: false, lockedBy: nowLockData });
      return;
    }

    // Track this lock for disconnect cleanup
    const socketLocksKey = buildSocketLocksKey(socket.id);
    await redis.sadd(socketLocksKey, lockKey);
    await redis.expire(socketLocksKey, LOCK_TTL_SECONDS + 10);

    // Broadcast to table room (excluding sender)
    const tableRoom = `t:${data.tenantId}:table:${data.recordId.split(':')[0] ?? data.recordId}`;
    // Broadcast to all rooms this socket is in that match the tenant
    socket.rooms.forEach((room) => {
      if (room.startsWith(`t:${data.tenantId}:table:`)) {
        socket.to(room).emit(REALTIME_EVENTS.FIELD_LOCKED, {
          recordId: data.recordId,
          fieldId: data.fieldId,
          lockedBy: lockData,
        });
      }
    });

    // Also emit to the generic tenant-scoped table room pattern
    if (!Array.from(socket.rooms).some((r) => r.startsWith(`t:${data.tenantId}:table:`))) {
      // Fallback: broadcast to personal rooms in the tenant
      io.to(tableRoom).emit(REALTIME_EVENTS.FIELD_LOCKED, {
        recordId: data.recordId,
        fieldId: data.fieldId,
        lockedBy: lockData,
      });
    }

    logger.info(
      { socketId: socket.id, userId, tenantId, recordId: data.recordId, fieldId: data.fieldId },
      'Field lock acquired',
    );

    callback?.({ ok: true });
  } catch (err) {
    logger.error(
      { socketId: socket.id, userId, tenantId, lockKey, err },
      'Field lock error',
    );
    callback?.({ ok: false });
  }
}

async function handleFieldUnlock(
  socket: Socket,
  io: Server,
  redis: Redis,
  userId: string,
  tenantId: string,
  data: FieldUnlockRequest,
): Promise<void> {
  const lockKey = buildLockKey(data.tenantId, data.recordId, data.fieldId);

  try {
    // Only release if this user holds the lock
    const existing = await redis.get(lockKey);
    if (!existing) return;

    const lockData = JSON.parse(existing) as FieldLockData;
    if (lockData.userId !== userId) return;

    await redis.del(lockKey);

    // Remove from socket tracking set
    const socketLocksKey = buildSocketLocksKey(socket.id);
    await redis.srem(socketLocksKey, lockKey);

    // Broadcast unlock to table rooms
    socket.rooms.forEach((room) => {
      if (room.startsWith(`t:${data.tenantId}:table:`)) {
        socket.to(room).emit(REALTIME_EVENTS.FIELD_UNLOCKED, {
          recordId: data.recordId,
          fieldId: data.fieldId,
          userId,
        });
      }
    });

    logger.info(
      { socketId: socket.id, userId, tenantId, recordId: data.recordId, fieldId: data.fieldId },
      'Field lock released',
    );
  } catch (err) {
    logger.error(
      { socketId: socket.id, userId, tenantId, lockKey, err },
      'Field unlock error',
    );
  }
}

async function handleFieldLockRenew(
  socket: Socket,
  io: Server,
  redis: Redis,
  userId: string,
  tenantId: string,
  data: FieldUnlockRequest,
): Promise<void> {
  const lockKey = buildLockKey(data.tenantId, data.recordId, data.fieldId);

  try {
    const existing = await redis.get(lockKey);
    if (!existing) return;

    const lockData = JSON.parse(existing) as FieldLockData;
    if (lockData.userId !== userId) return;

    // Renew TTL
    lockData.timestamp = Date.now();
    await redis.set(lockKey, JSON.stringify(lockData), 'EX', LOCK_TTL_SECONDS);

    // Also renew the socket locks tracking key
    const socketLocksKey = buildSocketLocksKey(socket.id);
    await redis.expire(socketLocksKey, LOCK_TTL_SECONDS + 10);

    // Broadcast renewal to table rooms
    socket.rooms.forEach((room) => {
      if (room.startsWith(`t:${data.tenantId}:table:`)) {
        socket.to(room).emit(REALTIME_EVENTS.FIELD_LOCK_RENEWED, {
          recordId: data.recordId,
          fieldId: data.fieldId,
          userId,
        });
      }
    });
  } catch (err) {
    logger.error(
      { socketId: socket.id, userId, tenantId, lockKey, err },
      'Field lock renew error',
    );
  }
}

/**
 * Cleans up all field locks held by a disconnecting socket.
 * Reads the socket_locks:{socketId} set and deletes each lock key,
 * then broadcasts unlock events.
 */
async function cleanupSocketLocks(
  socket: Socket,
  io: Server,
  redis: Redis,
  userId: string,
  tenantId: string,
): Promise<void> {
  const socketLocksKey = buildSocketLocksKey(socket.id);

  try {
    const lockKeys = await redis.smembers(socketLocksKey);

    if (lockKeys.length === 0) return;

    logger.info(
      { socketId: socket.id, userId, tenantId, lockCount: lockKeys.length },
      'Cleaning up field locks on disconnect',
    );

    for (const lockKey of lockKeys) {
      // Verify this user still holds the lock
      const existing = await redis.get(lockKey);
      if (!existing) continue;

      const lockData = JSON.parse(existing) as FieldLockData;
      if (lockData.userId !== userId) continue;

      await redis.del(lockKey);

      // Parse lock key: lock:{tenantId}:{recordId}:{fieldId}
      const parts = lockKey.split(':');
      // parts[0] = 'lock', parts[1] = tenantId, parts[2] = recordId, parts[3] = fieldId
      const lockTenantId = parts[1];
      const recordId = parts[2];
      const fieldId = parts[3];

      if (lockTenantId && recordId && fieldId) {
        // Broadcast unlock to all table rooms for this tenant
        const rooms = io.sockets.adapter.rooms;
        for (const [roomName] of rooms) {
          if (roomName.startsWith(`t:${lockTenantId}:table:`)) {
            io.to(roomName).emit(REALTIME_EVENTS.FIELD_UNLOCKED, {
              recordId,
              fieldId,
              userId,
            });
          }
        }
      }
    }

    // Clean up the tracking set
    await redis.del(socketLocksKey);
  } catch (err) {
    logger.error(
      { socketId: socket.id, userId, tenantId, err },
      'Error cleaning up socket locks',
    );
  }
}
