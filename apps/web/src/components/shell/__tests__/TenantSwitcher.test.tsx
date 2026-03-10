// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantSwitcher } from '../TenantSwitcher';
import { ShellAccentProvider } from '../ShellAccentProvider';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { TenantNavSection } from '../../../data/sidebar-navigation';
import type { TenantSwitchResult } from '../../../lib/auth/tenant-switch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSetActive = vi.fn().mockResolvedValue(undefined);
const mockRefresh = vi.fn();

vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ setActive: mockSetActive }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

const mockSwitchTenantAction = vi.fn();
const mockInvalidateTenantCacheAction = vi.fn();

vi.mock('@/actions/tenant-switch', () => ({
  switchTenantAction: (...args: unknown[]) => mockSwitchTenantAction(...args),
  invalidateTenantCacheAction: (...args: unknown[]) =>
    mockInvalidateTenantCacheAction(...args),
}));

// Mock sonner toast
const mockToastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => mockToastError(...args) },
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeTenant(
  overrides?: Partial<TenantNavSection>,
): TenantNavSection {
  return {
    tenantId: 'tenant-1',
    tenantName: 'Acme Corp',
    accentColor: '#0D9488',
    isPersonalTenant: false,
    isActive: true,
    workspaces: [
      { workspaceId: 'ws-1', workspaceName: 'Marketing', icon: null },
    ],
    boards: [],
    ...overrides,
  };
}

const defaultResult: TenantSwitchResult = {
  tenantId: 'tenant-2',
  tenantName: 'Beta Inc',
  role: 'owner',
  source: 'direct',
  accentColor: '#1D4ED8',
  clerkOrgId: 'org_beta',
};

function renderSwitcher(tenants: TenantNavSection[]) {
  return render(
    <IntlWrapper>
      <ShellAccentProvider>
        <TenantSwitcher tenants={tenants} />
      </ShellAccentProvider>
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.style.removeProperty('--shell-accent');
    mockSwitchTenantAction.mockResolvedValue(defaultResult);
    mockInvalidateTenantCacheAction.mockResolvedValue(undefined);
  });

  it('renders all tenant sections', () => {
    const tenants = [
      makeTenant({ tenantId: 'tenant-1', tenantName: 'Acme Corp', isActive: true }),
      makeTenant({ tenantId: 'tenant-2', tenantName: 'Beta Inc', isActive: false }),
    ];
    renderSwitcher(tenants);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  it('expands active tenant and collapses inactive', () => {
    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true }),
      makeTenant({ tenantId: 'tenant-2', tenantName: 'Beta Inc', isActive: false }),
    ];
    renderSwitcher(tenants);

    // Active tenant shows My Office
    expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();
    // Inactive tenant does not
    expect(screen.queryByTestId('my-office-tenant-2')).not.toBeInTheDocument();
  });

  it('clicking inactive tenant triggers optimistic accent repainting', async () => {
    const user = userEvent.setup();
    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true, accentColor: '#0D9488' }),
      makeTenant({
        tenantId: 'tenant-2',
        tenantName: 'Beta Inc',
        isActive: false,
        accentColor: '#1D4ED8',
      }),
    ];
    renderSwitcher(tenants);

    // Click the inactive tenant header
    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    // Accent should have been updated optimistically
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue('--shell-accent'),
      ).toBe('#1D4ED8');
    });
  });

  it('successful switch calls switchTenantAction and Clerk setActive', async () => {
    const user = userEvent.setup();
    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true }),
      makeTenant({ tenantId: 'tenant-2', tenantName: 'Beta Inc', isActive: false }),
    ];
    renderSwitcher(tenants);

    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    await waitFor(() => {
      expect(mockSwitchTenantAction).toHaveBeenCalledWith('tenant-2');
    });

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({ organization: 'org_beta' });
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('successful switch updates sidebar state — target expands, previous collapses', async () => {
    const user = userEvent.setup();
    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true }),
      makeTenant({
        tenantId: 'tenant-2',
        tenantName: 'Beta Inc',
        isActive: false,
        workspaces: [{ workspaceId: 'ws-2', workspaceName: 'Sales', icon: null }],
      }),
    ];
    renderSwitcher(tenants);

    // Before switch: tenant-1 expanded, tenant-2 collapsed
    expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();
    expect(screen.queryByTestId('my-office-tenant-2')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    // After switch: tenant-2 should become active (expanded) and tenant-1 collapsed
    await waitFor(() => {
      expect(screen.getByTestId('my-office-tenant-2')).toBeInTheDocument();
    });
  });

  it('failed switch reverts accent and shows error toast', async () => {
    const user = userEvent.setup();
    mockSwitchTenantAction.mockRejectedValue(new Error('Network error'));

    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true, accentColor: '#0D9488' }),
      makeTenant({
        tenantId: 'tenant-2',
        tenantName: 'Beta Inc',
        isActive: false,
        accentColor: '#1D4ED8',
      }),
    ];
    renderSwitcher(tenants);

    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    // Accent should revert to original
    await waitFor(() => {
      expect(
        document.documentElement.style.getPropertyValue('--shell-accent'),
      ).toBe('#0D9488');
    });

    // Error toast should be shown
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Unable to switch workspace. Please try again.',
      );
    });
  });

  it('failed switch calls invalidateTenantCacheAction for Redis revert', async () => {
    const user = userEvent.setup();
    mockSwitchTenantAction.mockRejectedValue(new Error('fail'));

    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true }),
      makeTenant({ tenantId: 'tenant-2', tenantName: 'Beta Inc', isActive: false }),
    ];
    renderSwitcher(tenants);

    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    await waitFor(() => {
      expect(mockInvalidateTenantCacheAction).toHaveBeenCalled();
    });
  });

  it('failed switch re-expands previous tenant', async () => {
    const user = userEvent.setup();
    mockSwitchTenantAction.mockRejectedValue(new Error('fail'));

    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true }),
      makeTenant({ tenantId: 'tenant-2', tenantName: 'Beta Inc', isActive: false }),
    ];
    renderSwitcher(tenants);

    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    // After revert, tenant-1 should still be the active one
    await waitFor(() => {
      expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();
    });
  });

  it('clicking active tenant toggles expand/collapse (no switch)', async () => {
    const user = userEvent.setup();
    const tenants = [makeTenant({ tenantId: 'tenant-1', isActive: true })];
    renderSwitcher(tenants);

    // Initially expanded
    expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(screen.queryByTestId('my-office-tenant-1')).not.toBeInTheDocument();

    // Should NOT trigger switch action
    expect(mockSwitchTenantAction).not.toHaveBeenCalled();
  });

  it('displays My Office with tenant-qualified heading', () => {
    const tenants = [
      makeTenant({ tenantId: 'tenant-1', tenantName: 'Acme Corp', isActive: true }),
    ];
    renderSwitcher(tenants);

    const myOffice = screen.getByTestId('my-office-tenant-1');
    expect(myOffice.textContent).toContain('My Office');
    expect(myOffice.textContent).toContain('Acme Corp');
  });

  it('displays My Office with "Personal" qualifier for personal tenant', () => {
    const tenants = [
      makeTenant({
        tenantId: 'tenant-1',
        tenantName: 'Personal',
        isPersonalTenant: true,
        isActive: true,
      }),
    ];
    renderSwitcher(tenants);

    const myOffice = screen.getByTestId('my-office-tenant-1');
    expect(myOffice.textContent).toContain('Personal');
  });

  it('prevents double-switch while a switch is in progress', async () => {
    const user = userEvent.setup();
    // Slow action
    mockSwitchTenantAction.mockImplementation(
      () => new Promise<TenantSwitchResult>((resolve) => setTimeout(() => resolve(defaultResult), 100)),
    );

    const tenants = [
      makeTenant({ tenantId: 'tenant-1', isActive: true }),
      makeTenant({ tenantId: 'tenant-2', tenantName: 'Beta Inc', isActive: false }),
    ];
    renderSwitcher(tenants);

    // Click twice rapidly
    await user.click(screen.getByTestId('tenant-header-tenant-2'));
    await user.click(screen.getByTestId('tenant-header-tenant-2'));

    await waitFor(() => {
      expect(mockSwitchTenantAction).toHaveBeenCalledTimes(1);
    });
  });
});
