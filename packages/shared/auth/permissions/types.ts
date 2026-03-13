// ---------------------------------------------------------------------------
// Field-level permission types for the two-layer restriction model.
// See permissions.md § Field-Level Permissions and § Permission Storage.
// ---------------------------------------------------------------------------

import type { EffectiveRole } from '../roles';

/** The three possible access states for any field, for any user. */
export type FieldPermissionState = 'read_write' | 'read_only' | 'hidden';

/** Roles that can be restricted at the view level. */
export type RestrictableRole = 'team_member' | 'viewer' | 'manager';

/** Roles that can access a Table View. */
export type ViewAccessRole = 'team_member' | 'viewer';

// ---------------------------------------------------------------------------
// Layer 1: Role-level restrictions per table within a Table View
// Only restrictions stored — no entry = role default applies.
// ---------------------------------------------------------------------------

export interface RoleRestriction {
  tableId: string;
  role: RestrictableRole;
  fieldId: string;
  accessState: FieldPermissionState;
}

// ---------------------------------------------------------------------------
// Layer 2: Individual user overrides within a Table View
// Only overrides stored — no entry = role-level applies.
// Overrides work in both directions (more or less access than role default).
// ---------------------------------------------------------------------------

export interface IndividualOverride {
  tableId: string;
  userId: string;
  fieldId: string;
  accessState: FieldPermissionState;
}

// ---------------------------------------------------------------------------
// View-level permission structures (stored in views.permissions JSONB)
// ---------------------------------------------------------------------------

export interface ViewFieldPermissions {
  roleRestrictions: RoleRestriction[];
  individualOverrides: IndividualOverride[];
}

export interface ViewPermissions {
  roles: ViewAccessRole[];
  specificUsers: string[];
  excludedUsers: string[];
  fieldPermissions: ViewFieldPermissions;
}

// ---------------------------------------------------------------------------
// Resolved permission map — result of the resolution chain
// ---------------------------------------------------------------------------

/** Field ID → effective access state for a specific user. */
export type FieldPermissionMap = Map<string, FieldPermissionState>;

// ---------------------------------------------------------------------------
// Context object passed into the permission resolver
// ---------------------------------------------------------------------------

export interface ResolvedPermissionContext {
  userId: string;
  effectiveRole: EffectiveRole;
  tableId: string;
  viewId: string;
  /** All field IDs for this table. */
  fieldIds: string[];
  /** Field IDs exposed by the Table View's field_overrides. */
  viewFieldOverrides: string[];
  /** From views.permissions JSONB. */
  viewPermissions: ViewPermissions;
  /** Field ID → fields.permissions JSONB (global defaults). */
  fieldPermissions: Record<string, Record<string, unknown>>;
}
