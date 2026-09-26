import type { Category } from '@expense-tracker/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCategoriesStore } from '@web/entities/category';
import { DeleteCategoryDialog } from '@web/features/category/delete';
import { categoriesApi } from '@web/shared/api/categories-api';

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

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: 'cat-1',
    name: 'Food',
    color: '#F97316',
    icon: 'utensils',
    transactionCount: 0,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

const food = makeCategory({});
const other = makeCategory({
  id: 'cat-2',
  name: 'Other',
  icon: 'circle-ellipsis',
});

function renderDialog(category: Category, categories: Category[]) {
  useCategoriesStore.setState({ categories, status: 'success' });
  const onOpenChange = jest.fn();
  render(
    <DeleteCategoryDialog
      open
      onOpenChange={onOpenChange}
      category={category}
    />
  );
  return { onOpenChange };
}

beforeEach(() => {
  jest.clearAllMocks();
  api.remove.mockResolvedValue(undefined);
  api.list.mockResolvedValue([]);
  useCategoriesStore.getState().reset();
});

it('deletes a category without transactions straight away', async () => {
  const user = userEvent.setup();
  renderDialog(food, [food, other]);

  expect(screen.getByText(/It has no transactions/)).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Delete' }));

  expect(api.remove).toHaveBeenCalledWith('cat-1', {});
});

it('asks where to move the transactions before deleting', async () => {
  const user = userEvent.setup();
  const withTransactions = makeCategory({ transactionCount: 2 });
  renderDialog(withTransactions, [withTransactions, other]);

  expect(
    screen.getByText(/Its 2 transactions will be moved/)
  ).toBeInTheDocument();
  const confirm = screen.getByRole('button', { name: 'Move and delete' });
  expect(confirm).toBeDisabled();

  await user.click(
    screen.getByRole('combobox', { name: 'Move transactions to' })
  );
  const options = await screen.findAllByRole('option');
  // The category being deleted is not a target.
  expect(options.map((option) => option.textContent)).toEqual(['Other']);
  await user.click(options[0] as HTMLElement);
  await user.click(confirm);

  expect(api.remove).toHaveBeenCalledWith('cat-1', { reassignTo: 'cat-2' });
});

it('explains that the only category with transactions cannot be deleted', () => {
  const only = makeCategory({ transactionCount: 1 });
  renderDialog(only, [only]);

  expect(screen.getByText(/This is your only category/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Move and delete' })
  ).toBeDisabled();
});
