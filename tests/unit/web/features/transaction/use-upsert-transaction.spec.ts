import { renderHook, act } from '@testing-library/react';
import type { Transaction } from '@expense-tracker/types';
import {
  useSummaryStore,
  useTransactionsStore,
} from '@web/entities/transaction';
import { useUpsertTransaction } from '@web/features/transaction/upsert/model/use-upsert-transaction';
import type { TransactionFormValues } from '@web/features/transaction/upsert/model/schema';
import { ApiError } from '@web/shared/api/http-client';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: {
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    summary: jest.fn(),
  },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = transactionsApi as jest.Mocked<typeof transactionsApi>;

const existing: Transaction = {
  id: 'tx-1',
  amount: '12.50',
  currency: 'RSD',
  type: 'EXPENSE',
  description: 'Lunch',
  date: '2026-09-10T00:00:00.000Z',
  categoryId: 'cat-1',
  createdAt: '2026-09-10T00:00:00.000Z',
};

/** The form values that match `existing` exactly. */
const unchanged: TransactionFormValues = {
  type: 'EXPENSE',
  categoryId: 'cat-1',
  amount: '12.50',
  currency: 'RSD',
  date: '2026-09-10',
  description: 'Lunch',
};

async function submit(
  values: TransactionFormValues,
  options: Parameters<typeof useUpsertTransaction>[0] = {}
) {
  const { result } = renderHook(() => useUpsertTransaction(options));
  await act(async () => {
    await result.current.submit(values);
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.create.mockResolvedValue(existing);
  api.update.mockResolvedValue(existing);
  api.list.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    currency: 'RSD',
    ratesDate: null,
  });
  api.summary.mockResolvedValue({
    dateFrom: '2026-09-01T00:00:00.000Z',
    dateTo: '2026-09-30T23:59:59.999Z',
    totalIncome: '0.00',
    totalExpense: '0.00',
    balance: '0.00',
    byCategory: [],
    currency: 'RSD',
    ratesDate: null,
  });
  useTransactionsStore.getState().reset();
  useTransactionsStore.getState().setCurrency('RSD');
  useSummaryStore.getState().reset();
});

describe('creating', () => {
  it('sends the form as a new transaction, with the date at UTC midnight', async () => {
    await submit({
      type: 'INCOME',
      categoryId: 'cat-9',
      amount: '1000',
      currency: 'EUR',
      date: '2026-09-16',
      description: 'Salary',
    });

    expect(api.create).toHaveBeenCalledWith({
      type: 'INCOME',
      categoryId: 'cat-9',
      amount: 1000,
      currency: 'EUR',
      date: '2026-09-16T00:00:00.000Z',
      description: 'Salary',
    });
    expect(toast.success).toHaveBeenCalledWith('Transaction added');
  });

  it('leaves out an empty description rather than sending an empty string', async () => {
    await submit({ ...unchanged, description: '' });

    expect(api.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ description: expect.anything() })
    );
  });

  it('reloads the table and the summary cards afterwards', async () => {
    await submit(unchanged);

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.summary).toHaveBeenCalledTimes(1);
  });

  it('closes the dialog through onSuccess', async () => {
    const onSuccess = jest.fn();

    await submit(unchanged, { onSuccess });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('editing', () => {
  it('sends only the fields that actually changed', async () => {
    await submit({ ...unchanged, amount: '99.99' }, { transaction: existing });

    expect(api.update).toHaveBeenCalledWith('tx-1', { amount: 99.99 });
    expect(toast.success).toHaveBeenCalledWith('Transaction updated');
  });

  it.each([
    ['the type', { type: 'INCOME' as const }, { type: 'INCOME' }],
    ['the category', { categoryId: 'cat-2' }, { categoryId: 'cat-2' }],
    ['the currency', { currency: 'HUF' as const }, { currency: 'HUF' }],
    ['the date', { date: '2026-09-11' }, { date: '2026-09-11T00:00:00.000Z' }],
    ['the description', { description: 'Dinner' }, { description: 'Dinner' }],
  ])('sends %s on its own', async (_label, change, expected) => {
    await submit({ ...unchanged, ...change }, { transaction: existing });

    expect(api.update).toHaveBeenCalledWith('tx-1', expected);
  });

  it('clears the description with null rather than an empty string', async () => {
    await submit({ ...unchanged, description: '' }, { transaction: existing });

    expect(api.update).toHaveBeenCalledWith('tx-1', { description: null });
  });

  it('treats 12.50 and 12.5 as the same amount', async () => {
    await submit({ ...unchanged, amount: '12.5' }, { transaction: existing });

    expect(api.update).not.toHaveBeenCalled();
  });

  it('sends nothing at all when the form is untouched', async () => {
    const onSuccess = jest.fn();

    await submit(unchanged, { transaction: existing, onSuccess });

    expect(api.update).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    // The dialog still closes, and the table still resyncs.
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('sends several changed fields together', async () => {
    await submit(
      { ...unchanged, amount: '1', type: 'INCOME', categoryId: 'cat-3' },
      { transaction: existing }
    );

    expect(api.update).toHaveBeenCalledWith('tx-1', {
      amount: 1,
      type: 'INCOME',
      categoryId: 'cat-3',
    });
  });

  it('keeps a description that was already null', async () => {
    await submit(
      { ...unchanged, description: '' },
      { transaction: { ...existing, description: null } }
    );

    expect(api.update).not.toHaveBeenCalled();
  });
});

describe('failures', () => {
  it('shows the API message and neither closes the dialog nor reloads', async () => {
    const onSuccess = jest.fn();
    api.create.mockRejectedValueOnce(new ApiError(404, ['Category not found']));

    await submit(unchanged, { onSuccess });

    expect(toast.error).toHaveBeenCalledWith('Category not found');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('stops showing progress once the request settles', async () => {
    api.create.mockRejectedValueOnce(new Error('offline'));

    const result = await submit(unchanged);

    expect(result.current.isPending).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('offline');
  });
});
