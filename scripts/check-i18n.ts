/**
 * i18n completeness check (stub)
 *
 * Scans apps/web/src/**\/*.tsx for hardcoded English strings.
 * Currently a stub that always passes — will be replaced with
 * a real scanner when the i18n framework is wired up.
 *
 * Wired to: pnpm turbo check:i18n
 */

import { readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __scriptDir = dirname(fileURLToPath(import.meta.url));
const WEB_SRC = resolve(__scriptDir, '..', 'apps', 'web', 'src');

async function main() {
  const files: string[] = [];
  const entries = await readdir(WEB_SRC, { recursive: true });
  for (const entry of entries) {
    if (typeof entry === 'string' && entry.endsWith('.tsx')) {
      files.push(entry);
    }
  }

  // TODO [Phase 2]: Replace stub with real hardcoded-string detection
  // eslint-disable-next-line no-console
  console.log(`[check-i18n] Scanned ${files.length} .tsx file(s) in apps/web/src — stub pass.`);
  process.exit(0);
}

main();
