import { verifyToken } from '@clerk/backend';
import type { Socket } from 'socket.io';
import {
  dbRead,
  eq,
  and,
  users,
  tenants,
  tenantMemberships,
} from '@everystack/shared/db';
import { realtimeLogger } from '@everystack/shared/logging';

const logger = realtimeLogger;

const CLERK_SECRET_KEY = process.env['CLERK_SECRET_KEY'] ?? '';

/**
 * Socket.io authentication middleware.
 *
 * Validates the Clerk JWT from `socket.handshake.auth.token`,
 * resolves the Clerk user to an internal EveryStack user UUID,
 * and determines the active tenant. Populates `socket.data.userId`
 * and `socket.data.tenantId` on success.
 *
 * On failure, calls `next(new Error("AUTH_FAILED"))`.
 */
export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const token = socket.handshake.auth?.['token'] as string | undefined;

  if (!token) {
    logger.warn({ socketId: socket.id }, 'Missing auth token');
    next(new Error('AUTH_FAILED'));
    return;
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    });

    const clerkUserId = payload.sub;
    const clerkOrgId = (payload.org_id as string | undefined) ?? null;

    // Resolve Clerk user ID to internal UUID
    const [user] = await dbRead
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!user) {
      logger.warn({ socketId: socket.id, clerkUserId }, 'User not found');
      next(new Error('AUTH_FAILED'));
      return;
    }

    // Resolve tenant — use Clerk org if available, else first active membership
    let tenantId: string | undefined;

    if (clerkOrgId) {
      const [tenant] = await dbRead
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.clerkOrgId, clerkOrgId))
        .limit(1);

      if (tenant) {
        // Verify active membership
        const [membership] = await dbRead
          .select({ id: tenantMemberships.id })
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.userId, user.id),
              eq(tenantMemberships.tenantId, tenant.id),
              eq(tenantMemberships.status, 'active'),
            ),
          )
          .limit(1);

        if (membership) {
          tenantId = tenant.id;
        }
      }
    }

    if (!tenantId) {
      // Fallback: first active tenant membership
      const [membership] = await dbRead
        .select({ tenantId: tenantMemberships.tenantId })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.userId, user.id),
            eq(tenantMemberships.status, 'active'),
          ),
        )
        .limit(1);

      if (!membership) {
        logger.warn(
          { socketId: socket.id, userId: user.id },
          'No active tenant for user',
        );
        next(new Error('AUTH_FAILED'));
        return;
      }

      tenantId = membership.tenantId;
    }

    socket.data['userId'] = user.id;
    socket.data['tenantId'] = tenantId;

    next();
  } catch (err) {
    logger.warn({ socketId: socket.id, err }, 'Token verification failed');
    next(new Error('AUTH_FAILED'));
  }
}
