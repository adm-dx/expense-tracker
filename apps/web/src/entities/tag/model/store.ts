import type { Tag } from '@expense-tracker/types';
import { useMemo } from 'react';
import { create } from 'zustand';
import { tagsApi } from '@/shared/api/tags-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface TagsState {
  tags: Tag[];
  status: LoadStatus;
  error: string | null;
  /** Loads once; pass `force` to refetch. */
  load: (options?: { force?: boolean }) => Promise<void>;
  reset: () => void;
}

// Guards against a response from a previous session landing after a reset.
let latestRequestId = 0;

export const useTagsStore = create<TagsState>()((set, get) => ({
  tags: [],
  status: 'idle',
  error: null,
  load: async ({ force = false } = {}) => {
    const { status } = get();
    if (status === 'loading' || (status === 'success' && !force)) return;

    const requestId = ++latestRequestId;
    set({ status: 'loading', error: null });
    try {
      const tags = await tagsApi.list();
      if (requestId !== latestRequestId) return;
      set({ tags, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  // Bumping the id drops responses in flight, so they can't refill the store.
  reset: () => {
    latestRequestId++;
    set({ tags: [], status: 'idle', error: null });
  },
}));

registerStoreReset(() => useTagsStore.getState().reset());

export function useTagMap(): Map<string, Tag> {
  const tags = useTagsStore((state) => state.tags);
  return useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
}
