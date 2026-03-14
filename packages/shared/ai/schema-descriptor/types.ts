/**
 * Schema Descriptor Service — LLM-optimized workspace metadata types.
 *
 * These types define the JSON structure that the SDS produces for AI consumption.
 * Every design choice prioritizes efficient LLM reasoning:
 * - Short, descriptive keys reduce token count
 * - Boolean flags (`searchable`, `aggregatable`) guide query planning
 * - Type-specific metadata avoids wasted tokens on irrelevant fields
 * - `link_graph` provides a top-level traversal map for JOIN planning
 * - `condensed` flags enable progressive detail reduction under token budgets
 *
 * @see docs/reference/schema-descriptor-service.md § Output Schema
 */

// ---------------------------------------------------------------------------
// FieldDescriptor — per-field metadata for LLM query generation
// ---------------------------------------------------------------------------

/**
 * Describes a single field within a table, optimized for LLM consumption.
 *
 * Includes type-specific optional metadata so the LLM only sees relevant
 * context per field type (e.g., `options` for selects, `currency_code` for
 * currency). The `searchable` and `aggregatable` flags let the LLM decide
 * whether a field is suitable for WHERE clauses or aggregate functions
 * without needing to reason about field types.
 */
export interface FieldDescriptor {
  /** UUID of the field (matches `fields.id` in the database). */
  field_id: string;

  /** Human-readable field name. */
  name: string;

  /**
   * Canonical field type string matching FieldTypeRegistry types
   * (e.g., 'text', 'number', 'single_select', 'linked_record').
   */
  type: string;

  /**
   * Whether this field is suitable for WHERE clause filtering or full-text search.
   * Guides the LLM toward efficient query plans by indicating filterable fields.
   */
  searchable: boolean;

  /**
   * Whether SUM/AVG/MIN/MAX operations are meaningful on this field.
   * Prevents the LLM from attempting aggregations on non-numeric fields.
   */
  aggregatable: boolean;

  // -- Type-specific optional metadata --

  /**
   * Valid enum values for `single_select` / `multi_select` fields.
   * Lets the LLM generate correct filter predicates without guessing values.
   */
  options?: string[];

  /**
   * ISO 4217 currency code for `currency` fields (e.g., 'USD', 'EUR').
   * Helps the LLM format and contextualize monetary values.
   */
  currency_code?: string;

  /**
   * For `linked_record` fields (Cross-Links): the base ID of the target table.
   * Used with `linked_table` to resolve cross-base JOIN paths.
   */
  linked_base?: string;

  /**
   * For `linked_record` fields: the table ID of the linked target table.
   */
  linked_table?: string;

  /**
   * For `linked_record` fields: relationship cardinality.
   * - `many_to_one`: this record links to one target record
   * - `one_to_many`: this record links to many target records
   * - `restricted`: link scope filter limits valid targets
   *
   * Critical for the LLM to understand whether a JOIN will fan out or collapse.
   */
  cardinality?: 'many_to_one' | 'one_to_many' | 'restricted';

  /**
   * For `linked_record` fields: the field ID of the symmetric/reverse field
   * on the target table. Enables bidirectional traversal in query planning.
   */
  symmetric_field?: string;

  /**
   * Number of fields omitted from this table in condensed mode (Level 2).
   * Present only when the descriptor has been condensed to fit token budgets.
   * Lets the LLM know that additional fields exist but were excluded.
   */
  hidden_field_count?: number;
}

// ---------------------------------------------------------------------------
// TableDescriptor — per-table metadata with approximate row count
// ---------------------------------------------------------------------------

/**
 * Describes a single table within a base, optimized for LLM consumption.
 *
 * `record_count_approx` is sourced from `pg_stat_user_tables.n_live_tup`
 * (fast, no table scan) and lets the LLM estimate whether a full scan is
 * feasible or whether filtering is needed first.
 */
export interface TableDescriptor {
  /** UUID of the table (matches `tables.id` in the database). */
  table_id: string;

  /** Human-readable table name. */
  name: string;

  /**
   * Approximate number of live records, from Postgres statistics.
   * Helps the LLM decide between scan-all vs. filter-first strategies.
   */
  record_count_approx: number;

  /** Ordered list of field descriptors for this table. */
  fields: FieldDescriptor[];

  /**
   * When true, this table's fields have been condensed to fit token budgets.
   * Some fields may have been omitted — check `hidden_field_count` on
   * remaining fields for the count of omitted fields.
   */
  condensed?: boolean;
}

// ---------------------------------------------------------------------------
// BaseDescriptor — groups tables by their source platform base connection
// ---------------------------------------------------------------------------

/**
 * Describes a base connection (external platform base or native grouping).
 *
 * Maps to the `base_connections` table. Native EveryStack tables (not synced)
 * appear under a synthetic "Native" base grouping. The `platform` field lets
 * the LLM understand the data source for context-aware query generation.
 */
export interface BaseDescriptor {
  /** UUID of the base connection (matches `base_connections.id`). */
  base_id: string;

  /** Human-readable base name (e.g., 'Sales Pipeline', 'CRM'). */
  name: string;

  /**
   * Source platform identifier (e.g., 'airtable', 'notion', 'smartsuite', 'native').
   * Matches the `base_connections.platform` column.
   */
  platform: string;

  /** Tables within this base connection. */
  tables: TableDescriptor[];
}

// ---------------------------------------------------------------------------
// LinkEdge — cross-link relationship in the workspace link graph
// ---------------------------------------------------------------------------

/**
 * Represents a single cross-link relationship in the workspace link graph.
 *
 * Provided as a separate top-level array in WorkspaceDescriptor so the LLM
 * has a quick traversal map for planning JOIN paths without reconstructing
 * relationships from individual field descriptors.
 */
export interface LinkEdge {
  /**
   * Dotted path to the source field: `base_id.table_id.field_id`.
   * Enables the LLM to resolve the exact origin of the relationship.
   */
  from: string;

  /**
   * Dotted path to the target field: `base_id.table_id.field_id`.
   * The symmetric/reverse field on the target table.
   */
  to: string;

  /**
   * Relationship cardinality from the source's perspective.
   * - `many_to_one`: source records link to one target record
   * - `one_to_many`: source records link to many target records
   */
  cardinality: 'many_to_one' | 'one_to_many';

  /**
   * Human-readable label describing the relationship
   * (e.g., 'Deals -> Primary Contact'). Aids LLM natural language reasoning.
   */
  label: string;
}

// ---------------------------------------------------------------------------
// WorkspaceDescriptor — top-level LLM-optimized schema for a workspace
// ---------------------------------------------------------------------------

/**
 * Complete LLM-optimized schema descriptor for a single workspace.
 *
 * This is the top-level structure produced by the Schema Descriptor Service.
 * It contains all bases, tables, fields, and cross-link relationships within
 * a workspace, structured for efficient AI consumption. The `link_graph`
 * provides a denormalized view of all cross-link relationships for quick
 * traversal planning.
 *
 * Token budget management uses progressive condensation:
 * Level 1 (full) -> Level 2 (remove options, collapse fields) ->
 * Level 3 (table names + link graph only).
 */
export interface WorkspaceDescriptor {
  /** UUID of the workspace. */
  workspace_id: string;

  /** All base connections within this workspace, each containing their tables. */
  bases: BaseDescriptor[];

  /**
   * Denormalized cross-link graph for quick JOIN path traversal.
   * Each edge represents one cross-link relationship using dotted paths.
   */
  link_graph: LinkEdge[];

  /**
   * When true, this descriptor has been progressively condensed to fit
   * within token budget constraints. Some detail has been omitted.
   */
  condensed?: boolean;
}
