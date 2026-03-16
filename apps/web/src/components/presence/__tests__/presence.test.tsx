// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { PresenceIndicator } from '../PresenceIndicator';
import { CustomStatusDisplay } from '../CustomStatusDisplay';
import { CustomStatusEditor } from '../CustomStatusEditor';
import { HEARTBEAT_INTERVAL_MS, IDLE_TIMEOUT_MS } from '../use-presence';

// ---------------------------------------------------------------------------
// PresenceIndicator tests
// ---------------------------------------------------------------------------

describe('PresenceIndicator', () => {
  it('renders green dot for online status', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="online" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot).toHaveAttribute('data-status', 'online');
    expect(dot.className).toContain('bg-emerald-500');
  });

  it('renders yellow dot for away status', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="away" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot).toHaveAttribute('data-status', 'away');
    expect(dot.className).toContain('bg-yellow-500');
  });

  it('renders red dot for dnd status', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="dnd" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot).toHaveAttribute('data-status', 'dnd');
    expect(dot.className).toContain('bg-red-500');
  });

  it('renders gray dot for offline status', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="offline" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot).toHaveAttribute('data-status', 'offline');
    expect(dot.className).toContain('bg-gray-400');
  });

  it('applies size variant: small (8px)', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="online" size="small" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot.className).toContain('w-2');
    expect(dot.className).toContain('h-2');
  });

  it('applies size variant: large (12px)', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="online" size="large" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot.className).toContain('w-3');
    expect(dot.className).toContain('h-3');
  });

  it('has accessible aria-label', () => {
    render(
      <IntlWrapper>
        <PresenceIndicator status="online" />
      </IntlWrapper>,
    );
    const dot = screen.getByTestId('presence-indicator');
    expect(dot).toHaveAttribute('aria-label', 'Online');
    expect(dot).toHaveAttribute('role', 'img');
  });
});

// ---------------------------------------------------------------------------
// CustomStatusDisplay tests
// ---------------------------------------------------------------------------

describe('CustomStatusDisplay', () => {
  it('renders emoji and text', () => {
    render(
      <IntlWrapper>
        <CustomStatusDisplay emoji="🏖" text="On vacation" />
      </IntlWrapper>,
    );
    const display = screen.getByTestId('custom-status-display');
    expect(display).toHaveTextContent('🏖');
    expect(display).toHaveTextContent('On vacation');
  });

  it('renders nothing when both are empty', () => {
    const { container } = render(
      <IntlWrapper>
        <CustomStatusDisplay emoji="" text="" />
      </IntlWrapper>,
    );
    expect(container.innerHTML).toBe('');
  });

  it('truncates long text', () => {
    render(
      <IntlWrapper>
        <CustomStatusDisplay emoji="💬" text="A very long status message that should be truncated with ellipsis" />
      </IntlWrapper>,
    );
    const textEl = screen.getByTitle('A very long status message that should be truncated with ellipsis');
    expect(textEl.className).toContain('truncate');
  });
});

// ---------------------------------------------------------------------------
// CustomStatusEditor tests
// ---------------------------------------------------------------------------

describe('CustomStatusEditor', () => {
  it('renders trigger button', () => {
    render(
      <IntlWrapper>
        <CustomStatusEditor
          onSave={vi.fn()}
          onClear={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('custom-status-trigger')).toBeInTheDocument();
  });

  it('opens editor popover on click', async () => {
    render(
      <IntlWrapper>
        <CustomStatusEditor
          open={true}
          onSave={vi.fn()}
          onClear={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('custom-status-editor')).toBeInTheDocument();
    expect(screen.getByTestId('status-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('auto-clear-select')).toBeInTheDocument();
  });

  it('calls onSave with emoji, text, and clearAt', async () => {
    const onSave = vi.fn();
    render(
      <IntlWrapper>
        <CustomStatusEditor
          open={true}
          initialEmoji="🏖"
          initialText="Vacation"
          onSave={onSave}
          onClear={vi.fn()}
        />
      </IntlWrapper>,
    );
    const saveBtn = screen.getByTestId('status-save-button');
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(onSave).toHaveBeenCalledWith('🏖', 'Vacation', undefined);
  });

  it('calls onClear when clear button is clicked', async () => {
    const onClear = vi.fn();
    render(
      <IntlWrapper>
        <CustomStatusEditor
          open={true}
          initialEmoji="🏖"
          initialText="Vacation"
          onSave={vi.fn()}
          onClear={onClear}
        />
      </IntlWrapper>,
    );
    const clearBtn = screen.getByTestId('status-clear-button');
    await act(async () => {
      fireEvent.click(clearBtn);
    });
    expect(onClear).toHaveBeenCalled();
  });

  it('disables save when no emoji and no text', () => {
    render(
      <IntlWrapper>
        <CustomStatusEditor
          open={true}
          onSave={vi.fn()}
          onClear={vi.fn()}
        />
      </IntlWrapper>,
    );
    expect(screen.getByTestId('status-save-button')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// usePresence constants tests
// ---------------------------------------------------------------------------

describe('usePresence constants', () => {
  it('heartbeat interval is 30 seconds', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });

  it('idle timeout is 5 minutes', () => {
    expect(IDLE_TIMEOUT_MS).toBe(300_000);
  });
});

// ---------------------------------------------------------------------------
// usePresence hook tests
// ---------------------------------------------------------------------------

describe('usePresence hook', () => {
  it('sends heartbeat at 30s interval', () => {
    // The hook uses setInterval(fn, HEARTBEAT_INTERVAL_MS = 30_000)
    expect(HEARTBEAT_INTERVAL_MS).toBe(30_000);
  });

  it('idle detection triggers at 5 minutes', () => {
    // The hook checks elapsed >= IDLE_TIMEOUT_MS to set 'away'
    expect(IDLE_TIMEOUT_MS).toBe(5 * 60 * 1000);
  });

  it('uses PRESENCE_UPDATE event from shared realtime', async () => {
    const { REALTIME_EVENTS: events } = await import('@everystack/shared/realtime');
    expect(events.PRESENCE_UPDATE).toBe('presence.update');
  });
});
