// ---------------------------------------------------------------------------
// Deterministic, pure field permission resolution engine.
// Implements the 7-step cascade from permissions.md § Permission Resolution.
// ZERO I/O — no database, no Redis, no side effects.
// ---------------------------------------------------------------------------

import { roleAtLeast } from '../roles';
import type {
  FieldPermissionMap,
  FieldPermissionState,
  ResolvedPermissionContext,
  RestrictableRole,
} from './types';

// ---------------------------------------------------------------------------
// Permission state ordering: hidden (0) < read_only (1) < read_write (2)
// ---------------------------------------------------------------------------

const PERMISSION_RANK: Record<FieldPermissionState, number> = {
  hidden: 0,
  read_only: 1,
  read_write: 2,
};

/**
 * Compares two permission states numerically.
 * Returns negative if a < b, zero if equal, positive if a > b.
 * hidden (0) < read_only (1) < read_write (2).
 */
export function comparePermissionStates(
  a: FieldPermissionState,
  b: FieldPermissionState,
): number {
  return PERMISSION_RANK[a] - PERMISSION_RANK[b];
}

/**
 * Returns the more restrictive of two permission states.
 */
function narrowTo(
  current: FieldPermissionState,
  candidate: FieldPermissionState,
): FieldPermissionState {
  return comparePermissionStates(candidate, current) < 0 ? candidate : current;
}

// ---------------------------------------------------------------------------
// 7-step cascade
// ---------------------------------------------------------------------------

/**
 * Resolves the effective permission for a single field using the 7-step cascade:
 *
 * 1. Structural filter — field must be in view's field_overrides
 * 2. Owner/Admin bypass — always read_write
 * 3. Base role default — manager/team_member → read_write, viewer → read_only
 * 4. Field global ceiling (Layer 1) — member_edit / viewer_visible flags
 * 5. Role restriction (Layer 2a) — can only narrow, never expand
 * 6. Individual override (Layer 2b) — can restore up to field ceiling
 * 7. Return final state
 */
export function resolveFieldPermission(
  fieldId: string,
  context: ResolvedPermissionContext,
): FieldPermissionState {
  // Step 1: Structural filter — field must be exposed by the Table View
  if (!context.viewFieldOverrides.includes(fieldId)) {
    return 'hidden';
  }

  // Step 2: Owner/Admin bypass
  if (roleAtLeast(context.effectiveRole, 'admin')) {
    return 'read_write';
  }

  // Step 3: Base role default
  let state: FieldPermissionState;
  switch (context.effectiveRole) {
    case 'manager':
    case 'team_member':
      state = 'read_write';
      break;
    case 'viewer':
      state = 'read_only';
      break;
    default:
      state = 'hidden';
  }

  // Step 4: Field global ceiling (Layer 1)
  const fieldPerms = context.fieldPermissions[fieldId];
  let fieldCeiling: FieldPermissionState = 'read_write';

  if (fieldPerms) {
    if (
      fieldPerms.member_edit === false &&
      (context.effectiveRole === 'team_member' || context.effectiveRole === 'manager')
    ) {
      state = narrowTo(state, 'read_only');
      fieldCeiling = 'read_only';
    }
    if (fieldPerms.viewer_visible === false && context.effectiveRole === 'viewer') {
      state = narrowTo(state, 'hidden');
      fieldCeiling = 'hidden';
    }
  }

  // Step 5: Role restriction (Layer 2a) — narrows only, never expands
  const roleRestriction = context.viewPermissions.fieldPermissions.roleRestrictions.find(
    (r) =>
      r.fieldId === fieldId &&
      r.tableId === context.tableId &&
      r.role === (context.effectiveRole as RestrictableRole),
  );

  if (roleRestriction) {
    state = narrowTo(state, roleRestriction.accessState);
  }

  // Step 6: Individual override (Layer 2b)
  // Can restore up to field ceiling but never beyond
  const individualOverride = context.viewPermissions.fieldPermissions.individualOverrides.find(
    (o) =>
      o.fieldId === fieldId &&
      o.tableId === context.tableId &&
      o.userId === context.userId,
  );

  if (individualOverride) {
    // Clamp override to field ceiling — can never exceed Layer 1
    const clampedOverride = narrowTo(fieldCeiling, individualOverride.accessState) === individualOverride.accessState
      ? individualOverride.accessState
      : fieldCeiling;

    // Override replaces current state (can restore within ceiling)
    state = clampedOverride;
  }

  // Step 7: Return final state
  return state;
}

// ---------------------------------------------------------------------------
// Batch resolution
// ---------------------------------------------------------------------------

/**
 * Resolves field permissions for all fields in context.fieldIds.
 * Returns a Map<fieldId, FieldPermissionState>.
 */
export function resolveAllFieldPermissions(
  context: ResolvedPermissionContext,
): FieldPermissionMap {
  const result: FieldPermissionMap = new Map();

  for (const fieldId of context.fieldIds) {
    result.set(fieldId, resolveFieldPermission(fieldId, context));
  }

  return result;
}
