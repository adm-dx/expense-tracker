import type { TagHistoryReport, TagMonthSummary } from '@expense-tracker/types';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCurrencyStore } from '@web/entities/currency/model/store';
import { useTagReportStore } from '@web/entities/report/model/tag-report-store';
import { useTagsStore } from '@web/entities/tag/model/store';
import { transactionsApi } from '@web/shared/api/transactions-api';
import { TagReport } from '@web/widgets/tag-report';
import { formatMonth } from '@web/widgets/tag-report/lib/month';

jest.mock('@web/shared/api/transactions-api', () => ({
  transactionsApi: { tagHistory: jest.fn() },
}));

jest.mock('@web/shared/api/tags-api', () => ({
  tagsApi: { list: jest.fn() },
}));

// jsdom lays nothing out, so Recharts would draw an empty box; the chart gets
// every month, gaps included, which is what's asserted here.
jest.mock('@web/widgets/tag-report/ui/tag-report-chart', () => ({
  TagReportChart: ({ months }: { months: TagMonthSummary[] }) => (
    <p data-testid="chart">{months.map((month) => month.month).join(', ')}</p>
  ),
}));

const tagHistory = transactionsApi.tagHistory as jest.MockedFunction<
  typeof transactionsApi.tagHistory
>;

const TAGS = [
  {
    id: 'tag-trip',
    name: 'Trip',
    transactionCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tag-work',
    name: 'Work',
    transactionCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function month(
  key: string,
  income: string,
  expense: string,
  incomeCount = 0,
  expenseCount = 0
): TagMonthSummary {
  return { month: key, income, expense, incomeCount, expenseCount };
}

function makeReport(
  byMonth: TagMonthSummary[] = [
    month('2026-07', '0.00', '300.00', 0, 2),
    month('2026-08', '0.00', '0.00'),
    month('2026-09', '500.00', '100.00', 1, 1),
  ]
): TagHistoryReport {
  return {
    tagId: 'tag-trip',
    totalIncome: '500.00',
    totalExpense: '400.00',
    balance: '100.00',
    byMonth,
    currency: 'EUR',
    ratesDate: null,
  };
}

beforeEach(() => {
  tagHistory.mockReset();
  useTagReportStore.getState().reset();
  useTagsStore.setState({ tags: TAGS, status: 'success', error: null });
  useCurrencyStore.setState({ currency: 'EUR', hasHydrated: true });
});

async function chooseTag(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: 'Tag' }));
  await user.click(await screen.findByRole('option', { name }));
}

describe('formatMonth', () => {
  it('names a UTC month', () => {
    expect(formatMonth('2026-01')).toBe('Jan 2026');
    expect(formatMonth('2025-12')).toBe('Dec 2025');
  });
});

describe('TagReport', () => {
  it('asks for a tag before loading anything', () => {
    render(<TagReport />);

    expect(
      screen.getByText(
        'Choose a tag to see its income and expenses over all time.'
      )
    ).toBeInTheDocument();
    expect(tagHistory).not.toHaveBeenCalled();
  });

  it('shows the totals, every month on the chart and the months with transactions, newest first', async () => {
    tagHistory.mockResolvedValue(makeReport());
    render(<TagReport />);

    await chooseTag('Trip');

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(tagHistory).toHaveBeenCalledWith({
      tagId: 'tag-trip',
      currency: 'EUR',
    });
    expect(screen.getByText('All time')).toBeInTheDocument();
    expect(
      screen.getByText('500.00 EUR (€)', { selector: 'dd' })
    ).toBeVisible();
    expect(
      screen.getByText('400.00 EUR (€)', { selector: 'dd' })
    ).toBeVisible();
    expect(
      screen.getByText('100.00 EUR (€)', { selector: 'dd' })
    ).toBeVisible();
    expect(screen.getByTestId('chart')).toHaveTextContent(
      '2026-07, 2026-08, 2026-09'
    );
    expect(
      within(screen.getByRole('table'))
        .getAllByRole('row')
        .map((row) => row.textContent)
    ).toEqual([
      'MonthIncomeExpenses',
      'Sep 2026500.00 EUR (€)100.00 EUR (€)',
      'Jul 20260.00 EUR (€)300.00 EUR (€)',
    ]);
  });

  it('loads in the stored display currency once it is hydrated', async () => {
    useCurrencyStore.setState({ currency: 'RSD', hasHydrated: false });
    useTagReportStore.getState().setTagId('tag-trip');
    tagHistory.mockResolvedValue(makeReport());
    const { rerender } = render(<TagReport />);

    expect(tagHistory).not.toHaveBeenCalled();

    useCurrencyStore.setState({ hasHydrated: true });
    rerender(<TagReport />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(tagHistory).toHaveBeenCalledWith({
      tagId: 'tag-trip',
      currency: 'RSD',
    });
  });

  it('says so for a tag without transactions', async () => {
    tagHistory.mockResolvedValue({ ...makeReport([]), tagId: 'tag-work' });
    render(<TagReport />);

    await chooseTag('Work');

    expect(
      await screen.findByText('No transactions with this tag yet.')
    ).toBeInTheDocument();
  });

  it('shows the error with a retry', async () => {
    const user = userEvent.setup();
    tagHistory
      .mockRejectedValueOnce(new Error('Service unavailable'))
      .mockResolvedValueOnce(makeReport());
    useTagReportStore.getState().setTagId('tag-trip');
    render(<TagReport />);

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(tagHistory).toHaveBeenCalledTimes(2);
  });

  it('goes back to the prompt when the chosen tag was deleted', async () => {
    useTagReportStore.getState().setTagId('tag-gone');
    render(<TagReport />);

    expect(
      await screen.findByText(
        'Choose a tag to see its income and expenses over all time.'
      )
    ).toBeInTheDocument();
    expect(useTagReportStore.getState().tagId).toBeNull();
    expect(tagHistory).not.toHaveBeenCalled();
  });

  it('points to the settings without any tags', () => {
    useTagsStore.setState({ tags: [] });
    render(<TagReport />);

    expect(
      screen.getByRole('link', { name: 'Add them in the settings' })
    ).toHaveAttribute('href', '/settings');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
