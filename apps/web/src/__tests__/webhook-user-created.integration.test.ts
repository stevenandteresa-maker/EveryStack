import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockCreateUserWithTenant,
  mockUpdateUserFromClerk,
  mockProvisionPersonalTenant,
  mockSetTenantContext,
} = vi.hoisted(() => ({
  mockCreateUserWithTenant: vi.fn(),
  mockUpdateUserFromClerk: vi.fn(),
  mockProvisionPersonalTenant: vi.fn(),
  mockSetTenantContext: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    db: {},
    dbRead: {},
    getDbForTenant: vi.fn(() => ({})),
    createUserWithTenant: mockCreateUserWithTenant,
    updateUserFromClerk: mockUpdateUserFromClerk,
    setTenantContext: mockSetTenantContext,
  };
});

vi.mock('@/lib/auth/personal-tenant', () => ({
  provisionPersonalTenant: mockProvisionPersonalTenant,
  PERSONAL_TENANT_ACCENT_COLOR: '#78716C',
}));

vi.mock('@everystack/shared/logging', () => ({
  webLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
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
// Import route handler (uses mocked deps)
// ---------------------------------------------------------------------------

import { POST } from '../app/api/webhooks/clerk/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Webhook integration: user.created with real Svix verification', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = WEBHOOK_SECRET;

    // Default: createUserWithTenant returns a userId
    mockCreateUserWithTenant.mockResolvedValue({ userId: 'mock-user-id' });
    mockProvisionPersonalTenant.mockResolvedValue('mock-personal-tenant-id');
  });

  it('calls createUserWithTenant and provisionPersonalTenant with correct args', async () => {
    const event = makeClerkEvent();
    const body = JSON.stringify(event);
    const headers = generateSvixHeaders(body);
    const request = makeRequest(body, headers);

    const response = await POST(request);

    expect(response.status).toBe(201);

    // Verify createUserWithTenant was called with extracted Clerk data
    expect(mockCreateUserWithTenant).toHaveBeenCalledTimes(1);
    expect(mockCreateUserWithTenant).toHaveBeenCalledWith({
      clerkId: 'user_clerk_new',
      email: 'new@example.com',
      name: 'New User',
    });

    // Verify provisionPersonalTenant was called with the returned userId
    expect(mockProvisionPersonalTenant).toHaveBeenCalledTimes(1);
    expect(mockProvisionPersonalTenant).toHaveBeenCalledWith(
      'mock-user-id',
      'New User',
    );
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

    // No DB calls should have occurred
    expect(mockCreateUserWithTenant).not.toHaveBeenCalled();
    expect(mockProvisionPersonalTenant).not.toHaveBeenCalled();
  });

  it('handles user.updated events', async () => {
    mockUpdateUserFromClerk.mockResolvedValue(undefined);

    const event = {
      type: 'user.updated',
      data: {
        id: 'user_clerk_existing',
        email_addresses: [{ id: 'email_1', email_address: 'updated@example.com' }],
        primary_email_address_id: 'email_1',
        first_name: 'Updated',
        last_name: 'Name',
        image_url: null,
      },
    };
    const body = JSON.stringify(event);
    const headers = generateSvixHeaders(body);
    const request = makeRequest(body, headers);

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockUpdateUserFromClerk).toHaveBeenCalledWith('user_clerk_existing', {
      email: 'updated@example.com',
      name: 'Updated Name',
    });
  });
});
