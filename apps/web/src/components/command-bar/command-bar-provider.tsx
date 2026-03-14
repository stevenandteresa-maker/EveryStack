'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CommandBarMode = 'global' | 'scoped';
export type CommandBarChannel = 'search' | 'slash' | 'ai' | null;

export interface CommandBarState {
  isOpen: boolean;
  mode: CommandBarMode;
  scopedTableId?: string;
  query: string;
  activeChannel: CommandBarChannel;
}

export interface CommandBarContextValue {
  state: CommandBarState;
  open: (mode?: CommandBarMode, tableId?: string) => void;
  close: () => void;
  setQuery: (query: string) => void;
}

// ---------------------------------------------------------------------------
// Channel detection
// ---------------------------------------------------------------------------

const AI_PREFIX_PATTERNS = /^(how|what|why|find|show\s?me)\b/i;

export function deriveChannel(query: string): CommandBarChannel {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) return 'slash';
  if (trimmed.includes('?') || AI_PREFIX_PATTERNS.test(trimmed)) return 'ai';
  return 'search';
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const CommandBarContext = createContext<CommandBarContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CommandBarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CommandBarMode>('global');
  const [scopedTableId, setScopedTableId] = useState<string | undefined>();
  const [query, setQueryRaw] = useState('');

  const activeChannel = useMemo(() => deriveChannel(query), [query]);

  const open = useCallback(
    (openMode: CommandBarMode = 'global', tableId?: string) => {
      setMode(openMode);
      setScopedTableId(tableId);
      setQueryRaw('');
      setIsOpen(true);
    },
    [],
  );

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
  }, []);

  const value = useMemo<CommandBarContextValue>(
    () => ({
      state: { isOpen, mode, scopedTableId, query, activeChannel },
      open,
      close,
      setQuery,
    }),
    [isOpen, mode, scopedTableId, query, activeChannel, open, close, setQuery],
  );

  return (
    <CommandBarContext.Provider value={value}>
      {children}
    </CommandBarContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCommandBar(): CommandBarContextValue {
  const ctx = useContext(CommandBarContext);
  if (!ctx) {
    throw new Error('useCommandBar must be used within a CommandBarProvider');
  }
  return ctx;
}
