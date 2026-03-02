// ---------------------------------------------------------------------------
// Webhook signature verification utilities.
// Provides Clerk-specific (Svix) and generic HMAC verification.
// ---------------------------------------------------------------------------

import { Webhook } from 'svix';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Svix header shape required for Clerk webhook verification.
 */
export interface SvixHeaders {
  'svix-id': string;
  'svix-timestamp': string;
  'svix-signature': string;
}

/**
 * Verifies a Clerk webhook payload using Svix HMAC verification.
 *
 * Returns the parsed event data if the signature is valid, or `null`
 * if verification fails (tampered payload, expired timestamp, etc.).
 *
 * @param payload - Raw request body as a string
 * @param headers - Svix headers (svix-id, svix-timestamp, svix-signature)
 * @param secret  - Clerk webhook signing secret (whsec_...)
 * @returns Parsed event data on success, null on failure
 */
export function verifyClerkWebhook<T = unknown>(
  payload: string,
  headers: SvixHeaders,
  secret: string,
): T | null {
  try {
    const wh = new Webhook(secret);
    return wh.verify(payload, headers) as T;
  } catch {
    return null;
  }
}

/**
 * Verifies an HMAC signature for generic webhook payloads.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 * Supports any algorithm available in Node.js crypto (default: sha256).
 *
 * @param payload   - Raw payload string
 * @param signature - Expected signature (hex-encoded)
 * @param secret    - HMAC secret key
 * @param algorithm - Hash algorithm (default: 'sha256')
 * @returns true if signature is valid, false otherwise
 */
export function verifyHmacSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm = 'sha256',
): boolean {
  try {
    const computed = createHmac(algorithm, secret)
      .update(payload)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'hex');
    const computedBuffer = Buffer.from(computed, 'hex');

    if (sigBuffer.length !== computedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, computedBuffer);
  } catch {
    return false;
  }
}
