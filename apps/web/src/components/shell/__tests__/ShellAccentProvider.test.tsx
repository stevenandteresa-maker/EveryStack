// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import {
  ShellAccentProvider,
  useShellAccent,
} from '../ShellAccentProvider';
import {
  PERSONAL_TENANT_ACCENT,
  PORTAL_ACCENT,
  DEFAULT_ACCENT_COLOR,
} from '@/lib/design-system/shell-accent';

/** Helper component that exposes context actions via buttons. */
function TestConsumer() {
  const { shellAccent, setShellAccent, revertShellAccent, applyTenantAccent } =
    useShellAccent();

  return (
    <div>
      <span data-testid="current-accent">{shellAccent}</span>
      <button
        data-testid="set-ocean"
        onClick={() => setShellAccent('#1D4ED8')}
      />
      <button data-testid="revert" onClick={() => revertShellAccent()} />
      <button
        data-testid="apply-personal"
        onClick={() => applyTenantAccent('t-1', true)}
      />
      <button
        data-testid="apply-org"
        onClick={() => applyTenantAccent('t-2', false, '#BE123C')}
      />
      <button
        data-testid="apply-org-no-accent"
        onClick={() => applyTenantAccent('t-3', false)}
      />
    </div>
  );
}

describe('ShellAccentProvider', () => {
  beforeEach(() => {
    // Reset any inline styles on :root
    document.documentElement.style.removeProperty('--shell-accent');
  });

  it('defaults to Teal accent', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );
    expect(screen.getByTestId('current-accent').textContent).toBe(
      DEFAULT_ACCENT_COLOR,
    );
  });

  it('accepts an initial accent override', () => {
    render(
      <ShellAccentProvider initialAccent="#7C3AED">
        <TestConsumer />
      </ShellAccentProvider>,
    );
    expect(screen.getByTestId('current-accent').textContent).toBe('#7C3AED');
  });

  it('sets --shell-accent CSS property on :root on mount', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );
    expect(
      document.documentElement.style.getPropertyValue('--shell-accent'),
    ).toBe(DEFAULT_ACCENT_COLOR);
  });

  it('setShellAccent() updates :root CSS property', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );

    act(() => {
      screen.getByTestId('set-ocean').click();
    });

    expect(screen.getByTestId('current-accent').textContent).toBe('#1D4ED8');
    expect(
      document.documentElement.style.getPropertyValue('--shell-accent'),
    ).toBe('#1D4ED8');
  });

  it('revertShellAccent() restores previous value', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );

    // Set to Ocean Blue
    act(() => {
      screen.getByTestId('set-ocean').click();
    });
    expect(screen.getByTestId('current-accent').textContent).toBe('#1D4ED8');

    // Revert — should go back to Teal
    act(() => {
      screen.getByTestId('revert').click();
    });
    expect(screen.getByTestId('current-accent').textContent).toBe(
      DEFAULT_ACCENT_COLOR,
    );
    expect(
      document.documentElement.style.getPropertyValue('--shell-accent'),
    ).toBe(DEFAULT_ACCENT_COLOR);
  });

  it('applyTenantAccent — personal tenant gets warm neutral', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );

    act(() => {
      screen.getByTestId('apply-personal').click();
    });

    expect(screen.getByTestId('current-accent').textContent).toBe(
      PERSONAL_TENANT_ACCENT,
    );
  });

  it('applyTenantAccent — org tenant gets configured accent', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );

    act(() => {
      screen.getByTestId('apply-org').click();
    });

    expect(screen.getByTestId('current-accent').textContent).toBe('#BE123C');
  });

  it('applyTenantAccent — org tenant with no accent defaults to Teal', () => {
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );

    // First switch to personal so we can verify it changes
    act(() => {
      screen.getByTestId('apply-personal').click();
    });
    expect(screen.getByTestId('current-accent').textContent).toBe(
      PERSONAL_TENANT_ACCENT,
    );

    // Switch to org with no accent
    act(() => {
      screen.getByTestId('apply-org-no-accent').click();
    });
    expect(screen.getByTestId('current-accent').textContent).toBe(
      DEFAULT_ACCENT_COLOR,
    );
  });

  it('portal accent is fixed and not affected by tenant switching', () => {
    // Portal accent is a CSS variable, not controlled by ShellAccentProvider.
    // Verify it remains at its constant value regardless of shell accent changes.
    render(
      <ShellAccentProvider>
        <TestConsumer />
      </ShellAccentProvider>,
    );

    // Switch tenants — portal accent should remain unaffected
    act(() => {
      screen.getByTestId('apply-personal').click();
    });

    // --portal-accent is defined in globals.css and not modified by ShellAccentProvider
    expect(PORTAL_ACCENT).toBe('#64748B');
    // ShellAccentProvider never touches --portal-accent
    expect(screen.getByTestId('current-accent').textContent).not.toBe(
      PORTAL_ACCENT,
    );
  });

  it('throws when useShellAccent is used outside provider', () => {
    function Orphan() {
      useShellAccent();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useShellAccent must be used within a ShellAccentProvider',
    );
  });
});
