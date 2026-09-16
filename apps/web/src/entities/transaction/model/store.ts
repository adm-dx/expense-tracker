import {
  TRANSACTION_PAGE_SIZES,
  type Transaction,
  type TransactionPageSize,
} from '@expense-tracker/types';
import { create } from 'zustand';
import { transactionsApi } from '@/shared/api/transactions-api';
import { getErrorMessage } from '@/shared/lib/error';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

interface TransactionsState {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: TransactionPageSize;
  status: LoadStatus;
  error: string | null;
  setPage: (page: number) => void;
  setPageSize: (pageSize: TransactionPageSize) => void;
  /** Fetches the current page; call after any mutation to resync. */
  fetch: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE: TransactionPageSize = TRANSACTION_PAGE_SIZES[0];

// Guards against out-of-order responses when page/pageSize change quickly.
let latestRequestId = 0;

export const useTransactionsStore = create<TransactionsState>()((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  status: 'idle',
  error: null,
  setPage: (page) => set({ page: Math.max(1, page) }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  fetch: async () => {
    const requestId = ++latestRequestId;
    const { page, pageSize } = get();
    set({ status: 'loading', error: null });
    try {
      const result = await transactionsApi.list({ page, pageSize });
      if (requestId !== latestRequestId) return;

      const lastPage = Math.max(1, Math.ceil(result.total / pageSize));
      if (result.items.length === 0 && page > lastPage) {
        // The page emptied out (e.g. its last row was deleted): step back.
        // Subscribers to `page` trigger the refetch.
        set({ page: lastPage });
        return;
      }
      set({ items: result.items, total: result.total, status: 'success' });
    } catch (err) {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', error: getErrorMessage(err) });
    }
  },
  reset: () =>
    set({
      items: [],
      total: 0,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
      status: 'idle',
      error: null,
    }),
}));
