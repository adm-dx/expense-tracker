'use client';

import { useEffect } from 'react';
import { useCurrencyStore } from '@/entities/currency';
import { useTransactionsStore } from '@/entities/transaction';

/**
 * Feeds the persisted display currency into the transaction stores, which
 * can't import `entities/currency` themselves. Waits for hydration, so the
 * first fetch already uses the stored currency instead of the default.
 */
export function DisplayCurrencySync() {
  const currency = useCurrencyStore((state) => state.currency);
  const hasHydrated = useCurrencyStore((state) => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated) useTransactionsStore.getState().setCurrency(currency);
  }, [currency, hasHydrated]);

  return null;
}
