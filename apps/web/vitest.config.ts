import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', '__tests__/**/*.test.ts'],
    exclude: ['e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/data/**', 'src/actions/**', 'src/lib/**'],
      thresholds: {
        'src/data/': { lines: 95, branches: 90 },
        'src/actions/': { lines: 90, branches: 85 },
      },
    },
    testTimeout: 10_000,
    hookTimeout: 30_000,
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@everystack/db': path.resolve(__dirname, '../../packages/shared/db'),
    },
  },
});
