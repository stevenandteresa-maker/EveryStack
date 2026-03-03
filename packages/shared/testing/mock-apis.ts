import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { type SetupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Airtable Handlers
// ---------------------------------------------------------------------------

export const airtableHandlers = [
  http.get('https://api.airtable.com/v0/:baseId/:tableId', ({ params: _params }) => {
    return HttpResponse.json({
      records: [
        {
          id: 'rec_mock_001',
          fields: { Name: 'Test Record', Status: 'Active' },
          createdTime: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
  }),
  http.patch('https://api.airtable.com/v0/:baseId/:tableId', () => {
    return HttpResponse.json({
      records: [{ id: 'rec_mock_001', fields: {} }],
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
  ...notionHandlers,
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
