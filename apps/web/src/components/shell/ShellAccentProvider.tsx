'use client';

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import {
  getShellAccent,
  DEFAULT_ACCENT_COLOR,
} from '@/lib/design-system/shell-accent';

/**
 * Shell Accent Provider (CP-002)
 *
 * Manages the --shell-accent CSS custom property on :root.
 * Supports optimistic repainting on tenant switch with revert on failure.
 *
 * Usage:
 *   <ShellAccentProvider>
 *     <AppShell>...</AppShell>
 *   </ShellAccentProvider>
 *
 * Consumers:
 *   const { setShellAccent, revertShellAccent } = useShellAccent();
 */

interface ShellAccentContextValue {
  /** Current shell accent color (hex). */
  shellAccent: string;
  /** Optimistically set the shell accent (e.g. on tenant switch). */
  setShellAccent: (color: string) => void;
  /** Revert to the previous accent (e.g. on Clerk setActive failure). */
  revertShellAccent: () => void;
  /** Compute and apply accent for a tenant context. */
  applyTenantAccent: (
    tenantId: string,
    isPersonalTenant: boolean,
    accentColor?: string | null,
  ) => void;
}

const ShellAccentContext = createContext<ShellAccentContextValue | null>(null);

interface ShellAccentProviderProps {
  children: ReactNode;
  /** Initial accent color. Defaults to Teal. */
  initialAccent?: string;
}

function applyToRoot(color: string): void {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--shell-accent', color);
  }
}

export function ShellAccentProvider({
  children,
  initialAccent = DEFAULT_ACCENT_COLOR,
}: ShellAccentProviderProps) {
  const [shellAccent, setShellAccentState] = useState(initialAccent);
  const previousAccentRef = useRef(initialAccent);

  // Sync CSS custom property on mount and when accent changes
  useEffect(() => {
    applyToRoot(shellAccent);
  }, [shellAccent]);

  const setShellAccent = useCallback(
    (color: string) => {
      previousAccentRef.current = shellAccent;
      setShellAccentState(color);
    },
    [shellAccent],
  );

  const revertShellAccent = useCallback(() => {
    setShellAccentState(previousAccentRef.current);
  }, []);

  const applyTenantAccent = useCallback(
    (
      tenantId: string,
      isPersonalTenant: boolean,
      accentColor?: string | null,
    ) => {
      const accent = getShellAccent(tenantId, isPersonalTenant, accentColor);
      previousAccentRef.current = shellAccent;
      setShellAccentState(accent);
    },
    [shellAccent],
  );

  return (
    <ShellAccentContext.Provider
      value={{ shellAccent, setShellAccent, revertShellAccent, applyTenantAccent }}
    >
      {children}
    </ShellAccentContext.Provider>
  );
}

export function useShellAccent(): ShellAccentContextValue {
  const context = useContext(ShellAccentContext);
  if (!context) {
    throw new Error(
      'useShellAccent must be used within a ShellAccentProvider',
    );
  }
  return context;
}
