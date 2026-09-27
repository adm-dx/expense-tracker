'use client';

import { DEFAULT_CURRENCY, type Currency } from '@expense-tracker/types';
import { useState } from 'react';
import { toast } from 'sonner';
import { useSettingsStore } from '@/entities/settings';
import { useSummaryStore, useTransactionsStore } from '@/entities/transaction';
import { getErrorMessage } from '@/shared/lib/error';

export function useRemoveCurrency(options: { onSuccess?: () => void }) {
  const removeCurrency = useSettingsStore((state) => state.removeCurrency);
  const [isPending, setIsPending] = useState(false);

  /** Disables the currency; the server converts its transactions to RSD. */
  async function remove(code: Currency) {
    setIsPending(true);
    try {
      const { convertedCount } = await removeCurrency(code);
      toast.success(
        convertedCount > 0
          ? `${code} removed, ${convertedCount} ${
              convertedCount === 1 ? 'transaction' : 'transactions'
            } converted to ${DEFAULT_CURRENCY}`
          : `${code} removed`
      );
      options.onSuccess?.();
      if (convertedCount > 0) {
        void useTransactionsStore.getState().fetch();
        void useSummaryStore.getState().fetch();
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  }

  return { remove, isPending };
}
