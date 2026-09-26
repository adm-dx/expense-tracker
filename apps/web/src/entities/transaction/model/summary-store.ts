import type { TransactionSummary } from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { toIsoDate, toIsoEndOfDay } from '@/shared/lib/format';
import { registerStoreReset } from '@/shared/lib/store-reset';
import { useTransactionsStore } from './store';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface SummaryState {
  summary: TransactionSummary | null;
  status: LoadStatus;
  error: string | null;
  /** Totals for the period and currency held by `useTransactionsStore`. */
  fetch: () => Promise<void>;
  reset: () => void;
}

// Guards against out-of-order responses when the period changes quickly,
// and against responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useSummaryStore = create<SummaryState>()((set) => ({
  summary: null,
  status: 'idle',
  error: null,
  fetch: async () => {
    const { period, currency } = useTransactionsStore.getState();
    if (currency === null) return;
    const requestId = ++latestRequestId;
    set({ status: 'loading', error: null });
    try {
      const summary = await transactionsApi.summary({
        dateFrom: toIsoDate(period.dateFrom),
        dateTo: toIsoEndOfDay(period.dateTo),
        currency,
      });
      if (requestId !== latestRequestId) return;
      set({ summary, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  // Bumping the id drops responses in flight, so they can't refill the store.
  reset: () => {
    latestRequestId++;
    set({ summary: null, status: 'idle', error: null });
  },
}));

registerStoreReset(() => useSummaryStore.getState().reset());
