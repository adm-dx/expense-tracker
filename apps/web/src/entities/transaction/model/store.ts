import {
  TRANSACTION_PAGE_SIZES,
  type Transaction,
  type TransactionPageSize,
} from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { toIsoDate } from '@/shared/lib/format';
import {
  DEFAULT_PERIOD,
  DEFAULT_PERIOD_PRESET,
  type Period,
  type PeriodPreset,
} from '@/shared/lib/period';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface TransactionsState {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: TransactionPageSize;
  /** Shared by the table and the summary widgets. */
  period: Period;
  preset: PeriodPreset;
  status: LoadStatus;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (pageSize: TransactionPageSize) => void;
  setPeriod: (period: Period, preset: PeriodPreset) => void;
  /** Fetches the current page; call after any mutation to resync. */
  fetch: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE: TransactionPageSize = TRANSACTION_PAGE_SIZES[0];

// Guards against out-of-order responses when page/pageSize change quickly.
let latestRequestId = 0;

export const useTransactionsStore = create<TransactionsState>()((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  period: DEFAULT_PERIOD,
  preset: DEFAULT_PERIOD_PRESET,
  status: 'idle',
  error: null,
  setPage: (page) => set({ page: Math.max(1, page) }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setPeriod: (period, preset) => set({ period, preset, page: 1 }),
  fetch: async () => {
    const requestId = ++latestRequestId;
    const { page, pageSize, period } = get();
    set({ status: 'loading', error: null });
    try {
      const result = await transactionsApi.list({
        page,
        pageSize,
        dateFrom: toIsoDate(period.dateFrom),
        dateTo: toIsoDate(period.dateTo),
      });
      if (requestId !== latestRequestId) return;

      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      if (result.items.length === 0 && page > lastPage) {
        // The page emptied out (e.g. its last row was deleted): step back.
        // Subscribers to `page` trigger the refetch.
        set({ page: lastPage });
        return;
      }
      set({ items: result.items, total: result.total, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  reset: () =>
    set({
      items: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      period: DEFAULT_PERIOD,
      preset: DEFAULT_PERIOD_PRESET,
      status: 'idle',
      error: null,
    }),
}));
