import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AppShell } from '@/components/layout/app-shell';
import { QueryProvider } from '@/lib/query-provider';
import { CommandBarProvider } from '@/components/command-bar/command-bar-provider';
import { CommandBar } from '@/components/command-bar/command-bar';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <CommandBarProvider>
          <AppShell>{children}</AppShell>
          <CommandBar />
        </CommandBarProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
