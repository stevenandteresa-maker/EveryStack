import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  getNotionAuthUrl,
  exchangeNotionCodeForTokens,
  listNotionDatabases,
  getNotionDatabaseSchema,
  estimateNotionRecordCount,
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

const TEST_CLIENT_ID = 'test_notion_client_id';
const TEST_CLIENT_SECRET = 'test_notion_client_secret';
const TEST_APP_URL = 'http://localhost:3000';

describe('Notion OAuth', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv['NOTION_CLIENT_ID'] = process.env['NOTION_CLIENT_ID'];
    savedEnv['NOTION_CLIENT_SECRET'] = process.env['NOTION_CLIENT_SECRET'];
    savedEnv['NEXT_PUBLIC_APP_URL'] = process.env['NEXT_PUBLIC_APP_URL'];

    process.env['NOTION_CLIENT_ID'] = TEST_CLIENT_ID;
    process.env['NOTION_CLIENT_SECRET'] = TEST_CLIENT_SECRET;
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
  // Auth URL construction
  // -------------------------------------------------------------------------

  describe('getNotionAuthUrl', () => {
    it('constructs a valid authorization URL', () => {
      const url = getNotionAuthUrl('test_state');
      const parsed = new URL(url);

      expect(parsed.origin).toBe('https://api.notion.com');
      expect(parsed.pathname).toBe('/v1/oauth/authorize');
      expect(parsed.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
      expect(parsed.searchParams.get('redirect_uri')).toBe(
        `${TEST_APP_URL}/api/oauth/notion/callback`,
      );
      expect(parsed.searchParams.get('response_type')).toBe('code');
      expect(parsed.searchParams.get('state')).toBe('test_state');
      expect(parsed.searchParams.get('owner')).toBe('user');
    });

    it('throws when NOTION_CLIENT_ID is missing', () => {
      delete process.env['NOTION_CLIENT_ID'];
      expect(() => getNotionAuthUrl('s')).toThrow(
        'NOTION_CLIENT_ID environment variable is not set',
      );
    });

    it('throws when NEXT_PUBLIC_APP_URL is missing', () => {
      delete process.env['NEXT_PUBLIC_APP_URL'];
      expect(() => getNotionAuthUrl('s')).toThrow(
        'NEXT_PUBLIC_APP_URL environment variable is not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Token exchange
  // -------------------------------------------------------------------------

  describe('exchangeNotionCodeForTokens', () => {
    it('exchanges an authorization code for tokens', async () => {
      server.use(
        http.post('https://api.notion.com/v1/oauth/token', async ({ request }) => {
          // Verify Basic auth header
          const authHeader = request.headers.get('authorization');
          const expected = `Basic ${Buffer.from(`${TEST_CLIENT_ID}:${TEST_CLIENT_SECRET}`).toString('base64')}`;
          expect(authHeader).toBe(expected);

          return HttpResponse.json({
            access_token: 'ntn_test_123',
            token_type: 'bearer',
            bot_id: 'bot_test_001',
            workspace_id: 'ws_test_001',
            workspace_name: 'Test Workspace',
            workspace_icon: null,
            duplicated_template_id: null,
            owner: { type: 'user', user: { id: 'user_001' } },
          });
        }),
      );

      const tokens = await exchangeNotionCodeForTokens('auth_code_123');

      expect(tokens.access_token).toBe('ntn_test_123');
      expect(tokens.token_type).toBe('bearer');
      expect(tokens.bot_id).toBe('bot_test_001');
      expect(tokens.workspace_id).toBe('ws_test_001');
      expect(tokens.workspace_name).toBe('Test Workspace');
    });

    it('throws on HTTP error from Notion', async () => {
      server.use(
        http.post('https://api.notion.com/v1/oauth/token', () => {
          return HttpResponse.json(
            { error: 'invalid_grant' },
            { status: 400 },
          );
        }),
      );

      await expect(
        exchangeNotionCodeForTokens('bad_code'),
      ).rejects.toThrow('Notion token exchange failed: 400');
    });

    it('throws when NOTION_CLIENT_SECRET is missing', async () => {
      delete process.env['NOTION_CLIENT_SECRET'];

      await expect(
        exchangeNotionCodeForTokens('code'),
      ).rejects.toThrow('NOTION_CLIENT_SECRET environment variable is not set');
    });
  });

  // -------------------------------------------------------------------------
  // List databases
  // -------------------------------------------------------------------------

  describe('listNotionDatabases', () => {
    it('lists accessible databases', async () => {
      server.use(
        http.post('https://api.notion.com/v1/search', ({ request }) => {
          const authHeader = request.headers.get('authorization');
          expect(authHeader).toBe('Bearer test_access_token');

          return HttpResponse.json({
            results: [
              {
                object: 'database',
                id: 'db_001',
                title: [{ plain_text: 'Projects' }],
                icon: { type: 'emoji', emoji: '📋' },
              },
              {
                object: 'database',
                id: 'db_002',
                title: [{ plain_text: 'Tasks' }],
                icon: null,
              },
            ],
            has_more: false,
            next_cursor: null,
          });
        }),
      );

      const databases = await listNotionDatabases('test_access_token');

      expect(databases).toHaveLength(2);
      expect(databases[0]).toEqual({
        id: 'db_001',
        title: 'Projects',
        icon: '📋',
      });
      expect(databases[1]).toEqual({
        id: 'db_002',
        title: 'Tasks',
        icon: null,
      });
    });

    it('throws on HTTP error', async () => {
      server.use(
        http.post('https://api.notion.com/v1/search', () => {
          return HttpResponse.json(
            { error: 'unauthorized' },
            { status: 401 },
          );
        }),
      );

      await expect(listNotionDatabases('bad_token')).rejects.toThrow(
        'Notion list databases failed: 401',
      );
    });

    it('returns empty array when no databases exist', async () => {
      server.use(
        http.post('https://api.notion.com/v1/search', () => {
          return HttpResponse.json({
            results: [],
            has_more: false,
            next_cursor: null,
          });
        }),
      );

      const databases = await listNotionDatabases('valid_token');
      expect(databases).toEqual([]);
    });

    it('paginates when has_more is true', async () => {
      let callCount = 0;
      server.use(
        http.post('https://api.notion.com/v1/search', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json({
              results: [
                { object: 'database', id: 'db_p1', title: [{ plain_text: 'Page 1 DB' }], icon: null },
              ],
              has_more: true,
              next_cursor: 'cursor_page2',
            });
          }
          return HttpResponse.json({
            results: [
              { object: 'database', id: 'db_p2', title: [{ plain_text: 'Page 2 DB' }], icon: null },
            ],
            has_more: false,
            next_cursor: null,
          });
        }),
      );

      const databases = await listNotionDatabases('token');
      expect(databases).toHaveLength(2);
      expect(databases[0]!.id).toBe('db_p1');
      expect(databases[1]!.id).toBe('db_p2');
    });
  });

  // -------------------------------------------------------------------------
  // Get database schema
  // -------------------------------------------------------------------------

  describe('getNotionDatabaseSchema', () => {
    it('retrieves database properties', async () => {
      server.use(
        http.get('https://api.notion.com/v1/databases/:databaseId', ({ request }) => {
          const authHeader = request.headers.get('authorization');
          expect(authHeader).toBe('Bearer test_access_token');

          return HttpResponse.json({
            id: 'db_001',
            title: [{ plain_text: 'Projects' }],
            properties: {
              Name: { id: 'title', name: 'Name', type: 'title' },
              Status: { id: 'prop_status', name: 'Status', type: 'select' },
              DueDate: { id: 'prop_date', name: 'Due Date', type: 'date' },
            },
          });
        }),
      );

      const schema = await getNotionDatabaseSchema('test_access_token', 'db_001');

      expect(schema.id).toBe('db_001');
      expect(schema.title).toBe('Projects');
      expect(schema.properties).toHaveLength(3);
      expect(schema.properties.find((p) => p.type === 'title')).toEqual({
        id: 'title',
        name: 'Name',
        type: 'title',
      });
    });

    it('throws on HTTP error', async () => {
      server.use(
        http.get('https://api.notion.com/v1/databases/:databaseId', () => {
          return HttpResponse.json(
            { error: 'not_found' },
            { status: 404 },
          );
        }),
      );

      await expect(
        getNotionDatabaseSchema('token', 'bad_db'),
      ).rejects.toThrow('Notion get database schema failed: 404');
    });
  });

  // -------------------------------------------------------------------------
  // Estimate record count
  // -------------------------------------------------------------------------

  describe('estimateNotionRecordCount', () => {
    it('returns exact count when all records fit in one page', async () => {
      server.use(
        http.post('https://api.notion.com/v1/databases/:databaseId/query', () => {
          return HttpResponse.json({
            results: Array.from({ length: 42 }, (_, i) => ({
              object: 'page',
              id: `page_${i}`,
              properties: {},
            })),
            has_more: false,
            next_cursor: null,
          });
        }),
      );

      const result = await estimateNotionRecordCount('token', 'db_001');

      expect(result.count).toBe(42);
      expect(result.isExact).toBe(true);
    });

    it('counts across multiple pages', async () => {
      let pageCount = 0;
      server.use(
        http.post('https://api.notion.com/v1/databases/:databaseId/query', () => {
          pageCount++;
          const results = Array.from({ length: 100 }, (_, i) => ({
            object: 'page',
            id: `page_p${pageCount}_${i}`,
            properties: {},
          }));

          if (pageCount < 3) {
            return HttpResponse.json({ results, has_more: true, next_cursor: `cursor_${pageCount + 1}` });
          }
          return HttpResponse.json({ results, has_more: false, next_cursor: null });
        }),
      );

      const result = await estimateNotionRecordCount('token', 'db_001');

      expect(result.count).toBe(300);
      expect(result.isExact).toBe(true);
    });

    it('marks as inexact when max pages exceeded', async () => {
      server.use(
        http.post('https://api.notion.com/v1/databases/:databaseId/query', () => {
          return HttpResponse.json({
            results: Array.from({ length: 100 }, (_, i) => ({
              object: 'page',
              id: `page_${i}`,
              properties: {},
            })),
            has_more: true,
            next_cursor: 'always_more',
          });
        }),
      );

      const result = await estimateNotionRecordCount('token', 'db_001');

      expect(result.count).toBe(500); // 5 pages x 100
      expect(result.isExact).toBe(false);
    });

    it('throws on HTTP error', async () => {
      server.use(
        http.post('https://api.notion.com/v1/databases/:databaseId/query', () => {
          return HttpResponse.json(
            { error: 'unauthorized' },
            { status: 401 },
          );
        }),
      );

      await expect(
        estimateNotionRecordCount('bad_token', 'db_001'),
      ).rejects.toThrow('Notion record count estimation failed: 401');
    });

    it('returns zero count for empty database', async () => {
      server.use(
        http.post('https://api.notion.com/v1/databases/:databaseId/query', () => {
          return HttpResponse.json({
            results: [],
            has_more: false,
            next_cursor: null,
          });
        }),
      );

      const result = await estimateNotionRecordCount('token', 'db_001');

      expect(result.count).toBe(0);
      expect(result.isExact).toBe(true);
    });
  });
});
