import type { Metadata } from 'next';
import { CurrencyHydration } from '@/entities/currency';
import { ReportPeriodHydration } from '@/entities/report';
import { SessionHydration } from '@/entities/session';
import { ThemeHydration } from '@/entities/settings';
import { TransactionsPeriodHydration } from '@/entities/transaction';
import { THEME_INIT_SCRIPT } from '@/shared/lib/theme';
import { Toaster } from '@/shared/ui';
import './globals.css';

export const metadata: Metadata = {
  title: 'Expense Tracker',
  description: 'Track your expenses easily',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The theme script sets attributes on <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeHydration />
        <SessionHydration />
        <CurrencyHydration />
        <TransactionsPeriodHydration />
        <ReportPeriodHydration />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
