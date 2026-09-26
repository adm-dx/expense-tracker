'use client';

import { useEffect } from 'react';
import { useCurrencyStore } from '@/entities/currency';
import { useSettingsStore } from '@/entities/settings';
import { applyTheme, cacheTheme } from '@/shared/lib/theme';

/**
 * Loads the signed-in user's settings and puts them to work: paints the
 * theme (and caches it for the next page load) and feeds the currency to the
 * display currency store, which the rest of the app reads.
 */
export function SettingsSync() {
  const theme = useSettingsStore((state) => state.settings?.theme);
  const colorScheme = useSettingsStore((state) => state.settings?.colorScheme);
  const currency = useSettingsStore((state) => state.settings?.currency);

  useEffect(() => {
    void useSettingsStore.getState().load();
  }, []);

  useEffect(() => {
    if (!theme || !colorScheme) return;
    const selection = { theme, colorScheme };
    applyTheme(selection);
    cacheTheme(selection);
  }, [theme, colorScheme]);

  useEffect(() => {
    if (currency) useCurrencyStore.getState().setCurrency(currency);
  }, [currency]);

  return null;
}
