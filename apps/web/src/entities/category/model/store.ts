import type { Category } from '@expense-tracker/types';
import { useMemo } from 'react';
import { create } from 'zustand';
import { categoriesApi } from '@/shared/api/categories-api';
import { getErrorMessage } from '@/shared/lib/error';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface CategoriesState {
  categories: Category[];
  status: LoadStatus;
  error: string | null;
  /** Loads once; pass `force` to refetch. */
  load: (options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
}

export const useCategoriesStore = create<CategoriesState>()((set, get) => ({
  categories: [],
  status: 'idle',
  error: null,
  load: async ({ force = false } = {}) => {
    const { status } = get();
    if (status === 'loading' || (status === 'success' && !force)) return;

    set({ status: 'loading', error: null });
    try {
      const categories = await categoriesApi.list();
      set({ categories, status: 'success' });
    } catch (err) {
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  reset: () => set({ categories: [], status: 'idle', error: null }),
}));

export function useCategoryMap(): Map<string, Category> {
  const categories = useCategoriesStore((state) => state.categories);
  return useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
}
