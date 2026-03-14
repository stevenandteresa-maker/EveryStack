'use client';

/**
 * CommandBarRecentItems — shows recently accessed entities when
 * the Command Bar opens with an empty input.
 *
 * - Fetches from getRecentItems() (Unit 3 data layer)
 * - Displays up to 10 most recent items
 * - Each item: icon (by item_type), display name, entity context
 * - Keyboard navigation via cmdk (arrow keys + Enter)
 *
 * @see docs/reference/command-bar.md § Recent Items
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Table2, Layout, Clock } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import type { RecentItem } from '@/lib/command-bar/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandBarRecentItemsProps {
  tenantId: string;
  userId: string;
  getRecentItemsFn?: (
    userId: string,
    tenantId: string,
    limit?: number,
  ) => Promise<RecentItem[]>;
  onSelect?: (item: RecentItem) => void;
}

// ---------------------------------------------------------------------------
// Icon mapping by item type
// ---------------------------------------------------------------------------

const ITEM_TYPE_ICONS: Record<string, typeof FileText> = {
  record: FileText,
  table: Table2,
  view: Layout,
};

const RECENT_ITEMS_LIMIT = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandBarRecentItems({
  tenantId,
  userId,
  getRecentItemsFn,
  onSelect,
}: CommandBarRecentItemsProps) {
  const t = useTranslations('commandBar');

  const [items, setItems] = useState<RecentItem[]>([]);

  // Fetch recent items on mount
  useEffect(() => {
    if (!getRecentItemsFn || !userId || !tenantId) return;

    let cancelled = false;

    const fetchRecents = async () => {
      try {
        const result = await getRecentItemsFn(userId, tenantId, RECENT_ITEMS_LIMIT);
        if (!cancelled) {
          setItems(result);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      }
    };

    fetchRecents();

    return () => {
      cancelled = true;
    };
  }, [getRecentItemsFn, userId, tenantId]);

  // Handle item selection — delegates navigation to parent via onSelect
  const handleSelect = (item: RecentItem) => {
    onSelect?.(item);
  };

  // No recent items
  if (items.length === 0) {
    return null;
  }

  return (
    <CommandGroup
      heading={t('recentHeading')}
      data-testid="recent-items-group"
    >
      {items.map((item) => {
        const Icon = ITEM_TYPE_ICONS[item.item_type] ?? Clock;
        return (
          <CommandItem
            key={`${item.item_type}-${item.item_id}`}
            value={`recent-${item.item_type}-${item.item_id}`}
            onSelect={() => handleSelect(item)}
            data-testid={`recent-item-${item.item_type}-${item.item_id}`}
          >
            <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate">{item.display_name}</span>
            {item.entity_context && (
              <span className="ml-2 text-xs text-muted-foreground">
                {item.entity_context}
              </span>
            )}
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

// ---------------------------------------------------------------------------
// Utility: filter recent items by search query (for boosting)
// ---------------------------------------------------------------------------

export function filterRecentItemsByQuery(
  recentItems: RecentItem[],
  query: string,
): RecentItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];
  return recentItems.filter((item) =>
    item.display_name.toLowerCase().includes(trimmed),
  );
}
