import type { Category } from '@expense-tracker/types';
import { act, renderHook } from '@testing-library/react';
import { useCategoriesStore } from '@web/entities/category';
import type { CategoryFormValues } from '@web/features/category/upsert/model/schema';
import { useUpsertCategory } from '@web/features/category/upsert/model/use-upsert-category';
import { ApiError } from '@web/shared/api/http-client';
import { categoriesApi } from '@web/shared/api/categories-api';
import { toast } from 'sonner';

jest.mock('@web/shared/api/categories-api', () => ({
  categoriesApi: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = categoriesApi as jest.Mocked<typeof categoriesApi>;

const food: Category = {
  id: 'cat-1',
  name: 'Food',
  color: '#F97316',
  icon: 'utensils',
  transactionCount: 3,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

async function submit(
  values: CategoryFormValues,
  options: Parameters<typeof useUpsertCategory>[0] = {}
) {
  const { result } = renderHook(() => useUpsertCategory(options));
  await act(async () => {
    await result.current.submit(values);
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  api.list.mockResolvedValue([food]);
  api.create.mockResolvedValue(food);
  api.update.mockResolvedValue(food);
  useCategoriesStore.getState().reset();
});

it('creates a category with just the name and the icon', async () => {
  const onSuccess = jest.fn();

  await submit({ name: 'Pets', icon: 'paw-print' }, { onSuccess });

  expect(api.create).toHaveBeenCalledWith({ name: 'Pets', icon: 'paw-print' });
  expect(toast.success).toHaveBeenCalledWith('Category added');
  expect(onSuccess).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledTimes(1);
});

it('sends only the fields that changed', async () => {
  await submit({ name: 'Food', icon: 'pizza' }, { category: food });

  expect(api.update).toHaveBeenCalledWith('cat-1', { icon: 'pizza' });
  expect(toast.success).toHaveBeenCalledWith('Category updated');
});

it('skips the request when nothing changed, but still closes', async () => {
  const onSuccess = jest.fn();

  await submit(
    { name: 'Food', icon: 'utensils' },
    { category: food, onSuccess }
  );

  expect(api.update).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(onSuccess).toHaveBeenCalledTimes(1);
});

it('keeps the dialog open and shows the error on a conflict', async () => {
  const onSuccess = jest.fn();
  api.update.mockRejectedValueOnce(
    new ApiError(409, ['Category with this name already exists'])
  );

  const result = await submit(
    { name: 'Health', icon: 'utensils' },
    { category: food, onSuccess }
  );

  expect(toast.error).toHaveBeenCalledWith(
    'Category with this name already exists'
  );
  expect(onSuccess).not.toHaveBeenCalled();
  expect(api.list).not.toHaveBeenCalled();
  expect(result.current.isPending).toBe(false);
});
