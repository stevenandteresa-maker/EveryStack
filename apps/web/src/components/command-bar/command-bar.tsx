'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { useCommandBar } from './command-bar-provider';
import { CommandBarSearchResults } from './search-results';
import { CommandBarSlashMenu } from './slash-menu';
import { CommandBarAIChannel } from './ai-channel';
import { CommandBarRecentItems } from './recent-items';
import type {
  CommandEntry,
  SearchResult,
  NavigationResult,
  RecentItem,
} from '@/lib/command-bar/types';

// ---------------------------------------------------------------------------
// CommandBar — persistent modal (never unmounts, toggles via isOpen)
// ---------------------------------------------------------------------------

interface CommandBarProps {
  workspaceId?: string;
  tenantId?: string;
  userId?: string;
  scopedTableName?: string;
  commands?: CommandEntry[];
  searchRecordsFn?: (
    tenantId: string,
    workspaceId: string,
    query: string,
    opts?: { tableId?: string; userId?: string },
  ) => Promise<SearchResult[]>;
  searchTablesAndViewsFn?: (
    tenantId: string,
    workspaceId: string,
    query: string,
    userId: string,
  ) => Promise<NavigationResult[]>;
  getRecentItemsFn?: (
    userId: string,
    tenantId: string,
    limit?: number,
  ) => Promise<RecentItem[]>;
  trackRecentItemFn?: (
    userId: string,
    tenantId: string,
    item: { item_type: string; item_id: string; display_name: string; entity_context?: string },
  ) => Promise<void>;
  createSessionFn?: (
    userId: string,
    tenantId: string,
    context: { mode: string; scopedTableId?: string; currentPath?: string },
  ) => Promise<string>;
  closeSessionFn?: (
    sessionId: string,
    tenantId: string,
    data: {
      messages: Array<{ query: string; channel: string; timestamp: string }>;
      resultSet: Record<string, unknown>;
    },
  ) => Promise<void>;
  onCommandSelect?: (command: CommandEntry) => void;
}

export function CommandBar({
  workspaceId = '',
  tenantId = '',
  userId = '',
  scopedTableName,
  commands = [],
  searchRecordsFn,
  searchTablesAndViewsFn,
  getRecentItemsFn,
  trackRecentItemFn,
  createSessionFn,
  closeSessionFn,
  onCommandSelect,
}: CommandBarProps) {
  const t = useTranslations('commandBar');
  const { state, open, close, setQuery } = useCommandBar();
  const { isOpen, activeChannel, query, scopedTableId, mode } = state;

  // Session tracking refs
  const sessionIdRef = useRef<string | null>(null);
  const queriesRef = useRef<Array<{ query: string; channel: string; timestamp: string }>>([]);
  const selectionsRef = useRef<Record<string, unknown>>({});

  // -----------------------------------------------------------------------
  // Session analytics — create on open, close on close
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (isOpen && createSessionFn && userId && tenantId) {
      queriesRef.current = [];
      selectionsRef.current = {};
      createSessionFn(userId, tenantId, {
        mode,
        scopedTableId,
        currentPath: typeof window !== 'undefined' ? window.location.pathname : undefined,
      })
        .then((id) => {
          sessionIdRef.current = id;
        })
        .catch(() => {
          // Analytics failure is non-blocking
        });
    }

    if (!isOpen && sessionIdRef.current && closeSessionFn && tenantId) {
      const sid = sessionIdRef.current;
      sessionIdRef.current = null;
      closeSessionFn(sid, tenantId, {
        messages: queriesRef.current,
        resultSet: selectionsRef.current,
      }).catch(() => {
        // Analytics failure is non-blocking
      });
    }
  }, [isOpen, createSessionFn, closeSessionFn, userId, tenantId, mode, scopedTableId]);

  // Track queries for session analytics
  useEffect(() => {
    if (isOpen && query.trim()) {
      queriesRef.current.push({
        query,
        channel: activeChannel ?? 'none',
        timestamp: new Date().toISOString(),
      });
    }
  }, [isOpen, query, activeChannel]);

  // -----------------------------------------------------------------------
  // Track recent item helper
  // -----------------------------------------------------------------------
  const trackAndClose = useCallback(
    (itemType: string, itemId: string, displayName: string, entityContext?: string) => {
      if (trackRecentItemFn && userId && tenantId) {
        trackRecentItemFn(userId, tenantId, {
          item_type: itemType,
          item_id: itemId,
          display_name: displayName,
          entity_context: entityContext,
        }).catch(() => {
          // Tracking failure is non-blocking
        });
      }
      selectionsRef.current = {
        ...selectionsRef.current,
        lastSelected: { itemType, itemId, displayName },
      };
      close();
    },
    [trackRecentItemFn, userId, tenantId, close],
  );

  // -----------------------------------------------------------------------
  // Global keyboard shortcuts
  // -----------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K / Ctrl+K → global mode
      if (mod && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open('global');
        }
        return;
      }

      // Cmd+F / Ctrl+F → scoped mode
      if (mod && e.key === 'f') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open('scoped');
        }
      }
    },
    [isOpen, open, close],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // -----------------------------------------------------------------------
  // Dialog open-change handler (handles Escape via Radix)
  // -----------------------------------------------------------------------
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        close();
      }
    },
    [close],
  );

  // -----------------------------------------------------------------------
  // Scoped mode: filter slash commands to table_view context
  // -----------------------------------------------------------------------
  const effectiveCommands = mode === 'scoped'
    ? commands.filter((cmd) => cmd.context_scopes.includes('table_view'))
    : commands;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden p-0 shadow-lg"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">{t('placeholder')}</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {/* Scoped mode badge */}
          {mode === 'scoped' && scopedTableId && (
            <div
              className="flex items-center gap-2 border-b px-3 py-1.5"
              data-testid="scoped-mode-badge"
            >
              <Badge variant="outline" className="text-xs">
                {scopedTableName ?? t('scopedLabel')}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t('scopedHint')}
              </span>
            </div>
          )}

          <CommandInput
            placeholder={t('placeholder')}
            value={query}
            onValueChange={setQuery}
            data-testid="command-bar-input"
          />
          <CommandList>
            {/* Channel: empty state — show recent items */}
            {!activeChannel && (
              <CommandBarRecentItems
                tenantId={tenantId}
                userId={userId}
                getRecentItemsFn={getRecentItemsFn}
                onSelect={(item) =>
                  trackAndClose(item.item_type, item.item_id, item.display_name, item.entity_context)
                }
              />
            )}

            {/* Channel: search — records + tables/views */}
            {activeChannel === 'search' && searchRecordsFn && searchTablesAndViewsFn && (
              <CommandBarSearchResults
                query={query}
                scopedTableId={scopedTableId}
                workspaceId={workspaceId}
                tenantId={tenantId}
                userId={userId}
                searchRecordsFn={searchRecordsFn}
                searchTablesAndViewsFn={searchTablesAndViewsFn}
                getRecentItemsFn={getRecentItemsFn}
                onSelect={close}
                onTrackItem={trackRecentItemFn ? (itemType, itemId, displayName, entityContext) => {
                  trackAndClose(itemType, itemId, displayName, entityContext);
                } : undefined}
              />
            )}

            {/* Channel: search fallback when no search fns provided */}
            {activeChannel === 'search' && (!searchRecordsFn || !searchTablesAndViewsFn) && (
              <CommandGroup
                heading={t('searchHeading')}
                data-testid="command-bar-channel-search"
              >
                <CommandItem disabled>{t('searchPlaceholder')}</CommandItem>
              </CommandGroup>
            )}

            {/* Channel: slash commands */}
            {activeChannel === 'slash' && effectiveCommands.length > 0 && (
              <CommandBarSlashMenu
                query={query}
                commands={effectiveCommands}
                onSelect={(cmd) => {
                  trackAndClose('command', cmd.id, cmd.label);
                  onCommandSelect?.(cmd);
                }}
              />
            )}

            {/* Channel: slash fallback when no commands provided */}
            {activeChannel === 'slash' && effectiveCommands.length === 0 && (
              <CommandGroup
                heading={t('slashHeading')}
                data-testid="command-bar-channel-slash"
              >
                <CommandItem disabled>{t('slashPlaceholder')}</CommandItem>
              </CommandGroup>
            )}

            {/* Channel: AI */}
            {activeChannel === 'ai' && (
              <CommandBarAIChannel
                query={query}
                workspaceId={workspaceId}
                tenantId={tenantId}
                userId={userId}
              />
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
