'use client';

/**
 * SyncNotificationToast — Renders sync notification toasts based on
 * real-time events received via Redis pub/sub → Socket.io.
 *
 * Listens for sync notification events on the user's notification channel
 * and displays toast messages for:
 * - Conflict detected (manual mode)
 * - 3 consecutive sync failures
 * - Partial failure (>10 records)
 * - Schema mismatch detected
 *
 * Auth expired and downtime notifications are email-only and not toasted.
 *
 * @see docs/reference/sync-engine.md § Notification System for Sync Issues
 */

import { useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { SyncNotificationPayload } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SyncNotificationToastProps {
  /** Socket.io event listener — subscribe to 'notification.created' events. */
  onSubscribe: (handler: (payload: SyncNotificationPayload) => void) => () => void;
  /** Toast display function — typically from a toast provider. */
  showToast: (options: {
    title: string;
    message: string;
    variant: 'default' | 'destructive' | 'warning';
    action?: { label: string; onClick: () => void };
  }) => void;
  /** Navigate to sync settings when user clicks toast action. */
  onNavigateToSyncSettings?: (connectionId: string) => void;
}

// ---------------------------------------------------------------------------
// Toast variant mapping
// ---------------------------------------------------------------------------

type ToastVariant = 'default' | 'destructive' | 'warning';

const EVENT_TOAST_VARIANT: Record<string, ToastVariant> = {
  conflict_detected: 'warning',
  consecutive_failures: 'destructive',
  partial_failure: 'warning',
  schema_mismatch: 'warning',
  auth_expired: 'destructive',
  sync_down_1h: 'destructive',
  sync_down_6h: 'destructive',
};

// ---------------------------------------------------------------------------
// In-app toast event types (email-only events are excluded)
// ---------------------------------------------------------------------------

const TOAST_EVENTS = new Set([
  'conflict_detected',
  'consecutive_failures',
  'partial_failure',
  'schema_mismatch',
]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SyncNotificationToast({
  onSubscribe,
  showToast,
  onNavigateToSyncSettings,
}: SyncNotificationToastProps) {
  const t = useTranslations('sync_notifications');

  const handleNotification = useCallback(
    (payload: SyncNotificationPayload) => {
      // Only show toasts for in-app event types
      if (!TOAST_EVENTS.has(payload.type)) {
        return;
      }

      const variant = EVENT_TOAST_VARIANT[payload.type] ?? 'default';

      showToast({
        title: payload.title,
        message: payload.message,
        variant,
        action: onNavigateToSyncSettings
          ? {
              label: t('view_details'),
              onClick: () => onNavigateToSyncSettings(payload.connectionId),
            }
          : undefined,
      });
    },
    [showToast, onNavigateToSyncSettings, t],
  );

  useEffect(() => {
    const unsubscribe = onSubscribe(handleNotification);
    return unsubscribe;
  }, [onSubscribe, handleNotification]);

  // This component renders nothing — it's a side-effect-only component
  return null;
}
