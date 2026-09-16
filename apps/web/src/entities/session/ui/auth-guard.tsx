'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSessionStore } from '../model/store';

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useSessionStore((state) => state.user);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated && !user) {
      router.replace('/login');
    }
  }, [hasHydrated, user, router]);

  if (!hasHydrated || !user) {
    return <main className="min-h-screen" />;
  }

  return <>{children}</>;
}
