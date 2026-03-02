/**
 * Next.js instrumentation hook (stable in Next.js 15+).
 * Initializes OpenTelemetry SDK for the web service.
 * Only runs in the Node.js runtime — Edge runtime is excluded.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTelemetry } = await import('@everystack/shared/telemetry');
    initTelemetry({ serviceName: 'everystack-web' });
  }
}
