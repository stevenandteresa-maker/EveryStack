import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Span } from '@opentelemetry/sdk-trace-base';
import { TraceIdSpanProcessor } from './otel';

// ── Mock OTel SDK to capture constructor args without starting real instrumentation ──

const mockSdkStart = vi.fn();
const mockSdkShutdown = vi.fn().mockResolvedValue(undefined);
let capturedSdkConfig: Record<string, unknown> | undefined;

vi.mock('@opentelemetry/sdk-node', () => {
  class MockNodeSDK {
    constructor(config: Record<string, unknown>) {
      capturedSdkConfig = config;
    }
    start = mockSdkStart;
    shutdown = mockSdkShutdown;
  }
  return { NodeSDK: MockNodeSDK };
});

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: (attrs: Record<string, string>) => ({
    attributes: attrs,
  }),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn((config: Record<string, unknown>) => [
    { __type: 'auto-instrumentations', config },
  ]),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => {
  class MockOTLPTraceExporter {
    __type = 'otlp-exporter';
    url: string;
    constructor(opts: { url: string }) {
      this.url = opts.url;
    }
  }
  return { OTLPTraceExporter: MockOTLPTraceExporter };
});

vi.mock('@opentelemetry/sdk-trace-base', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const actual = await importOriginal<typeof import('@opentelemetry/sdk-trace-base')>();

  class MockConsoleSpanExporter {
    __type = 'console-exporter';
  }

  class MockSimpleSpanProcessor {
    __type = 'simple-processor';
    exporter: unknown;
    constructor(exporter: unknown) {
      this.exporter = exporter;
    }
  }

  return {
    ...actual,
    ConsoleSpanExporter: MockConsoleSpanExporter,
    SimpleSpanProcessor: MockSimpleSpanProcessor,
  };
});

// ── Mock trace context ──

let mockTraceId = 'no-trace';

vi.mock('../logging/trace-context', () => ({
  getTraceId: () => mockTraceId,
}));

describe('TraceIdSpanProcessor', () => {
  let processor: TraceIdSpanProcessor;

  beforeEach(() => {
    processor = new TraceIdSpanProcessor();
    mockTraceId = 'no-trace';
  });

  it('attaches app.trace_id when trace context is active', () => {
    mockTraceId = 'abc-123-trace';

    const mockSpan = {
      setAttribute: vi.fn(),
    } as unknown as Span;

    processor.onStart(mockSpan);

    expect(mockSpan.setAttribute).toHaveBeenCalledWith(
      'app.trace_id',
      'abc-123-trace',
    );
  });

  it('does not attach attribute when no trace context is active', () => {
    mockTraceId = 'no-trace';

    const mockSpan = {
      setAttribute: vi.fn(),
    } as unknown as Span;

    processor.onStart(mockSpan);

    expect(mockSpan.setAttribute).not.toHaveBeenCalled();
  });

  it('onEnd is a no-op', () => {
    const mockReadableSpan =
      {} as Parameters<TraceIdSpanProcessor['onEnd']>[0];
    expect(() => processor.onEnd(mockReadableSpan)).not.toThrow();
  });

  it('forceFlush resolves immediately', async () => {
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });

  it('shutdown resolves immediately', async () => {
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});

describe('initTelemetry', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedSdkConfig = undefined;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('starts the NodeSDK without errors', async () => {
    const { initTelemetry } = await import('./otel');
    const handle = initTelemetry({ serviceName: 'test-service' });

    expect(handle).toBeDefined();
    expect(handle.shutdown).toBeTypeOf('function');
    expect(mockSdkStart).toHaveBeenCalledOnce();
  });

  it('uses ConsoleSpanExporter when OTEL_EXPORTER_OTLP_ENDPOINT is not set', async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const { initTelemetry } = await import('./otel');
    initTelemetry({ serviceName: 'test-console' });

    expect(capturedSdkConfig).toBeDefined();
    const processors = capturedSdkConfig!.spanProcessors as Array<{
      __type: string;
      exporter?: { __type: string };
    }>;
    // Second processor is the SimpleSpanProcessor wrapping the exporter
    const simpleProcessor = processors[1];
    expect(simpleProcessor).toBeDefined();
    expect(simpleProcessor!.exporter?.__type).toBe('console-exporter');
  });

  it('uses OTLPTraceExporter when OTEL_EXPORTER_OTLP_ENDPOINT is set', async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';

    // Re-import to pick up the new env var
    vi.resetModules();

    // Re-mock trace-context after module reset
    vi.doMock('../logging/trace-context', () => ({
      getTraceId: () => mockTraceId,
    }));

    const { initTelemetry } = await import('./otel');
    initTelemetry({ serviceName: 'test-otlp' });

    expect(capturedSdkConfig).toBeDefined();
    const processors = capturedSdkConfig!.spanProcessors as Array<{
      __type: string;
      exporter?: { __type: string; url?: string };
    }>;
    const simpleProcessor = processors[1];
    expect(simpleProcessor).toBeDefined();
    expect(simpleProcessor!.exporter?.__type).toBe('otlp-exporter');
    expect(simpleProcessor!.exporter?.url).toBe(
      'http://localhost:4318/v1/traces',
    );
  });

  it('enables HTTP, pg, and ioredis instrumentations', async () => {
    const { initTelemetry } = await import('./otel');
    initTelemetry({ serviceName: 'test-instrumentations' });

    expect(capturedSdkConfig).toBeDefined();
    const instrumentations = capturedSdkConfig!.instrumentations as Array<
      Array<{ config: Record<string, { enabled: boolean }> }>
    >;
    const autoConfig = instrumentations[0]![0]!.config;
    expect(autoConfig).toBeDefined();
    expect(
      autoConfig['@opentelemetry/instrumentation-http']!.enabled,
    ).toBe(true);
    expect(
      autoConfig['@opentelemetry/instrumentation-pg']!.enabled,
    ).toBe(true);
    expect(
      autoConfig['@opentelemetry/instrumentation-ioredis']!.enabled,
    ).toBe(true);
  });

  it('disables noisy instrumentations (fs, dns)', async () => {
    const { initTelemetry } = await import('./otel');
    initTelemetry({ serviceName: 'test-disabled' });

    expect(capturedSdkConfig).toBeDefined();
    const instrumentations = capturedSdkConfig!.instrumentations as Array<
      Array<{ config: Record<string, { enabled: boolean }> }>
    >;
    const autoConfig = instrumentations[0]![0]!.config;
    expect(autoConfig).toBeDefined();
    expect(
      autoConfig['@opentelemetry/instrumentation-fs']!.enabled,
    ).toBe(false);
    expect(
      autoConfig['@opentelemetry/instrumentation-dns']!.enabled,
    ).toBe(false);
  });

  it('includes TraceIdSpanProcessor in span processors', async () => {
    const { initTelemetry } = await import('./otel');
    initTelemetry({ serviceName: 'test-processor' });

    expect(capturedSdkConfig).toBeDefined();
    const processors = capturedSdkConfig!.spanProcessors as Array<{
      constructor: { name: string };
    }>;
    // First processor should be the TraceIdSpanProcessor instance
    expect(processors[0]?.constructor.name).toBe('TraceIdSpanProcessor');
  });

  it('sets service name and environment in resource', async () => {
    const { initTelemetry } = await import('./otel');
    initTelemetry({
      serviceName: 'test-resource',
      environment: 'staging',
    });

    expect(capturedSdkConfig).toBeDefined();
    const resource = capturedSdkConfig!.resource as {
      attributes: Record<string, string>;
    };
    expect(resource.attributes['service.name']).toBe('test-resource');
    expect(resource.attributes['deployment.environment']).toBe(
      'staging',
    );
  });

  it('defaults environment to NODE_ENV', async () => {
    process.env.NODE_ENV = 'test';

    const { initTelemetry } = await import('./otel');
    initTelemetry({ serviceName: 'test-default-env' });

    const resource = capturedSdkConfig!.resource as {
      attributes: Record<string, string>;
    };
    expect(resource.attributes['deployment.environment']).toBe('test');
  });

  it('shutdown() calls SDK shutdown', async () => {
    const { initTelemetry } = await import('./otel');
    const handle = initTelemetry({ serviceName: 'test-shutdown' });

    await handle.shutdown();

    expect(mockSdkShutdown).toHaveBeenCalledOnce();
  });
});
