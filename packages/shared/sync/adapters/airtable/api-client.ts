/**
 * Airtable REST API Client — thin wrapper over the Airtable Content API
 * with rate limiting and Zod response validation.
 *
 * Used by the sync pipeline to fetch records and field metadata.
 * All requests go through the global RateLimiter before hitting the API.
 *
 * @see https://airtable.com/developers/web/api
 */

import { z } from 'zod';
import { createLogger } from '../../../logging/logger';
import { rateLimiter } from '../../rate-limiter';
import type { AirtableFieldMeta } from './oauth';

const logger = createLogger({ service: 'airtable-api-client' });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Airtable REST API base URL. Shared with oauth.ts. */
export const AIRTABLE_API_BASE_URL = 'https://api.airtable.com/v0';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/** A single record from the Airtable Content API. */
export interface AirtableApiRecord {
  id: string;
  fields: Record<string, unknown>;
  createdTime: string;
}

/** Paginated response from listRecords. */
export interface AirtableListRecordsResponse {
  records: AirtableApiRecord[];
  offset?: string;
}

// ---------------------------------------------------------------------------
// Zod schemas for response validation
// ---------------------------------------------------------------------------

const AirtableApiRecordSchema = z.object({
  id: z.string(),
  fields: z.record(z.string(), z.unknown()),
  createdTime: z.string(),
});

const AirtableListRecordsResponseSchema = z.object({
  records: z.array(AirtableApiRecordSchema),
  offset: z.string().optional(),
});

const AirtableGetRecordResponseSchema = AirtableApiRecordSchema;

const AirtableFieldMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  options: z.record(z.string(), z.unknown()).optional(),
});

const AirtableTablesMetaResponseSchema = z.object({
  tables: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      primaryFieldId: z.string(),
      fields: z.array(AirtableFieldMetaSchema),
    }),
  ),
});

// ---------------------------------------------------------------------------
// List records options
// ---------------------------------------------------------------------------

export interface ListRecordsOptions {
  /** Page size (1–100). Default: 100. */
  pageSize?: number;
  /** Pagination offset from a previous response. */
  offset?: string;
  /** Airtable filterByFormula string. */
  filterByFormula?: string;
  /** Specific field IDs to return. Omit to return all. */
  fields?: string[];
  /** Sort configuration. */
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Thin Airtable API client with rate-limit gating and Zod validation.
 *
 * Each instance is scoped to a single Airtable base for proper per-base
 * rate limit tracking.
 */
export class AirtableApiClient {
  private readonly accessToken: string;
  private readonly baseId: string;
  private readonly scopeKey: string;

  constructor(accessToken: string, baseId: string) {
    this.accessToken = accessToken;
    this.baseId = baseId;
    this.scopeKey = `base:${baseId}`;
  }

  /**
   * List records from a table with optional filtering and pagination.
   * Always requests fields by field ID (`returnFieldsByFieldId=true`)
   * so record fields are keyed by `fldXxx`.
   */
  async listRecords(
    tableId: string,
    options: ListRecordsOptions = {},
  ): Promise<AirtableListRecordsResponse> {
    await rateLimiter.waitForCapacity('airtable', this.scopeKey);

    const params = new URLSearchParams({
      pageSize: String(options.pageSize ?? 100),
      returnFieldsByFieldId: 'true',
    });

    if (options.offset) params.set('offset', options.offset);
    if (options.filterByFormula) params.set('filterByFormula', options.filterByFormula);
    if (options.fields) {
      for (const field of options.fields) {
        params.append('fields[]', field);
      }
    }
    if (options.sort) {
      for (let i = 0; i < options.sort.length; i++) {
        const s = options.sort[i]!;
        params.append(`sort[${i}][field]`, s.field);
        if (s.direction) params.append(`sort[${i}][direction]`, s.direction);
      }
    }

    const url = `${AIRTABLE_API_BASE_URL}/${this.baseId}/${tableId}?${params.toString()}`;
    const response = await this.fetch(url);
    const json: unknown = await response.json();

    return AirtableListRecordsResponseSchema.parse(json);
  }

  /**
   * Get a single record by ID.
   */
  async getRecord(
    tableId: string,
    recordId: string,
  ): Promise<AirtableApiRecord> {
    await rateLimiter.waitForCapacity('airtable', this.scopeKey);

    const params = new URLSearchParams({ returnFieldsByFieldId: 'true' });
    const url = `${AIRTABLE_API_BASE_URL}/${this.baseId}/${tableId}/${recordId}?${params.toString()}`;
    const response = await this.fetch(url);
    const json: unknown = await response.json();

    return AirtableGetRecordResponseSchema.parse(json);
  }

  /**
   * List all fields for a table by fetching table metadata.
   * Uses the Airtable Metadata API.
   */
  async listFields(tableId: string): Promise<AirtableFieldMeta[]> {
    await rateLimiter.waitForCapacity('airtable', this.scopeKey);

    const url = `${AIRTABLE_API_BASE_URL}/meta/bases/${this.baseId}/tables`;
    const response = await this.fetch(url);
    const json: unknown = await response.json();

    const parsed = AirtableTablesMetaResponseSchema.parse(json);
    const table = parsed.tables.find((t) => t.id === tableId);

    if (!table) {
      throw new Error(
        `Table "${tableId}" not found in base "${this.baseId}". ` +
        `Available tables: ${parsed.tables.map((t) => t.id).join(', ')}`,
      );
    }

    return table.fields;
  }

  /**
   * Update a single record by ID (PATCH — partial update).
   * Fields are keyed by field ID (fldXxx), matching the returnFieldsByFieldId mode.
   */
  async updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>,
  ): Promise<AirtableApiRecord> {
    await rateLimiter.waitForCapacity('airtable', this.scopeKey);

    const params = new URLSearchParams({ returnFieldsByFieldId: 'true' });
    const url = `${AIRTABLE_API_BASE_URL}/${this.baseId}/${tableId}/${recordId}?${params.toString()}`;
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    const json: unknown = await response.json();

    return AirtableGetRecordResponseSchema.parse(json);
  }

  /**
   * Internal fetch wrapper with auth header and error handling.
   */
  private async fetch(
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<Response> {
    const response = await globalThis.fetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...options?.headers,
      },
      body: options?.body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        { status: response.status, url, body: errorText },
        'Airtable API request failed',
      );
      const err = new Error(`Airtable API request failed: ${response.status}`);
      (err as Error & { statusCode: number }).statusCode = response.status;
      throw err;
    }

    return response;
  }
}
