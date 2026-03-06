// ---------------------------------------------------------------------------
// Airtable People & Contact Category Transforms (Category 5)
//
// Transforms for: people, created_by, updated_by, email, phone, url,
//                 address, full_name, social
// Airtable types: collaborator, createdBy, lastModifiedBy, email, phoneNumber,
//                 url, (address/full_name/social via singleLineText or custom)
//
// Collaborator mapping note: The transform stores the Airtable collaborator
// object in source_refs.airtable. Mapping to EveryStack user IDs happens at
// a higher level (sync job), not in the pure transform function.
// ---------------------------------------------------------------------------

import type { FieldTransform, PlatformFieldConfig, CanonicalValue } from '../../types';

// ---------------------------------------------------------------------------
// Airtable collaborator shape from the API
// ---------------------------------------------------------------------------

interface AirtableCollaborator {
  id: string;
  email: string;
  name?: string;
}

function isCollaborator(value: unknown): value is AirtableCollaborator {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// ---------------------------------------------------------------------------
// Social platform detection from URL domain
// ---------------------------------------------------------------------------

const SOCIAL_PLATFORM_DOMAINS: Record<string, string> = {
  'linkedin.com': 'linkedin',
  'www.linkedin.com': 'linkedin',
  'twitter.com': 'twitter',
  'www.twitter.com': 'twitter',
  'x.com': 'twitter',
  'www.x.com': 'twitter',
  'instagram.com': 'instagram',
  'www.instagram.com': 'instagram',
  'facebook.com': 'facebook',
  'www.facebook.com': 'facebook',
  'tiktok.com': 'tiktok',
  'www.tiktok.com': 'tiktok',
  'youtube.com': 'youtube',
  'www.youtube.com': 'youtube',
  'github.com': 'github',
  'www.github.com': 'github',
};

function detectSocialPlatform(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return SOCIAL_PLATFORM_DOMAINS[hostname] ?? 'custom';
  } catch {
    return 'custom';
  }
}

// ---------------------------------------------------------------------------
// Address parsing helpers (heuristic — lossy)
// ---------------------------------------------------------------------------

/**
 * Split a "State ZIP" string into state and postal code parts.
 * Uses lastIndexOf to find the boundary — no regex needed.
 * Handles US ZIP codes (12345 or 12345-6789).
 */
function isUsZip(s: string): boolean {
  if (s.length === 5) return s.split('').every((c) => c >= '0' && c <= '9');
  if (s.length === 10 && s[5] === '-') {
    return (
      s.substring(0, 5).split('').every((c) => c >= '0' && c <= '9') &&
      s.substring(6).split('').every((c) => c >= '0' && c <= '9')
    );
  }
  return false;
}

function splitStateZip(stateZip: string): { state: string; postalCode: string | null } {
  const trimmed = stateZip.trim();
  if (trimmed === '') return { state: '', postalCode: null };

  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace === -1) return { state: trimmed, postalCode: null };

  const candidate = trimmed.substring(lastSpace + 1);
  if (isUsZip(candidate)) {
    return {
      state: trimmed.substring(0, lastSpace).trim(),
      postalCode: candidate,
    };
  }

  return { state: trimmed, postalCode: null };
}

/**
 * Best-effort parse of a single-line address string into structured parts.
 * This is inherently lossy — there is no universal address format.
 * A proper geocoding/parsing service would be used in production for accuracy.
 */
function parseAddressString(raw: string): {
  street: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
} {
  const parts = raw.split(',').map((p) => p.trim());

  if (parts.length >= 4) {
    // "123 Main St, City, State ZIP, Country"
    const { state, postalCode } = splitStateZip(parts[2] ?? '');
    return {
      street: parts[0] ?? null,
      city: parts[1] ?? null,
      state,
      postal_code: postalCode,
      country: parts[3] ?? null,
    };
  }

  if (parts.length === 3) {
    // "123 Main St, City, State ZIP"
    const { state, postalCode } = splitStateZip(parts[2] ?? '');
    return {
      street: parts[0] ?? null,
      city: parts[1] ?? null,
      state,
      postal_code: postalCode,
      country: null,
    };
  }

  if (parts.length === 2) {
    // "123 Main St, City"
    return {
      street: parts[0] ?? null,
      city: parts[1] ?? null,
      state: null,
      postal_code: null,
      country: null,
    };
  }

  // Single part — treat as street
  return { street: raw, city: null, state: null, postal_code: null, country: null };
}

/**
 * Concatenate structured address parts back into a single string.
 */
function addressToString(addr: Record<string, unknown>): string {
  const parts: string[] = [];
  if (addr.street) parts.push(String(addr.street));
  if (addr.street2) parts.push(String(addr.street2));
  if (addr.city) parts.push(String(addr.city));

  const statePostal: string[] = [];
  if (addr.state) statePostal.push(String(addr.state));
  if (addr.postal_code) statePostal.push(String(addr.postal_code));
  if (statePostal.length > 0) parts.push(statePostal.join(' '));

  if (addr.country) parts.push(String(addr.country));
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Name parsing helpers (heuristic — lossy)
// ---------------------------------------------------------------------------

const NAME_PREFIXES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'rev', 'sir', 'dame']);
const NAME_SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md', 'esq', 'dds', 'dvm']);

function parseNameString(raw: string): {
  prefix?: string;
  first?: string;
  middle?: string;
  last?: string;
  suffix?: string;
} {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 0) return {};

  let prefix: string | undefined;
  let suffix: string | undefined;

  // Check for prefix
  const firstNormalized = (parts[0] ?? '').replace(/\.$/, '').toLowerCase();
  if (NAME_PREFIXES.has(firstNormalized)) {
    prefix = parts.shift();
  }

  // Check for suffix
  const lastNormalized = (parts[parts.length - 1] ?? '').replace(/[.,]$/, '').toLowerCase();
  if (parts.length > 1 && NAME_SUFFIXES.has(lastNormalized)) {
    suffix = parts.pop();
  }

  if (parts.length === 0) return { prefix, suffix };
  if (parts.length === 1) return { prefix, first: parts[0], suffix };
  if (parts.length === 2) return { prefix, first: parts[0], last: parts[1], suffix };

  // 3+ parts: first, middle(s), last
  return {
    prefix,
    first: parts[0],
    middle: parts.slice(1, -1).join(' '),
    last: parts[parts.length - 1],
    suffix,
  };
}

function nameToString(name: Record<string, unknown>): string {
  const parts: string[] = [];
  if (name.prefix) parts.push(String(name.prefix));
  if (name.first) parts.push(String(name.first));
  if (name.middle) parts.push(String(name.middle));
  if (name.last) parts.push(String(name.last));
  if (name.suffix) parts.push(String(name.suffix));
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Transform definitions
// ---------------------------------------------------------------------------

/**
 * collaborator → people (partial lossless — stores collaborator data in source_refs)
 *
 * Airtable collaborator fields return an array of {id, email, name} objects.
 * The transform stores the raw collaborator data in source_refs.airtable.
 * Actual mapping to EveryStack user IDs is done by the sync job, not here.
 * The canonical value stores placeholder user IDs derived from the Airtable
 * collaborator ID until the sync job maps them.
 */
export const airtablePeopleTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'people', value: [] };

    // Airtable can return a single collaborator or an array
    const collaborators = Array.isArray(value) ? value : [value];
    const userIds: string[] = [];

    for (const collab of collaborators) {
      if (isCollaborator(collab)) {
        // Use Airtable collaborator ID as placeholder — sync job maps to ES user IDs
        userIds.push(collab.id);
      }
    }

    return { type: 'people', value: userIds };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'people') return null;
    if (!canonical.value || canonical.value.length === 0) return [];

    // Return collaborator ID objects for Airtable API
    return canonical.value.map((id) => ({ id }));
  },
  isLossless: false,
  supportedOperations: ['read', 'write'],
};

/**
 * createdBy → created_by (lossless, read-only)
 *
 * Airtable returns a single collaborator object. Stored as the collaborator ID;
 * sync job maps to EveryStack user ID.
 */
export const airtableCreatedByTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'created_by', value: null };

    if (isCollaborator(value)) {
      return { type: 'created_by', value: value.id };
    }

    // Fallback: treat as string ID
    return { type: 'created_by', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'created_by') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read'],
};

/**
 * lastModifiedBy → updated_by (lossless, read-only)
 *
 * Same shape as createdBy but for the last modifier.
 */
export const airtableUpdatedByTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'updated_by', value: null };

    if (isCollaborator(value)) {
      return { type: 'updated_by', value: value.id };
    }

    return { type: 'updated_by', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'updated_by') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read'],
};

/** email → email (lossless string passthrough) */
export const airtableEmailTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'email', value: null };
    return { type: 'email', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'email') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * phoneNumber → phone (lossless)
 *
 * Airtable stores phone as a plain string. We convert to the structured
 * {number, type} canonical shape, defaulting type to 'main'.
 */
export const airtablePhoneTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'phone', value: null };
    return {
      type: 'phone',
      value: { number: String(value), type: 'main' },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'phone') return null;
    if (canonical.value == null) return null;

    // Extract the number string for Airtable's flat phone format
    if (Array.isArray(canonical.value)) {
      return canonical.value[0]?.number ?? null;
    }
    return canonical.value.number;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/** url → url (lossless string passthrough) */
export const airtableUrlTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'url', value: null };
    return { type: 'url', value: String(value) };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'url') return null;
    return canonical.value;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * singleLineText → address (lossy — heuristic parsing)
 *
 * Airtable has no native address type. Addresses are stored as plain text.
 * We apply best-effort parsing to extract structured parts. Round-tripping
 * concatenates back but may lose formatting nuances.
 */
export const airtableAddressTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'address', value: null };

    const raw = String(value);
    if (raw.trim() === '') return { type: 'address', value: null };

    // If it's already a structured object (from ES canonical), pass through
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return {
        type: 'address',
        value: {
          street: obj.street != null ? String(obj.street) : null,
          street2: obj.street2 != null ? String(obj.street2) : null,
          city: obj.city != null ? String(obj.city) : null,
          state: obj.state != null ? String(obj.state) : null,
          postal_code: obj.postal_code != null ? String(obj.postal_code) : null,
          country: obj.country != null ? String(obj.country) : null,
          lat: typeof obj.lat === 'number' ? obj.lat : null,
          lng: typeof obj.lng === 'number' ? obj.lng : null,
        },
      };
    }

    const parsed = parseAddressString(raw);
    return {
      type: 'address',
      value: {
        street: parsed.street,
        street2: null,
        city: parsed.city,
        state: parsed.state,
        postal_code: parsed.postal_code,
        country: parsed.country,
        lat: null,
        lng: null,
      },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'address') return null;
    if (canonical.value == null) return null;

    return addressToString(canonical.value as Record<string, unknown>);
  },
  isLossless: false,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * singleLineText → full_name (lossy — heuristic parsing)
 *
 * Airtable has no native full name type. Names are stored as plain text.
 * We apply best-effort parsing to extract structured parts (prefix, first,
 * middle, last, suffix). Round-tripping concatenates back.
 */
export const airtableFullNameTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'full_name', value: null };

    const raw = String(value);
    if (raw.trim() === '') return { type: 'full_name', value: null };

    // If it's already a structured object, pass through
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      return {
        type: 'full_name',
        value: {
          prefix: obj.prefix != null ? String(obj.prefix) : null,
          first: obj.first != null ? String(obj.first) : null,
          middle: obj.middle != null ? String(obj.middle) : null,
          last: obj.last != null ? String(obj.last) : null,
          suffix: obj.suffix != null ? String(obj.suffix) : null,
        },
      };
    }

    const parsed = parseNameString(raw);
    return {
      type: 'full_name',
      value: {
        prefix: parsed.prefix ?? null,
        first: parsed.first ?? null,
        middle: parsed.middle ?? null,
        last: parsed.last ?? null,
        suffix: parsed.suffix ?? null,
      },
    };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'full_name') return null;
    if (canonical.value == null) return null;

    return nameToString(canonical.value as Record<string, unknown>);
  },
  isLossless: false,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

/**
 * singleLineText → social (lossless)
 *
 * Airtable stores social links as plain URL strings. We detect the platform
 * from the URL domain and store as {platform: url}. Round-tripping extracts
 * the first URL or the URL for a specific platform.
 */
export const airtableSocialTransform: FieldTransform = {
  toCanonical: (value: unknown, _config: PlatformFieldConfig): CanonicalValue => {
    if (value == null) return { type: 'social', value: null };

    const raw = String(value);
    if (raw.trim() === '') return { type: 'social', value: null };

    // If it's already an object map, pass through
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const result: Record<string, string> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val != null) result[key] = String(val);
      }
      return { type: 'social', value: result };
    }

    // Single URL string — detect platform
    const platform = detectSocialPlatform(raw);
    return { type: 'social', value: { [platform]: raw } };
  },
  fromCanonical: (canonical: CanonicalValue, _config: PlatformFieldConfig): unknown => {
    if (canonical.type !== 'social') return null;
    if (canonical.value == null) return null;

    // Return the first URL for Airtable's single-string format
    const urls = Object.values(canonical.value);
    if (urls.length === 0) return null;
    return urls[0] ?? null;
  },
  isLossless: true,
  supportedOperations: ['read', 'write', 'filter', 'sort'],
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export const AIRTABLE_PEOPLE_CONTACT_TRANSFORMS: Array<{
  airtableType: string;
  transform: FieldTransform;
}> = [
  { airtableType: 'collaborator', transform: airtablePeopleTransform },
  { airtableType: 'createdBy', transform: airtableCreatedByTransform },
  { airtableType: 'lastModifiedBy', transform: airtableUpdatedByTransform },
  { airtableType: 'email', transform: airtableEmailTransform },
  { airtableType: 'phoneNumber', transform: airtablePhoneTransform },
  { airtableType: 'url', transform: airtableUrlTransform },
  { airtableType: 'address', transform: airtableAddressTransform },
  { airtableType: 'fullName', transform: airtableFullNameTransform },
  { airtableType: 'social', transform: airtableSocialTransform },
];
