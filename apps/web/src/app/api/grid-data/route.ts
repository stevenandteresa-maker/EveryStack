/**
 * GET /api/grid-data — serves records, fields, and view config for the grid.
 *
 * Query params: tableId (required), viewId (optional)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getRecordsByTable } from '@/data/records';
import { getFieldsByTable } from '@/data/fields';
import { getViewById, getDefaultView } from '@/data/views';
import { viewConfigSchema } from '@/lib/types/grid';

export async function GET(request: NextRequest) {
  const { tenantId } = await getAuthContext();

  const { searchParams } = request.nextUrl;
  const tableId = searchParams.get('tableId');
  const viewId = searchParams.get('viewId');

  if (!tableId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'tableId is required' } },
      { status: 400 },
    );
  }

  const [recordsResult, fields, view] = await Promise.all([
    getRecordsByTable(tenantId, tableId),
    getFieldsByTable(tenantId, tableId),
    viewId
      ? getViewById(tenantId, viewId)
      : getDefaultView(tenantId, tableId),
  ]);

  const parsedConfig = viewConfigSchema.safeParse(view.config);
  const viewConfig = parsedConfig.success ? parsedConfig.data : {};

  return NextResponse.json({
    records: recordsResult.records,
    fields,
    viewConfig,
    totalCount: recordsResult.totalCount,
    hasMore: recordsResult.hasMore,
  });
}
