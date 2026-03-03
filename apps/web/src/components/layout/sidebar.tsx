'use client';

import {
  Home,
  Layers,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/stores/sidebar-store';

const NAV_ITEMS = [
  { icon: Home, labelKey: 'home' },
  { icon: Layers, labelKey: 'workspaces' },
] as const;

const BOTTOM_ITEMS = [
  { icon: Settings, labelKey: 'settings' },
] as const;

export function Sidebar() {
  const { collapsed, toggle } = useSidebarStore();
  const t = useTranslations('shell.sidebar');

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        'hidden tablet:flex flex-col shrink-0 transition-[width] duration-200 ease-in-out',
        'bg-[var(--sidebar-bg)] text-[var(--sidebar-text)]',
      )}
      style={{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)' }}
    >
      {/* Navigation items */}
      <nav className="flex-1 flex flex-col gap-1 pt-2 px-1">
        {NAV_ITEMS.map(({ icon: Icon, labelKey }) => (
          <button
            key={labelKey}
            type="button"
            className={cn(
              'touch-target-lg flex items-center gap-3 rounded px-2.5 py-2',
              'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
              'transition-colors duration-150',
              collapsed && 'justify-center',
            )}
            aria-label={t(labelKey)}
          >
            <Icon size={20} className="shrink-0" />
            {!collapsed && (
              <span className="text-body truncate">{t(labelKey)}</span>
            )}
          </button>
        ))}

        {/* Workspaces section placeholder (expanded only) */}
        {!collapsed && (
          <div className="mt-4 px-2.5">
            <span className="text-caption font-semibold uppercase tracking-wider text-[var(--sidebar-text-muted)]">
              {t('workspaces')}
            </span>
          </div>
        )}
      </nav>

      {/* Bottom area: settings, toggle, avatar */}
      <div className="flex flex-col gap-1 pb-2 px-1">
        {BOTTOM_ITEMS.map(({ icon: Icon, labelKey }) => (
          <button
            key={labelKey}
            type="button"
            className={cn(
              'touch-target-lg flex items-center gap-3 rounded px-2.5 py-2',
              'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
              'transition-colors duration-150',
              collapsed && 'justify-center',
            )}
            aria-label={t(labelKey)}
          >
            <Icon size={20} className="shrink-0" />
            {!collapsed && (
              <span className="text-body truncate">{t(labelKey)}</span>
            )}
          </button>
        ))}

        {/* Toggle button */}
        <button
          type="button"
          onClick={toggle}
          data-testid="sidebar-toggle"
          className={cn(
            'touch-target-lg flex items-center gap-3 rounded px-2.5 py-2',
            'text-[var(--sidebar-text-muted)] hover:bg-[var(--sidebar-bg-hover)] hover:text-[var(--sidebar-text)]',
            'transition-colors duration-150',
            collapsed && 'justify-center',
          )}
          aria-label={collapsed ? t('expand') : t('collapse')}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} className="shrink-0" />
          ) : (
            <PanelLeftClose size={20} className="shrink-0" />
          )}
          {!collapsed && (
            <span className="text-body truncate">{t('collapseLabel')}</span>
          )}
        </button>

        {/* Avatar placeholder */}
        <div
          className={cn(
            'flex items-center gap-3 px-2.5 py-2',
            collapsed && 'justify-center',
          )}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--sidebar-bg-hover)] flex items-center justify-center shrink-0">
            <User size={16} className="text-[var(--sidebar-text-muted)]" />
          </div>
          {!collapsed && (
            <span className="text-body-sm text-[var(--sidebar-text-muted)] truncate">
              {t('account')}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
