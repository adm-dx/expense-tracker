import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from '@expense-tracker/types';
import { useSettingsStore } from '@web/entities/settings';
import { settingsApi } from '@web/shared/api/settings-api';
import { resetRegisteredStores } from '@web/shared/lib/store-reset';

jest.mock('@web/shared/api/settings-api', () => ({
  settingsApi: {
    get: jest.fn(),
    update: jest.fn(),
    replace: jest.fn(),
    reset: jest.fn(),
    addCurrency: jest.fn(),
    removeCurrency: jest.fn(),
  },
}));

const api = settingsApi as jest.Mocked<typeof settingsApi>;

const SAVED: UserSettings = {
  theme: 'dark',
  colorScheme: 'blue',
  currency: 'EUR',
  currencies: ['RSD', 'EUR', 'HUF'],
  location: { mode: 'auto' },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const state = () => useSettingsStore.getState();

beforeEach(() => {
  jest.resetAllMocks();
  state().reset();
});

describe('load', () => {
  it('loads the settings once', async () => {
    api.get.mockResolvedValue(SAVED);

    await state().load();
    await state().load();

    expect(state()).toMatchObject({ settings: SAVED, status: 'success' });
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('refetches with force', async () => {
    api.get.mockResolvedValue(SAVED);
    await state().load();

    await state().load({ force: true });

    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('records a failure', async () => {
    api.get.mockRejectedValue(new Error('down'));

    await state().load();

    expect(state()).toMatchObject({
      settings: null,
      status: 'error',
      error: 'down',
    });
  });

  it('drops a response that arrives after a reset (sign-out)', async () => {
    const pending = deferred<UserSettings>();
    api.get.mockReturnValue(pending.promise);

    const loading = state().load();
    state().reset();
    pending.resolve(SAVED);
    await loading;

    expect(state()).toMatchObject({ settings: null, status: 'idle' });
  });

  it('does not undo a change made while it was loading', async () => {
    useSettingsStore.setState({ settings: DEFAULT_USER_SETTINGS });
    const pending = deferred<UserSettings>();
    api.get.mockReturnValue(pending.promise);
    api.update.mockResolvedValue({ ...DEFAULT_USER_SETTINGS, theme: 'light' });

    const loading = state().load({ force: true });
    await state().update({ theme: 'light' });
    pending.resolve(DEFAULT_USER_SETTINGS);
    await loading;

    expect(state().settings?.theme).toBe('light');
    expect(state().status).toBe('success');
  });
});

describe('update', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
  });

  it('shows the change before the server answers', async () => {
    const pending = deferred<UserSettings>();
    api.update.mockReturnValue(pending.promise);

    const saving = state().update({ currency: 'HUF' });

    expect(state().settings).toEqual({ ...SAVED, currency: 'HUF' });
    expect(api.update).toHaveBeenCalledWith({ currency: 'HUF' });
    pending.resolve({ ...SAVED, currency: 'HUF' });
    await expect(saving).resolves.toEqual({ ...SAVED, currency: 'HUF' });
  });

  it('keeps what the server saved', async () => {
    const manual = {
      mode: 'manual',
      name: 'Novi Sad, RS',
      lat: 45.25,
      lon: 19.84,
    } as const;
    api.update.mockResolvedValue({ ...SAVED, location: manual });

    await state().update({
      location: { ...manual, lat: 45.2517, lon: 19.8369 },
    });

    expect(state().settings?.location).toEqual(manual);
  });

  it('puts the old settings back and rethrows on failure', async () => {
    api.update.mockRejectedValue(new Error('Bad Request'));

    await expect(state().update({ theme: 'light' })).rejects.toThrow(
      'Bad Request'
    );

    expect(state().settings).toEqual(SAVED);
  });

  it('lets a later change win over an earlier one that fails', async () => {
    const first = deferred<UserSettings>();
    api.update
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ ...SAVED, theme: 'light', currency: 'HUF' });

    const failing = state().update({ theme: 'light' });
    await state().update({ currency: 'HUF' });
    first.reject(new Error('timeout'));
    await expect(failing).rejects.toThrow('timeout');

    expect(state().settings).toMatchObject({ theme: 'light', currency: 'HUF' });
  });

  it('ignores the answer when the user signed out meanwhile', async () => {
    const pending = deferred<UserSettings>();
    api.update.mockReturnValue(pending.promise);

    const saving = state().update({ theme: 'light' });
    resetRegisteredStores();
    pending.resolve({ ...SAVED, theme: 'light' });
    await saving;

    expect(state().settings).toBeNull();
  });
});

describe('resetToDefaults', () => {
  it('stores the defaults the server answers with', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    api.reset.mockResolvedValue(DEFAULT_USER_SETTINGS);

    await state().resetToDefaults();

    expect(state().settings).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('leaves the settings alone when the reset fails', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    api.reset.mockRejectedValue(new Error('down'));

    await expect(state().resetToDefaults()).rejects.toThrow('down');

    expect(state().settings).toEqual(SAVED);
  });
});

describe('addCurrency', () => {
  it('stores what the server answers with', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    const saved = {
      ...SAVED,
      currencies: [...SAVED.currencies, 'USD' as const],
    };
    api.addCurrency.mockResolvedValue(saved);

    await expect(state().addCurrency('USD')).resolves.toEqual(saved);

    expect(api.addCurrency).toHaveBeenCalledWith('USD');
    expect(state().settings).toEqual(saved);
  });
});

describe('removeCurrency', () => {
  it('stores the settings and returns how many were converted', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    const settings: UserSettings = {
      ...SAVED,
      currency: 'RSD',
      currencies: ['RSD', 'HUF'],
    };
    api.removeCurrency.mockResolvedValue({ settings, convertedCount: 2 });

    await expect(state().removeCurrency('EUR')).resolves.toEqual({
      settings,
      convertedCount: 2,
    });

    expect(state().settings).toEqual(settings);
  });

  it('leaves the settings alone when it fails', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    api.removeCurrency.mockRejectedValue(new Error('down'));

    await expect(state().removeCurrency('EUR')).rejects.toThrow('down');

    expect(state().settings).toEqual(SAVED);
  });

  it('ignores the answer when the user signed out meanwhile', async () => {
    useSettingsStore.setState({ settings: SAVED, status: 'success' });
    const request = deferred<{
      settings: UserSettings;
      convertedCount: number;
    }>();
    api.removeCurrency.mockReturnValue(request.promise);

    const pending = state().removeCurrency('EUR');
    state().reset();
    request.resolve({ settings: SAVED, convertedCount: 0 });
    await pending;

    expect(state().settings).toBeNull();
  });
});

it('is cleared with the other session stores', () => {
  useSettingsStore.setState({ settings: SAVED, status: 'success' });

  resetRegisteredStores();

  expect(state()).toMatchObject({ settings: null, status: 'idle' });
});
