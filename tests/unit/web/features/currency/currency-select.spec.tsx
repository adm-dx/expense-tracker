import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_USER_SETTINGS } from '@expense-tracker/types';
import { useCurrencyStore } from '@web/entities/currency/model/store';
import { useSettingsStore } from '@web/entities/settings';
import { useExchangeRatesStore } from '@web/entities/currency/model/rates-store';
import { useTransactionsStore } from '@web/entities/transaction/model/store';
import {
  CurrencySelect,
  DisplayCurrencySync,
} from '@web/features/currency/select';
import { SettingsSync } from '@web/features/settings/sync';
import { exchangeRatesApi } from '@web/shared/api/exchange-rates-api';
import { settingsApi } from '@web/shared/api/settings-api';

jest.mock('@web/shared/api/exchange-rates-api', () => ({
  exchangeRatesApi: { get: jest.fn() },
}));
jest.mock('@web/shared/api/settings-api', () => ({
  settingsApi: { get: jest.fn(), update: jest.fn() },
}));

const updateSettings = settingsApi.update as jest.MockedFunction<
  typeof settingsApi.update
>;

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
  updateSettings.mockReset();
  updateSettings.mockImplementation((patch) =>
    Promise.resolve({ ...DEFAULT_USER_SETTINGS, ...patch })
  );
  useSettingsStore.getState().reset();
  useSettingsStore.setState({
    settings: { ...DEFAULT_USER_SETTINGS },
    status: 'success',
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
      screen.getByRole('button', { name: 'Display currency: RSD (дин.)' })
    ).toBeEnabled();
  });

  it('stays disabled until the stored choice is restored', () => {
    useCurrencyStore.setState({ hasHydrated: false });

    render(<CurrencySelect />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('offers the enabled currencies and saves the choice as the setting', async () => {
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));
    const options = await screen.findAllByRole('menuitemradio');
    expect(options.map((option) => option.textContent)).toEqual([
      'RSD (дин.)',
      'EUR (€)',
      'HUF (Ft)',
    ]);
    expect(
      screen.getByRole('menuitemradio', { name: 'RSD (дин.)' })
    ).toBeChecked();

    await user.click(screen.getByRole('menuitemradio', { name: 'EUR (€)' }));

    expect(updateSettings).toHaveBeenCalledWith({ currency: 'EUR' });
    expect(useSettingsStore.getState().settings?.currency).toBe('EUR');
  });

  it('follows the currencies enabled in the settings', async () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_USER_SETTINGS, currencies: ['RSD', 'USD'] },
    });
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));
    const options = await screen.findAllByRole('menuitemradio');

    expect(options.map((option) => option.textContent)).toEqual([
      'RSD (дин.)',
      'USD ($)',
    ]);
  });

  it('keeps the old currency when saving fails', async () => {
    updateSettings.mockRejectedValue(new Error('down'));
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'EUR (€)' })
    );

    await screen.findByRole('button', {
      name: 'Display currency: RSD (дин.)',
    });
    expect(useSettingsStore.getState().settings?.currency).toBe('RSD');
  });

  it('loads the rates on open and prices the others in the current currency', async () => {
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));

    expect(
      await screen.findByText('1 EUR (€) = 117.5 RSD (дин.)')
    ).toBeInTheDocument();
    expect(
      screen.getByText('1 HUF (Ft) = 0.2938 RSD (дин.)')
    ).toBeInTheDocument();
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
    await user.click(screen.getByRole('menuitemradio', { name: 'HUF (Ft)' }));
    expect(updateSettings).toHaveBeenCalledWith({ currency: 'HUF' });
  });

  it('leaves out a currency without a rate today', async () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_USER_SETTINGS, currencies: ['RSD', 'EUR', 'GBP'] },
    });
    const user = userEvent.setup();
    render(<CurrencySelect />);

    await user.click(screen.getByRole('button', { name: /Display currency/ }));

    expect(
      await screen.findByText('1 EUR (€) = 117.5 RSD (дин.)')
    ).toBeInTheDocument();
    expect(screen.queryByText(/GBP \(£\) =/)).not.toBeInTheDocument();
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
        <SettingsSync />
        <DisplayCurrencySync />
        <CurrencySelect />
      </>
    );
    expect(useTransactionsStore.getState().currency).toBe('RSD');

    await user.click(screen.getByRole('button', { name: /Display currency/ }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'HUF (Ft)' })
    );

    expect(useTransactionsStore.getState().currency).toBe('HUF');
  });
});
