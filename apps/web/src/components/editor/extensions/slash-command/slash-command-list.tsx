'use client';

import {
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListChecks,
  TextQuote,
  Code2,
  Table,
  ImageIcon,
  AlertCircle,
  Minus,
} from 'lucide-react';
import type { SlashCommandItem } from './commands';

/** Map of icon name → Lucide component */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  ListChecks,
  TextQuote,
  Code2,
  Table,
  ImageIcon,
  AlertCircle,
  Minus,
};

export interface SlashCommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandListProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

/**
 * SlashCommandList — popup menu for the "/" slash command.
 *
 * Renders a filterable list of block insertion commands.
 * Keyboard navigation: ArrowUp/Down to select, Enter to execute, Escape to close.
 */
export const SlashCommandList = forwardRef<SlashCommandListRef, SlashCommandListProps>(
  function SlashCommandList({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Clamp selection when items shrink (e.g. during filtering)
    const clampedIndex = items.length > 0
      ? Math.min(selectedIndex, items.length - 1)
      : 0;

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(clampedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-white p-3 shadow-lg">
          <p className="text-[13px] leading-[18px] text-muted-foreground">
            No matching commands
          </p>
        </div>
      );
    }

    return (
      <div className="max-h-[320px] w-[240px] overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-lg">
        {items.map((item, index) => {
          const Icon = ICON_MAP[item.icon];

          return (
            <button
              key={item.id}
              type="button"
              className={`
                flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors
                ${index === clampedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}
              `}
              onClick={() => selectItem(index)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {Icon && (
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-[18px] truncate">
                  {item.label}
                </p>
                {item.description && (
                  <p className="text-[11px] leading-[14px] text-muted-foreground truncate">
                    {item.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  },
);
