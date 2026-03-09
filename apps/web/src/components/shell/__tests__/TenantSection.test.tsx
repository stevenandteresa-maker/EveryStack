// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TenantSection } from '../TenantSection';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { TenantNavSection } from '../../../data/sidebar-navigation';

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
    expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();
    expect(screen.getByText('Marketing')).toBeInTheDocument();
  });

  it('collapses inactive tenant by default', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection({ isActive: false })} />
      </IntlWrapper>,
    );
    // My Office should NOT be visible since inactive is collapsed
    expect(screen.queryByTestId('my-office-tenant-1')).not.toBeInTheDocument();
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
    expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();

    // Click to collapse
    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(screen.queryByTestId('my-office-tenant-1')).not.toBeInTheDocument();

    // Click to expand again
    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(screen.getByTestId('my-office-tenant-1')).toBeInTheDocument();
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

  it('displays tenant-qualified My Office heading', () => {
    render(
      <IntlWrapper>
        <TenantSection section={makeSection({ tenantName: 'Acme Corp', isActive: true })} />
      </IntlWrapper>,
    );

    const myOffice = screen.getByTestId('my-office-tenant-1');
    expect(myOffice.textContent).toContain('My Office');
    expect(myOffice.textContent).toContain('Acme Corp');
  });

  it('displays "Personal" qualifier for personal tenant', () => {
    render(
      <IntlWrapper>
        <TenantSection
          section={makeSection({ isPersonalTenant: true, isActive: true })}
        />
      </IntlWrapper>,
    );

    const myOffice = screen.getByTestId('my-office-tenant-1');
    expect(myOffice.textContent).toContain('Personal');
  });

  it('calls onTenantSwitch when inactive tenant header is clicked', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <IntlWrapper>
        <TenantSection
          section={makeSection({ isActive: false })}
          onTenantSwitch={onSwitch}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(onSwitch).toHaveBeenCalledTimes(1);
  });

  it('does not call onTenantSwitch when active tenant header is clicked', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    render(
      <IntlWrapper>
        <TenantSection
          section={makeSection({ isActive: true })}
          onTenantSwitch={onSwitch}
        />
      </IntlWrapper>,
    );

    await user.click(screen.getByTestId('tenant-header-tenant-1'));
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
