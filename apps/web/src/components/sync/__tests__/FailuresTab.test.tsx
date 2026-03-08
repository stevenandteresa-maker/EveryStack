// @vitest-environment jsdom
/**
 * Tests for FailuresTab component.
 *
 * Covers:
 * - Empty state when no failures
 * - Renders failure list with record names and error descriptions
 * - Retry button calls retrySyncFailureAction
 * - Skip button calls skipSyncFailureAction
 * - Bulk Retry All and Skip All buttons
 * - Resolved/skipped failures don't show action buttons
 * - Status badges render correct variant
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { FailuresTab } from '../FailuresTab';
import type { SyncFailureWithRecord } from '@/data/sync-failures';

// RadixUI ScrollArea requires ResizeObserver in jsdom
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() { /* noop */ }
    unobserve() { /* noop */ }
    disconnect() { /* noop */ }
  };
});

// ---------------------------------------------------------------------------
// Mock server actions
// ---------------------------------------------------------------------------

vi.mock('@/actions/sync-failure-actions', () => ({
  retrySyncFailureAction: vi.fn(() => Promise.resolve()),
  skipSyncFailureAction: vi.fn(() => Promise.resolve()),
  bulkRetrySyncFailuresAction: vi.fn(() => Promise.resolve({ retried: 2 })),
  bulkSkipSyncFailuresAction: vi.fn(() => Promise.resolve({ skipped: 2 })),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PENDING_FAILURE: SyncFailureWithRecord = {
  id: 'fail-001',
  baseConnectionId: 'conn-1',
  recordId: 'rec-1',
  direction: 'inbound',
  errorCode: 'validation',
  errorMessage: 'Invalid value for field "Status"',
  platformRecordId: 'plat-rec-1',
  payload: { fields: {} },
  retryCount: 1,
  status: 'pending',
  createdAt: new Date('2026-03-07'),
  resolvedAt: null,
  resolvedBy: null,
  recordDisplayName: 'Test Record Alpha',
};

const MANUAL_FAILURE: SyncFailureWithRecord = {
  id: 'fail-002',
  baseConnectionId: 'conn-1',
  recordId: 'rec-2',
  direction: 'inbound',
  errorCode: 'platform_rejected',
  errorMessage: 'Platform rejected this record',
  platformRecordId: 'plat-rec-2',
  payload: null,
  retryCount: 3,
  status: 'requires_manual_resolution',
  createdAt: new Date('2026-03-06'),
  resolvedAt: null,
  resolvedBy: null,
  recordDisplayName: 'Test Record Beta',
};

const RESOLVED_FAILURE: SyncFailureWithRecord = {
  id: 'fail-003',
  baseConnectionId: 'conn-1',
  recordId: 'rec-3',
  direction: 'outbound',
  errorCode: 'unknown',
  errorMessage: 'Something went wrong',
  platformRecordId: 'plat-rec-3',
  payload: null,
  retryCount: 2,
  status: 'resolved',
  createdAt: new Date('2026-03-05'),
  resolvedAt: new Date('2026-03-06'),
  resolvedBy: 'user-1',
  recordDisplayName: 'Test Record Gamma',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderTab(failures: SyncFailureWithRecord[], onMutate?: () => void) {
  return render(
    <IntlWrapper>
      <FailuresTab
        baseConnectionId="conn-1"
        failures={failures}
        onMutate={onMutate}
      />
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FailuresTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('empty state', () => {
    it('shows empty message when no failures', () => {
      renderTab([]);

      expect(screen.getByTestId('failures-tab-empty')).toBeInTheDocument();
      expect(screen.getByText(/no sync failures/i)).toBeInTheDocument();
    });

    it('does not show bulk action buttons', () => {
      renderTab([]);

      expect(screen.queryByTestId('bulk-retry-failures')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bulk-skip-failures')).not.toBeInTheDocument();
    });
  });

  describe('failure list rendering', () => {
    it('renders failure rows with record names', () => {
      renderTab([PENDING_FAILURE, MANUAL_FAILURE]);

      expect(screen.getByText('Test Record Alpha')).toBeInTheDocument();
      expect(screen.getByText('Test Record Beta')).toBeInTheDocument();
    });

    it('shows error messages', () => {
      renderTab([PENDING_FAILURE]);

      expect(screen.getByText('Invalid value for field "Status"')).toBeInTheDocument();
    });

    it('shows retry count when > 0', () => {
      renderTab([PENDING_FAILURE]);

      expect(screen.getByText(/1 retry/i)).toBeInTheDocument();
    });

    it('shows status badges', () => {
      renderTab([PENDING_FAILURE, MANUAL_FAILURE, RESOLVED_FAILURE]);

      // "Pending" badge text appears inside a Badge component
      expect(screen.getAllByText(/Pending/)[0]).toBeInTheDocument();
      expect(screen.getByText(/Needs attention/i)).toBeInTheDocument();
      expect(screen.getByText(/Resolved/)).toBeInTheDocument();
    });
  });

  describe('individual actions', () => {
    it('shows Retry and Skip buttons for pending failures', () => {
      renderTab([PENDING_FAILURE]);

      expect(screen.getByTestId(`retry-failure-${PENDING_FAILURE.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`skip-failure-${PENDING_FAILURE.id}`)).toBeInTheDocument();
    });

    it('shows Retry and Skip buttons for requires_manual_resolution failures', () => {
      renderTab([MANUAL_FAILURE]);

      expect(screen.getByTestId(`retry-failure-${MANUAL_FAILURE.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`skip-failure-${MANUAL_FAILURE.id}`)).toBeInTheDocument();
    });

    it('does NOT show action buttons for resolved failures', () => {
      renderTab([RESOLVED_FAILURE]);

      expect(screen.queryByTestId(`retry-failure-${RESOLVED_FAILURE.id}`)).not.toBeInTheDocument();
      expect(screen.queryByTestId(`skip-failure-${RESOLVED_FAILURE.id}`)).not.toBeInTheDocument();
    });

    it('calls retrySyncFailureAction on Retry click', async () => {
      const onMutate = vi.fn();
      renderTab([PENDING_FAILURE], onMutate);

      const { retrySyncFailureAction } = await import('@/actions/sync-failure-actions');

      await userEvent.click(screen.getByTestId(`retry-failure-${PENDING_FAILURE.id}`));

      expect(retrySyncFailureAction).toHaveBeenCalledWith({ failureId: PENDING_FAILURE.id });
    });

    it('calls skipSyncFailureAction on Skip click', async () => {
      const onMutate = vi.fn();
      renderTab([PENDING_FAILURE], onMutate);

      const { skipSyncFailureAction } = await import('@/actions/sync-failure-actions');

      await userEvent.click(screen.getByTestId(`skip-failure-${PENDING_FAILURE.id}`));

      expect(skipSyncFailureAction).toHaveBeenCalledWith({ failureId: PENDING_FAILURE.id });
    });
  });

  describe('bulk actions', () => {
    it('shows Retry All and Skip All when pending failures exist', () => {
      renderTab([PENDING_FAILURE, MANUAL_FAILURE]);

      expect(screen.getByTestId('bulk-retry-failures')).toBeInTheDocument();
      expect(screen.getByTestId('bulk-skip-failures')).toBeInTheDocument();
    });

    it('does NOT show bulk actions when only resolved failures', () => {
      renderTab([RESOLVED_FAILURE]);

      expect(screen.queryByTestId('bulk-retry-failures')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bulk-skip-failures')).not.toBeInTheDocument();
    });

    it('calls bulkRetrySyncFailuresAction on Retry All', async () => {
      const onMutate = vi.fn();
      renderTab([PENDING_FAILURE], onMutate);

      const { bulkRetrySyncFailuresAction } = await import('@/actions/sync-failure-actions');

      await userEvent.click(screen.getByTestId('bulk-retry-failures'));

      expect(bulkRetrySyncFailuresAction).toHaveBeenCalledWith({ baseConnectionId: 'conn-1' });
    });

    it('calls bulkSkipSyncFailuresAction on Skip All', async () => {
      const onMutate = vi.fn();
      renderTab([PENDING_FAILURE], onMutate);

      const { bulkSkipSyncFailuresAction } = await import('@/actions/sync-failure-actions');

      await userEvent.click(screen.getByTestId('bulk-skip-failures'));

      expect(bulkSkipSyncFailuresAction).toHaveBeenCalledWith({ baseConnectionId: 'conn-1' });
    });
  });

  describe('pending failure count', () => {
    it('shows correct count header for pending failures', () => {
      renderTab([PENDING_FAILURE, MANUAL_FAILURE, RESOLVED_FAILURE]);

      // 2 pending (pending + requires_manual_resolution)
      expect(screen.getByText(/2 pending failures/i)).toBeInTheDocument();
    });
  });
});
