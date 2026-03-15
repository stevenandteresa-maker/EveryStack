import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResendEmailService } from '../resend-service';
import type { SendEmailParams } from '../resend-service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockEmailsSend = vi.fn();

vi.mock('resend', () => ({
  Resend: class MockResend {
    emails = { send: mockEmailsSend };
  },
}));

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    child: vi.fn().mockReturnValue({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResendEmailService', () => {
  let service: ResendEmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ResendEmailService('re_test_key');
  });

  it('sends email with default from address', async () => {
    mockEmailsSend.mockResolvedValue({
      data: { id: 'email-001' },
      error: null,
    });

    const params: SendEmailParams = {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    };

    const result = await service.send(params);

    expect(result).toEqual({ success: true, id: 'email-001' });
    expect(mockEmailsSend).toHaveBeenCalledWith({
      from: 'EveryStack <notifications@everystack.com>',
      to: ['user@example.com'],
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });
  });

  it('sends email with custom from address', async () => {
    mockEmailsSend.mockResolvedValue({
      data: { id: 'email-002' },
      error: null,
    });

    await service.send({
      to: 'user@example.com',
      subject: 'Custom From',
      html: '<p>Hi</p>',
      from: 'custom@example.com',
    });

    expect(mockEmailsSend.mock.calls[0]![0].from).toBe('custom@example.com');
  });

  it('handles array of recipients', async () => {
    mockEmailsSend.mockResolvedValue({
      data: { id: 'email-003' },
      error: null,
    });

    await service.send({
      to: ['a@example.com', 'b@example.com'],
      subject: 'Multi',
      html: '<p>Hi all</p>',
    });

    expect(mockEmailsSend.mock.calls[0]![0].to).toEqual([
      'a@example.com',
      'b@example.com',
    ]);
  });

  it('returns failure on Resend API error', async () => {
    mockEmailsSend.mockResolvedValue({
      data: null,
      error: { message: 'Invalid API key' },
    });

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Fail',
      html: '<p>Fail</p>',
    });

    expect(result).toEqual({ success: false });
  });

  it('returns failure on network error without throwing', async () => {
    mockEmailsSend.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Network Fail',
      html: '<p>Fail</p>',
    });

    expect(result).toEqual({ success: false });
  });

  it('throws if no API key is provided', () => {
    const original = process.env['RESEND_API_KEY'];
    delete process.env['RESEND_API_KEY'];

    try {
      expect(() => new ResendEmailService()).toThrow(
        'RESEND_API_KEY environment variable is required',
      );
    } finally {
      if (original !== undefined) {
        process.env['RESEND_API_KEY'] = original;
      }
    }
  });
});
