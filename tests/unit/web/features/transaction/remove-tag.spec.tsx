import type { Tag, Transaction } from '@expense-tracker/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  useSummaryStore,
  useTransactionsStore,
} from '@web/entities/transaction';
import { TransactionTagBadge } from '@web/features/transaction/remove-tag';
import { ApiError } from '@web/shared/api/http-client';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { update: jest.fn(), list: jest.fn(), summary: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = transactionsApi as jest.Mocked<typeof transactionsApi>;

const transaction: Transaction = {
  id: 'tx-1',
  amount: '12.50',
  currency: 'EUR',
  type: 'EXPENSE',
  description: null,
  date: '2026-09-10T00:00:00.000Z',
  categoryId: 'cat-1',
  tagIds: ['tag-1', 'tag-2'],
  createdAt: '2026-09-10T00:00:00.000Z',
};

const tag: Tag = {
  id: 'tag-1',
  name: 'Trip',
  transactionCount: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let fetchTransactions: jest.SpyInstance;
let fetchSummary: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  fetchTransactions = jest
    .spyOn(useTransactionsStore.getState(), 'fetch')
    .mockResolvedValue();
  fetchSummary = jest
    .spyOn(useSummaryStore.getState(), 'fetch')
    .mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function clickRemove() {
  const user = userEvent.setup();
  render(<TransactionTagBadge transaction={transaction} tag={tag} />);
  await user.click(screen.getByRole('button', { name: 'Remove tag Trip' }));
}

describe('TransactionTagBadge', () => {
  it('takes only that tag off and reloads the table and the summary', async () => {
    api.update.mockResolvedValue({ ...transaction, tagIds: ['tag-2'] });

    await clickRemove();

    await waitFor(() => expect(fetchSummary).toHaveBeenCalled());
    expect(api.update).toHaveBeenCalledWith('tx-1', { tagIds: ['tag-2'] });
    expect(toast.success).toHaveBeenCalledWith('Tag removed');
    expect(fetchTransactions).toHaveBeenCalled();
  });

  it('shows the error and reloads nothing on failure', async () => {
    api.update.mockRejectedValue(new Error('boom'));

    await clickRemove();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('boom'));
    expect(fetchTransactions).not.toHaveBeenCalled();
  });

  it('just resyncs when the transaction is already gone', async () => {
    api.update.mockRejectedValue(new ApiError(404, ['Transaction not found']));

    await clickRemove();

    await waitFor(() => expect(fetchTransactions).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
  });
});
