import {
  TRANSACTION_PAGE_SIZES,
  type Currency,
  type TransactionListItem,
  type TransactionPageSize,
} from '@expense-tracker/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';
import {
  onStorageUserChange,
  userLocalStorage,
} from '@/shared/lib/user-storage';
import { toIsoDate, toIsoEndOfDay } from '@/shared/lib/format';
import {
  DEFAULT_PERIOD,
  DEFAULT_PERIOD_PRESET,
  restorePeriod,
  type Period,
  type PeriodPreset,
} from '@/shared/lib/period';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface TransactionsState {
  items: TransactionListItem[];
  total: number;
  page: number;
  /** Rows per page; persisted per user, like the period. */
  pageSize: TransactionPageSize;
  /**
   * Shared by the table and the summary widgets; persisted per user, so it
   * survives reloads and signing out and back in.
   */
  period: Period;
  preset: PeriodPreset;
  /** False until the stored period is read back; nothing is fetched before. */
  hasHydrated: boolean;
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
  setHasHydrated: (value: boolean) => void;
  /** Fetches the current page; call after any mutation to resync. */
  fetch: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE: TransactionPageSize = TRANSACTION_PAGE_SIZES[0];

/**
 * Reads back the persisted rows-per-page, falling back to the default for
 * anything that isn't one of the offered sizes (hand-edited storage, a size
 * dropped from the list).
 */
function restorePageSize(value: unknown): TransactionPageSize {
  const stored = (value as { pageSize?: unknown } | null | undefined)?.pageSize;
  const size = TRANSACTION_PAGE_SIZES.find((option) => option === stored);
  return size ?? DEFAULT_PAGE_SIZE;
}

// Guards against out-of-order responses when page/pageSize change quickly,
// and against responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useTransactionsStore = create<TransactionsState>()(
  persist(
    (set, get) => ({
      items: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      period: DEFAULT_PERIOD,
      preset: DEFAULT_PERIOD_PRESET,
      hasHydrated: false,
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
      setHasHydrated: (value) => set({ hasHydrated: value }),
      fetch: async () => {
        const { page, pageSize, period, currency, hasHydrated } = get();
        // Waits for the stored period and currency, so the first load is the
        // one the user left behind instead of this month in EUR.
        if (currency === null || !hasHydrated) return;
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
            // The page emptied out (e.g. its last row was deleted): step back
            // and reload, so the store recovers without relying on a mounted
            // view.
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
      // Keeps `currency` (a device preference, not the user's data) and the
      // persisted period and page size: those are read back for the next
      // user by `onStorageUserChange` below, and resetting them here would
      // overwrite what the previous user left behind.
      reset: () => {
        latestRequestId++;
        set({
          items: [],
          total: 0,
          page: 1,
          itemsCurrency: null,
          ratesDate: null,
          status: 'idle',
          error: null,
        });
      },
    }),
    {
      name: 'transactions-period',
      storage: createJSONStorage(() => userLocalStorage),
      skipHydration: true,
      partialize: (state) => ({
        period: state.period,
        preset: state.preset,
        pageSize: state.pageSize,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...restorePeriod(persisted),
        pageSize: restorePageSize(persisted),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

registerStoreReset(() => useTransactionsStore.getState().reset());
// The first call comes from the session's own rehydration, so this is also
// what reads the stored period back on page load.
onStorageUserChange(() => void useTransactionsStore.persist.rehydrate());
