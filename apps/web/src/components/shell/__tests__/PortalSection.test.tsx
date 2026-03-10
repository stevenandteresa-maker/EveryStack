// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PortalSection } from '../PortalSection';
import { ShellAccentProvider } from '../ShellAccentProvider';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { PortalNavEntry } from '../../../data/sidebar-navigation';
import { PORTAL_ACCENT } from '../../../lib/design-system/shell-accent';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makePortal(overrides?: Partial<PortalNavEntry>): PortalNavEntry {
  return {
    portalId: 'portal-1',
    portalName: 'Client Portal',
    tenantName: 'Agency Corp',
    portalSlug: 'client-portal',
    ...overrides,
  };
}

function renderPortals(portals: PortalNavEntry[]) {
  return render(
    <IntlWrapper>
      <ShellAccentProvider>
        <PortalSection portals={portals} />
      </ShellAccentProvider>
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PortalSection', () => {
  beforeEach(() => {
    document.documentElement.style.removeProperty('--shell-accent');
  });

  it('renders nothing when no portal entries exist', () => {
    renderPortals([]);
    expect(screen.queryByTestId('portal-section')).not.toBeInTheDocument();
    expect(screen.queryByTestId('portal-divider')).not.toBeInTheDocument();
  });

  it('renders section divider when portals exist', () => {
    renderPortals([makePortal()]);
    expect(screen.getByTestId('portal-section')).toBeInTheDocument();
    expect(screen.getByTestId('portal-divider')).toBeInTheDocument();
    expect(screen.getByText('Portals')).toBeInTheDocument();
  });

  it('renders portal entries with portal names', () => {
    const portals = [
      makePortal({ portalId: 'p-1', portalName: 'Client A Portal' }),
      makePortal({ portalId: 'p-2', portalName: 'Client B Portal' }),
    ];
    renderPortals(portals);

    expect(screen.getByText('Client A Portal')).toBeInTheDocument();
    expect(screen.getByText('Client B Portal')).toBeInTheDocument();
  });

  it('renders portal entries with tenant names', () => {
    renderPortals([
      makePortal({ portalId: 'p-1', tenantName: 'Agency Corp' }),
    ]);

    expect(screen.getByText('Agency Corp')).toBeInTheDocument();
  });

  it('portal entries use portal accent color (not tenant accent)', () => {
    renderPortals([makePortal()]);

    const entry = screen.getByTestId('portal-entry-portal-1');
    const icon = entry.querySelector('svg');
    expect(icon).toBeTruthy();
    // Globe icon should use --portal-accent CSS variable
    expect(icon?.style.color).toBe('var(--portal-accent)');
  });

  it('portal accent is system-owned and matches PORTAL_ACCENT constant', () => {
    // Verify the portal accent constant is the expected value
    expect(PORTAL_ACCENT).toBe('#64748B');
  });

  it('portal entries render as links with correct href', () => {
    renderPortals([makePortal({ portalSlug: 'my-portal' })]);

    const entry = screen.getByTestId('portal-entry-portal-1');
    expect(entry.tagName).toBe('A');
    expect(entry.getAttribute('href')).toBe('/portal/my-portal');
  });

  it('portal click does not trigger shell repainting', async () => {
    const user = userEvent.setup();
    renderPortals([makePortal()]);

    const initialAccent =
      document.documentElement.style.getPropertyValue('--shell-accent');

    const entry = screen.getByTestId('portal-entry-portal-1');
    await user.click(entry);

    // Shell accent should remain unchanged after clicking a portal entry
    expect(
      document.documentElement.style.getPropertyValue('--shell-accent'),
    ).toBe(initialAccent);
  });

  it('portal entries have accessible labels', () => {
    renderPortals([makePortal({ portalName: 'Client Portal' })]);

    const entry = screen.getByTestId('portal-entry-portal-1');
    expect(entry.getAttribute('aria-label')).toBe('Open Client Portal portal');
  });

  it('data boundary enforcement — portal entries have no cross-link affordances', () => {
    renderPortals([makePortal()]);

    const entry = screen.getByTestId('portal-entry-portal-1');
    // Portal entries render as simple links, not interactive switcher buttons
    expect(entry.tagName).toBe('A');
    // No data-testid for workspace or tenant switching within portals
    expect(screen.queryByTestId('tenant-header-portal-1')).not.toBeInTheDocument();
  });

  it('renders multiple portal entries from different tenants', () => {
    const portals = [
      makePortal({
        portalId: 'p-1',
        portalName: 'Alpha Portal',
        tenantName: 'Alpha Inc',
      }),
      makePortal({
        portalId: 'p-2',
        portalName: 'Beta Portal',
        tenantName: 'Beta LLC',
      }),
    ];
    renderPortals(portals);

    expect(screen.getByTestId('portal-entry-p-1')).toBeInTheDocument();
    expect(screen.getByTestId('portal-entry-p-2')).toBeInTheDocument();
    expect(screen.getByText('Alpha Inc')).toBeInTheDocument();
    expect(screen.getByText('Beta LLC')).toBeInTheDocument();
  });
});
