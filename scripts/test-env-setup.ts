/**
 * Vitest globalSetup — fast-fail with clear messages when test services aren't running.
 *
 * This runs ONCE before any test file. If Docker services are down,
 * it fails immediately with actionable instructions instead of letting
 * tests produce cryptic ECONNREFUSED errors.
 *
 * Used via `globalSetup` in vitest config files that need database/Redis access.
 */

import net from 'net';

interface ServiceCheck {
  name: string;
  host: string;
  port: number;
}

const SERVICES: ServiceCheck[] = [
  {
    name: 'PostgreSQL',
    host: 'localhost',
    port: parseInt(process.env.TEST_POSTGRES_PORT ?? '5434', 10),
  },
  {
    name: 'PgBouncer',
    host: 'localhost',
    port: parseInt(process.env.TEST_PGBOUNCER_PORT ?? '6433', 10),
  },
  {
    name: 'Redis',
    host: 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT ?? '6380', 10),
  },
];

function checkPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

export async function setup(): Promise<void> {
  // Skip service checks for unit-test-only runs
  if (process.env.SKIP_SERVICE_CHECK === 'true') {
    return;
  }

  // In CI, services are expected to be running via the workflow
  if (process.env.CI === 'true') {
    return;
  }

  const results = await Promise.all(
    SERVICES.map(async (svc) => ({
      ...svc,
      healthy: await checkPort(svc.host, svc.port),
    }))
  );

  const down = results.filter((r) => !r.healthy);

  if (down.length > 0) {
    const lines = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║  TEST SERVICES NOT RUNNING                                  ║',
      '╚══════════════════════════════════════════════════════════════╝',
      '',
      'The following services are not responding:',
      '',
      ...down.map((d) => `  ✗ ${d.name} (port ${d.port})`),
      '',
      'Start them with:',
      '',
      '  pnpm test:services:up',
      '',
      'Then re-run your tests.',
      '',
      'To run only unit tests (no Docker needed):',
      '',
      '  pnpm turbo test -- --testPathIgnorePatterns=integration',
      '',
    ];

    // eslint-disable-next-line no-console
    console.error(lines.join('\n'));
    process.exit(1);
  }
}
