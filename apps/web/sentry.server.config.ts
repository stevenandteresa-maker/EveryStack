import * as Sentry from '@sentry/nextjs';

import { getTraceId, getTenantIdFromTrace } from '@everystack/shared/logging';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      const traceId = getTraceId();
      if (traceId !== 'no-trace') {
        event.tags = { ...event.tags, trace_id: traceId };
      }
      const tenantId = getTenantIdFromTrace();
      if (tenantId) {
        event.tags = { ...event.tags, tenant_id: tenantId };
      }
      return event;
    },
  });
}
