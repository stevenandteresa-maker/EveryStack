'use server';

/**
 * Server Actions — Sync Connection Management (Airtable OAuth PKCE + Notion OAuth)
 *
 * Airtable:
 * - initiateAirtableConnection: generates PKCE state, stores in Redis, returns auth URL
 * - completeAirtableConnection: exchanges code for tokens, encrypts, creates connection
 *
 * Notion:
 * - initiateNotionConnection: generates state, stores in Redis, returns auth URL
 * - completeNotionConnection: exchanges code for tokens, encrypts, creates connection
 * - listDatabasesForConnection: lists Notion databases accessible to the integration
 *
 * Shared:
 * - listBasesForConnection: lists Airtable bases (auto-refreshes tokens if near expiry)
 * - selectBaseForConnection: associates a base/database with a connection
 *
 * @see docs/reference/sync-engine.md § Connection Management
 */

import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { requireRole } from '@everystack/shared/auth';
import { createRedisClient } from '@everystack/shared/redis';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAirtableAuthUrl,
  exchangeCodeForTokens,
  refreshAirtableToken,
  listAirtableBases,
  getNotionAuthUrl,
  exchangeNotionCodeForTokens,
  listNotionDatabases,
} from '@everystack/shared/sync';
import type { AirtableTokens, AirtableBase, NotionTokens, NotionDatabase } from '@everystack/shared/sync';
import { encryptTokens, decryptTokens } from '@everystack/shared/crypto';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import {
  createConnection,
  getConnectionWithTokens,
  updateConnectionTokens,
  updateConnectionBase,
} from '@/data/sync-connections';

// ---------------------------------------------------------------------------
// Redis client (lazy singleton)
// ---------------------------------------------------------------------------

let redis: ReturnType<typeof createRedisClient> | null = null;

function getRedis() {
  if (!redis) {
    redis = createRedisClient('sync-oauth');
  }
  return redis;
}

// ---------------------------------------------------------------------------
// PKCE Redis key pattern
// ---------------------------------------------------------------------------

const PKCE_KEY_PREFIX = 'oauth:airtable:pkce:';
const PKCE_TTL_SECONDS = 600; // 10 minutes

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const completeConnectionSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const selectBaseSchema = z.object({
  connectionId: z.string().uuid(),
  baseId: z.string().min(1),
  baseName: z.string().min(1),
});

const listBasesSchema = z.object({
  connectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Token refresh threshold — refresh if expiring within 5 minutes
// ---------------------------------------------------------------------------

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// initiateAirtableConnection
// ---------------------------------------------------------------------------

/**
 * Begin the Airtable OAuth PKCE flow.
 *
 * Generates a random state and PKCE verifier, stores them in Redis (10min TTL),
 * and returns the Airtable authorization URL for the client to redirect to.
 */
export async function initiateAirtableConnection(): Promise<{ authUrl: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'create');

  try {
    const state = randomBytes(32).toString('hex');
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    const redisClient = getRedis();
    await redisClient.set(
      `${PKCE_KEY_PREFIX}${state}`,
      JSON.stringify({ codeVerifier, tenantId, userId }),
      'EX',
      PKCE_TTL_SECONDS,
    );

    const authUrl = getAirtableAuthUrl(state, codeChallenge);
    return { authUrl };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// completeAirtableConnection
// ---------------------------------------------------------------------------

/**
 * Complete the Airtable OAuth flow after the user is redirected back.
 *
 * Retrieves PKCE state from Redis (one-time use), verifies auth context matches,
 * exchanges the authorization code for tokens, encrypts them, and creates
 * the connection in the database.
 */
export async function completeAirtableConnection(
  input: z.input<typeof completeConnectionSchema>,
): Promise<{ connectionId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'create');

  const { code, state } = completeConnectionSchema.parse(input);

  try {
    const redisClient = getRedis();
    const redisKey = `${PKCE_KEY_PREFIX}${state}`;

    // Retrieve and delete PKCE state (one-time use)
    const stored = await redisClient.get(redisKey);
    if (!stored) {
      throw new Error('OAuth state expired or invalid');
    }
    await redisClient.del(redisKey);

    const pkceState = JSON.parse(stored) as {
      codeVerifier: string;
      tenantId: string;
      userId: string;
    };

    // Verify the auth context matches what was stored
    if (pkceState.tenantId !== tenantId || pkceState.userId !== userId) {
      throw new Error('OAuth state mismatch — auth context does not match');
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, pkceState.codeVerifier);

    // Encrypt tokens and create connection
    const tokenRecord: Record<string, unknown> = { ...tokens };
    const encrypted = encryptTokens(tokenRecord);
    const connectionId = await createConnection(
      tenantId,
      userId,
      'airtable',
      encrypted,
    );

    return { connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// listBasesForConnection
// ---------------------------------------------------------------------------

/**
 * List Airtable bases accessible via a connection's OAuth tokens.
 *
 * Auto-refreshes the access token if it's within 5 minutes of expiry.
 * The refreshed tokens are re-encrypted and persisted.
 */
export async function listBasesForConnection(
  input: z.input<typeof listBasesSchema>,
): Promise<AirtableBase[]> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId } = listBasesSchema.parse(input);

  try {
    const connection = await getConnectionWithTokens(tenantId, connectionId);

    if (!connection.oauthTokens) {
      throw new Error('Connection has no OAuth tokens');
    }

    let tokens = decryptTokens<Record<string, unknown>>(connection.oauthTokens) as unknown as AirtableTokens;

    // Auto-refresh if expiring within threshold
    if (tokens.expires_at - Date.now() < REFRESH_THRESHOLD_MS) {
      tokens = await refreshAirtableToken(tokens.refresh_token);

      // Re-encrypt and persist refreshed tokens
      const tokenRecord: Record<string, unknown> = { ...tokens };
      const encrypted = encryptTokens(tokenRecord);
      await updateConnectionTokens(tenantId, connectionId, encrypted);
    }

    return await listAirtableBases(tokens.access_token);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// selectBaseForConnection
// ---------------------------------------------------------------------------

/**
 * Associate a selected Airtable base or Notion database with a connection.
 *
 * Called after the user picks a base/database from the listing results.
 */
export async function selectBaseForConnection(
  input: z.input<typeof selectBaseSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { connectionId, baseId, baseName } = selectBaseSchema.parse(input);

  try {
    await updateConnectionBase(tenantId, userId, connectionId, baseId, baseName);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// Notion PKCE Redis key pattern
// ---------------------------------------------------------------------------

const NOTION_PKCE_KEY_PREFIX = 'oauth:notion:state:';

// ---------------------------------------------------------------------------
// Notion Zod schemas
// ---------------------------------------------------------------------------

const completeNotionSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

const listDatabasesSchema = z.object({
  connectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// initiateNotionConnection
// ---------------------------------------------------------------------------

/**
 * Begin the Notion OAuth flow.
 *
 * Generates a random state, stores it in Redis (10min TTL),
 * and returns the Notion authorization URL.
 */
export async function initiateNotionConnection(): Promise<{ authUrl: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'create');

  try {
    const state = randomBytes(32).toString('hex');

    const redisClient = getRedis();
    await redisClient.set(
      `${NOTION_PKCE_KEY_PREFIX}${state}`,
      JSON.stringify({ tenantId, userId }),
      'EX',
      PKCE_TTL_SECONDS,
    );

    const authUrl = getNotionAuthUrl(state);
    return { authUrl };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// completeNotionConnection
// ---------------------------------------------------------------------------

/**
 * Complete the Notion OAuth flow after the user is redirected back.
 *
 * Retrieves state from Redis (one-time use), verifies auth context,
 * exchanges the code for tokens, encrypts them, and creates the connection.
 */
export async function completeNotionConnection(
  input: z.input<typeof completeNotionSchema>,
): Promise<{ connectionId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'create');

  const { code, state } = completeNotionSchema.parse(input);

  try {
    const redisClient = getRedis();
    const redisKey = `${NOTION_PKCE_KEY_PREFIX}${state}`;

    const stored = await redisClient.get(redisKey);
    if (!stored) {
      throw new Error('OAuth state expired or invalid');
    }
    await redisClient.del(redisKey);

    const oauthState = JSON.parse(stored) as {
      tenantId: string;
      userId: string;
    };

    if (oauthState.tenantId !== tenantId || oauthState.userId !== userId) {
      throw new Error('OAuth state mismatch — auth context does not match');
    }

    const tokens = await exchangeNotionCodeForTokens(code);

    const tokenRecord: Record<string, unknown> = { ...tokens };
    const encrypted = encryptTokens(tokenRecord);
    const connectionId = await createConnection(
      tenantId,
      userId,
      'notion',
      encrypted,
    );

    return { connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// listDatabasesForConnection
// ---------------------------------------------------------------------------

/**
 * List Notion databases accessible via a connection's OAuth tokens.
 *
 * Notion access tokens do not expire, so no refresh flow is needed.
 */
export async function listDatabasesForConnection(
  input: z.input<typeof listDatabasesSchema>,
): Promise<NotionDatabase[]> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'read');

  const { connectionId } = listDatabasesSchema.parse(input);

  try {
    const connection = await getConnectionWithTokens(tenantId, connectionId);

    if (!connection.oauthTokens) {
      throw new Error('Connection has no OAuth tokens');
    }

    const tokens = decryptTokens<Record<string, unknown>>(connection.oauthTokens) as unknown as NotionTokens;

    return await listNotionDatabases(tokens.access_token);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
