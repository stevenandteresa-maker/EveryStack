import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import type {
  SpanProcessor,
  ReadableSpan,
  Span,
} from '@opentelemetry/sdk-trace-base';

import { getTraceId } from '../logging/trace-context';

/** Configuration for initializing the OpenTelemetry SDK. */
export interface InitTelemetryOptions {
  /** Service name attached to all spans (e.g. 'everystack-web', 'everystack-worker'). */
  serviceName: string;
  /** Deployment environment (e.g. 'development', 'staging', 'production'). Defaults to NODE_ENV. */
  environment?: string;
}

/** Return type of initTelemetry — call shutdown() for graceful cleanup. */
export interface TelemetryHandle {
  shutdown: () => Promise<void>;
}

/**
 * Custom SpanProcessor that reads the current traceId from AsyncLocalStorage
 * and attaches it as the `app.trace_id` attribute on every span.
 * This cross-references OTel spans with Pino logs and Sentry events.
 */
export class TraceIdSpanProcessor implements SpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span): void {
    const appTraceId = getTraceId();
    if (appTraceId !== 'no-trace') {
      span.setAttribute('app.trace_id', appTraceId);
    }
  }

  onEnd(_span: ReadableSpan): void {
    // No-op — attribute is set on start
  }
}

/**
 * Initializes the OpenTelemetry SDK with auto-instrumentation for HTTP,
 * PostgreSQL (pg driver via Drizzle), and Redis (ioredis).
 *
 * - Uses ConsoleSpanExporter when OTEL_EXPORTER_OTLP_ENDPOINT is not set (dev)
 * - Uses OTLPTraceExporter when OTEL_EXPORTER_OTLP_ENDPOINT is set (staging/prod)
 * - Disables noisy instrumentations: fs, dns
 * - Attaches app.trace_id from AsyncLocalStorage to every span
 *
 * @returns TelemetryHandle with shutdown() for graceful cleanup
 */
export function initTelemetry(options: InitTelemetryOptions): TelemetryHandle {
  const { serviceName, environment = process.env.NODE_ENV ?? 'development' } =
    options;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const spanExporter = otlpEndpoint
    ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
    : new ConsoleSpanExporter();

  const sdk = new NodeSDK({
    resource,
    spanProcessors: [
      new TraceIdSpanProcessor(),
      new SimpleSpanProcessor(spanExporter),
    ],
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();

  return {
    shutdown: async () => {
      await sdk.shutdown();
    },
  };
}
