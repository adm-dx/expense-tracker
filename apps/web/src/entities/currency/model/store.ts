import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type Currency,
} from '@expense-tracker/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface CurrencyState {
  /** The currency every amount on screen is converted to. */
  currency: Currency;
  hasHydrated: boolean;
  setCurrency: (currency: Currency) => void;
  setHasHydrated: (value: boolean) => void;
}

function isCurrency(value: unknown): value is Currency {
  return (CURRENCIES as readonly unknown[]).includes(value);
}

/**
 * A device preference, not user data: deliberately not registered with
 * `registerStoreReset`, so it survives sign-out and sign-in.
 */
export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: DEFAULT_CURRENCY,
      hasHydrated: false,
      setCurrency: (currency) => set({ currency }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'display-currency',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ currency: state.currency }),
      // Anything stored by hand or by an older version falls back to RSD.
      merge: (persisted, current) => {
        const stored = (persisted as { currency?: unknown } | undefined)
          ?.currency;
        return {
          ...current,
          currency: isCurrency(stored) ? stored : DEFAULT_CURRENCY,
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
