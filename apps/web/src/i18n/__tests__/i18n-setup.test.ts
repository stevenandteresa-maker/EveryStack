import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const messagesDir = join(__dirname, '..', '..', '..', 'messages');
const enPath = join(messagesDir, 'en.json');
const esPath = join(messagesDir, 'es.json');

function loadJson(path: string): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function getKeysDeep(
  obj: Record<string, unknown>,
  prefix = ''
): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getKeysDeep(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n locale files', () => {
  it('en.json parses as valid JSON', () => {
    expect(() => loadJson(enPath)).not.toThrow();
  });

  it('es.json parses as valid JSON', () => {
    expect(() => loadJson(esPath)).not.toThrow();
  });

  it('en.json and es.json have the same key structure', () => {
    const enKeys = getKeysDeep(loadJson(enPath));
    const esKeys = getKeysDeep(loadJson(esPath));
    expect(enKeys).toEqual(esKeys);
  });

  it('en.json has no empty string values', () => {
    const en = loadJson(enPath);
    const keys = getKeysDeep(en);
    for (const key of keys) {
      const value = key.split('.').reduce<unknown>(
        (obj, k) => (obj as Record<string, unknown>)[k],
        en
      );
      expect(value, `Key "${key}" has empty string`).not.toBe('');
    }
  });

  it('en.json contains common and shell namespaces', () => {
    const en = loadJson(enPath);
    expect(en).toHaveProperty('common');
    expect(en).toHaveProperty('shell');
  });
});
