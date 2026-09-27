import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from '@expense-tracker/types';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { useCurrencyStore } from '@web/entities/currency';
import { useSettingsStore } from '@web/entities/settings';
import { DefaultCurrencySelect } from '@web/features/settings/currency';
import { ResetSettingsButton } from '@web/features/settings/reset';
import { SettingsSync } from '@web/features/settings/sync';
import { settingsApi } from '@web/shared/api/settings-api';
import { THEME_STORAGE_KEY } from '@web/shared/lib/theme';

jest.mock('@web/shared/api/settings-api', () => ({
  settingsApi: { get: jest.fn(), update: jest.fn(), reset: jest.fn() },
}));
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const api = settingsApi as jest.Mocked<typeof settingsApi>;

const SAVED: UserSettings = {
  theme: 'dark',
  colorScheme: 'green',
  currency: 'EUR',
  currencies: ['RSD', 'EUR', 'HUF'],
  location: { mode: 'auto' },
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useSettingsStore.getState().reset();
  useCurrencyStore.setState({ currency: 'RSD', hasHydrated: true });
  document.documentElement.removeAttribute('data-scheme');
  document.documentElement.classList.remove('dark');
});

describe('SettingsSync', () => {
  it('loads the settings, paints the theme and caches it', async () => {
    api.get.mockResolvedValue(SAVED);

    render(<SettingsSync />);

    await waitFor(() =>
      expect(document.documentElement.dataset.scheme).toBe('green')
    );
    expect(document.documentElement).toHaveClass('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) ?? '')).toEqual({
      theme: 'dark',
      colorScheme: 'green',
    });
  });

  it('feeds the currency to the display currency store', async () => {
    api.get.mockResolvedValue(SAVED);

    render(<SettingsSync />);

    await waitFor(() =>
      expect(useCurrencyStore.getState().currency).toBe('EUR')
    );
  });

  it('follows later changes', async () => {
    api.get.mockResolvedValue(SAVED);
    render(<SettingsSync />);
    await waitFor(() =>
      expect(useCurrencyStore.getState().currency).toBe('EUR')
    );

    act(() => {
      useSettingsStore.setState({
        settings: { ...SAVED, currency: 'HUF', colorScheme: 'rose' },
      });
    });

    expect(useCurrencyStore.getState().currency).toBe('HUF');
    expect(document.documentElement.dataset.scheme).toBe('rose');
  });

  it('keeps the cached theme while the settings fail to load', async () => {
    api.get.mockRejectedValue(new Error('down'));
    document.documentElement.dataset.scheme = 'violet';

    render(<SettingsSync />);

    await waitFor(() =>
      expect(useSettingsStore.getState().status).toBe('error')
    );
    expect(document.documentElement.dataset.scheme).toBe('violet');
  });
});

describe('DefaultCurrencySelect', () => {
  it('saves the chosen currency', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    api.update.mockResolvedValue({ ...SAVED, currency: 'HUF' });
    const user = userEvent.setup();
    render(<DefaultCurrencySelect value="EUR" />);

    await user.click(
      screen.getByRole('combobox', { name: 'Default currency' })
    );
    await user.click(await screen.findByRole('option', { name: 'HUF (Ft)' }));

    expect(api.update).toHaveBeenCalledWith({ currency: 'HUF' });
  });
});

describe('ResetSettingsButton', () => {
  async function confirmReset() {
    const user = userEvent.setup();
    render(<ResetSettingsButton />);
    await user.click(screen.getByRole('button', { name: 'Reset settings' }));
    expect(await screen.findByText(/Your password/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));
  }

  beforeEach(() => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
  });

  it('asks first, then puts the defaults back', async () => {
    api.reset.mockResolvedValue(DEFAULT_USER_SETTINGS);

    await confirmReset();

    await waitFor(() =>
      expect(useSettingsStore.getState().settings).toEqual(
        DEFAULT_USER_SETTINGS
      )
    );
    expect(toast.success).toHaveBeenCalledWith('Settings reset to defaults');
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  });

  it('does nothing when cancelled', async () => {
    const user = userEvent.setup();
    render(<ResetSettingsButton />);
    await user.click(screen.getByRole('button', { name: 'Reset settings' }));

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(api.reset).not.toHaveBeenCalled();
  });

  it('reports a failure and keeps the dialog open', async () => {
    api.reset.mockRejectedValue(new Error('down'));

    await confirmReset();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('down'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(useSettingsStore.getState().settings).toEqual(SAVED);
  });
});
