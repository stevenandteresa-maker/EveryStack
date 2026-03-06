import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../logging/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock rate limiter to not actually wait
vi.mock('../../../rate-limiter', () => ({
  rateLimiter: {
    waitForCapacity: vi.fn().mockResolvedValue(undefined),
    checkLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
  },
}));

import { AirtableApiClient, AIRTABLE_API_BASE_URL } from '../api-client';
import { rateLimiter } from '../../../rate-limiter';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TOKEN = 'atok_test_123';
const BASE_ID = 'appTestBase001';
const TABLE_ID = 'tblTestTable001';

describe('AirtableApiClient', () => {
  let client: AirtableApiClient;

  beforeEach(() => {
    client = new AirtableApiClient(TOKEN, BASE_ID);
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // listRecords
  // -------------------------------------------------------------------------

  describe('listRecords', () => {
    it('returns paginated results', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}`, ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('returnFieldsByFieldId')).toBe('true');

          return HttpResponse.json({
            records: [
              { id: 'rec001', fields: { fldName: 'Alice' }, createdTime: '2024-01-01T00:00:00.000Z' },
              { id: 'rec002', fields: { fldName: 'Bob' }, createdTime: '2024-01-02T00:00:00.000Z' },
            ],
            offset: 'next_page_token',
          });
        }),
      );

      const result = await client.listRecords(TABLE_ID);

      expect(result.records).toHaveLength(2);
      expect(result.records[0]!.id).toBe('rec001');
      expect(result.records[0]!.fields).toEqual({ fldName: 'Alice' });
      expect(result.offset).toBe('next_page_token');
    });

    it('passes filterByFormula and returnFieldsByFieldId', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ records: [] });
        }),
      );

      await client.listRecords(TABLE_ID, {
        filterByFormula: '{fldStatus} = "Active"',
        pageSize: 50,
      });

      const url = new URL(capturedUrl);
      expect(url.searchParams.get('filterByFormula')).toBe('{fldStatus} = "Active"');
      expect(url.searchParams.get('pageSize')).toBe('50');
      expect(url.searchParams.get('returnFieldsByFieldId')).toBe('true');
    });

    it('passes offset for pagination', async () => {
      let capturedUrl = '';
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}`, ({ request }) => {
          capturedUrl = request.url;
          return HttpResponse.json({ records: [] });
        }),
      );

      await client.listRecords(TABLE_ID, { offset: 'page2token' });

      const url = new URL(capturedUrl);
      expect(url.searchParams.get('offset')).toBe('page2token');
    });

    it('calls rate limiter waitForCapacity before each request', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}`, () => {
          return HttpResponse.json({ records: [] });
        }),
      );

      await client.listRecords(TABLE_ID);

      expect(rateLimiter.waitForCapacity).toHaveBeenCalledWith('airtable', `base:${BASE_ID}`);
    });

    it('rejects malformed responses via Zod validation', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}`, () => {
          return HttpResponse.json({ invalid: 'response' });
        }),
      );

      await expect(client.listRecords(TABLE_ID)).rejects.toThrow();
    });

    it('throws on HTTP errors', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}`, () => {
          return HttpResponse.json({ error: { message: 'Rate limited' } }, { status: 429 });
        }),
      );

      await expect(client.listRecords(TABLE_ID)).rejects.toThrow('Airtable API request failed: 429');
    });
  });

  // -------------------------------------------------------------------------
  // getRecord
  // -------------------------------------------------------------------------

  describe('getRecord', () => {
    it('returns a single record', async () => {
      const recordId = 'recTest001';
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}/${recordId}`, () => {
          return HttpResponse.json({
            id: recordId,
            fields: { fldName: 'Alice', fldEmail: 'alice@example.com' },
            createdTime: '2024-01-01T00:00:00.000Z',
          });
        }),
      );

      const result = await client.getRecord(TABLE_ID, recordId);

      expect(result.id).toBe(recordId);
      expect(result.fields).toEqual({ fldName: 'Alice', fldEmail: 'alice@example.com' });
      expect(result.createdTime).toBe('2024-01-01T00:00:00.000Z');
    });

    it('calls rate limiter before fetching', async () => {
      const recordId = 'recTest001';
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/${BASE_ID}/${TABLE_ID}/${recordId}`, () => {
          return HttpResponse.json({
            id: recordId,
            fields: {},
            createdTime: '2024-01-01T00:00:00.000Z',
          });
        }),
      );

      await client.getRecord(TABLE_ID, recordId);
      expect(rateLimiter.waitForCapacity).toHaveBeenCalledWith('airtable', `base:${BASE_ID}`);
    });
  });

  // -------------------------------------------------------------------------
  // listFields
  // -------------------------------------------------------------------------

  describe('listFields', () => {
    it('returns field metadata for the specified table', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/meta/bases/${BASE_ID}/tables`, () => {
          return HttpResponse.json({
            tables: [
              {
                id: TABLE_ID,
                name: 'Contacts',
                primaryFieldId: 'fldName001',
                fields: [
                  { id: 'fldName001', name: 'Name', type: 'singleLineText' },
                  { id: 'fldEmail001', name: 'Email', type: 'email' },
                  { id: 'fldStatus001', name: 'Status', type: 'singleSelect', options: { choices: [] } },
                ],
              },
              {
                id: 'tblOther',
                name: 'Other',
                primaryFieldId: 'fldX',
                fields: [{ id: 'fldX', name: 'X', type: 'number' }],
              },
            ],
          });
        }),
      );

      const fields = await client.listFields(TABLE_ID);

      expect(fields).toHaveLength(3);
      expect(fields[0]!.id).toBe('fldName001');
      expect(fields[0]!.type).toBe('singleLineText');
      expect(fields[2]!.options).toEqual({ choices: [] });
    });

    it('throws if table not found in base', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/meta/bases/${BASE_ID}/tables`, () => {
          return HttpResponse.json({
            tables: [
              { id: 'tblOther', name: 'Other', primaryFieldId: 'fldX', fields: [] },
            ],
          });
        }),
      );

      await expect(client.listFields(TABLE_ID)).rejects.toThrow(
        `Table "${TABLE_ID}" not found in base "${BASE_ID}"`,
      );
    });

    it('calls rate limiter before fetching', async () => {
      server.use(
        http.get(`${AIRTABLE_API_BASE_URL}/meta/bases/${BASE_ID}/tables`, () => {
          return HttpResponse.json({
            tables: [
              { id: TABLE_ID, name: 'T', primaryFieldId: 'fld1', fields: [] },
            ],
          });
        }),
      );

      await client.listFields(TABLE_ID);
      expect(rateLimiter.waitForCapacity).toHaveBeenCalledWith('airtable', `base:${BASE_ID}`);
    });
  });
});
