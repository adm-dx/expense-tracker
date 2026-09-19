'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { transactionsApi } from '@/shared/api/transactions-api';
import { ApiError } from '@/shared/api/http-client';
import { getErrorMessage } from '@/shared/lib/error';

export function useDeleteTransaction(options: { onSuccess?: () => void }) {
  const [isPending, setIsPending] = useState(false);

  async function remove(id: string) {
    setIsPending(true);
    try {
      await transactionsApi.remove(id);
      toast.success('Transaction deleted');
      options.onSuccess?.();
      void useTransactionsStore.getState().fetch();
      void useSummaryStore.getState().fetch();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Already gone (e.g. deleted in another tab): just resync the table.
        options.onSuccess?.();
        void useTransactionsStore.getState().fetch();
        void useSummaryStore.getState().fetch();
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsPending(false);
    }
  }

  return { remove, isPending };
}
