// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantSection } from '../TenantSection';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import type { TenantNavSection } from '@/data/sidebar-navigation';

function makeSection(overrides?: Partial<TenantNavSection>): TenantNavSection {
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

describe('TenantSection', () => {
  it('renders tenant name and accent dot', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection()} />
      </IntlWrapper>,
    );
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('expands active tenant by default', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection({ isActive: true })} />
      </IntlWrapper>,
    );
    // My Office should be visible since active is expanded
    expect(screen.getByText('My Office')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('collapses inactive tenant by default', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection({ isActive: false })} />
      </IntlWrapper>,
    );
    // My Office should NOT be visible since inactive is collapsed
    expect(screen.queryByText('My Office')).not.toBeInTheDocument();
  });

  it('toggles expand/collapse on header click', async () => {
    const user = userEvent.setup();
    const section = makeSection({ isActive: true });

    render(
      <IntlWrapper>
        <TenantSection section={section} />
      </IntlWrapper>,
    );

    // Initially expanded
    expect(screen.getByText('My Office')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(screen.queryByText('My Office')).not.toBeInTheDocument();

    // Click to expand again
    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(screen.getByText('My Office')).toBeInTheDocument();
  });

  it('shows "No workspaces yet" when empty', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection({ workspaces: [], boards: [], isActive: true })} />
      </IntlWrapper>,
    );
    expect(screen.getByText('No workspaces yet')).toBeInTheDocument();
  });

  it('renders accent dot element', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection({ accentColor: '#E11D48' })} />
      </IntlWrapper>,
    );

    const header = screen.getByTestId('tenant-header-tenant-1');
    const dot = header.querySelector('span[aria-hidden="true"]');
    expect(dot).toBeTruthy();
    expect(dot?.className).toContain('rounded-full');
  });
});
