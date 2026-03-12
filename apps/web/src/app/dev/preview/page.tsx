/**
 * Dev Preview — visual verification of DataGrid, CardView, and RecordView.
 *
 * Public route (no auth required). Uses static mock data, no database.
 * Access at: http://localhost:3000/dev/preview
 */

import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { DevPreviewClient } from './preview-client';

export default async function DevPreviewPage() {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <DevPreviewClient />
    </NextIntlClientProvider>
  );
}
