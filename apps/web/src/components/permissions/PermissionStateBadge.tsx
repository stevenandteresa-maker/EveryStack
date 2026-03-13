'use client';

/**
 * Visual badge indicator for field permission states.
 *
 * Three states: read_write (green), read_only (amber), hidden (gray).
 * Uses shadcn/ui Badge with i18n labels.
 *
 * @see docs/reference/permissions.md § Permission Configuration UI
 */

import { useTranslations } from 'next-intl';
import { Check, Eye, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FieldPermissionState } from '@everystack/shared/auth';

export interface PermissionStateBadgeProps {
  state: FieldPermissionState;
  onClick?: () => void;
  className?: string;
}

const STATE_CONFIG: Record<
  FieldPermissionState,
  {
    variant: 'success' | 'warning' | 'default';
    icon: typeof Check;
    labelKey: 'fullAccess' | 'readOnly' | 'hidden';
  }
> = {
  read_write: { variant: 'success', icon: Check, labelKey: 'fullAccess' },
  read_only: { variant: 'warning', icon: Eye, labelKey: 'readOnly' },
  hidden: { variant: 'default', icon: EyeOff, labelKey: 'hidden' },
};

export function PermissionStateBadge({
  state,
  onClick,
  className,
}: PermissionStateBadgeProps) {
  const t = useTranslations('permissions');

  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'gap-1 select-none',
        onClick && 'cursor-pointer hover:opacity-80',
        className,
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={t(config.labelKey)}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {t(config.labelKey)}
    </Badge>
  );
}
