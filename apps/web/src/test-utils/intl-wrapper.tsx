import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const messagesPath = resolve(__dirname, '../../messages/en.json');
const messages = JSON.parse(readFileSync(messagesPath, 'utf-8'));

interface IntlWrapperProps {
  children: ReactNode;
  locale?: string;
}

export function IntlWrapper({ children, locale = 'en' }: IntlWrapperProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
