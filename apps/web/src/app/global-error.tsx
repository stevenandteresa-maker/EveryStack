'use client';

// i18n exception: global-error.tsx replaces the root <html> layout, so
// IntlProvider (and useTranslations) is unavailable. Strings are kept in
// the GLOBAL_ERROR_TEXT map below for easy auditing and future extraction.

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

const GLOBAL_ERROR_TEXT = {
  title: 'Something went wrong',
  description:
    'An unexpected error occurred. Please try again, or contact support if the problem persists.',
  tryAgain: 'Try Again',
  reportIssue: 'Report Issue',
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const errorRef = error.digest;

  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        error_digest: errorRef,
      },
    });
  }, [error, errorRef]);

  const reportUrl = errorRef
    ? `mailto:support@everystack.io?subject=Error Report&body=Error Reference: ${errorRef}`
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
            {GLOBAL_ERROR_TEXT.title}
          </h1>
          <p style={{ color: '#666', marginBottom: '24px', maxWidth: '400px' }}>
            {GLOBAL_ERROR_TEXT.description}
          </p>
          {errorRef && (
            <p style={{ color: '#999', fontSize: '12px', marginBottom: '16px' }}>
              Error Reference: {errorRef}
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
              {GLOBAL_ERROR_TEXT.tryAgain}
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
                {GLOBAL_ERROR_TEXT.reportIssue}
              </a>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
