import type { TagHistoryReport } from '@expense-tracker/types';
import { useTagReportStore } from '@web/entities/report/model/tag-report-store';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { resetRegisteredStores } from '@web/shared/lib/store-reset';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { tagHistory: jest.fn() },
}));

const tagHistory = transactionsApi.tagHistory as jest.MockedFunction<
  typeof transactionsApi.tagHistory
>;

function makeReport(tagId: string, totalExpense = '10.00'): TagHistoryReport {
  return {
    tagId,
    totalIncome: '0.00',
    totalExpense,
    balance: `-${totalExpense}`,
    byMonth: [
      {
        month: '2026-09',
        income: '0.00',
        expense: totalExpense,
        incomeCount: 0,
        expenseCount: 1,
      },
    ],
    currency: 'RSD',
    ratesDate: null,
  };
}

beforeEach(() => {
  tagHistory.mockReset();
  useTagReportStore.getState().reset();
});

describe('useTagReportStore', () => {
  it('fetches nothing until a tag is chosen', async () => {
    await useTagReportStore.getState().fetch('EUR');

    expect(tagHistory).not.toHaveBeenCalled();
    expect(useTagReportStore.getState().status).toBe('idle');
  });

  it('asks for the chosen tag in the given currency', async () => {
    tagHistory.mockResolvedValue(makeReport('tag-1'));
    useTagReportStore.getState().setTagId('tag-1');

    await useTagReportStore.getState().fetch('RSD');

    expect(tagHistory).toHaveBeenCalledWith({
      tagId: 'tag-1',
      currency: 'RSD',
    });
    expect(useTagReportStore.getState()).toMatchObject({
      report: makeReport('tag-1'),
      status: 'success',
    });
  });

  it('records the error message on failure', async () => {
    tagHistory.mockRejectedValue(new Error('boom'));
    useTagReportStore.getState().setTagId('tag-1');

    await useTagReportStore.getState().fetch('EUR');

    expect(useTagReportStore.getState()).toMatchObject({
      status: 'error',
      error: 'boom',
    });
  });

  it("drops the previous tag's report, and its response in flight, on a change", async () => {
    let resolveFirst!: (value: TagHistoryReport) => void;
    tagHistory.mockReturnValueOnce(new Promise((res) => (resolveFirst = res)));
    useTagReportStore.getState().setTagId('tag-1');
    const first = useTagReportStore.getState().fetch('EUR');

    useTagReportStore.getState().setTagId('tag-2');
    resolveFirst(makeReport('tag-1'));
    await first;

    expect(useTagReportStore.getState()).toMatchObject({
      tagId: 'tag-2',
      report: null,
      status: 'idle',
    });
  });

  it('is cleared with the session, tag included, and drops a response in flight', async () => {
    let resolve!: (value: TagHistoryReport) => void;
    tagHistory.mockReturnValueOnce(new Promise((res) => (resolve = res)));
    useTagReportStore.getState().setTagId('tag-1');

    const pending = useTagReportStore.getState().fetch('EUR');
    resetRegisteredStores();
    resolve(makeReport('tag-1'));
    await pending;

    expect(useTagReportStore.getState()).toMatchObject({
      tagId: null,
      report: null,
      status: 'idle',
    });
  });
});
