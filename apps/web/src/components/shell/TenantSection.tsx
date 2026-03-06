'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Building2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { WorkspaceTree } from './WorkspaceTree';
import type { TenantNavSection } from '@/data/sidebar-navigation';

interface TenantSectionProps {
  section: TenantNavSection;
  activeWorkspaceId?: string;
  /** Called when an inactive tenant header is clicked to initiate a switch. */
  onTenantSwitch?: () => void;
}

export function TenantSection({ section, activeWorkspaceId, onTenantSwitch }: TenantSectionProps) {
  const [expanded, setExpanded] = useState(section.isActive);
  const t = useTranslations('shell.sidebar');

  const hasWorkspaces = section.workspaces.length > 0 || section.boards.length > 0;

  function handleHeaderClick() {
    if (!section.isActive && onTenantSwitch) {
      onTenantSwitch();
      return;
    }
    setExpanded(!expanded);
  }

  const myOfficeLabel = section.isPersonalTenant
    ? t('myOfficePersonal')
    : t('myOfficeQualified', { tenantName: section.tenantName });

  return (
    <div data-testid={`tenant-section-${section.tenantId}`}>
      {/* Tenant header */}
      <button
        type="button"
        onClick={handleHeaderClick}
        data-testid={`tenant-header-${section.tenantId}`}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 rounded',
          'text-body-sm font-semibold',
          'text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
          'transition-colors duration-150',
        )}
      >
        {expanded ? (
          <ChevronDown size={14} className="shrink-0 text-[var(--sidebar-text-muted)]" />
        ) : (
          <ChevronRight size={14} className="shrink-0 text-[var(--sidebar-text-muted)]" />
        )}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: section.accentColor }}
          aria-hidden="true"
        />
        <span className="truncate">{section.tenantName}</span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="pl-2">
          {/* My Office entry */}
          <button
            type="button"
            data-testid={`my-office-${section.tenantId}`}
            className={cn(
              'flex items-center gap-2 w-full px-2 py-1.5 rounded',
              'text-body-sm text-[var(--sidebar-text)] hover:bg-[var(--sidebar-bg-hover)]',
              'transition-colors duration-150',
            )}
          >
            <Building2 size={16} className="shrink-0" />
            <span className="truncate">{myOfficeLabel}</span>
          </button>

          {/* Workspace tree */}
          {hasWorkspaces ? (
            <WorkspaceTree
              boards={section.boards}
              workspaces={section.workspaces}
              activeWorkspaceId={activeWorkspaceId}
            />
          ) : (
            <p className="px-2 py-1.5 text-caption text-[var(--sidebar-text-muted)]">
              {t('noWorkspaces')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
