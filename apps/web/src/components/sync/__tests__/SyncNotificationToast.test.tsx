// @vitest-environment jsdom
/**
 * Tests for SyncNotificationToast.tsx
 *
 * Covers:
 * - Subscribes to notification events on mount
 * - Shows toast for in-app event types (conflict, failures, partial, schema)
 * - Does not show toast for email-only events (sync_down_1h, sync_down_6h)
 * - Unsubscribes on unmount
 * - Toast includes action button when onNavigateToSyncSettings is provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { SyncNotificationToast } from '../SyncNotificationToast';
import { IntlWrapper } from '../../../test-utils/intl-wrapper';
import type { SyncNotificationPayload } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPayload(type: string): SyncNotificationPayload {
  return {
    type: type as SyncNotificationPayload['type'],
    title: `Test: ${type}`,
    message: `Test message for ${type}`,
    connectionId: 'conn-1',
    platform: 'Airtable',
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SyncNotificationToast', () => {
  it('subscribes on mount and unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    const onSubscribe = vi.fn(() => unsubscribe);
    const showToast = vi.fn();

    const { unmount } = render(
      <IntlWrapper>
        <SyncNotificationToast onSubscribe={onSubscribe} showToast={showToast} />
      </IntlWrapper>,
    );

    expect(onSubscribe).toHaveBeenCalledOnce();

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('shows toast for conflict_detected events', () => {
    let handler: ((payload: SyncNotificationPayload) => void) | null = null;
    const onSubscribe = vi.fn((h: (payload: SyncNotificationPayload) => void) => {
      handler = h;
      return () => {};
    });
    const showToast = vi.fn();

    render(
      <IntlWrapper>
        <SyncNotificationToast onSubscribe={onSubscribe} showToast={showToast} />
      </IntlWrapper>,
    );

    act(() => {
      handler?.(createPayload('conflict_detected'));
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test: conflict_detected',
        variant: 'warning',
      }),
    );
  });

  it('shows toast for consecutive_failures events', () => {
    let handler: ((payload: SyncNotificationPayload) => void) | null = null;
    const onSubscribe = vi.fn((h: (payload: SyncNotificationPayload) => void) => {
      handler = h;
      return () => {};
    });
    const showToast = vi.fn();

    render(
      <IntlWrapper>
        <SyncNotificationToast onSubscribe={onSubscribe} showToast={showToast} />
      </IntlWrapper>,
    );

    act(() => {
      handler?.(createPayload('consecutive_failures'));
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
      }),
    );
  });

  it('does NOT show toast for email-only events (sync_down_1h)', () => {
    let handler: ((payload: SyncNotificationPayload) => void) | null = null;
    const onSubscribe = vi.fn((h: (payload: SyncNotificationPayload) => void) => {
      handler = h;
      return () => {};
    });
    const showToast = vi.fn();

    render(
      <IntlWrapper>
        <SyncNotificationToast onSubscribe={onSubscribe} showToast={showToast} />
      </IntlWrapper>,
    );

    act(() => {
      handler?.(createPayload('sync_down_1h'));
    });

    expect(showToast).not.toHaveBeenCalled();
  });

  it('does NOT show toast for sync_down_6h events', () => {
    let handler: ((payload: SyncNotificationPayload) => void) | null = null;
    const onSubscribe = vi.fn((h: (payload: SyncNotificationPayload) => void) => {
      handler = h;
      return () => {};
    });
    const showToast = vi.fn();

    render(
      <IntlWrapper>
        <SyncNotificationToast onSubscribe={onSubscribe} showToast={showToast} />
      </IntlWrapper>,
    );

    act(() => {
      handler?.(createPayload('sync_down_6h'));
    });

    expect(showToast).not.toHaveBeenCalled();
  });

  it('includes action button when onNavigateToSyncSettings is provided', () => {
    let handler: ((payload: SyncNotificationPayload) => void) | null = null;
    const onSubscribe = vi.fn((h: (payload: SyncNotificationPayload) => void) => {
      handler = h;
      return () => {};
    });
    const showToast = vi.fn();
    const onNavigate = vi.fn();

    render(
      <IntlWrapper>
        <SyncNotificationToast
          onSubscribe={onSubscribe}
          showToast={showToast}
          onNavigateToSyncSettings={onNavigate}
        />
      </IntlWrapper>,
    );

    act(() => {
      handler?.(createPayload('schema_mismatch'));
    });

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({
          onClick: expect.any(Function),
        }),
      }),
    );

    // Trigger the action callback
    const call = showToast.mock.calls[0]?.[0];
    call?.action?.onClick();
    expect(onNavigate).toHaveBeenCalledWith('conn-1');
  });

  it('renders nothing (returns null)', () => {
    const onSubscribe = vi.fn(() => () => {});
    const showToast = vi.fn();

    const { container } = render(
      <IntlWrapper>
        <SyncNotificationToast onSubscribe={onSubscribe} showToast={showToast} />
      </IntlWrapper>,
    );

    expect(container.innerHTML).toBe('');
  });
});
