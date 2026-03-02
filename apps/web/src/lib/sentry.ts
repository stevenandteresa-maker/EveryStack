import * as Sentry from '@sentry/nextjs';

/**
 * Sets a `feature` tag on the current Sentry scope for per-feature error grouping.
 * Call at the entry point of a feature (e.g., Server Action, API route).
 */
export function setSentryFeatureTag(feature: string): void {
  Sentry.getCurrentScope().setTag('feature', feature);
}
