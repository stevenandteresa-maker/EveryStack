'use client';

/**
 * MergeTagInserter — sidebar for inserting merge-tag fields into the editor.
 *
 * Displays available fields grouped by table (source first, then linked tables).
 * Search filters across all groups. Click inserts a MergeTag node at cursor.
 *
 * @see docs/reference/smart-docs.md § Template Authoring Mode
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Link2, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import type { Editor } from '@tiptap/core';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import type { MergeTagFieldGroup } from '../hooks/use-merge-tag-fields';
import type { MergeTagField } from '@/lib/types/document-templates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MergeTagInserterProps {
  /** TipTap editor instance */
  editor: Editor;
  /** Field groups from useMergeTagFields */
  groups: MergeTagFieldGroup[];
  /** Whether data is loading */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Field type → icon mapping (subset for sidebar display)
// ---------------------------------------------------------------------------

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Aa',
  textarea: '¶',
  number: '#',
  currency: '$',
  percent: '%',
  date: '📅',
  datetime: '📅',
  checkbox: '☑',
  single_select: '◉',
  multiple_select: '◎',
  email: '@',
  url: '🔗',
  phone: '📞',
  rating: '★',
  people: '👤',
  status: '●',
  tag: '🏷',
};

function getFieldTypeIndicator(fieldType: string): string {
  return FIELD_TYPE_LABELS[fieldType] ?? '·';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MergeTagInserter({ editor, groups, isLoading }: MergeTagInserterProps) {
  const t = useTranslations('smartDocEditor.mergeTagInserter');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filter groups/fields by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;

    const query = searchQuery.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        fields: group.fields.filter(
          (f) =>
            f.fieldName.toLowerCase().includes(query) ||
            f.fieldType.toLowerCase().includes(query),
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [groups, searchQuery]);

  const toggleGroup = (tableId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const insertMergeTag = (field: MergeTagField) => {
    editor
      .chain()
      .focus()
      .insertMergeTag({
        tableId: field.tableId,
        fieldId: field.fieldId,
        fallback: field.fieldName,
      })
      .run();
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-full" />
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <h3 className="text-[13px] font-semibold text-foreground leading-[18px]">
        {t('title')}
      </h3>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-8 pl-7 text-[13px]"
        />
      </div>

      {/* Field groups */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        {filteredGroups.length === 0 ? (
          <p className="text-[12px] text-muted-foreground py-4 text-center">
            {t('noFields')}
          </p>
        ) : (
          <div className="space-y-1">
            {filteredGroups.map((group) => {
              const isCollapsed = collapsedGroups.has(group.tableId);
              const Icon = group.isLinked ? Link2 : FileText;
              const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

              return (
                <div key={`${group.tableId}-${group.crossLinkId ?? ''}`}>
                  {/* Group header */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.tableId)}
                    className="
                      flex items-center gap-1.5 w-full py-1.5 px-1
                      text-[12px] font-medium text-muted-foreground
                      hover:text-foreground transition-colors rounded
                    "
                  >
                    <ChevronIcon className="h-3 w-3 shrink-0" />
                    <Icon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{group.tableName}</span>
                    <span className="text-[11px] text-muted-foreground/60 ml-auto">
                      {group.fields.length}
                    </span>
                  </button>

                  {/* Fields */}
                  {!isCollapsed && (
                    <div className="ml-2">
                      {group.fields.map((field) => (
                        <button
                          key={field.fieldId}
                          type="button"
                          onClick={() => insertMergeTag(field)}
                          className="
                            flex items-center gap-2 w-full py-1 px-2
                            text-[13px] text-foreground leading-[18px]
                            hover:bg-teal-50 rounded transition-colors
                            group
                          "
                          title={`${field.fieldName} (${field.fieldType})`}
                        >
                          <span className="w-4 text-center text-[11px] text-muted-foreground shrink-0">
                            {getFieldTypeIndicator(field.fieldType)}
                          </span>
                          <span className="truncate">{field.fieldName}</span>
                          <span
                            className="
                              ml-auto text-[11px] text-teal-600 opacity-0
                              group-hover:opacity-100 transition-opacity shrink-0
                            "
                          >
                            {t('insert')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
