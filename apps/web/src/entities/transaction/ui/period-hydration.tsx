'use client';

import { useEffect } from 'react';
import { useTransactionsStore } from '../model/store';

/** Reads the stored period of the transactions page back, once per tab. */
export function TransactionsPeriodHydration() {
  useEffect(() => {
    void useTransactionsStore.persist.rehydrate();
  }, []);

  return null;
}
