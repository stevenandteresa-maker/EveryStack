// TODO [Phase 1G]: Replace with BullMQ worker setup and Redis connection

// TODO [Phase 1D]: Replace console.log with Pino logger
// eslint-disable-next-line no-console
console.log('[worker] Starting EveryStack worker...');

function shutdown(signal: string) {
  // TODO [Phase 1D]: Replace console.log with Pino logger
  // eslint-disable-next-line no-console
  console.log(`[worker] Received ${signal}, shutting down gracefully...`);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
