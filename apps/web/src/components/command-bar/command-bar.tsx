'use client';

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { useCommandBar } from './command-bar-provider';

// ---------------------------------------------------------------------------
// CommandBar — persistent modal (never unmounts, toggles via isOpen)
// ---------------------------------------------------------------------------

export function CommandBar() {
  const t = useTranslations('commandBar');
  const { state, open, close, setQuery } = useCommandBar();
  const { isOpen, activeChannel, query } = state;

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
          <CommandInput
            placeholder={t('placeholder')}
            value={query}
            onValueChange={setQuery}
            data-testid="command-bar-input"
          />
          <CommandList>
            {/* Channel: empty state — recent items placeholder (Prompt 15) */}
            {!activeChannel && (
              <CommandEmpty data-testid="command-bar-empty">
                {t('emptyRecent')}
              </CommandEmpty>
            )}

            {/* Channel: search */}
            {activeChannel === 'search' && (
              <CommandGroup
                heading={t('searchHeading')}
                data-testid="command-bar-channel-search"
              >
                <CommandItem disabled>{t('searchPlaceholder')}</CommandItem>
              </CommandGroup>
            )}

            {/* Channel: slash commands */}
            {activeChannel === 'slash' && (
              <CommandGroup
                heading={t('slashHeading')}
                data-testid="command-bar-channel-slash"
              >
                <CommandItem disabled>{t('slashPlaceholder')}</CommandItem>
              </CommandGroup>
            )}

            {/* Channel: AI */}
            {activeChannel === 'ai' && (
              <CommandGroup
                heading={t('aiHeading')}
                data-testid="command-bar-channel-ai"
              >
                <CommandItem disabled>{t('aiPlaceholder')}</CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
