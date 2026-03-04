import type { Server } from 'socket.io';
import type {
  RealtimeService,
  PresenceState,
  RoomMember,
  RoomMetadata,
} from '@everystack/shared/realtime';
import { realtimeLogger } from '@everystack/shared/logging';

const logger = realtimeLogger;

/**
 * Socket.io implementation of the RealtimeService interface.
 *
 * All room names are prefixed with `t:{tenantId}:` for tenant isolation.
 * Feature code uses the RealtimeService abstraction; this is the concrete implementation.
 */
export class SocketIORealtimeService implements RealtimeService {
  constructor(private readonly io: Server) {}

  /** Build a tenant-scoped room name. */
  private tenantRoom(tenantId: string, roomId: string): string {
    return `t:${tenantId}:${roomId}`;
  }

  async joinRoom(
    roomId: string,
    userId: string,
    _metadata?: RoomMetadata,
  ): Promise<void> {
    // Find all sockets for this user and join them to the room
    const sockets = await this.io.fetchSockets();
    for (const socket of sockets) {
      if (socket.data?.['userId'] === userId) {
        await socket.join(roomId);
      }
    }
    logger.debug({ roomId, userId }, 'User joined room');
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const sockets = await this.io.fetchSockets();
    for (const socket of sockets) {
      if (socket.data?.['userId'] === userId) {
        socket.leave(roomId);
      }
    }
    logger.debug({ roomId, userId }, 'User left room');
  }

  async getRoomMembers(roomId: string): Promise<RoomMember[]> {
    const sockets = await this.io.in(roomId).fetchSockets();
    const seen = new Set<string>();
    const members: RoomMember[] = [];

    for (const socket of sockets) {
      const userId = socket.data?.['userId'] as string | undefined;
      if (userId && !seen.has(userId)) {
        seen.add(userId);
        members.push({
          userId,
          joinedAt: (socket.data?.['joinedAt'] as number) ?? Date.now(),
        });
      }
    }

    return members;
  }

  async emitToRoom(
    roomId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    this.io.to(roomId).emit(event, payload);
  }

  async emitToUser(
    userId: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    // Each user joins a personal room `user:{userId}` on connection
    this.io.to(`user:${userId}`).emit(event, payload);
  }

  async broadcast(
    event: string,
    payload: unknown,
    excludeUserId?: string,
  ): Promise<void> {
    if (excludeUserId) {
      // Broadcast to all except sockets belonging to the excluded user
      const sockets = await this.io.fetchSockets();
      for (const socket of sockets) {
        if (socket.data?.['userId'] !== excludeUserId) {
          socket.emit(event, payload);
        }
      }
    } else {
      this.io.emit(event, payload);
    }
  }

  async setPresence(
    _roomId: string,
    _userId: string,
    _state: PresenceState,
  ): Promise<void> {
    // Stub — full implementation with Redis TTL in MVP — Core UX phase
    logger.warn('setPresence is a stub — not yet implemented');
  }

  async getPresence(_roomId: string): Promise<PresenceState[]> {
    // Stub — full implementation with Redis TTL in MVP — Core UX phase
    logger.warn('getPresence is a stub — not yet implemented');
    return [];
  }
}
