import { describe, it, expect, beforeEach } from 'vitest';
import { FieldTypeRegistry, fieldTypeRegistry } from '../field-registry';
import type { FieldTransform, PlatformFieldConfig } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTransform(overrides?: Partial<FieldTransform>): FieldTransform {
  return {
    toCanonical: (_value: unknown, _config: PlatformFieldConfig) => ({
      type: 'text' as const,
      value: 'mock',
    }),
    fromCanonical: () => 'mock',
    isLossless: true,
    supportedOperations: ['read', 'write', 'filter', 'sort'],
    ...overrides,
  };
}

const mockFieldConfig: PlatformFieldConfig = {
  externalFieldId: 'fld_ext_123',
  name: 'Test Field',
  platformFieldType: 'singleLineText',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FieldTypeRegistry', () => {
  let registry: FieldTypeRegistry;

  beforeEach(() => {
    registry = new FieldTypeRegistry();
  });

  describe('register() and get()', () => {
    it('stores and retrieves a transform by platform and field type', () => {
      const transform = createMockTransform();
      registry.register('airtable', 'singleLineText', transform);

      const result = registry.get('airtable', 'singleLineText');
      expect(result).toBe(transform);
    });

    it('overwrites a previously registered transform for the same key', () => {
      const first = createMockTransform({ isLossless: true });
      const second = createMockTransform({ isLossless: false });

      registry.register('airtable', 'singleLineText', first);
      registry.register('airtable', 'singleLineText', second);

      const result = registry.get('airtable', 'singleLineText');
      expect(result).toBe(second);
      expect(result.isLossless).toBe(false);
    });

    it('keeps separate entries for different platforms with the same field type', () => {
      const airtableTransform = createMockTransform({ isLossless: true });
      const notionTransform = createMockTransform({ isLossless: false });

      registry.register('airtable', 'text', airtableTransform);
      registry.register('notion', 'text', notionTransform);

      expect(registry.get('airtable', 'text')).toBe(airtableTransform);
      expect(registry.get('notion', 'text')).toBe(notionTransform);
    });

    it('keeps separate entries for same platform with different field types', () => {
      const textTransform = createMockTransform();
      const numberTransform = createMockTransform({ isLossless: false });

      registry.register('airtable', 'singleLineText', textTransform);
      registry.register('airtable', 'number', numberTransform);

      expect(registry.get('airtable', 'singleLineText')).toBe(textTransform);
      expect(registry.get('airtable', 'number')).toBe(numberTransform);
    });
  });

  describe('get() throws on unregistered lookup', () => {
    it('throws a descriptive error for unregistered platform + field type', () => {
      expect(() => registry.get('airtable', 'unknownType')).toThrow(
        'No transform registered for platform "airtable", field type "unknownType"',
      );
    });

    it('includes registration hint in error message', () => {
      expect(() => registry.get('notion', 'formula')).toThrow(
        'Register a FieldTransform via fieldTypeRegistry.register("notion", "formula", transform)',
      );
    });

    it('throws even when other platforms have that field type', () => {
      registry.register('airtable', 'text', createMockTransform());

      expect(() => registry.get('notion', 'text')).toThrow(
        'No transform registered for platform "notion", field type "text"',
      );
    });
  });

  describe('has()', () => {
    it('returns true for registered transforms', () => {
      registry.register('smartsuite', 'textfield', createMockTransform());
      expect(registry.has('smartsuite', 'textfield')).toBe(true);
    });

    it('returns false for unregistered transforms', () => {
      expect(registry.has('airtable', 'singleLineText')).toBe(false);
    });

    it('returns false for wrong platform even if field type exists on another', () => {
      registry.register('airtable', 'text', createMockTransform());
      expect(registry.has('notion', 'text')).toBe(false);
    });
  });

  describe('getAllForPlatform()', () => {
    it('returns all transforms for a given platform', () => {
      const textTransform = createMockTransform();
      const numberTransform = createMockTransform({ isLossless: false });
      const notionTransform = createMockTransform();

      registry.register('airtable', 'singleLineText', textTransform);
      registry.register('airtable', 'number', numberTransform);
      registry.register('notion', 'title', notionTransform);

      const airtableTransforms = registry.getAllForPlatform('airtable');
      expect(airtableTransforms.size).toBe(2);
      expect(airtableTransforms.get('singleLineText')).toBe(textTransform);
      expect(airtableTransforms.get('number')).toBe(numberTransform);
    });

    it('returns empty map for platform with no registrations', () => {
      registry.register('airtable', 'text', createMockTransform());
      const result = registry.getAllForPlatform('smartsuite');
      expect(result.size).toBe(0);
    });

    it('strips platform prefix from returned keys', () => {
      registry.register('notion', 'rich_text', createMockTransform());
      const result = registry.getAllForPlatform('notion');
      expect([...result.keys()]).toEqual(['rich_text']);
    });
  });

  describe('getSupportedFieldTypes()', () => {
    it('returns field type keys for a given platform', () => {
      registry.register('airtable', 'singleLineText', createMockTransform());
      registry.register('airtable', 'number', createMockTransform());
      registry.register('airtable', 'checkbox', createMockTransform());
      registry.register('notion', 'title', createMockTransform());

      const types = registry.getSupportedFieldTypes('airtable');
      expect(types).toHaveLength(3);
      expect(types).toContain('singleLineText');
      expect(types).toContain('number');
      expect(types).toContain('checkbox');
    });

    it('returns empty array for platform with no registrations', () => {
      expect(registry.getSupportedFieldTypes('smartsuite')).toEqual([]);
    });

    it('does not include field types from other platforms', () => {
      registry.register('airtable', 'text', createMockTransform());
      registry.register('notion', 'title', createMockTransform());

      const types = registry.getSupportedFieldTypes('airtable');
      expect(types).not.toContain('title');
    });
  });

  describe('size and clear()', () => {
    it('reports the total number of registered transforms', () => {
      expect(registry.size).toBe(0);
      registry.register('airtable', 'text', createMockTransform());
      registry.register('notion', 'title', createMockTransform());
      expect(registry.size).toBe(2);
    });

    it('clear() removes all transforms', () => {
      registry.register('airtable', 'text', createMockTransform());
      registry.register('notion', 'title', createMockTransform());
      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.has('airtable', 'text')).toBe(false);
    });
  });

  describe('transform execution', () => {
    it('toCanonical produces a valid CanonicalValue', () => {
      const transform = createMockTransform({
        toCanonical: (value: unknown) => ({
          type: 'number' as const,
          value: Number(value),
        }),
      });
      registry.register('airtable', 'number', transform);

      const result = registry.get('airtable', 'number');
      const canonical = result.toCanonical(42, mockFieldConfig);
      expect(canonical).toEqual({ type: 'number', value: 42 });
    });

    it('fromCanonical produces a platform-native value', () => {
      const transform = createMockTransform({
        fromCanonical: (value) => {
          if (value.type === 'number') return value.value;
          return null;
        },
      });
      registry.register('airtable', 'number', transform);

      const result = registry.get('airtable', 'number');
      const native = result.fromCanonical({ type: 'number', value: 42 }, mockFieldConfig);
      expect(native).toBe(42);
    });
  });

  describe('singleton export', () => {
    it('fieldTypeRegistry is an instance of FieldTypeRegistry', () => {
      expect(fieldTypeRegistry).toBeInstanceOf(FieldTypeRegistry);
    });
  });
});
