import { describe, it, expect, beforeAll } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtableCheckboxTransform,
  airtableButtonTransform,
  AIRTABLE_BOOLEAN_INTERACTIVE_TRANSFORMS,
} from '../boolean-interactive-transforms';
import { fieldTypeRegistry } from '../../../field-registry';
import { registerAirtableTransforms } from '../index';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldCheck001',
  name: 'Active',
  platformFieldType: 'checkbox',
};

// ---------------------------------------------------------------------------
// checkbox → checkbox
// ---------------------------------------------------------------------------

describe('airtableCheckboxTransform', () => {
  describe('toCanonical', () => {
    it('maps true to checked', () => {
      const result = airtableCheckboxTransform.toCanonical(true, baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: true });
    });

    it('maps Airtable undefined (unchecked) to false', () => {
      const result = airtableCheckboxTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: false });
    });

    it('maps null to false', () => {
      const result = airtableCheckboxTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: false });
    });

    it('maps false to false', () => {
      const result = airtableCheckboxTransform.toCanonical(false, baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: false });
    });

    it('maps non-boolean truthy values to false (strict boolean check)', () => {
      const result = airtableCheckboxTransform.toCanonical(1, baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: false });
    });

    it('maps string "true" to false (strict boolean check)', () => {
      const result = airtableCheckboxTransform.toCanonical('true', baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: false });
    });

    it('maps 0 to false', () => {
      const result = airtableCheckboxTransform.toCanonical(0, baseConfig);
      expect(result).toEqual({ type: 'checkbox', value: false });
    });
  });

  describe('fromCanonical', () => {
    it('returns true for checked checkbox', () => {
      const canonical: CanonicalValue = { type: 'checkbox', value: true };
      const result = airtableCheckboxTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe(true);
    });

    it('returns null for unchecked checkbox (Airtable convention)', () => {
      const canonical: CanonicalValue = { type: 'checkbox', value: false };
      const result = airtableCheckboxTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableCheckboxTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableCheckboxTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableCheckboxTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// button → button
// ---------------------------------------------------------------------------

describe('airtableButtonTransform', () => {
  const buttonConfig: PlatformFieldConfig = {
    externalFieldId: 'fldBtn001',
    name: 'Open URL',
    platformFieldType: 'button',
  };

  describe('toCanonical', () => {
    it('always returns null value regardless of input', () => {
      const result = airtableButtonTransform.toCanonical('anything', buttonConfig);
      expect(result).toEqual({ type: 'button', value: null });
    });

    it('returns null value for null input', () => {
      const result = airtableButtonTransform.toCanonical(null, buttonConfig);
      expect(result).toEqual({ type: 'button', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableButtonTransform.toCanonical(undefined, buttonConfig);
      expect(result).toEqual({ type: 'button', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns null (buttons have no stored value)', () => {
      const canonical: CanonicalValue = { type: 'button', value: null };
      const result = airtableButtonTransform.fromCanonical(canonical, buttonConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableButtonTransform.fromCanonical(canonical, buttonConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableButtonTransform.isLossless).toBe(true);
  });

  it('supports read-only operations', () => {
    expect(airtableButtonTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// EveryStack-only types NOT registered
// ---------------------------------------------------------------------------

describe('EveryStack-only types are not registered for Airtable', () => {
  beforeAll(() => {
    fieldTypeRegistry.clear();
    registerAirtableTransforms();
  });

  it('does not register checklist for Airtable', () => {
    expect(fieldTypeRegistry.has('airtable', 'checklist')).toBe(false);
  });

  it('does not register signature for Airtable', () => {
    expect(fieldTypeRegistry.has('airtable', 'signature')).toBe(false);
  });

  it('only registers checkbox and button in the boolean/interactive category', () => {
    const registeredTypes = AIRTABLE_BOOLEAN_INTERACTIVE_TRANSFORMS.map((t) => t.airtableType);
    expect(registeredTypes).toEqual(['checkbox', 'button']);
    expect(registeredTypes).not.toContain('checklist');
    expect(registeredTypes).not.toContain('signature');
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('boolean & interactive transforms round-trip', () => {
  it('checkbox true round-trips losslessly', () => {
    const canonical = airtableCheckboxTransform.toCanonical(true, baseConfig);
    const platformValue = airtableCheckboxTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe(true);
  });

  it('checkbox unchecked round-trips correctly (undefined → false → null)', () => {
    const canonical = airtableCheckboxTransform.toCanonical(undefined, baseConfig);
    expect(canonical).toEqual({ type: 'checkbox', value: false });
    const platformValue = airtableCheckboxTransform.fromCanonical(canonical, baseConfig);
    // Airtable unchecked is represented as null/undefined
    expect(platformValue).toBeNull();
  });
});
