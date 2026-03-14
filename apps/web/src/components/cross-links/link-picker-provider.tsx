'use client';

/**
 * LinkPickerProvider — context managing Link Picker state.
 *
 * Tracks which cross-link/source record is active, whether the picker is
 * open, the selection mode (single vs multi), and accumulated selections
 * in multi mode.
 *
 * @see docs/reference/cross-linking.md § Link Picker UX
 */

import {
  createContext,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LinkPickerMode = 'single' | 'multi';

export interface LinkPickerState {
  isOpen: boolean;
  crossLinkId: string | null;
  sourceRecordId: string | null;
  mode: LinkPickerMode;
  selectedIds: Set<string>;
}

export interface LinkPickerContextValue extends LinkPickerState {
  open: (crossLinkId: string, sourceRecordId: string, mode?: LinkPickerMode) => void;
  close: () => void;
  toggleSelected: (targetRecordId: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelected: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const defaultState: LinkPickerState = {
  isOpen: false,
  crossLinkId: null,
  sourceRecordId: null,
  mode: 'multi',
  selectedIds: new Set<string>(),
};

export const LinkPickerContext = createContext<LinkPickerContextValue>({
  ...defaultState,
  open: () => {},
  close: () => {},
  toggleSelected: () => {},
  setSelectedIds: () => {},
  clearSelected: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function LinkPickerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LinkPickerState>(defaultState);

  const open = useCallback(
    (crossLinkId: string, sourceRecordId: string, mode: LinkPickerMode = 'multi') => {
      setState({
        isOpen: true,
        crossLinkId,
        sourceRecordId,
        mode,
        selectedIds: new Set<string>(),
      });
    },
    [],
  );

  const close = useCallback(() => {
    setState(defaultState);
  }, []);

  const toggleSelected = useCallback((targetRecordId: string) => {
    setState((prev) => {
      const next = new Set(prev.selectedIds);
      if (next.has(targetRecordId)) {
        next.delete(targetRecordId);
      } else {
        next.add(targetRecordId);
      }
      return { ...prev, selectedIds: next };
    });
  }, []);

  const setSelectedIds = useCallback((ids: Set<string>) => {
    setState((prev) => ({ ...prev, selectedIds: ids }));
  }, []);

  const clearSelected = useCallback(() => {
    setState((prev) => ({ ...prev, selectedIds: new Set<string>() }));
  }, []);

  const value = useMemo<LinkPickerContextValue>(
    () => ({
      ...state,
      open,
      close,
      toggleSelected,
      setSelectedIds,
      clearSelected,
    }),
    [state, open, close, toggleSelected, setSelectedIds, clearSelected],
  );

  return (
    <LinkPickerContext.Provider value={value}>
      {children}
    </LinkPickerContext.Provider>
  );
}
