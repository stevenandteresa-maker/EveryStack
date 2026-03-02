// ---------------------------------------------------------------------------
// PII Registry — Declares which database columns contain PII and how they
// should be handled on user deletion.
//
// The anonymization cascade itself runs on the Clerk user.deleted webhook
// (post-MVP implementation). This registry is defined now so the cascade
// has a single source of truth when it's built.
//
// See: docs/reference/compliance.md § PII Handling
// ---------------------------------------------------------------------------

/**
 * Sensitivity level for a PII column.
 * - `direct`   — directly identifies a person (email, name)
 * - `indirect` — identifies only in combination with other data (user_id FK)
 * - `content`  — may contain PII embedded in user-generated content
 */
export type PiiSensitivity = 'direct' | 'indirect' | 'content';

/**
 * What happens to this column's data when the owning user is deleted.
 * - `anonymize` — replace with a safe placeholder value
 * - `delete`    — delete the entire row
 * - `retain`    — keep as-is (e.g. tenant-owned data, FK to anonymized user)
 */
export type PiiDeletionStrategy = 'anonymize' | 'delete' | 'retain';

/**
 * Describes a single PII-bearing column within a database table.
 */
export interface PiiColumnDef {
  /** Database column name (snake_case). */
  column: string;
  /** How sensitive this column is. */
  sensitivity: PiiSensitivity;
  /** What to do with this column on user deletion. */
  onUserDeletion: PiiDeletionStrategy;
  /** The value to replace with when anonymizing. Undefined if not anonymized. */
  anonymizeTo?: string | null | Record<string, never>;
}

/**
 * Groups all PII columns for a single database table.
 */
export interface PiiTableEntry {
  /** Database table name (snake_case). */
  table: string;
  /** PII-bearing columns in this table. */
  columns: PiiColumnDef[];
}

// ---------------------------------------------------------------------------
// Registry data — sourced from compliance.md § PII Registry
// ---------------------------------------------------------------------------

const PII_REGISTRY: PiiTableEntry[] = [
  {
    table: 'users',
    columns: [
      { column: 'email', sensitivity: 'direct', onUserDeletion: 'anonymize', anonymizeTo: 'deleted_user_<hash>' },
      { column: 'name', sensitivity: 'direct', onUserDeletion: 'anonymize', anonymizeTo: null },
      { column: 'avatar_url', sensitivity: 'direct', onUserDeletion: 'anonymize', anonymizeTo: null },
      { column: 'preferences', sensitivity: 'indirect', onUserDeletion: 'anonymize', anonymizeTo: '{}' },
    ],
  },
  {
    table: 'workspace_memberships',
    columns: [
      { column: 'user_id', sensitivity: 'indirect', onUserDeletion: 'retain' },
    ],
  },
  {
    table: 'records',
    columns: [
      { column: 'canonical_data', sensitivity: 'content', onUserDeletion: 'retain' },
    ],
  },
  {
    table: 'thread_messages',
    columns: [
      { column: 'sender_id', sensitivity: 'indirect', onUserDeletion: 'anonymize', anonymizeTo: null },
      { column: 'content', sensitivity: 'content', onUserDeletion: 'retain' },
    ],
  },
  {
    table: 'ai_usage_log',
    columns: [
      { column: 'user_id', sensitivity: 'indirect', onUserDeletion: 'delete' },
      { column: 'prompt_content', sensitivity: 'content', onUserDeletion: 'delete' },
    ],
  },
  {
    table: 'command_bar_sessions',
    columns: [
      { column: 'user_id', sensitivity: 'indirect', onUserDeletion: 'delete' },
      { column: 'history', sensitivity: 'content', onUserDeletion: 'delete' },
    ],
  },
  {
    table: 'audit_log',
    columns: [
      { column: 'actor_id', sensitivity: 'indirect', onUserDeletion: 'anonymize', anonymizeTo: null },
      { column: 'action_details', sensitivity: 'content', onUserDeletion: 'retain' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------

/**
 * Returns the PII column definitions for a specific database table.
 * Returns an empty array if the table has no registered PII columns.
 */
export function getPiiColumnsForTable(tableName: string): PiiColumnDef[] {
  const entry = PII_REGISTRY.find((e) => e.table === tableName);
  return entry ? entry.columns : [];
}

/**
 * Returns the full PII registry — all tables and their PII columns.
 */
export function getAllPiiTables(): PiiTableEntry[] {
  return PII_REGISTRY;
}
