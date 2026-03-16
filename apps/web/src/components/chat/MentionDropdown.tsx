'use client';

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { PresenceIndicator } from '@/components/presence/PresenceIndicator';
import type { PresenceState } from '@/components/presence/use-presence';
import type { MentionSuggestion, MentionDropdownState } from './types';

export interface MentionDropdownRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface MentionDropdownProps {
  items: MentionSuggestion[];
  command: MentionDropdownState['command'];
  clientRect?: MentionDropdownState['clientRect'];
  query: string;
  /** Presence map for showing online status on mention avatars */
  presenceMap?: Record<string, PresenceState>;
}

/**
 * Fuzzy-filter mention suggestions by query.
 * Matches substrings case-insensitively against label.
 */
export function filterMentionSuggestions(
  suggestions: MentionSuggestion[],
  query: string,
): MentionSuggestion[] {
  if (!query) return suggestions;
  const lower = query.toLowerCase();
  return suggestions.filter((s) => s.label.toLowerCase().includes(lower));
}

/**
 * Creates TipTap suggestion config for the Mention extension.
 * Bridges TipTap's imperative suggestion API with React state.
 */
export function createMentionSuggestion(opts: {
  suggestionsRef: React.RefObject<MentionSuggestion[]>;
  onStateChange: (state: MentionDropdownState | null) => void;
  keyDownRef: React.RefObject<((event: KeyboardEvent) => boolean) | null>;
}) {
  return {
    items: ({ query }: { query: string }) => {
      return filterMentionSuggestions(opts.suggestionsRef.current ?? [], query);
    },
    render: () => ({
      onStart: (props: MentionDropdownState) => {
        opts.onStateChange(props);
      },
      onUpdate: (props: MentionDropdownState) => {
        opts.onStateChange(props);
      },
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        return opts.keyDownRef.current?.(event) ?? false;
      },
      onExit: () => {
        opts.onStateChange(null);
      },
    }),
  };
}

/**
 * MentionDropdown — autocomplete dropdown for @mentions.
 *
 * Shows people (avatar + name + role badge) and group mentions
 * (@here, @channel). Arrow keys + Enter to select, Escape to dismiss.
 */
export const MentionDropdown = forwardRef<MentionDropdownRef, MentionDropdownProps>(
  function MentionDropdown({ items, command, clientRect, query, presenceMap }, ref) {
    const t = useTranslations('chatEditor');
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items.length, query]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command({ id: item.id, label: item.label });
        }
      },
      [items, command],
    );

    // Expose keyboard handler to TipTap suggestion plugin
    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) =>
            prev <= 0 ? items.length - 1 : prev - 1,
          );
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) =>
            prev >= items.length - 1 ? 0 : prev + 1,
          );
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        if (event.key === 'Escape') {
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return null;
    }

    // Position the dropdown using clientRect from TipTap
    const rect = clientRect?.();
    const style: React.CSSProperties = rect
      ? {
          position: 'fixed',
          left: rect.left,
          bottom: window.innerHeight - rect.top + 4,
          zIndex: 50,
        }
      : { position: 'absolute', bottom: '100%', left: 0, zIndex: 50 };

    // Separate people from group mentions
    const people = items.filter((i) => i.type !== 'group');
    const groups = items.filter((i) => i.type === 'group');

    let globalIndex = 0;

    return (
      <div
        className="w-64 overflow-hidden rounded-lg border bg-popover shadow-lg"
        style={style}
        data-testid="mention-dropdown"
        role="listbox"
        aria-label={t('mentionSuggestions')}
      >
        {people.length > 0 && (
          <div className="p-1">
            {people.map((item) => {
              const idx = globalIndex++;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={idx === selectedIndex}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                    idx === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-accent/50',
                  )}
                  onClick={() => selectItem(idx)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  {/* Avatar + Presence */}
                  <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {item.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element -- dynamic avatar URL
                      <img
                        src={item.avatar}
                        alt=""
                        className="h-6 w-6 rounded-full"
                      />
                    ) : (
                      item.label.charAt(0).toUpperCase()
                    )}
                    {presenceMap?.[item.id] && (
                      <PresenceIndicator
                        status={presenceMap[item.id]!}
                        size="small"
                        className="absolute -bottom-0.5 -right-0.5 ring-1 ring-popover"
                      />
                    )}
                  </span>

                  {/* Name + role */}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.role && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {item.role}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {groups.length > 0 && (
          <>
            {people.length > 0 && (
              <div className="border-t" />
            )}
            <div className="p-1">
              {groups.map((item) => {
                const idx = globalIndex++;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={idx === selectedIndex}
                    className={cn(
                      'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm',
                      idx === selectedIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50',
                    )}
                    onClick={() => selectItem(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-medium text-teal-800">
                      @
                    </span>
                    <span className="flex-1 truncate font-medium">
                      @{item.label}
                    </span>
                    {item.role && (
                      <span className="text-xs text-muted-foreground">
                        {item.role}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  },
);
