'use client';

/**
 * useSections — client-side state management for sections.
 *
 * Manages collapse state persistence (localStorage) and provides
 * section-aware item grouping.
 *
 * @see docs/reference/tables-and-views.md § Sections — Universal List Organizer
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { Section } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionableItem {
  id: string;
  sectionId?: string | null;
}

export interface SectionGroup<T extends SectionableItem> {
  section: Section | null;
  items: T[];
}

interface UseSectionsOptions<T extends SectionableItem> {
  sections: Section[];
  items: T[];
  /** Storage key prefix for collapse state persistence */
  storageKey: string;
}

interface UseSectionsReturn<T extends SectionableItem> {
  /** Items grouped by section. First group has section=null (unsectioned). */
  groups: SectionGroup<T>[];
  /** Whether a section is collapsed */
  isCollapsed: (sectionId: string) => boolean;
  /** Toggle collapse state for a section */
  toggleCollapsed: (sectionId: string) => void;
  /** Set collapse state for a section */
  setCollapsed: (sectionId: string, collapsed: boolean) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'es_section_collapse_';

export function useSections<T extends SectionableItem>({
  sections,
  items,
  storageKey,
}: UseSectionsOptions<T>): UseSectionsReturn<T> {
  const fullKey = `${STORAGE_PREFIX}${storageKey}`;

  // Initialize collapse state from localStorage
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(fullKey);
      return stored ? (JSON.parse(stored) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });

  // Persist collapse state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(fullKey, JSON.stringify(collapsedMap));
    } catch {
      // localStorage unavailable — silent fail
    }
  }, [collapsedMap, fullKey]);

  const isCollapsed = useCallback(
    (sectionId: string): boolean => {
      const stored = collapsedMap[sectionId];
      if (stored !== undefined) return stored;
      // Fall back to section's default collapsed state
      const section = sections.find((s) => s.id === sectionId);
      return section?.collapsed ?? false;
    },
    [collapsedMap, sections],
  );

  const toggleCollapsed = useCallback(
    (sectionId: string) => {
      setCollapsedMap((prev) => ({
        ...prev,
        [sectionId]: !isCollapsed(sectionId),
      }));
    },
    [isCollapsed],
  );

  const setCollapsed = useCallback(
    (sectionId: string, collapsed: boolean) => {
      setCollapsedMap((prev) => ({ ...prev, [sectionId]: collapsed }));
    },
    [],
  );

  // Group items by section
  const groups = useMemo((): SectionGroup<T>[] => {
    const sectionMap = new Map<string, T[]>();
    const unsectioned: T[] = [];

    for (const item of items) {
      if (item.sectionId) {
        const existing = sectionMap.get(item.sectionId);
        if (existing) {
          existing.push(item);
        } else {
          sectionMap.set(item.sectionId, [item]);
        }
      } else {
        unsectioned.push(item);
      }
    }

    const result: SectionGroup<T>[] = [];

    // Unsectioned items first
    if (unsectioned.length > 0) {
      result.push({ section: null, items: unsectioned });
    }

    // Sections in sort order (already sorted from server)
    for (const section of sections) {
      result.push({
        section,
        items: sectionMap.get(section.id) ?? [],
      });
    }

    return result;
  }, [items, sections]);

  return { groups, isCollapsed, toggleCollapsed, setCollapsed };
}
