import type { TransactionSummary } from '@expense-tracker/types';
import { useTransactionsStore } from '@web/entities/transaction/model/store';
import { useSummaryStore } from '@web/entities/transaction/model/summary-store';
import { transactionsApi } from '@web/shared/api/transactions-api';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { list: jest.fn(), summary: jest.fn() },
}));

const summary = transactionsApi.summary as jest.MockedFunction<
  typeof transactionsApi.summary
>;

function makeSummary(totalExpense: string): TransactionSummary {
  return {
    dateFrom: '2026-09-01T00:00:00.000Z',
    dateTo: '2026-09-30T23:59:59.999Z',
    totalIncome: '0.00',
    totalExpense,
    balance: `-${totalExpense}`,
    byCategory: [],
    currency: 'RSD',
    ratesDate: null,
  };
}

beforeEach(() => {
  summary.mockReset();
  useSummaryStore.getState().reset();
  useTransactionsStore.getState().reset();
  useTransactionsStore.setState({
    period: { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
    currency: 'RSD',
  });
});

describe('useSummaryStore', () => {
  it('asks for the period held by the transactions store, to the end of its last day', async () => {
    summary.mockResolvedValue(makeSummary('10.00'));

    await useSummaryStore.getState().fetch();

    expect(summary).toHaveBeenCalledWith({
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-30T23:59:59.999Z',
      currency: 'RSD',
    });
    expect(useSummaryStore.getState()).toMatchObject({
      summary: makeSummary('10.00'),
      status: 'success',
    });
  });

  it('records the error message on failure', async () => {
    summary.mockRejectedValue(new Error('boom'));

    await useSummaryStore.getState().fetch();

    expect(useSummaryStore.getState()).toMatchObject({
      status: 'error',
      error: 'boom',
    });
  });

  it('keeps the newest response when an older one arrives late', async () => {
    let resolveFirst!: (value: TransactionSummary) => void;
    summary
      .mockReturnValueOnce(new Promise((res) => (resolveFirst = res)))
      .mockResolvedValueOnce(makeSummary('20.00'));

    const first = useSummaryStore.getState().fetch();
    await useSummaryStore.getState().fetch();
    resolveFirst(makeSummary('99.00'));
    await first;

    expect(useSummaryStore.getState().summary?.totalExpense).toBe('20.00');
  });

  it('drops a response that lands after reset()', async () => {
    let resolve!: (value: TransactionSummary) => void;
    summary.mockReturnValueOnce(new Promise((res) => (resolve = res)));

    const inFlight = useSummaryStore.getState().fetch();
    useSummaryStore.getState().reset();
    resolve(makeSummary('99.00'));
    await inFlight;

    expect(useSummaryStore.getState()).toMatchObject({
      summary: null,
      status: 'idle',
    });
  });

  it('does not fetch before the currency is synced in', async () => {
    useTransactionsStore.setState({ currency: null });

    await useSummaryStore.getState().fetch();

    expect(summary).not.toHaveBeenCalled();
  });

  it('asks for the currency held by the transactions store', async () => {
    summary.mockResolvedValue(makeSummary('10.00'));
    useTransactionsStore.getState().setCurrency('HUF');

    await useSummaryStore.getState().fetch();

    expect(summary).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'HUF' })
    );
  });
});
