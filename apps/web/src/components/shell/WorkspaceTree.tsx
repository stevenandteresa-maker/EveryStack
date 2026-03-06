'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoardNavGroup, WorkspaceNavEntry } from '@/data/sidebar-navigation';

interface WorkspaceTreeProps {
  boards: BoardNavGroup[];
  workspaces: WorkspaceNavEntry[];
  activeWorkspaceId?: string;
}

export function WorkspaceTree({ boards, workspaces, activeWorkspaceId }: WorkspaceTreeProps) {
  return (
    <div className="flex flex-col gap-0.5">
      {boards.map((board) => (
        <BoardGroup
          key={board.boardId}
          board={board}
          activeWorkspaceId={activeWorkspaceId}
        />
      ))}
      {workspaces.map((ws) => (
        <WorkspaceItem
          key={ws.workspaceId}
          workspace={ws}
          isActive={ws.workspaceId === activeWorkspaceId}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board Group (collapsible)
// ---------------------------------------------------------------------------

function BoardGroup({
  board,
  activeWorkspaceId,
}: {
  board: BoardNavGroup;
  activeWorkspaceId?: string;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        data-testid={`board-group-${board.boardId}`}
        className={cn(
          'flex items-center gap-1.5 w-full px-2 py-1 rounded',
          'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]',
          'transition-colors duration-150',
          'text-caption font-semibold uppercase tracking-wider',
        )}
      >
        {expanded ? (
          <ChevronDown size={14} className="shrink-0" />
        ) : (
          <ChevronRight size={14} className="shrink-0" />
        )}
        <span className="truncate">{board.boardName}</span>
      </button>
      {expanded && (
        <div className="pl-3">
          {board.workspaces.map((ws) => (
            <WorkspaceItem
              key={ws.workspaceId}
              workspace={ws}
              isActive={ws.workspaceId === activeWorkspaceId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace Item
// ---------------------------------------------------------------------------

function WorkspaceItem({
  workspace,
  isActive,
}: {
  workspace: WorkspaceNavEntry;
  isActive: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={`workspace-item-${workspace.workspaceId}`}
      className={cn(
        'flex items-center gap-2 w-full px-2 py-1.5 rounded relative',
        'text-body-sm transition-colors duration-150',
        isActive
          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-semibold'
          : 'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-white" />
      )}
      <Layers size={16} className="shrink-0" />
      <span className="truncate">{workspace.workspaceName}</span>
    </button>
  );
}
