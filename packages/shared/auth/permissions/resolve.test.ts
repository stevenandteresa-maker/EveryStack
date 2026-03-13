import { describe, expect, it } from 'vitest';

import {
  comparePermissionStates,
  resolveAllFieldPermissions,
  resolveFieldPermission,
} from './resolve';
import type {
  ResolvedPermissionContext,
  ViewPermissions,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FIELD_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const FIELD_B = 'aaaaaaaa-0000-0000-0000-000000000002';
const FIELD_C = 'aaaaaaaa-0000-0000-0000-000000000003';
const TABLE_ID = 'tttttttt-0000-0000-0000-000000000001';
const VIEW_ID = 'vvvvvvvv-0000-0000-0000-000000000001';
const USER_ID = 'uuuuuuuu-0000-0000-0000-000000000001';
const OTHER_USER = 'uuuuuuuu-0000-0000-0000-000000000002';

function emptyViewPermissions(): ViewPermissions {
  return {
    roles: [],
    specificUsers: [],
    excludedUsers: [],
    fieldPermissions: {
      roleRestrictions: [],
      individualOverrides: [],
    },
  };
}

function makeContext(overrides: Partial<ResolvedPermissionContext> = {}): ResolvedPermissionContext {
  return {
    userId: USER_ID,
    effectiveRole: 'team_member',
    tableId: TABLE_ID,
    viewId: VIEW_ID,
    fieldIds: [FIELD_A, FIELD_B, FIELD_C],
    viewFieldOverrides: [FIELD_A, FIELD_B, FIELD_C],
    viewPermissions: emptyViewPermissions(),
    fieldPermissions: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// comparePermissionStates
// ---------------------------------------------------------------------------

describe('comparePermissionStates', () => {
  it('ranks hidden < read_only < read_write', () => {
    expect(comparePermissionStates('hidden', 'read_only')).toBeLessThan(0);
    expect(comparePermissionStates('read_only', 'read_write')).toBeLessThan(0);
    expect(comparePermissionStates('hidden', 'read_write')).toBeLessThan(0);
  });

  it('returns 0 for equal states', () => {
    expect(comparePermissionStates('read_write', 'read_write')).toBe(0);
    expect(comparePermissionStates('hidden', 'hidden')).toBe(0);
  });

  it('returns positive when a > b', () => {
    expect(comparePermissionStates('read_write', 'hidden')).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// resolveFieldPermission — 7-step cascade
// ---------------------------------------------------------------------------

describe('resolveFieldPermission', () => {
  // Step 1: Structural filter
  it('returns hidden when field is not in viewFieldOverrides', () => {
    const ctx = makeContext({ viewFieldOverrides: [FIELD_B] });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('hidden');
  });

  // Step 2: Owner bypass
  it('owner bypasses all restrictions → read_write', () => {
    const ctx = makeContext({
      effectiveRole: 'owner',
      fieldPermissions: { [FIELD_A]: { member_edit: false, viewer_visible: false } },
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'manager', fieldId: FIELD_A, accessState: 'hidden' },
          ],
          individualOverrides: [
            { tableId: TABLE_ID, userId: USER_ID, fieldId: FIELD_A, accessState: 'hidden' },
          ],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');
  });

  // Step 2: Admin bypass
  it('admin bypasses all restrictions → read_write', () => {
    const ctx = makeContext({
      effectiveRole: 'admin',
      fieldPermissions: { [FIELD_A]: { member_edit: false } },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');
  });

  // Step 3: Base role defaults
  it('team_member default → read_write', () => {
    const ctx = makeContext({ effectiveRole: 'team_member' });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');
  });

  it('manager default → read_write', () => {
    const ctx = makeContext({ effectiveRole: 'manager' });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');
  });

  it('viewer default → read_only', () => {
    const ctx = makeContext({ effectiveRole: 'viewer' });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Step 4: Field ceiling — member_edit
  it('field ceiling member_edit=false narrows team_member to read_only', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      fieldPermissions: { [FIELD_A]: { member_edit: false } },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  it('field ceiling member_edit=false narrows manager to read_only', () => {
    const ctx = makeContext({
      effectiveRole: 'manager',
      fieldPermissions: { [FIELD_A]: { member_edit: false } },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Step 4: Field ceiling — viewer_visible
  it('field ceiling viewer_visible=false narrows viewer to hidden', () => {
    const ctx = makeContext({
      effectiveRole: 'viewer',
      fieldPermissions: { [FIELD_A]: { viewer_visible: false } },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('hidden');
  });

  // Step 5: Role restriction narrows
  it('role restriction narrows read_write → read_only', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'team_member', fieldId: FIELD_A, accessState: 'read_only' },
          ],
          individualOverrides: [],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Step 5: Role restriction cannot expand
  it('role restriction cannot expand (viewer read_only stays even if restriction says read_write)', () => {
    const ctx = makeContext({
      effectiveRole: 'viewer',
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'viewer', fieldId: FIELD_A, accessState: 'read_write' },
          ],
          individualOverrides: [],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Step 6: Individual override further restricts
  it('individual override further restricts (read_write → hidden)', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [],
          individualOverrides: [
            { tableId: TABLE_ID, userId: USER_ID, fieldId: FIELD_A, accessState: 'hidden' },
          ],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('hidden');
  });

  // Step 6: Individual override restores within ceiling
  it('individual override restores (hidden via role restriction → read_only via override, within ceiling)', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'team_member', fieldId: FIELD_A, accessState: 'hidden' },
          ],
          individualOverrides: [
            { tableId: TABLE_ID, userId: USER_ID, fieldId: FIELD_A, accessState: 'read_only' },
          ],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Step 6: Individual override clamped by field ceiling
  it('individual override clamped by field ceiling (member_edit=false caps at read_only)', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      fieldPermissions: { [FIELD_A]: { member_edit: false } },
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'team_member', fieldId: FIELD_A, accessState: 'hidden' },
          ],
          individualOverrides: [
            { tableId: TABLE_ID, userId: USER_ID, fieldId: FIELD_A, accessState: 'read_write' },
          ],
        },
      },
    });
    // Override wants read_write, but field ceiling is read_only (member_edit=false)
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Combined scenario
  it('combined: role restriction + individual override + field ceiling interaction', () => {
    const ctx = makeContext({
      effectiveRole: 'manager',
      fieldPermissions: { [FIELD_A]: { member_edit: false } },
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'manager', fieldId: FIELD_A, accessState: 'hidden' },
          ],
          individualOverrides: [
            // Override tries to restore to read_write, but ceiling is read_only
            { tableId: TABLE_ID, userId: USER_ID, fieldId: FIELD_A, accessState: 'read_write' },
          ],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_only');
  });

  // Empty restrictions/overrides → role defaults
  it('empty restrictions and overrides → role defaults apply', () => {
    const ctx = makeContext({ effectiveRole: 'team_member' });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');

    const viewerCtx = makeContext({ effectiveRole: 'viewer' });
    expect(resolveFieldPermission(FIELD_A, viewerCtx)).toBe('read_only');
  });

  // Restriction for different table doesn't apply
  it('role restriction for different table is ignored', () => {
    const otherTable = 'tttttttt-0000-0000-0000-000000000099';
    const ctx = makeContext({
      effectiveRole: 'team_member',
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: otherTable, role: 'team_member', fieldId: FIELD_A, accessState: 'hidden' },
          ],
          individualOverrides: [],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');
  });

  // Override for different user doesn't apply
  it('individual override for different user is ignored', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [],
          individualOverrides: [
            { tableId: TABLE_ID, userId: OTHER_USER, fieldId: FIELD_A, accessState: 'hidden' },
          ],
        },
      },
    });
    expect(resolveFieldPermission(FIELD_A, ctx)).toBe('read_write');
  });

  // Determinism
  it('same inputs produce the same output (determinism)', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      fieldPermissions: { [FIELD_A]: { member_edit: false } },
      viewPermissions: {
        ...emptyViewPermissions(),
        fieldPermissions: {
          roleRestrictions: [
            { tableId: TABLE_ID, role: 'team_member', fieldId: FIELD_A, accessState: 'hidden' },
          ],
          individualOverrides: [
            { tableId: TABLE_ID, userId: USER_ID, fieldId: FIELD_A, accessState: 'read_only' },
          ],
        },
      },
    });

    const results = Array.from({ length: 10 }, () => resolveFieldPermission(FIELD_A, ctx));
    const allSame = results.every((r) => r === results[0]);
    expect(allSame).toBe(true);
    expect(results[0]).toBe('read_only');
  });
});

// ---------------------------------------------------------------------------
// resolveAllFieldPermissions
// ---------------------------------------------------------------------------

describe('resolveAllFieldPermissions', () => {
  it('returns a complete map for all fieldIds', () => {
    const ctx = makeContext({
      effectiveRole: 'team_member',
      viewFieldOverrides: [FIELD_A, FIELD_B], // FIELD_C not in view
      fieldPermissions: { [FIELD_B]: { member_edit: false } },
    });

    const result = resolveAllFieldPermissions(ctx);

    expect(result.size).toBe(3);
    expect(result.get(FIELD_A)).toBe('read_write');
    expect(result.get(FIELD_B)).toBe('read_only');
    expect(result.get(FIELD_C)).toBe('hidden'); // not in viewFieldOverrides
  });

  it('admin gets read_write for all fields in view', () => {
    const ctx = makeContext({ effectiveRole: 'admin' });
    const result = resolveAllFieldPermissions(ctx);

    expect(result.get(FIELD_A)).toBe('read_write');
    expect(result.get(FIELD_B)).toBe('read_write');
    expect(result.get(FIELD_C)).toBe('read_write');
  });
});
