import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dmSans, jetbrainsMono } from '@/lib/fonts';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'EveryStack',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
        <body className="font-sans">
          {children}
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
