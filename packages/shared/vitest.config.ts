import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgres://everystack_test:test_password@localhost:6433/everystack_test',
      DATABASE_READ_URL:
        process.env.DATABASE_READ_URL ??
        process.env.DATABASE_URL ??
        'postgres://everystack_test:test_password@localhost:6433/everystack_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['db/**', 'ai/**', 'sync/**', 'auth/**'],
      exclude: ['db/migrations/**', '**/*.sql'],
      thresholds: {
        'db/': { lines: 90, branches: 85 },
        'ai/': { lines: 80, branches: 75 },
        'sync/': { lines: 90, branches: 85 },
        'auth/permissions/': { lines: 90, branches: 85 },
      },
    },
    globalSetup: ['../../scripts/test-env-setup.ts'],
    testTimeout: 10_000,
    pool: 'forks',
  },
});
