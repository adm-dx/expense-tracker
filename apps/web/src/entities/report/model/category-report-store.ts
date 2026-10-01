import type { Currency, TransactionSummary } from '@expense-tracker/types';
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

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface CategoryReportState {
  /**
   * The report's own period, independent of the transactions page and
   * persisted under its own key.
   */
  period: Period;
  preset: PeriodPreset;
  /** False until the stored period is read back; nothing is fetched before. */
  hasHydrated: boolean;
  report: TransactionSummary | null;
  status: LoadStatus;
  error: string | null;
  setPeriod: (period: Period, preset: PeriodPreset) => void;
  setHasHydrated: (value: boolean) => void;
  /** Count and total per category for `period`, converted to `currency`. */
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
      report: null,
      status: 'idle',
      error: null,
      setPeriod: (period, preset) => set({ period, preset }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      fetch: async (currency) => {
        const { period, hasHydrated } = get();
        // Waits for the stored period, so the first load is the one the user
        // left behind instead of this month.
        if (!hasHydrated) return;
        const requestId = ++latestRequestId;
        set({ status: 'loading', error: null });
        try {
          const report = await transactionsApi.summary({
            dateFrom: toIsoDate(period.dateFrom),
            dateTo: toIsoEndOfDay(period.dateTo),
            currency,
          });
          if (requestId !== latestRequestId) return;
          set({ report, status: 'success' });
        } catch (err) {
          if (requestId !== latestRequestId) return;
          set({ status: 'error', error: getErrorMessage(err) });
        }
      },
      // Bumping the id drops responses in flight, so they can't refill the
      // store. `hasHydrated` stays: storage is read once per tab.
      reset: () => {
        latestRequestId++;
        set({
          period: DEFAULT_PERIOD,
          preset: DEFAULT_PERIOD_PRESET,
          report: null,
          status: 'idle',
          error: null,
        });
      },
    }),
    {
      name: 'report-period',
      storage: createJSONStorage(() => localStorage),
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
