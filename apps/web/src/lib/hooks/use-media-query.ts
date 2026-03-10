'use client';

/**
 * useMediaQuery — reactive CSS media query hook.
 *
 * Returns true when the media query matches, false otherwise.
 * Listens for changes and re-renders on match/unmatch.
 */

import { useSyncExternalStore, useCallback } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', callback);
      return () => mql.removeEventListener('change', callback);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => {
    return false;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
