'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { ApiError } from '@/shared/api/http-client';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';

function resync() {
  void useTransactionsStore.getState().fetch();
  void useSummaryStore.getState().fetch();
}

/** Takes a tag off a transaction, keeping its other tags. */
export function useRemoveTransactionTag() {
  const [isPending, setIsPending] = useState(false);

  async function remove(
    transaction: { id: string; tagIds: string[] },
    tagId: string
  ) {
    setIsPending(true);
    try {
      await transactionsApi.update(transaction.id, {
        tagIds: transaction.tagIds.filter((id) => id !== tagId),
      });
      toast.success('Tag removed');
      resync();
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // The transaction is gone (e.g. deleted in another tab).
        resync();
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsPending(false);
    }
  }

  return { remove, isPending };
}
