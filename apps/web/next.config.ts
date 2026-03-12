import type { NextConfig } from 'next';
import { builtinModules } from 'node:module';
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * All Node.js built-in modules. @everystack/shared barrels transitively
 * import @sentry/node and trace-context.ts which pull in node: built-ins.
 * These are stubbed out (false) in the client webpack bundle.
 */
const NODE_BUILTINS = builtinModules.filter((m) => !m.startsWith('_'));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@everystack/shared'],
  webpack: (config, { isServer, webpack: wp }) => {
    if (!isServer) {
      // Stub bare-name imports (e.g. require('async_hooks'))
      const fallbacks: Record<string, false> = {};
      for (const mod of NODE_BUILTINS) {
        fallbacks[mod] = false;
      }
      config.resolve.fallback = { ...config.resolve.fallback, ...fallbacks };

      // Strip node: URI prefix so fallbacks above catch them.
      // resolve.alias for node:* doesn't work because webpack rejects the
      // node: scheme before the alias resolver runs. This plugin rewrites
      // `node:async_hooks` → `async_hooks` which then hits the fallback.
      config.plugins.push(
        new wp.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, '');
        }),
      );
    }
    return config;
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
});
