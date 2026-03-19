import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GotenbergClient } from '../gotenberg-client';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Suppress logger output in tests
vi.mock('@everystack/shared/logging', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GOTENBERG_URL = 'http://gotenberg:3000';
const EXPECTED_ENDPOINT = `${GOTENBERG_URL}/forms/chromium/convert/html`;

function createPDFBuffer(): ArrayBuffer {
  // Minimal PDF-like content for testing
  const pdfBytes = new TextEncoder().encode('%PDF-1.4 test content');
  return pdfBytes.buffer;
}

function mockSuccessResponse(): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(createPDFBuffer()),
  });
}

function mockErrorResponse(status: number, body: string): void {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GotenbergClient', () => {
  let client: GotenbergClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GotenbergClient(GOTENBERG_URL);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('uses provided base URL', () => {
      const c = new GotenbergClient('http://custom:9090');
      mockSuccessResponse();

      void c.convertHTMLToPDF('<html></html>');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom:9090/forms/chromium/convert/html',
        expect.any(Object),
      );
    });

    it('strips trailing slashes from base URL', () => {
      const c = new GotenbergClient('http://gotenberg:3000///');
      mockSuccessResponse();

      void c.convertHTMLToPDF('<html></html>');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://gotenberg:3000/forms/chromium/convert/html',
        expect.any(Object),
      );
    });

    it('falls back to GOTENBERG_URL env var', () => {
      process.env.GOTENBERG_URL = 'http://env-gotenberg:3000';
      try {
        const c = new GotenbergClient();
        mockSuccessResponse();

        void c.convertHTMLToPDF('<html></html>');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://env-gotenberg:3000/forms/chromium/convert/html',
          expect.any(Object),
        );
      } finally {
        delete process.env.GOTENBERG_URL;
      }
    });

    it('throws when no base URL and GOTENBERG_URL is unset', () => {
      delete process.env.GOTENBERG_URL;
      expect(() => new GotenbergClient()).toThrow('GOTENBERG_URL');
    });
  });

  describe('convertHTMLToPDF', () => {
    it('sends a POST to /forms/chromium/convert/html', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html><body>Hello</body></html>');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toBe(EXPECTED_ENDPOINT);
      expect(init.method).toBe('POST');
    });

    it('sends HTML as FormData with file named index.html', async () => {
      mockSuccessResponse();

      const html = '<html><body>Test</body></html>';
      await client.convertHTMLToPDF(html);

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData).toBeInstanceOf(FormData);

      const file = formData.get('files') as File;
      expect(file).toBeTruthy();
      expect(file.name).toBe('index.html');
      expect(file.type).toBe('text/html');

      const text = await file.text();
      expect(text).toBe(html);
    });

    it('returns a Buffer with the PDF content', async () => {
      mockSuccessResponse();

      const result = await client.convertHTMLToPDF('<html></html>');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.toString()).toContain('%PDF-1.4');
    });

    it('appends paperWidth and paperHeight when provided', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>', {
        paperWidth: 8.27,
        paperHeight: 11.69,
      });

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData.get('paperWidth')).toBe('8.27');
      expect(formData.get('paperHeight')).toBe('11.69');
    });

    it('appends margin options when provided', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>', {
        marginTop: 0.5,
        marginBottom: 0.5,
        marginLeft: 0.75,
        marginRight: 0.75,
      });

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData.get('marginTop')).toBe('0.5');
      expect(formData.get('marginBottom')).toBe('0.5');
      expect(formData.get('marginLeft')).toBe('0.75');
      expect(formData.get('marginRight')).toBe('0.75');
    });

    it('appends printBackground when explicitly set', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>', {
        printBackground: true,
      });

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData.get('printBackground')).toBe('true');
    });

    it('appends landscape when set to true', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>', { landscape: true });

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData.get('landscape')).toBe('true');
    });

    it('does not append landscape when falsy', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>', { landscape: false });

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData.get('landscape')).toBeNull();
    });

    it('does not append optional fields when omitted', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>');

      const [, init] = mockFetch.mock.calls[0]!;
      const formData = init.body as FormData;
      expect(formData.get('paperWidth')).toBeNull();
      expect(formData.get('paperHeight')).toBeNull();
      expect(formData.get('marginTop')).toBeNull();
      expect(formData.get('marginBottom')).toBeNull();
      expect(formData.get('marginLeft')).toBeNull();
      expect(formData.get('marginRight')).toBeNull();
      expect(formData.get('printBackground')).toBeNull();
      expect(formData.get('landscape')).toBeNull();
    });

    it('throws on HTTP error response', async () => {
      mockErrorResponse(500, 'Internal Server Error');

      await expect(
        client.convertHTMLToPDF('<html></html>'),
      ).rejects.toThrow('Gotenberg returned HTTP 500: Internal Server Error');
    });

    it('throws on 400 bad request', async () => {
      mockErrorResponse(400, 'Bad Request: missing file');

      await expect(
        client.convertHTMLToPDF('<html></html>'),
      ).rejects.toThrow('Gotenberg returned HTTP 400');
    });

    it('throws on timeout', async () => {
      // Simulate a request that never resolves before abort
      mockFetch.mockImplementationOnce(
        (_url: string, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
              const err = new DOMException('The operation was aborted.', 'AbortError');
              reject(err);
            });
          }),
      );

      await expect(
        client.convertHTMLToPDF('<html></html>', { timeoutMs: 50 }),
      ).rejects.toThrow('Gotenberg request timed out after 50ms');
    }, 10_000);

    it('includes AbortSignal in the fetch call', async () => {
      mockSuccessResponse();

      await client.convertHTMLToPDF('<html></html>');

      const [, init] = mockFetch.mock.calls[0]!;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('re-throws non-abort fetch errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(
        client.convertHTMLToPDF('<html></html>'),
      ).rejects.toThrow('Network failure');
    });
  });
});
