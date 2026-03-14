// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { IntlWrapper } from '@/test-utils/intl-wrapper';
import {
  CommandBarProvider,
  useCommandBar,
  deriveChannel,
} from '../command-bar-provider';
import { CommandBar } from '../command-bar';

// Polyfill ResizeObserver for Radix Dialog/cmdk in jsdom
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
// Test consumer — exposes provider values and actions
// ---------------------------------------------------------------------------

function TestConsumer() {
  const { state, open, close, setQuery } = useCommandBar();
  return (
    <div>
      <span data-testid="is-open">{String(state.isOpen)}</span>
      <span data-testid="mode">{state.mode}</span>
      <span data-testid="scoped-table-id">{state.scopedTableId ?? ''}</span>
      <span data-testid="query">{state.query}</span>
      <span data-testid="active-channel">{state.activeChannel ?? 'null'}</span>
      <button data-testid="open-global" onClick={() => open('global')} />
      <button
        data-testid="open-scoped"
        onClick={() => open('scoped', 'table-123')}
      />
      <button data-testid="close" onClick={() => close()} />
      <button
        data-testid="set-query-slash"
        onClick={() => setQuery('/create')}
      />
      <button
        data-testid="set-query-ai"
        onClick={() => setQuery('what is this?')}
      />
      <button
        data-testid="set-query-search"
        onClick={() => setQuery('project alpha')}
      />
    </div>
  );
}

function renderWithProviders(ui: React.ReactNode) {
  return render(
    <IntlWrapper>
      <CommandBarProvider>{ui}</CommandBarProvider>
    </IntlWrapper>,
  );
}

// ---------------------------------------------------------------------------
// deriveChannel — pure function unit tests
// ---------------------------------------------------------------------------

describe('deriveChannel', () => {
  it('returns null for empty input', () => {
    expect(deriveChannel('')).toBeNull();
    expect(deriveChannel('   ')).toBeNull();
  });

  it('returns slash for / prefix', () => {
    expect(deriveChannel('/create')).toBe('slash');
    expect(deriveChannel('/sort ascending')).toBe('slash');
  });

  it('returns ai for question mark', () => {
    expect(deriveChannel('what is this?')).toBe('ai');
    expect(deriveChannel('something ?')).toBe('ai');
  });

  it('returns ai for NL prefixes', () => {
    expect(deriveChannel('how do I add a field')).toBe('ai');
    expect(deriveChannel('what are the open tasks')).toBe('ai');
    expect(deriveChannel('why is this failing')).toBe('ai');
    expect(deriveChannel('find all overdue records')).toBe('ai');
    expect(deriveChannel('show me linked records')).toBe('ai');
  });

  it('returns search for plain text', () => {
    expect(deriveChannel('project alpha')).toBe('search');
    expect(deriveChannel('john smith')).toBe('search');
  });
});

// ---------------------------------------------------------------------------
// CommandBarProvider tests
// ---------------------------------------------------------------------------

describe('CommandBarProvider', () => {
  it('provides default state', () => {
    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    expect(screen.getByTestId('mode')).toHaveTextContent('global');
    expect(screen.getByTestId('query')).toHaveTextContent('');
    expect(screen.getByTestId('active-channel')).toHaveTextContent('null');
  });

  it('open(global) sets isOpen and mode', () => {
    renderWithProviders(<TestConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('mode')).toHaveTextContent('global');
  });

  it('open(scoped, tableId) sets scopedTableId', () => {
    renderWithProviders(<TestConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('open-scoped'));
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('mode')).toHaveTextContent('scoped');
    expect(screen.getByTestId('scoped-table-id')).toHaveTextContent(
      'table-123',
    );
  });

  it('close sets isOpen to false', () => {
    renderWithProviders(<TestConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('open-global'));
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    act(() => {
      fireEvent.click(screen.getByTestId('close'));
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('setQuery updates query and derives slash channel', () => {
    renderWithProviders(<TestConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('set-query-slash'));
    });
    expect(screen.getByTestId('query')).toHaveTextContent('/create');
    expect(screen.getByTestId('active-channel')).toHaveTextContent('slash');
  });

  it('setQuery derives AI channel for questions', () => {
    renderWithProviders(<TestConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('set-query-ai'));
    });
    expect(screen.getByTestId('active-channel')).toHaveTextContent('ai');
  });

  it('setQuery derives search channel for plain text', () => {
    renderWithProviders(<TestConsumer />);
    act(() => {
      fireEvent.click(screen.getByTestId('set-query-search'));
    });
    expect(screen.getByTestId('active-channel')).toHaveTextContent('search');
  });

  it('throws when useCommandBar is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useCommandBar must be used within a CommandBarProvider',
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// CommandBar component tests
// ---------------------------------------------------------------------------

describe('CommandBar', () => {
  it('renders without error', () => {
    renderWithProviders(<CommandBar />);
  });

  it('opens on Cmd+K and closes on Escape', () => {
    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar />
      </>,
    );

    expect(screen.getByTestId('is-open')).toHaveTextContent('false');

    // Cmd+K opens
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('mode')).toHaveTextContent('global');

    // Escape closes (via Radix dialog onOpenChange)
    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });

  it('opens on Ctrl+K for non-Mac users', () => {
    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar />
      </>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
  });

  it('Cmd+F opens in scoped mode', () => {
    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar />
      </>,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'f', metaKey: true });
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');
    expect(screen.getByTestId('mode')).toHaveTextContent('scoped');
  });

  it('Cmd+K toggles closed when already open', () => {
    renderWithProviders(
      <>
        <TestConsumer />
        <CommandBar />
      </>,
    );

    // Open
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('true');

    // Toggle closed
    act(() => {
      fireEvent.keyDown(document, { key: 'k', metaKey: true });
    });
    expect(screen.getByTestId('is-open')).toHaveTextContent('false');
  });
});
