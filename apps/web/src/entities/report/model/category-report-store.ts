import type {
  Currency,
  TransactionSummary,
  TransactionTagReport,
} from '@expense-tracker/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { toIsoDate, toIsoEndOfDay } from '@/shared/lib/format';
import {
  DEFAULT_PERIOD,
  DEFAULT_PERIOD_PRESET,
  restorePeriod,
  type Period,
  type PeriodPreset,
} from '@/shared/lib/period';
import { registerStoreReset } from '@/shared/lib/store-reset';
import {
  onStorageUserChange,
  userLocalStorage,
} from '@/shared/lib/user-storage';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export type ReportGrouping = 'category' | 'tag';

interface CategoryReportState {
  /**
   * The report's own period, independent of the transactions page and
   * persisted per user under its own key.
   */
  period: Period;
  preset: PeriodPreset;
  /** False until the stored period is read back; nothing is fetched before. */
  hasHydrated: boolean;
  /** What the report groups by; `fetch` loads only that one. */
  groupBy: ReportGrouping;
  report: TransactionSummary | null;
  tagReport: TransactionTagReport | null;
  /** Of the last `fetch`, i.e. of the report for `groupBy`. */
  status: LoadStatus;
  error: string | null;
  setPeriod: (period: Period, preset: PeriodPreset) => void;
  setGroupBy: (groupBy: ReportGrouping) => void;
  setHasHydrated: (value: boolean) => void;
  /**
   * Count and total per category or per tag (`groupBy`) for `period`,
   * converted to `currency`.
   */
  fetch: (currency: Currency) => Promise<void>;
  reset: () => void;
}

// Guards against out-of-order responses when the period changes quickly,
// and against responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useCategoryReportStore = create<CategoryReportState>()(
  persist(
    (set, get) => ({
      period: DEFAULT_PERIOD,
      preset: DEFAULT_PERIOD_PRESET,
      hasHydrated: false,
      groupBy: 'category',
      report: null,
      tagReport: null,
      status: 'idle',
      error: null,
      setPeriod: (period, preset) => set({ period, preset }),
      setGroupBy: (groupBy) => set({ groupBy }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      fetch: async (currency) => {
        const { period, groupBy, hasHydrated } = get();
        // Waits for the stored period, so the first load is the one the user
        // left behind instead of this month.
        if (!hasHydrated) return;
        const requestId = ++latestRequestId;
        set({ status: 'loading', error: null });
        const params = {
          dateFrom: toIsoDate(period.dateFrom),
          dateTo: toIsoEndOfDay(period.dateTo),
          currency,
        };
        try {
          if (groupBy === 'tag') {
            const tagReport = await transactionsApi.tagSummary(params);
            if (requestId !== latestRequestId) return;
            set({ tagReport, status: 'success' });
          } else {
            const report = await transactionsApi.summary(params);
            if (requestId !== latestRequestId) return;
            set({ report, status: 'success' });
          }
        } catch (err) {
          if (requestId !== latestRequestId) return;
          set({ status: 'error', error: getErrorMessage(err) });
        }
      },
      // Bumping the id drops responses in flight, so they can't refill the
      // store. The period stays: it is read back for the next user by
      // `onStorageUserChange` below, and resetting it here would overwrite
      // what the previous user left behind.
      reset: () => {
        latestRequestId++;
        set({
          report: null,
          tagReport: null,
          status: 'idle',
          error: null,
        });
      },
    }),
    {
      name: 'report-period',
      storage: createJSONStorage(() => userLocalStorage),
      skipHydration: true,
      partialize: (state) => ({ period: state.period, preset: state.preset }),
      merge: (persisted, current) => ({
        ...current,
        ...restorePeriod(persisted),
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

registerStoreReset(() => useCategoryReportStore.getState().reset());
// The first call comes from the session's own rehydration, so this is also
// what reads the stored period back on page load.
onStorageUserChange(() => void useCategoryReportStore.persist.rehydrate());
