/**
 * Platform API v1 — Health / Version Endpoint
 *
 * GET /api/v1/ → { api, version, status }
 * No authentication required — used for connectivity checks.
 *
 * @see docs/reference/platform-api.md § API Versioning
 */

import { NextResponse } from 'next/server';
import { API_VERSION, API_VERSION_HEADER } from '@/lib/api/errors';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      api: 'everystack',
      version: 'v1',
      status: 'ok',
    },
    {
      headers: { [API_VERSION_HEADER]: API_VERSION },
    },
  );
}
