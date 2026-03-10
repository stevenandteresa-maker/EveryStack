// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './sidebar';
import { useSidebarStore } from '../../stores/sidebar-store';
import { ShellAccentProvider } from '../../components/shell/ShellAccentProvider';
import { IntlWrapper } from '../../test-utils/intl-wrapper';
import type { SidebarNavigation } from '../../data/sidebar-navigation';

// Mock Clerk and Next.js router (required by TenantSwitcher + SidebarHeader)
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ setActive: vi.fn().mockResolvedValue(undefined) }),
  useUser: () => ({ user: { fullName: 'Test User', imageUrl: null }, isLoaded: true }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const mockNavData: SidebarNavigation = {
  tenants: [
    {
      tenantId: 'tenant-1',
      tenantName: 'Acme Corp',
      accentColor: '#0D9488',
      isPersonalTenant: false,
      isActive: true,
      workspaces: [
        { workspaceId: 'ws-1', workspaceName: 'Marketing', icon: null },
      ],
      boards: [],
    },
  ],
  portals: [],
};

function renderSidebar(navData?: SidebarNavigation | null) {
  return render(
    <IntlWrapper>
      <ShellAccentProvider>
        <Sidebar navData={navData} />
      </ShellAccentProvider>
    </IntlWrapper>,
  );
}

describe('Sidebar', () => {
  beforeEach(() => {
    useSidebarStore.setState({ collapsed: true });
    localStorage.clear();
  });

  it('renders in collapsed state by default', () => {
    renderSidebar();
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(sidebar.style.width).toBe('var(--sidebar-width-collapsed)');
  });

  it('expands to full width when toggle is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar(mockNavData);

    const toggle = screen.getByTestId('sidebar-toggle');
    await user.click(toggle);

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.style.width).toBe('var(--sidebar-width-expanded)');
  });

  it('collapses back when toggle is clicked again', async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsed: false });
    renderSidebar(mockNavData);

    const toggle = screen.getByTestId('sidebar-toggle');
    await user.click(toggle);

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.style.width).toBe('var(--sidebar-width-collapsed)');
  });

  it('shows icon rail items with accessible labels', () => {
    renderSidebar();
    expect(screen.getByLabelText('Home')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasks')).toBeInTheDocument();
    expect(screen.getByLabelText('Chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Calendar')).toBeInTheDocument();
    expect(screen.getByLabelText('Help')).toBeInTheDocument();
  });

  it('shows icon rail always visible even when expanded', () => {
    useSidebarStore.setState({ collapsed: false });
    renderSidebar(mockNavData);
    expect(screen.getByTestId('icon-rail')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-content')).toBeInTheDocument();
  });

  it('hides content zone when collapsed', () => {
    renderSidebar(mockNavData);
    expect(screen.queryByTestId('sidebar-content')).not.toBeInTheDocument();
  });

  it('shows skeleton when navData is null', () => {
    useSidebarStore.setState({ collapsed: false });
    renderSidebar(null);
    expect(screen.getByTestId('sidebar-skeleton')).toBeInTheDocument();
  });

  it('renders tenant sections when expanded with nav data', () => {
    useSidebarStore.setState({ collapsed: false });
    renderSidebar(mockNavData);
    expect(screen.getByTestId('tenant-section-tenant-1')).toBeInTheDocument();
  });

  it('renders portal entries when present', () => {
    useSidebarStore.setState({ collapsed: false });
    const withPortals: SidebarNavigation = {
      ...mockNavData,
      portals: [
        { portalId: 'portal-1', portalName: 'Client Portal', tenantName: 'Acme', portalSlug: 'client-portal' },
      ],
    };
    renderSidebar(withPortals);
    expect(screen.getByText('Portals')).toBeInTheDocument();
    expect(screen.getByTestId('portal-entry-portal-1')).toBeInTheDocument();
  });

  it('persists state to localStorage via Zustand', async () => {
    const user = userEvent.setup();
    renderSidebar();

    const toggle = screen.getByTestId('sidebar-toggle');
    await user.click(toggle);

    const stored = localStorage.getItem('everystack-sidebar');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string);
    expect(parsed.state.collapsed).toBe(false);
  });
});
