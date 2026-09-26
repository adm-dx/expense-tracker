'use client';

import { useEffect } from 'react';
import { useCurrencyStore } from '../model/store';

export function CurrencyHydration() {
  useEffect(() => {
    void useCurrencyStore.persist.rehydrate();
  }, []);

  return null;
}
