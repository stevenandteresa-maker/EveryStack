'use client';

/**
 * SectionHeader — collapsible section divider with name, item count,
 * and context menu for rename/delete.
 *
 * @see docs/reference/tables-and-views.md § Sections — Universal List Organizer
 */

import { memo, useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronRight, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionHeaderProps {
  id: string;
  name: string;
  itemCount: number;
  isCollapsed: boolean;
  /** Whether this is a personal section (for future styling differentiation) */
  isPersonal?: boolean;
  onToggleCollapse: () => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SectionHeader = memo(function SectionHeader({
  id,
  name,
  itemCount,
  isCollapsed,
  isPersonal: _isPersonal,
  onToggleCollapse,
  onRename,
  onDelete,
}: SectionHeaderProps) {
  const t = useTranslations('sections');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(name);
  const [contextOpen, setContextOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartRename = useCallback(() => {
    setRenameValue(name);
    setIsRenaming(true);
    setContextOpen(false);
    // Focus input after render
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [name]);

  const handleConfirmRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  }, [renameValue, name, onRename]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsRenaming(false);
      }
    },
    [handleConfirmRename],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setContextOpen(true);
    },
    [],
  );

  const handleDelete = useCallback(() => {
    setContextOpen(false);
    onDelete();
  }, [onDelete]);

  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div
      className="group flex items-center gap-1.5 py-1.5 px-2 select-none"
      data-section-id={id}
      onContextMenu={handleContextMenu}
    >
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
        aria-expanded={!isCollapsed}
        aria-label={isCollapsed ? t('expand_section') : t('collapse_section')}
      >
        <ChevronIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {/* Section name or rename input */}
      {isRenaming ? (
        <Input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleConfirmRename}
          onKeyDown={handleRenameKeyDown}
          className="h-6 px-1 py-0 text-xs font-medium"
          maxLength={255}
        />
      ) : (
        <button
          type="button"
          className="flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          onClick={onToggleCollapse}
          onDoubleClick={handleStartRename}
        >
          {name}
        </button>
      )}

      {/* Item count (shown when collapsed) */}
      {isCollapsed && !isRenaming && (
        <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
          {itemCount}
        </span>
      )}

      {/* Context menu (right-click) */}
      <DropdownMenu open={contextOpen} onOpenChange={setContextOpen}>
        <DropdownMenuTrigger className="sr-only" />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={handleStartRename}>
            {t('rename')}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-red-600 focus:text-red-600"
          >
            {t('delete_section')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
