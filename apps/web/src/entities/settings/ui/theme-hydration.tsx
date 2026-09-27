'use client';

import { useLayoutEffect } from 'react';
import { applyTheme, readCachedTheme } from '@/shared/lib/theme';

/**
 * The inline script in the root layout paints the cached theme before React
 * loads. This takes over from it: it starts following the OS for `system`,
 * and repaints after Strict Mode's dev remount strips <html> of the
 * attributes the script set.
 */
export function ThemeHydration() {
  useLayoutEffect(() => {
    applyTheme(readCachedTheme());
  }, []);

  return null;
}
