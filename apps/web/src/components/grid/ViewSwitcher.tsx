'use client';

/**
 * ViewSwitcher — dropdown in the grid toolbar showing Shared Views and My Views.
 *
 * Replaces the disabled placeholder from Prompt 6.
 *
 * @see docs/reference/tables-and-views.md § My Views & Shared Views
 */

import { memo, useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Grid3X3,
  LayoutGrid,
  Lock,
  ChevronDown,
  Plus,
  Pencil,
  Copy,
  Trash2,
  ArrowUpRight,
  LockOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import type { View } from '@everystack/shared/db';
import type { EffectiveRole } from '@everystack/shared/auth';
import { roleAtLeast } from '@everystack/shared/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewSwitcherProps {
  currentView: View | null;
  sharedViews: View[];
  myViews: View[];
  userRole: EffectiveRole;
  userId: string;
  onSwitchView: (viewId: string) => void;
  onCreateView: () => void;
  onRenameView: (viewId: string) => void;
  onDuplicateView: (viewId: string) => void;
  onDeleteView: (viewId: string) => void;
  onPromoteView: (viewId: string) => void;
  onLockView: (viewId: string, locked: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ViewTypeIcon({ viewType }: { viewType: string }) {
  if (viewType === 'card') {
    return <LayoutGrid className="h-3.5 w-3.5 shrink-0" />;
  }
  return <Grid3X3 className="h-3.5 w-3.5 shrink-0" />;
}

function isViewLocked(view: View): boolean {
  return (view.config as Record<string, unknown>)?.locked === true;
}

function isDefaultView(view: View): boolean {
  return (view.config as Record<string, unknown>)?.isDefault === true;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ViewSwitcher = memo(function ViewSwitcher({
  currentView,
  sharedViews,
  myViews,
  userRole,
  userId,
  onSwitchView,
  onCreateView,
  onRenameView,
  onDuplicateView,
  onDeleteView,
  onPromoteView,
  onLockView,
}: ViewSwitcherProps) {
  const t = useTranslations('grid.views');
  const [contextViewId, setContextViewId] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);

  const isManagerPlus = roleAtLeast(userRole, 'manager');

  const contextView = contextViewId
    ? [...sharedViews, ...myViews].find((v) => v.id === contextViewId) ?? null
    : null;

  const handleContextAction = useCallback(
    (action: string) => {
      if (!contextViewId) return;
      setContextMenuOpen(false);

      switch (action) {
        case 'rename':
          onRenameView(contextViewId);
          break;
        case 'duplicate':
          onDuplicateView(contextViewId);
          break;
        case 'delete':
          onDeleteView(contextViewId);
          break;
        case 'promote':
          onPromoteView(contextViewId);
          break;
        case 'lock':
          if (contextView) onLockView(contextViewId, !isViewLocked(contextView));
          break;
        default:
          break;
      }
    },
    [contextViewId, contextView, onRenameView, onDuplicateView, onDeleteView, onPromoteView, onLockView],
  );

  return (
    <div className="flex items-center">
      {/* Main view switcher dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs font-medium">
            {currentView && <ViewTypeIcon viewType={currentView.viewType} />}
            {currentView?.name ?? t('all_records')}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {/* Shared Views section */}
          {sharedViews.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t('shared_views')}
              </DropdownMenuLabel>
              {sharedViews.map((view) => (
                <ViewMenuItem
                  key={view.id}
                  view={view}
                  isActive={currentView?.id === view.id}
                  onSelect={() => onSwitchView(view.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextViewId(view.id);
                    setContextMenuOpen(true);
                  }}
                />
              ))}
            </>
          )}

          {/* Divider between sections */}
          {sharedViews.length > 0 && myViews.length > 0 && (
            <DropdownMenuSeparator />
          )}

          {/* My Views section */}
          {myViews.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t('my_views')}
              </DropdownMenuLabel>
              {myViews.map((view) => (
                <ViewMenuItem
                  key={view.id}
                  view={view}
                  isActive={currentView?.id === view.id}
                  onSelect={() => onSwitchView(view.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextViewId(view.id);
                    setContextMenuOpen(true);
                  }}
                />
              ))}
            </>
          )}

          {/* Empty state */}
          {sharedViews.length === 0 && myViews.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              {t('no_views')}
            </div>
          )}

          <DropdownMenuSeparator />

          {/* Create view button */}
          <DropdownMenuItem onClick={onCreateView} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            {t('create_view')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Context menu (right-click on a view item) */}
      <DropdownMenu open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <DropdownMenuTrigger className="sr-only" />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => handleContextAction('rename')}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            {t('rename')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleContextAction('duplicate')}>
            <Copy className="mr-2 h-3.5 w-3.5" />
            {t('duplicate')}
          </DropdownMenuItem>

          {/* Promote to Shared — only for My Views and Manager+ */}
          {contextView && !contextView.isShared && isManagerPlus && (
            <DropdownMenuItem onClick={() => handleContextAction('promote')}>
              <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
              {t('promote_to_shared')}
            </DropdownMenuItem>
          )}

          {/* Lock/Unlock — only for Shared Views, Manager+, and creator */}
          {contextView && contextView.isShared && isManagerPlus && contextView.createdBy === userId && (
            <DropdownMenuItem onClick={() => handleContextAction('lock')}>
              {isViewLocked(contextView) ? (
                <>
                  <LockOpen className="mr-2 h-3.5 w-3.5" />
                  {t('unlock')}
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-3.5 w-3.5" />
                  {t('lock')}
                </>
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Delete — cannot delete default view */}
          <DropdownMenuItem
            onClick={() => handleContextAction('delete')}
            disabled={contextView ? isDefaultView(contextView) : false}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            {t('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});

// ---------------------------------------------------------------------------
// ViewMenuItem — a single view entry in the dropdown
// ---------------------------------------------------------------------------

interface ViewMenuItemProps {
  view: View;
  isActive: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const ViewMenuItem = memo(function ViewMenuItem({
  view,
  isActive,
  onSelect,
  onContextMenu,
}: ViewMenuItemProps) {
  return (
    <DropdownMenuItem
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className="gap-2"
      data-active={isActive || undefined}
    >
      <ViewTypeIcon viewType={view.viewType} />
      <span className={`flex-1 truncate ${isActive ? 'font-medium' : ''}`}>
        {view.name}
      </span>
      {isViewLocked(view) && (
        <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
    </DropdownMenuItem>
  );
});
