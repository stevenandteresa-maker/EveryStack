import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { type SetupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Airtable Handlers
// ---------------------------------------------------------------------------

export const airtableHandlers = [
  http.get('https://api.airtable.com/v0/:baseId/:tableId', ({ request, params: _params }) => {
    const url = new URL(request.url);
    const pageSize = parseInt(url.searchParams.get('pageSize') ?? '100', 10);
    const offset = url.searchParams.get('offset');

    // Generate mock records based on pageSize
    const records = Array.from({ length: Math.min(pageSize, 5) }, (_, i) => ({
      id: `rec_mock_${offset ? 'p2_' : ''}${String(i + 1).padStart(3, '0')}`,
      fields: { Name: `Test Record ${i + 1}`, Status: 'Active' },
      createdTime: '2024-01-01T00:00:00.000Z',
    }));

    // Simulate pagination: return offset on first page if no offset provided
    const response: Record<string, unknown> = { records };
    if (!offset) {
      response['offset'] = 'mock_offset_page2';
    }

    return HttpResponse.json(response);
  }),
  http.patch('https://api.airtable.com/v0/:baseId/:tableId', () => {
    return HttpResponse.json({
      records: [{ id: 'rec_mock_001', fields: {} }],
    });
  }),
];

// ---------------------------------------------------------------------------
// Airtable OAuth Handlers
// ---------------------------------------------------------------------------

export const airtableOAuthHandlers = [
  // Token exchange + refresh
  http.post('https://airtable.com/oauth2/v1/token', async ({ request }) => {
    const body = await request.text();
    const params = new URLSearchParams(body);
    const grantType = params.get('grant_type');

    if (grantType === 'authorization_code') {
      return HttpResponse.json({
        access_token: 'atok_mock_exchange',
        refresh_token: 'rtok_mock_exchange',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'data.records:read data.records:write schema.bases:read schema.bases:write',
      });
    }

    if (grantType === 'refresh_token') {
      return HttpResponse.json({
        access_token: 'atok_mock_refreshed',
        refresh_token: 'rtok_mock_refreshed',
        token_type: 'bearer',
        expires_in: 3600,
        scope: 'data.records:read data.records:write schema.bases:read schema.bases:write',
      });
    }

    return HttpResponse.json({ error: 'unsupported_grant_type' }, { status: 400 });
  }),

  // List bases
  http.get('https://api.airtable.com/v0/meta/bases', ({ request }) => {
    // Check if this is the table listing endpoint (has baseId in path)
    const url = new URL(request.url);
    if (url.pathname.match(/\/v0\/meta\/bases\/[^/]+\/tables/)) {
      // Handled by the tables handler below
      return;
    }
    return HttpResponse.json({
      bases: [
        { id: 'appMock001', name: 'Mock Base 1', permissionLevel: 'create' },
        { id: 'appMock002', name: 'Mock Base 2', permissionLevel: 'read' },
      ],
    });
  }),

  // List tables in a base
  http.get('https://api.airtable.com/v0/meta/bases/:baseId/tables', () => {
    return HttpResponse.json({
      tables: [
        {
          id: 'tblMock001',
          name: 'Contacts',
          primaryFieldId: 'fldName001',
          fields: [
            { id: 'fldName001', name: 'Name', type: 'singleLineText' },
            { id: 'fldEmail001', name: 'Email', type: 'email' },
            { id: 'fldStatus001', name: 'Status', type: 'singleSelect', options: { choices: [{ name: 'Active' }, { name: 'Inactive' }] } },
          ],
        },
        {
          id: 'tblMock002',
          name: 'Projects',
          primaryFieldId: 'fldProjName001',
          fields: [
            { id: 'fldProjName001', name: 'Project Name', type: 'singleLineText' },
            { id: 'fldDueDate001', name: 'Due Date', type: 'date' },
            { id: 'fldBudget001', name: 'Budget', type: 'currency' },
          ],
        },
      ],
    });
  }),
];

// ---------------------------------------------------------------------------
// Notion Handlers
// ---------------------------------------------------------------------------

export const notionHandlers = [
  http.post(
    'https://api.notion.com/v1/databases/:databaseId/query',
    () => {
      return HttpResponse.json({
        object: 'list',
        results: [
          {
            object: 'page',
            id: 'page_mock_001',
            properties: {
              Name: { title: [{ text: { content: 'Test Page' } }] },
            },
          },
        ],
        has_more: false,
        next_cursor: null,
      });
    },
  ),
  http.patch('https://api.notion.com/v1/pages/:pageId', () => {
    return HttpResponse.json({
      object: 'page',
      id: 'page_mock_001',
      properties: {},
    });
  }),
];

// ---------------------------------------------------------------------------
// Notion OAuth Handlers
// ---------------------------------------------------------------------------

export const notionOAuthHandlers = [
  // Token exchange
  http.post('https://api.notion.com/v1/oauth/token', () => {
    return HttpResponse.json({
      access_token: 'ntn_mock_access_token',
      token_type: 'bearer',
      bot_id: 'bot_mock_001',
      workspace_id: 'ws_mock_001',
      workspace_name: 'Mock Workspace',
      workspace_icon: null,
      owner: {
        type: 'user',
        user: { id: 'user_mock_001', name: 'Test User' },
      },
    });
  }),

  // Search (list databases)
  http.post('https://api.notion.com/v1/search', () => {
    return HttpResponse.json({
      object: 'list',
      results: [
        {
          object: 'database',
          id: 'db_mock_001',
          title: [{ plain_text: 'Mock Database 1' }],
          icon: { type: 'emoji', emoji: '📋' },
        },
        {
          object: 'database',
          id: 'db_mock_002',
          title: [{ plain_text: 'Mock Database 2' }],
          icon: null,
        },
      ],
      has_more: false,
      next_cursor: null,
    });
  }),

  // Retrieve database (schema)
  http.get('https://api.notion.com/v1/databases/:databaseId', () => {
    return HttpResponse.json({
      object: 'database',
      id: 'db_mock_001',
      title: [{ plain_text: 'Mock Database 1' }],
      properties: {
        Name: { id: 'title', name: 'Name', type: 'title', title: {} },
        Status: {
          id: 'prop_status',
          name: 'Status',
          type: 'select',
          select: {
            options: [
              { id: 'opt_1', name: 'Active', color: 'green' },
              { id: 'opt_2', name: 'Inactive', color: 'red' },
            ],
          },
        },
        Email: { id: 'prop_email', name: 'Email', type: 'email', email: {} },
      },
    });
  }),
];

// ---------------------------------------------------------------------------
// SmartSuite Handlers (placeholder stubs)
// ---------------------------------------------------------------------------

export const smartsuiteHandlers = [
  http.get('https://app.smartsuite.com/api/v1/applications/:appId/records', () => {
    return HttpResponse.json({
      items: [
        {
          id: 'ss_mock_001',
          title: 'Test SmartSuite Record',
        },
      ],
    });
  }),
  http.patch('https://app.smartsuite.com/api/v1/applications/:appId/records/:recordId', () => {
    return HttpResponse.json({
      id: 'ss_mock_001',
      title: 'Updated SmartSuite Record',
    });
  }),
];

// ---------------------------------------------------------------------------
// Combined Mock Server
// ---------------------------------------------------------------------------

export const mockApiServer: SetupServer = setupServer(
  ...airtableHandlers,
  ...airtableOAuthHandlers,
  ...notionHandlers,
  ...notionOAuthHandlers,
  ...smartsuiteHandlers,
);

// ---------------------------------------------------------------------------
// Convenience Lifecycle Hook
// ---------------------------------------------------------------------------

/**
 * Sets up MSW mock API lifecycle hooks for Vitest.
 * Call once at the top of a describe block or test file.
 *
 * - beforeAll: starts the mock server (warns on unhandled requests)
 * - afterEach: resets any runtime handler overrides
 * - afterAll: shuts down the mock server
 */
export function setupMockApis(): void {
  beforeAll(() => {
    mockApiServer.listen({ onUnhandledRequest: 'warn' });
  });

  afterEach(() => {
    mockApiServer.resetHandlers();
  });

  afterAll(() => {
    mockApiServer.close();
  });
}
