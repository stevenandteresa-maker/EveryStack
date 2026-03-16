// @vitest-environment jsdom
/**
 * Tests for Record Thread panel components: ThreadTabBar, ThreadLensBar,
 * ClientVisibleBanner, SharedNoteMessage, and RecordThreadPanel integration.
 *
 * @see docs/reference/communications.md § Record Thread
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { ThreadTabBar } from '../ThreadTabBar';
import { ThreadLensBar } from '../ThreadLensBar';
import { ClientVisibleBanner } from '../ClientVisibleBanner';
import { SharedNoteMessage } from '../SharedNoteMessage';

// ---------------------------------------------------------------------------
// ThreadTabBar
// ---------------------------------------------------------------------------

describe('ThreadTabBar', () => {
  it('renders Team Notes tab as active by default', () => {
    render(
      <IntlWrapper>
        <ThreadTabBar
          activeTab="internal"
          onTabChange={vi.fn()}
          clientThreadEnabled={false}
        />
      </IntlWrapper>,
    );

    const teamTab = screen.getByTestId('thread-tab-internal');
    expect(teamTab).toHaveAttribute('aria-selected', 'true');
    expect(teamTab).toHaveTextContent('Team Notes');
  });

  it('does not render Client Messages tab when disabled', () => {
    render(
      <IntlWrapper>
        <ThreadTabBar
          activeTab="internal"
          onTabChange={vi.fn()}
          clientThreadEnabled={false}
        />
      </IntlWrapper>,
    );

    expect(screen.queryByTestId('thread-tab-client')).toBeNull();
  });

  it('renders Client Messages tab when enabled', () => {
    render(
      <IntlWrapper>
        <ThreadTabBar
          activeTab="internal"
          onTabChange={vi.fn()}
          clientThreadEnabled={true}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-tab-client')).toHaveTextContent(
      'Client Messages',
    );
  });

  it('calls onTabChange when switching tabs', () => {
    const onTabChange = vi.fn();
    render(
      <IntlWrapper>
        <ThreadTabBar
          activeTab="internal"
          onTabChange={onTabChange}
          clientThreadEnabled={true}
        />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByTestId('thread-tab-client'));
    expect(onTabChange).toHaveBeenCalledWith('client');
  });

  it('highlights active tab with aria-selected', () => {
    render(
      <IntlWrapper>
        <ThreadTabBar
          activeTab="client"
          onTabChange={vi.fn()}
          clientThreadEnabled={true}
        />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-tab-client')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('thread-tab-internal')).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});

// ---------------------------------------------------------------------------
// ThreadLensBar
// ---------------------------------------------------------------------------

describe('ThreadLensBar', () => {
  it('renders all four lens buttons', () => {
    render(
      <IntlWrapper>
        <ThreadLensBar activeLens={undefined} onLensChange={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Notes')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
  });

  it('marks All as active when no lens is set', () => {
    render(
      <IntlWrapper>
        <ThreadLensBar activeLens={undefined} onLensChange={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-lens-lensAll')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('calls onLensChange with correct filter', () => {
    const onLensChange = vi.fn();
    render(
      <IntlWrapper>
        <ThreadLensBar activeLens={undefined} onLensChange={onLensChange} />
      </IntlWrapper>,
    );

    fireEvent.click(screen.getByText('Notes'));
    expect(onLensChange).toHaveBeenCalledWith('notes');

    fireEvent.click(screen.getByText('Activity'));
    expect(onLensChange).toHaveBeenCalledWith('activity');

    fireEvent.click(screen.getByText('Files'));
    expect(onLensChange).toHaveBeenCalledWith('files');
  });

  it('marks the active lens as selected', () => {
    render(
      <IntlWrapper>
        <ThreadLensBar activeLens="files" onLensChange={vi.fn()} />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('thread-lens-lensFiles')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByTestId('thread-lens-lensAll')).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});

// ---------------------------------------------------------------------------
// ClientVisibleBanner
// ---------------------------------------------------------------------------

describe('ClientVisibleBanner', () => {
  it('renders the warning text', () => {
    render(
      <IntlWrapper>
        <ClientVisibleBanner />
      </IntlWrapper>,
    );

    expect(screen.getByTestId('client-visible-banner')).toHaveTextContent(
      'Messages here are visible to the portal client.',
    );
  });

  it('has role=status for accessibility', () => {
    render(
      <IntlWrapper>
        <ClientVisibleBanner />
      </IntlWrapper>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SharedNoteMessage
// ---------------------------------------------------------------------------

describe('SharedNoteMessage', () => {
  it('renders children with note icon and accent border', () => {
    render(
      <IntlWrapper>
        <SharedNoteMessage>
          <span data-testid="child-content">Test note message</span>
        </SharedNoteMessage>
      </IntlWrapper>,
    );

    const wrapper = screen.getByTestId('shared-note-message');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('border-l-[3px]', 'border-teal-500', 'bg-muted/40', 'pl-3');
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByTestId('child-content')).toHaveTextContent(
      'Test note message',
    );
  });
});
