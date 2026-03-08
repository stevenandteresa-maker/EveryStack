/**
 * NotionApiClient — HTTP client for Notion API operations.
 *
 * Handles database queries (with pagination and filter), page updates,
 * and Notion-Version header management.
 *
 * Rate limiting is handled externally by the caller via rateLimiter.waitForCapacity().
 *
 * @see https://developers.notion.com/reference
 */

import { createLogger } from '../../../logging/logger';

const logger = createLogger({ service: 'sync' });

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

export { NOTION_API_URL };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotionQueryResponse {
  object: 'list';
  results: NotionPageResult[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface NotionPageResult {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<string, unknown>;
}

export interface NotionQueryOptions {
  pageSize?: number;
  startCursor?: string | null;
  filter?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class NotionApiClient {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Query a Notion database for pages.
   *
   * Uses POST /v1/databases/{id}/query with pagination support.
   * Caller must handle rate limiting before each call.
   */
  async queryDatabase(
    databaseId: string,
    options: NotionQueryOptions = {},
  ): Promise<NotionQueryResponse> {
    const body: Record<string, unknown> = {
      page_size: options.pageSize ?? 100,
    };
    if (options.startCursor) body['start_cursor'] = options.startCursor;
    if (options.filter) body['filter'] = options.filter;

    const response = await fetch(
      `${NOTION_API_URL}/databases/${databaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_API_VERSION,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;
      logger.error(
        { databaseId, status: statusCode, body: errorText },
        'Notion database query failed',
      );
      const error = new Error(`Notion database query failed: ${statusCode}`);
      (error as Error & { statusCode: number }).statusCode = statusCode;
      throw error;
    }

    return (await response.json()) as NotionQueryResponse;
  }

  /**
   * Update properties on a Notion page.
   *
   * Uses PATCH /v1/pages/{id} to update page properties.
   */
  async updatePage(
    pageId: string,
    properties: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(
      `${NOTION_API_URL}/pages/${pageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_API_VERSION,
        },
        body: JSON.stringify({ properties }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      const statusCode = response.status;
      logger.error(
        { pageId, status: statusCode, body: errorText },
        'Notion page update failed',
      );
      const error = new Error(`Notion page update failed: ${statusCode}`);
      (error as Error & { statusCode: number }).statusCode = statusCode;
      throw error;
    }
  }
}
