import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHmac } from 'node:crypto';

// ---- Mocks ----------------------------------------------------------------

const mockVerify = vi.fn();
vi.mock('svix', () => {
  return {
    Webhook: class MockWebhook {
      verify = mockVerify;
    },
  };
});

// ---- Import after mocks ---------------------------------------------------

import { verifyClerkWebhook, verifyHmacSignature } from './verify-signature';

// ---- verifyClerkWebhook ---------------------------------------------------

describe('verifyClerkWebhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed event data for valid signature', () => {
    const event = { type: 'user.created', data: { id: 'user_123' } };
    mockVerify.mockReturnValue(event);

    const result = verifyClerkWebhook(
      JSON.stringify(event),
      {
        'svix-id': 'msg_test',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,valid_sig',
      },
      'whsec_test_secret',
    );

    expect(result).toEqual(event);
    expect(result).toBeTruthy();
  });

  it('returns null for tampered payload', () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const result = verifyClerkWebhook(
      '{"tampered": true}',
      {
        'svix-id': 'msg_test',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,bad_sig',
      },
      'whsec_test_secret',
    );

    expect(result).toBeNull();
  });

  it('returns null for expired timestamp', () => {
    mockVerify.mockImplementation(() => {
      throw new Error('Message timestamp too old');
    });

    const result = verifyClerkWebhook(
      '{}',
      {
        'svix-id': 'msg_test',
        'svix-timestamp': '1000000000',
        'svix-signature': 'v1,sig',
      },
      'whsec_test_secret',
    );

    expect(result).toBeNull();
  });

  it('passes headers correctly to Svix Webhook.verify()', () => {
    const event = { type: 'test' };
    mockVerify.mockReturnValue(event);

    const headers = {
      'svix-id': 'msg_abc',
      'svix-timestamp': '9999999999',
      'svix-signature': 'v1,sig_xyz',
    };

    verifyClerkWebhook('payload', headers, 'whsec_secret');

    expect(mockVerify).toHaveBeenCalledWith('payload', headers);
  });

  it('supports generic type parameter', () => {
    interface MyEvent {
      type: string;
      data: { id: string };
    }
    const event = { type: 'custom', data: { id: '123' } };
    mockVerify.mockReturnValue(event);

    const result = verifyClerkWebhook<MyEvent>(
      '{}',
      {
        'svix-id': 'msg_test',
        'svix-timestamp': '1234567890',
        'svix-signature': 'v1,sig',
      },
      'whsec_test',
    );

    expect(result?.type).toBe('custom');
    expect(result?.data.id).toBe('123');
  });
});

// ---- verifyHmacSignature --------------------------------------------------

describe('verifyHmacSignature', () => {
  const secret = 'test-secret-key';
  const payload = '{"event": "test", "data": {"id": 1}}';

  function computeHmac(data: string, key: string, algo = 'sha256'): string {
    return createHmac(algo, key).update(data).digest('hex');
  }

  it('returns true for valid SHA-256 signature', () => {
    const signature = computeHmac(payload, secret);
    expect(verifyHmacSignature(payload, signature, secret)).toBe(true);
  });

  it('returns false for tampered payload', () => {
    const signature = computeHmac(payload, secret);
    expect(verifyHmacSignature('tampered', signature, secret)).toBe(false);
  });

  it('returns false for wrong secret', () => {
    const signature = computeHmac(payload, secret);
    expect(verifyHmacSignature(payload, signature, 'wrong-secret')).toBe(false);
  });

  it('returns false for invalid hex signature', () => {
    expect(verifyHmacSignature(payload, 'not-hex!!!', secret)).toBe(false);
  });

  it('returns false for signature with wrong length', () => {
    const signature = computeHmac(payload, secret);
    const truncated = signature.slice(0, 10);
    expect(verifyHmacSignature(payload, truncated, secret)).toBe(false);
  });

  it('supports custom algorithm (sha512)', () => {
    const signature = computeHmac(payload, secret, 'sha512');
    expect(verifyHmacSignature(payload, signature, secret, 'sha512')).toBe(true);
  });

  it('returns false when custom algorithm mismatches', () => {
    const sha256Sig = computeHmac(payload, secret, 'sha256');
    expect(verifyHmacSignature(payload, sha256Sig, secret, 'sha512')).toBe(false);
  });

  it('defaults to sha256 when algorithm is not specified', () => {
    const sha256Sig = computeHmac(payload, secret, 'sha256');
    expect(verifyHmacSignature(payload, sha256Sig, secret)).toBe(true);
  });

  it('returns false for empty signature', () => {
    expect(verifyHmacSignature(payload, '', secret)).toBe(false);
  });

  it('handles empty payload', () => {
    const signature = computeHmac('', secret);
    expect(verifyHmacSignature('', signature, secret)).toBe(true);
  });
});
