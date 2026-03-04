/**
 * Shared real-time types used by both the Socket.io server and client consumers.
 * Feature code imports from @everystack/shared/realtime, never from socket.io directly.
 */

/** Presence state for a user in a room. */
export interface PresenceState {
  userId: string;
  status: 'active' | 'idle' | 'away';
  cursor?: { x: number; y: number; fieldId?: string; recordId?: string };
  lastActiveAt: number;
}

/** A member currently joined in a room. */
export interface RoomMember {
  userId: string;
  joinedAt: number;
  metadata?: RoomMetadata;
}

/** Optional metadata attached when joining a room. */
export interface RoomMetadata {
  displayName?: string;
  avatarUrl?: string;
}

/**
 * Room name patterns for tenant-scoped real-time channels.
 * All room names are prefixed with `t:{tenantId}:` at the service layer.
 * These patterns represent the suffix after the tenant prefix.
 */
export type RoomPattern =
  | `workspace:${string}`
  | `table:${string}`
  | `record:${string}`
  | `thread:${string}`
  | `user:${string}`;
