import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----------------------------------------------------------------

// Mock Clerk middleware to pass through the callback directly
vi.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (callback: (auth: unknown, request: Request) => unknown) => {
    return async (request: Request) => {
      const auth = { protect: vi.fn() };
      return callback(auth, request);
    };
  },
  createRouteMatcher: (patterns: string[]) => {
    return (request: Request) => {
      const pathname = new URL(request.url).pathname;
      return patterns.some((pattern: string) => {
        // Convert Clerk route patterns to regex for testing
        const escaped = pattern
          .replace(/[.+^${}|[\]\\]/g, '\\$&')
          .replace(/\(\.\*\)/g, '.*');
        // eslint-disable-next-line security/detect-non-literal-regexp -- test helper with controlled input
        return new RegExp(`^${escaped}$`).test(pathname);
      });
    };
  },
}));

// Mock NextResponse.next() to return a trackable response
vi.mock('next/server', () => {
  return {
    NextResponse: {
      next: () => {
        const headersMap = new Map<string, string>();
        return {
          headers: {
            set: (k: string, v: string) => headersMap.set(k, v),
            get: (k: string) => headersMap.get(k) ?? null,
            has: (k: string) => headersMap.has(k),
          },
          _headersMap: headersMap,
        };
      },
    },
  };
});

// ---- Helpers --------------------------------------------------------------

interface MockResponse {
  headers: {
    set: (k: string, v: string) => void;
    get: (k: string) => string | null;
    has: (k: string) => boolean;
  };
  _headersMap: Map<string, string>;
}

function createRequest(path: string): Request {
  return new Request(`http://localhost:3000${path}`);
}

// ---- Tests: Header value functions ----------------------------------------

describe('getPlatformSecurityHeaders', () => {
  it('returns all 6 security headers', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const headers = getPlatformSecurityHeaders();

    expect(Object.keys(headers)).toHaveLength(6);
    expect(headers).toHaveProperty('Strict-Transport-Security');
    expect(headers).toHaveProperty('X-Content-Type-Options');
    expect(headers).toHaveProperty('X-Frame-Options');
    expect(headers).toHaveProperty('Referrer-Policy');
    expect(headers).toHaveProperty('Permissions-Policy');
    expect(headers).toHaveProperty('Content-Security-Policy');
  });

  it('includes preload in HSTS', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const headers = getPlatformSecurityHeaders();

    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains; preload',
    );
  });

  it('sets X-Frame-Options to DENY', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    expect(getPlatformSecurityHeaders()['X-Frame-Options']).toBe('DENY');
  });

  it('includes Clerk and Stripe in CSP script-src', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const csp = getPlatformSecurityHeaders()['Content-Security-Policy'];

    expect(csp).toContain('https://js.clerk.dev');
    expect(csp).toContain('https://js.stripe.com');
  });

  it('includes Clerk in CSP img-src', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const csp = getPlatformSecurityHeaders()['Content-Security-Policy'];

    expect(csp).toContain('https://img.clerk.com');
  });

  it('includes Clerk in CSP connect-src', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const csp = getPlatformSecurityHeaders()['Content-Security-Policy'];

    expect(csp).toContain('https://api.clerk.dev');
  });

  it('includes frame-ancestors none in platform CSP', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const csp = getPlatformSecurityHeaders()['Content-Security-Policy'];

    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('includes geolocation and payment in Permissions-Policy', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    const pp = getPlatformSecurityHeaders()['Permissions-Policy'];

    expect(pp).toContain('geolocation=(self)');
    expect(pp).toContain('payment=(self)');
  });

  it('sets nosniff for X-Content-Type-Options', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    expect(getPlatformSecurityHeaders()['X-Content-Type-Options']).toBe('nosniff');
  });

  it('sets strict-origin-when-cross-origin for Referrer-Policy', async () => {
    const { getPlatformSecurityHeaders } = await import('./middleware');
    expect(getPlatformSecurityHeaders()['Referrer-Policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });
});

describe('getPortalSecurityHeaders', () => {
  it('returns all 6 security headers', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const headers = getPortalSecurityHeaders();

    expect(Object.keys(headers)).toHaveLength(6);
  });

  it('does NOT include preload in HSTS', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const hsts = getPortalSecurityHeaders()['Strict-Transport-Security'];

    expect(hsts).toBe('max-age=63072000; includeSubDomains');
    expect(hsts).not.toContain('preload');
  });

  it('sets X-Frame-Options to SAMEORIGIN', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    expect(getPortalSecurityHeaders()['X-Frame-Options']).toBe('SAMEORIGIN');
  });

  it('does NOT include Clerk in CSP script-src', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const csp = getPortalSecurityHeaders()['Content-Security-Policy'];

    expect(csp).not.toContain('js.clerk.dev');
    expect(csp).toContain('https://js.stripe.com');
  });

  it('does NOT include Clerk in CSP img-src or connect-src', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const csp = getPortalSecurityHeaders()['Content-Security-Policy'];

    expect(csp).not.toContain('img.clerk.com');
    expect(csp).not.toContain('api.clerk.dev');
  });

  it('includes fonts.gstatic.com in font-src', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const csp = getPortalSecurityHeaders()['Content-Security-Policy'];

    expect(csp).toContain('https://fonts.gstatic.com');
  });

  it('does NOT include frame-ancestors in portal CSP', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const csp = getPortalSecurityHeaders()['Content-Security-Policy'];

    expect(csp).not.toContain('frame-ancestors');
  });

  it('does NOT include geolocation or payment in Permissions-Policy', async () => {
    const { getPortalSecurityHeaders } = await import('./middleware');
    const pp = getPortalSecurityHeaders()['Permissions-Policy'];

    expect(pp).not.toContain('geolocation');
    expect(pp).not.toContain('payment');
    expect(pp).toBe('camera=(), microphone=()');
  });
});

// ---- Tests: Middleware integration ----------------------------------------

describe('middleware integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies platform headers to /w/* routes', async () => {
    const middleware = (await import('./middleware')).default as unknown as (
      req: Request,
    ) => Promise<MockResponse>;
    const response = await middleware(createRequest('/w/test-workspace'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Strict-Transport-Security')).toContain('preload');
    expect(response.headers.get('Content-Security-Policy')).toContain('js.clerk.dev');
  });

  it('applies platform headers to /api/* routes', async () => {
    const middleware = (await import('./middleware')).default as unknown as (
      req: Request,
    ) => Promise<MockResponse>;
    const response = await middleware(createRequest('/api/v1/records'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('applies portal headers to /portal/* routes', async () => {
    const middleware = (await import('./middleware')).default as unknown as (
      req: Request,
    ) => Promise<MockResponse>;
    const response = await middleware(createRequest('/portal/abc-123'));

    expect(response.headers.get('X-Frame-Options')).toBe('SAMEORIGIN');
    expect(response.headers.get('Strict-Transport-Security')).not.toContain('preload');
    expect(response.headers.get('Content-Security-Policy')).not.toContain('js.clerk.dev');
    expect(response.headers.get('Content-Security-Policy')).toContain('fonts.gstatic.com');
  });

  it('applies platform headers to root route', async () => {
    const middleware = (await import('./middleware')).default as unknown as (
      req: Request,
    ) => Promise<MockResponse>;
    const response = await middleware(createRequest('/'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('applies platform headers to sign-in routes', async () => {
    const middleware = (await import('./middleware')).default as unknown as (
      req: Request,
    ) => Promise<MockResponse>;
    const response = await middleware(createRequest('/sign-in'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Content-Security-Policy')).toContain('js.clerk.dev');
  });

  it('applies platform headers to webhook routes', async () => {
    const middleware = (await import('./middleware')).default as unknown as (
      req: Request,
    ) => Promise<MockResponse>;
    const response = await middleware(createRequest('/api/webhooks/clerk'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });
});
