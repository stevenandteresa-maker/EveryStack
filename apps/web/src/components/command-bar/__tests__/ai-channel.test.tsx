// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import { Command, CommandList } from '@/components/ui/command';
import { CommandBarProvider } from '../command-bar-provider';
import { CommandBarAIChannel } from '../ai-channel';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAiSearchQuery = vi.fn();
const mockExecuteSlashCommand = vi.fn();

vi.mock('@/actions/command-bar', () => ({
  aiSearchQuery: (...args: unknown[]) => mockAiSearchQuery(...args),
  executeSlashCommand: (...args: unknown[]) => mockExecuteSlashCommand(...args),
}));

// Polyfill ResizeObserver for Radix/cmdk in jsdom
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() { /* noop */ }
      unobserve() { /* noop */ }
      disconnect() { /* noop */ }
    };
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'a1b2c3d4-e5f6-4a90-ab12-ef1234567890';
const TENANT_ID = 'b2c3d4e5-f6a7-4b01-9cde-f12345678901';
const USER_ID = 'c3d4e5f6-a7b8-4c12-8def-123456789012';

function renderAIChannel(props: Partial<React.ComponentProps<typeof CommandBarAIChannel>> = {}) {
  const defaultProps = {
    query: 'what tables do I have?',
    workspaceId: WORKSPACE_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
    ...props,
  };

  return render(
    <IntlWrapper>
      <CommandBarProvider>
        <Command>
          <CommandList>
            <CommandBarAIChannel {...defaultProps} />
          </CommandList>
        </Command>
      </CommandBarProvider>
    </IntlWrapper>,
  );
}

// Helper to flush microtask queue + advance timers
async function advanceTimersAndFlush(ms: number) {
  vi.advanceTimersByTime(ms);
  // Flush microtasks (resolved promises)
  await vi.runAllTimersAsync();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandBarAIChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state while AI search is in progress', async () => {
    mockAiSearchQuery.mockImplementation(
      () => new Promise(() => { /* never resolves */ }),
    );

    renderAIChannel();

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId('ai-channel-loading')).toBeInTheDocument();
  });

  it('displays read results immediately without confirmation', async () => {
    mockAiSearchQuery.mockResolvedValue({
      success: true,
      type: 'read',
      content: 'You have 3 tables: Contacts, Deals, and Tasks.',
      creditsCharged: 1,
      creditsRemaining: 99,
    });

    renderAIChannel();

    // Advance timers and flush promises
    await act(async () => {
      await advanceTimersAndFlush(600);
    });

    expect(screen.getByTestId('ai-channel-read-results')).toBeInTheDocument();
    expect(screen.getByTestId('ai-read-result')).toBeInTheDocument();

    // Credit cost shown
    expect(screen.getByTestId('ai-credit-cost')).toBeInTheDocument();

    // No confirm/cancel buttons for read results
    expect(screen.queryByTestId('ai-action-buttons')).not.toBeInTheDocument();
  });

  it('shows action suggestion with confirmation UI', async () => {
    mockAiSearchQuery.mockResolvedValue({
      success: true,
      type: 'action',
      content: 'Create a new record in the Contacts table',
      actionSuggestion: {
        label: 'Create a new record in the Contacts table',
        description: 'This will create a new empty record in Contacts.',
        commandKey: 'new record',
        params: { tableId: 'contacts-123' },
      },
      creditsCharged: 2,
      creditsRemaining: 98,
    });

    renderAIChannel({ query: 'create a new contact' });

    await act(async () => {
      await advanceTimersAndFlush(600);
    });

    expect(screen.getByTestId('ai-channel-action-suggestion')).toBeInTheDocument();
    expect(screen.getByTestId('ai-action-preview')).toBeInTheDocument();
    expect(screen.getByTestId('ai-action-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('ai-action-cancel')).toBeInTheDocument();
  });

  it('handles confirm action click', async () => {
    mockAiSearchQuery.mockResolvedValue({
      success: true,
      type: 'action',
      content: 'Create a record',
      actionSuggestion: {
        label: 'Create a record',
        description: 'Creates a new record',
        commandKey: 'new record',
        params: { tableId: 't1' },
      },
      creditsCharged: 1,
      creditsRemaining: 99,
    });

    mockExecuteSlashCommand.mockResolvedValue({
      success: true,
      message: 'Record created',
    });

    renderAIChannel({ query: 'create a record' });

    await act(async () => {
      await advanceTimersAndFlush(600);
    });

    expect(screen.getByTestId('ai-action-confirm')).toBeInTheDocument();

    vi.useRealTimers();

    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-action-confirm'));
    });

    await waitFor(() => {
      expect(mockExecuteSlashCommand).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        'new record',
        { tableId: 't1' },
      );
    });
  });

  it('handles cancel action click', async () => {
    mockAiSearchQuery.mockResolvedValue({
      success: true,
      type: 'action',
      content: 'Create a record',
      actionSuggestion: {
        label: 'Create a record',
        description: 'Creates a new record',
        commandKey: 'new record',
      },
      creditsCharged: 1,
      creditsRemaining: 99,
    });

    renderAIChannel({ query: 'create a record' });

    await act(async () => {
      await advanceTimersAndFlush(600);
    });

    expect(screen.getByTestId('ai-action-cancel')).toBeInTheDocument();

    vi.useRealTimers();

    await act(async () => {
      fireEvent.click(screen.getByTestId('ai-action-cancel'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('ai-channel-action-suggestion')).not.toBeInTheDocument();
    });
  });

  it('shows error state when AI is unavailable', async () => {
    mockAiSearchQuery.mockResolvedValue({
      success: false,
      type: 'read',
      content: 'AI is unavailable',
      creditsCharged: 0,
      creditsRemaining: 0,
      error: 'Service unavailable',
    });

    renderAIChannel();

    await act(async () => {
      await advanceTimersAndFlush(600);
    });

    expect(screen.getByTestId('ai-channel-error')).toBeInTheDocument();
  });

  it('handles network error gracefully', async () => {
    mockAiSearchQuery.mockRejectedValue(new Error('Network error'));

    renderAIChannel();

    await act(async () => {
      await advanceTimersAndFlush(600);
    });

    expect(screen.getByTestId('ai-channel-error')).toBeInTheDocument();
  });

  it('returns null when query is empty', () => {
    renderAIChannel({ query: '' });
    expect(screen.queryByTestId('ai-channel-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-channel-read-results')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-channel-error')).not.toBeInTheDocument();
  });

  it('debounces AI calls at 500ms', async () => {
    mockAiSearchQuery.mockResolvedValue({
      success: true,
      type: 'read',
      content: 'Result',
      creditsCharged: 0,
      creditsRemaining: 100,
    });

    renderAIChannel();

    // At 300ms, should not have called yet
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(mockAiSearchQuery).not.toHaveBeenCalled();

    // At 500ms, should call
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(mockAiSearchQuery).toHaveBeenCalledTimes(1);
  });
});
