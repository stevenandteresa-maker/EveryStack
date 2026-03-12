// ---------------------------------------------------------------------------
// Zod validation schemas for field-level permissions.
// Matches types in ./types.ts and the JSONB shapes in permissions.md.
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Field permission state
// ---------------------------------------------------------------------------

export const fieldPermissionStateSchema = z.enum([
  'read_write',
  'read_only',
  'hidden',
]);

export const restrictableRoleSchema = z.enum([
  'team_member',
  'viewer',
  'manager',
]);

export const viewAccessRoleSchema = z.enum(['team_member', 'viewer']);

// ---------------------------------------------------------------------------
// Two-layer restriction model (stored in views.permissions JSONB)
// ---------------------------------------------------------------------------

export const roleRestrictionSchema = z.object({
  tableId: z.string().uuid(),
  role: restrictableRoleSchema,
  fieldId: z.string().uuid(),
  accessState: fieldPermissionStateSchema,
});

export const individualOverrideSchema = z.object({
  tableId: z.string().uuid(),
  userId: z.string().uuid(),
  fieldId: z.string().uuid(),
  accessState: fieldPermissionStateSchema,
});

export const viewFieldPermissionsSchema = z.object({
  roleRestrictions: z.array(roleRestrictionSchema).default([]),
  individualOverrides: z.array(individualOverrideSchema).default([]),
});

export const viewPermissionsSchema = z.object({
  roles: z.array(viewAccessRoleSchema).default([]),
  specificUsers: z.array(z.string().uuid()).default([]),
  excludedUsers: z.array(z.string().uuid()).default([]),
  fieldPermissions: viewFieldPermissionsSchema.default({
    roleRestrictions: [],
    individualOverrides: [],
  }),
});

// ---------------------------------------------------------------------------
// Field global defaults (stored in fields.permissions JSONB)
// ---------------------------------------------------------------------------

export const fieldPermissionsSchema = z.object({
  member_edit: z.boolean().default(true),
  viewer_visible: z.boolean().default(true),
  portal_visible: z.boolean().default(true),
  portal_editable: z.boolean().default(false),
});
