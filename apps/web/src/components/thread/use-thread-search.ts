'use client';

/**
 * useThreadSearch — in-thread search with client-side or server-side mode.
 *
 * - Short threads (all messages in memory): client-side string filter
 * - Long threads (paginated/not all loaded): server ILIKE via searchThreadMessages
 *
 * @see docs/reference/communications.md § In-thread search
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ThreadMessage } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HighlightPosition {
  messageId: string;
  start: number;
  length: number;
}

interface UseThreadSearchOptions {
  threadId: string | null;
  /** All messages currently loaded in memory */
  messages: ThreadMessage[];
  /** Whether all messages are loaded (no more pages) */
  allLoaded: boolean;
  /** Server search action (injectable for testing) */
  searchAction?: (
    threadId: string,
    query: string,
  ) => Promise<ThreadMessage[]>;
}

export interface UseThreadSearchResult {
  query: string;
  setQuery: (q: string) => void;
  results: ThreadMessage[];
  highlightPositions: HighlightPosition[];
  /** Index of current active match */
  activeMatchIndex: number;
  totalMatches: number;
  scrollToMatch: (index: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  isSearching: boolean;
}

// ---------------------------------------------------------------------------
// Default server search
// ---------------------------------------------------------------------------

async function defaultSearchAction(
  threadId: string,
  query: string,
): Promise<ThreadMessage[]> {
  const { searchThreadMessagesAction } = await import(
    '@/actions/thread-queries'
  );
  return searchThreadMessagesAction({ threadId, query });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!content || typeof content !== 'object') return '';

  const node = content as Record<string, unknown>;

  // TipTap JSON: recursively extract text
  if (node.text && typeof node.text === 'string') return node.text;
  if (Array.isArray(node.content)) {
    return (node.content as unknown[]).map(extractTextContent).join(' ');
  }
  return JSON.stringify(content);
}

function findHighlightPositions(
  messages: ThreadMessage[],
  query: string,
): HighlightPosition[] {
  if (!query) return [];
  const lowerQuery = query.toLowerCase();
  const positions: HighlightPosition[] = [];

  for (const msg of messages) {
    const text = extractTextContent(msg.content).toLowerCase();
    let startIdx = 0;
    while (true) {
      const idx = text.indexOf(lowerQuery, startIdx);
      if (idx === -1) break;
      positions.push({
        messageId: msg.id,
        start: idx,
        length: query.length,
      });
      startIdx = idx + 1;
    }
  }

  return positions;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useThreadSearch({
  threadId,
  messages,
  allLoaded,
  searchAction = defaultSearchAction,
}: UseThreadSearchOptions): UseThreadSearchResult {
  const [query, setQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const trimmedQuery = query.trim();
  const useServerSearch = !allLoaded && trimmedQuery.length > 0;

  // Server-side search (only for long/paginated threads)
  const { data: serverResults = [], isFetching } = useQuery({
    queryKey: ['thread-search', threadId, trimmedQuery],
    queryFn: () =>
      threadId ? searchAction(threadId, trimmedQuery) : Promise.resolve([]),
    enabled: useServerSearch && !!threadId && trimmedQuery.length >= 2,
    staleTime: 30_000,
  });

  // Client-side search
  const clientResults = useMemo(() => {
    if (!trimmedQuery || useServerSearch) return [];
    const lowerQuery = trimmedQuery.toLowerCase();
    return messages.filter((msg) =>
      extractTextContent(msg.content).toLowerCase().includes(lowerQuery),
    );
  }, [messages, trimmedQuery, useServerSearch]);

  const results = useServerSearch ? serverResults : clientResults;

  const highlightPositions = useMemo(
    () => findHighlightPositions(results, trimmedQuery),
    [results, trimmedQuery],
  );

  const totalMatches = highlightPositions.length;

  const scrollToMatch = useCallback(
    (index: number) => {
      if (index < 0 || index >= totalMatches) return;
      setActiveMatchIndex(index);
      const pos = highlightPositions[index];
      if (!pos) return;
      const el = document.querySelector(
        `[data-message-id="${pos.messageId}"]`,
      );
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    [highlightPositions, totalMatches],
  );

  const nextMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const next = (activeMatchIndex + 1) % totalMatches;
    scrollToMatch(next);
  }, [activeMatchIndex, totalMatches, scrollToMatch]);

  const prevMatch = useCallback(() => {
    if (totalMatches === 0) return;
    const prev = (activeMatchIndex - 1 + totalMatches) % totalMatches;
    scrollToMatch(prev);
  }, [activeMatchIndex, totalMatches, scrollToMatch]);

  // Reset active index when query changes
  const handleSetQuery = useCallback((q: string) => {
    setQuery(q);
    setActiveMatchIndex(0);
  }, []);

  return {
    query,
    setQuery: handleSetQuery,
    results,
    highlightPositions,
    activeMatchIndex,
    totalMatches,
    scrollToMatch,
    nextMatch,
    prevMatch,
    isSearching: isFetching,
  };
}
