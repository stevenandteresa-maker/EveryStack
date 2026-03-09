import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/shared/vitest.config.ts',
      'apps/web/vitest.config.ts',
      'apps/worker/vitest.config.ts',
      'apps/realtime/vitest.config.ts',
    ],
  },
});
