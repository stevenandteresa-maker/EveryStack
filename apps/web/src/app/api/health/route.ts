import { NextResponse } from "next/server";

// TODO [Phase 1B]: Add Postgres health check
// TODO [Phase 1G]: Add Redis health check

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
