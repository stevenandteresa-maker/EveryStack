import { uuidv7 } from 'uuidv7';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Generate a UUIDv7 (time-ordered) per RFC 9562.
 *
 * UUIDv7 encodes a Unix timestamp in the high bits, so IDs sort
 * chronologically. This is the only ID generation strategy in EveryStack —
 * no SERIAL, BIGSERIAL, or SEQUENCE anywhere (CockroachDB readiness safeguard).
 */
export function generateUUIDv7(): string {
  return uuidv7();
}

/**
 * Validate that a string is a well-formed UUID (any version).
 * Used for input validation at system boundaries.
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}
