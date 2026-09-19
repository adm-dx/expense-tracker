import type { TransactionSummary } from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { toIsoDate } from '@/shared/lib/format';
import { useTransactionsStore } from './store';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface SummaryState {
  summary: TransactionSummary | null;
  status: LoadStatus;
  error: string | null;
  /** Totals for the period held by `useTransactionsStore`. */
  fetch: () => Promise<void>;
  reset: () => void;
}

// Guards against out-of-order responses when the period changes quickly.
let latestRequestId = 0;

export const useSummaryStore = create<SummaryState>()((set) => ({
  summary: null,
  status: 'idle',
  error: null,
  fetch: async () => {
    const requestId = ++latestRequestId;
    const { period } = useTransactionsStore.getState();
    set({ status: 'loading', error: null });
    try {
      const summary = await transactionsApi.summary({
        dateFrom: toIsoDate(period.dateFrom),
        dateTo: toIsoDate(period.dateTo),
      });
      if (requestId !== latestRequestId) return;
      set({ summary, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  reset: () => set({ summary: null, status: 'idle', error: null }),
}));
