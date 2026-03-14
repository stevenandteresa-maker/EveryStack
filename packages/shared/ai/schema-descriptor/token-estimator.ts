/**
 * Token Estimator & Progressive Condensation for Schema Descriptors.
 *
 * Provides approximate token estimation (JSON char count / 4) and
 * three-level progressive condensation to fit workspace descriptors
 * within LLM token budgets.
 *
 * Condensation levels:
 * - Level 1 (>2k tokens): Remove field `options` arrays
 * - Level 2 (>4k tokens): Collapse tables with >20 fields to key fields only
 * - Level 3 (>8k tokens): Table names + record counts + link graph only
 *
 * @see docs/reference/schema-descriptor-service.md § Output Schema
 */

import type {
  WorkspaceDescriptor,
  FieldDescriptor,
} from './types';

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/**
 * Approximate token count for a workspace descriptor.
 *
 * Uses JSON character count / 4 as a simple heuristic. This is intentionally
 * not a real tokenizer — the approximation is sufficient for budget decisions.
 */
export function estimateTokens(descriptor: WorkspaceDescriptor): number {
  const json = JSON.stringify(descriptor);
  return Math.ceil(json.length / 4);
}

// ---------------------------------------------------------------------------
// Deep-copy helper
// ---------------------------------------------------------------------------

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Condensation levels
// ---------------------------------------------------------------------------

/** Level 1: Remove `options` arrays from all fields. */
function applyLevel1(descriptor: WorkspaceDescriptor): WorkspaceDescriptor {
  for (const base of descriptor.bases) {
    for (const table of base.tables) {
      for (const field of table.fields) {
        delete field.options;
      }
    }
  }
  return descriptor;
}

/** Level 2: Collapse tables with >20 fields to key fields only. */
function applyLevel2(descriptor: WorkspaceDescriptor): WorkspaceDescriptor {
  for (const base of descriptor.bases) {
    for (const table of base.tables) {
      if (table.fields.length > 20) {
        const kept = table.fields.filter(
          (f: FieldDescriptor) =>
            f.searchable || f.aggregatable || f.type === 'linked_record',
        );
        const hiddenCount = table.fields.length - kept.length;
        table.fields = kept;
        table.condensed = true;
        // Store hidden_field_count on the table-level — consumers check this
        // to know fields were omitted. We add it as a synthetic field entry
        // isn't right; instead we set it on each remaining field descriptor
        // as the types define it on FieldDescriptor.
        if (hiddenCount > 0) {
          for (const field of table.fields) {
            field.hidden_field_count = hiddenCount;
          }
        }
      }
    }
  }
  return descriptor;
}

/** Level 3: Table names + record counts + link graph only. */
function applyLevel3(descriptor: WorkspaceDescriptor): WorkspaceDescriptor {
  descriptor.condensed = true;
  for (const base of descriptor.bases) {
    for (const table of base.tables) {
      table.fields = [];
      table.condensed = true;
    }
  }
  return descriptor;
}

// ---------------------------------------------------------------------------
// Progressive condensation
// ---------------------------------------------------------------------------

/**
 * Condense a workspace descriptor to fit within a token budget.
 *
 * Returns a new WorkspaceDescriptor (deep-copy — never mutates input).
 * If the descriptor is already under `maxTokens`, returns an unchanged copy.
 * Otherwise applies progressive condensation levels until under budget or
 * all levels exhausted.
 */
export function condenseDescriptor(
  descriptor: WorkspaceDescriptor,
  maxTokens: number,
): WorkspaceDescriptor {
  // Always work on a deep copy — never mutate input
  const result = deepCopy(descriptor);

  if (estimateTokens(result) <= maxTokens) {
    return result;
  }

  // Level 1 (>2k threshold): remove options arrays
  applyLevel1(result);
  if (estimateTokens(result) <= maxTokens) {
    return result;
  }

  // Level 2 (>4k threshold): collapse large tables
  applyLevel2(result);
  if (estimateTokens(result) <= maxTokens) {
    return result;
  }

  // Level 3 (>8k threshold): table names + counts + link graph only
  applyLevel3(result);
  return result;
}
