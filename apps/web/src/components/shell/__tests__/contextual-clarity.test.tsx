// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SidebarHeader } from '../SidebarHeader';
import { MyOfficeHeading } from '../MyOfficeHeading';
import { TenantSection } from '../TenantSection';
import { TenantSwitcher } from '../TenantSwitcher';
import { ShellAccentProvider } from '../ShellAccentProvider';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import {
  PERSONAL_TENANT_ACCENT,
  ORG_ACCENT_OPTIONS,
} from '@/lib/design-system/shell-accent';
import type { TenantNavSection } from '@/data/sidebar-navigation';
import type { TenantSwitchResult } from '@/lib/auth/tenant-switch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseUser = vi.fn();
vi.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useClerk: () => ({ setActive: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const mockSwitchTenantAction = vi.fn();
const mockInvalidateTenantCacheAction = vi.fn();

vi.mock('@/actions/tenant-switch', () => ({
  switchTenantAction: (...args: unknown[]) => mockSwitchTenantAction(...args),
  invalidateTenantCacheAction: (...args: unknown[]) =>
    mockInvalidateTenantCacheAction(...args),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePersonalTenant(
  overrides?: Partial<TenantNavSection>,
): TenantNavSection {
  return {
    tenantId: 'tenant-personal',
    tenantName: "Steven's Workspace",
    accentColor: PERSONAL_TENANT_ACCENT,
    isPersonalTenant: true,
    isActive: true,
    workspaces: [
      { workspaceId: 'ws-1', workspaceName: 'My Projects', icon: null },
    ],
    boards: [],
    ...overrides,
  };
}

function makeOrgTenant(
  overrides?: Partial<TenantNavSection>,
): TenantNavSection {
  return {
    tenantId: 'tenant-org',
    tenantName: 'Acme Corp',
    accentColor: '#1D4ED8',
    isPersonalTenant: false,
    isActive: true,
    workspaces: [
      { workspaceId: 'ws-2', workspaceName: 'Marketing', icon: null },
    ],
    boards: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  document.documentElement.style.removeProperty('--shell-accent');
  mockUseUser.mockReturnValue({
    user: {
      fullName: 'Steven Yeats',
      firstName: 'Steven',
      imageUrl: 'https://example.com/avatar.jpg',
    },
    isLoaded: true,
  });

  const defaultResult: TenantSwitchResult = {
    tenantId: 'tenant-org',
    tenantName: 'Acme Corp',
    role: 'owner',
    source: 'direct',
    accentColor: '#1D4ED8',
    clerkOrgId: 'org_acme',
  };
  mockSwitchTenantAction.mockResolvedValue(defaultResult);
  mockInvalidateTenantCacheAction.mockResolvedValue(undefined);
});

// ===========================================================================
// SidebarHeader — Signal 1
// ===========================================================================

describe('SidebarHeader', () => {
  describe('Personal tenant', () => {
    it('shows user avatar image for personal tenant', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makePersonalTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      const avatar = screen.getByTestId('sidebar-header-avatar');
      expect(avatar.tagName).toBe('IMG');
      // next/image encodes the src URL — verify it contains the original URL
      const src = avatar.getAttribute('src') ?? '';
      expect(src).toContain('example.com');
      expect(src).toContain('avatar.jpg');
    });

    it('shows tenant name for personal tenant', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makePersonalTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('sidebar-header-name')).toHaveTextContent(
        "Steven's Workspace",
      );
    });

    it('shows "Personal" qualifier for personal tenant', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makePersonalTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('sidebar-header-qualifier')).toHaveTextContent(
        'Personal',
      );
    });

    it('falls back to first-letter avatar when no Clerk image', () => {
      mockUseUser.mockReturnValue({ user: null, isLoaded: true });

      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makePersonalTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      const avatar = screen.getByTestId('sidebar-header-avatar');
      expect(avatar.tagName).toBe('DIV');
      expect(avatar).toHaveTextContent('S');
    });
  });

  describe('Org tenant', () => {
    it('shows first-letter avatar with shell accent background', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makeOrgTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      const avatar = screen.getByTestId('sidebar-header-avatar');
      expect(avatar.tagName).toBe('DIV');
      expect(avatar).toHaveTextContent('A');
      expect(avatar.className).toContain('bg-[var(--shell-accent)]');
    });

    it('shows org name without "Personal" qualifier', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makeOrgTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('sidebar-header-name')).toHaveTextContent(
        'Acme Corp',
      );
      expect(
        screen.queryByTestId('sidebar-header-qualifier'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Collapsed state', () => {
    it('renders sidebar header in collapsed mode', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makeOrgTenant()} collapsed={true} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-header-avatar')).toBeInTheDocument();
    });

    it('does not show text in collapsed mode', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makeOrgTenant()} collapsed={true} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      expect(screen.queryByTestId('sidebar-header-name')).not.toBeInTheDocument();
    });
  });

  describe('Expanded state', () => {
    it('renders sidebar header with text in expanded mode', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makeOrgTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      expect(screen.getByTestId('sidebar-header')).toBeInTheDocument();
      expect(screen.getByTestId('sidebar-header-name')).toBeInTheDocument();
    });

    it('has sticky positioning for scroll persistence', () => {
      render(
        <IntlWrapper>
          <ShellAccentProvider>
            <SidebarHeader activeTenant={makeOrgTenant()} collapsed={false} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      const header = screen.getByTestId('sidebar-header');
      expect(header.className).toContain('sticky');
      expect(header.className).toContain('top-0');
    });
  });

  it('renders nothing when no active tenant', () => {
    render(
      <IntlWrapper>
        <ShellAccentProvider>
          <SidebarHeader activeTenant={null} collapsed={false} />
        </ShellAccentProvider>
      </IntlWrapper>,
    );

    expect(screen.queryByTestId('sidebar-header')).not.toBeInTheDocument();
  });

  it('has accessible role="banner"', () => {
    render(
      <IntlWrapper>
        <ShellAccentProvider>
          <SidebarHeader activeTenant={makeOrgTenant()} collapsed={false} />
        </ShellAccentProvider>
      </IntlWrapper>,
    );

    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});

// ===========================================================================
// MyOfficeHeading — Signal 3
// ===========================================================================

describe('MyOfficeHeading', () => {
  it('renders "My Office · Personal" for personal tenant', () => {
    render(
      <IntlWrapper>
        <MyOfficeHeading isPersonalTenant={true} tenantName="Steven's Workspace" />
      </IntlWrapper>,
    );

    const heading = screen.getByTestId('my-office-heading');
    expect(heading.tagName).toBe('H1');
    expect(heading).toHaveTextContent('My Office');
    expect(heading).toHaveTextContent('Personal');
  });

  it('renders "My Office · [Tenant Name]" for org tenant', () => {
    render(
      <IntlWrapper>
        <MyOfficeHeading isPersonalTenant={false} tenantName="Acme Corp" />
      </IntlWrapper>,
    );

    const heading = screen.getByTestId('my-office-heading');
    expect(heading).toHaveTextContent('My Office');
    expect(heading).toHaveTextContent('Acme Corp');
  });

  it('renders client tenant name for agency member in client tenant', () => {
    render(
      <IntlWrapper>
        <MyOfficeHeading isPersonalTenant={false} tenantName="Client Co" />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('my-office-heading')).toHaveTextContent(
      'Client Co',
    );
  });

  it('uses i18n keys (heading_personal)', () => {
    render(
      <IntlWrapper>
        <MyOfficeHeading isPersonalTenant={true} tenantName="Irrelevant" />
      </IntlWrapper>,
    );

    // The i18n key my_office.heading_personal produces "My Office · Personal"
    expect(screen.getByTestId('my-office-heading').textContent).toBe(
      'My Office · Personal',
    );
  });

  it('uses i18n keys (heading_org) with interpolation', () => {
    render(
      <IntlWrapper>
        <MyOfficeHeading isPersonalTenant={false} tenantName="Beta Inc" />
      </IntlWrapper>,
    );

    // The i18n key my_office.heading_org produces "My Office · {tenantName}"
    expect(screen.getByTestId('my-office-heading').textContent).toBe(
      'My Office · Beta Inc',
    );
  });
});

// ===========================================================================
// Signal 2 — Shell Colour (Personal accent exclusion)
// ===========================================================================

describe('Personal accent color exclusion', () => {
  it('personal accent (#78716C) is NOT in org accent options', () => {
    const orgHexes = ORG_ACCENT_OPTIONS.map((opt) => opt.hex.toUpperCase());
    expect(orgHexes).not.toContain(PERSONAL_TENANT_ACCENT.toUpperCase());
  });

  it('all 8 org accent colors are present', () => {
    expect(ORG_ACCENT_OPTIONS).toHaveLength(8);
  });

  it('personal accent value is #78716C (warm neutral)', () => {
    expect(PERSONAL_TENANT_ACCENT).toBe('#78716C');
  });
});

// ===========================================================================
// Three Signals — Integration
// ===========================================================================

describe('Contextual Clarity — Three Signals Integration', () => {
  describe('Personal tenant shows all three signals', () => {
    it('renders sidebar header, personal accent, and My Office heading simultaneously', () => {
      const personal = makePersonalTenant();

      render(
        <IntlWrapper>
          <ShellAccentProvider initialAccent={PERSONAL_TENANT_ACCENT}>
            {/* Signal 1: Sidebar Header */}
            <SidebarHeader activeTenant={personal} collapsed={false} />
            {/* Signal 3: My Office heading */}
            <MyOfficeHeading
              isPersonalTenant={true}
              tenantName={personal.tenantName}
            />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      // Signal 1: Sidebar header with user name
      expect(screen.getByTestId('sidebar-header-name')).toHaveTextContent(
        "Steven's Workspace",
      );
      expect(screen.getByTestId('sidebar-header-qualifier')).toHaveTextContent(
        'Personal',
      );

      // Signal 2: Shell accent is personal warm neutral
      expect(
        document.documentElement.style.getPropertyValue('--shell-accent'),
      ).toBe(PERSONAL_TENANT_ACCENT);

      // Signal 3: My Office heading
      expect(screen.getByTestId('my-office-heading')).toHaveTextContent(
        'My Office · Personal',
      );
    });
  });

  describe('Org tenant shows all three signals', () => {
    it('renders sidebar header, org accent, and My Office heading simultaneously', () => {
      const org = makeOrgTenant();

      render(
        <IntlWrapper>
          <ShellAccentProvider initialAccent={org.accentColor}>
            {/* Signal 1: Sidebar Header */}
            <SidebarHeader activeTenant={org} collapsed={false} />
            {/* Signal 3: My Office heading */}
            <MyOfficeHeading
              isPersonalTenant={false}
              tenantName={org.tenantName}
            />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      // Signal 1: Sidebar header with org name
      expect(screen.getByTestId('sidebar-header-name')).toHaveTextContent(
        'Acme Corp',
      );
      expect(
        screen.queryByTestId('sidebar-header-qualifier'),
      ).not.toBeInTheDocument();

      // Signal 2: Shell accent is org color
      expect(
        document.documentElement.style.getPropertyValue('--shell-accent'),
      ).toBe('#1D4ED8');

      // Signal 3: My Office heading
      expect(screen.getByTestId('my-office-heading')).toHaveTextContent(
        'My Office · Acme Corp',
      );
    });
  });

  describe('Tenant switch updates all three signals', () => {
    it('switches from personal to org tenant — all signals update', async () => {
      const user = userEvent.setup();

      const personal = makePersonalTenant({ isActive: true });
      const org = makeOrgTenant({ isActive: false });

      const { rerender } = render(
        <IntlWrapper>
          <ShellAccentProvider initialAccent={PERSONAL_TENANT_ACCENT}>
            <TenantSwitcher tenants={[personal, org]} />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      // Signal 3: Personal My Office visible initially
      expect(screen.getByTestId('my-office-tenant-personal')).toHaveTextContent(
        'Personal',
      );

      // Signal 2: Shell accent starts as personal
      expect(
        document.documentElement.style.getPropertyValue('--shell-accent'),
      ).toBe(PERSONAL_TENANT_ACCENT);

      // Click org tenant to switch
      await user.click(screen.getByTestId('tenant-header-tenant-org'));

      // Signal 2: Shell accent updates to org color
      await waitFor(() => {
        expect(
          document.documentElement.style.getPropertyValue('--shell-accent'),
        ).toBe('#1D4ED8');
      });

      // Signal 3: Org My Office now visible
      await waitFor(() => {
        expect(
          screen.getByTestId('my-office-tenant-org'),
        ).toBeInTheDocument();
      });

      // Simulate re-render with updated active tenant (server response)
      const updatedOrg = { ...org, isActive: true };

      rerender(
        <IntlWrapper>
          <ShellAccentProvider initialAccent="#1D4ED8">
            <SidebarHeader activeTenant={updatedOrg} collapsed={false} />
            <MyOfficeHeading
              isPersonalTenant={false}
              tenantName={updatedOrg.tenantName}
            />
          </ShellAccentProvider>
        </IntlWrapper>,
      );

      // Signal 1: Sidebar header updated to org
      expect(screen.getByTestId('sidebar-header-name')).toHaveTextContent(
        'Acme Corp',
      );

      // Signal 3: My Office heading updated to org
      expect(screen.getByTestId('my-office-heading')).toHaveTextContent(
        'My Office · Acme Corp',
      );
    });
  });
});

// ===========================================================================
// Sidebar My Office — i18n in TenantSection (existing Signal 3 in sidebar)
// ===========================================================================

describe('TenantSection My Office labels use i18n', () => {
  it('personal tenant shows "My Office · Personal" in sidebar', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makePersonalTenant({ isActive: true })} />
      </IntlWrapper>,
    );

    const myOffice = screen.getByTestId('my-office-tenant-personal');
    expect(myOffice.textContent).toBe('My Office · Personal');
  });

  it('org tenant shows "My Office · [Tenant Name]" in sidebar', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeOrgTenant({ isActive: true })} />
      </IntlWrapper>,
    );

    const myOffice = screen.getByTestId('my-office-tenant-org');
    expect(myOffice.textContent).toBe('My Office · Acme Corp');
  });
});
