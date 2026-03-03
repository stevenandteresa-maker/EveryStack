'use client';

import { Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  return (
    <header
      data-testid="header"
      className="flex items-center justify-between px-4 shrink-0"
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--accent)',
      }}
    >
      {/* Left: Breadcrumb placeholder */}
      <div className="hidden tablet:flex items-center gap-2 text-white/80 text-body-sm min-w-0">
        <span className="truncate">Workspace</span>
        <span className="text-white/50">/</span>
        <span className="truncate text-white">Page</span>
      </div>

      {/* Mobile: Page title */}
      <div className="tablet:hidden text-white font-semibold text-body truncate">
        Page
      </div>

      {/* Center: Command Bar compact placeholder */}
      <div
        data-testid="command-bar-placeholder"
        className={cn(
          'hidden tablet:flex items-center gap-2',
          'bg-white rounded-lg px-3',
          'text-[var(--text-tertiary)] text-body-sm',
          'cursor-default select-none',
        )}
        style={{ width: 300, height: 36 }}
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 truncate">Search...</span>
        <kbd className="text-caption bg-[var(--panel-bg)] rounded px-1.5 py-0.5 font-mono">
          ⌘K
        </kbd>
      </div>

      {/* Mobile: Search icon */}
      <button
        type="button"
        className="tablet:hidden touch-target flex items-center justify-center text-white"
        aria-label="Search"
      >
        <Search size={20} />
      </button>

      {/* Right: Avatar placeholder */}
      <div className="hidden tablet:flex items-center">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
      </div>
    </header>
  );
}
