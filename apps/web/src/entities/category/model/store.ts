import type { Category } from '@expense-tracker/types';
import { useMemo } from 'react';
import { create } from 'zustand';
import { categoriesApi } from '@/shared/api/categories-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface CategoriesState {
  categories: Category[];
  status: LoadStatus;
  error: string | null;
  /** Loads once; pass `force` to refetch. */
  load: (options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
}

// Guards against a response from a previous session landing after a reset.
let latestRequestId = 0;

export const useCategoriesStore = create<CategoriesState>()((set, get) => ({
  categories: [],
  status: 'idle',
  error: null,
  load: async ({ force = false } = {}) => {
    const { status } = get();
    if (status === 'loading' || (status === 'success' && !force)) return;

    const requestId = ++latestRequestId;
    set({ status: 'loading', error: null });
    try {
      const categories = await categoriesApi.list();
      if (requestId !== latestRequestId) return;
      set({ categories, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  // Bumping the id drops responses in flight, so they can't refill the store.
  reset: () => {
    latestRequestId++;
    set({ categories: [], status: 'idle', error: null });
  },
}));

registerStoreReset(() => useCategoriesStore.getState().reset());

export function useCategoryMap(): Map<string, Category> {
  const categories = useCategoriesStore((state) => state.categories);
  return useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
}
