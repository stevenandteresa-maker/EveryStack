/**
 * Notion OAuth Callback Route
 *
 * Handles the redirect from Notion after the user authorizes.
 * Completes the OAuth flow and notifies the opener window via postMessage.
 *
 * Flow:
 * 1. Read `code` and `state` from query params
 * 2. Call `completeNotionConnection` to exchange code for tokens
 * 3. Render HTML that sends postMessage to opener and closes the popup
 * 4. Fallback: if opener is null (same-tab redirect), redirect to app
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { completeNotionConnection } from '@/actions/sync-connections';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return new NextResponse('Missing code or state parameter', { status: 400 });
  }

  try {
    const { connectionId } = await completeNotionConnection({ code, state });
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';

    const html = `<!DOCTYPE html>
<html>
<head><title>Connecting...</title></head>
<body>
<script>
(function() {
  var data = {
    type: 'notion_oauth_complete',
    connectionId: ${JSON.stringify(connectionId)}
  };
  var origin = ${JSON.stringify(appUrl)};

  if (window.opener) {
    window.opener.postMessage(data, origin);
    window.close();
  } else {
    window.location.href = origin + '/?sync_connection_id=' + encodeURIComponent(data.connectionId);
  }
})();
</script>
<p>Connected successfully. This window should close automatically.</p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  } catch {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';

    const html = `<!DOCTYPE html>
<html>
<head><title>Connection Failed</title></head>
<body>
<script>
(function() {
  var data = { type: 'notion_oauth_error', error: 'Connection failed. Please try again.' };
  var origin = ${JSON.stringify(appUrl)};

  if (window.opener) {
    window.opener.postMessage(data, origin);
    window.close();
  } else {
    window.location.href = origin + '/?sync_error=oauth_failed';
  }
})();
</script>
<p>Connection failed. Please close this window and try again.</p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
