'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useCategoriesStore } from '@/entities/category';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { categoriesApi } from '@/shared/api/categories-api';
import { ApiError } from '@/shared/api/http-client';
import { getErrorMessage } from '@/shared/lib/error';

function resync(options: { transactions: boolean }) {
  void useCategoriesStore.getState().load({ force: true });
  if (options.transactions) {
    // Moved transactions now point at another category.
    void useTransactionsStore.getState().fetch();
    void useSummaryStore.getState().fetch();
  }
}

export function useDeleteCategory(options: { onSuccess?: () => void }) {
  const [isPending, setIsPending] = useState(false);

  /** Deletes the category, first moving its transactions to `reassignTo` if given. */
  async function remove(id: string, reassignTo?: string) {
    setIsPending(true);
    try {
      await categoriesApi.remove(id, reassignTo ? { reassignTo } : {});
      toast.success('Category deleted');
      options.onSuccess?.();
      resync({ transactions: reassignTo !== undefined });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Gone already (e.g. deleted in another tab), or so is the target.
        toast.error(getErrorMessage(err));
        options.onSuccess?.();
        resync({ transactions: true });
      } else {
        // A 409 means transactions were added meanwhile: the reload shows
        // them, so the dialog can offer to move them.
        toast.error(getErrorMessage(err));
        if (err instanceof ApiError && err.status === 409) {
          resync({ transactions: false });
        }
      }
    } finally {
      setIsPending(false);
    }
  }

  return { remove, isPending };
}
