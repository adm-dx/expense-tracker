import type { ExchangeRates } from '@expense-tracker/types';
import { create } from 'zustand';
import { exchangeRatesApi } from '@/shared/api/exchange-rates-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface ExchangeRatesState {
  rates: ExchangeRates | null;
  status: LoadStatus;
  error: string | null;
  /** Loads once; a failed load is retried on the next call. */
  load: () => Promise<void>;
  reset: () => void;
}

// Drops responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useExchangeRatesStore = create<ExchangeRatesState>()(
  (set, get) => ({
    rates: null,
    status: 'idle',
    error: null,
    load: async () => {
      const { status } = get();
      if (status === 'loading' || status === 'success') return;
      const requestId = ++latestRequestId;
      set({ status: 'loading', error: null });
      try {
        const rates = await exchangeRatesApi.get();
        if (requestId !== latestRequestId) return;
        set({ rates, status: 'success' });
      } catch (err) {
        if (requestId !== latestRequestId) return;
        set({ status: 'error', error: getErrorMessage(err) });
      }
    },
    reset: () => {
      latestRequestId++;
      set({ rates: null, status: 'idle', error: null });
    },
  })
);

registerStoreReset(() => useExchangeRatesStore.getState().reset());
