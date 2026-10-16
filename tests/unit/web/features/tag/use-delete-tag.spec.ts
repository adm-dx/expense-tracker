import { act, renderHook } from '@testing-library/react';
import { useTagsStore } from '@web/entities/tag';
import {
  useSummaryStore,
  useTransactionsStore,
} from '@web/entities/transaction';
import { useDeleteTag } from '@web/features/tag/delete/model/use-delete-tag';
import { ApiError } from '@web/shared/api/http-client';
import { tagsApi } from '@web/shared/api/tags-api';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/tags-api', () => ({
  tagsApi: { list: jest.fn(), remove: jest.fn() },
}));
jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { list: jest.fn(), summary: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = tagsApi as jest.Mocked<typeof tagsApi>;
const txApi = transactionsApi as jest.Mocked<typeof transactionsApi>;

async function remove(
  id: string,
  options: Parameters<typeof useDeleteTag>[0] = {}
) {
  const { result } = renderHook(() => useDeleteTag(options));
  await act(async () => {
    await result.current.remove(id);
  });
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
  useTagsStore.getState().reset();
  useTransactionsStore.getState().reset();
  useTransactionsStore.setState({ hasHydrated: true, currency: 'RSD' });
  useSummaryStore.getState().reset();
});

describe('useDeleteTag', () => {
  it('deletes, closes, and reloads the tags, the table and the summary', async () => {
    const onSuccess = jest.fn();

    await remove('tag-1', { onSuccess });

    expect(api.remove).toHaveBeenCalledWith('tag-1');
    expect(toast.success).toHaveBeenCalledWith('Tag deleted');
    expect(onSuccess).toHaveBeenCalled();
    expect(api.list).toHaveBeenCalled();
    expect(txApi.list).toHaveBeenCalled();
    expect(txApi.summary).toHaveBeenCalled();
  });

  it('drops the table filter on the deleted tag, but not on another one', async () => {
    useTransactionsStore.getState().setTagId('tag-1');
    await remove('tag-2');
    expect(useTransactionsStore.getState().tagId).toBe('tag-1');

    await remove('tag-1');
    expect(useTransactionsStore.getState().tagId).toBeNull();
    expect(txApi.list.mock.calls.at(-1)?.[0]).not.toHaveProperty('tagId');
  });

  it('closes and resyncs when the tag is already gone', async () => {
    const onSuccess = jest.fn();
    api.remove.mockRejectedValue(new ApiError(404, ['Tag not found']));

    await remove('tag-1', { onSuccess });

    expect(toast.error).toHaveBeenCalledWith('Tag not found');
    expect(onSuccess).toHaveBeenCalled();
    expect(api.list).toHaveBeenCalled();
  });

  it('keeps the dialog open on another failure', async () => {
    const onSuccess = jest.fn();
    api.remove.mockRejectedValue(new Error('Network down'));

    await remove('tag-1', { onSuccess });

    expect(toast.error).toHaveBeenCalledWith('Network down');
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
