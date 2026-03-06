import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestTenantMembership,
  createTestWorkspace,
  createTestBoard,
  createTestWorkspaceMembership,
  createTestPortal,
  createTestPortalAccess,
} from '@everystack/shared/testing';
import { getSidebarNavigation } from '@/data/sidebar-navigation';

describe('Sidebar Navigation Data Fetcher', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('user only sees tenants they have membership in', async () => {
      // User A is a member of Tenant X
      const userA = await createTestUser();
      const tenantX = await createTestTenant({ name: 'Tenant X' });
      await createTestTenantMembership({
        tenantId: tenantX.id,
        userId: userA.id,
        role: 'owner',
        status: 'active',
      });
      await createTestWorkspace({ tenantId: tenantX.id, createdBy: userA.id });

      // User B is a member of Tenant Y (User A has no access)
      const userB = await createTestUser();
      const tenantY = await createTestTenant({ name: 'Tenant Y' });
      await createTestTenantMembership({
        tenantId: tenantY.id,
        userId: userB.id,
        role: 'owner',
        status: 'active',
      });
      await createTestWorkspace({ tenantId: tenantY.id, createdBy: userB.id });

      const result = await getSidebarNavigation(userA.id, tenantX.id);

      // User A should only see Tenant X
      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0]!.tenantId).toBe(tenantX.id);
      expect(result.tenants.find((t) => t.tenantId === tenantY.id)).toBeUndefined();
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Personal Tenant Ordering
  // -------------------------------------------------------------------------

  describe('personal tenant ordering', () => {
    it('sorts personal tenant first', async () => {
      const personalTenant = await createTestTenant({
        name: 'Personal',
        settings: { personal: true, auto_provisioned: true },
      });
      const orgTenant = await createTestTenant({ name: 'Acme Corp' });

      const user = await createTestUser({ personalTenantId: personalTenant.id });

      await createTestTenantMembership({
        tenantId: personalTenant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });
      await createTestTenantMembership({
        tenantId: orgTenant.id,
        userId: user.id,
        role: 'member',
        status: 'active',
      });

      // Both tenants need at least one workspace (personal hidden if empty)
      await createTestWorkspace({ tenantId: personalTenant.id, createdBy: user.id });
      await createTestWorkspace({ tenantId: orgTenant.id, createdBy: user.id });

      // For org tenant as member, need workspace membership
      const orgWs = await createTestWorkspace({ tenantId: orgTenant.id, createdBy: user.id });
      await createTestWorkspaceMembership({
        tenantId: orgTenant.id,
        workspaceId: orgWs.id,
        userId: user.id,
        role: 'manager',
      });

      const result = await getSidebarNavigation(user.id, orgTenant.id);

      expect(result.tenants.length).toBeGreaterThanOrEqual(2);
      expect(result.tenants[0]!.isPersonalTenant).toBe(true);
      expect(result.tenants[0]!.tenantName).toBe('Personal');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Personal Tenant Hidden if Empty
  // -------------------------------------------------------------------------

  describe('personal tenant hidden if empty', () => {
    it('excludes personal tenant when it has no workspaces', async () => {
      const personalTenant = await createTestTenant({
        name: 'Personal',
        settings: { personal: true, auto_provisioned: true },
      });
      const orgTenant = await createTestTenant({ name: 'Org Tenant' });

      const user = await createTestUser({ personalTenantId: personalTenant.id });

      await createTestTenantMembership({
        tenantId: personalTenant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });
      await createTestTenantMembership({
        tenantId: orgTenant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });

      // Only org tenant has workspaces — personal has none
      await createTestWorkspace({ tenantId: orgTenant.id, createdBy: user.id });

      const result = await getSidebarNavigation(user.id, orgTenant.id);

      expect(result.tenants.find((t) => t.isPersonalTenant)).toBeUndefined();
      expect(result.tenants).toHaveLength(1);
      expect(result.tenants[0]!.tenantId).toBe(orgTenant.id);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Board Grouping
  // -------------------------------------------------------------------------

  describe('board grouping', () => {
    it('groups workspaces under their board', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });

      const board = await createTestBoard({ tenantId: tenant.id, name: 'Marketing Board' });

      // Workspace under board
      const wsGrouped = await createTestWorkspace({
        tenantId: tenant.id,
        boardId: board.id,
        name: 'Grouped WS',
        createdBy: user.id,
      });

      // Workspace without board
      const wsFlat = await createTestWorkspace({
        tenantId: tenant.id,
        name: 'Flat WS',
        createdBy: user.id,
      });

      const result = await getSidebarNavigation(user.id, tenant.id);

      const section = result.tenants.find((t) => t.tenantId === tenant.id)!;
      expect(section).toBeDefined();

      // Board group should contain the grouped workspace
      expect(section.boards).toHaveLength(1);
      expect(section.boards[0]!.boardName).toBe('Marketing Board');
      expect(section.boards[0]!.workspaces).toHaveLength(1);
      expect(section.boards[0]!.workspaces[0]!.workspaceId).toBe(wsGrouped.id);

      // Flat workspace should be in ungrouped list
      expect(section.workspaces.some((w) => w.workspaceId === wsFlat.id)).toBe(true);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Portal Entries
  // -------------------------------------------------------------------------

  describe('portal entries', () => {
    it('includes active portal access and excludes revoked', async () => {
      const tenant = await createTestTenant({ name: 'Client Org' });
      const user = await createTestUser();
      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });
      await createTestWorkspace({ tenantId: tenant.id, createdBy: user.id });

      // Create an active portal access for this user's email
      const portal = await createTestPortal({
        tenantId: tenant.id,
        name: 'Client Portal',
      });
      await createTestPortalAccess({
        tenantId: tenant.id,
        portalId: portal.id,
        email: user.email,
      });

      // Create a revoked portal access
      const portal2 = await createTestPortal({
        tenantId: tenant.id,
        name: 'Revoked Portal',
      });
      await createTestPortalAccess({
        tenantId: tenant.id,
        portalId: portal2.id,
        email: user.email,
        revokedAt: new Date(),
        revokedReason: 'manager_revoked',
      });

      const result = await getSidebarNavigation(user.id, tenant.id);

      // Should include active portal, exclude revoked
      expect(result.portals).toHaveLength(1);
      expect(result.portals[0]!.portalName).toBe('Client Portal');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Role-Based Workspace Visibility
  // -------------------------------------------------------------------------

  describe('role-based workspace visibility', () => {
    it('owner sees all workspaces, member sees only workspace memberships', async () => {
      const tenant = await createTestTenant();
      const owner = await createTestUser();
      const member = await createTestUser();

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: owner.id,
        role: 'owner',
        status: 'active',
      });
      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: member.id,
        role: 'member',
        status: 'active',
      });

      const ws1 = await createTestWorkspace({
        tenantId: tenant.id,
        name: 'All Access WS',
        createdBy: owner.id,
      });
      const ws2 = await createTestWorkspace({
        tenantId: tenant.id,
        name: 'Restricted WS',
        createdBy: owner.id,
      });

      // Member only has membership to ws1
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: ws1.id,
        userId: member.id,
        role: 'team_member',
      });

      // Owner sees both
      const ownerResult = await getSidebarNavigation(owner.id, tenant.id);
      const ownerSection = ownerResult.tenants.find((t) => t.tenantId === tenant.id)!;
      const ownerWsIds = [
        ...ownerSection.workspaces.map((w) => w.workspaceId),
        ...ownerSection.boards.flatMap((b) => b.workspaces.map((w) => w.workspaceId)),
      ];
      expect(ownerWsIds).toContain(ws1.id);
      expect(ownerWsIds).toContain(ws2.id);

      // Member sees only ws1
      const memberResult = await getSidebarNavigation(member.id, tenant.id);
      const memberSection = memberResult.tenants.find((t) => t.tenantId === tenant.id)!;
      const memberWsIds = [
        ...memberSection.workspaces.map((w) => w.workspaceId),
        ...memberSection.boards.flatMap((b) => b.workspaces.map((w) => w.workspaceId)),
      ];
      expect(memberWsIds).toContain(ws1.id);
      expect(memberWsIds).not.toContain(ws2.id);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Active Tenant Flag
  // -------------------------------------------------------------------------

  describe('active tenant flag', () => {
    it('sets isActive on the matching activeTenantId', async () => {
      const tenantA = await createTestTenant({ name: 'Tenant A' });
      const tenantB = await createTestTenant({ name: 'Tenant B' });
      const user = await createTestUser();

      await createTestTenantMembership({
        tenantId: tenantA.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });
      await createTestTenantMembership({
        tenantId: tenantB.id,
        userId: user.id,
        role: 'owner',
        status: 'active',
      });

      await createTestWorkspace({ tenantId: tenantA.id, createdBy: user.id });
      await createTestWorkspace({ tenantId: tenantB.id, createdBy: user.id });

      const result = await getSidebarNavigation(user.id, tenantA.id);

      const sectionA = result.tenants.find((t) => t.tenantId === tenantA.id)!;
      const sectionB = result.tenants.find((t) => t.tenantId === tenantB.id)!;

      expect(sectionA.isActive).toBe(true);
      expect(sectionB.isActive).toBe(false);
    }, 30_000);
  });
});
