import type { Category } from '@expense-tracker/types';
import { useCategoriesStore } from '@web/entities/category/model/store';
import { categoriesApi } from '@web/shared/api/categories-api';

jest.mock('@web/shared/api/categories-api', () => ({
  categoriesApi: { list: jest.fn() },
}));

const list = categoriesApi.list as jest.MockedFunction<
  typeof categoriesApi.list
>;

function makeCategory(id: string): Category {
  return {
    id,
    name: `Category ${id}`,
    color: '#22C55E',
    icon: 'wallet',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  list.mockReset();
  useCategoriesStore.getState().reset();
});

describe('useCategoriesStore', () => {
  it('loads the categories once', async () => {
    list.mockResolvedValue([makeCategory('a')]);

    await useCategoriesStore.getState().load();
    await useCategoriesStore.getState().load();

    expect(list).toHaveBeenCalledTimes(1);
    expect(useCategoriesStore.getState()).toMatchObject({
      categories: [makeCategory('a')],
      status: 'success',
    });
  });

  it('refetches when forced', async () => {
    list.mockResolvedValue([makeCategory('a')]);
    await useCategoriesStore.getState().load();

    list.mockResolvedValue([makeCategory('a'), makeCategory('b')]);
    await useCategoriesStore.getState().load({ force: true });

    expect(list).toHaveBeenCalledTimes(2);
    expect(useCategoriesStore.getState().categories).toHaveLength(2);
  });

  it('does not start a second request while one is in flight', async () => {
    let resolve!: (value: Category[]) => void;
    list.mockReturnValueOnce(new Promise((res) => (resolve = res)));

    const first = useCategoriesStore.getState().load();
    const second = useCategoriesStore.getState().load();
    resolve([makeCategory('a')]);
    await Promise.all([first, second]);

    expect(list).toHaveBeenCalledTimes(1);
  });

  it('records the error message on failure and can be retried', async () => {
    list.mockRejectedValueOnce(new Error('offline'));
    await useCategoriesStore.getState().load();

    expect(useCategoriesStore.getState()).toMatchObject({
      status: 'error',
      error: 'offline',
    });

    list.mockResolvedValueOnce([makeCategory('a')]);
    await useCategoriesStore.getState().load();

    expect(useCategoriesStore.getState().status).toBe('success');
  });

  it('drops a response that lands after reset()', async () => {
    let resolve!: (value: Category[]) => void;
    list.mockReturnValueOnce(new Promise((res) => (resolve = res)));

    const inFlight = useCategoriesStore.getState().load();
    useCategoriesStore.getState().reset();
    resolve([makeCategory('previous-user')]);
    await inFlight;

    expect(useCategoriesStore.getState()).toMatchObject({
      categories: [],
      status: 'idle',
    });
  });
});
