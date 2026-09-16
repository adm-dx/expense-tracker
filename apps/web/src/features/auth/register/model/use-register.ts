'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/entities/session';
import { authApi } from '@/shared/api/auth-api';
import { ApiError } from '@/shared/api/http-client';
import { getErrorMessage } from '@/shared/lib/error';
import type { RegisterFormValues } from './schema';

export function useRegister() {
  const setSession = useSessionStore((state) => state.setSession);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function submit(values: RegisterFormValues) {
    setError(null);
    setIsPending(true);
    try {
      const session = await authApi.register(values);
      setSession(session);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('An account with this email already exists');
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsPending(false);
    }
  }

  return { submit, error, isPending };
}
