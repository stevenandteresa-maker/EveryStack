import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/jobs/**'],
      thresholds: {
        'src/jobs/': { lines: 85, branches: 80 },
      },
    },
    testTimeout: 10_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
});
