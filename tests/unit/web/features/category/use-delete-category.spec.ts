import { act, renderHook } from '@testing-library/react';
import { useCategoriesStore } from '@web/entities/category';
import {
  useSummaryStore,
  useTransactionsStore,
} from '@web/entities/transaction';
import { useDeleteCategory } from '@web/features/category/delete/model/use-delete-category';
import { categoriesApi } from '@web/shared/api/categories-api';
import { ApiError } from '@web/shared/api/http-client';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/categories-api', () => ({
  categoriesApi: { list: jest.fn(), remove: jest.fn() },
}));
jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { list: jest.fn(), summary: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = categoriesApi as jest.Mocked<typeof categoriesApi>;
const txApi = transactionsApi as jest.Mocked<typeof transactionsApi>;

async function remove(
  args: [string, string?],
  options: Parameters<typeof useDeleteCategory>[0] = {}
) {
  const { result } = renderHook(() => useDeleteCategory(options));
  await act(async () => {
    await result.current.remove(...args);
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.remove.mockResolvedValue(undefined);
  api.list.mockResolvedValue([]);
  txApi.list.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    currency: 'RSD',
    ratesDate: null,
  });
  txApi.summary.mockResolvedValue({
    dateFrom: '2026-09-01T00:00:00.000Z',
    dateTo: '2026-09-30T23:59:59.999Z',
    totalIncome: '0.00',
    totalExpense: '0.00',
    balance: '0.00',
    byCategory: [],
    currency: 'RSD',
    ratesDate: null,
  });
  useCategoriesStore.getState().reset();
  useTransactionsStore.getState().reset();
  useTransactionsStore.getState().setCurrency('RSD');
  useSummaryStore.getState().reset();
});

it('deletes an empty category and reloads only the categories', async () => {
  const onSuccess = jest.fn();

  await remove(['cat-1'], { onSuccess });

  expect(api.remove).toHaveBeenCalledWith('cat-1', {});
  expect(toast.success).toHaveBeenCalledWith('Category deleted');
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(txApi.list).not.toHaveBeenCalled();
});

it('moves the transactions, then reloads the transactions and the summary', async () => {
  await remove(['cat-1', 'cat-2']);

  expect(api.remove).toHaveBeenCalledWith('cat-1', { reassignTo: 'cat-2' });
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(txApi.list).toHaveBeenCalledTimes(1);
  expect(txApi.summary).toHaveBeenCalledTimes(1);
});

it('on a 409 keeps the dialog open and reloads the counts', async () => {
  // Transactions were added since the list was loaded.
  const onSuccess = jest.fn();
  api.remove.mockRejectedValueOnce(
    new ApiError(409, ['Category has transactions and cannot be deleted'])
  );

  const result = await remove(['cat-1'], { onSuccess });

  expect(toast.error).toHaveBeenCalledWith(
    'Category has transactions and cannot be deleted'
  );
  expect(onSuccess).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(result.current.isPending).toBe(false);
});

it('on a 404 closes the dialog and resyncs everything', async () => {
  const onSuccess = jest.fn();
  api.remove.mockRejectedValueOnce(new ApiError(404, ['Category not found']));

  await remove(['cat-1', 'cat-2'], { onSuccess });

  expect(toast.error).toHaveBeenCalledWith('Category not found');
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(txApi.list).toHaveBeenCalledTimes(1);
});

it('keeps the dialog open on a network failure', async () => {
  const onSuccess = jest.fn();
  api.remove.mockRejectedValueOnce(new Error('offline'));

  await remove(['cat-1'], { onSuccess });

  expect(toast.error).toHaveBeenCalledWith('offline');
  expect(onSuccess).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
});
