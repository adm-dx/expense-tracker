import type { Transaction } from '@expense-tracker/types';
import { useTransactionsStore } from '@web/entities/transaction/model/store';
import { transactionsApi } from '@web/shared/api/transactions-api';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { list: jest.fn() },
}));

const list = transactionsApi.list as jest.MockedFunction<
  typeof transactionsApi.list
>;

function makeTransaction(id: string): Transaction {
  return {
    id,
    amount: '12.50',
    type: 'EXPENSE',
    description: null,
    date: '2026-09-10T00:00:00.000Z',
    categoryId: 'cat-1',
    createdAt: '2026-09-10T00:00:00.000Z',
  };
}

function page(items: Transaction[], total: number, pageNumber = 1) {
  return { items, total, page: pageNumber, pageSize: 10 };
}

/** A promise settled by hand, to control when a response "arrives". */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const SEPTEMBER = { dateFrom: '2026-09-01', dateTo: '2026-09-30' };

beforeEach(() => {
  list.mockReset();
  useTransactionsStore.getState().reset();
  useTransactionsStore.setState({ period: SEPTEMBER, preset: 'this-month' });
});

describe('useTransactionsStore', () => {
  describe('paging and period', () => {
    it('starts on page 1 with 10 rows per page', () => {
      const { page: current, pageSize } = useTransactionsStore.getState();

      expect(current).toBe(1);
      expect(pageSize).toBe(10);
    });

    it('setPageSize goes back to the first page', () => {
      useTransactionsStore.getState().setPage(4);

      useTransactionsStore.getState().setPageSize(50);

      expect(useTransactionsStore.getState()).toMatchObject({
        pageSize: 50,
        page: 1,
      });
    });

    it('setPeriod stores the preset and goes back to the first page', () => {
      useTransactionsStore.getState().setPage(3);

      useTransactionsStore
        .getState()
        .setPeriod(
          { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
          'last-month'
        );

      expect(useTransactionsStore.getState()).toMatchObject({
        page: 1,
        preset: 'last-month',
        period: { dateFrom: '2026-08-01', dateTo: '2026-08-31' },
      });
    });

    it('never goes below page 1', () => {
      useTransactionsStore.getState().setPage(-2);

      expect(useTransactionsStore.getState().page).toBe(1);
    });
  });

  describe('fetch', () => {
    it('requests the period from midnight to the end of its last day', async () => {
      list.mockResolvedValue(page([], 0));

      await useTransactionsStore.getState().fetch();

      expect(list).toHaveBeenCalledWith({
        page: 1,
        pageSize: 10,
        dateFrom: '2026-09-01T00:00:00.000Z',
        dateTo: '2026-09-30T23:59:59.999Z',
      });
    });

    it('stores the rows and total on success', async () => {
      list.mockResolvedValue(page([makeTransaction('t1')], 1));

      await useTransactionsStore.getState().fetch();

      expect(useTransactionsStore.getState()).toMatchObject({
        items: [makeTransaction('t1')],
        total: 1,
        status: 'success',
        error: null,
      });
    });

    it('records the error message on failure', async () => {
      list.mockRejectedValue(new Error('boom'));

      await useTransactionsStore.getState().fetch();

      expect(useTransactionsStore.getState()).toMatchObject({
        status: 'error',
        error: 'boom',
      });
    });

    it('steps back to the last page and reloads when the page emptied out', async () => {
      // 20 rows in total: page 3 no longer exists, page 2 is the last one.
      useTransactionsStore.setState({ page: 3 });
      list
        .mockResolvedValueOnce(page([], 20, 3))
        .mockResolvedValueOnce(page([makeTransaction('t9')], 20, 2));

      await useTransactionsStore.getState().fetch();

      expect(list).toHaveBeenCalledTimes(2);
      expect(list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 })
      );
      expect(useTransactionsStore.getState()).toMatchObject({
        page: 2,
        items: [makeTransaction('t9')],
        status: 'success',
      });
    });

    it('stays on page 1 when there is simply no data', async () => {
      list.mockResolvedValue(page([], 0));

      await useTransactionsStore.getState().fetch();

      expect(list).toHaveBeenCalledTimes(1);
      expect(useTransactionsStore.getState()).toMatchObject({
        page: 1,
        items: [],
        status: 'success',
      });
    });
  });

  describe('stale responses', () => {
    it('keeps the newest response when an older one arrives late', async () => {
      const first = deferred<ReturnType<typeof page>>();
      const second = deferred<ReturnType<typeof page>>();
      list
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);

      const firstFetch = useTransactionsStore.getState().fetch();
      const secondFetch = useTransactionsStore.getState().fetch();
      second.resolve(page([makeTransaction('new')], 1));
      await secondFetch;
      first.resolve(page([makeTransaction('old')], 1));
      await firstFetch;

      expect(useTransactionsStore.getState().items).toEqual([
        makeTransaction('new'),
      ]);
    });

    it('drops a response that lands after reset()', async () => {
      const pending = deferred<ReturnType<typeof page>>();
      list.mockReturnValueOnce(pending.promise);

      const inFlight = useTransactionsStore.getState().fetch();
      useTransactionsStore.getState().reset();
      pending.resolve(page([makeTransaction('previous-user')], 1));
      await inFlight;

      expect(useTransactionsStore.getState()).toMatchObject({
        items: [],
        total: 0,
        status: 'idle',
      });
    });
  });

  describe('reset', () => {
    it('restores paging and the default period', () => {
      useTransactionsStore.setState({
        page: 5,
        pageSize: 50,
        items: [makeTransaction('t1')],
      });

      useTransactionsStore.getState().reset();

      expect(useTransactionsStore.getState()).toMatchObject({
        page: 1,
        pageSize: 10,
        items: [],
        total: 0,
        preset: 'this-month',
        status: 'idle',
      });
    });
  });
});
