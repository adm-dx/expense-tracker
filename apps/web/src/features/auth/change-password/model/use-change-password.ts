'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useSessionStore } from '@/entities/session';
import { authApi } from '@/shared/api/auth-api';
import { ApiError } from '@/shared/api/http-client';
import { getErrorMessage } from '@/shared/lib/error';
import type { ChangePasswordFormValues } from './schema';

interface UseChangePasswordOptions {
  onSuccess: () => void;
  /** The server rejected the current password. */
  onWrongPassword: (message: string) => void;
}

export function useChangePassword({
  onSuccess,
  onWrongPassword,
}: UseChangePasswordOptions) {
  const [isPending, setIsPending] = useState(false);

  async function submit(values: ChangePasswordFormValues) {
    setIsPending(true);
    try {
      const tokens = await authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      // Every other session was signed out; this one continues.
      useSessionStore.getState().setTokens(tokens);
      toast.success('Password changed. Other devices have been signed out.');
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        onWrongPassword(getErrorMessage(err));
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsPending(false);
    }
  }

  return { submit, isPending };
}
