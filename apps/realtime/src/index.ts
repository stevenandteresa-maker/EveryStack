// TODO [Phase 1G]: Replace with Socket.io server setup and Redis adapter

const REALTIME_PORT = process.env["REALTIME_PORT"] ?? "3001";

// TODO [Phase 1D]: Replace console.log with Pino logger
console.log(
  `[realtime] Starting EveryStack realtime server on port ${REALTIME_PORT}...`
);

function shutdown(signal: string) {
  // TODO [Phase 1D]: Replace console.log with Pino logger
  console.log(`[realtime] Received ${signal}, shutting down gracefully...`);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
