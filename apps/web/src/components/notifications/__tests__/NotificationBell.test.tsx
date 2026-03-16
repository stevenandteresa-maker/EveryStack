// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationBell } from '../NotificationBell';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import type { UseNotificationsResult } from '../use-notifications';
import type { Notification } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Mock next/navigation
// ---------------------------------------------------------------------------

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeNotification(
  overrides: Partial<Notification> & { id: string },
): Notification {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    type: 'mention',
    title: 'Test notification',
    body: null,
    sourceType: 'thread_message',
    sourceThreadId: null,
    sourceMessageId: null,
    sourceRecordId: null,
    actorId: null,
    groupKey: null,
    read: false,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeHook(overrides?: Partial<UseNotificationsResult>): UseNotificationsResult {
  return {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    hasMore: false,
    markRead: vi.fn().mockResolvedValue(undefined),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationBell', () => {
  it('renders bell icon', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook()} />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('notification-bell')).toBeInTheDocument();
  });

  it('hides badge when unread count is 0', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook({ unreadCount: 0 })} />
      </IntlWrapper>,
    );
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('shows badge with unread count', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook({ unreadCount: 5 })} />
      </IntlWrapper>,
    );
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('5');
  });

  it('caps badge display at 99+', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook({ unreadCount: 150 })} />
      </IntlWrapper>,
    );
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toHaveTextContent('99+');
  });

  it('opens tray on click', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook()} />
      </IntlWrapper>,
    );
    expect(screen.queryByTestId('notification-tray')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-tray')).toBeInTheDocument();
  });

  it('closes tray on second click', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook()} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-tray')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.queryByTestId('notification-tray')).not.toBeInTheDocument();
  });

  it('closes tray on Escape key', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook()} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByTestId('notification-tray')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('notification-tray')).not.toBeInTheDocument();
  });

  it('renders notifications in tray when open', () => {
    const notifs = [
      makeNotification({ id: 'n1', title: 'Alice mentioned you' }),
      makeNotification({ id: 'n2', title: 'Bob replied' }),
    ];

    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook({ notifications: notifs })} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('notification-bell'));
    const items = screen.getAllByTestId('notification-item');
    expect(items).toHaveLength(2);
  });

  it('calls markAllRead when "Mark all as read" is clicked', () => {
    const markAllRead = vi.fn().mockResolvedValue(undefined);

    render(
      <IntlWrapper>
        <NotificationBell
          hook={makeHook({
            notifications: [makeNotification({ id: 'n1' })],
            markAllRead,
          })}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('notification-bell'));
    fireEvent.click(screen.getByTestId('mark-all-read'));
    expect(markAllRead).toHaveBeenCalledTimes(1);
  });

  it('shows empty state when no notifications', () => {
    render(
      <IntlWrapper>
        <NotificationBell hook={makeHook({ notifications: [], isLoading: false })} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('notification-bell'));
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });
});
