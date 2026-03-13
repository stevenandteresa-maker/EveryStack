/**
 * GET /api/field-permissions — serves resolved field permissions for a view.
 *
 * Query params: viewId (required)
 *
 * Returns a serialized FieldPermissionMap (array of [fieldId, state] tuples)
 * for the authenticated user.
 *
 * @see docs/reference/permissions.md § Field-Level Permissions
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getAuthContext } from '@/lib/auth-context';
import { getFieldPermissions } from '@/data/permissions';
import type { FieldPermissionState } from '@everystack/shared/auth';

export async function GET(request: NextRequest) {
  const { tenantId, userId } = await getAuthContext();

  const { searchParams } = request.nextUrl;
  const viewId = searchParams.get('viewId');

  if (!viewId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'viewId is required' } },
      { status: 400 },
    );
  }

  const permissionMap = await getFieldPermissions(tenantId, viewId, userId);

  // Serialize Map to array of tuples for JSON transport
  const entries: Array<[string, FieldPermissionState]> = [];
  for (const [key, value] of permissionMap) {
    entries.push([key, value]);
  }

  return NextResponse.json({ data: entries });
}
