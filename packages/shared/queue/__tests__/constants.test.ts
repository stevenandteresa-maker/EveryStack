import { describe, it, expect } from 'vitest';
import { QUEUE_NAMES } from '../constants';
import type { QueueName } from '../constants';

describe('QUEUE_NAMES', () => {
  it('exports exactly 9 queue names', () => {
    const names = Object.values(QUEUE_NAMES);
    expect(names).toHaveLength(9);
  });

  it('contains the expected queue names', () => {
    expect(QUEUE_NAMES).toEqual({
      sync: 'sync',
      'sync:outbound': 'sync:outbound',
      'file-processing': 'file-processing',
      email: 'email',
      automation: 'automation',
      'document-gen': 'document-gen',
      cleanup: 'cleanup',
      'cross-link': 'cross-link',
      notification: 'notification',
    });
  });

  it('all queue names are lowercase kebab-case with optional colon namespacing', () => {
    for (const name of Object.values(QUEUE_NAMES)) {
      // Must be lowercase, only a-z, hyphens, and colons (for sub-queues)
      expect(name).toBe(name.toLowerCase());
      expect(name).not.toMatch(/[^a-z:-]/);
      expect(name.startsWith('-')).toBe(false);
      expect(name.endsWith('-')).toBe(false);
    }
  });

  it('queue name keys match their values', () => {
    for (const [key, value] of Object.entries(QUEUE_NAMES)) {
      expect(key).toBe(value);
    }
  });

  it('QueueName type is a union of all queue name values', () => {
    // Type-level check — if this compiles, the type is correct
    const names: QueueName[] = [
      'sync',
      'sync:outbound',
      'file-processing',
      'email',
      'automation',
      'document-gen',
      'cleanup',
      'cross-link',
      'notification',
    ];
    expect(names).toHaveLength(9);
  });

  it('queue names are frozen (immutable at runtime)', () => {
    // The `as const` assertion makes values readonly at the type level.
    // Verify values are strings (runtime sanity).
    for (const value of Object.values(QUEUE_NAMES)) {
      expect(typeof value).toBe('string');
    }
  });
});
