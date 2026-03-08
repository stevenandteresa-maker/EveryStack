// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { SyncStatusTooltip } from '../SyncStatusTooltip';
import type { SyncStatusTooltipProps } from '../SyncStatusTooltip';
import type { ConnectionHealth } from '@everystack/shared/sync';
import type { SyncHealthState } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEALTHY_HEALTH: ConnectionHealth = {
  last_success_at: new Date().toISOString(),
  last_error: null,
  consecutive_failures: 0,
  next_retry_at: null,
  records_synced: 150,
  records_failed: 0,
};

const ERROR_HEALTH: ConnectionHealth = {
  last_success_at: new Date(Date.now() - 3600_000).toISOString(),
  last_error: {
    code: 'platform_unavailable',
    message: 'Airtable API returned 503',
    timestamp: new Date().toISOString(),
    retryable: false,
    details: {},
  },
  consecutive_failures: 3,
  next_retry_at: null,
  records_synced: 150,
  records_failed: 5,
};

const RETRYING_HEALTH: ConnectionHealth = {
  last_success_at: new Date(Date.now() - 1800_000).toISOString(),
  last_error: {
    code: 'rate_limited',
    message: 'Rate limited by Airtable',
    timestamp: new Date().toISOString(),
    retryable: true,
    details: {},
  },
  consecutive_failures: 2,
  next_retry_at: new Date(Date.now() + 300_000).toISOString(),
  records_synced: 200,
  records_failed: 0,
};

function renderTooltip(overrides?: Partial<SyncStatusTooltipProps>) {
  const props: SyncStatusTooltipProps = {
    healthState: 'healthy',
    platform: 'Airtable',
    lastSyncAt: new Date(Date.now() - 120_000),
    health: HEALTHY_HEALTH,
    pendingConflictCount: 0,
    ...overrides,
  };

  return render(
    <IntlWrapper>
      <SyncStatusTooltip {...props} />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncStatusTooltip', () => {
  it('renders the tooltip container', () => {
    renderTooltip();
    expect(screen.getByTestId('sync-status-tooltip')).toBeInTheDocument();
  });

  describe('healthy state', () => {
    it('shows platform name in status message', () => {
      renderTooltip({ healthState: 'healthy' });
      expect(screen.getByText(/Airtable/)).toBeInTheDocument();
    });

    it('shows last sync time', () => {
      renderTooltip({ healthState: 'healthy' });
      expect(screen.getByTestId('tooltip-last-sync')).toBeInTheDocument();
    });

    it('shows record count', () => {
      renderTooltip({ healthState: 'healthy' });
      expect(screen.getByTestId('tooltip-records')).toBeInTheDocument();
    });

    it('does not show action hint', () => {
      renderTooltip({ healthState: 'healthy' });
      expect(screen.queryByTestId('tooltip-action-hint')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message', () => {
      renderTooltip({
        healthState: 'error',
        health: ERROR_HEALTH,
      });
      expect(screen.getByTestId('tooltip-error')).toHaveTextContent(
        'Airtable API returned 503',
      );
    });

    it('shows consecutive failure count', () => {
      renderTooltip({
        healthState: 'error',
        health: ERROR_HEALTH,
      });
      expect(screen.getByTestId('tooltip-failures')).toBeInTheDocument();
    });

    it('shows last success time', () => {
      renderTooltip({
        healthState: 'error',
        health: ERROR_HEALTH,
      });
      expect(screen.getByTestId('tooltip-last-success')).toBeInTheDocument();
    });

    it('shows action hint to view details', () => {
      renderTooltip({
        healthState: 'error',
        health: ERROR_HEALTH,
      });
      expect(screen.getByTestId('tooltip-action-hint')).toBeInTheDocument();
    });
  });

  describe('retrying state', () => {
    it('shows error message', () => {
      renderTooltip({
        healthState: 'retrying',
        health: RETRYING_HEALTH,
      });
      expect(screen.getByTestId('tooltip-error')).toHaveTextContent(
        'Rate limited by Airtable',
      );
    });

    it('shows next retry time', () => {
      renderTooltip({
        healthState: 'retrying',
        health: RETRYING_HEALTH,
      });
      expect(screen.getByTestId('tooltip-next-retry')).toBeInTheDocument();
    });

    it('shows consecutive failures', () => {
      renderTooltip({
        healthState: 'retrying',
        health: RETRYING_HEALTH,
      });
      expect(screen.getByTestId('tooltip-failures')).toBeInTheDocument();
    });

    it('does not show action hint', () => {
      renderTooltip({ healthState: 'retrying', health: RETRYING_HEALTH });
      expect(screen.queryByTestId('tooltip-action-hint')).not.toBeInTheDocument();
    });
  });

  describe('stale state', () => {
    it('shows stale message', () => {
      renderTooltip({ healthState: 'stale' });
      expect(screen.getByText(/delayed/i)).toBeInTheDocument();
    });

    it('shows last success time', () => {
      renderTooltip({ healthState: 'stale' });
      expect(screen.getByTestId('tooltip-last-success')).toBeInTheDocument();
    });

    it('shows action hint to check connection', () => {
      renderTooltip({ healthState: 'stale' });
      expect(screen.getByTestId('tooltip-action-hint')).toBeInTheDocument();
    });
  });

  describe('syncing state', () => {
    it('shows syncing message with platform', () => {
      renderTooltip({ healthState: 'syncing' });
      expect(screen.getByText(/Syncing with Airtable/)).toBeInTheDocument();
    });

    it('does not show action hint', () => {
      renderTooltip({ healthState: 'syncing' });
      expect(screen.queryByTestId('tooltip-action-hint')).not.toBeInTheDocument();
    });
  });

  describe('auth_required state', () => {
    it('shows re-auth message with platform', () => {
      renderTooltip({ healthState: 'auth_required' });
      expect(screen.getByText(/re-authentication/i)).toBeInTheDocument();
    });

    it('shows action hint to reconnect', () => {
      renderTooltip({ healthState: 'auth_required' });
      expect(screen.getByTestId('tooltip-action-hint')).toBeInTheDocument();
    });
  });

  describe('paused state', () => {
    it('shows paused message', () => {
      renderTooltip({ healthState: 'paused' });
      expect(screen.getByText(/paused/i)).toBeInTheDocument();
    });

    it('does not show action hint', () => {
      renderTooltip({ healthState: 'paused' });
      expect(screen.queryByTestId('tooltip-action-hint')).not.toBeInTheDocument();
    });
  });

  describe('conflicts state', () => {
    it('shows conflict count', () => {
      renderTooltip({
        healthState: 'conflicts',
        pendingConflictCount: 5,
      });
      expect(screen.getByTestId('tooltip-conflicts')).toBeInTheDocument();
    });

    it('shows action hint to resolve', () => {
      renderTooltip({
        healthState: 'conflicts',
        pendingConflictCount: 3,
      });
      expect(screen.getByTestId('tooltip-action-hint')).toBeInTheDocument();
    });
  });

  describe('records display', () => {
    it('shows records with failures when records_failed > 0', () => {
      renderTooltip({
        healthState: 'error',
        health: { ...ERROR_HEALTH, records_synced: 100, records_failed: 5 },
      });
      expect(screen.getByTestId('tooltip-records')).toBeInTheDocument();
    });

    it('hides records when records_synced is 0', () => {
      renderTooltip({
        health: { ...HEALTHY_HEALTH, records_synced: 0 },
      });
      expect(screen.queryByTestId('tooltip-records')).not.toBeInTheDocument();
    });
  });

  describe('all 8 health states render without error', () => {
    const states: SyncHealthState[] = [
      'healthy', 'syncing', 'stale', 'retrying',
      'error', 'auth_required', 'paused', 'conflicts',
    ];

    for (const state of states) {
      it(`renders ${state} state`, () => {
        renderTooltip({
          healthState: state,
          health: state === 'error' ? ERROR_HEALTH : state === 'retrying' ? RETRYING_HEALTH : HEALTHY_HEALTH,
          pendingConflictCount: state === 'conflicts' ? 3 : 0,
        });
        expect(screen.getByTestId('sync-status-tooltip')).toBeInTheDocument();
      });
    }
  });
});
