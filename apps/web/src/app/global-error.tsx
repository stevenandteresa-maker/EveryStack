'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

import { getTraceId } from '@everystack/shared/logging';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const traceId = getTraceId();

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        trace_id: traceId !== 'no-trace' ? traceId : undefined,
      },
    });
  }, [error, traceId]);

  const reportUrl = traceId !== 'no-trace'
    ? `mailto:support@everystack.io?subject=Error Report&body=Trace ID: ${traceId}`
    : undefined;

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontFamily: 'system-ui, sans-serif',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#666', marginBottom: '24px', maxWidth: '400px' }}>
            An unexpected error occurred. Please try again, or contact support if
            the problem persists.
          </p>
          {traceId !== 'no-trace' && (
            <p style={{ color: '#999', fontSize: '12px', marginBottom: '16px' }}>
              Trace ID: {traceId}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={reset}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#0f766e',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Try Again
            </button>
            {reportUrl && (
              <a
                href={reportUrl}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '14px',
                }}
              >
                Report Issue
              </a>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
