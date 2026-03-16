'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface EmojiPickerProps {
  /** Called when an emoji is selected */
  onSelect: (emoji: string) => void;
  /** Trigger element — defaults to "+" button */
  children?: React.ReactNode;
  /** Control open state externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface EmojiMartSelection {
  native: string;
  id: string;
  shortcodes?: string;
}

/**
 * EmojiPicker — emoji-mart wrapped in a shadcn/ui Popover.
 *
 * Features: categories, search, skin tone selector, colon autocomplete.
 */
export function EmojiPicker({
  onSelect,
  children,
  open,
  onOpenChange,
}: EmojiPickerProps) {
  const t = useTranslations('chat.emojiPicker');

  const handleSelect = useCallback(
    (emoji: EmojiMartSelection) => {
      onSelect(emoji.native);
      onOpenChange?.(false);
    },
    [onSelect, onOpenChange],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-auto border-none p-0 shadow-lg"
        side="top"
        align="start"
        data-testid="emoji-picker-popover"
      >
        <Picker
          data={data}
          onEmojiSelect={handleSelect}
          title={t('title')}
          searchPosition="sticky"
          skinTonePosition="search"
          previewPosition="none"
          theme="light"
          set="native"
          perLine={8}
          maxFrequentRows={2}
        />
      </PopoverContent>
    </Popover>
  );
}
