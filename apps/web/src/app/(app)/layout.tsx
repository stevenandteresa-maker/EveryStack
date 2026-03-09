import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AppShell } from '@/components/layout/app-shell';
import { QueryProvider } from '@/lib/query-provider';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <AppShell>{children}</AppShell>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
