/**
 * PresenceService — Redis-backed presence state management.
 *
 * Stores presence state per user per room with 60s TTL.
 * Clients send heartbeat every 30s to keep presence alive.
 * On disconnect, presence is removed immediately.
 * On crash/network loss, TTL expires and auto-clears after 60s.
 *
 * Key pattern: presence:t:{tenantId}:{roomId}:{userId}
 *
 * @see docs/reference/realtime.md § Presence System
 * @see docs/reference/communications.md § Presence & Status
 */

import type { Redis } from 'ioredis';
import { realtimeLogger } from '@everystack/shared/logging';
import type {
  ChatPresenceState,
  PresenceEntry,
  PresenceValue,
} from '../types/chat';
import { CHAT_PRESENCE_STATES } from '../types/chat';

const logger = realtimeLogger;

/** TTL for presence keys in seconds. */
const PRESENCE_TTL_SECONDS = 60;

/** Redis key prefix for presence. */
const PRESENCE_KEY_PREFIX = 'presence:t';

/**
 * Build the Redis key for a user's presence in a room.
 */
export function buildPresenceKey(
  tenantId: string,
  roomId: string,
  userId: string,
): string {
  return `${PRESENCE_KEY_PREFIX}:${tenantId}:${roomId}:${userId}`;
}

/**
 * Build the SCAN pattern to find all presence keys for a tenant+room.
 */
function buildRoomScanPattern(tenantId: string, roomId: string): string {
  return `${PRESENCE_KEY_PREFIX}:${tenantId}:${roomId}:*`;
}

/**
 * Build the SCAN pattern to find all presence keys for a user across rooms.
 */
function buildUserScanPattern(tenantId: string, userId: string): string {
  return `${PRESENCE_KEY_PREFIX}:${tenantId}:*:${userId}`;
}

/**
 * Extract the userId from a presence key.
 * Key format: presence:t:{tenantId}:{roomId}:{userId}
 */
function extractUserId(key: string): string {
  const parts = key.split(':');
  return parts[parts.length - 1]!;
}

/**
 * PresenceService manages user presence state in Redis.
 *
 * Each instance requires an ioredis client (not in subscribe mode).
 */
export class PresenceService {
  constructor(private readonly redis: Redis) {}

  /**
   * Set a user's presence state in a room.
   * Stores JSON value with 60s TTL.
   */
  async setPresence(
    tenantId: string,
    roomId: string,
    userId: string,
    state: ChatPresenceState,
  ): Promise<void> {
    const key = buildPresenceKey(tenantId, roomId, userId);
    const value: PresenceValue = {
      state,
      lastActiveAt: Date.now(),
    };

    await this.redis.setex(key, PRESENCE_TTL_SECONDS, JSON.stringify(value));

    logger.debug(
      { tenantId, roomId, userId, state },
      'Presence set',
    );
  }

  /**
   * Get all presence entries for a room.
   * Uses SCAN to find matching keys and parse their values.
   */
  async getPresence(
    tenantId: string,
    roomId: string,
  ): Promise<PresenceEntry[]> {
    const pattern = buildRoomScanPattern(tenantId, roomId);
    const keys = await this.scanKeys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.get(key);
    }
    const results = await pipeline.exec();

    const entries: PresenceEntry[] = [];
    if (results) {
      for (let i = 0; i < keys.length; i++) {
        const [err, rawValue] = results[i]!;
        if (err || !rawValue) continue;

        try {
          const value = JSON.parse(rawValue as string) as PresenceValue;
          entries.push({
            userId: extractUserId(keys[i]!),
            state: value.state,
            lastActiveAt: value.lastActiveAt,
          });
        } catch {
          // Malformed value — skip
          logger.warn({ key: keys[i] }, 'Malformed presence value — skipping');
        }
      }
    }

    return entries;
  }

  /**
   * Refresh TTL on all presence keys for a user across all rooms.
   * Called every 30s by the client heartbeat.
   */
  async heartbeat(tenantId: string, userId: string): Promise<void> {
    const pattern = buildUserScanPattern(tenantId, userId);
    const keys = await this.scanKeys(pattern);

    if (keys.length === 0) {
      return;
    }

    const pipeline = this.redis.pipeline();
    for (const key of keys) {
      pipeline.expire(key, PRESENCE_TTL_SECONDS);
    }
    await pipeline.exec();

    logger.debug(
      { tenantId, userId, keyCount: keys.length },
      'Presence heartbeat refreshed',
    );
  }

  /**
   * Get a user's current presence state.
   * Checks any room key for this user. Returns 'offline' if none found.
   */
  async getUserStatus(
    tenantId: string,
    userId: string,
  ): Promise<ChatPresenceState> {
    const pattern = buildUserScanPattern(tenantId, userId);
    const keys = await this.scanKeys(pattern);

    if (keys.length === 0) {
      return CHAT_PRESENCE_STATES.OFFLINE;
    }

    // Read the first key to get the current state
    const rawValue = await this.redis.get(keys[0]!);
    if (!rawValue) {
      return CHAT_PRESENCE_STATES.OFFLINE;
    }

    try {
      const value = JSON.parse(rawValue) as PresenceValue;
      return value.state;
    } catch {
      return CHAT_PRESENCE_STATES.OFFLINE;
    }
  }

  /**
   * Remove a user's presence from a specific room immediately.
   * Called on explicit disconnect.
   */
  async removePresence(
    tenantId: string,
    roomId: string,
    userId: string,
  ): Promise<void> {
    const key = buildPresenceKey(tenantId, roomId, userId);
    await this.redis.del(key);

    logger.debug(
      { tenantId, roomId, userId },
      'Presence removed',
    );
  }

  /**
   * Scan Redis for keys matching a pattern.
   * Uses SCAN (cursor-based iteration) to avoid blocking.
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }
}
