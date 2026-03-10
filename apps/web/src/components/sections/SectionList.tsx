'use client';

/**
 * SectionList — generic component that renders items organized into sections.
 *
 * Accepts any item type via generics and a render function.
 * Supports drag-and-drop for reordering sections and moving items between sections.
 * Unsectioned items render at the top, before any sections.
 *
 * @see docs/reference/tables-and-views.md § Sections — Universal List Organizer
 */

import { memo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Section } from '@everystack/shared/db';
import { SectionHeader } from './SectionHeader';
import { useSections } from './use-sections';
import type { SectionableItem } from './use-sections';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionListProps<T extends SectionableItem> {
  /** All items to render (with optional sectionId) */
  items: T[];
  /** Sections for this context */
  sections: Section[];
  /** Render function for a single item */
  renderItem: (item: T) => React.ReactNode;
  /** Storage key prefix for collapse state persistence */
  storageKey: string;
  /** Callback when a section is renamed */
  onRenameSection?: (sectionId: string, newName: string) => void;
  /** Callback when a section is deleted */
  onDeleteSection?: (sectionId: string) => void;
  /** Callback when an item is moved to a section (or null for top level) */
  onMoveItem?: (itemId: string, sectionId: string | null) => void;
  /** Callback when sections are reordered */
  onReorderSections?: (sectionIds: string[]) => void;
  /** Empty state component for when there are no items at all */
  emptyState?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SectionListInner<T extends SectionableItem>({
  items,
  sections,
  renderItem,
  storageKey,
  onRenameSection,
  onDeleteSection,
  onMoveItem,
  onReorderSections,
  emptyState,
}: SectionListProps<T>) {
  const t = useTranslations('sections');
  const { groups, isCollapsed, toggleCollapsed } = useSections({
    sections,
    items,
    storageKey,
  });

  const handleDragStart = useCallback(
    (e: React.DragEvent, itemId: string) => {
      e.dataTransfer.setData('text/plain', itemId);
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, sectionId: string | null) => {
      e.preventDefault();
      const itemId = e.dataTransfer.getData('text/plain');
      if (itemId && onMoveItem) {
        onMoveItem(itemId, sectionId);
      }
    },
    [onMoveItem],
  );

  const handleSectionDragStart = useCallback(
    (e: React.DragEvent, sectionId: string) => {
      e.dataTransfer.setData('application/x-section-id', sectionId);
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleSectionDrop = useCallback(
    (e: React.DragEvent, targetSectionId: string) => {
      e.preventDefault();
      const draggedSectionId = e.dataTransfer.getData('application/x-section-id');
      if (!draggedSectionId || draggedSectionId === targetSectionId || !onReorderSections) return;

      const currentOrder = sections.map((s) => s.id);
      const fromIdx = currentOrder.indexOf(draggedSectionId);
      const toIdx = currentOrder.indexOf(targetSectionId);
      if (fromIdx === -1 || toIdx === -1) return;

      const newOrder = [...currentOrder];
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedSectionId);
      onReorderSections(newOrder);
    },
    [sections, onReorderSections],
  );

  if (items.length === 0 && sections.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="flex flex-col" role="list">
      {groups.map((group) => {
        if (!group.section) {
          // Unsectioned items at the top
          return (
            <div
              key="unsectioned"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null)}
              role="group"
            >
              {group.items.map((item) => (
                <div
                  key={item.id}
                  draggable={!!onMoveItem}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                >
                  {renderItem(item)}
                </div>
              ))}
            </div>
          );
        }

        const collapsed = isCollapsed(group.section.id);
        const isPersonal = group.section.userId !== null;

        return (
          <div
            key={group.section.id}
            draggable={!!onReorderSections}
            onDragStart={(e) => handleSectionDragStart(e, group.section!.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              // Check if it's a section being dropped
              if (e.dataTransfer.types.includes('application/x-section-id')) {
                handleSectionDrop(e, group.section!.id);
              } else {
                handleDrop(e, group.section!.id);
              }
            }}
            role="group"
            aria-label={group.section.name}
          >
            <SectionHeader
              id={group.section.id}
              name={group.section.name}
              itemCount={group.items.length}
              isCollapsed={collapsed}
              isPersonal={isPersonal}
              onToggleCollapse={() => toggleCollapsed(group.section!.id)}
              onRename={(newName) => onRenameSection?.(group.section!.id, newName)}
              onDelete={() => onDeleteSection?.(group.section!.id)}
            />
            {!collapsed && (
              <div>
                {group.items.length > 0 ? (
                  group.items.map((item) => (
                    <div
                      key={item.id}
                      draggable={!!onMoveItem}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                    >
                      {renderItem(item)}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-xs text-muted-foreground italic">
                    {t('empty_section')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const SectionList = memo(SectionListInner) as typeof SectionListInner;
