import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTransactionsStore } from '@web/entities/transaction/model/store';
import { PeriodFilter } from '@web/features/transaction/period-filter';

const SEPTEMBER = { dateFrom: '2026-09-01', dateTo: '2026-09-30' };

// Fake timers would also freeze user-event's and Radix's timers, so only the
// clock behind the presets is pinned.
jest.mock('@web/shared/lib/format', () => ({
  ...jest.requireActual('@web/shared/lib/format'),
  // `jest.mock` is hoisted above the imports, so the date is inlined here.
  todayDateInputValue: () => '2026-09-16',
}));

beforeEach(() => {
  useTransactionsStore.getState().reset();
  useTransactionsStore.setState({ period: SEPTEMBER, preset: 'this-month' });
});

function period() {
  return useTransactionsStore.getState().period;
}

describe('PeriodFilter', () => {
  it('shows the current period in the date inputs', () => {
    render(<PeriodFilter />);

    expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-09-30');
  });

  it('applies a preset chosen from the list', async () => {
    const user = userEvent.setup();
    render(<PeriodFilter />);

    await user.click(screen.getByRole('combobox', { name: 'Period' }));
    await user.click(await screen.findByRole('option', { name: 'Last month' }));

    expect(screen.getByLabelText('From')).toHaveValue('2026-08-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-08-31');
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent(
      'Last month'
    );
    expect(useTransactionsStore.getState().preset).toBe('last-month');
    expect(period()).toEqual({ dateFrom: '2026-08-01', dateTo: '2026-08-31' });
  });

  it('goes back to the first page when the period changes', async () => {
    const user = userEvent.setup();
    useTransactionsStore.setState({ page: 4 });
    render(<PeriodFilter />);

    await user.click(screen.getByRole('combobox', { name: 'Period' }));
    await user.click(await screen.findByRole('option', { name: 'This year' }));

    expect(useTransactionsStore.getState().page).toBe(1);
  });

  it('switches to Custom when a date is edited', () => {
    render(<PeriodFilter />);

    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2026-09-10' },
    });

    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent(
      'Custom'
    );
    expect(useTransactionsStore.getState().preset).toBe('custom');
    expect(period()).toEqual({ dateFrom: '2026-09-10', dateTo: '2026-09-30' });
  });

  it('drags "To" along when "From" is moved past it', () => {
    render(<PeriodFilter />);

    fireEvent.change(screen.getByLabelText('From'), {
      target: { value: '2027-09-30' },
    });

    // Never an inverted range: the API rejects it with a 400.
    expect(screen.getByLabelText('To')).toHaveValue('2027-09-30');
    expect(period()).toEqual({ dateFrom: '2027-09-30', dateTo: '2027-09-30' });
  });

  it('drags "From" along when "To" is moved before it', () => {
    render(<PeriodFilter />);

    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: '2026-08-15' },
    });

    expect(screen.getByLabelText('From')).toHaveValue('2026-08-15');
    expect(period()).toEqual({ dateFrom: '2026-08-15', dateTo: '2026-08-15' });
  });

  it('ignores a cleared date input', () => {
    render(<PeriodFilter />);

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } });

    expect(screen.getByLabelText('From')).toHaveValue('2026-09-01');
    expect(period()).toEqual(SEPTEMBER);
    expect(useTransactionsStore.getState().preset).toBe('this-month');
  });
});
