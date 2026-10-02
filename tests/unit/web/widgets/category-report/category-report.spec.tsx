import type {
  TransactionCategorySummary,
  TransactionSummary,
} from '@expense-tracker/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCurrencyStore } from '@web/entities/currency/model/store';
import { useCategoryReportStore } from '@web/entities/report/model/category-report-store';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { CategoryReport } from '@web/widgets/category-report';
import { buildReportRows } from '@web/widgets/category-report/lib/report-rows';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { list: jest.fn(), summary: jest.fn() },
}));

// jsdom lays nothing out, so Recharts would draw an empty box; the chart gets
// the same rows as the table, which is what's asserted here.
jest.mock('@web/widgets/category-report/ui/category-report-chart', () => ({
  CategoryReportChart: ({
    rows,
    metric,
  }: {
    rows: { name: string }[];
    metric: string;
  }) => (
    <p data-testid="chart">
      {metric}: {rows.map((row) => row.name).join(', ')}
    </p>
  ),
}));

const summary = transactionsApi.summary as jest.MockedFunction<
  typeof transactionsApi.summary
>;

function category(
  name: string,
  type: TransactionCategorySummary['type'],
  total: string,
  count: number
): TransactionCategorySummary {
  return {
    categoryId: `cat-${name}`,
    name,
    color: '#22C55E',
    icon: 'shopping-cart',
    type,
    total,
    count,
  };
}

const BY_CATEGORY = [
  category('Rent', 'EXPENSE', '600.00', 1),
  category('Groceries', 'EXPENSE', '300.00', 12),
  category('Transport', 'EXPENSE', '100.00', 4),
  category('Salary', 'INCOME', '2000.00', 1),
];

function makeReport(
  byCategory: TransactionCategorySummary[] = BY_CATEGORY
): TransactionSummary {
  return {
    dateFrom: '2026-09-01T00:00:00.000Z',
    dateTo: '2026-09-30T23:59:59.999Z',
    totalIncome: '2000.00',
    totalExpense: '1000.00',
    balance: '1000.00',
    byCategory,
    currency: 'EUR',
    ratesDate: null,
  };
}

beforeEach(() => {
  summary.mockReset();
  useCategoryReportStore.getState().reset();
  useCategoryReportStore.setState({ hasHydrated: true });
  useCurrencyStore.setState({ currency: 'EUR', hasHydrated: true });
});

function tableRows() {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .map((row) => row.textContent);
}

describe('buildReportRows', () => {
  it('keeps one type, sorts by the metric and computes shares', () => {
    const { rows, totals } = buildReportRows(BY_CATEGORY, 'EXPENSE', 'count');

    expect(rows.map((row) => [row.name, row.count, row.share])).toEqual([
      ['Groceries', 12, 30],
      ['Transport', 4, 10],
      ['Rent', 1, 60],
    ]);
    expect(totals).toEqual({ amount: 1000, count: 17 });
  });

  it('adds totals in cents, without float drift', () => {
    const { totals } = buildReportRows(
      [
        category('A', 'EXPENSE', '0.10', 1),
        category('B', 'EXPENSE', '0.20', 1),
      ],
      'EXPENSE',
      'amount'
    );

    expect(totals.amount).toBe(0.3);
  });
});

describe('CategoryReport', () => {
  it('loads the report in the display currency once it is hydrated', async () => {
    useCurrencyStore.setState({ currency: 'RSD', hasHydrated: false });
    summary.mockResolvedValue(makeReport());
    const { rerender } = render(<CategoryReport />);

    expect(summary).not.toHaveBeenCalled();

    useCurrencyStore.setState({ hasHydrated: true });
    rerender(<CategoryReport />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(summary).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'RSD' })
    );
  });

  it('shows expenses by amount with counts, shares and a total', async () => {
    summary.mockResolvedValue(makeReport());
    render(<CategoryReport />);

    await screen.findByRole('table');

    expect(screen.getByTestId('chart')).toHaveTextContent(
      'amount: Rent, Groceries, Transport'
    );
    expect(tableRows()).toEqual([
      'CategoryTransactionsAmountShare',
      'Rent1600.00 EUR (€)60%',
      'Groceries12300.00 EUR (€)30%',
      'Transport4100.00 EUR (€)10%',
      'Total171,000.00 EUR (€)',
    ]);
  });

  it('switches to income and to sorting by count', async () => {
    const user = userEvent.setup();
    summary.mockResolvedValue(makeReport());
    render(<CategoryReport />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('radio', { name: 'Count' }));
    expect(screen.getByTestId('chart')).toHaveTextContent(
      'count: Groceries, Transport, Rent'
    );

    await user.click(screen.getByRole('radio', { name: 'Income' }));
    expect(screen.getByTestId('chart')).toHaveTextContent('count: Salary');
    expect(tableRows()).toHaveLength(3);
  });

  it('says so when the period has nothing of the chosen type', async () => {
    summary.mockResolvedValue(
      makeReport([category('Salary', 'INCOME', '2000.00', 1)])
    );
    render(<CategoryReport />);

    expect(
      await screen.findByText('No expenses in this period.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    summary
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce(makeReport());
    render(<CategoryReport />);

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(summary).toHaveBeenCalledTimes(2);
  });

  it('refetches when its period changes', async () => {
    const user = userEvent.setup();
    summary.mockResolvedValue(makeReport());
    render(<CategoryReport />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('combobox', { name: 'Period' }));
    await user.click(await screen.findByRole('option', { name: 'This year' }));

    expect(summary).toHaveBeenCalledTimes(2);
    expect(useCategoryReportStore.getState().preset).toBe('this-year');
  });
});
