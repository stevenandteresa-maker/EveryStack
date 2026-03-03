/**
 * Mock UUID Sequence Helper
 *
 * Generates a sequence of deterministic UUIDv7-format strings for use in
 * unit tests that mock `generateUUIDv7`. Avoids hardcoding UUID arrays
 * across test files.
 *
 * The generated UUIDs follow the UUIDv7 format (version nibble = 7,
 * variant bits = 10xx) but use sequential counters for predictability.
 */

/**
 * Creates an array of deterministic UUIDv7-format strings.
 *
 * @param count - Number of UUIDs to generate
 * @param seed - Optional numeric seed offset (default 0)
 * @returns Array of deterministic UUID strings
 *
 * @example
 * ```ts
 * const uuids = createMockUUIDs(4);
 * // ['01900000-0000-7000-8000-000000000001', '01900000-0000-7000-8000-000000000002', ...]
 *
 * let index = 0;
 * vi.mock('../uuid', () => ({
 *   generateUUIDv7: () => uuids[index++] ?? 'uuid-fallback',
 * }));
 * ```
 */
export function createMockUUIDs(count: number, seed = 0): string[] {
  return Array.from({ length: count }, (_, i) => {
    const n = seed + i + 1;
    const hex = n.toString(16).padStart(12, '0');
    return `01900000-0000-7000-8000-${hex}`;
  });
}
