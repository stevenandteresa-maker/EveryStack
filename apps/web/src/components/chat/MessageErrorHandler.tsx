'use client';

/**
 * MessageErrorHandler — renders failed message states with retry logic.
 *
 * Per communications.md § Messaging Error Handling:
 * - Failed messages: red outline + retry icon
 * - 3 retries (1s, 3s, 10s), then manual retry
 * - Rate limiting: toast + disable composer 5s
 *
 * @see docs/reference/communications.md § Messaging Error Handling
 */

import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { JSONContent } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FailedMessage {
  id: string;
  content: JSONContent;
  threadId: string;
  retryCount: number;
  maxRetries: number;
  status: 'failed' | 'retrying';
}

interface MessageErrorHandlerProps {
  failedMessages: FailedMessage[];
  onRetry: (msg: FailedMessage) => void;
  onDismiss: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const RETRY_DELAYS = [1000, 3000, 10000] as const;
export const RATE_LIMIT_COOLDOWN_MS = 5000;
export const RATE_LIMIT_MAX = 30; // 30 msg/min/user/thread

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessageErrorHandler({
  failedMessages,
  onRetry,
  onDismiss,
}: MessageErrorHandlerProps) {
  const t = useTranslations('chat.errors');

  if (failedMessages.length === 0) return null;

  return (
    <div className="px-3 py-1 space-y-1" data-testid="message-error-handler">
      {failedMessages.map((msg) => (
        <div
          key={msg.id}
          className="flex items-center gap-2 px-3 py-2 rounded border border-red-300 bg-red-50 text-sm"
          data-testid="failed-message"
        >
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <span className="flex-1 text-red-700 truncate">
            {msg.retryCount >= msg.maxRetries
              ? t('sendFailedManual')
              : t('sendFailed')}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 hover:text-red-700"
              onClick={() => onRetry(msg)}
              disabled={msg.status === 'retrying'}
              aria-label={t('retry')}
              data-testid="retry-message"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${msg.status === 'retrying' ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-400 hover:text-red-600"
              onClick={() => onDismiss(msg.id)}
              aria-label={t('dismiss')}
              data-testid="dismiss-failed-message"
            >
              <span className="text-xs">×</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
