export {
  TENANT_ROLES,
  WORKSPACE_ROLES,
  ROLE_HIERARCHY,
  roleAtLeast,
} from './roles';
export type { TenantRole, WorkspaceRole, EffectiveRole } from './roles';

export { PermissionDeniedError } from './errors';
export type { PermissionDeniedDetails } from './errors';

export {
  resolveEffectiveRole,
  checkRole,
  requireRole,
} from './check-role';

export type {
  FieldPermissionState,
  RestrictableRole,
  ViewAccessRole,
  RoleRestriction,
  IndividualOverride,
  ViewFieldPermissions,
  ViewPermissions,
  FieldPermissionMap,
  ResolvedPermissionContext,
} from './permissions';

export {
  fieldPermissionStateSchema,
  restrictableRoleSchema,
  viewAccessRoleSchema,
  roleRestrictionSchema,
  individualOverrideSchema,
  viewFieldPermissionsSchema,
  viewPermissionsSchema,
  fieldPermissionsSchema,
} from './permissions';

export {
  resolveFieldPermission,
  resolveAllFieldPermissions,
  comparePermissionStates,
} from './permissions';
