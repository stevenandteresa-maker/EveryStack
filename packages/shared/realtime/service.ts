import type { PresenceState, RoomMember, RoomMetadata } from './types';

/**
 * Transport-agnostic real-time service interface.
 * Feature code talks to this abstraction — never to Socket.io directly.
 *
 * The Socket.io implementation lives in apps/realtime.
 * Post-MVP: could be swapped for Ably, Pusher, or another transport.
 */
export interface RealtimeService {
  /** Add a user to a room with optional metadata. */
  joinRoom(
    roomId: string,
    userId: string,
    metadata?: RoomMetadata,
  ): Promise<void>;

  /** Remove a user from a room. */
  leaveRoom(roomId: string, userId: string): Promise<void>;

  /** List all members currently in a room. */
  getRoomMembers(roomId: string): Promise<RoomMember[]>;

  /** Emit an event to all members of a room. */
  emitToRoom(roomId: string, event: string, payload: unknown): Promise<void>;

  /** Emit an event to a specific user (all their connections). */
  emitToUser(userId: string, event: string, payload: unknown): Promise<void>;

  /** Broadcast an event to all connected clients, optionally excluding one user. */
  broadcast(
    event: string,
    payload: unknown,
    excludeUserId?: string,
  ): Promise<void>;

  /**
   * Update presence state for a user in a room.
   * Stub — full implementation in MVP — Core UX phase.
   */
  setPresence(
    roomId: string,
    userId: string,
    state: PresenceState,
  ): Promise<void>;

  /**
   * Get all presence states for a room.
   * Stub — full implementation in MVP — Core UX phase.
   */
  getPresence(roomId: string): Promise<PresenceState[]>;
}
