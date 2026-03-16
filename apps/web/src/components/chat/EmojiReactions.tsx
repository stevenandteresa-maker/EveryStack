'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmojiPicker } from './EmojiPicker';

/** Reactions JSONB shape: { "👍": ["user_id_1", "user_id_2"] } */
export type ReactionsMap = Record<string, string[]>;

interface EmojiReactionsProps {
  reactions: ReactionsMap;
  currentUserId: string;
  onToggle: (emoji: string) => void;
  className?: string;
}

/**
 * EmojiReactions — reaction chips below a message.
 *
 * Each chip: emoji + count + active highlight if current user reacted.
 * Click chip to toggle. "+" opens EmojiPicker for new reaction.
 */
export function EmojiReactions({
  reactions,
  currentUserId,
  onToggle,
  className,
}: EmojiReactionsProps) {
  const t = useTranslations('chat.emojiReactions');
  const [pickerOpen, setPickerOpen] = useState(false);

  const handlePickerSelect = useCallback(
    (emoji: string) => {
      onToggle(emoji);
    },
    [onToggle],
  );

  const entries = Object.entries(reactions).filter(
    ([, users]) => users.length > 0,
  );

  if (entries.length === 0) return null;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1', className)}
      data-testid="emoji-reactions"
    >
      {entries.map(([emoji, users]) => {
        const isActive = users.includes(currentUserId);
        return (
          <button
            key={emoji}
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
              'hover:bg-accent',
              isActive
                ? 'border-teal-300 bg-teal-50 text-teal-800'
                : 'border-border bg-background text-muted-foreground',
            )}
            onClick={() => onToggle(emoji)}
            aria-label={t('toggle', { emoji, count: users.length })}
            aria-pressed={isActive}
            data-testid={`reaction-chip-${emoji}`}
          >
            <span>{emoji}</span>
            <span>{users.length}</span>
          </button>
        );
      })}

      <EmojiPicker
        onSelect={handlePickerSelect}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      >
        <button
          type="button"
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-border',
            'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
          )}
          aria-label={t('addReaction')}
          data-testid="add-reaction-button"
        >
          <Plus className="h-3 w-3" />
        </button>
      </EmojiPicker>
    </div>
  );
}
