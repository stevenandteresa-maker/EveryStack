// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { TableTabItem } from '../TableTabItem';
import type { TableTabItemProps } from '../TableTabItem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTab(overrides?: Partial<TableTabItemProps>) {
  const props: TableTabItemProps = {
    tableId: 'table-1',
    tableName: 'Client Tracker',
    isActive: false,
    platform: null,
    ...overrides,
  };

  return render(
    <IntlWrapper>
      <TableTabItem {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TableTabItem', () => {
  describe('native tables', () => {
    it('renders table name', () => {
      renderTab();
      expect(screen.getByText('Client Tracker')).toBeInTheDocument();
    });

    it('renders with correct test ID', () => {
      renderTab({ tableId: 'abc-123' });
      expect(screen.getByTestId('table-tab-abc-123')).toBeInTheDocument();
    });

    it('does not render platform badge', () => {
      renderTab();
      expect(screen.queryByTestId('platform-badge-airtable')).not.toBeInTheDocument();
      expect(screen.queryByTestId('platform-badge-notion')).not.toBeInTheDocument();
    });

    it('does not render sync status icon', () => {
      renderTab();
      expect(screen.queryByTestId('sync-status-icon-healthy')).not.toBeInTheDocument();
    });

    it('calls onClick when clicked', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      renderTab({ onClick });

      await user.click(screen.getByTestId('table-tab-table-1'));
      expect(onClick).toHaveBeenCalledOnce();
    });
  });

  describe('synced tables', () => {
    it('renders Airtable platform badge', () => {
      renderTab({
        platform: 'airtable',
        healthState: 'healthy',
      });
      expect(screen.getByTestId('platform-badge-airtable')).toBeInTheDocument();
    });

    it('renders Notion platform badge', () => {
      renderTab({
        platform: 'notion',
        healthState: 'healthy',
      });
      expect(screen.getByTestId('platform-badge-notion')).toBeInTheDocument();
    });

    it('renders sync status icon for healthy state', () => {
      renderTab({
        platform: 'airtable',
        healthState: 'healthy',
      });
      expect(screen.getByTestId('sync-status-icon-healthy')).toBeInTheDocument();
    });

    it('renders sync status icon for error state', () => {
      renderTab({
        platform: 'notion',
        healthState: 'error',
      });
      expect(screen.getByTestId('sync-status-icon-error')).toBeInTheDocument();
    });

    it('renders sync status icon for conflicts state', () => {
      renderTab({
        platform: 'airtable',
        healthState: 'conflicts',
        pendingConflictCount: 5,
      });
      expect(screen.getByTestId('sync-status-icon-conflicts')).toBeInTheDocument();
    });

    it('renders sync status icon for syncing state', () => {
      renderTab({
        platform: 'airtable',
        healthState: 'syncing',
      });
      expect(screen.getByTestId('sync-status-icon-syncing')).toBeInTheDocument();
    });

    it('does not render sync status icon when healthState is null', () => {
      renderTab({
        platform: 'airtable',
        healthState: null,
      });
      expect(screen.queryByTestId('sync-status-icon-healthy')).not.toBeInTheDocument();
    });
  });

  describe('active state styling', () => {
    it('active table has active background class', () => {
      renderTab({ isActive: true });
      const tab = screen.getByTestId('table-tab-table-1');
      expect(tab.className).toContain('bg-[var(--sidebar-active)]');
    });

    it('inactive table has hover class', () => {
      renderTab({ isActive: false });
      const tab = screen.getByTestId('table-tab-table-1');
      expect(tab.className).toContain('hover:bg-[var(--sidebar-bg-hover)]');
    });

    it('active table shows white left-edge indicator when no tabColor', () => {
      renderTab({ isActive: true, tabColor: null });
      const tab = screen.getByTestId('table-tab-table-1');
      const indicator = tab.querySelector('.bg-white');
      expect(indicator).not.toBeNull();
    });
  });

  describe('tab color stripe', () => {
    it('renders tab color stripe when tabColor provided', () => {
      renderTab({ tabColor: '#F59E0B' });
      const stripe = screen.getByTestId('table-tab-color-stripe');
      expect(stripe).toBeInTheDocument();
      expect(stripe.style.backgroundColor).toBe('rgb(245, 158, 11)');
    });

    it('does not render stripe when tabColor is null', () => {
      renderTab({ tabColor: null });
      expect(screen.queryByTestId('table-tab-color-stripe')).not.toBeInTheDocument();
    });

    it('renders both tab color and platform badge (independent)', () => {
      renderTab({
        platform: 'airtable',
        healthState: 'healthy',
        tabColor: '#F59E0B',
      });
      expect(screen.getByTestId('table-tab-color-stripe')).toBeInTheDocument();
      expect(screen.getByTestId('platform-badge-airtable')).toBeInTheDocument();
    });
  });

  describe('click propagation', () => {
    it('sync status icon click does not fire table onClick', async () => {
      const onTableClick = vi.fn();
      const onSyncClick = vi.fn();
      const user = userEvent.setup();
      renderTab({
        platform: 'airtable',
        healthState: 'error',
        onClick: onTableClick,
        onClickSyncSettings: onSyncClick,
      });

      await user.click(screen.getByTestId('sync-status-icon-error'));
      expect(onSyncClick).toHaveBeenCalledOnce();
      expect(onTableClick).not.toHaveBeenCalled();
    });
  });
});
