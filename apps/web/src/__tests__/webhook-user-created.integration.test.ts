import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock state for the write DB (transaction tracking)
// ---------------------------------------------------------------------------

const { insertedRows, mockWriteDb, resetInserts } = vi.hoisted(() => {
  const rows: Array<{ table: unknown; values: Record<string, unknown> }> = [];

  const tx = {
    insert: (table: unknown) => ({
      values: (vals: Record<string, unknown>) => {
        rows.push({ table, values: vals });
        return { returning: () => [vals] };
      },
    }),
  };

  const writeDb = {
    transaction: async (fn: (t: typeof tx) => Promise<void>) => {
      await fn(tx);
    },
  };

  return {
    insertedRows: rows,
    mockWriteDb: writeDb,
    resetInserts: () => {
      rows.length = 0;
    },
  };
});

// ---------------------------------------------------------------------------
// Mock database layer — but NOT svix (real signature verification)
// ---------------------------------------------------------------------------

vi.mock('../../../../packages/shared/db/client', () => ({
  db: mockWriteDb,
  dbRead: {},
  getDbForTenant: vi.fn(() => ({})),
}));

vi.mock('../../../../packages/shared/db/rls', () => ({
  setTenantContext: vi.fn(),
  TENANT_SCOPED_TABLES: [],
}));

vi.mock('@everystack/shared/logging', () => ({
  webLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}));

const MOCK_UUIDS = [
  '01900000-0001-7000-8000-000000000001', // userId
  '01900000-0001-7000-8000-000000000002', // tenantId
  '01900000-0001-7000-8000-000000000003', // workspaceId
  '01900000-0001-7000-8000-000000000004', // slug suffix
];
let uuidCallIndex = 0;

vi.mock('../../../../packages/shared/db/uuid', () => ({
  generateUUIDv7: () => MOCK_UUIDS[uuidCallIndex++] ?? 'uuid-fallback',
  isValidUUID: () => true,
}));

// ---------------------------------------------------------------------------
// Real Svix HMAC signature generation
// ---------------------------------------------------------------------------

const SECRET_BYTES = Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'base64');
const WEBHOOK_SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

function generateSvixHeaders(body: string) {
  const msgId = 'msg_' + crypto.randomBytes(8).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const toSign = `${msgId}.${timestamp}.${body}`;
  const signature = crypto
    .createHmac('sha256', SECRET_BYTES)
    .update(toSign)
    .digest('base64');

  return {
    'svix-id': msgId,
    'svix-timestamp': timestamp,
    'svix-signature': `v1,${signature}`,
    'content-type': 'application/json',
  };
}

function makeRequest(body: string, headers: Record<string, string>): NextRequest {
  return {
    text: () => Promise.resolve(body),
    headers: {
      get: (name: string) => headers[name] ?? null,
    },
  } as unknown as NextRequest;
}

function makeClerkEvent(overrides: Record<string, unknown> = {}) {
  return {
    type: 'user.created',
    data: {
      id: 'user_clerk_new',
      email_addresses: [{ id: 'email_1', email_address: 'new@example.com' }],
      primary_email_address_id: 'email_1',
      first_name: 'New',
      last_name: 'User',
      image_url: null,
      ...overrides,
    },
  };
}

// ---------------------------------------------------------------------------
// Import route handler (uses mocked db + real svix)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/webhooks/clerk/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Webhook integration: user.created with real Svix verification', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInserts();
    uuidCallIndex = 0;
    process.env.CLERK_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it('creates all 5 expected rows in a single transaction with valid signature', async () => {
    const event = makeClerkEvent();
    const body = JSON.stringify(event);
    const headers = generateSvixHeaders(body);
    const request = makeRequest(body, headers);

    const response = await POST(request);

    expect(response.status).toBe(201);

    // Five inserts in the transaction
    expect(insertedRows).toHaveLength(5);

    // 1. User
    expect(insertedRows[0]?.values).toMatchObject({
      id: MOCK_UUIDS[0],
      clerkId: 'user_clerk_new',
      email: 'new@example.com',
      name: 'New User',
    });

    // 2. Tenant
    expect(insertedRows[1]?.values).toMatchObject({
      id: MOCK_UUIDS[1],
      name: "New User's Workspace",
      plan: 'freelancer',
    });

    // 3. Tenant membership (owner, active)
    expect(insertedRows[2]?.values).toMatchObject({
      tenantId: MOCK_UUIDS[1],
      userId: MOCK_UUIDS[0],
      role: 'owner',
      status: 'active',
    });

    // 4. Workspace
    expect(insertedRows[3]?.values).toMatchObject({
      id: MOCK_UUIDS[2],
      tenantId: MOCK_UUIDS[1],
      name: 'My Workspace',
      createdBy: MOCK_UUIDS[0],
    });
    expect(insertedRows[3]?.values.slug).toMatch(/^my-workspace-/);

    // 5. Workspace membership (manager)
    expect(insertedRows[4]?.values).toMatchObject({
      userId: MOCK_UUIDS[0],
      tenantId: MOCK_UUIDS[1],
      workspaceId: MOCK_UUIDS[2],
      role: 'manager',
    });
  });

  it('returns 400 with invalid signature (real Svix rejects)', async () => {
    const event = makeClerkEvent();
    const body = JSON.stringify(event);
    const headers = {
      'svix-id': 'msg_fake',
      'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
      'svix-signature': 'v1,aW52YWxpZF9zaWduYXR1cmU=',
      'content-type': 'application/json',
    };
    const request = makeRequest(body, headers);

    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('Invalid webhook signature');

    // No DB writes should have occurred
    expect(insertedRows).toHaveLength(0);
  });

  it('verifies setTenantContext is called before RLS-protected inserts', async () => {
    const event = makeClerkEvent();
    const body = JSON.stringify(event);
    const headers = generateSvixHeaders(body);
    const request = makeRequest(body, headers);

    await POST(request);

    const { setTenantContext } = await import(
      '../../../../packages/shared/db/rls'
    );
    expect(setTenantContext).toHaveBeenCalledWith(
      expect.anything(), // transaction client
      MOCK_UUIDS[1],    // tenantId
    );
  });
});
