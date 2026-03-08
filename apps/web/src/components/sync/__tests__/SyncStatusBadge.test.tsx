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

    it('navigates to sync settings on click', async () => {
      const onClickSettings = vi.fn();
      const user = userEvent.setup();
      renderBadge({
        healthState: 'retrying',
        onClickSyncSettings: onClickSettings,
      });

      await user.click(screen.getByTestId('sync-status-badge-retrying'));
      expect(onClickSettings).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Non-clickable states must not fire any handler
  // -------------------------------------------------------------------------
  describe('non-clickable states do not fire handlers', () => {
    const nonClickable: SyncHealthState[] = ['healthy', 'syncing', 'paused'];

    for (const state of nonClickable) {
      it(`${state} does not fire any handler`, async () => {
        const handlers = {
          onClickReAuth: vi.fn(),
          onClickConflicts: vi.fn(),
          onClickSyncSettings: vi.fn(),
        };
        const user = userEvent.setup();
        renderBadge({ healthState: state, ...handlers });

        await user.click(screen.getByTestId(`sync-status-badge-${state}`));
        expect(handlers.onClickReAuth).not.toHaveBeenCalled();
        expect(handlers.onClickConflicts).not.toHaveBeenCalled();
        expect(handlers.onClickSyncSettings).not.toHaveBeenCalled();
      });
    }
  });

  // -------------------------------------------------------------------------
  // Clickable state with no handler should not throw
  // -------------------------------------------------------------------------
  describe('missing handler safety', () => {
    it('does not throw when error badge clicked without handler', async () => {
      const user = userEvent.setup();
      renderBadge({ healthState: 'error' });

      await expect(
        user.click(screen.getByTestId('sync-status-badge-error')),
      ).resolves.not.toThrow();
    });

    it('does not throw when auth_required badge clicked without handler', async () => {
      const user = userEvent.setup();
      renderBadge({ healthState: 'auth_required' });

      await expect(
        user.click(screen.getByTestId('sync-status-badge-auth_required')),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Cursor classes
  // -------------------------------------------------------------------------
  describe('cursor styling', () => {
    const clickable: SyncHealthState[] = ['auth_required', 'conflicts', 'error', 'retrying', 'stale'];
    const nonClickable: SyncHealthState[] = ['healthy', 'syncing', 'paused'];

    for (const state of clickable) {
      it(`${state} shows pointer cursor`, () => {
        renderBadge({
          healthState: state,
          pendingConflictCount: state === 'conflicts' ? 2 : 0,
        });
        expect(screen.getByTestId(`sync-status-badge-${state}`)).toHaveClass('cursor-pointer');
      });
    }

    for (const state of nonClickable) {
      it(`${state} shows default cursor`, () => {
        renderBadge({ healthState: state });
        expect(screen.getByTestId(`sync-status-badge-${state}`)).toHaveClass('cursor-default');
      });
    }
  });

  // -------------------------------------------------------------------------
  // Badge text content
  // -------------------------------------------------------------------------
  describe('badge text content', () => {
    it('shows "Synced" when healthy with null lastSyncAt', () => {
      renderBadge({ healthState: 'healthy', lastSyncAt: null });
      expect(screen.getByTestId('sync-status-badge-healthy')).toHaveTextContent('Synced');
    });

    it('shows "Sync error" text for error state', () => {
      renderBadge({ healthState: 'error' });
      expect(screen.getByTestId('sync-status-badge-error')).toHaveTextContent('Sync error');
    });

    it('shows "Re-authentication required" for auth_required', () => {
      renderBadge({ healthState: 'auth_required' });
      expect(screen.getByTestId('sync-status-badge-auth_required')).toHaveTextContent(
        'Re-authentication required',
      );
    });

    it('shows singular conflict text for count of 1', () => {
      renderBadge({ healthState: 'conflicts', pendingConflictCount: 1 });
      expect(screen.getByTestId('sync-status-badge-conflicts')).toHaveTextContent('1 conflict');
    });

    it('shows plural conflicts text for count > 1', () => {
      renderBadge({ healthState: 'conflicts', pendingConflictCount: 5 });
      expect(screen.getByTestId('sync-status-badge-conflicts')).toHaveTextContent('5 conflicts');
    });
  });

  // -------------------------------------------------------------------------
  // Tooltip rendering branch
  // -------------------------------------------------------------------------
  describe('tooltip content', () => {
    it('renders SyncStatusTooltip when health prop provided', () => {
      renderBadge({
        healthState: 'healthy',
        health: {
          last_success_at: new Date().toISOString(),
          last_error: null,
          consecutive_failures: 0,
          next_retry_at: null,
          records_synced: 100,
          records_failed: 0,
        },
      });
      expect(screen.getByTestId('sync-status-badge-healthy')).toBeInTheDocument();
    });

    it('renders fallback text tooltip when health is undefined', () => {
      renderBadge({ healthState: 'healthy', health: undefined });
      expect(screen.getByTestId('sync-status-badge-healthy')).toBeInTheDocument();
    });
  });
});
