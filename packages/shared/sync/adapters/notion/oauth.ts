/**
 * Notion OAuth 2.0 — Authorization URL construction, token exchange,
 * database listing, and record count estimation.
 *
 * Notion OAuth is simpler than Airtable's PKCE flow:
 * - No code verifier / code challenge (no PKCE)
 * - Token exchange uses Basic auth (client_id:client_secret)
 * - Access tokens do not expire — no refresh flow needed
 * - Response includes workspace_id, workspace_name, bot_id
 *
 * @see https://developers.notion.com/docs/authorization
 */

import { z } from 'zod';
import { createLogger } from '../../../logging/logger';

const logger = createLogger({ service: 'sync-oauth' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

// ---------------------------------------------------------------------------
// Env var helpers
// ---------------------------------------------------------------------------

function getClientId(): string {
  const val = process.env['NOTION_CLIENT_ID'];
  if (!val) throw new Error('NOTION_CLIENT_ID environment variable is not set');
  return val;
}

function getClientSecret(): string {
  const val = process.env['NOTION_CLIENT_SECRET'];
  if (!val) throw new Error('NOTION_CLIENT_SECRET environment variable is not set');
  return val;
}

function getRedirectUri(): string {
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'];
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set');
  return `${appUrl}/api/oauth/notion/callback`;
}

function getBasicAuthHeader(): string {
  const credentials = `${getClientId()}:${getClientSecret()}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Auth URL
// ---------------------------------------------------------------------------

/**
 * Construct the Notion OAuth authorization URL.
 * Notion does not use PKCE — only state parameter for CSRF protection.
 */
export function getNotionAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    state,
    owner: 'user',
  });

  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Token types & schemas
// ---------------------------------------------------------------------------

export interface NotionTokens {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_icon: string | null;
  duplicated_template_id: string | null;
  owner: Record<string, unknown>;
}

const NotionTokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  bot_id: z.string(),
  workspace_id: z.string(),
  workspace_name: z.string().nullable(),
  workspace_icon: z.string().nullable(),
  duplicated_template_id: z.string().nullable().optional(),
  owner: z.record(z.string(), z.unknown()),
});

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchange an authorization code for access tokens.
 * Notion tokens do not expire — no refresh flow needed.
 */
export async function exchangeNotionCodeForTokens(
  code: string,
): Promise<NotionTokens> {
  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getBasicAuthHeader(),
      'Notion-Version': NOTION_API_VERSION,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, body: errorText },
      'Notion token exchange failed',
    );
    throw new Error(`Notion token exchange failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = NotionTokenResponseSchema.parse(json);

  return {
    ...parsed,
    duplicated_template_id: parsed.duplicated_template_id ?? null,
  };
}

// ---------------------------------------------------------------------------
// List databases
// ---------------------------------------------------------------------------

export interface NotionDatabase {
  id: string;
  title: string;
  icon: string | null;
}

const NotionSearchResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      object: z.string(),
      title: z.array(
        z.object({
          plain_text: z.string(),
        }),
      ).optional().default([]),
      icon: z
        .object({
          type: z.string(),
          emoji: z.string().optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

/**
 * List all databases accessible to the Notion integration.
 * Uses POST /v1/search with database filter.
 */
export async function listNotionDatabases(
  accessToken: string,
): Promise<NotionDatabase[]> {
  const databases: NotionDatabase[] = [];
  let hasMore = true;
  let startCursor: string | null = null;

  while (hasMore) {
    const body: Record<string, unknown> = {
      filter: { property: 'object', value: 'database' },
      page_size: 100,
    };
    if (startCursor) {
      body['start_cursor'] = startCursor;
    }

    const response = await fetch(`${NOTION_API_URL}/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, body: errorText },
        'Notion list databases failed',
      );
      throw new Error(`Notion list databases failed: ${response.status}`);
    }

    const json: unknown = await response.json();
    const parsed = NotionSearchResponseSchema.parse(json);

    for (const result of parsed.results) {
      if (result.object !== 'database') continue;
      databases.push({
        id: result.id,
        title: result.title.map((t) => t.plain_text).join('') || 'Untitled',
        icon: result.icon?.emoji ?? null,
      });
    }

    hasMore = parsed.has_more;
    startCursor = parsed.next_cursor;
  }

  return databases;
}

// ---------------------------------------------------------------------------
// Database properties (table metadata)
// ---------------------------------------------------------------------------

export interface NotionPropertyMeta {
  id: string;
  name: string;
  type: string;
}

export interface NotionDatabaseMeta {
  id: string;
  title: string;
  properties: NotionPropertyMeta[];
}

const NotionDatabaseResponseSchema = z.object({
  id: z.string(),
  title: z.array(
    z.object({ plain_text: z.string() }),
  ).optional().default([]),
  properties: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.string(),
    }),
  ),
});

/**
 * Retrieve a Notion database's schema (properties).
 * Maps to EveryStack's "list tables in a base" — in Notion, each database is a table.
 */
export async function getNotionDatabaseSchema(
  accessToken: string,
  databaseId: string,
): Promise<NotionDatabaseMeta> {
  const response = await fetch(
    `${NOTION_API_URL}/databases/${databaseId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': NOTION_API_VERSION,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { status: response.status, body: errorText },
      'Notion get database schema failed',
    );
    throw new Error(`Notion get database schema failed: ${response.status}`);
  }

  const json: unknown = await response.json();
  const parsed = NotionDatabaseResponseSchema.parse(json);

  const properties: NotionPropertyMeta[] = Object.entries(parsed.properties).map(
    ([name, prop]) => ({
      id: prop.id,
      name: prop.name ?? name,
      type: prop.type,
    }),
  );

  return {
    id: parsed.id,
    title: parsed.title.map((t) => t.plain_text).join('') || 'Untitled',
    properties,
  };
}

// ---------------------------------------------------------------------------
// Estimate record count
// ---------------------------------------------------------------------------

/**
 * Estimate the record count for a Notion database.
 *
 * Notion does not expose a direct count API. We query with page_size=100
 * and paginate up to 5 pages to estimate. Returns `isExact: false` if
 * more pages exist.
 */
export async function estimateNotionRecordCount(
  accessToken: string,
  databaseId: string,
  filter?: Record<string, unknown>,
): Promise<{ count: number; isExact: boolean }> {
  const MAX_PAGES = 5;
  const PAGE_SIZE = 100;

  let count = 0;
  let startCursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const body: Record<string, unknown> = { page_size: PAGE_SIZE };
    if (startCursor) body['start_cursor'] = startCursor;
    if (filter) body['filter'] = filter;

    const response = await fetch(
      `${NOTION_API_URL}/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_API_VERSION,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, body: errorText },
        'Notion record count estimation failed',
      );
      throw new Error(`Notion record count estimation failed: ${response.status}`);
    }

    const json = (await response.json()) as {
      results: unknown[];
      has_more: boolean;
      next_cursor: string | null;
    };

    count += json.results.length;

    if (!json.has_more) {
      return { count, isExact: true };
    }

    startCursor = json.next_cursor;
  }

  return { count, isExact: false };
}
