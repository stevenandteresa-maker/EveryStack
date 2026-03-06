import { describe, it, expect } from 'vitest';
import type { PlatformFieldConfig, CanonicalValue } from '../../../types';
import {
  airtablePeopleTransform,
  airtableCreatedByTransform,
  airtableUpdatedByTransform,
  airtableEmailTransform,
  airtablePhoneTransform,
  airtableUrlTransform,
  airtableAddressTransform,
  airtableFullNameTransform,
  airtableSocialTransform,
} from '../people-contact-transforms';

const baseConfig: PlatformFieldConfig = {
  externalFieldId: 'fldPeople001',
  name: 'Assignee',
  platformFieldType: 'collaborator',
};

// ---------------------------------------------------------------------------
// collaborator → people
// ---------------------------------------------------------------------------

describe('airtablePeopleTransform', () => {
  describe('toCanonical', () => {
    it('maps an array of collaborators to user ID array', () => {
      const collabs = [
        { id: 'usr_abc', email: 'alice@example.com', name: 'Alice' },
        { id: 'usr_def', email: 'bob@example.com', name: 'Bob' },
      ];
      const result = airtablePeopleTransform.toCanonical(collabs, baseConfig);
      expect(result).toEqual({
        type: 'people',
        value: ['usr_abc', 'usr_def'],
      });
    });

    it('maps a single collaborator object (non-array)', () => {
      const collab = { id: 'usr_abc', email: 'alice@example.com', name: 'Alice' };
      const result = airtablePeopleTransform.toCanonical(collab, baseConfig);
      expect(result).toEqual({
        type: 'people',
        value: ['usr_abc'],
      });
    });

    it('returns empty array for null input', () => {
      const result = airtablePeopleTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'people', value: [] });
    });

    it('returns empty array for undefined input', () => {
      const result = airtablePeopleTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'people', value: [] });
    });

    it('skips non-collaborator items in array', () => {
      const mixed = [
        { id: 'usr_abc', email: 'alice@example.com' },
        'not a collaborator',
        42,
        null,
      ];
      const result = airtablePeopleTransform.toCanonical(mixed, baseConfig);
      expect(result).toEqual({
        type: 'people',
        value: ['usr_abc'],
      });
    });

    it('handles collaborator without name field', () => {
      const collab = { id: 'usr_abc', email: 'alice@example.com' };
      const result = airtablePeopleTransform.toCanonical(collab, baseConfig);
      expect(result).toEqual({
        type: 'people',
        value: ['usr_abc'],
      });
    });

    it('returns empty array for empty array input', () => {
      const result = airtablePeopleTransform.toCanonical([], baseConfig);
      expect(result).toEqual({ type: 'people', value: [] });
    });
  });

  describe('fromCanonical', () => {
    it('returns collaborator ID objects for Airtable API', () => {
      const canonical: CanonicalValue = {
        type: 'people',
        value: ['usr_abc', 'usr_def'],
      };
      const result = airtablePeopleTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([{ id: 'usr_abc' }, { id: 'usr_def' }]);
    });

    it('returns empty array for empty people value', () => {
      const canonical: CanonicalValue = { type: 'people', value: [] };
      const result = airtablePeopleTransform.fromCanonical(canonical, baseConfig);
      expect(result).toEqual([]);
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtablePeopleTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as not lossless (collaborator data stored in source_refs)', () => {
    expect(airtablePeopleTransform.isLossless).toBe(false);
  });

  it('supports read and write operations', () => {
    expect(airtablePeopleTransform.supportedOperations).toEqual(['read', 'write']);
  });
});

// ---------------------------------------------------------------------------
// createdBy → created_by
// ---------------------------------------------------------------------------

describe('airtableCreatedByTransform', () => {
  describe('toCanonical', () => {
    it('maps a collaborator object to user ID', () => {
      const collab = { id: 'usr_creator', email: 'creator@example.com', name: 'Creator' };
      const result = airtableCreatedByTransform.toCanonical(collab, baseConfig);
      expect(result).toEqual({ type: 'created_by', value: 'usr_creator' });
    });

    it('falls back to string for non-collaborator value', () => {
      const result = airtableCreatedByTransform.toCanonical('usr_fallback', baseConfig);
      expect(result).toEqual({ type: 'created_by', value: 'usr_fallback' });
    });

    it('returns null value for null input', () => {
      const result = airtableCreatedByTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'created_by', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableCreatedByTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'created_by', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the stored user ID', () => {
      const canonical: CanonicalValue = { type: 'created_by', value: 'usr_creator' };
      const result = airtableCreatedByTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('usr_creator');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'created_by', value: null };
      const result = airtableCreatedByTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableCreatedByTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableCreatedByTransform.isLossless).toBe(true);
  });

  it('supports read-only operations', () => {
    expect(airtableCreatedByTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// lastModifiedBy → updated_by
// ---------------------------------------------------------------------------

describe('airtableUpdatedByTransform', () => {
  describe('toCanonical', () => {
    it('maps a collaborator object to user ID', () => {
      const collab = { id: 'usr_modifier', email: 'modifier@example.com' };
      const result = airtableUpdatedByTransform.toCanonical(collab, baseConfig);
      expect(result).toEqual({ type: 'updated_by', value: 'usr_modifier' });
    });

    it('returns null value for null input', () => {
      const result = airtableUpdatedByTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'updated_by', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the stored user ID', () => {
      const canonical: CanonicalValue = { type: 'updated_by', value: 'usr_modifier' };
      const result = airtableUpdatedByTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('usr_modifier');
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableUpdatedByTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableUpdatedByTransform.isLossless).toBe(true);
  });

  it('supports read-only operations', () => {
    expect(airtableUpdatedByTransform.supportedOperations).toEqual(['read']);
  });
});

// ---------------------------------------------------------------------------
// email → email
// ---------------------------------------------------------------------------

describe('airtableEmailTransform', () => {
  describe('toCanonical', () => {
    it('passes through a valid email string', () => {
      const result = airtableEmailTransform.toCanonical('user@example.com', baseConfig);
      expect(result).toEqual({ type: 'email', value: 'user@example.com' });
    });

    it('returns null value for null input', () => {
      const result = airtableEmailTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'email', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableEmailTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'email', value: null });
    });

    it('coerces non-string values to string', () => {
      const result = airtableEmailTransform.toCanonical(123, baseConfig);
      expect(result).toEqual({ type: 'email', value: '123' });
    });
  });

  describe('fromCanonical', () => {
    it('returns the email string', () => {
      const canonical: CanonicalValue = { type: 'email', value: 'user@example.com' };
      const result = airtableEmailTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('user@example.com');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'email', value: null };
      const result = airtableEmailTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableEmailTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableEmailTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtableEmailTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// phoneNumber → phone
// ---------------------------------------------------------------------------

describe('airtablePhoneTransform', () => {
  describe('toCanonical', () => {
    it('converts a string phone number to structured {number, type}', () => {
      const result = airtablePhoneTransform.toCanonical('+1-555-123-4567', baseConfig);
      expect(result).toEqual({
        type: 'phone',
        value: { number: '+1-555-123-4567', type: 'main' },
      });
    });

    it('returns null value for null input', () => {
      const result = airtablePhoneTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'phone', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtablePhoneTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'phone', value: null });
    });

    it('coerces numeric input to string', () => {
      const result = airtablePhoneTransform.toCanonical(5551234567, baseConfig);
      expect(result).toEqual({
        type: 'phone',
        value: { number: '5551234567', type: 'main' },
      });
    });
  });

  describe('fromCanonical', () => {
    it('extracts number string from single phone entry', () => {
      const canonical: CanonicalValue = {
        type: 'phone',
        value: { number: '+1-555-123-4567', type: 'main' },
      };
      const result = airtablePhoneTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('+1-555-123-4567');
    });

    it('extracts first number from phone entry array', () => {
      const canonical: CanonicalValue = {
        type: 'phone',
        value: [
          { number: '+1-555-111-1111', type: 'work' },
          { number: '+1-555-222-2222', type: 'home' },
        ],
      };
      const result = airtablePhoneTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('+1-555-111-1111');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'phone', value: null };
      const result = airtablePhoneTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtablePhoneTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtablePhoneTransform.isLossless).toBe(true);
  });

  it('supports all standard operations', () => {
    expect(airtablePhoneTransform.supportedOperations).toEqual([
      'read', 'write', 'filter', 'sort',
    ]);
  });
});

// ---------------------------------------------------------------------------
// url → url
// ---------------------------------------------------------------------------

describe('airtableUrlTransform', () => {
  describe('toCanonical', () => {
    it('passes through a URL string', () => {
      const result = airtableUrlTransform.toCanonical('https://example.com', baseConfig);
      expect(result).toEqual({ type: 'url', value: 'https://example.com' });
    });

    it('returns null value for null input', () => {
      const result = airtableUrlTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'url', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableUrlTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'url', value: null });
    });
  });

  describe('fromCanonical', () => {
    it('returns the URL string', () => {
      const canonical: CanonicalValue = { type: 'url', value: 'https://example.com' };
      const result = airtableUrlTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('https://example.com');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'url', value: null };
      const result = airtableUrlTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableUrlTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableUrlTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// singleLineText → address (lossy)
// ---------------------------------------------------------------------------

describe('airtableAddressTransform', () => {
  describe('toCanonical', () => {
    it('parses a full US address string', () => {
      const result = airtableAddressTransform.toCanonical(
        '123 Main St, Springfield, IL 62704, USA',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'address',
        value: {
          street: '123 Main St',
          street2: null,
          city: 'Springfield',
          state: 'IL',
          postal_code: '62704',
          country: 'USA',
          lat: null,
          lng: null,
        },
      });
    });

    it('parses a 3-part address (no country)', () => {
      const result = airtableAddressTransform.toCanonical(
        '456 Oak Ave, Austin, TX 73301',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'address',
        value: {
          street: '456 Oak Ave',
          street2: null,
          city: 'Austin',
          state: 'TX',
          postal_code: '73301',
          country: null,
          lat: null,
          lng: null,
        },
      });
    });

    it('parses a 2-part address (street and city)', () => {
      const result = airtableAddressTransform.toCanonical(
        '789 Elm Blvd, Denver',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'address',
        value: {
          street: '789 Elm Blvd',
          street2: null,
          city: 'Denver',
          state: null,
          postal_code: null,
          country: null,
          lat: null,
          lng: null,
        },
      });
    });

    it('treats single part as street', () => {
      const result = airtableAddressTransform.toCanonical('PO Box 123', baseConfig);
      expect(result).toEqual({
        type: 'address',
        value: {
          street: 'PO Box 123',
          street2: null,
          city: null,
          state: null,
          postal_code: null,
          country: null,
          lat: null,
          lng: null,
        },
      });
    });

    it('returns null value for null input', () => {
      const result = airtableAddressTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'address', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableAddressTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'address', value: null });
    });

    it('returns null value for empty string', () => {
      const result = airtableAddressTransform.toCanonical('', baseConfig);
      expect(result).toEqual({ type: 'address', value: null });
    });

    it('returns null value for whitespace-only string', () => {
      const result = airtableAddressTransform.toCanonical('   ', baseConfig);
      expect(result).toEqual({ type: 'address', value: null });
    });

    it('passes through a pre-structured address object', () => {
      const structured = {
        street: '100 First St',
        city: 'Portland',
        state: 'OR',
        postal_code: '97201',
        country: 'US',
      };
      const result = airtableAddressTransform.toCanonical(structured, baseConfig);
      expect(result).toEqual({
        type: 'address',
        value: {
          street: '100 First St',
          street2: null,
          city: 'Portland',
          state: 'OR',
          postal_code: '97201',
          country: 'US',
          lat: null,
          lng: null,
        },
      });
    });
  });

  describe('fromCanonical', () => {
    it('concatenates structured address back to string', () => {
      const canonical: CanonicalValue = {
        type: 'address',
        value: {
          street: '123 Main St',
          city: 'Springfield',
          state: 'IL',
          postal_code: '62704',
          country: 'USA',
        },
      };
      const result = airtableAddressTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('123 Main St, Springfield, IL 62704, USA');
    });

    it('handles address with street2', () => {
      const canonical: CanonicalValue = {
        type: 'address',
        value: {
          street: '100 Main St',
          street2: 'Suite 200',
          city: 'Austin',
          state: 'TX',
          postal_code: '73301',
        },
      };
      const result = airtableAddressTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('100 Main St, Suite 200, Austin, TX 73301');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'address', value: null };
      const result = airtableAddressTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableAddressTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossy', () => {
    expect(airtableAddressTransform.isLossless).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// singleLineText → full_name (lossy)
// ---------------------------------------------------------------------------

describe('airtableFullNameTransform', () => {
  describe('toCanonical', () => {
    it('parses a simple two-part name', () => {
      const result = airtableFullNameTransform.toCanonical('John Smith', baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: null,
          first: 'John',
          middle: null,
          last: 'Smith',
          suffix: null,
        },
      });
    });

    it('parses a name with prefix', () => {
      const result = airtableFullNameTransform.toCanonical('Dr. Jane Doe', baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: 'Dr.',
          first: 'Jane',
          middle: null,
          last: 'Doe',
          suffix: null,
        },
      });
    });

    it('parses a name with suffix', () => {
      const result = airtableFullNameTransform.toCanonical('Robert Smith Jr', baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: null,
          first: 'Robert',
          middle: null,
          last: 'Smith',
          suffix: 'Jr',
        },
      });
    });

    it('parses a name with middle name', () => {
      const result = airtableFullNameTransform.toCanonical('John Michael Smith', baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: null,
          first: 'John',
          middle: 'Michael',
          last: 'Smith',
          suffix: null,
        },
      });
    });

    it('parses a full name with prefix, middle, and suffix', () => {
      const result = airtableFullNameTransform.toCanonical('Dr. John Michael Smith III', baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: 'Dr.',
          first: 'John',
          middle: 'Michael',
          last: 'Smith',
          suffix: 'III',
        },
      });
    });

    it('handles single name (first only)', () => {
      const result = airtableFullNameTransform.toCanonical('Alice', baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: null,
          first: 'Alice',
          middle: null,
          last: null,
          suffix: null,
        },
      });
    });

    it('returns null value for null input', () => {
      const result = airtableFullNameTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'full_name', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableFullNameTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'full_name', value: null });
    });

    it('returns null value for empty string', () => {
      const result = airtableFullNameTransform.toCanonical('', baseConfig);
      expect(result).toEqual({ type: 'full_name', value: null });
    });

    it('passes through a pre-structured name object', () => {
      const structured = { first: 'Jane', last: 'Doe' };
      const result = airtableFullNameTransform.toCanonical(structured, baseConfig);
      expect(result).toEqual({
        type: 'full_name',
        value: {
          prefix: null,
          first: 'Jane',
          middle: null,
          last: 'Doe',
          suffix: null,
        },
      });
    });
  });

  describe('fromCanonical', () => {
    it('concatenates name parts back to a string', () => {
      const canonical: CanonicalValue = {
        type: 'full_name',
        value: {
          prefix: 'Dr.',
          first: 'John',
          middle: 'Michael',
          last: 'Smith',
          suffix: 'III',
        },
      };
      const result = airtableFullNameTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('Dr. John Michael Smith III');
    });

    it('handles name without prefix and suffix', () => {
      const canonical: CanonicalValue = {
        type: 'full_name',
        value: { first: 'Jane', last: 'Doe' },
      };
      const result = airtableFullNameTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('Jane Doe');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'full_name', value: null };
      const result = airtableFullNameTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableFullNameTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossy', () => {
    expect(airtableFullNameTransform.isLossless).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// singleLineText → social
// ---------------------------------------------------------------------------

describe('airtableSocialTransform', () => {
  describe('toCanonical', () => {
    it('detects LinkedIn from URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://www.linkedin.com/in/johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { linkedin: 'https://www.linkedin.com/in/johndoe' },
      });
    });

    it('detects Twitter/X from x.com URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://x.com/johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { twitter: 'https://x.com/johndoe' },
      });
    });

    it('detects GitHub from URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://github.com/johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { github: 'https://github.com/johndoe' },
      });
    });

    it('detects Instagram from URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://www.instagram.com/johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { instagram: 'https://www.instagram.com/johndoe' },
      });
    });

    it('detects Facebook from URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://www.facebook.com/johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { facebook: 'https://www.facebook.com/johndoe' },
      });
    });

    it('detects YouTube from URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://www.youtube.com/@johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { youtube: 'https://www.youtube.com/@johndoe' },
      });
    });

    it('detects TikTok from URL', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://www.tiktok.com/@johndoe',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { tiktok: 'https://www.tiktok.com/@johndoe' },
      });
    });

    it('falls back to "custom" for unknown domains', () => {
      const result = airtableSocialTransform.toCanonical(
        'https://myportfolio.dev/profile',
        baseConfig,
      );
      expect(result).toEqual({
        type: 'social',
        value: { custom: 'https://myportfolio.dev/profile' },
      });
    });

    it('falls back to "custom" for invalid URL strings', () => {
      const result = airtableSocialTransform.toCanonical('not-a-url', baseConfig);
      expect(result).toEqual({
        type: 'social',
        value: { custom: 'not-a-url' },
      });
    });

    it('returns null value for null input', () => {
      const result = airtableSocialTransform.toCanonical(null, baseConfig);
      expect(result).toEqual({ type: 'social', value: null });
    });

    it('returns null value for undefined input', () => {
      const result = airtableSocialTransform.toCanonical(undefined, baseConfig);
      expect(result).toEqual({ type: 'social', value: null });
    });

    it('returns null value for empty string', () => {
      const result = airtableSocialTransform.toCanonical('', baseConfig);
      expect(result).toEqual({ type: 'social', value: null });
    });

    it('passes through a pre-structured social object', () => {
      const structured = { linkedin: 'https://linkedin.com/in/jane', github: 'https://github.com/jane' };
      const result = airtableSocialTransform.toCanonical(structured, baseConfig);
      expect(result).toEqual({
        type: 'social',
        value: { linkedin: 'https://linkedin.com/in/jane', github: 'https://github.com/jane' },
      });
    });
  });

  describe('fromCanonical', () => {
    it('returns the first URL for single-platform social', () => {
      const canonical: CanonicalValue = {
        type: 'social',
        value: { linkedin: 'https://www.linkedin.com/in/johndoe' },
      };
      const result = airtableSocialTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBe('https://www.linkedin.com/in/johndoe');
    });

    it('returns the first URL for multi-platform social', () => {
      const canonical: CanonicalValue = {
        type: 'social',
        value: {
          linkedin: 'https://linkedin.com/in/john',
          github: 'https://github.com/john',
        },
      };
      const result = airtableSocialTransform.fromCanonical(canonical, baseConfig);
      expect(typeof result).toBe('string');
    });

    it('returns null for null canonical value', () => {
      const canonical: CanonicalValue = { type: 'social', value: null };
      const result = airtableSocialTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });

    it('returns null for empty social object', () => {
      const canonical: CanonicalValue = { type: 'social', value: {} };
      const result = airtableSocialTransform.fromCanonical(canonical, baseConfig);
      // Object.values({}) returns [] — first element is undefined, coerced to null
      expect(result).toBeNull();
    });

    it('returns null for mismatched canonical type', () => {
      const canonical: CanonicalValue = { type: 'text', value: 'wrong' };
      const result = airtableSocialTransform.fromCanonical(canonical, baseConfig);
      expect(result).toBeNull();
    });
  });

  it('is marked as lossless', () => {
    expect(airtableSocialTransform.isLossless).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('people & contact transforms round-trip', () => {
  it('email round-trips losslessly', () => {
    const canonical = airtableEmailTransform.toCanonical('test@example.com', baseConfig);
    const platformValue = airtableEmailTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('test@example.com');
  });

  it('phone round-trips losslessly', () => {
    const canonical = airtablePhoneTransform.toCanonical('+1-555-123-4567', baseConfig);
    const platformValue = airtablePhoneTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('+1-555-123-4567');
  });

  it('url round-trips losslessly', () => {
    const canonical = airtableUrlTransform.toCanonical('https://example.com/path', baseConfig);
    const platformValue = airtableUrlTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('https://example.com/path');
  });

  it('social round-trips losslessly for single URL', () => {
    const canonical = airtableSocialTransform.toCanonical(
      'https://github.com/user',
      baseConfig,
    );
    const platformValue = airtableSocialTransform.fromCanonical(canonical, baseConfig);
    expect(platformValue).toBe('https://github.com/user');
  });
});
