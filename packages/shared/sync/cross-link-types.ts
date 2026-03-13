// ---------------------------------------------------------------------------
// Cross-Link Types — types, constants, and canonical field value utilities
// for EveryStack's cross-linking engine.
//
// Cross-links connect any two tables within a tenant — across workspaces
// and platforms. These types define the canonical JSONB shape stored in
// records.canonical_data for cross-link fields, relationship metadata,
// scope filters, and system limits.
//
// @see docs/reference/cross-linking.md § Data Model
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Relationship Types
// ---------------------------------------------------------------------------

/** The two supported relationship cardinalities for cross-link definitions. */
export type RelationshipType = 'many_to_one' | 'one_to_many';

/** Const object for runtime checks and iteration over relationship types. */
export const RELATIONSHIP_TYPES = {
  MANY_TO_ONE: 'many_to_one',
  ONE_TO_MANY: 'one_to_many',
} as const;

// ---------------------------------------------------------------------------
// Link Scope Filter — constrains which target records are valid link targets
// @see docs/reference/cross-linking.md § Link Scope Filters
// ---------------------------------------------------------------------------

/** Operators supported in link scope filter conditions. */
export type LinkScopeOperator =
  | 'eq'
  | 'neq'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'is_empty'
  | 'is_not_empty';

/** A single condition within a link scope filter. */
export interface LinkScopeCondition {
  /** The target table field to evaluate. */
  field_id: string;
  /** The comparison operator. */
  operator: LinkScopeOperator;
  /** Value to compare against. Not required for is_empty / is_not_empty. */
  value?: unknown;
}

/**
 * Shape of the `cross_links.link_scope_filter` JSONB column.
 * Constrains which target records appear in the link picker and are
 * valid targets for linking.
 */
export interface LinkScopeFilter {
  /** Array of filter conditions. Empty array = no filter (all records valid). */
  conditions: LinkScopeCondition[];
  /** How conditions are combined. */
  logic: 'and' | 'or';
}

// ---------------------------------------------------------------------------
// Cross-Link Field Value — canonical JSONB shape in records.canonical_data
// @see docs/reference/cross-linking.md § Cross-Link Field Value
// ---------------------------------------------------------------------------

/**
 * A single linked record entry within a cross-link field value.
 * Display value is denormalized — paid at write time, free at read time.
 */
export interface LinkedRecordEntry {
  /** UUID of the target record. */
  record_id: string;
  /** UUID of the target table (for multi-table resolution). */
  table_id: string;
  /** Cached display value from the target's display field. */
  display_value: string;
  /** ISO 8601 timestamp of when the display value was last refreshed. */
  _display_updated_at: string;
}

/**
 * The complete cross-link field value stored in `records.canonical_data`
 * keyed by the source field's UUID (fields.id).
 *
 * Discriminated by `type: 'cross_link'` to distinguish from other
 * canonical value types (text, number, etc.).
 */
export interface CrossLinkFieldValue {
  type: 'cross_link';
  value: {
    /** Ordered array of linked record entries. */
    linked_records: LinkedRecordEntry[];
    /** UUID of the cross_links definition this field belongs to. */
    cross_link_id: string;
  };
}

// ---------------------------------------------------------------------------
// System Limits
// @see docs/reference/cross-linking.md § Creation Constraints
// ---------------------------------------------------------------------------

/** System-wide limits for cross-link operations. */
export const CROSS_LINK_LIMITS = {
  /** Hard cap on linked records per source record. */
  MAX_LINKS_PER_RECORD: 500,
  /** Default max links per record (configurable per definition). */
  DEFAULT_LINKS_PER_RECORD: 50,
  /** Maximum cross-link definitions allowed per table. */
  MAX_DEFINITIONS_PER_TABLE: 20,
  /** Hard cap on resolution depth (L2 traversal). */
  MAX_DEPTH: 5,
  /** Default resolution depth for new definitions. */
  DEFAULT_DEPTH: 3,
  /** Circuit breaker — abort cascade if total affected records exceeds this. */
  CIRCUIT_BREAKER_THRESHOLD: 1000,
} as const;

// ---------------------------------------------------------------------------
// Canonical Field Value Utilities
// ---------------------------------------------------------------------------

/**
 * Type guard — checks whether an unknown value has the CrossLinkFieldValue shape.
 */
function isCrossLinkFieldValue(value: unknown): value is CrossLinkFieldValue {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('type' in value) ||
    !('value' in value)
  ) {
    return false;
  }

  const typed = value as Record<string, unknown>;
  if (typed.type !== 'cross_link') {
    return false;
  }

  const inner = typed.value;
  if (typeof inner !== 'object' || inner === null) {
    return false;
  }

  const innerObj = inner as Record<string, unknown>;
  if (typeof innerObj.cross_link_id !== 'string') {
    return false;
  }

  if (!Array.isArray(innerObj.linked_records)) {
    return false;
  }

  return true;
}

/**
 * Safely extract and type-narrow a cross-link field value from canonical JSONB.
 *
 * @param canonicalData - The record's canonical_data JSONB object.
 * @param fieldId - The field UUID to extract.
 * @returns The typed CrossLinkFieldValue, or null if the field doesn't exist
 *          or isn't a valid cross-link type.
 */
export function extractCrossLinkField(
  canonicalData: Record<string, unknown>,
  fieldId: string,
): CrossLinkFieldValue | null {
  const raw = canonicalData[fieldId];
  if (raw === undefined || raw === null) {
    return null;
  }

  if (!isCrossLinkFieldValue(raw)) {
    return null;
  }

  return raw;
}

/**
 * Return a new canonical data object with the cross-link field value set.
 * Does not mutate the input object.
 *
 * @param canonicalData - The record's canonical_data JSONB object.
 * @param fieldId - The field UUID to set.
 * @param value - The CrossLinkFieldValue to store.
 * @returns A new object with the field value merged in.
 */
export function setCrossLinkField(
  canonicalData: Record<string, unknown>,
  fieldId: string,
  value: CrossLinkFieldValue,
): Record<string, unknown> {
  return { ...canonicalData, [fieldId]: value };
}
