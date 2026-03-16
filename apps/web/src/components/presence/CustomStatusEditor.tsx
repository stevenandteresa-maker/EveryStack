'use client';

/**
 * CustomStatusEditor — set/clear custom status with emoji + text + auto-clear.
 *
 * Reuses EmojiPicker from Unit 4. Saves via updateCustomStatus server action.
 * Auto-clear options: 1h, 4h, Today, This week, Custom date.
 *
 * @see docs/reference/communications.md § Presence & Status
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Smile, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmojiPicker } from '@/components/chat/EmojiPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomStatusEditorProps {
  /** Current emoji (if already set) */
  initialEmoji?: string;
  /** Current text (if already set) */
  initialText?: string;
  /** Called on save with status data */
  onSave: (emoji: string, text: string, clearAt?: Date) => void | Promise<void>;
  /** Called on clear */
  onClear: () => void | Promise<void>;
  /** Control open state externally */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

type AutoClearOption = 'none' | '1h' | '4h' | 'today' | 'this_week';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeClearDate(option: AutoClearOption): Date | undefined {
  const now = new Date();
  switch (option) {
    case '1h':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case '4h':
      return new Date(now.getTime() + 4 * 60 * 60 * 1000);
    case 'today': {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'this_week': {
      const end = new Date(now);
      const daysUntilSunday = 7 - end.getDay();
      end.setDate(end.getDate() + daysUntilSunday);
      end.setHours(23, 59, 59, 999);
      return end;
    }
    case 'none':
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CustomStatusEditor({
  initialEmoji = '',
  initialText = '',
  onSave,
  onClear,
  open,
  onOpenChange,
}: CustomStatusEditorProps) {
  const t = useTranslations('presence.statusEditor');
  const [emoji, setEmoji] = useState(initialEmoji);
  const [text, setText] = useState(initialText);
  const [autoClear, setAutoClear] = useState<AutoClearOption>('none');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleEmojiSelect = useCallback((selected: string) => {
    setEmoji(selected);
  }, []);

  const handleSave = useCallback(async () => {
    if (!emoji && !text) return;
    setSaving(true);
    try {
      const clearAt = computeClearDate(autoClear);
      await onSave(emoji || '\u{1F4AC}', text, clearAt);
      onOpenChange?.(false);
    } finally {
      setSaving(false);
    }
  }, [emoji, text, autoClear, onSave, onOpenChange]);

  const handleClear = useCallback(async () => {
    setSaving(true);
    try {
      await onClear();
      setEmoji('');
      setText('');
      setAutoClear('none');
      onOpenChange?.(false);
    } finally {
      setSaving(false);
    }
  }, [onClear, onOpenChange]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="custom-status-trigger"
          aria-label={t('setStatus')}
        >
          {emoji ? (
            <span className="mr-1">{emoji}</span>
          ) : (
            <Smile className="h-4 w-4 mr-1" />
          )}
          <span className="text-body-sm">{t('setStatus')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-4"
        side="right"
        align="start"
        data-testid="custom-status-editor"
      >
        <div className="flex flex-col gap-3">
          {/* Emoji + Text Input */}
          <div className="flex items-center gap-2">
            <EmojiPicker
              onSelect={handleEmojiSelect}
              open={emojiPickerOpen}
              onOpenChange={setEmojiPickerOpen}
            >
              <button
                type="button"
                className="flex items-center justify-center w-10 h-10 rounded border border-border hover:bg-muted transition-colors"
                data-testid="status-emoji-trigger"
                aria-label={t('pickEmoji')}
              >
                {emoji ? (
                  <span className="text-lg">{emoji}</span>
                ) : (
                  <Smile className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </EmojiPicker>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('placeholder')}
              className="flex-1"
              maxLength={80}
              data-testid="status-text-input"
            />
          </div>

          {/* Auto-clear selector */}
          <div className="flex flex-col gap-1">
            <label className="text-caption text-muted-foreground">
              {t('clearAfter')}
            </label>
            <Select
              value={autoClear}
              onValueChange={(val) => setAutoClear(val as AutoClearOption)}
            >
              <SelectTrigger
                className="w-full"
                data-testid="auto-clear-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('clearNone')}</SelectItem>
                <SelectItem value="1h">{t('clear1h')}</SelectItem>
                <SelectItem value="4h">{t('clear4h')}</SelectItem>
                <SelectItem value="today">{t('clearToday')}</SelectItem>
                <SelectItem value="this_week">{t('clearThisWeek')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={saving || (!initialEmoji && !initialText)}
              data-testid="status-clear-button"
            >
              <X className="h-4 w-4 mr-1" />
              {t('clear')}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || (!emoji && !text)}
              data-testid="status-save-button"
            >
              {t('save')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
