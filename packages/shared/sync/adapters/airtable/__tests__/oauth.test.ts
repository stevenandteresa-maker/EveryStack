import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  getAirtableAuthUrl,
  exchangeCodeForTokens,
  refreshAirtableToken,
  listAirtableBases,
  listAirtableTables,
  estimateAirtableRecordCount,
} from '../oauth';

// ---------------------------------------------------------------------------
// MSW server
// ---------------------------------------------------------------------------

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

const TEST_CLIENT_ID = 'test_client_id';
const TEST_CLIENT_SECRET = 'test_client_secret';
const TEST_APP_URL = 'http://localhost:3000';

describe('Airtable OAuth', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv['AIRTABLE_CLIENT_ID'] = process.env['AIRTABLE_CLIENT_ID'];
    savedEnv['AIRTABLE_CLIENT_SECRET'] = process.env['AIRTABLE_CLIENT_SECRET'];
    savedEnv['NEXT_PUBLIC_APP_URL'] = process.env['NEXT_PUBLIC_APP_URL'];

    process.env['AIRTABLE_CLIENT_ID'] = TEST_CLIENT_ID;
    process.env['AIRTABLE_CLIENT_SECRET'] = TEST_CLIENT_SECRET;
    process.env['NEXT_PUBLIC_APP_URL'] = TEST_APP_URL;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  // -------------------------------------------------------------------------
  // PKCE
  // -------------------------------------------------------------------------

  describe('PKCE', () => {
    it('generates a base64url code verifier of correct length', () => {
      const verifier = generateCodeVerifier();
      // 32 bytes → 43 base64url chars
      expect(verifier).toHaveLength(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('generates a valid S256 code challenge', () => {
      const verifier = generateCodeVerifier();
      const challenge = generateCodeChallenge(verifier);
      // SHA-256 → 32 bytes → 43 base64url chars
      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('produces different verifiers each time', () => {
      const a = generateCodeVerifier();
      const b = generateCodeVerifier();
      expect(a).not.toBe(b);
    });
  });

  // -------------------------------------------------------------------------
  // Auth URL construction
  // -------------------------------------------------------------------------

  describe('getAirtableAuthUrl', () => {
    it('constructs a valid authorization URL', () => {
      const url = getAirtableAuthUrl('test_state', 'test_challenge');
      const parsed = new URL(url);

      expect(parsed.origin).toBe('https://airtable.com');
      expect(parsed.pathname).toBe('/oauth2/v1/authorize');
      expect(parsed.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        `${TEST_APP_URL}/api/oauth/airtable/callback`,
      );
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('state')).toBe('test_state');
      expect(parsed.searchParams.get('code_challenge')).toBe('test_challenge');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
      expect(parsed.searchParams.get('scope')).toContain('data.records:read');
    });

    it('throws when AIRTABLE_CLIENT_ID is missing', () => {
      delete process.env['AIRTABLE_CLIENT_ID'];
      expect(() => getAirtableAuthUrl('s', 'c')).toThrow(
        'AIRTABLE_CLIENT_ID environment variable is not set',
      );
    });

    it('throws when NEXT_PUBLIC_APP_URL is missing', () => {
      delete process.env['NEXT_PUBLIC_APP_URL'];
      expect(() => getAirtableAuthUrl('s', 'c')).toThrow(
        'NEXT_PUBLIC_APP_URL environment variable is not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Token exchange
  // -------------------------------------------------------------------------

  describe('exchangeCodeForTokens', () => {
    it('exchanges an authorization code for tokens', async () => {
      server.use(
        http.post('https://airtable.com/oauth2/v1/token', async ({ request }) => {
          // Verify Basic auth header
          const authHeader = request.headers.get('authorization');
          const expected = `Basic ${Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString('base64')}`;
          expect(authHeader).toBe(expected);

          return HttpResponse.json({
            access_token: 'atok_test_123',
            refresh_token: 'rtok_test_456',
            token_type: 'bearer',
            expires_in: 3600,
            scope: 'data.records:read data.records:write',
          });
        }),
      );

      const tokens = await exchangeCodeForTokens('auth_code_123', 'verifier_abc');

      expect(tokens.access_token).toBe('atok_test_123');
      expect(tokens.refresh_token).toBe('rtok_test_456');
      expect(tokens.token_type).toBe('bearer');
      expect(tokens.expires_in).toBe(3600);
      expect(tokens.expires_at).toBeGreaterThan(Date.now());
    });

    it('throws on HTTP error from Airtable', async () => {
      server.use(
        http.post('https://airtable.com/oauth2/v1/token', () => {
          return HttpResponse.json(
            { error: 'invalid_grant' },
            { status: 400 },
          );
        }),
      );

      await expect(
        exchangeCodeForTokens('bad_code', 'verifier'),
      ).rejects.toThrow('Airtable token exchange failed: 400');
    });

    it('throws when AIRTABLE_CLIENT_SECRET is missing', async () => {
      delete process.env['AIRTABLE_CLIENT_SECRET'];

      await expect(
        exchangeCodeForTokens('code', 'verifier'),
      ).rejects.toThrow('AIRTABLE_CLIENT_SECRET environment variable is not set');
    });
  });

  // -------------------------------------------------------------------------
  // Token refresh
  // -------------------------------------------------------------------------

  describe('refreshAirtableToken', () => {
    it('refreshes an access token', async () => {
      server.use(
        http.post('https://airtable.com/oauth2/v1/token', () => {
          return HttpResponse.json({
            access_token: 'atok_refreshed_789',
            refresh_token: 'rtok_new_012',
            token_type: 'bearer',
            expires_in: 3600,
            scope: 'data.records:read',
          });
        }),
      );

      const tokens = await refreshAirtableToken('rtok_test_456');

      expect(tokens.access_token).toBe('atok_refreshed_789');
      expect(tokens.refresh_token).toBe('rtok_new_012');
      expect(tokens.expires_at).toBeGreaterThan(Date.now());
    });

    it('throws on HTTP error from Airtable', async () => {
      server.use(
        http.post('https://airtable.com/oauth2/v1/token', () => {
          return HttpResponse.json(
            { error: 'invalid_grant' },
            { status: 401 },
          );
        }),
      );

      await expect(
        refreshAirtableToken('bad_refresh'),
      ).rejects.toThrow('Airtable token refresh failed: 401');
    });
  });

  // -------------------------------------------------------------------------
  // List bases
  // -------------------------------------------------------------------------

  describe('listAirtableBases', () => {
    it('lists accessible bases', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases', ({ request }) => {
          const authHeader = request.headers.get('authorization');
          expect(authHeader).toBe('Bearer test_access_token');

          return HttpResponse.json({
            bases: [
              { id: 'appABC123', name: 'My Base', permissionLevel: 'create' },
              { id: 'appDEF456', name: 'Other Base', permissionLevel: 'read' },
            ],
          });
        }),
      );

      const bases = await listAirtableBases('test_access_token');

      expect(bases).toHaveLength(2);
      expect(bases[0]).toEqual({
        id: 'appABC123',
        name: 'My Base',
        permissionLevel: 'create',
      });
    });

    it('throws on HTTP error from Airtable', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases', () => {
          return HttpResponse.json(
            { error: { type: 'UNAUTHORIZED' } },
            { status: 401 },
          );
        }),
      );

      await expect(listAirtableBases('bad_token')).rejects.toThrow(
        'Airtable list bases failed: 401',
      );
    });

    it('returns empty array when no bases exist', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases', () => {
          return HttpResponse.json({ bases: [] });
        }),
      );

      const bases = await listAirtableBases('valid_token');
      expect(bases).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // List tables
  // -------------------------------------------------------------------------

  describe('listAirtableTables', () => {
    it('lists tables with their fields', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases/:baseId/tables', ({ request }) => {
          const authHeader = request.headers.get('authorization');
          expect(authHeader).toBe('Bearer test_access_token');

          return HttpResponse.json({
            tables: [
              {
                id: 'tbl001',
                name: 'Contacts',
                primaryFieldId: 'fld001',
                fields: [
                  { id: 'fld001', name: 'Name', type: 'singleLineText' },
                  { id: 'fld002', name: 'Email', type: 'email' },
                ],
              },
            ],
          });
        }),
      );

      const tables = await listAirtableTables('test_access_token', 'appABC');

      expect(tables).toHaveLength(1);
      expect(tables[0]!.id).toBe('tbl001');
      expect(tables[0]!.name).toBe('Contacts');
      expect(tables[0]!.primaryFieldId).toBe('fld001');
      expect(tables[0]!.fields).toHaveLength(2);
      expect(tables[0]!.fields[0]!.type).toBe('singleLineText');
    });

    it('returns empty array when no tables exist', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases/:baseId/tables', () => {
          return HttpResponse.json({ tables: [] });
        }),
      );

      const tables = await listAirtableTables('token', 'appABC');
      expect(tables).toEqual([]);
    });

    it('throws on HTTP error from Airtable', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases/:baseId/tables', () => {
          return HttpResponse.json(
            { error: { type: 'NOT_FOUND' } },
            { status: 404 },
          );
        }),
      );

      await expect(listAirtableTables('token', 'appBad')).rejects.toThrow(
        'Airtable list tables failed: 404',
      );
    });

    it('includes field options when present', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/meta/bases/:baseId/tables', () => {
          return HttpResponse.json({
            tables: [
              {
                id: 'tbl001',
                name: 'Tasks',
                primaryFieldId: 'fld001',
                fields: [
                  {
                    id: 'fld001',
                    name: 'Status',
                    type: 'singleSelect',
                    options: {
                      choices: [{ name: 'Active' }, { name: 'Done' }],
                    },
                  },
                ],
              },
            ],
          });
        }),
      );

      const tables = await listAirtableTables('token', 'appABC');
      expect(tables[0]!.fields[0]!.options).toEqual({
        choices: [{ name: 'Active' }, { name: 'Done' }],
      });
    });
  });

  // -------------------------------------------------------------------------
  // Estimate record count
  // -------------------------------------------------------------------------

  describe('estimateAirtableRecordCount', () => {
    it('returns exact count when all records fit in one page', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/:baseId/:tableId', () => {
          return HttpResponse.json({
            records: Array.from({ length: 42 }, (_, i) => ({
              id: `rec${i}`,
              fields: {},
            })),
          });
        }),
      );

      const result = await estimateAirtableRecordCount('token', 'appABC', 'tbl001');

      expect(result.count).toBe(42);
      expect(result.isExact).toBe(true);
    });

    it('counts across multiple pages', async () => {
      let pageCount = 0;
      server.use(
        http.get('https://api.airtable.com/v0/:baseId/:tableId', () => {
          pageCount++;
          const records = Array.from({ length: 100 }, (_, i) => ({
            id: `rec_p${pageCount}_${i}`,
            fields: {},
          }));

          // Return offset for first 2 pages, then stop
          if (pageCount < 3) {
            return HttpResponse.json({ records, offset: `page_${pageCount + 1}` });
          }
          return HttpResponse.json({ records });
        }),
      );

      const result = await estimateAirtableRecordCount('token', 'appABC', 'tbl001');

      expect(result.count).toBe(300);
      expect(result.isExact).toBe(true);
    });

    it('marks as inexact when max pages exceeded', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/:baseId/:tableId', () => {
          return HttpResponse.json({
            records: Array.from({ length: 100 }, (_, i) => ({
              id: `rec${i}`,
              fields: {},
            })),
            offset: 'always_more',
          });
        }),
      );

      const result = await estimateAirtableRecordCount('token', 'appABC', 'tbl001');

      expect(result.count).toBe(500); // 5 pages x 100
      expect(result.isExact).toBe(false);
    });

    it('passes filterFormula as query parameter', async () => {
      let capturedFormula: string | null = null;
      server.use(
        http.get('https://api.airtable.com/v0/:baseId/:tableId', ({ request }) => {
          const url = new URL(request.url);
          capturedFormula = url.searchParams.get('filterByFormula');
          return HttpResponse.json({ records: [{ id: 'rec1', fields: {} }] });
        }),
      );

      await estimateAirtableRecordCount(
        'token',
        'appABC',
        'tbl001',
        '{Status} = "Active"',
      );

      expect(capturedFormula).toBe('{Status} = "Active"');
    });

    it('throws on HTTP error', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/:baseId/:tableId', () => {
          return HttpResponse.json(
            { error: { type: 'UNAUTHORIZED' } },
            { status: 401 },
          );
        }),
      );

      await expect(
        estimateAirtableRecordCount('bad_token', 'appABC', 'tbl001'),
      ).rejects.toThrow('Airtable record count estimation failed: 401');
    });

    it('returns zero count for empty table', async () => {
      server.use(
        http.get('https://api.airtable.com/v0/:baseId/:tableId', () => {
          return HttpResponse.json({ records: [] });
        }),
      );

      const result = await estimateAirtableRecordCount('token', 'appABC', 'tbl001');

      expect(result.count).toBe(0);
      expect(result.isExact).toBe(true);
    });
  });
});
