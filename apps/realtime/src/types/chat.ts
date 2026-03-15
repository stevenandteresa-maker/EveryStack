/**
 * Shared types for chat, presence, and notification events.
 *
 * These types are used by Socket.IO handlers (Prompt 9), presence service,
 * and notification handlers within the realtime app.
 *
 * @see docs/reference/communications.md § Presence & Status
 * @see docs/reference/realtime.md § Presence System
 */

/**
 * Presence state for a user in a chat context.
 *
 * Known values: 'online' (green dot), 'away' (yellow — 5min idle),
 * 'dnd' (red — mutes notifications), 'offline' (gray).
 */
export type ChatPresenceState = string;

export const CHAT_PRESENCE_STATES = {
  ONLINE: 'online' as ChatPresenceState,
  AWAY: 'away' as ChatPresenceState,
  DND: 'dnd' as ChatPresenceState,
  OFFLINE: 'offline' as ChatPresenceState,
} as const;

/** Custom status displayed alongside a user's presence (e.g., "🏖 On vacation"). */
export interface CustomStatus {
  emoji: string;
  text: string;
}

/** A user's presence entry in a room, stored in Redis with 60s TTL. */
export interface PresenceEntry {
  userId: string;
  state: ChatPresenceState;
  lastActiveAt: number;
  customStatus?: CustomStatus;
}

/** Redis-stored presence value (without userId, which is in the key). */
export interface PresenceValue {
  state: ChatPresenceState;
  lastActiveAt: number;
}

/** Chat message event broadcast to thread room members. */
export interface ChatEvent {
  /** Known values: 'message:new', 'message:edit', 'message:delete' */
  type: string;
  threadId: string;
  payload: unknown;
}

/** Typing indicator event broadcast to thread room members. */
export interface TypingEvent {
  threadId: string;
  userId: string;
  displayName: string;
}
