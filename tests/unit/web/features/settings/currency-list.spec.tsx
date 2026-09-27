import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from '@expense-tracker/types';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useSettingsStore } from '@web/entities/settings';
import {
  useSummaryStore,
  useTransactionsStore,
} from '@web/entities/transaction';
import { CurrencyList } from '@web/features/settings/currencies';
import { settingsApi } from '@web/shared/api/settings-api';

jest.mock('@web/shared/api/settings-api', () => ({
  settingsApi: { addCurrency: jest.fn(), removeCurrency: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = settingsApi as jest.Mocked<typeof settingsApi>;

const SAVED: UserSettings = {
  ...DEFAULT_USER_SETTINGS,
  currency: 'EUR',
  currencies: ['RSD', 'EUR', 'HUF'],
};

let fetchTransactions: jest.SpyInstance;
let fetchSummary: jest.SpyInstance;
let unsubscribe = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.getState().reset();
  useSettingsStore.setState({ settings: SAVED, status: 'success' });
  fetchTransactions = jest
    .spyOn(useTransactionsStore.getState(), 'fetch')
    .mockResolvedValue();
  fetchSummary = jest
    .spyOn(useSummaryStore.getState(), 'fetch')
    .mockResolvedValue();
});

afterEach(() => {
  unsubscribe();
  fetchTransactions.mockRestore();
  fetchSummary.mockRestore();
});

function renderList() {
  const { rerender } = render(<CurrencyList value={SAVED.currencies} />);
  // Re-render from the store, the way the settings panel does.
  unsubscribe = useSettingsStore.subscribe((state) => {
    if (state.settings) {
      rerender(<CurrencyList value={state.settings.currencies} />);
    }
  });
}

function listedCurrencies() {
  return within(screen.getByRole('list', { name: 'Your currencies' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent);
}

describe('CurrencyList', () => {
  it('lists the currencies with their symbols and names', () => {
    renderList();

    expect(listedCurrencies()).toEqual([
      'RSD (дин.)Serbian dinarDefault',
      'EUR (€)Euro',
      'HUF (Ft)Hungarian forint',
    ]);
  });

  it('offers no way to remove RSD', () => {
    renderList();

    expect(
      screen.queryByRole('button', { name: 'Remove RSD' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove EUR' })).toBeEnabled();
  });

  it('adds a currency picked from the ones not enabled yet', async () => {
    api.addCurrency.mockResolvedValue({
      ...SAVED,
      currencies: [...SAVED.currencies, 'USD'],
    });
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('combobox', { name: 'Currency to add' }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).not.toContain(
      'EUR (€) · Euro'
    );
    await user.click(
      screen.getByRole('option', { name: 'USD ($) · US dollar' })
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(api.addCurrency).toHaveBeenCalledWith('USD');
    await waitFor(() =>
      expect(listedCurrencies()).toContain('USD ($)US dollar')
    );
  });

  it('removes a currency after confirming and reloads the converted transactions', async () => {
    api.removeCurrency.mockResolvedValue({
      settings: { ...SAVED, currency: 'RSD', currencies: ['RSD', 'HUF'] },
      convertedCount: 2,
    });
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: 'Remove EUR' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      "Transactions in EUR will be converted to RSD (дин.) at today's exchange rate."
    );
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    expect(api.removeCurrency).toHaveBeenCalledWith('EUR');
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
    expect(listedCurrencies()).toEqual([
      'RSD (дин.)Serbian dinarDefault',
      'HUF (Ft)Hungarian forint',
    ]);
    expect(toast.success).toHaveBeenCalledWith(
      'EUR removed, 2 transactions converted to RSD'
    );
    expect(fetchTransactions).toHaveBeenCalled();
    expect(fetchSummary).toHaveBeenCalled();
  });

  it('keeps the currency and the dialog when removing fails', async () => {
    api.removeCurrency.mockRejectedValue(new Error('Rates are unavailable'));
    const user = userEvent.setup();
    renderList();

    await user.click(screen.getByRole('button', { name: 'Remove EUR' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Rates are unavailable')
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    // The open dialog hides the list from the accessibility tree.
    expect(useSettingsStore.getState().settings?.currencies).toContain('EUR');
    expect(fetchTransactions).not.toHaveBeenCalled();
  });
});
