import { describe, it, expect } from 'vitest';
import {
  TENANT_ROLES,
  WORKSPACE_ROLES,
  ROLE_HIERARCHY,
  roleAtLeast,
} from './roles';
import type { EffectiveRole } from './roles';

describe('role constants', () => {
  it('defines three tenant roles', () => {
    expect(TENANT_ROLES).toEqual(['owner', 'admin', 'member']);
  });

  it('defines three workspace roles', () => {
    expect(WORKSPACE_ROLES).toEqual(['manager', 'team_member', 'viewer']);
  });

  it('defines hierarchy for all five effective roles', () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(5);
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.manager);
    expect(ROLE_HIERARCHY.manager).toBeGreaterThan(ROLE_HIERARCHY.team_member);
    expect(ROLE_HIERARCHY.team_member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });
});

describe('roleAtLeast', () => {
  it('returns true when roles are equal', () => {
    const roles: EffectiveRole[] = ['owner', 'admin', 'manager', 'team_member', 'viewer'];
    for (const role of roles) {
      expect(roleAtLeast(role, role)).toBe(true);
    }
  });

  it('returns true when user role is higher', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('owner', 'viewer')).toBe(true);
    expect(roleAtLeast('admin', 'manager')).toBe(true);
    expect(roleAtLeast('admin', 'team_member')).toBe(true);
    expect(roleAtLeast('manager', 'team_member')).toBe(true);
    expect(roleAtLeast('manager', 'viewer')).toBe(true);
    expect(roleAtLeast('team_member', 'viewer')).toBe(true);
  });

  it('returns false when user role is lower', () => {
    expect(roleAtLeast('viewer', 'team_member')).toBe(false);
    expect(roleAtLeast('viewer', 'manager')).toBe(false);
    expect(roleAtLeast('viewer', 'admin')).toBe(false);
    expect(roleAtLeast('viewer', 'owner')).toBe(false);
    expect(roleAtLeast('team_member', 'manager')).toBe(false);
    expect(roleAtLeast('team_member', 'admin')).toBe(false);
    expect(roleAtLeast('manager', 'admin')).toBe(false);
    expect(roleAtLeast('admin', 'owner')).toBe(false);
  });
});
