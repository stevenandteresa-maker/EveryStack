'use server';

/**
 * Server Actions — Custom status operations.
 *
 * @see docs/reference/communications.md § Presence & Status
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import {
  updateCustomStatus as updateStatus,
  getCustomStatus as getStatus,
} from '@/data/presence';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateCustomStatusSchema = z.object({
  emoji: z.string().min(1).max(10),
  text: z.string().max(80),
  clearAt: z.string().datetime().optional(),
});

// ---------------------------------------------------------------------------
// updateCustomStatusAction
// ---------------------------------------------------------------------------

export async function updateCustomStatusAction(
  input: z.input<typeof updateCustomStatusSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = updateCustomStatusSchema.parse(input);

  try {
    await updateStatus(
      tenantId,
      userId,
      validated.emoji,
      validated.text,
      validated.clearAt ? new Date(validated.clearAt) : undefined,
    );
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// clearCustomStatusAction
// ---------------------------------------------------------------------------

export async function clearCustomStatusAction() {
  const { userId, tenantId } = await getAuthContext();

  try {
    await updateStatus(tenantId, userId, '', '', undefined);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// getCustomStatusAction
// ---------------------------------------------------------------------------

export async function getCustomStatusAction() {
  const { userId, tenantId } = await getAuthContext();

  try {
    return await getStatus(tenantId, userId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
