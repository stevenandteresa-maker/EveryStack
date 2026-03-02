import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['db/**', 'ai/**', 'sync/**'],
      thresholds: {
        'db/': { lines: 90, branches: 85 },
        'ai/': { lines: 80, branches: 75 },
        'sync/': { lines: 90, branches: 85 },
      },
    },
    testTimeout: 10_000,
    pool: 'forks',
  },
});
