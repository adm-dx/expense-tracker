import type { Currency, TagHistoryReport } from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';
import { registerStoreReset } from '@/shared/lib/store-reset';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface TagReportState {
  /**
   * The tag shown, null until one is chosen. Not persisted, and cleared with
   * the session: an id means nothing to the next user.
   */
  tagId: string | null;
  /** Always of `tagId`; another tag's is dropped when it changes. */
  report: TagHistoryReport | null;
  status: LoadStatus;
  error: string | null;
  setTagId: (tagId: string | null) => void;
  /** Income and expense of `tagId` per month over all time, in `currency`. */
  fetch: (currency: Currency) => Promise<void>;
  reset: () => void;
}

// Guards against out-of-order responses when the tag changes quickly, and
// against responses from a previous session landing after a reset.
let latestRequestId = 0;

export const useTagReportStore = create<TagReportState>()((set, get) => ({
  tagId: null,
  report: null,
  status: 'idle',
  error: null,
  setTagId: (tagId) => {
    if (tagId === get().tagId) return;
    // Bumping the id drops the previous tag's response in flight.
    latestRequestId++;
    set({ tagId, report: null, status: 'idle', error: null });
  },
  fetch: async (currency) => {
    const { tagId } = get();
    if (tagId === null) return;
    const requestId = ++latestRequestId;
    set({ status: 'loading', error: null });
    try {
      const report = await transactionsApi.tagHistory({ tagId, currency });
      if (requestId !== latestRequestId) return;
      set({ report, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  reset: () => {
    latestRequestId++;
    set({ tagId: null, report: null, status: 'idle', error: null });
  },
}));

registerStoreReset(() => useTagReportStore.getState().reset());
