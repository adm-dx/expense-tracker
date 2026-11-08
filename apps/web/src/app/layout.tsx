import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { CurrencyHydration } from '@/entities/currency';
import { SessionHydration } from '@/entities/session';
import { ThemeHydration } from '@/entities/settings';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { Toaster } from '@/shared/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Track your expenses easily',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set by src/proxy.ts; without it the CSP would block the theme script.
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    // The theme script sets attributes on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        <ThemeHydration />
        <SessionHydration />
        <CurrencyHydration />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
