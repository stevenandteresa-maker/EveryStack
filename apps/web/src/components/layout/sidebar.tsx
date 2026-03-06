'use client';

import {
  Building2,
  CheckSquare,
  MessageSquare,
  CalendarDays,
  PanelLeftClose,
  PanelLeftOpen,
  HelpCircle,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';
import { SidebarHeader } from '@/components/shell/SidebarHeader';
import { TenantSwitcher } from '@/components/shell/TenantSwitcher';
import { PortalSection } from '@/components/shell/PortalSection';
import type { SidebarNavigation } from '@/data/sidebar-navigation';

// ---------------------------------------------------------------------------
// Icon Rail Items
// ---------------------------------------------------------------------------

const ICON_RAIL_TOP = [
  { icon: Building2, labelKey: 'home' },
  { icon: CheckSquare, labelKey: 'tasks' },
  { icon: MessageSquare, labelKey: 'chat' },
  { icon: CalendarDays, labelKey: 'calendar' },
] as const;

// ---------------------------------------------------------------------------
// Sidebar Props
// ---------------------------------------------------------------------------

interface SidebarProps {
  navData?: SidebarNavigation | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar({ navData }: SidebarProps) {
  const { collapsed, toggle } = useSidebarStore();
  const t = useTranslations('shell.sidebar');

  const activeTenant = navData?.tenants.find((tenant) => tenant.isActive) ?? null;

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'hidden tablet:flex flex-col shrink-0 transition-[width] duration-200 ease-in-out',
        'bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]',
      )}
      style={{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)' }}
    >
      {/* Sidebar Header — always visible at top (Signal 1: Contextual Clarity) */}
      <SidebarHeader activeTenant={activeTenant} collapsed={collapsed} />

      {/* Icon Rail + Content Zone */}
      <div className="flex flex-1 min-h-0">
      {/* Icon Rail — always visible, 48px wide */}
      <nav
        data-testid="icon-rail"
        className="flex flex-col w-12 shrink-0 items-center pt-2 pb-2"
      >
        {/* Top icons */}
        <div className="flex flex-col gap-1">
          {ICON_RAIL_TOP.map(({ icon: Icon, labelKey }) => (
            <button
              key={labelKey}
              type="button"
              className={cn(
                'touch-target-lg flex items-center justify-center rounded',
                'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
                'transition-colors duration-150',
              )}
              aria-label={t(labelKey)}
            >
              <Icon size={20} className="shrink-0" />
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom icons */}
        <div className="flex flex-col gap-1">
          {/* Toggle */}
          <button
            type="button"
            onClick={toggle}
            data-testid="sidebar-toggle"
            className={cn(
              'touch-target-lg flex items-center justify-center rounded',
              'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]',
              'transition-colors duration-150',
            )}
            aria-label={collapsed ? t('expand') : t('collapse')}
          >
            {collapsed ? (
              <PanelLeftOpen size={20} className="shrink-0" />
            ) : (
              <PanelLeftClose size={20} className="shrink-0" />
            )}
          </button>

          {/* Help */}
          <button
            type="button"
            className={cn(
              'touch-target-lg flex items-center justify-center rounded',
              'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]',
              'transition-colors duration-150',
            )}
            aria-label={t('help')}
          >
            <HelpCircle size={20} className="shrink-0" />
          </button>

          {/* Avatar */}
          <div className="flex items-center justify-center py-1">
            <div className="w-8 h-8 rounded-full bg-[var(--sidebar-bg-hover)] flex items-center justify-center shrink-0">
              <User size={16} className="text-[var(--sidebar-text-muted)]" />
            </div>
          </div>
        </div>
      </nav>

      {/* Content Zone — 232px (280 - 48), only when expanded */}
      {!collapsed && (
        <div
          data-testid="sidebar-content"
          className="flex-1 min-w-0 flex flex-col overflow-y-auto border-l border-white/5 pt-2 pb-2 px-1"
        >
          {navData ? (
            <SidebarNavContent navData={navData} />
          ) : (
            <SidebarSkeleton />
          )}
        </div>
      )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Nav Content
// ---------------------------------------------------------------------------

function SidebarNavContent({ navData }: { navData: SidebarNavigation }) {
  return (
    <>
      <TenantSwitcher tenants={navData.tenants} />
      <PortalSection portals={navData.portals} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-2 pt-2" data-testid="sidebar-skeleton">
      {/* Tenant header skeleton */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--sidebar-bg-hover)] animate-pulse" />
        <div className="h-3.5 w-24 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
      </div>
      {/* Workspace skeletons */}
      <div className="pl-4 flex flex-col gap-2">
        <div className="h-3 w-32 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
        <div className="h-3 w-28 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
        <div className="h-3 w-20 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
      </div>
      {/* Second tenant skeleton */}
      <div className="flex items-center gap-2 mt-2">
        <div className="w-2 h-2 rounded-full bg-[var(--sidebar-bg-hover)] animate-pulse" />
        <div className="h-3.5 w-20 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
      </div>
      <div className="pl-4 flex flex-col gap-2">
        <div className="h-3 w-24 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
        <div className="h-3 w-30 rounded bg-[var(--sidebar-bg-hover)] animate-pulse" />
      </div>
    </div>
  );
}
