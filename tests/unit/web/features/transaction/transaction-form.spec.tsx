import type { Transaction } from '@expense-tracker/types';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCategoriesStore } from '@web/entities/category/model/store';
import { useCurrencyStore } from '@web/entities/currency/model/store';
import { useTagsStore } from '@web/entities/tag/model/store';
import { TransactionForm } from '@web/features/transaction/upsert/ui/transaction-form';
import { transactionsApi } from '@web/shared/api/transactions-api';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: {
    create: jest.fn(),
    update: jest.fn(),
    list: jest.fn(),
    summary: jest.fn(),
  },
}));
jest.mock('@web/shared/api/tags-api', () => ({ tagsApi: { list: jest.fn() } }));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = transactionsApi as jest.Mocked<typeof transactionsApi>;

const tagged: Transaction = {
  id: 'tx-1',
  amount: '12.50',
  currency: 'EUR',
  type: 'EXPENSE',
  description: 'Lunch',
  date: '2026-09-10T00:00:00.000Z',
  categoryId: 'cat-1',
  tagIds: ['tag-1'],
  createdAt: '2026-09-10T00:00:00.000Z',
};

beforeEach(() => {
  api.update.mockReset().mockResolvedValue(tagged);
  api.list.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 10,
    currency: 'EUR',
    ratesDate: null,
  });
  api.summary.mockResolvedValue({} as never);
  useCurrencyStore.setState({ currency: 'EUR', hasHydrated: true });
  useCategoriesStore.setState({
    categories: [
      {
        id: 'cat-1',
        name: 'Food',
        color: '#22C55E',
        icon: 'utensils',
        transactionCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    status: 'success',
  });
  useTagsStore.setState({
    tags: [
      {
        id: 'tag-1',
        name: 'Trip',
        transactionCount: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    status: 'success',
    error: null,
  });
});

function renderForm(transaction: Transaction = tagged) {
  render(
    <TransactionForm
      transaction={transaction}
      onSuccess={jest.fn()}
      onCancel={jest.fn()}
    />
  );
}

describe('TransactionForm tag', () => {
  it('removes the tag with the × next to it', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Remove tag' }));

    expect(screen.getByRole('combobox', { name: 'Tag' })).toHaveTextContent(
      'No tag'
    );
    expect(
      screen.queryByRole('button', { name: 'Remove tag' })
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('tx-1', { tagIds: [] })
    );
  });

  it('removes the tag by choosing No tag', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('combobox', { name: 'Tag' }));
    await user.click(await screen.findByRole('option', { name: 'No tag' }));
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('tx-1', { tagIds: [] })
    );
  });

  it('has no × without a tag', () => {
    renderForm({ ...tagged, tagIds: [] });

    expect(
      screen.queryByRole('button', { name: 'Remove tag' })
    ).not.toBeInTheDocument();
  });
});
