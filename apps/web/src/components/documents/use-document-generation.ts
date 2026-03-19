'use client';

/**
 * useDocumentGeneration — polls a document generation job until completed or failed.
 *
 * Calls getDocumentGenerationStatus every 2s while the job is active.
 * Stops polling when status is 'completed', 'failed', or 'unknown'.
 *
 * @see docs/reference/smart-docs.md § Generation Flow
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getDocumentGenerationStatus,
  type DocumentGenerationStatus,
} from '@/actions/document-generation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseDocumentGenerationResult {
  /** Current job status */
  status: DocumentGenerationStatus | null;
  /** Whether polling is active */
  isPolling: boolean;
  /** Start polling for a given job ID */
  startPolling: (jobId: string) => void;
  /** Stop polling */
  stopPolling: () => void;
  /** Reset state for a new generation */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDocumentGeneration(): UseDocumentGenerationResult {
  const [status, setStatus] = useState<DocumentGenerationStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const jobIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async () => {
    const jobId = jobIdRef.current;
    if (!jobId) return;

    try {
      const result = await getDocumentGenerationStatus({ jobId });
      setStatus(result);

      // Stop polling on terminal states
      if (
        result.status === 'completed' ||
        result.status === 'failed' ||
        result.status === 'unknown'
      ) {
        stopPolling();
      }
    } catch {
      stopPolling();
    }
  }, [stopPolling]);

  const startPolling = useCallback(
    (jobId: string) => {
      // Clean up any existing polling
      stopPolling();

      jobIdRef.current = jobId;
      setStatus({ status: 'waiting' });
      setIsPolling(true);

      // Immediate first poll
      poll();

      // Then poll on interval
      timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    },
    [poll, stopPolling],
  );

  const reset = useCallback(() => {
    stopPolling();
    jobIdRef.current = null;
    setStatus(null);
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return { status, isPolling, startPolling, stopPolling, reset };
}
