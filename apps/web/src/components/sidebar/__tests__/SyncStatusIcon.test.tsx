// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import { SyncStatusIcon } from '../SyncStatusIcon';
import type { SyncStatusIconProps } from '../SyncStatusIcon';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderIcon(overrides?: Partial<SyncStatusIconProps>) {
  const props: SyncStatusIconProps = {
    healthState: 'healthy',
    platform: 'airtable',
    lastSyncAt: new Date('2026-01-15T09:58:00.000Z'),
    pendingConflictCount: 0,
    ...overrides,
  };

  return render(
    <IntlWrapper>
      <SyncStatusIcon {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncStatusIcon', () => {
  describe('renders all 6 sidebar health states', () => {
    it('renders healthy state with bidirectional arrow icon', () => {
      renderIcon({ healthState: 'healthy' });
      expect(screen.getByTestId('sync-status-icon-healthy')).toBeInTheDocument();
      expect(screen.getByTestId('sync-icon-healthy')).toBeInTheDocument();
    });

    it('renders syncing state with animated icon', () => {
      renderIcon({ healthState: 'syncing' });
      expect(screen.getByTestId('sync-status-icon-syncing')).toBeInTheDocument();
      const icon = screen.getByTestId('sync-icon-syncing');
      expect(icon.getAttribute('class')).toContain('animate-spin');
    });

    it('renders conflicts state with amber dot', () => {
      renderIcon({ healthState: 'conflicts', pendingConflictCount: 3 });
      expect(screen.getByTestId('sync-status-icon-conflicts')).toBeInTheDocument();
      const conflictIcon = screen.getByTestId('sync-icon-conflicts');
      const amberDot = conflictIcon.querySelector('.bg-amber-400');
      expect(amberDot).not.toBeNull();
    });

    it('renders paused state with pause icon', () => {
      renderIcon({ healthState: 'paused' });
      expect(screen.getByTestId('sync-status-icon-paused')).toBeInTheDocument();
      expect(screen.getByTestId('sync-icon-paused')).toBeInTheDocument();
    });

    it('renders error state with error icon', () => {
      renderIcon({ healthState: 'error' });
      expect(screen.getByTestId('sync-status-icon-error')).toBeInTheDocument();
      expect(screen.getByTestId('sync-icon-error')).toBeInTheDocument();
    });

    it('maps auth_required to error icon', () => {
      renderIcon({ healthState: 'auth_required' });
      expect(screen.getByTestId('sync-status-icon-error')).toBeInTheDocument();
    });

    it('maps stale to healthy icon', () => {
      renderIcon({ healthState: 'stale' });
      expect(screen.getByTestId('sync-status-icon-healthy')).toBeInTheDocument();
    });

    it('maps retrying to error icon', () => {
      renderIcon({ healthState: 'retrying' });
      expect(screen.getByTestId('sync-status-icon-error')).toBeInTheDocument();
    });
  });

  describe('colors for dark sidebar', () => {
    it('healthy icon uses muted color', () => {
      renderIcon({ healthState: 'healthy' });
      const icon = screen.getByTestId('sync-icon-healthy');
      expect(icon.getAttribute('class')).toContain('text-[var(--sidebar-text-muted)]');
    });

    it('syncing icon uses teal-400', () => {
      renderIcon({ healthState: 'syncing' });
      const icon = screen.getByTestId('sync-icon-syncing');
      expect(icon.getAttribute('class')).toContain('text-teal-400');
    });

    it('error icon uses red-400', () => {
      renderIcon({ healthState: 'error' });
      const icon = screen.getByTestId('sync-icon-error');
      expect(icon.getAttribute('class')).toContain('text-red-400');
    });

    it('paused icon uses muted color', () => {
      renderIcon({ healthState: 'paused' });
      const icon = screen.getByTestId('sync-icon-paused');
      expect(icon.getAttribute('class')).toContain('text-[var(--sidebar-text-muted)]');
    });
  });

  describe('click behavior', () => {
    it('clicking sync icon calls onClick for error state', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      renderIcon({ healthState: 'error', onClick });

      await user.click(screen.getByTestId('sync-status-icon-error'));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('clicking conflicts calls onClickConflicts', async () => {
      const onClickConflicts = vi.fn();
      const user = userEvent.setup();
      renderIcon({
        healthState: 'conflicts',
        pendingConflictCount: 2,
        onClickConflicts,
      });

      await user.click(screen.getByTestId('sync-status-icon-conflicts'));
      expect(onClickConflicts).toHaveBeenCalledOnce();
    });

    it('clicking paused calls onClick', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      renderIcon({ healthState: 'paused', onClick });

      await user.click(screen.getByTestId('sync-status-icon-paused'));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('does not fire any handler for healthy state click', async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();
      renderIcon({ healthState: 'healthy', onClick });

      await user.click(screen.getByTestId('sync-status-icon-healthy'));
      // healthy is not clickable so onClick should not fire
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has aria-label for screen readers', () => {
      renderIcon({ healthState: 'healthy' });
      const button = screen.getByTestId('sync-status-icon-healthy');
      expect(button.getAttribute('aria-label')).toBeTruthy();
    });

    it('aria-label contains platform name for healthy state', () => {
      renderIcon({ healthState: 'healthy', platform: 'airtable' });
      const button = screen.getByTestId('sync-status-icon-healthy');
      expect(button.getAttribute('aria-label')).toContain('Airtable');
    });
  });
});
