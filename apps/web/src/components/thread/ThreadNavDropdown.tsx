'use client';

/**
 * ThreadNavDropdown — hierarchical tree dropdown for self-referential
 * record navigation within thread context.
 *
 * Layout: parent record (top) → current record (highlighted) + siblings → children.
 * Each entry shows: record title + unread indicator (teal dot + count).
 *
 * @see docs/reference/communications.md § Chat Navigation
 */

import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadNavNode {
  recordId: string;
  title: string;
  unreadCount: number;
  children?: ThreadNavNode[];
}

interface ThreadNavDropdownProps {
  /** Parent record (top of tree) */
  parent?: ThreadNavNode | null;
  /** Current record (highlighted) */
  current: ThreadNavNode;
  /** Sibling records (same level as current) */
  siblings: ThreadNavNode[];
  /** Whether this table has self-referential linked record fields */
  hasHierarchy: boolean;
  /** Navigate to a record's thread */
  onNavigate: (recordId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ThreadNavDropdown({
  parent,
  current,
  siblings,
  hasHierarchy,
  onNavigate,
}: ThreadNavDropdownProps) {
  const t = useTranslations('thread.nav');

  if (!hasHierarchy) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          data-testid="thread-nav-trigger"
        >
          <span className="truncate max-w-[120px]">{current.title}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 max-h-80 overflow-y-auto"
        data-testid="thread-nav-dropdown"
      >
        {/* Parent record */}
        {parent && (
          <div className="px-1 py-0.5">
            <NavItem
              node={parent}
              isCurrent={false}
              depth={0}
              onNavigate={onNavigate}
            />
          </div>
        )}

        {/* Current + siblings */}
        <div className="px-1 py-0.5">
          {siblings.map((sibling) => (
            <NavItem
              key={sibling.recordId}
              node={sibling}
              isCurrent={sibling.recordId === current.recordId}
              depth={parent ? 1 : 0}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {/* Children of current */}
        {current.children && current.children.length > 0 && (
          <div className="px-1 py-0.5 border-t">
            {current.children.map((child) => (
              <NavItem
                key={child.recordId}
                node={child}
                isCurrent={false}
                depth={parent ? 2 : 1}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {siblings.length === 0 &&
          !parent &&
          (!current.children || current.children.length === 0) && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t('noRelated')}
            </div>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// NavItem
// ---------------------------------------------------------------------------

function NavItem({
  node,
  isCurrent,
  depth,
  onNavigate,
}: {
  node: ThreadNavNode;
  isCurrent: boolean;
  depth: number;
  onNavigate: (recordId: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left',
        'hover:bg-muted/50 transition-colors',
        isCurrent && 'bg-muted font-medium',
      )}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      onClick={() => onNavigate(node.recordId)}
      data-testid="thread-nav-item"
      data-record-id={node.recordId}
      aria-current={isCurrent ? 'true' : undefined}
    >
      {depth > 0 && (
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
      <span className="truncate flex-1">{node.title}</span>
      {node.unreadCount > 0 && (
        <span
          className="flex items-center gap-1 shrink-0"
          data-testid="unread-indicator"
        >
          <span className="h-2 w-2 rounded-full bg-teal-500" />
          <span className="text-[10px] text-teal-600 font-medium">
            {node.unreadCount}
          </span>
        </span>
      )}
    </button>
  );
}
