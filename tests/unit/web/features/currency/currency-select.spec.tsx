import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCurrencyStore } from '@web/entities/currency/model/store';
import { useExchangeRatesStore } from '@web/entities/currency/model/rates-store';
import { useTransactionsStore } from '@web/entities/transaction/model/store';
import {
  CurrencySelect,
  DisplayCurrencySync,
} from '@web/features/currency/select';
import { exchangeRatesApi } from '@web/shared/api/exchange-rates-api';

jest.mock('@web/shared/api/exchange-rates-api', () => ({
  exchangeRatesApi: { get: jest.fn() },
}));

const getRates = exchangeRatesApi.get as jest.MockedFunction<
  typeof exchangeRatesApi.get
>;

beforeEach(() => {
  localStorage.clear();
  getRates.mockReset();
  getRates.mockResolvedValue({
    base: 'EUR',
    date: '2026-09-26T00:02:32.000Z',
    rates: { EUR: '1', RSD: '117.5', HUF: '400' },
  });
  useCurrencyStore.setState({ currency: 'RSD', hasHydrated: true });
  useExchangeRatesStore.getState().reset();
  useTransactionsStore.getState().reset();
  useTransactionsStore.setState({ currency: null });
});

describe('CurrencySelect', () => {
  it('shows the current currency on the trigger', () => {
    render(<CurrencySelect />);

    expect(
      screen.getByRole('button', { name: 'Display currency: RSD' })
    ).toBeEnabled();
  });

  it('stays disabled until the stored choice is restored', () => {
    useCurrencyStore.setState({ hasHydrated: false });

    render(<CurrencySelect />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('offers the three currencies and stores the choice', async () => {
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));
    const options = await screen.findAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual([
      'RSD',
      'EUR',
      'HUF',
    ]);
    expect(screen.getByRole('menuitemradio', { name: 'RSD' })).toBeChecked();

    await user.click(screen.getByRole('menuitemradio', { name: 'EUR' }));

    expect(useCurrencyStore.getState().currency).toBe('EUR');
  });

  it('loads the rates on open and prices the others in the current currency', async () => {
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));

    expect(await screen.findByText('1 EUR = 117.5 RSD')).toBeInTheDocument();
    expect(screen.getByText('1 HUF = 0.2938 RSD')).toBeInTheDocument();
    expect(screen.getByText('Rates of Sep 26, 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Rates by ExchangeRate-API' })
    ).toHaveAttribute('href', 'https://www.exchangerate-api.com');
    expect(getRates).toHaveBeenCalledTimes(1);
  });

  it('still lets the user switch when the rates fail to load', async () => {
    getRates.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));

    expect(
      await screen.findByText('Exchange rates are unavailable')
    ).toBeInTheDocument();
    await user.click(screen.getByRole('menuitemradio', { name: 'HUF' }));
    expect(useCurrencyStore.getState().currency).toBe('HUF');
  });
});

describe('DisplayCurrencySync', () => {
  it('waits for hydration before handing the currency over', () => {
    useCurrencyStore.setState({ currency: 'EUR', hasHydrated: false });

    const { rerender } = render(<DisplayCurrencySync />);
    expect(useTransactionsStore.getState().currency).toBeNull();

    useCurrencyStore.setState({ hasHydrated: true });
    rerender(<DisplayCurrencySync />);
    expect(useTransactionsStore.getState().currency).toBe('EUR');
  });

  it('follows later changes', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DisplayCurrencySync />
        <CurrencySelect />
      </>
    );
    expect(useTransactionsStore.getState().currency).toBe('RSD');

    await user.click(screen.getByRole('button', { name: /Display currency/ }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'HUF' }));

    expect(useTransactionsStore.getState().currency).toBe('HUF');
  });
});
