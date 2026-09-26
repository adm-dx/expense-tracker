import { useCurrencyStore } from '@web/entities/currency/model/store';
import { resetRegisteredStores } from '@web/shared/lib/store-reset';

const STORAGE_KEY = 'display-currency';

function stored(currency: unknown) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ state: { currency }, version: 0 })
  );
}

beforeEach(() => {
  localStorage.clear();
  useCurrencyStore.setState({ currency: 'RSD', hasHydrated: false });
});

describe('useCurrencyStore', () => {
  it('defaults to RSD', () => {
    expect(useCurrencyStore.getState().currency).toBe('RSD');
  });

  it('persists the chosen currency to localStorage', () => {
    useCurrencyStore.getState().setCurrency('EUR');

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toEqual({
      state: { currency: 'EUR' },
      version: 0,
    });
  });

  it('restores the stored currency and flags hydration', async () => {
    stored('HUF');

    await useCurrencyStore.persist.rehydrate();

    expect(useCurrencyStore.getState()).toMatchObject({
      currency: 'HUF',
      hasHydrated: true,
    });
  });

  it('falls back to RSD for an unknown stored value', async () => {
    // Set first: the persist middleware writes every state change to storage.
    useCurrencyStore.setState({ currency: 'EUR' });
    stored('USD');

    await useCurrencyStore.persist.rehydrate();

    expect(useCurrencyStore.getState().currency).toBe('RSD');
  });

  it('survives a session change', () => {
    useCurrencyStore.getState().setCurrency('EUR');

    resetRegisteredStores();

    expect(useCurrencyStore.getState().currency).toBe('EUR');
  });
});
