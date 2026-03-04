import type { Socket } from 'socket.io';
import { realtimeLogger } from '@everystack/shared/logging';
import { authorizeRoomJoin } from './authorize-room-join';

const logger = realtimeLogger;

interface RoomCallback {
  (response: { ok: boolean }): void;
}

/**
 * Registers room:join and room:leave event handlers on a socket.
 * Called from the connection callback in server.ts.
 *
 * - room:join: Parses roomId, authorizes via authorizeRoomJoin().
 *   On success: socket.join(t:{tenantId}:{roomId}), callback { ok: true }.
 *   On failure: silent — callback { ok: false }, no error sent.
 * - room:leave: socket.leave(t:{tenantId}:{roomId}).
 */
export function registerRoomHandlers(socket: Socket): void {
  const userId = socket.data['userId'] as string;
  const tenantId = socket.data['tenantId'] as string;

  socket.on('room:join', (roomId: string, callback?: RoomCallback) => {
    void handleRoomJoin(socket, roomId, userId, tenantId, callback);
  });

  socket.on('room:leave', (roomId: string) => {
    handleRoomLeave(socket, roomId, userId, tenantId);
  });
}

async function handleRoomJoin(
  socket: Socket,
  roomId: string,
  userId: string,
  tenantId: string,
  callback?: RoomCallback,
): Promise<void> {
  try {
    const authorized = await authorizeRoomJoin({ roomId, userId, tenantId });

    if (!authorized) {
      logger.info(
        { socketId: socket.id, userId, tenantId, roomId },
        'Room join denied',
      );
      callback?.({ ok: false });
      return;
    }

    const fullRoomName = `t:${tenantId}:${roomId}`;
    await socket.join(fullRoomName);

    logger.info(
      { socketId: socket.id, userId, tenantId, roomId, fullRoomName },
      'Room joined',
    );

    callback?.({ ok: true });
  } catch (err) {
    logger.error(
      { socketId: socket.id, userId, tenantId, roomId, err },
      'Room join error',
    );
    callback?.({ ok: false });
  }
}

function handleRoomLeave(
  socket: Socket,
  roomId: string,
  userId: string,
  tenantId: string,
): void {
  const fullRoomName = `t:${tenantId}:${roomId}`;
  void socket.leave(fullRoomName);

  logger.info(
    { socketId: socket.id, userId, tenantId, roomId, fullRoomName },
    'Room left',
  );
}
