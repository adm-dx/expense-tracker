'use client';

import { useRouter } from 'next/navigation';
import { useCategoriesStore } from '@/entities/category';
import { useSessionStore } from '@/entities/session';
import { useTransactionsStore } from '@/entities/transaction';
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
    clearSession();
    useTransactionsStore.getState().reset();
    useCategoriesStore.getState().reset();
    router.replace('/login');
  }

  return { logout };
}
