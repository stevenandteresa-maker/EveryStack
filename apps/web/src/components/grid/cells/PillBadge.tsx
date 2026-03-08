'use client';

/**
 * PillBadge — reusable pill component for select options, people, and linked records.
 *
 * Supports color (light + saturated tones from data palette), text,
 * optional avatar, and optional close button.
 *
 * @see docs/reference/design-system.md § Data Color Palette
 */

/* eslint-disable @next/next/no-img-element */
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PillBadgeProps {
  /** Display text inside the pill */
  text: string;
  /** Background color (hex) — defaults to gray light tone */
  bgColor?: string;
  /** Text color (hex) — defaults to dark text */
  textColor?: string;
  /** Optional avatar URL for people pills */
  avatarUrl?: string;
  /** Avatar fallback initials */
  avatarFallback?: string;
  /** Show close button (for edit mode) */
  showClose?: boolean;
  /** Close button click handler */
  onClose?: () => void;
  /** Click handler for the pill itself */
  onClick?: () => void;
  /** Additional className */
  className?: string;
}

export function PillBadge({
  text,
  bgColor = '#F1F5F9',
  textColor = '#0F172A',
  avatarUrl,
  avatarFallback,
  showClose,
  onClose,
  onClick,
  className,
}: PillBadgeProps) {
  const isClickable = Boolean(onClick);

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isClickable && 'cursor-pointer',
        className,
      )}
      style={{ backgroundColor: bgColor, color: textColor }}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
    >
      {(avatarUrl || avatarFallback) && (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-300 text-[9px] font-semibold text-white">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            avatarFallback
          )}
        </span>
      )}
      <span className="truncate">{text}</span>
      {showClose && onClose && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-black/10"
          aria-label={`Remove ${text}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
