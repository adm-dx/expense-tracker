import type { Currency, TransactionSummary } from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { toIsoDate, toIsoEndOfDay } from '@/shared/lib/format';
import {
  DEFAULT_PERIOD,
  DEFAULT_PERIOD_PRESET,
  type Period,
  type PeriodPreset,
} from '@/shared/lib/period';
import { registerStoreReset } from '@/shared/lib/store-reset';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface CategoryReportState {
  /** The report's own period, independent of the transactions page. */
  period: Period;
  preset: PeriodPreset;
  report: TransactionSummary | null;
  status: LoadStatus;
  error: string | null;
  setPeriod: (period: Period, preset: PeriodPreset) => void;
  /** Count and total per category for `period`, converted to `currency`. */
  fetch: (currency: Currency) => Promise<void>;
  reset: () => void;
}

// Guards against out-of-order responses when the period changes quickly,
// and against responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useCategoryReportStore = create<CategoryReportState>()(
  (set, get) => ({
    period: DEFAULT_PERIOD,
    preset: DEFAULT_PERIOD_PRESET,
    report: null,
    status: 'idle',
    error: null,
    setPeriod: (period, preset) => set({ period, preset }),
    fetch: async (currency) => {
      const { period } = get();
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
    // Bumping the id drops responses in flight, so they can't refill the store.
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
  })
);

registerStoreReset(() => useCategoryReportStore.getState().reset());
