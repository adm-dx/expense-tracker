import type { Metadata } from 'next';
import { SessionHydration } from '@/entities/session';
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
    <html lang="en">
      <body>
        <SessionHydration />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
