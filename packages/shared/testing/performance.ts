import { expect, it } from 'vitest';

/**
 * Registers a test case that asserts a query function completes within a
 * given time threshold.
 *
 * - Runs `queryFn` once as a warm-up (to account for query plan caching).
 * - Runs `queryFn` a second time and measures elapsed time.
 * - Asserts elapsed time is less than `maxMs`.
 *
 * Usage:
 * ```ts
 * describe('getRecordsByTable performance', () => {
 *   expectQueryTime(
 *     '10K records with 3 filters',
 *     () => getRecordsByTable(tenantId, tableId, { filters }),
 *     200,
 *   );
 * });
 * ```
 */
export function expectQueryTime(
  label: string,
  queryFn: () => Promise<unknown>,
  maxMs: number,
): void {
  it(`${label} completes within ${maxMs}ms`, async () => {
    // Warm-up run (query plan caching, JIT, etc.)
    await queryFn();

    const start = performance.now();
    await queryFn();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(maxMs);
  });
}
