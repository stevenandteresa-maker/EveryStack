/**
 * Airtable OAuth 2.0 PKCE — Authorization URL construction, token exchange,
 * token refresh, and base listing.
 *
 * All HTTP calls use native `fetch`. Responses are validated with Zod.
 * Auth header for token endpoints uses Basic auth (client_id:client_secret).
 *
 * @see https://airtable.com/developers/web/api/oauth-reference
 */

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { createLogger } from '../../../logging/logger';

const logger = createLogger({ service: 'sync-oauth' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AIRTABLE_AUTH_URL = 'https://airtable.com/oauth2/v1/authorize';
const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token';
const AIRTABLE_BASES_URL = 'https://api.airtable.com/v0/meta/bases';

const SCOPES = 'data.records:read data.records:write schema.bases:read schema.bases:write';

// ---------------------------------------------------------------------------
// Env var helpers
// ---------------------------------------------------------------------------

function getClientId(): string {
  const val = process.env['AIRTABLE_CLIENT_ID'];
  if (!val) throw new Error('AIRTABLE_CLIENT_ID environment variable is not set');
  return val;
}

function getClientSecret(): string {
  const val = process.env['AIRTABLE_CLIENT_SECRET'];
  if (!val) throw new Error('AIRTABLE_CLIENT_SECRET environment variable is not set');
  return val;
}

function getRedirectUri(): string {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'];
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set');
  return `${appUrl}/api/oauth/airtable/callback`;
}

function getBasicAuthHeader(): string {
  const credentials = `${getClientId()}:${getClientSecret()}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random code verifier (43–128 chars, base64url).
 * Uses 32 random bytes → 43 base64url characters.
 */
export function generateCodeVerifier(): string {
  return randomBytes(32)
    .toString('base64url');
}

/**
 * Generate the S256 code challenge from a code verifier.
 * SHA-256 hash → base64url encoding.
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

// ---------------------------------------------------------------------------
// Auth URL
// ---------------------------------------------------------------------------

/**
 * Construct the Airtable OAuth authorization URL with PKCE parameters.
 */
export function getAirtableAuthUrl(
  state: string,
  codeChallenge: string,
): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${AIRTABLE_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token types & schemas
// ---------------------------------------------------------------------------

export interface AirtableTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  /** Absolute expiry timestamp (ms since epoch) — computed on receipt. */
  expires_at: number;
  scope: string;
  refresh_expires_in?: number;
}

const AirtableTokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  scope: z.string(),
  refresh_expires_in: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<AirtableTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    code_verifier: codeVerifier,
  });

  const response = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, body: errorText },
      'Airtable token exchange failed',
    );
    throw new Error(`Airtable token exchange failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = AirtableTokenResponseSchema.parse(json);

  return {
    ...parsed,
    expires_at: Date.now() + parsed.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAirtableToken(
  refreshToken: string,
): Promise<AirtableTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(AIRTABLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(),
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, body: errorText },
      'Airtable token refresh failed',
    );
    throw new Error(`Airtable token refresh failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = AirtableTokenResponseSchema.parse(json);

  return {
    ...parsed,
    expires_at: Date.now() + parsed.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// List bases
// ---------------------------------------------------------------------------

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

const AirtableBasesResponseSchema = z.object({
  bases: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      permissionLevel: z.string(),
    }),
  ),
});

/**
 * List all bases accessible to the authenticated user.
 */
export async function listAirtableBases(
  accessToken: string,
): Promise<AirtableBase[]> {
  const response = await fetch(AIRTABLE_BASES_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, body: errorText },
      'Airtable list bases failed',
    );
    throw new Error(`Airtable list bases failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = AirtableBasesResponseSchema.parse(json);

  return parsed.bases;
}
