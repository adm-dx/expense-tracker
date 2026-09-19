'use client';

import { useRouter } from 'next/navigation';
import { useSessionStore } from '@/entities/session';
import { authApi } from '@/shared/api/auth-api';

export function useLogout() {
  const router = useRouter();

  async function logout() {
    const { refreshToken, clearSession } = useSessionStore.getState();
    if (refreshToken) {
      try {
        await authApi.logout({ refreshToken });
      } catch {
        // best-effort: clear the local session regardless of API outcome
      }
    }
    // clearSession also resets the category/transaction/summary stores.
    clearSession();
    router.replace('/login');
  }

  return { logout };
}
