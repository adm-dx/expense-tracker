import { renderHook, act } from '@testing-library/react';
import {
  useSummaryStore,
  useTransactionsStore,
} from '@web/entities/transaction';
import { useDeleteTransaction } from '@web/features/transaction/delete/model/use-delete-transaction';
import { ApiError } from '@web/shared/api/http-client';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: {
    remove: jest.fn(),
    list: jest.fn(),
    summary: jest.fn(),
  },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = transactionsApi as jest.Mocked<typeof transactionsApi>;

async function remove(
  id: string,
  options: Parameters<typeof useDeleteTransaction>[0] = {}
) {
  const { result } = renderHook(() => useDeleteTransaction(options));
  await act(async () => {
    await result.current.remove(id);
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.remove.mockResolvedValue(undefined);
  api.list.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
  api.summary.mockResolvedValue({
    dateFrom: '2026-09-01T00:00:00.000Z',
    dateTo: '2026-09-30T23:59:59.999Z',
    totalIncome: '0.00',
    totalExpense: '0.00',
    balance: '0.00',
    byCategory: [],
  });
  useTransactionsStore.getState().reset();
  useSummaryStore.getState().reset();
});

it('deletes, confirms, closes the dialog and reloads both views', async () => {
  const onSuccess = jest.fn();

  await remove('tx-1', { onSuccess });

  expect(api.remove).toHaveBeenCalledWith('tx-1');
  expect(toast.success).toHaveBeenCalledWith('Transaction deleted');
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(api.summary).toHaveBeenCalledTimes(1);
});

it('treats a 404 as already deleted: no error, just a resync', async () => {
  // Another tab (or a stale table) can delete the same row first.
  const onSuccess = jest.fn();
  api.remove.mockRejectedValueOnce(
    new ApiError(404, ['Transaction not found'])
  );

  await remove('tx-1', { onSuccess });

  expect(toast.error).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(api.summary).toHaveBeenCalledTimes(1);
});

it.each([
  ['a server error', new ApiError(500, ['Internal server error'])],
  ['a network failure', new Error('offline')],
])('keeps the dialog open on %s', async (_label, error) => {
  const onSuccess = jest.fn();
  api.remove.mockRejectedValueOnce(error);

  const result = await remove('tx-1', { onSuccess });

  expect(toast.error).toHaveBeenCalledWith(
    error instanceof ApiError ? error.messages[0] : 'offline'
  );
  expect(onSuccess).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
  expect(result.current.isPending).toBe(false);
});

it('stops showing progress after a successful delete', async () => {
  const result = await remove('tx-1');

  expect(result.current.isPending).toBe(false);
});
