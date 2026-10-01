import type { TransactionSummary } from '@expense-tracker/types';
import { useCategoryReportStore } from '@web/entities/report/model/category-report-store';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { DEFAULT_PERIOD } from '@web/shared/lib/period';
import { resetRegisteredStores } from '@web/shared/lib/store-reset';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { list: jest.fn(), summary: jest.fn() },
}));

const summary = transactionsApi.summary as jest.MockedFunction<
  typeof transactionsApi.summary
>;

const SEPTEMBER = { dateFrom: '2026-09-01', dateTo: '2026-09-30' };

function makeReport(total: string): TransactionSummary {
  return {
    dateFrom: '2026-09-01T00:00:00.000Z',
    dateTo: '2026-09-30T23:59:59.999Z',
    totalIncome: '0.00',
    totalExpense: total,
    balance: `-${total}`,
    byCategory: [
      {
        categoryId: 'cat-1',
        name: 'Groceries',
        color: '#22C55E',
        icon: 'shopping-cart',
        type: 'EXPENSE',
        total,
        count: 2,
      },
    ],
    currency: 'RSD',
    ratesDate: null,
  };
}

beforeEach(() => {
  summary.mockReset();
  useCategoryReportStore.getState().reset();
  useCategoryReportStore.setState({ hasHydrated: true });
  useCategoryReportStore.getState().setPeriod(SEPTEMBER, 'custom');
});

describe('useCategoryReportStore', () => {
  it('asks for its own period in the given currency, to the end of the last day', async () => {
    summary.mockResolvedValue(makeReport('10.00'));

    await useCategoryReportStore.getState().fetch('RSD');

    expect(summary).toHaveBeenCalledWith({
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-30T23:59:59.999Z',
      currency: 'RSD',
    });
    expect(useCategoryReportStore.getState()).toMatchObject({
      report: makeReport('10.00'),
      status: 'success',
    });
  });

  it('records the error message on failure', async () => {
    summary.mockRejectedValue(new Error('boom'));

    await useCategoryReportStore.getState().fetch('EUR');

    expect(useCategoryReportStore.getState()).toMatchObject({
      status: 'error',
      error: 'boom',
    });
  });

  it('keeps the newest response when an older one arrives late', async () => {
    let resolveFirst!: (value: TransactionSummary) => void;
    summary
      .mockReturnValueOnce(new Promise((res) => (resolveFirst = res)))
      .mockResolvedValueOnce(makeReport('20.00'));

    const first = useCategoryReportStore.getState().fetch('EUR');
    await useCategoryReportStore.getState().fetch('EUR');
    resolveFirst(makeReport('99.00'));
    await first;

    expect(useCategoryReportStore.getState().report?.totalExpense).toBe(
      '20.00'
    );
  });

  it('is cleared with the session and drops a response in flight', async () => {
    let resolve!: (value: TransactionSummary) => void;
    summary.mockReturnValueOnce(new Promise((res) => (resolve = res)));

    const pending = useCategoryReportStore.getState().fetch('EUR');
    resetRegisteredStores();
    resolve(makeReport('10.00'));
    await pending;

    expect(useCategoryReportStore.getState()).toMatchObject({
      report: null,
      status: 'idle',
      period: DEFAULT_PERIOD,
      preset: 'this-month',
    });
  });
});

describe('persisted period', () => {
  const STORAGE_KEY = 'report-period';

  beforeEach(() => {
    localStorage.clear();
  });

  it('writes its period under its own key', () => {
    useCategoryReportStore
      .getState()
      .setPeriod({ dateFrom: '2026-03-04', dateTo: '2026-05-06' }, 'custom');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      state: {
        period: { dateFrom: '2026-03-04', dateTo: '2026-05-06' },
        preset: 'custom',
      },
      version: 0,
    });
  });

  it('restores a stored custom range and flags hydration', async () => {
    useCategoryReportStore.setState({ hasHydrated: false });
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          period: { dateFrom: '2026-03-04', dateTo: '2026-05-06' },
          preset: 'custom',
        },
        version: 0,
      })
    );

    await useCategoryReportStore.persist.rehydrate();

    expect(useCategoryReportStore.getState()).toMatchObject({
      period: { dateFrom: '2026-03-04', dateTo: '2026-05-06' },
      preset: 'custom',
      hasHydrated: true,
    });
  });

  it('fetches nothing before the stored period is read back', async () => {
    useCategoryReportStore.setState({ hasHydrated: false });

    await useCategoryReportStore.getState().fetch('EUR');

    expect(summary).not.toHaveBeenCalled();
    expect(useCategoryReportStore.getState().status).toBe('idle');
  });
});
