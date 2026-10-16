'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useTagsStore } from '@/entities/tag';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { tagsApi } from '@/shared/api/tags-api';
import { ApiError } from '@/shared/api/http-client';
import { getErrorMessage } from '@/shared/lib/error';

function resync(tagId: string) {
  void useTagsStore.getState().load({ force: true });
  const transactions = useTransactionsStore.getState();
  // A filter on a tag that is gone would match nothing.
  if (transactions.tagId === tagId) transactions.setTagId(null);
  // Its transactions lost the tag.
  void useTransactionsStore.getState().fetch();
  void useSummaryStore.getState().fetch();
}

export function useDeleteTag(options: { onSuccess?: () => void }) {
  const [isPending, setIsPending] = useState(false);

  /** Deletes the tag; the API strips it from its transactions. */
  async function remove(id: string) {
    setIsPending(true);
    try {
      await tagsApi.remove(id);
      toast.success('Tag deleted');
      options.onSuccess?.();
      resync(id);
    } catch (err) {
      toast.error(getErrorMessage(err));
      // Gone already, e.g. deleted in another tab.
      if (err instanceof ApiError && err.status === 404) {
        options.onSuccess?.();
        resync(id);
      }
    } finally {
      setIsPending(false);
    }
  }

  return { remove, isPending };
}
