import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { CrossLinkFieldValue } from '../cross-link-types';
import { fieldTypeRegistry } from '../field-registry';
import type { PlatformFieldConfig } from '../types';

// Import to trigger auto-registration
import '../cross-link-field-type';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const dummyFieldConfig: PlatformFieldConfig = {
  externalFieldId: randomUUID(),
  name: 'Linked Projects',
  platformFieldType: 'linked_record',
};

function validCrossLinkFieldValue(): CrossLinkFieldValue {
  return {
    type: 'cross_link',
    value: {
      linked_records: [
        {
          record_id: randomUUID(),
          table_id: randomUUID(),
          display_value: 'Acme Corp',
          _display_updated_at: '2026-03-01T10:00:00Z',
        },
      ],
      cross_link_id: randomUUID(),
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('cross-link-field-type registration', () => {
  it('registers linked_record for canonical platform', () => {
    expect(fieldTypeRegistry.has('canonical', 'linked_record')).toBe(true);
  });

  it('returns a FieldTransform with expected properties', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    expect(transform.isLossless).toBe(true);
    expect(transform.supportedOperations).toContain('read');
    expect(transform.supportedOperations).toContain('write');
  });
});

describe('canonical linked_record toCanonical', () => {
  it('passes through valid CrossLinkFieldValue', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const input = validCrossLinkFieldValue();
    const result = transform.toCanonical(input, dummyFieldConfig);
    expect(result).toEqual(input);
  });

  it('passes through value with empty linked_records array', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const input: CrossLinkFieldValue = {
      type: 'cross_link',
      value: {
        linked_records: [],
        cross_link_id: randomUUID(),
      },
    };
    const result = transform.toCanonical(input, dummyFieldConfig);
    expect(result).toEqual(input);
  });

  it('returns empty linked_record for null input', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const result = transform.toCanonical(null, dummyFieldConfig);
    expect(result).toEqual({ type: 'linked_record', value: [] });
  });

  it('returns empty linked_record for undefined input', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const result = transform.toCanonical(undefined, dummyFieldConfig);
    expect(result).toEqual({ type: 'linked_record', value: [] });
  });

  it('returns empty linked_record for invalid shape (missing type)', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const result = transform.toCanonical({ value: { linked_records: [], cross_link_id: 'x' } }, dummyFieldConfig);
    expect(result).toEqual({ type: 'linked_record', value: [] });
  });

  it('returns empty linked_record for wrong type discriminant', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const result = transform.toCanonical({ type: 'text', value: 'hello' }, dummyFieldConfig);
    expect(result).toEqual({ type: 'linked_record', value: [] });
  });

  it('returns empty linked_record for missing cross_link_id', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const result = transform.toCanonical(
      { type: 'cross_link', value: { linked_records: [] } },
      dummyFieldConfig,
    );
    expect(result).toEqual({ type: 'linked_record', value: [] });
  });
});

describe('canonical linked_record fromCanonical', () => {
  it('passes through canonical value as-is', () => {
    const transform = fieldTypeRegistry.get('canonical', 'linked_record');
    const input = validCrossLinkFieldValue();
    const result = transform.fromCanonical(input as never, dummyFieldConfig);
    expect(result).toEqual(input);
  });
});
