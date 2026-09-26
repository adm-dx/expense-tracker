import type { ReactNode } from 'react';
import { AppHeader } from '@/widgets/app-header';
import { AppSidebar } from '@/widgets/app-sidebar';
import { DisplayCurrencySync } from '@/features/currency/select';
import { AuthGuard } from '@/entities/session';

/** Shell for every signed-in page: header on top, navigation on the left. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <DisplayCurrencySync />
      <AppHeader />
      <div className="flex">
        <AppSidebar />
        <main className="min-w-0 flex-1 px-4 py-8">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
