/**
 * Conflict Interaction Rules — documents how conflict resolution
 * interacts with other EveryStack features.
 *
 * Feature interaction rules (from sync-engine.md § lines 757–793):
 *
 * - Automations: run with currently applied value. Resolution may re-trigger
 *   if the resolved value constitutes a field change matching a trigger.
 *   Trigger source: 'sync_conflict_resolution'. (Phase 4 integration.)
 *
 * - Cross-links: display values show currently applied value. Resolution
 *   propagates through standard cross-link display value cascade. (Phase 3B.)
 *
 * - Portals: show currently applied value. No conflict indicator visible to
 *   portal clients. Resolution invalidates portal cache normally. (Phase 3E.)
 *
 * - Formulas: compute with currently applied value. Resolution triggers
 *   formula recalculation through dependency cascade. (Post-MVP.)
 *
 * - Search/tsvector: uses currently applied value. Resolution triggers
 *   re-indexing if resolved value differs. (Already implemented in resolveConflict.)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecomputeResult {
  /** Formula fields referencing the resolved field (post-MVP). */
  formulaFields: string[];
  /** Cross-link display value fields that reference the resolved field. */
  crossLinkFields: string[];
  /** Whether the search tsvector needs updating (value changed). */
  requiresTsvectorUpdate: boolean;
}

interface FieldInfo {
  id: string;
  fieldType: string;
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// shouldRecomputeOnResolution
// ---------------------------------------------------------------------------

/**
 * Determines which downstream fields need recomputation after a conflict
 * resolution changes a field's value.
 *
 * Scans `tableFields` for:
 * - Formula fields whose `config.referencedFieldIds` includes `resolvedFieldId`
 * - Cross-link display fields whose `config.displayFieldId` === `resolvedFieldId`
 *
 * Always sets `requiresTsvectorUpdate: true` since the resolved value may
 * differ from the previous value (already handled in resolveConflict, but
 * exposed here for documentation completeness).
 */
export function shouldRecomputeOnResolution(
  resolvedFieldId: string,
  tableFields: FieldInfo[],
): RecomputeResult {
  const formulaFields: string[] = [];
  const crossLinkFields: string[] = [];

  for (const field of tableFields) {
    // Check for formula fields referencing the resolved field
    if (field.fieldType === 'formula') {
      const referencedFieldIds = field.config.referencedFieldIds;
      if (
        Array.isArray(referencedFieldIds) &&
        referencedFieldIds.includes(resolvedFieldId)
      ) {
        formulaFields.push(field.id);
      }
    }

    // Check for cross-link display fields referencing the resolved field
    if (field.fieldType === 'crossLinkDisplay' || field.fieldType === 'lookup') {
      if (field.config.displayFieldId === resolvedFieldId) {
        crossLinkFields.push(field.id);
      }
    }
  }

  return {
    formulaFields,
    crossLinkFields,
    requiresTsvectorUpdate: true,
  };
}
