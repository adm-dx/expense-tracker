'use client';

import Link from 'next/link';
import { useSessionStore } from '@/entities/session';
import { authApi } from '@/shared/api/auth-api';
import { Button } from '@/shared/ui';

export default function Home() {
  const user = useSessionStore((state) => state.user);
  const refreshToken = useSessionStore((state) => state.refreshToken);
  const hasHydrated = useSessionStore((state) => state.hasHydrated);
  const clearSession = useSessionStore((state) => state.clearSession);

  async function handleLogout() {
    if (refreshToken) {
      try {
        await authApi.logout({ refreshToken });
      } catch {
        // best-effort: clear the local session regardless of API outcome
      }
    }
    clearSession();
  }

  if (!hasHydrated) {
    return <main className="min-h-screen" />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Expense Tracker</h1>
        <p className="text-gray-600">Your personal finance management tool</p>
      </div>
      {user ? (
        <div className="flex flex-col items-center gap-3">
          <p>Welcome, {user.name}</p>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      ) : (
        <div className="flex gap-3">
          <Button asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">Register</Link>
          </Button>
        </div>
      )}
    </main>
  );
}
