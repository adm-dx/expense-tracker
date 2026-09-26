import {
  TRANSACTION_PAGE_SIZES,
  type Currency,
  type TransactionListItem,
  type TransactionPageSize,
} from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';
import { toIsoDate, toIsoEndOfDay } from '@/shared/lib/format';
import {
  DEFAULT_PERIOD,
  DEFAULT_PERIOD_PRESET,
  type Period,
  type PeriodPreset,
} from '@/shared/lib/period';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface TransactionsState {
  items: TransactionListItem[];
  total: number;
  page: number;
  pageSize: TransactionPageSize;
  /** Shared by the table and the summary widgets. */
  period: Period;
  preset: PeriodPreset;
  /**
   * Display currency, shared with the summary. Null until the persisted
   * choice is synced in, so nothing is fetched in the wrong currency first.
   */
  currency: Currency | null;
  /**
   * The currency `items[].convertedAmount` is in. Lags behind `currency`
   * until the refetch lands, so stale rows are never labelled with a new code.
   */
  itemsCurrency: Currency | null;
  /** Date of the rates behind `convertedAmount`; null if none were needed. */
  ratesDate: string | null;
  status: LoadStatus;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (pageSize: TransactionPageSize) => void;
  setPeriod: (period: Period, preset: PeriodPreset) => void;
  setCurrency: (currency: Currency) => void;
  /** Fetches the current page; call after any mutation to resync. */
  fetch: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE: TransactionPageSize = TRANSACTION_PAGE_SIZES[0];

// Guards against out-of-order responses when page/pageSize change quickly,
// and against responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useTransactionsStore = create<TransactionsState>()((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  period: DEFAULT_PERIOD,
  preset: DEFAULT_PERIOD_PRESET,
  currency: null,
  itemsCurrency: null,
  ratesDate: null,
  status: 'idle',
  error: null,
  setPage: (page) => set({ page: Math.max(1, page) }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setPeriod: (period, preset) => set({ period, preset, page: 1 }),
  // The row count doesn't depend on the currency, so the page stays put.
  setCurrency: (currency) => set({ currency }),
  fetch: async () => {
    const { page, pageSize, period, currency } = get();
    if (currency === null) return;
    const requestId = ++latestRequestId;
    set({ status: 'loading', error: null });
    try {
      const result = await transactionsApi.list({
        page,
        pageSize,
        dateFrom: toIsoDate(period.dateFrom),
        dateTo: toIsoEndOfDay(period.dateTo),
        currency,
      });
      if (requestId !== latestRequestId) return;

      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      if (result.items.length === 0 && page > lastPage) {
        // The page emptied out (e.g. its last row was deleted): step back and
        // reload, so the store recovers without relying on a mounted view.
        set({ page: lastPage });
        await get().fetch();
        return;
      }
      set({
        items: result.items,
        total: result.total,
        itemsCurrency: result.currency,
        ratesDate: result.ratesDate,
        status: 'success',
      });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  // Keeps `currency`: it's a device preference, not the signed-in user's data.
  reset: () => {
    latestRequestId++;
    set({
      items: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      period: DEFAULT_PERIOD,
      preset: DEFAULT_PERIOD_PRESET,
      itemsCurrency: null,
      ratesDate: null,
      status: 'idle',
      error: null,
    });
  },
}));

registerStoreReset(() => useTransactionsStore.getState().reset());
