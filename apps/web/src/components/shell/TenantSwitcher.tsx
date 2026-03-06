'use client';

/**
 * TenantSwitcher — Orchestrates tenant switching with optimistic UI.
 *
 * When a user clicks an inactive tenant header:
 *   1. Optimistic: repaint shell accent, expand target, collapse previous
 *   2. Call switchTenantAction() (Server Action)
 *   3. Call Clerk setActive() for JWT refresh
 *   4. On success: navigate to target tenant context
 *   5. On failure: revert accent, re-expand previous, show error toast
 *
 * @see docs/reference/navigation.md § Switching Flow
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { TenantSection } from './TenantSection';
import { useShellAccent } from './ShellAccentProvider';
import { switchTenantAction, invalidateTenantCacheAction } from '@/actions/tenant-switch';
import type { TenantNavSection } from '@/data/sidebar-navigation';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TenantSwitcherProps {
  tenants: TenantNavSection[];
  activeWorkspaceId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TenantSwitcher({ tenants, activeWorkspaceId }: TenantSwitcherProps) {
  const [activeTenantId, setActiveTenantId] = useState<string | null>(
    () => tenants.find((t) => t.isActive)?.tenantId ?? null,
  );
  const [switching, setSwitching] = useState(false);

  const { applyTenantAccent, revertShellAccent } = useShellAccent();
  const { setActive } = useClerk();
  const router = useRouter();
  const t = useTranslations('shell.sidebar');

  const handleTenantSwitch = useCallback(
    async (target: TenantNavSection) => {
      if (switching || target.tenantId === activeTenantId) return;

      const previousTenantId = activeTenantId;
      setSwitching(true);

      // Step 1: Optimistic UI — repaint accent + expand target
      applyTenantAccent(
        target.tenantId,
        target.isPersonalTenant,
        target.accentColor,
      );
      setActiveTenantId(target.tenantId);

      try {
        // Step 2: Server Action — validate access + update Redis
        const result = await switchTenantAction(target.tenantId);

        // Step 3: Clerk setActive — issue new JWT
        await setActive({
          organization: result.clerkOrgId,
        });

        // Step 4: Navigate to target tenant context
        router.refresh();
      } catch {
        // Step 5: Revert on failure
        revertShellAccent();
        setActiveTenantId(previousTenantId);

        // Best-effort: revert Redis cache
        try {
          await invalidateTenantCacheAction();
        } catch {
          // Non-fatal — Redis revert failed silently
        }

        const switchErrorMessage = t('switchError');
        toast.error(switchErrorMessage);
      } finally {
        setSwitching(false);
      }
    },
    [
      switching,
      activeTenantId,
      applyTenantAccent,
      revertShellAccent,
      setActive,
      router,
      t,
    ],
  );

  return (
    <>
      {tenants.map((section) => {
        const isActive = section.tenantId === activeTenantId;

        return (
          <TenantSection
            key={`${section.tenantId}-${activeTenantId}`}
            section={{ ...section, isActive }}
            activeWorkspaceId={activeWorkspaceId}
            onTenantSwitch={
              !isActive ? () => handleTenantSwitch(section) : undefined
            }
          />
        );
      })}
    </>
  );
}
