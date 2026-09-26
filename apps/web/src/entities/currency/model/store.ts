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
 * The display currency on screen. The user's `currency` setting on the server
 * is the source of truth (`features/settings/sync` copies it here); this
 * persisted copy only lets the first render after a reload use it before the
 * settings arrive. Deliberately not registered with `registerStoreReset`, so
 * the cache survives sign-out until the next user's settings replace it.
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
