// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { SyncStatusBadge } from '../SyncStatusBadge';
import type { SyncStatusBadgeProps } from '../SyncStatusBadge';
import type { SyncHealthState } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderBadge(overrides?: Partial<SyncStatusBadgeProps>) {
  const props: SyncStatusBadgeProps = {
    healthState: 'healthy',
    platform: 'Airtable',
    lastSyncAt: new Date('2026-01-15T09:58:00.000Z'),
    pendingConflictCount: 0,
    ...overrides,
  };

  return render(
    <IntlWrapper>
      <SyncStatusBadge {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncStatusBadge', () => {
  describe('renders all 8 health states', () => {
    const states: SyncHealthState[] = [
      'healthy', 'syncing', 'stale', 'retrying',
      'error', 'auth_required', 'paused', 'conflicts',
    ];

    for (const state of states) {
      it(`renders ${state} state`, () => {
        renderBadge({
          healthState: state,
          pendingConflictCount: state === 'conflicts' ? 3 : 0,
        });

        const badge = screen.getByTestId(`sync-status-badge-${state}`);
        expect(badge).toBeInTheDocument();
      });
    }
  });

  describe('healthy state', () => {
    it('shows "Synced" text with relative time', () => {
      renderBadge({ healthState: 'healthy' });
      const badge = screen.getByTestId('sync-status-badge-healthy');
      expect(badge).toBeInTheDocument();
    });

    it('is not clickable', async () => {
      const onClick = vi.fn();
      renderBadge({
        healthState: 'healthy',
        onClickSyncSettings: onClick,
      });
      const badge = screen.getByTestId('sync-status-badge-healthy');
      expect(badge.className).toContain('cursor-default');
    });
  });

  describe('syncing state', () => {
    it('shows syncing indicator with animation', () => {
      renderBadge({ healthState: 'syncing' });
      const badge = screen.getByTestId('sync-status-badge-syncing');
      expect(badge).toBeInTheDocument();
      // Animated dot
      const dot = badge.querySelector('.animate-pulse');
      expect(dot).not.toBeNull();
    });
  });

  describe('stale state', () => {
    it('shows yellow dot', () => {
      renderBadge({ healthState: 'stale' });
      const badge = screen.getByTestId('sync-status-badge-stale');
      const dot = badge.querySelector('.bg-yellow-500');
      expect(dot).not.toBeNull();
    });

    it('navigates to sync settings on click', async () => {
      const onClickSettings = vi.fn();
      const user = userEvent.setup();
      renderBadge({
        healthState: 'stale',
        onClickSyncSettings: onClickSettings,
      });

      await user.click(screen.getByTestId('sync-status-badge-stale'));
      expect(onClickSettings).toHaveBeenCalledOnce();
    });
  });

  describe('error state', () => {
    it('shows destructive variant', () => {
      renderBadge({
        healthState: 'error',
        errorMessage: 'Platform returned 500',
      });
      const badge = screen.getByTestId('sync-status-badge-error');
      expect(badge).toBeInTheDocument();
    });

    it('navigates to sync settings on click', async () => {
      const onClickSettings = vi.fn();
      const user = userEvent.setup();
      renderBadge({
        healthState: 'error',
        onClickSyncSettings: onClickSettings,
      });

      await user.click(screen.getByTestId('sync-status-badge-error'));
      expect(onClickSettings).toHaveBeenCalledOnce();
    });
  });

  describe('auth_required state', () => {
    it('navigates to re-auth on click', async () => {
      const onClickReAuth = vi.fn();
      const user = userEvent.setup();
      renderBadge({
        healthState: 'auth_required',
        onClickReAuth,
      });

      await user.click(screen.getByTestId('sync-status-badge-auth_required'));
      expect(onClickReAuth).toHaveBeenCalledOnce();
    });
  });

  describe('paused state', () => {
    it('shows secondary variant with gray dot', () => {
      renderBadge({ healthState: 'paused' });
      const badge = screen.getByTestId('sync-status-badge-paused');
      const dot = badge.querySelector('.bg-gray-400');
      expect(dot).not.toBeNull();
    });
  });

  describe('conflicts state', () => {
    it('shows amber dot with conflict count', () => {
      renderBadge({
        healthState: 'conflicts',
        pendingConflictCount: 5,
      });
      const badge = screen.getByTestId('sync-status-badge-conflicts');
      const dot = badge.querySelector('.bg-amber-500');
      expect(dot).not.toBeNull();
    });

    it('navigates to conflict resolution on click', async () => {
      const onClickConflicts = vi.fn();
      const user = userEvent.setup();
      renderBadge({
        healthState: 'conflicts',
        pendingConflictCount: 3,
        onClickConflicts,
      });

      await user.click(screen.getByTestId('sync-status-badge-conflicts'));
      expect(onClickConflicts).toHaveBeenCalledOnce();
    });
  });

  describe('retrying state', () => {
    it('shows pulsing yellow dot', () => {
      renderBadge({
        healthState: 'retrying',
        errorMessage: 'Rate limited',
        nextRetryAt: '10:05 AM',
      });
      const badge = screen.getByTestId('sync-status-badge-retrying');
      const dot = badge.querySelector('.animate-pulse');
      expect(dot).not.toBeNull();
      const yellowDot = badge.querySelector('.bg-yellow-500');
      expect(yellowDot).not.toBeNull();
    });
  });
});
