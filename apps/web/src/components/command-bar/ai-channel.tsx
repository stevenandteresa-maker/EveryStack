'use client';

/**
 * CommandBarAIChannel — AI natural language search results within the Command Bar.
 *
 * - Read results display immediately (no confirmation)
 * - Action suggestions show preview card with Confirm/Cancel
 * - Credit cost shown before AI call fires
 * - 500ms debounce (longer than search channel)
 * - Graceful error handling — never breaks the Command Bar
 *
 * @see docs/reference/command-bar.md § Unified Command Prompt
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, AlertCircle, Coins, Check, X } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { aiSearchQuery, executeSlashCommand } from '@/actions/command-bar';
import type { AISearchResult } from '@/lib/command-bar/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandBarAIChannelProps {
  query: string;
  workspaceId: string;
  tenantId: string;
  userId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AI_DEBOUNCE_MS = 500;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandBarAIChannel({
  query,
  workspaceId,
  tenantId,
  userId,
}: CommandBarAIChannelProps) {
  const t = useTranslations('commandBar');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AISearchResult | null>(null);
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [actionExecuted, setActionExecuted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef(0);

  // -----------------------------------------------------------------------
  // Debounced AI search
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResult(null);
      setIsLoading(false);
      setConfirmingAction(false);
      setActionExecuted(false);
      return;
    }

    const requestId = ++abortRef.current;
    setIsLoading(true);
    setConfirmingAction(false);
    setActionExecuted(false);

    debounceRef.current = setTimeout(async () => {
      try {
        const aiResult = await aiSearchQuery(tenantId, workspaceId, userId, trimmed);
        if (abortRef.current === requestId) {
          setResult(aiResult);
          setIsLoading(false);
        }
      } catch {
        if (abortRef.current === requestId) {
          setResult({
            success: false,
            type: 'read',
            content: t('aiUnavailable'),
            creditsCharged: 0,
            creditsRemaining: 0,
            error: 'AI is unavailable',
          });
          setIsLoading(false);
        }
      }
    }, AI_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, tenantId, workspaceId, userId, t]);

  // -----------------------------------------------------------------------
  // Action confirmation handlers
  // -----------------------------------------------------------------------
  const handleConfirm = useCallback(async () => {
    if (!result?.actionSuggestion) return;

    setConfirmingAction(true);
    try {
      if (result.actionSuggestion.commandKey) {
        await executeSlashCommand(
          tenantId,
          userId,
          result.actionSuggestion.commandKey,
          result.actionSuggestion.params,
        );
      }
      setActionExecuted(true);
    } catch {
      // Error handled gracefully — stay in the command bar
    } finally {
      setConfirmingAction(false);
    }
  }, [result, tenantId, userId]);

  const handleCancel = useCallback(() => {
    setResult(null);
    setConfirmingAction(false);
    setActionExecuted(false);
  }, []);

  // -----------------------------------------------------------------------
  // Render: loading state
  // -----------------------------------------------------------------------
  if (isLoading) {
    return (
      <CommandGroup
        heading={t('aiHeading')}
        data-testid="ai-channel-loading"
      >
        <div className="space-y-2 px-2 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CommandGroup>
    );
  }

  // -----------------------------------------------------------------------
  // Render: no query
  // -----------------------------------------------------------------------
  if (!query.trim()) {
    return null;
  }

  // -----------------------------------------------------------------------
  // Render: error state
  // -----------------------------------------------------------------------
  if (result && !result.success) {
    return (
      <CommandGroup
        heading={t('aiHeading')}
        data-testid="ai-channel-error"
      >
        <CommandItem disabled>
          <AlertCircle className="mr-2 h-4 w-4 text-destructive" />
          <span>{t('aiUnavailable')}</span>
        </CommandItem>
      </CommandGroup>
    );
  }

  // -----------------------------------------------------------------------
  // Render: no result yet (waiting for debounce)
  // -----------------------------------------------------------------------
  if (!result) {
    return null;
  }

  // -----------------------------------------------------------------------
  // Render: read results — display immediately
  // -----------------------------------------------------------------------
  if (result.type === 'read') {
    return (
      <CommandGroup
        heading={t('aiHeading')}
        data-testid="ai-channel-read-results"
      >
        <CommandItem data-testid="ai-read-result">
          <Bot className="mr-2 h-4 w-4 text-muted-foreground" />
          <span className="flex-1 whitespace-pre-wrap">{result.content}</span>
        </CommandItem>
        {result.creditsCharged > 0 && (
          <div
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground"
            data-testid="ai-credit-cost"
          >
            <Coins className="h-3 w-3" />
            <span>{t('aiCreditsUsed', { credits: result.creditsCharged })}</span>
          </div>
        )}
      </CommandGroup>
    );
  }

  // -----------------------------------------------------------------------
  // Render: action suggestion — requires Confirm/Cancel
  // -----------------------------------------------------------------------
  return (
    <CommandGroup
      heading={t('aiHeading')}
      data-testid="ai-channel-action-suggestion"
    >
      <div className="space-y-3 px-2 py-3">
        {/* Action preview card */}
        <div
          className="rounded-md border bg-muted/50 p-3"
          data-testid="ai-action-preview"
        >
          <div className="flex items-start gap-2">
            <Bot className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {result.actionSuggestion?.label}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {result.actionSuggestion?.description}
              </p>
            </div>
          </div>
        </div>

        {/* Credit cost before execution */}
        {result.creditsCharged > 0 && (
          <div
            className="flex items-center gap-1 text-xs text-muted-foreground"
            data-testid="ai-credit-cost"
          >
            <Coins className="h-3 w-3" />
            <span>{t('aiCreditsUsed', { credits: result.creditsCharged })}</span>
          </div>
        )}

        {/* Confirm/Cancel buttons */}
        {!actionExecuted && (
          <div
            className="flex items-center gap-2"
            data-testid="ai-action-buttons"
          >
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={confirmingAction}
              data-testid="ai-action-confirm"
            >
              <Check className="mr-1 h-3 w-3" />
              {t('aiConfirm')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={confirmingAction}
              data-testid="ai-action-cancel"
            >
              <X className="mr-1 h-3 w-3" />
              {t('aiCancel')}
            </Button>
          </div>
        )}

        {/* Action executed confirmation */}
        {actionExecuted && (
          <div
            className="flex items-center gap-1 text-sm text-green-600"
            data-testid="ai-action-executed"
          >
            <Check className="h-4 w-4" />
            <span>{t('aiActionExecuted')}</span>
          </div>
        )}
      </div>
    </CommandGroup>
  );
}
