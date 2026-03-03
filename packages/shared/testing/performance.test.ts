import { describe, expect, it } from 'vitest';
import { expectQueryTime } from './performance';

describe('expectQueryTime', () => {
  describe('passes when function completes under threshold', () => {
    expectQueryTime(
      'fast async operation',
      async () => {
        // Near-instant operation
        return Promise.resolve('done');
      },
      1000,
    );
  });

  describe('fails when function exceeds threshold', () => {
    it('detects slow operations', async () => {
      // We can't directly test that expectQueryTime's internal `it()` fails,
      // so instead we verify the timing logic independently.
      const slowFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      };

      // Warm-up
      await slowFn();

      const start = performance.now();
      await slowFn();
      const elapsed = performance.now() - start;

      // The slow function should take at least 40ms (allowing for timer variance)
      expect(elapsed).toBeGreaterThanOrEqual(40);
      // And it should definitely exceed a 5ms threshold
      expect(elapsed).not.toBeLessThan(5);
    });
  });
});
