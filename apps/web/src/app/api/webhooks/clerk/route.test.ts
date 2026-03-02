import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ---- Mocks ----------------------------------------------------------------

const mockCreateUserWithTenant = vi.fn().mockResolvedValue({
  userId: 'user-id-1',
  tenantId: 'tenant-id-1',
  workspaceId: 'workspace-id-1',
});
const mockUpdateUserFromClerk = vi.fn().mockResolvedValue(undefined);

vi.mock('@everystack/shared/db', () => ({
  createUserWithTenant: (...args: unknown[]) => mockCreateUserWithTenant(...args),
  updateUserFromClerk: (...args: unknown[]) => mockUpdateUserFromClerk(...args),
}));

const mockVerifyClerkWebhook = vi.fn();
vi.mock('@everystack/shared/webhooks', () => ({
  verifyClerkWebhook: (...args: unknown[]) => mockVerifyClerkWebhook(...args),
}));

const mockLoggerWarn = vi.fn();
vi.mock('@everystack/shared/logging', () => ({
  webLogger: { warn: mockLoggerWarn },
}));

const mockCaptureMessage = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockCaptureMessage,
}));

// ---- Helpers ---------------------------------------------------------------

function makeClerkUserData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user_clerk_123',
    email_addresses: [
      { id: 'email_1', email_address: 'john@example.com' },
    ],
    primary_email_address_id: 'email_1',
    first_name: 'John',
    last_name: 'Doe',
    image_url: null,
    ...overrides,
  };
}

function makeRequest(body: string, headers: Record<string, string> = {}): NextRequest {
  const defaultHeaders: Record<string, string> = {
    'svix-id': 'msg_test123',
    'svix-timestamp': '1234567890',
    'svix-signature': 'v1,valid_sig',
    'content-type': 'application/json',
    ...headers,
  };

  return {
    text: () => Promise.resolve(body),
    headers: {
      get: (name: string) => defaultHeaders[name] ?? null,
    },
  } as unknown as NextRequest;
}

// ---- Tests -----------------------------------------------------------------

describe('POST /api/webhooks/clerk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  it('returns 401 when svix headers are missing', async () => {
    const { POST } = await import('./route');
    const request = makeRequest('{}', {
      'svix-id': '',
      'svix-timestamp': '',
      'svix-signature': '',
    });
    // Override headers.get to return null for svix headers
    (request as unknown as { headers: { get: (n: string) => string | null } }).headers.get = (name: string) => {
      if (name.startsWith('svix-')) return null;
      return 'application/json';
    };

    const response = await POST(request);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('Missing webhook signature headers');
  });

  it('logs warning and reports to Sentry when headers are missing', async () => {
    const { POST } = await import('./route');
    const request = makeRequest('{}');
    (request as unknown as { headers: { get: (n: string) => string | null } }).headers.get = (name: string) => {
      if (name.startsWith('svix-')) return null;
      return 'application/json';
    };

    await POST(request);

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { reason: 'missing_headers' },
      'Clerk webhook signature verification failed',
    );
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Clerk webhook: missing signature headers',
      'warning',
    );
  });

  it('returns 401 when signature verification fails', async () => {
    const { POST } = await import('./route');
    mockVerifyClerkWebhook.mockReturnValue(null);

    const request = makeRequest('{}');
    const response = await POST(request);

    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
    expect(json.error.message).toContain('Invalid webhook signature');
  });

  it('logs warning and reports to Sentry when signature is invalid', async () => {
    const { POST } = await import('./route');
    mockVerifyClerkWebhook.mockReturnValue(null);

    await POST(makeRequest('{}'));

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      { reason: 'invalid_signature' },
      'Clerk webhook signature verification failed',
    );
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'Clerk webhook: invalid signature',
      'warning',
    );
  });

  it('returns 500 when webhook secret is not configured', async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const { POST } = await import('./route');

    const request = makeRequest('{}');
    const response = await POST(request);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error.code).toBe('INTERNAL_ERROR');
  });

  it('handles user.created event', async () => {
    const { POST } = await import('./route');
    const eventData = makeClerkUserData();
    const event = { type: 'user.created', data: eventData };

    mockVerifyClerkWebhook.mockReturnValue(event);

    const request = makeRequest(JSON.stringify(event));
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(mockCreateUserWithTenant).toHaveBeenCalledWith({
      clerkId: 'user_clerk_123',
      email: 'john@example.com',
      name: 'John Doe',
    });
  });

  it('handles user.created with name fallback to email prefix', async () => {
    const { POST } = await import('./route');
    const eventData = makeClerkUserData({
      first_name: null,
      last_name: null,
    });
    const event = { type: 'user.created', data: eventData };

    mockVerifyClerkWebhook.mockReturnValue(event);

    const request = makeRequest(JSON.stringify(event));
    await POST(request);

    expect(mockCreateUserWithTenant).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'john' }),
    );
  });

  it('handles user.updated event', async () => {
    const { POST } = await import('./route');
    const eventData = makeClerkUserData({
      first_name: 'Jane',
      last_name: 'Smith',
      email_addresses: [
        { id: 'email_2', email_address: 'jane@example.com' },
      ],
      primary_email_address_id: 'email_2',
    });
    const event = { type: 'user.updated', data: eventData };

    mockVerifyClerkWebhook.mockReturnValue(event);

    const request = makeRequest(JSON.stringify(event));
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockUpdateUserFromClerk).toHaveBeenCalledWith(
      'user_clerk_123',
      { email: 'jane@example.com', name: 'Jane Smith' },
    );
  });

  it('returns 200 for unrecognized event types', async () => {
    const { POST } = await import('./route');
    const event = { type: 'session.created', data: {} };

    mockVerifyClerkWebhook.mockReturnValue(event);

    const request = makeRequest(JSON.stringify(event));
    const response = await POST(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.received).toBe(true);
  });

  it('passes correct arguments to verifyClerkWebhook', async () => {
    const { POST } = await import('./route');
    const event = { type: 'user.created', data: makeClerkUserData() };
    mockVerifyClerkWebhook.mockReturnValue(event);

    const body = JSON.stringify(event);
    const request = makeRequest(body);
    await POST(request);

    expect(mockVerifyClerkWebhook).toHaveBeenCalledWith(
      body,
      {
        'svix-id': 'msg_test123',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid_sig',
      },
      'whsec_test_secret',
    );
  });
});
