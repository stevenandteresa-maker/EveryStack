import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

/**
 * Public routes — accessible without a Clerk session.
 * Includes marketing pages, auth pages, webhooks, and portal routes.
 */
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
  '/portal/(.*)',
  '/design-test',
]);

// ---------------------------------------------------------------------------
// Content Security Policies
// ---------------------------------------------------------------------------

const PLATFORM_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.clerk.dev https://*.clerk.accounts.dev https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://img.clerk.com https://*.clerk.com https://files.everystack.com",
  "connect-src 'self' https://api.clerk.dev https://*.clerk.accounts.dev https://api.stripe.com wss://*.everystack.com",
  "frame-src https://js.stripe.com https://*.clerk.accounts.dev",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const PORTAL_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://files.everystack.com",
  "connect-src 'self' https://api.stripe.com wss://*.everystack.com",
  "frame-src https://js.stripe.com",
  "font-src 'self' https://fonts.gstatic.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// ---------------------------------------------------------------------------
// Security header builders (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Returns the 6 security headers for platform (non-portal) routes.
 *
 * - HSTS with preload
 * - X-Frame-Options: DENY
 * - CSP includes Clerk + Stripe script sources
 * - Permissions-Policy allows geolocation and payment for self
 */
export function getPlatformSecurityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(self)',
    'Content-Security-Policy': PLATFORM_CSP,
  };
}

/**
 * Returns the 6 security headers for portal routes.
 *
 * - HSTS without preload
 * - X-Frame-Options: SAMEORIGIN (allows embedding in same origin)
 * - CSP does NOT include Clerk, adds fonts.gstatic.com, no frame-ancestors
 * - Permissions-Policy: no geolocation or payment
 */
export function getPortalSecurityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=()',
    'Content-Security-Policy': PORTAL_CSP,
  };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const response = NextResponse.next();

  // Apply security headers based on route profile
  const url = new URL(request.url);
  const isPortal = url.pathname.startsWith('/portal/');
  const headers = isPortal
    ? getPortalSecurityHeaders()
    : getPlatformSecurityHeaders();

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  return response;
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run on API routes
    '/(api|trpc)(.*)',
  ],
};
