'use server';

/**
 * Server Actions — API Key Management
 *
 * Validates input with Zod, enforces Owner/Admin role, and delegates
 * to data functions. These are called from the Settings UI (Phase 3G-i).
 *
 * @see docs/reference/platform-api.md § Key Management
 */

import { z } from 'zod';
import { apiKeyCreateSchema } from '@everystack/shared/db';
import { requireRole } from '@everystack/shared/auth';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import { createApiKey, revokeApiKey } from '@/data/api-keys';
import type { CreateApiKeyResult } from '@/data/api-keys';

// ---------------------------------------------------------------------------
// createApiKeyAction
// ---------------------------------------------------------------------------

export async function createApiKeyAction(
  input: z.input<typeof apiKeyCreateSchema>,
): Promise<CreateApiKeyResult> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'api_key', 'create');

  const validated = apiKeyCreateSchema.parse(input);

  try {
    return await createApiKey(tenantId, userId, validated);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// revokeApiKeyAction
// ---------------------------------------------------------------------------

const revokeInputSchema = z.object({
  keyId: z.string().uuid(),
});

export async function revokeApiKeyAction(keyId: string): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'api_key', 'revoke');

  const { keyId: validatedKeyId } = revokeInputSchema.parse({ keyId });

  try {
    await revokeApiKey(tenantId, userId, validatedKeyId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
