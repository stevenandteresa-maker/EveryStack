'use client';

/**
 * RecordViewTabs — tab bar for multi-tab Record View configs.
 *
 * Renders when a Record View config has tabs. Users can switch tabs,
 * add new tabs, rename or delete existing ones.
 *
 * @see docs/reference/tables-and-views.md § Tabs
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { RecordViewTab } from '@/data/record-view-configs';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_TAB_ID = '__default__';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecordViewTabsProps {
  tabs: RecordViewTab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: (name: string) => void;
  onRenameTab: (tabId: string, name: string) => void;
  onDeleteTab: (tabId: string) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecordViewTabs({
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  readOnly = false,
}: RecordViewTabsProps) {
  const t = useTranslations('record_view');
  const [isAdding, setIsAdding] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleAddSubmit = useCallback(() => {
    const trimmed = newTabName.trim();
    if (trimmed) {
      onAddTab(trimmed);
    }
    setNewTabName('');
    setIsAdding(false);
  }, [newTabName, onAddTab]);

  const handleAddKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsAdding(false);
        setNewTabName('');
      }
    },
    [handleAddSubmit],
  );

  const handleRenameStart = useCallback(
    (tabId: string, currentName: string) => {
      setRenamingTabId(tabId);
      setRenameValue(currentName);
    },
    [],
  );

  const handleRenameSubmit = useCallback(() => {
    if (renamingTabId && renameValue.trim()) {
      onRenameTab(renamingTabId, renameValue.trim());
    }
    setRenamingTabId(null);
    setRenameValue('');
  }, [renamingTabId, renameValue, onRenameTab]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRenameSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setRenamingTabId(null);
        setRenameValue('');
      }
    },
    [handleRenameSubmit],
  );

  return (
    <div className="flex items-center gap-1 border-b px-4 py-1">
      <Tabs
        value={activeTabId}
        onValueChange={onTabChange}
        className="flex-1"
      >
        <TabsList className="h-8 bg-transparent p-0 gap-0">
          {/* Default tab (always present) */}
          <TabsTrigger
            value={DEFAULT_TAB_ID}
            className="h-7 rounded-sm px-3 text-xs data-[state=active]:bg-muted"
          >
            {t('tab_default')}
          </TabsTrigger>

          {/* Custom tabs */}
          {tabs.map((tab) => (
            <div key={tab.id} className="relative flex items-center group">
              {renamingTabId === tab.id ? (
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={handleRenameKeyDown}
                  className="h-7 w-24 text-xs px-2"
                  autoFocus
                  aria-label={t('tab_rename_input')}
                />
              ) : (
                <>
                  <TabsTrigger
                    value={tab.id}
                    className="h-7 rounded-sm px-3 text-xs data-[state=active]:bg-muted"
                  >
                    {tab.name}
                  </TabsTrigger>
                  {!readOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="ml-0.5 opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center rounded-sm hover:bg-muted-foreground/20"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={t('tab_options', { name: tab.name })}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-36">
                        <DropdownMenuItem
                          onClick={() =>
                            handleRenameStart(tab.id, tab.name)
                          }
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          {t('tab_rename')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onDeleteTab(tab.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          {t('tab_delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          ))}
        </TabsList>
      </Tabs>

      {/* Add tab */}
      {!readOnly && (
        <>
          {isAdding ? (
            <Input
              value={newTabName}
              onChange={(e) => setNewTabName(e.target.value)}
              onBlur={handleAddSubmit}
              onKeyDown={handleAddKeyDown}
              placeholder={t('tab_name_placeholder')}
              className="h-7 w-24 text-xs px-2"
              autoFocus
              aria-label={t('tab_new_name')}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsAdding(true)}
              aria-label={t('tab_add')}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export { DEFAULT_TAB_ID };
